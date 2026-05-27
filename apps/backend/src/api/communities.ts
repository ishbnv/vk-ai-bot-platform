import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/db/client';
import { communities } from '@/db/schema';
import { connectCommunity } from '@/services/community/connect';
import { logger } from '@/lib/logger';

// Поля сообщества, которые отдаём наружу (без токена/секрета!)
const publicFields = {
  id: communities.id,
  vk_group_id: communities.vk_group_id,
  name: communities.name,
  is_active: communities.is_active,
  work_hours_start: communities.work_hours_start,
  work_hours_end: communities.work_hours_end,
  nudge_delay_minutes: communities.nudge_delay_minutes,
  completion_silence_hours: communities.completion_silence_hours,
  active_model: communities.active_model,
  ab_test_enabled: communities.ab_test_enabled,
  ab_test_split: communities.ab_test_split,
  context_window_messages: communities.context_window_messages,
  context_token_limit: communities.context_token_limit,
  forbidden_topics: communities.forbidden_topics,
  vk_photos_enabled: communities.vk_photos_enabled,
  vk_voice_enabled: communities.vk_voice_enabled,
  use_direct_links: communities.use_direct_links,
  bothunter_enabled: communities.bothunter_enabled,
  bothunter_grace_minutes: communities.bothunter_grace_minutes,
  created_at: communities.created_at,
  updated_at: communities.updated_at
};

const createSchema = z.object({
  vk_group_id: z.number().int().positive(),
  vk_access_token: z.string().min(1),
  name: z.string().min(1).optional()
});

const patchSchema = z
  .object({
    name: z.string().min(1),
    is_active: z.boolean(),
    work_hours_start: z.number().int().min(0).max(24),
    work_hours_end: z.number().int().min(0).max(24),
    nudge_delay_minutes: z.number().int().min(0).max(4320),
    completion_silence_hours: z.number().int().min(1).max(720),
    active_model: z.string().min(1),
    ab_test_enabled: z.boolean(),
    ab_test_split: z.array(z.object({ model: z.string(), weight: z.number().int().min(0) })),
    context_window_messages: z.number().int().min(1).max(50),
    context_token_limit: z.number().int().min(500).max(32_000),
    forbidden_topics: z.array(z.string()),
    vk_photos_enabled: z.boolean(),
    vk_voice_enabled: z.boolean(),
    use_direct_links: z.boolean(),
    bothunter_enabled: z.boolean(),
    bothunter_grace_minutes: z.number().int().min(1).max(60)
  })
  .partial();

const paramsSchema = z.object({ id: z.string().uuid() });

export const communitiesRoutes = async (app: FastifyInstance) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/', async () =>
    db.select(publicFields).from(communities).orderBy(communities.created_at)
  );

  app.post('/', async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({ error: 'Invalid body', issues: parsed.error.flatten() });
    try {
      const created = await connectCommunity({
        vkGroupId: parsed.data.vk_group_id,
        vkAccessToken: parsed.data.vk_access_token,
        name: parsed.data.name
      });
      // Возвращаем публичные поля
      const [row] = await db.select(publicFields).from(communities).where(eq(communities.id, created.id));
      return reply.code(201).send(row);
    } catch (err) {
      logger.warn({ err }, 'connectCommunity failed');
      const message = err instanceof Error ? err.message : 'connect failed';
      return reply.code(400).send({ error: message });
    }
  });

  app.get('/:id', async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Bad id' });
    const [row] = await db.select(publicFields).from(communities).where(eq(communities.id, params.data.id)).limit(1);
    if (!row) return reply.code(404).send({ error: 'Not found' });
    return row;
  });

  app.patch('/:id', async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Bad id' });
    const body = patchSchema.safeParse(request.body);
    if (!body.success)
      return reply.code(400).send({ error: 'Invalid body', issues: body.error.flatten() });

    const updated = await db
      .update(communities)
      .set({ ...body.data, updated_at: new Date() })
      .where(eq(communities.id, params.data.id))
      .returning(publicFields);
    if (updated.length === 0) return reply.code(404).send({ error: 'Not found' });
    return updated[0];
  });

  app.delete('/:id', async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Bad id' });
    const deleted = await db
      .delete(communities)
      .where(eq(communities.id, params.data.id))
      .returning({ id: communities.id });
    if (deleted.length === 0) return reply.code(404).send({ error: 'Not found' });
    return reply.code(204).send();
  });
};
