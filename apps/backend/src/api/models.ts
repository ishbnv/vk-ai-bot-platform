import type { FastifyInstance } from 'fastify';
import { inArray } from 'drizzle-orm';

import { db } from '@/db/client';
import { model_prices } from '@/db/schema';
import { SUPPORTED_MODELS } from 'shared-types';

export const modelsRoutes = async (app: FastifyInstance) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/', async () => {
    const rows = await db
      .select()
      .from(model_prices)
      .where(inArray(model_prices.model, [...SUPPORTED_MODELS]));
    // Возвращаем в порядке SUPPORTED_MODELS — фронт ожидает стабильную сортировку.
    const byModel = new Map(rows.map((r) => [r.model, r]));
    return SUPPORTED_MODELS.map((m) => byModel.get(m) ?? null).filter(Boolean);
  });
};
