import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/webhooks': 'http://localhost:4000',
      // TZ Store storefront (Next.js :3000) — same-origin proxy to avoid CORS.
      // Admin calls /tz-api/admin/products → localhost:3000/api/admin/products
      '/tz-api': { target: 'http://localhost:3000', changeOrigin: true, rewrite: (p) => p.replace(/^\/tz-api/, '/api') },
    },
  },
  preview: { port: 5173 },
});
