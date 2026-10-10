import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The build goes straight into the desk.  File names stay fixed and
// lowercase (clay paths are knots); scripts/stamp.mjs adds ?v=<hash>
// to index.html so browsers pick up new builds.
export default defineConfig({
  plugins: [react()],
  base: '/apps/sovnas/',
  server: {
    proxy: {
      '/~': 'http://localhost:8081',
      '/apps/sovnas/api': 'http://localhost:8081',
      '/apps/sovnas/pub': 'http://localhost:8081',
      '/session.js': 'http://localhost:8081',
    },
  },
  build: {
    outDir: '../desk/web',
    emptyOutDir: true,
    assetsInlineLimit: 100000,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/index.js',
        chunkFileNames: 'assets/chunk-[name].js',
        assetFileNames: 'assets/[name][extname]',
        inlineDynamicImports: true,
      },
    },
  },
});
