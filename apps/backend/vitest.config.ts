import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': r('./src'),
      'shared-types': r('../../packages/shared-types/src')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
});
