import { sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { vk_events_processed } from '@/db/schema';
import { logger } from '@/lib/logger';

// Чистим vk_events_processed старше 7 дней — он нужен только для near-time дедупликации.
export const processEventsCleanupJob = async (): Promise<void> => {
  const result = await db
    .delete(vk_events_processed)
    .where(sql`${vk_events_processed.processed_at} < NOW() - INTERVAL '7 days'`);
  const affected = (result as unknown as { count?: number }).count ?? 0;
  logger.info({ affected }, 'vk-events-cleanup: removed expired rows');
};
