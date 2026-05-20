import type { FastifyInstance } from 'fastify';
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/db/client';
import { dialogs, messages } from '@/db/schema';

const communityParam = z.object({ id: z.string().uuid() });
const dialogParam = z.object({ id: z.string().uuid() });

const listQuery = z.object({
  status: z.enum(['active', 'converted', 'nudged', 'abandoned']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50)
});

// /api/communities/:id/dialogs?status=&from=&to=&page=&limit=
export const dialogsByCommunityRoutes = async (app: FastifyInstance) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/:id/dialogs', async (request, reply) => {
    const params = communityParam.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Bad id' });
    const query = listQuery.safeParse(request.query);
    if (!query.success)
      return reply.code(400).send({ error: 'Invalid query', issues: query.error.flatten() });

    const filters = [eq(dialogs.community_id, params.data.id)];
    if (query.data.status) filters.push(eq(dialogs.status, query.data.status));
    if (query.data.from) filters.push(gte(dialogs.created_at, query.data.from));
    if (query.data.to) filters.push(lte(dialogs.created_at, query.data.to));

    const where = and(...filters);
    const offset = (query.data.page - 1) * query.data.limit;

    const [rows, [{ count }]] = await Promise.all([
      db
        .select()
        .from(dialogs)
        .where(where)
        .orderBy(desc(dialogs.last_message_at))
        .limit(query.data.limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(dialogs).where(where)
    ]);

    return {
      data: rows,
      page: query.data.page,
      limit: query.data.limit,
      total: count
    };
  });
};

// /api/dialogs/:id → диалог + все сообщения
export const dialogDetailRoutes = async (app: FastifyInstance) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/:id', async (request, reply) => {
    const params = dialogParam.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Bad id' });

    const [dialog] = await db
      .select()
      .from(dialogs)
      .where(eq(dialogs.id, params.data.id))
      .limit(1);
    if (!dialog) return reply.code(404).send({ error: 'Not found' });

    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.dialog_id, dialog.id))
      .orderBy(asc(messages.created_at));

    return { dialog, messages: msgs };
  });
};
