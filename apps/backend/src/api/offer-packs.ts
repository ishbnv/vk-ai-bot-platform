import type { FastifyInstance } from 'fastify';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/db/client';
import { offer_packs } from '@/db/schema';

const communityParamSchema = z.object({ id: z.string().uuid() });
const packParamSchema = z.object({ id: z.string().uuid(), pid: z.string().uuid() });

const createBodySchema = z.object({
  order_index: z.number().int().min(0).max(32_000),
  content: z.string().trim().min(1).max(8000)
});
const patchBodySchema = createBodySchema.partial();

export const offerPacksRoutes = async (app: FastifyInstance) => {
  app.addHook('preHandler', app.authenticate);

  // GET list — отсортировано по order_index
  app.get('/:id/offer-packs', async (request, reply) => {
    const params = communityParamSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Bad community id' });
    return db
      .select()
      .from(offer_packs)
      .where(eq(offer_packs.community_id, params.data.id))
      .orderBy(asc(offer_packs.order_index));
  });

  // POST create
  app.post('/:id/offer-packs', async (request, reply) => {
    const params = communityParamSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Bad community id' });
    const body = createBodySchema.safeParse(request.body);
    if (!body.success)
      return reply.code(400).send({ error: 'Invalid body', issues: body.error.flatten() });
    try {
      const [created] = await db
        .insert(offer_packs)
        .values({
          community_id: params.data.id,
          order_index: body.data.order_index,
          content: body.data.content
        })
        .returning();
      return reply.code(201).send(created);
    } catch (err) {
      // Unique-constraint на (community_id, order_index) — рассказываем явно.
      if (err instanceof Error && /offer_packs_community_order_uq/.test(err.message)) {
        return reply.code(409).send({ error: 'Order index already used in this community' });
      }
      throw err;
    }
  });

  // PATCH update
  app.patch('/:id/offer-packs/:pid', async (request, reply) => {
    const params = packParamSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Bad params' });
    const body = patchBodySchema.safeParse(request.body);
    if (!body.success)
      return reply.code(400).send({ error: 'Invalid body', issues: body.error.flatten() });
    try {
      const updated = await db
        .update(offer_packs)
        .set(body.data)
        .where(
          and(eq(offer_packs.id, params.data.pid), eq(offer_packs.community_id, params.data.id))
        )
        .returning();
      if (updated.length === 0) return reply.code(404).send({ error: 'Not found' });
      return updated[0];
    } catch (err) {
      if (err instanceof Error && /offer_packs_community_order_uq/.test(err.message)) {
        return reply.code(409).send({ error: 'Order index already used in this community' });
      }
      throw err;
    }
  });

  // DELETE
  app.delete('/:id/offer-packs/:pid', async (request, reply) => {
    const params = packParamSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Bad params' });
    const deleted = await db
      .delete(offer_packs)
      .where(
        and(eq(offer_packs.id, params.data.pid), eq(offer_packs.community_id, params.data.id))
      )
      .returning({ id: offer_packs.id });
    if (deleted.length === 0) return reply.code(404).send({ error: 'Not found' });
    return reply.code(204).send();
  });
};
