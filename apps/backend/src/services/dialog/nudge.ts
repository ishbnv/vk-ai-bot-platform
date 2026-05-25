import { and, desc, eq, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { communities, dialogs, messages, prompts } from '@/db/schema';
import { logger } from '@/lib/logger';
import { decrypt } from '@/lib/crypto';
import { chat } from '@/services/openrouter';
import { messagesSend } from '@/services/vk';
import { nudgeQueue, type TNudgeJob } from '@/queues';
import { VkApiError } from '@/services/vk';

import { buildContext } from './context';
import { replacePlaceholders } from './placeholders';
import { computeWorkHoursDelay } from './work-hours';

const MAX_NUDGES = 2;
const NUDGE_INSTRUCTION =
  '\n\nКонтекст: пользователь не отвечает уже несколько часов. ' +
  'Напомни о себе мягко, кратко (1 предложение), без давления. ' +
  'Не повторяй последний вопрос дословно и не вставляй ссылки.';

export const processNudgeJob = async (data: TNudgeJob): Promise<void> => {
  const { dialogId, communityId } = data;

  // 1. Load fresh dialog
  const [dialog] = await db
    .select()
    .from(dialogs)
    .where(eq(dialogs.id, dialogId))
    .limit(1);
  if (!dialog) return;
  if (dialog.status !== 'active' && dialog.status !== 'nudged') return;
  if (dialog.nudge_count >= MAX_NUDGES) return;

  const [community] = await db
    .select()
    .from(communities)
    .where(eq(communities.id, communityId))
    .limit(1);
  if (!community || !community.is_active) return;

  // 2. Work hours — defer if outside
  const delay = computeWorkHoursDelay(community.work_hours_start, community.work_hours_end);
  if (delay > 0) {
    await nudgeQueue.add(
      'send-nudge',
      data,
      { delay, jobId: `nudge-${dialogId}` }
    );
    logger.info({ dialogId, delayMs: delay }, 'Nudge deferred outside work hours');
    return;
  }

  // 3. Load active prompt + context
  const [activePrompt] = await db
    .select()
    .from(prompts)
    .where(and(eq(prompts.community_id, communityId), eq(prompts.is_active, true)))
    .orderBy(desc(prompts.version))
    .limit(1);
  if (!activePrompt) {
    logger.warn({ communityId }, 'Nudge skipped: no active prompt');
    return;
  }

  const systemPrompt =
    activePrompt.system_prompt.replace(/\{\{community_name\}\}/g, community.name) +
    NUDGE_INSTRUCTION;

  const chatMessages = await buildContext(dialog.id, systemPrompt, {
    windowMessages: community.context_window_messages,
    tokenLimit: community.context_token_limit
  });

  const model = dialog.bucket_model ?? community.active_model;

  // 4. Decrypt token before LLM call — fail fast если шифр сломан
  let decryptedToken: string;
  try {
    decryptedToken = decrypt(community.vk_access_token_encrypted);
  } catch (err) {
    logger.error({ err, communityId }, 'Nudge: failed to decrypt VK token');
    throw err;
  }

  // 5. LLM
  const result = await chat({ model, messages: chatMessages });

  // 6. Replace placeholders (в инструкции мы просим их не вставлять, но защита не помешает)
  const { text: finalText, linkSentId } = await replacePlaceholders({
    text: result.content,
    communityId,
    dialogId: dialog.id,
    vkUserId: dialog.vk_user_id,
    bypassRedirect: community.use_direct_links,
    ref: dialog.ref,
    refSource: dialog.ref_source
  });

  // 7. Save assistant message + bump dialog
  await db.insert(messages).values({
    dialog_id: dialog.id,
    role: 'assistant',
    content: finalText,
    model_used: model,
    tokens_input: result.tokensIn,
    tokens_output: result.tokensOut,
    cost_usd: result.costUsd.toFixed(6),
    latency_ms: result.latencyMs,
    link_sent_id: linkSentId
  });

  await db
    .update(dialogs)
    .set({
      status: 'nudged',
      nudge_count: sql`${dialogs.nudge_count} + 1`,
      total_tokens_input: sql`${dialogs.total_tokens_input} + ${result.tokensIn}`,
      total_tokens_output: sql`${dialogs.total_tokens_output} + ${result.tokensOut}`,
      total_cost_usd: sql`${dialogs.total_cost_usd} + ${result.costUsd.toFixed(6)}::numeric`,
      last_message_at: new Date()
    })
    .where(eq(dialogs.id, dialog.id));

  // 8. Send to VK — пропускаем пустой текст, не ретраим VK validation-ошибки.
  if (!finalText.trim()) {
    logger.warn(
      { dialogId: dialog.id, model },
      'Empty nudge LLM response — skipping send, scheduling next nudge'
    );
  } else {
    try {
      await messagesSend(decryptedToken, {
        userId: dialog.vk_user_id,
        message: finalText
      });
    } catch (err) {
      if (err instanceof VkApiError && err.code === 100) {
        logger.error(
          { err, dialogId: dialog.id, message: finalText },
          'VK rejected nudge (error 100), завершаем job без retry'
        );
        return;
      }
      throw err;
    }
  }

  // 9. Schedule next nudge with escalation (× 2) — только если был первый из двух.
  // Ошибки в schedule не валим — иначе при retry будет повторное LLM + send.
  const newCount = dialog.nudge_count + 1;
  if (newCount < MAX_NUDGES) {
    try {
      const nextDelay = community.nudge_delay_minutes * 60 * 1000 * 2;
      await nudgeQueue.add(
        'send-nudge',
        { dialogId: dialog.id, communityId },
        { delay: nextDelay, jobId: `nudge-${dialog.id}` }
      );
    } catch (err) {
      logger.error({ err, dialogId: dialog.id }, 'Failed to schedule next nudge');
    }
  }

  logger.info(
    {
      dialogId: dialog.id,
      nudgeCount: newCount,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      costUsd: result.costUsd
    },
    'Nudge sent'
  );
};
