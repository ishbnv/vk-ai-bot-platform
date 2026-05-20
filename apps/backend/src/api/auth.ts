import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { env } from '@/env';

const loginBodySchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1)
});

export const authRoutes = async (app: FastifyInstance) => {
  app.post('/login', async (request, reply) => {
    const parsed = loginBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid body', issues: parsed.error.flatten() });
    }

    const { login, password } = parsed.data;
    const loginOk = login === env.ADMIN_LOGIN;
    const passwordOk = await bcrypt.compare(password, env.ADMIN_PASSWORD_HASH);

    // single generic ответ — не светим, что именно не совпало
    if (!loginOk || !passwordOk) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const token = await reply.jwtSign({ sub: 'admin' });
    return { token, login };
  });

  app.get('/me', { preHandler: [app.authenticate] }, async (request) => ({
    login: env.ADMIN_LOGIN,
    sub: request.user.sub
  }));
};
