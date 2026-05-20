import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/db/client';

const communityParam = z.object({ id: z.string().uuid() });
const rangeQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional()
});

export const metricsRoutes = async (app: FastifyInstance) => {
  app.addHook('preHandler', app.authenticate);

  // GET /api/communities/:id/metrics/summary?from=&to=
  app.get('/:id/metrics/summary', async (request, reply) => {
    const params = communityParam.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Bad id' });
    const query = rangeQuery.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: 'Invalid range' });

    const fromIso = query.data.from?.toISOString() ?? null;
    const toIso = query.data.to?.toISOString() ?? null;

    const rows = await db.execute(sql`
      SELECT
        COUNT(*)::int                                                    AS dialogs_started,
        COUNT(*) FILTER (WHERE status = 'converted')::int                AS dialogs_converted,
        COUNT(*) FILTER (WHERE status = 'nudged')::int                   AS dialogs_nudged,
        COUNT(*) FILTER (WHERE status = 'abandoned')::int                AS dialogs_abandoned,
        COUNT(*) FILTER (WHERE status = 'active')::int                   AS dialogs_active,
        COALESCE(SUM(total_messages), 0)::int                            AS total_messages,
        COALESCE(SUM(total_tokens_input), 0)::bigint                     AS total_tokens_in,
        COALESCE(SUM(total_tokens_output), 0)::bigint                    AS total_tokens_out,
        COALESCE(SUM(total_cost_usd), 0)::numeric(14,6)                  AS total_cost_usd
      FROM dialogs
      WHERE community_id = ${params.data.id}
        AND (${fromIso}::timestamptz IS NULL OR created_at >= ${fromIso}::timestamptz)
        AND (${toIso}::timestamptz IS NULL OR created_at <= ${toIso}::timestamptz)
    `);
    const r = (rows as unknown as Array<Record<string, unknown>>)[0] ?? {};

    const dialogsStarted = Number(r.dialogs_started ?? 0);
    const dialogsConverted = Number(r.dialogs_converted ?? 0);

    return {
      dialogs_started: dialogsStarted,
      dialogs_converted: dialogsConverted,
      dialogs_nudged: Number(r.dialogs_nudged ?? 0),
      dialogs_abandoned: Number(r.dialogs_abandoned ?? 0),
      dialogs_active: Number(r.dialogs_active ?? 0),
      conversion_rate: dialogsStarted === 0 ? 0 : dialogsConverted / dialogsStarted,
      total_messages: Number(r.total_messages ?? 0),
      total_tokens_in: Number(r.total_tokens_in ?? 0),
      total_tokens_out: Number(r.total_tokens_out ?? 0),
      total_cost_usd: Number(r.total_cost_usd ?? 0),
      avg_messages_per_dialog:
        dialogsStarted === 0 ? 0 : Number(r.total_messages ?? 0) / dialogsStarted
    };
  });
};
