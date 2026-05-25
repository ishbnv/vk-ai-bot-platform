import { and, desc, eq, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { communities, dialogs, messages, prompts } from '@/db/schema';
import { logger } from '@/lib/logger';
import { decrypt } from '@/lib/crypto';
import { redisConnection } from '@/lib/redis';
import { chat } from '@/services/openrouter';
import { usersGet, messagesSend, VkApiError } from '@/services/vk';
import { nudgeQueue, type TDialogJob } from '@/queues';

import { buildContext } from './context';
import { replacePlaceholders } from './placeholders';
import { countPacks, replaceNextPackPlaceholder } from './offer-packs';

export const processDialogJob = async (data: TDialogJob): Promise<void> => {
  const { communityId, event, eventId } = data;
  const vkUserId = event.message.from_id;
  const userText = event.message.text;

  // 0. Idempotency — гарантия что один VK event обработается ровно один раз даже при retry.
  // SETNX с TTL 1h: первый job получает 'OK', повторные (после throw в любой точке ниже) — null.
  const claim = await redisConnection.set(`dialog:processed:${eventId}`, '1', 'EX', 3600, 'NX');
  if (claim !== 'OK') {
    logger.info({ eventId, communityId }, 'Event already processed — skipping');
    return;
  }

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
        // VK Ads ref-tags из первого сообщения. Дальше не перезаписываем.
        ref: event.message.ref ?? null,
        ref_source: event.message.ref_source ?? null,
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
  await nudgeQueue.remove(`nudge-${dialog.id}`).catch(() => {
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

  // 7. Build context (token-aware) + служебная метка про остаток пачек —
  // LLM нужна, чтобы понимать когда вставлять {{NEXT_PACK}} а когда прощаться.
  const totalPacks = await countPacks(communityId);
  const remainingPacks = Math.max(0, totalPacks - dialog.packs_sent_count);
  const metaSuffix =
    `\n\n[Служебно: пачек отправлено ${dialog.packs_sent_count} из ${totalPacks}. ` +
    `Осталось: ${remainingPacks}.]`;
  const systemPrompt =
    activePrompt.system_prompt.replace(/\{\{community_name\}\}/g, community.name) + metaSuffix;
  const chatMessages = await buildContext(dialog.id, systemPrompt, {
    windowMessages: community.context_window_messages,
    tokenLimit: community.context_token_limit
  });

  // 8. Pick model — в MVP без A/B, берём dialog.bucket_model
  const model = dialog.bucket_model ?? community.active_model;

  // 9. Call OpenRouter
  const result = await chat({ model, messages: chatMessages });

  // 10a. Replace LINK_* плейсхолдеры. Ветка зависит от community.use_direct_links:
  // прямой URL (нет converted_at трекинга) vs /r/<id> redirect (фиксируем клик).
  const { text: textWithLinks, linkSentId } = await replacePlaceholders({
    text: result.content,
    communityId,
    dialogId: dialog.id,
    vkUserId,
    bypassRedirect: community.use_direct_links,
    ref: dialog.ref,
    refSource: dialog.ref_source
  });

  // 10b. Replace {{NEXT_PACK}} на готовую пачку офферов — если LLM её попросила.
  const { text: finalText, consumed: packConsumed } = await replaceNextPackPlaceholder({
    text: textWithLinks,
    communityId,
    packsSentCount: dialog.packs_sent_count,
    vkUserId,
    ref: dialog.ref,
    refSource: dialog.ref_source
  });

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
      // Если только что реально подставили пачку — продвигаем счётчик на 1.
      packs_sent_count: packConsumed
        ? sql`${dialogs.packs_sent_count} + 1`
        : dialogs.packs_sent_count,
      last_message_at: new Date()
    })
    .where(eq(dialogs.id, dialog.id));

  // 12. Send to VK — пропускаем пустой текст и не ретраим permanent-ошибки.
  if (!finalText.trim()) {
    logger.warn(
      { dialogId: dialog.id, model, eventId },
      'LLM returned empty text — assistant msg saved, ВК не зовём'
    );
  } else {
    try {
      await messagesSend(decryptedToken, {
        userId: vkUserId,
        message: finalText,
        dontParseLinks: false
      });
    } catch (err) {
      // VK error 100 = "message is empty or invalid" — это валидационная ошибка
      // (например финальный текст с маркером форматирования, которое ВК не принимает),
      // ретраить нет смысла: будет тот же результат и снова дубль в БД.
      if (err instanceof VkApiError && err.code === 100) {
        logger.error(
          { err, dialogId: dialog.id, message: finalText, eventId },
          'VK rejected message (error 100), завершаем job без retry'
        );
        return;
      }
      throw err;
    }
  }

  // 13. Schedule nudge — ошибки тут НЕ роняют весь job, иначе при retry
  // получим duplicate ответы в БД (см. ранее исправленный bug с error 100).
  if (community.nudge_delay_minutes > 0) {
    try {
      await nudgeQueue.add(
        'send-nudge',
        { dialogId: dialog.id, communityId },
        {
          delay: community.nudge_delay_minutes * 60 * 1000,
          jobId: `nudge-${dialog.id}`
        }
      );
    } catch (err) {
      logger.error({ err, dialogId: dialog.id }, 'Failed to schedule nudge — пропускаем, без retry');
    }
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
