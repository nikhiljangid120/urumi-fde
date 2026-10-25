import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const gateway = process.env.GATEWAY_URL ?? 'http://127.0.0.1:8080';

export default defineConfig({
  plugins: [react()],
  // Keep this plain-CSS app independent of configs in parent folders.
  css: { postcss: { plugins: [] } },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: gateway,
        changeOrigin: true,
        headers: { Host: 'gateway.localhost' },
      },
      '/mcp': {
        target: gateway,
        changeOrigin: true,
        headers: { Host: 'gateway.localhost' },
      },
    },
  },
});
