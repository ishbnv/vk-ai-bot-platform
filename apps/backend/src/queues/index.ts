import { Queue, type JobsOptions } from 'bullmq';

import { redisConnection } from '@/lib/redis';
import { logger } from '@/lib/logger';

// --- shared options ---
const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: { count: 1000, age: 24 * 3600 },
  removeOnFail: { count: 5000, age: 7 * 24 * 3600 }
};

// --- queue names ---
export const QUEUE_NAMES = {
  dialog: 'dialog-processing',
  nudge: 'nudge-followup',
  metrics: 'metrics-aggregation',
  completion: 'dialog-completion',
  prices: 'prices-refresh',
  eventsCleanup: 'vk-events-cleanup'
} as const;

// --- queues ---
export const dialogQueue = new Queue(QUEUE_NAMES.dialog, {
  connection: redisConnection,
  defaultJobOptions
});

export const nudgeQueue = new Queue(QUEUE_NAMES.nudge, {
  connection: redisConnection,
  defaultJobOptions: { ...defaultJobOptions, attempts: 1 }
});

export const metricsQueue = new Queue(QUEUE_NAMES.metrics, {
  connection: redisConnection,
  defaultJobOptions
});

export const completionQueue = new Queue(QUEUE_NAMES.completion, {
  connection: redisConnection,
  defaultJobOptions
});

export const pricesQueue = new Queue(QUEUE_NAMES.prices, {
  connection: redisConnection,
  defaultJobOptions: { ...defaultJobOptions, attempts: 1 }
});

export const eventsCleanupQueue = new Queue(QUEUE_NAMES.eventsCleanup, {
  connection: redisConnection,
  defaultJobOptions: { ...defaultJobOptions, attempts: 1 }
});

// --- job payload types ---
export type TVkMessageNew = {
  message: {
    from_id: number;
    peer_id: number;
    date: number;
    text: string;
    attachments?: Array<{ type: string; [key: string]: unknown }>;
  };
};

export type TDialogJob = {
  communityId: string;
  event: TVkMessageNew;
  receivedAt: string;
  // event_id из ВК — для идемпотентности worker'а при retry'ях BullMQ
  eventId: string;
};

export type TNudgeJob = {
  dialogId: string;
  communityId: string;
};

export type TPricesJob = Record<string, never>;
export type TCompletionJob = Record<string, never>;
export type TEventsCleanupJob = Record<string, never>;

// --- repeatable cron registration ---
export const bootstrapRepeatableJobs = async () => {
  // prices: каждые 6 часов
  await pricesQueue.add(
    'refresh',
    {} as TPricesJob,
    {
      repeat: { every: 6 * 60 * 60 * 1000 },
      jobId: 'prices-refresh-recurring'
    }
  );

  // dialog-completion: каждый час
  await completionQueue.add(
    'sweep',
    {} as TCompletionJob,
    {
      repeat: { every: 60 * 60 * 1000 },
      jobId: 'completion-sweep-recurring'
    }
  );

  // events-cleanup: раз в сутки
  await eventsCleanupQueue.add(
    'cleanup',
    {} as TEventsCleanupJob,
    {
      repeat: { every: 24 * 60 * 60 * 1000 },
      jobId: 'events-cleanup-recurring'
    }
  );

  logger.info('Repeatable jobs registered');
};

// --- graceful shutdown ---
export const closeQueues = async () => {
  await Promise.all([
    dialogQueue.close(),
    nudgeQueue.close(),
    metricsQueue.close(),
    completionQueue.close(),
    pricesQueue.close(),
    eventsCleanupQueue.close()
  ]);
};
