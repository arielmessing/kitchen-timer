import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  base: '/kitchen-timer/',

  plugins: [
    legacy({
      targets: ['android >= 4'],
      renderModernChunks: false,
    }),
  ],

  build: {
    cssTarget: 'chrome27',
    minify: 'terser',
  },
});