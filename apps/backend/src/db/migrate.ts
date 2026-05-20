import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

import { env } from '@/env';
import { logger } from '@/lib/logger';

// Отдельный коннекшен только для миграций (max: 1 — рекомендация drizzle)
const migrationClient = postgres(env.DATABASE_URL, { max: 1 });

const run = async () => {
  logger.info('Running migrations…');
  try {
    await migrate(drizzle(migrationClient), { migrationsFolder: './drizzle' });
    logger.info('Migrations applied');
  } catch (err) {
    logger.fatal({ err }, 'Migration failed');
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
};

void run();
