import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@app': r('./src/app'),
      '@pages': r('./src/pages'),
      '@features': r('./src/features'),
      '@entities': r('./src/entities'),
      '@shared': r('./src/shared'),
      '@ui': r('./src/shared/ui'),
      '@store': r('./src/app/store'),
      'shared-types': r('../../packages/shared-types/src')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/r': { target: 'http://localhost:3000', changeOrigin: true }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
