import type { FastifyInstance } from 'fastify';
import { and, desc, eq, max } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/db/client';
import { communities, prompts } from '@/db/schema';
import { chat } from '@/services/openrouter';
import { SUPPORTED_MODELS } from 'shared-types';

const communityParamSchema = z.object({ id: z.string().uuid() });
const promptParamSchema = z.object({ id: z.string().uuid(), vid: z.coerce.number().int().positive() });

const newPromptSchema = z.object({
  system_prompt: z.string().min(1).max(20_000)
});

const testSchema = z.object({
  system_prompt: z.string().min(1).max(20_000),
  model: z.string().min(1),
  user_messages: z.array(z.string().min(1)).min(1).max(4)
});

// CRUD по /api/communities/:id/prompts
export const promptsByCommunityRoutes = async (app: FastifyInstance) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/:id/prompts', async (request, reply) => {
    const params = communityParamSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Bad id' });
    const rows = await db
      .select()
      .from(prompts)
      .where(eq(prompts.community_id, params.data.id))
      .orderBy(desc(prompts.version));
    return rows;
  });

  app.get('/:id/prompts/active', async (request, reply) => {
    const params = communityParamSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Bad id' });
    const [row] = await db
      .select()
      .from(prompts)
      .where(and(eq(prompts.community_id, params.data.id), eq(prompts.is_active, true)))
      .orderBy(desc(prompts.version))
      .limit(1);
    if (!row) return reply.code(404).send({ error: 'No active prompt' });
    return row;
  });

  app.post('/:id/prompts', async (request, reply) => {
    const params = communityParamSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Bad id' });
    const body = newPromptSchema.safeParse(request.body);
    if (!body.success)
      return reply.code(400).send({ error: 'Invalid body', issues: body.error.flatten() });

    // Гарантируем что community существует
    const [community] = await db
      .select({ id: communities.id })
      .from(communities)
      .where(eq(communities.id, params.data.id))
      .limit(1);
    if (!community) return reply.code(404).send({ error: 'Community not found' });

    // Новая версия = max + 1, помечаем активной, остальные деактивируем — всё в транзакции
    const created = await db.transaction(async (tx) => {
      const [maxRow] = await tx
        .select({ max: max(prompts.version) })
        .from(prompts)
        .where(eq(prompts.community_id, params.data.id));
      const nextVersion = (maxRow?.max ?? 0) + 1;

      await tx
        .update(prompts)
        .set({ is_active: false })
        .where(eq(prompts.community_id, params.data.id));

      const inserted = await tx
        .insert(prompts)
        .values({
          community_id: params.data.id,
          version: nextVersion,
          system_prompt: body.data.system_prompt,
          is_active: true
        })
        .returning();
      return inserted[0];
    });

    return reply.code(201).send(created);
  });

  app.post('/:id/prompts/:vid/activate', async (request, reply) => {
    const params = promptParamSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Bad params' });

    const result = await db.transaction(async (tx) => {
      const [target] = await tx
        .select()
        .from(prompts)
        .where(and(eq(prompts.community_id, params.data.id), eq(prompts.version, params.data.vid)))
        .limit(1);
      if (!target) return null;

      await tx
        .update(prompts)
        .set({ is_active: false })
        .where(eq(prompts.community_id, params.data.id));
      const updated = await tx
        .update(prompts)
        .set({ is_active: true })
        .where(eq(prompts.id, target.id))
        .returning();
      return updated[0];
    });

    if (!result) return reply.code(404).send({ error: 'Prompt version not found' });
    return result;
  });
};

// Отдельный namespace /api/prompts/test — без community_id, dry-run для редактора промпта
export const promptsTestRoutes = async (app: FastifyInstance) => {
  app.addHook('preHandler', app.authenticate);

  app.post('/test', async (request, reply) => {
    const body = testSchema.safeParse(request.body);
    if (!body.success)
      return reply.code(400).send({ error: 'Invalid body', issues: body.error.flatten() });
    if (!SUPPORTED_MODELS.includes(body.data.model as (typeof SUPPORTED_MODELS)[number])) {
      return reply.code(400).send({ error: `Unsupported model: ${body.data.model}` });
    }

    // 4 independent calls — каждый user_message получает свой "первый ответ".
    // Параллелим: дешевле по wall-time, безопасно — независимые контексты.
    const responses = await Promise.all(
      body.data.user_messages.map(async (text) => {
        const r = await chat({
          model: body.data.model,
          messages: [
            { role: 'system', content: body.data.system_prompt },
            { role: 'user', content: text }
          ]
        });
        return {
          user: text,
          content: r.content,
          tokens_in: r.tokensIn,
          tokens_out: r.tokensOut,
          cost_usd: r.costUsd,
          latency_ms: r.latencyMs
        };
      })
    );

    return {
      responses,
      total_cost_usd: responses.reduce((s, r) => s + r.cost_usd, 0),
      total_tokens: {
        in: responses.reduce((s, r) => s + r.tokens_in, 0),
        out: responses.reduce((s, r) => s + r.tokens_out, 0)
      }
    };
  });
};
