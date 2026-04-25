import { defineConfig } from 'oxlint';

export default defineConfig({
  plugins: ['typescript', 'unicorn', 'import'],
  categories: { correctness: 'error', suspicious: 'warn' },
  rules: {
    eqeqeq: 'error',
    'prefer-const': 'error',
    // Side-effect imports are intentional (i18n module-load overrides, Pixi v6
    // canvas plugins, the @pixi/canvas-display polyfill); allow them.
    'import/no-unassigned-import': 'off',
  },
  env: { browser: true, es2022: true },
  overrides: [
    {
      files: ['vite.config.ts'],
      env: { node: true },
    },
  ],
});
