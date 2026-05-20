import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

import { env } from '@/env';
import * as schema from './schema';

// pooled connection — для запросов из API и воркеров
export const pg = postgres(env.DATABASE_URL, {
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10
});

export const db = drizzle(pg, { schema, casing: 'snake_case' });
export type TDb = typeof db;
