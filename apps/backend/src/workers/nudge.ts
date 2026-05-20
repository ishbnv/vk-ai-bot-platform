import { Worker } from 'bullmq';

import { redisConnection } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { QUEUE_NAMES, type TNudgeJob } from '@/queues';
import { processNudgeJob } from '@/services/dialog/nudge';

export const createNudgeWorker = () => {
  const worker = new Worker<TNudgeJob>(
    QUEUE_NAMES.nudge,
    async (job) => {
      await processNudgeJob(job.data);
    },
    { connection: redisConnection, concurrency: 3 }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'nudge job failed');
  });

  return worker;
};
