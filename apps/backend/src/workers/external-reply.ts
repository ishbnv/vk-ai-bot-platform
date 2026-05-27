import { Worker } from 'bullmq';
import { and, eq, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { dialogs } from '@/db/schema';
import { redisConnection } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { isOurRandomId } from '@/lib/our-replies';
import { QUEUE_NAMES, type TExternalReplyJob } from '@/queues';

// Воркер для message_reply от ВК: если random_id НЕ помечен как наш — значит
// сообщение от BotHunter (или менеджера) → пишем dialogs.last_external_reply_at,
// чтобы dialog worker мог решить не лезть в активный BotHunter-диалог.
export const createExternalReplyWorker = () => {
  const worker = new Worker<TExternalReplyJob>(
    QUEUE_NAMES.externalReply,
    async (job) => {
      const { communityId, vkUserId, randomId, ts } = job.data;

      // null random_id (необычно, но бывает) — считаем что не наш.
      if (randomId !== null && (await isOurRandomId(randomId))) {
        return; // эхо нашей же отправки, игнор
      }

      await db
        .update(dialogs)
        .set({ last_external_reply_at: sql`${new Date(ts).toISOString()}::timestamptz` })
        .where(and(eq(dialogs.community_id, communityId), eq(dialogs.vk_user_id, vkUserId)));
    },
    { connection: redisConnection, concurrency: 5 }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'external-reply job failed');
  });

  return worker;
};
