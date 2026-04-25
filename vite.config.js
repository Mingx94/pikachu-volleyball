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
    include: [
      '@pixi/canvas-display',
      '@pixi/canvas-prepare',
      '@pixi/canvas-renderer',
      '@pixi/canvas-sprite',
      '@pixi/constants',
      '@pixi/core',
      '@pixi/display',
      '@pixi/loaders',
      '@pixi/prepare',
      '@pixi/settings',
      '@pixi/sound',
      '@pixi/sprite',
      '@pixi/sprite-animated',
      '@pixi/spritesheet',
      '@pixi/ticker',
    ],
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
        globPatterns: [
          '**/*.{js,css,html,png,jpg,svg,json,mp3,wav,webmanifest}',
        ],
      },
    }),
  ],
});
