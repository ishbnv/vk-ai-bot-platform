import { Worker } from 'bullmq';

import { redisConnection } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { QUEUE_NAMES } from '@/queues';
import { processDialogCompletionJob } from '@/services/dialog/completion';

export const createCompletionWorker = () => {
  const worker = new Worker(
    QUEUE_NAMES.completion,
    async () => {
      await processDialogCompletionJob();
    },
    { connection: redisConnection, concurrency: 1 }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'completion job failed');
  });

  return worker;
};
