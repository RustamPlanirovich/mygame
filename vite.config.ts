import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_TARGET = process.env.VITE_DEV_API_TARGET ?? 'http://127.0.0.1:5174';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    proxy: {
      '/api': {
        target: API_TARGET,
        // NOTE: the correct option is `changeOrigin` (http-proxy), not `changeOrigin`-alike
        // misspellings; a typo here silently disables Host rewriting.
        changeOrigin: true,
      },
    },
  },

  build: {
    // Source maps are worth the disk: without them a production stack trace from a player
    // is unreadable, and this app has no server-side error reporting to fall back on.
    sourcemap: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        /*
         * The app shipped as a single 1.9 MB (537 kB gzip) chunk, so every player downloaded
         * the WebGL renderer, the charting library and the animation library before the first
         * frame — and any change to any file invalidated the whole thing.
         *
         * Splitting the heavy, rarely-changing vendors into their own chunks means they stay
         * in the browser cache across deploys, which matters a lot more with 100 players
         * hitting a fresh build at the same time.
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          if (id.includes('pixi.js')) return 'vendor-pixi';
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor')) {
            return 'vendor-charts';
          }
          if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) {
            return 'vendor-motion';
          }
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('break_eternity') || id.includes('lz-string') || id.includes('seedrandom')) {
            return 'vendor-math';
          }
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) {
            return 'vendor-react';
          }
          return 'vendor';
        },
      },
    },
  },
});
