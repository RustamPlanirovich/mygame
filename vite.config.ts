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
    /*
     * Source maps are worth the disk: without them a production stack trace from a player
     * is unreadable, and this app has no server-side error reporting to fall back on.
     *
     * But 'hidden' rather than true (bigplan.md, пункт 34): карты по-прежнему собираются и их
     * можно применить локально, разбирая присланный игроком стектрейс, а вот ссылки
     * `//# sourceMappingURL=` в бандлах больше нет. Раньше она была, и любой браузер с открытыми
     * инструментами тянул 4.3 МБ карты к главному чанку — вместе с полными исходниками проекта.
     */
    sourcemap: 'hidden',
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
          /*
           * `@rollup/plugin-commonjs` emits its interop helpers as a virtual module that lives
           * outside node_modules, so rollup was free to place it in `vendor`. React ships as
           * CommonJS and needs those helpers, so vendor-react imported them back out of
           * `vendor` while `vendor` imported React — the same circular-chunk trap. Pin them to
           * vendor-react, the chunk every other vendor chunk already depends on, so the chunk
           * graph stays a DAG.
           */
          if (id.includes('commonjsHelpers')) return 'vendor-react';

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
          /*
           * Match the package directory, not any path segment. A loose `/react/` test also
           * matched `zustand/esm/react/shallow.mjs`, which pulled that file into vendor-react;
           * it imports use-sync-external-store, which stayed in `vendor`, so the two chunks
           * imported each other. In a circular chunk import `vendor` runs before vendor-react
           * is initialised, and use-sync-external-store reads `React.useState` at module scope
           * — hanging the game on the loading screen with `undefined is not an object`.
           *
           * use-sync-external-store belongs here for the same reason: it destructures React
           * eagerly, so it must never be split away from React.
           */
          if (/node_modules\/(react|react-dom|scheduler|use-sync-external-store)\//.test(id)) {
            return 'vendor-react';
          }
          return 'vendor';
        },
      },
    },
  },
});
