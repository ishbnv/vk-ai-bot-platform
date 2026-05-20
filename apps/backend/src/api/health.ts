import type { FastifyInstance } from 'fastify';

import { env } from '@/env';

export const healthRoutes = async (app: FastifyInstance) => {
  app.get('/health', async () => ({
    status: 'ok',
    uptime: process.uptime(),
    env: env.NODE_ENV,
    timestamp: new Date().toISOString()
  }));
};
