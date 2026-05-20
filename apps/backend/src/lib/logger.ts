import pino from 'pino';
import { env } from '@/env';

const isDev = env.NODE_ENV === 'development';

export const logger = pino({
  level: env.LOG_LEVEL,
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss.l',
          ignore: 'pid,hostname'
        }
      }
    : undefined,
  redact: {
    paths: ['*.vk_access_token', '*.vk_access_token_encrypted', '*.password', '*.authorization'],
    censor: '[REDACTED]'
  }
});
