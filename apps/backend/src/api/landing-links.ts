import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/db/client';
import { communities, landing_links } from '@/db/schema';

const createSchema = z.object({
  placeholder_key: z
    .string()
    .regex(/^LINK_[A-Z0-9_]+$/, 'must match LINK_[A-Z0-9_]+ pattern'),
  name: z.string().min(1),
  base_url: z.string().url(),
  utm_source: z.string().default(''),
  utm_medium: z.string().default(''),
  utm_campaign: z.string().default(''),
  is_active: z.boolean().default(true)
});
const patchSchema = createSchema.partial();

const communityParam = z.object({ id: z.string().uuid() });
const linkParam = z.object({ id: z.string().uuid(), lid: z.string().uuid() });

export const landingLinksRoutes = async (app: FastifyInstance) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/:id/links', async (request, reply) => {
    const params = communityParam.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Bad id' });
    return db
      .select()
      .from(landing_links)
      .where(eq(landing_links.community_id, params.data.id))
      .orderBy(landing_links.placeholder_key);
  });

  app.post('/:id/links', async (request, reply) => {
    const params = communityParam.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Bad id' });
    const body = createSchema.safeParse(request.body);
    if (!body.success)
      return reply.code(400).send({ error: 'Invalid body', issues: body.error.flatten() });

    const [community] = await db
      .select({ id: communities.id })
      .from(communities)
      .where(eq(communities.id, params.data.id))
      .limit(1);
    if (!community) return reply.code(404).send({ error: 'Community not found' });

    try {
      const inserted = await db
        .insert(landing_links)
        .values({ community_id: params.data.id, ...body.data })
        .returning();
      return reply.code(201).send(inserted[0]);
    } catch (err) {
      // Unique violation на (community_id, placeholder_key)
      return reply
        .code(409)
        .send({ error: 'placeholder_key already exists for this community' });
    }
  });

  app.patch('/:id/links/:lid', async (request, reply) => {
    const params = linkParam.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Bad params' });
    const body = patchSchema.safeParse(request.body);
    if (!body.success)
      return reply.code(400).send({ error: 'Invalid body', issues: body.error.flatten() });

    const updated = await db
      .update(landing_links)
      .set(body.data)
      .where(
        and(
          eq(landing_links.id, params.data.lid),
          eq(landing_links.community_id, params.data.id)
        )
      )
      .returning();
    if (updated.length === 0) return reply.code(404).send({ error: 'Not found' });
    return updated[0];
  });

  app.delete('/:id/links/:lid', async (request, reply) => {
    const params = linkParam.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Bad params' });
    const deleted = await db
      .delete(landing_links)
      .where(
        and(
          eq(landing_links.id, params.data.lid),
          eq(landing_links.community_id, params.data.id)
        )
      )
      .returning({ id: landing_links.id });
    if (deleted.length === 0) return reply.code(404).send({ error: 'Not found' });
    return reply.code(204).send();
  });
};
