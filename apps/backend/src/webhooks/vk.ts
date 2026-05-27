import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { communities, vk_events_processed } from '@/db/schema';
import { logger } from '@/lib/logger';
import {
  dialogQueue,
  externalReplyQueue,
  type TDialogJob,
  type TExternalReplyJob
} from '@/queues';

import { vkWebhookSchema, vkMessageNewObjectSchema, vkMessageReplyObjectSchema } from './schemas';

export const vkWebhookRoutes = async (app: FastifyInstance) => {
  app.post('/vk', async (request, reply) => {
    // 1. Validate payload shape
    const parsed = vkWebhookSchema.safeParse(request.body);
    if (!parsed.success) {
      logger.warn({ issues: parsed.error.flatten() }, 'Invalid VK webhook payload');
      return reply.code(400).send('bad_payload');
    }
    const event = parsed.data;

    // 2. Find community by vk_group_id
    const [community] = await db
      .select()
      .from(communities)
      .where(eq(communities.vk_group_id, event.group_id))
      .limit(1);

    if (!community) {
      logger.warn({ group_id: event.group_id, type: event.type }, 'Webhook for unknown community');
      // 'ok' — чтобы ВК не ретраил на удалённые/чужие сообщества
      return reply.type('text/plain').send('ok');
    }

    // 3. Confirmation challenge — plain text confirmation code
    if (event.type === 'confirmation') {
      return reply.type('text/plain').send(community.vk_callback_confirmation_code);
    }

    // 4. Verify secret
    if (event.secret !== community.vk_callback_secret) {
      logger.warn({ group_id: event.group_id, type: event.type }, 'VK webhook secret mismatch');
      return reply.code(403).type('text/plain').send('forbidden');
    }

    // 5. Skip if no event_id — без него дедуп невозможен
    if (!event.event_id) {
      logger.warn({ type: event.type, group_id: event.group_id }, 'Event without event_id');
      return reply.type('text/plain').send('ok');
    }

    // 6. Dedupe — INSERT ... ON CONFLICT DO NOTHING + RETURNING показывает, было ли вставлено
    const inserted = await db
      .insert(vk_events_processed)
      .values({ event_id: event.event_id })
      .onConflictDoNothing()
      .returning({ id: vk_events_processed.event_id });

    if (inserted.length === 0) {
      logger.info({ event_id: event.event_id }, 'Duplicate event — already processed');
      return reply.type('text/plain').send('ok');
    }

    // 7. Маршрутизация по типу события.
    if (event.type === 'message_new') {
      const objectParsed = vkMessageNewObjectSchema.safeParse(event.object);
      if (!objectParsed.success) {
        logger.warn(
          { event_id: event.event_id, issues: objectParsed.error.flatten() },
          'message_new object malformed — skipping'
        );
        return reply.type('text/plain').send('ok');
      }

      // Если в сообществе работает BotHunter — откладываем обработку на grace,
      // даём BotHunter'у шанс ответить первым. Job сам проверит при пробуждении.
      const delayMs = community.bothunter_enabled
        ? community.bothunter_grace_minutes * 60 * 1000
        : 0;

      await dialogQueue.add(
        'process',
        {
          communityId: community.id,
          event: objectParsed.data,
          receivedAt: new Date().toISOString(),
          eventId: event.event_id
        } satisfies TDialogJob,
        delayMs > 0 ? { delay: delayMs } : undefined
      );
    } else if (event.type === 'message_reply') {
      // Исходящее сообщение от сообщества (наш бот / BotHunter / менеджер).
      // Воркер сам решит чьё именно по random_id в Redis.
      const replyParsed = vkMessageReplyObjectSchema.safeParse(event.object);
      if (replyParsed.success && replyParsed.data.peer_id !== undefined) {
        await externalReplyQueue.add('reply', {
          communityId: community.id,
          vkUserId: replyParsed.data.peer_id,
          randomId: replyParsed.data.random_id ?? null,
          ts: new Date().toISOString()
        } satisfies TExternalReplyJob);
      }
    } else {
      logger.debug({ type: event.type }, 'Unhandled VK event type');
    }

    return reply.type('text/plain').send('ok');
  });
};
