import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import { API_PROXY_TARGET, DEV_PORTS } from '../../scripts/dev-ports.mjs';

export default defineConfig({
  envDir: fileURLToPath(new URL('../..', import.meta.url)),
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@douxing/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: DEV_PORTS.pc,
    strictPort: true,
    open: process.env.DOUXING_NO_OPEN !== '1' && process.env.DOUXING_VITE_NO_OPEN !== '1',
    proxy: {
      '/api': {
        target: API_PROXY_TARGET,
        changeOrigin: true,
      },
      '/uploads': {
        target: API_PROXY_TARGET,
        changeOrigin: true,
      },
    },
  },
});
