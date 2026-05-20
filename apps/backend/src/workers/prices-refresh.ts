import { Worker } from 'bullmq';

import { redisConnection } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { refreshModelPrices } from '@/services/openrouter';
import { QUEUE_NAMES } from '@/queues';

export const createPricesRefreshWorker = () => {
  const worker = new Worker(
    QUEUE_NAMES.prices,
    async () => {
      await refreshModelPrices();
    },
    { connection: redisConnection, concurrency: 1 }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'prices-refresh job failed');
  });

  return worker;
};
