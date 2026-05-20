import { Worker } from 'bullmq';

import { redisConnection } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { QUEUE_NAMES, type TDialogJob } from '@/queues';
import { processDialogJob } from '@/services/dialog/process';

export const createDialogWorker = () => {
  const worker = new Worker<TDialogJob>(
    QUEUE_NAMES.dialog,
    async (job) => {
      await processDialogJob(job.data);
    },
    {
      connection: redisConnection,
      concurrency: 5
    }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, attempts: job?.attemptsMade, err }, 'dialog job failed');
  });

  worker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'dialog job completed');
  });

  return worker;
};
