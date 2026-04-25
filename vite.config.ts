import { defineConfig } from 'vite';
import { resolve } from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  root: 'src',
  publicDir: resolve(__dirname, 'public'),
  base: './',
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/index.html'),
        updateHistory: resolve(__dirname, 'src/update-history/index.html'),
      },
    },
  },
  server: {
    port: 8080,
  },
  optimizeDeps: {
    include: ['pixi.js', '@pixi/sound'],
  },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      filename: 'sw.js',
      strategies: 'generateSW',
      injectRegister: false,
      manifest: false,
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: false,
        clientsClaim: false,
        globPatterns: ['**/*.{js,css,html,png,jpg,svg,json,mp3,wav,webmanifest}'],
      },
    }),
  ],
});
