import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@sundayleague/shared-types': path.resolve(
        __dirname,
        '../../libs/shared-types/src/index.ts',
      ),
    },
  },
  build: {
    outDir: '../../dist/apps/frontend',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
  },
});
