import { config as loadEnv } from 'dotenv';
import { fileURLToPath, URL } from 'node:url';
import { z } from 'zod';

// .env живёт в корне монорепо (vk-ai-bot-platform/.env), а не в apps/backend
loadEnv({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  PORT: z.coerce.number().int().positive().default(3000),
  PUBLIC_URL: z.string().url(),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),

  VK_API_VERSION: z.string().default('5.199'),

  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, 'ENCRYPTION_KEY must be 32-byte hex (64 chars)'),

  JWT_SECRET: z.string().min(32),
  ADMIN_LOGIN: z.string().min(1),
  ADMIN_PASSWORD_HASH: z.string().min(1)
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // Fail fast — без env'ов сервер бесполезен.
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type TEnv = z.infer<typeof envSchema>;
