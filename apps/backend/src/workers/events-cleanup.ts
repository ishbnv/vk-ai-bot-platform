import { Worker } from 'bullmq';

import { redisConnection } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { QUEUE_NAMES } from '@/queues';
import { processEventsCleanupJob } from '@/services/dialog/cleanup-events';

export const createEventsCleanupWorker = () => {
  const worker = new Worker(
    QUEUE_NAMES.eventsCleanup,
    async () => {
      await processEventsCleanupJob();
    },
    { connection: redisConnection, concurrency: 1 }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'events-cleanup job failed');
  });

  return worker;
};
