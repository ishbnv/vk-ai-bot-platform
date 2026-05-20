import IORedis, { type Redis } from 'ioredis';

import { env } from '@/env';

// maxRetriesPerRequest: null — обязательное требование BullMQ (он сам управляет ретраями).
export const redisConnection: Redis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});
