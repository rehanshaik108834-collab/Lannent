import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: the API runs on :3000 and is proxied, so the app talks to /api on its
// own origin exactly as it does when the backend serves the production build.
const target = process.env.API_PROXY_TARGET || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,
    proxy: { '/api': { target, changeOrigin: false } },
  },
  preview: { port: 5180, strictPort: true, proxy: { '/api': { target } } },
});
