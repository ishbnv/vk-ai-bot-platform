import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// .env лежит в корне монорепо
loadEnv({ path: '../../.env' });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: databaseUrl },
  strict: true,
  verbose: true
});
