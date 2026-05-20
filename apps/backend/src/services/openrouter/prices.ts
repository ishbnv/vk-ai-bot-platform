import { sql } from 'drizzle-orm';
import { z } from 'zod';

import { SUPPORTED_MODELS } from 'shared-types';
import { db } from '@/db/client';
import { model_prices, type TModelPrice } from '@/db/schema';
import { logger } from '@/lib/logger';
import { env } from '@/env';

const openrouterModelsSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      pricing: z.object({
        prompt: z.string(),
        completion: z.string()
      })
    })
  )
});

// In-memory LRU кэш на 6 часов — getModelPrice вызывается из горячего пути dialog worker'а.
const TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { row: TModelPrice; expiresAt: number }>();

export const refreshModelPrices = async (): Promise<void> => {
  try {
    const res = await fetch(`${env.OPENROUTER_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` }
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, 'OpenRouter /models returned non-2xx');
      return;
    }

    const parsed = openrouterModelsSchema.safeParse(await res.json());
    if (!parsed.success) {
      logger.warn({ issues: parsed.error.flatten() }, 'OpenRouter /models payload mismatch');
      return;
    }

    const wanted = new Set<string>(SUPPORTED_MODELS);
    const rows = parsed.data.data
      .filter((m) => wanted.has(m.id))
      .map((m) => ({
        model: m.id,
        prompt_price_per_1m: (parseFloat(m.pricing.prompt) * 1_000_000).toFixed(4),
        completion_price_per_1m: (parseFloat(m.pricing.completion) * 1_000_000).toFixed(4),
        updated_at: new Date()
      }));

    if (rows.length === 0) {
      logger.warn('No SUPPORTED_MODELS matched OpenRouter catalogue');
      return;
    }

    await db
      .insert(model_prices)
      .values(rows)
      .onConflictDoUpdate({
        target: model_prices.model,
        set: {
          prompt_price_per_1m: sql`excluded.prompt_price_per_1m`,
          completion_price_per_1m: sql`excluded.completion_price_per_1m`,
          updated_at: sql`excluded.updated_at`
        }
      });

    cache.clear();
    logger.info({ count: rows.length }, 'Model prices refreshed');
  } catch (err) {
    // Не валим сервер — прайс отрефрешим cron'ом / при следующем рестарте.
    logger.warn({ err }, 'Failed to refresh model prices');
  }
};

export const getModelPrice = async (model: string): Promise<TModelPrice> => {
  const now = Date.now();
  const hit = cache.get(model);
  if (hit && hit.expiresAt > now) return hit.row;

  const [row] = await db
    .select()
    .from(model_prices)
    .where(sql`${model_prices.model} = ${model}`)
    .limit(1);

  if (!row) {
    throw new Error(`No price row for model "${model}" — refreshModelPrices must run first`);
  }

  cache.set(model, { row, expiresAt: now + TTL_MS });
  return row;
};

// Только для тестов и админских ручек reset
export const __resetPriceCache = () => cache.clear();
