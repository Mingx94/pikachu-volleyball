# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm install` — install deps.
- `npm start` — Vite dev server on port 8080 (configured in `vite.config.js`).
- `npm run build` — production bundle to `dist/` (Vite + `vite-plugin-pwa` GenerateSW).
- `npm run preview` — serve a built bundle locally after `npm run build`.
- No test runner is configured. `npm test` intentionally exits non-zero.

Lint/format are configured (ESLint + Prettier via `eslint-plugin-prettier`) but no npm script wires them up — run `npx eslint src` or `npx prettier --check src` directly.

Type checking: `jsconfig.json` sets `checkJs: true`, so JSDoc types in `src/**` are checked by the editor/TS language server. There is no CLI type-check script.

## Architecture

This is a JavaScript reimplementation of the 1997 Windows game "Pikachu Volleyball", obtained by reverse-engineering the original machine code (Ghidra, Cheat Engine, OllyDbg). Code comments reference original function addresses (e.g. `FUN_00403dd0`) — preserve these when editing.

MVC split, all under `src/resources/js/`:

- **Model — `physics.js`**: Deterministic physics engine for ball and both Pikachus, *plus* the computer-player AI that synthesizes keyboard input. Direct port of reverse-engineered machine code. Uses fixed integer-style math (`| 0`) and a seeded PRNG in `rand.js` — do not "modernize" to floats or `Math.random()` without understanding that this will desync behavior from the original game. Ground is 432×304; coordinates and constants at the top of the file are load-bearing.
- **Model — `cloud_and_wave.js`**: Also reverse-engineered; drives background cloud/wave motion, rendered by `view.js`.
- **View — `view.js`**: PixiJS rendering. `IntroView`, `MenuView`, `GameView`, `FadeInOut` are mounted as children of the root stage in `pikavolley.js`.
- **Controller — `pikavolley.js`**: `PikachuVolleyball` class owns physics, view, audio, and two `PikaKeyboard`s. Runs at `normalFPS = 25`; slow-motion replay drops to `slowMotionFPS = 5` for `SLOW_MOTION_FRAMES_NUM` frames. `gameLoop()` is the state-machine tick driven by the PIXI `Ticker`.
- **`main.js`**: Bootstraps pixi (sub-package imports, not unified `pixi.js`), registers plugins on `Renderer`/`CanvasRenderer`/`Loader`, loads sprite sheet + sounds, wires UI, then starts the ticker. `forceCanvas: true` is intentional — a user hit WebGL rendering bugs, so Canvas is the only supported path. Imports `./i18n/index.js` at the very top so the i18n module's Korean texture-path overrides land on `ASSETS_PATH.TEXTURES` *before* `loader.add(SPRITE_SHEET)` runs.
- **`keyboard.js`**, **`audio.js`**, **`ui.js`**, **`assets_path.js`**: Support modules. `utils/` has DOM-only helpers (dark mode, embedded-in-iframe detection, localStorage wrapper).
- **`i18n/`**: Runtime locale resolution + DOM translation. `i18n/index.js` resolves the locale (URL `?lang=` → localStorage `pv-locale` → `navigator.language` → `en`), applies the Korean texture overrides synchronously at module load (the same 7 overrides previously in `src/ko/ko.js`), then on DOM ready walks `[data-i18n]` / `[data-i18n-html]` / `[data-i18n-attr]` and wires `[data-locale]` buttons to `setLocale()` (which persists + reloads with `?lang=`). `i18n/translations.js` holds the `{en, ko, zh}` dictionary (~90 keys).

### PixiJS version

**This project uses PixiJS v6** via the split `@pixi/*` sub-packages (`@pixi/core`, `@pixi/display`, `@pixi/loaders`, `@pixi/sprite-animated`, `@pixi/sound`, etc.). The `.claude/skills/pixijs*` skills in this repo describe **PixiJS v8**, which has a different API (unified `pixi.js` import, async `app.init()`, Graphics shape-then-fill, `Assets` API, etc.). Do **not** apply those v8 patterns to this codebase — follow the existing v6 idioms (`Loader`, `Renderer.registerPlugin`, `new Container()`, etc.).

### Build layout

`vite.config.js` has `root: 'src'`, `publicDir: '../public'`, `base: './'` (relative URLs for sub-path portability), and two HTML inputs in `rollupOptions.input`: `src/index.html` (main page) and `src/update-history/index.html`. Each HTML loads exactly one entry script (`src/index.js`, `src/update-history/index.js`) which imports the per-page modules — splitting the modules across multiple `<script type="module">` tags causes Rollup to emit empty placeholder chunks and drop one of the script tags from the rendered HTML, so do not "fan out" the script tags again.

`public/` contains everything that must keep its filename at runtime: `manifest.json` and `resources/assets/**` (sprites, sounds, icons). PixiJS Loader fetches these via the relative paths in `assets_path.js` (`resources/assets/...`, no leading `..`). `src/resources/style.css` stays under `src/` and is hashed by Vite — that is fine because only HTML `<link>` tags reference it.

`vite-plugin-pwa` emits `sw.js` (`generateSW` strategy, `cleanupOutdatedCaches`, `skipWaiting: false`, `manifest: false` so `public/manifest.json` is the single source of truth). The `<script type="module">` block in `src/index.html` registers the service worker via the workbox-window CDN; the call is guarded by `import.meta.env.PROD` because dev mode does not serve `sw.js`.

### Locale handling

There is **one** HTML per page (no `en/`, `ko/`, `zh/` subdirectories). All translatable text in `src/index.html` and `src/update-history/index.html` is annotated with `data-i18n="key"` (textContent), `data-i18n-html="key"` (innerHTML, for translations containing inline `<a>`/`<span>`), or `data-i18n-attr="alt:key.alt,src:key.src"` (attributes). The translation tables in `src/resources/js/i18n/translations.js` are typed as plain object literals, so add a key to all three locales when introducing a new string. Missing keys fall back to English.

The Korean texture overrides (`messages/ko/*.png` instead of the default `messages/ja/*.png`) are applied inside `i18n/index.js` only when `currentLocale === 'ko'`. Adding more locale-specific texture variants means extending that block plus adding the assets to `public/resources/assets/images/messages/<locale>/` — but the spritesheet (`sprite_sheet.json`/`.png`) is a single atlas, so any new texture must already be packed inside it.

## Conventions

- Prettier: `singleQuote: true`. ESLint enforces `prefer-const`, `eqeqeq`, and prettier-as-error with `endOfLine: auto`.
- Files open with `'use strict';` and use ES module syntax.
- Types are expressed via JSDoc (`@type`, `@param`, `@typedef`), checked by `jsconfig.json`. Keep JSDoc accurate when editing — it's the only type safety net.
- When touching `physics.js` / `cloud_and_wave.js`, preserve the address-annotated comments and the bit-trick integer math; these are faithful ports, not idiomatic JS.
