import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifySensible from '@fastify/sensible';

import { env } from '@/env';
import { logger } from '@/lib/logger';
import authPlugin from '@/plugins/auth';
import { healthRoutes } from '@/api/health';
import { authRoutes } from '@/api/auth';
import { redirectRoutes } from '@/api/redirect';
import { communitiesRoutes } from '@/api/communities';
import { promptsByCommunityRoutes, promptsTestRoutes } from '@/api/prompts';
import { landingLinksRoutes } from '@/api/landing-links';
import { dialogsByCommunityRoutes, dialogDetailRoutes } from '@/api/dialogs';
import { metricsRoutes } from '@/api/metrics';
import { modelsRoutes } from '@/api/models';
import { vkWebhookRoutes } from '@/webhooks/vk';
import { refreshModelPrices } from '@/services/openrouter';
import { bootstrapRepeatableJobs, closeQueues } from '@/queues';
import { createPricesRefreshWorker } from '@/workers/prices-refresh';
import { createDialogWorker } from '@/workers/dialog';
import { createNudgeWorker } from '@/workers/nudge';
import { createCompletionWorker } from '@/workers/completion';
import { createEventsCleanupWorker } from '@/workers/events-cleanup';
import { redisConnection } from '@/lib/redis';
import { pg } from '@/db/client';
import type { Worker } from 'bullmq';

const app = Fastify({
  loggerInstance: logger,
  trustProxy: true,
  bodyLimit: 1024 * 1024 // 1 MB — ВК-вебхуки заметно меньше
});

const registerPlugins = async () => {
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false // фронт подаётся отдельно, своя CSP на nginx
  });
  await app.register(fastifyCors, {
    origin: env.NODE_ENV === 'production' ? env.PUBLIC_URL : true,
    credentials: true
  });
  await app.register(fastifySensible);
  await app.register(authPlugin);
};

const registerRoutes = async () => {
  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(communitiesRoutes, { prefix: '/api/communities' });
  await app.register(promptsByCommunityRoutes, { prefix: '/api/communities' });
  await app.register(landingLinksRoutes, { prefix: '/api/communities' });
  await app.register(dialogsByCommunityRoutes, { prefix: '/api/communities' });
  await app.register(metricsRoutes, { prefix: '/api/communities' });
  await app.register(dialogDetailRoutes, { prefix: '/api/dialogs' });
  await app.register(promptsTestRoutes, { prefix: '/api/prompts' });
  await app.register(modelsRoutes, { prefix: '/api/models' });
  await app.register(vkWebhookRoutes, { prefix: '/webhooks' });
  await app.register(redirectRoutes, { prefix: '/r' });
};

const workers: Worker[] = [];

const start = async () => {
  try {
    await registerPlugins();
    await registerRoutes();
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Server started');

    workers.push(
      createPricesRefreshWorker(),
      createDialogWorker(),
      createNudgeWorker(),
      createCompletionWorker(),
      createEventsCleanupWorker()
    );
    await bootstrapRepeatableJobs();

    // Не await: прайс грузится в фоне, сервер уже принимает запросы.
    void refreshModelPrices();
  } catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
};

const shutdown = async (signal: NodeJS.Signals) => {
  logger.info({ signal }, 'Shutting down');
  try {
    await app.close();
    await Promise.all(workers.map((w) => w.close()));
    await closeQueues();
    await redisConnection.quit();
    await pg.end({ timeout: 5 });
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

void start();
