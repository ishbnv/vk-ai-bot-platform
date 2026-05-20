import { and, desc, eq, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { communities, dialogs, messages, prompts } from '@/db/schema';
import { logger } from '@/lib/logger';
import { decrypt } from '@/lib/crypto';
import { chat } from '@/services/openrouter';
import { usersGet, messagesSend } from '@/services/vk';
import { nudgeQueue, type TDialogJob } from '@/queues';

import { buildContext } from './context';
import { replacePlaceholders } from './placeholders';

export const processDialogJob = async (data: TDialogJob): Promise<void> => {
  const { communityId, event } = data;
  const vkUserId = event.message.from_id;
  const userText = event.message.text;

  // 1. Load community
  const [community] = await db
    .select()
    .from(communities)
    .where(eq(communities.id, communityId))
    .limit(1);
  if (!community) throw new Error(`Community ${communityId} not found`);
  if (!community.is_active) {
    logger.info({ communityId }, 'Community inactive — skipping dialog');
    return;
  }

  // 2. Find or create dialog
  let [dialog] = await db
    .select()
    .from(dialogs)
    .where(and(eq(dialogs.community_id, communityId), eq(dialogs.vk_user_id, vkUserId)))
    .limit(1);

  let decryptedToken: string;
  try {
    decryptedToken = decrypt(community.vk_access_token_encrypted);
  } catch (err) {
    logger.error({ err, communityId }, 'Failed to decrypt VK access token');
    throw err;
  }

  if (!dialog) {
    let firstName: string | null = null;
    let lastName: string | null = null;
    try {
      const [u] = await usersGet(decryptedToken, [vkUserId]);
      firstName = u?.first_name ?? null;
      lastName = u?.last_name ?? null;
    } catch (err) {
      logger.warn({ err, vkUserId }, 'users.get failed — proceeding without name');
    }

    [dialog] = await db
      .insert(dialogs)
      .values({
        community_id: communityId,
        vk_user_id: vkUserId,
        vk_user_first_name: firstName,
        vk_user_last_name: lastName,
        bucket_model: community.active_model, // фиксируем модель для диалога (A/B — v2)
        status: 'active',
        last_message_at: new Date()
      })
      .returning();
  }

  if (!dialog) throw new Error('Failed to find or create dialog');

  // 3. Save user message
  const attachments = (event.message.attachments ?? []).map((a) => ({
    type: a.type,
    url: ''
  }));
  await db.insert(messages).values({
    dialog_id: dialog.id,
    role: 'user',
    content: userText,
    attachments
  });

  // 4. Update dialog counters + reactivate if was nudged
  await db
    .update(dialogs)
    .set({
      last_message_at: new Date(),
      total_messages: sql`${dialogs.total_messages} + 1`,
      status: dialog.status === 'nudged' ? 'active' : dialog.status
    })
    .where(eq(dialogs.id, dialog.id));

  // 5. Cancel pending nudge (если был запланирован)
  await nudgeQueue.remove(`nudge:${dialog.id}`).catch(() => {
    /* nothing to cancel */
  });

  // 6. Load active prompt
  const [activePrompt] = await db
    .select()
    .from(prompts)
    .where(and(eq(prompts.community_id, communityId), eq(prompts.is_active, true)))
    .orderBy(desc(prompts.version))
    .limit(1);
  if (!activePrompt) throw new Error(`No active prompt for community ${communityId}`);

  // 7. Build context (token-aware)
  const systemPrompt = activePrompt.system_prompt.replace(
    /\{\{community_name\}\}/g,
    community.name
  );
  const chatMessages = await buildContext(dialog.id, systemPrompt, {
    windowMessages: community.context_window_messages,
    tokenLimit: community.context_token_limit
  });

  // 8. Pick model — в MVP без A/B, берём dialog.bucket_model
  const model = dialog.bucket_model ?? community.active_model;

  // 9. Call OpenRouter
  const result = await chat({ model, messages: chatMessages });

  // 10. Replace placeholders на UTM-ссылки через redirect-эндпоинт
  const { text: finalText, linkSentId } = await replacePlaceholders(
    result.content,
    communityId,
    dialog.id,
    vkUserId
  );

  // 11. Save assistant message + update dialog totals
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
      total_tokens_input: sql`${dialogs.total_tokens_input} + ${result.tokensIn}`,
      total_tokens_output: sql`${dialogs.total_tokens_output} + ${result.tokensOut}`,
      total_cost_usd: sql`${dialogs.total_cost_usd} + ${result.costUsd.toFixed(6)}::numeric`,
      last_message_at: new Date()
    })
    .where(eq(dialogs.id, dialog.id));

  // 12. Send to VK
  await messagesSend(decryptedToken, {
    userId: vkUserId,
    message: finalText,
    dontParseLinks: false
  });

  // 13. Schedule nudge
  if (community.nudge_delay_hours > 0) {
    await nudgeQueue.add(
      'send-nudge',
      { dialogId: dialog.id, communityId },
      {
        delay: community.nudge_delay_hours * 3600 * 1000,
        jobId: `nudge:${dialog.id}`
      }
    );
  }

  logger.info(
    {
      dialogId: dialog.id,
      model,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      costUsd: result.costUsd,
      latencyMs: result.latencyMs,
      linkSentId
    },
    'Dialog turn completed'
  );
};
