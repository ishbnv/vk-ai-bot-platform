import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { communities, vk_events_processed } from '@/db/schema';
import { logger } from '@/lib/logger';
import { dialogQueue, type TDialogJob } from '@/queues';

import { vkWebhookSchema, vkMessageNewObjectSchema } from './schemas';

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

    // 7. Enqueue если это message_new — всё остальное логируем и игнорируем
    if (event.type === 'message_new') {
      const objectParsed = vkMessageNewObjectSchema.safeParse(event.object);
      if (!objectParsed.success) {
        logger.warn(
          { event_id: event.event_id, issues: objectParsed.error.flatten() },
          'message_new object malformed — skipping'
        );
        return reply.type('text/plain').send('ok');
      }

      await dialogQueue.add('process', {
        communityId: community.id,
        event: objectParsed.data,
        receivedAt: new Date().toISOString(),
        eventId: event.event_id
      } satisfies TDialogJob);
    } else {
      logger.debug({ type: event.type }, 'Unhandled VK event type');
    }

    return reply.type('text/plain').send('ok');
  });
};
