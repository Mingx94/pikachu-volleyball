# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm install` — install deps (falls back to `node v16` / `npm v8` if errors).
- `npm start` — webpack-dev-server with inline source maps (`webpack.dev.js`).
- `npm run build` — production bundle to `dist/` (`webpack.prod.js`).
- `npx http-server dist` — serve a built bundle locally after `npm run build`.
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
- **`main.js`**: Bootstraps pixi (sub-package imports, not unified `pixi.js`), registers plugins on `Renderer`/`CanvasRenderer`/`Loader`, loads sprite sheet + sounds, wires UI, then starts the ticker. `forceCanvas: true` is intentional — a user hit WebGL rendering bugs, so Canvas is the only supported path.
- **`keyboard.js`**, **`audio.js`**, **`ui.js`**, **`assets_path.js`**: Support modules. `utils/` has DOM-only helpers (dark mode, embedded-in-iframe detection, localStorage wrapper).

### PixiJS version

**This project uses PixiJS v6** via the split `@pixi/*` sub-packages (`@pixi/core`, `@pixi/display`, `@pixi/loaders`, `@pixi/sprite-animated`, `@pixi/sound`, etc.). The `.claude/skills/pixijs*` skills in this repo describe **PixiJS v8**, which has a different API (unified `pixi.js` import, async `app.init()`, Graphics shape-then-fill, `Assets` API, etc.). Do **not** apply those v8 patterns to this codebase — follow the existing v6 idioms (`Loader`, `Renderer.registerPlugin`, `new Container()`, etc.).

### Build layout

`webpack.common.js` produces four entry bundles (`main`, `ko`, `dark_color_scheme`, `is_embedded_in_other_website`) with a shared `runtime` chunk so the Korean locale bundle can share code with the main bundle. Three locale HTML outputs (`en/`, `ko/`, `zh/`) are generated via `HtmlWebpackPlugin`, each picking a different subset of chunks. `WorkboxPlugin.GenerateSW` emits `sw.js` for PWA caching. Assets (sprites, sounds, manifests, style.css, root `index.html`) are copied through `CopyPlugin` — changes to their source paths must be mirrored in `webpack.common.js`.

## Conventions

- Prettier: `singleQuote: true`. ESLint enforces `prefer-const`, `eqeqeq`, and prettier-as-error with `endOfLine: auto`.
- Files open with `'use strict';` and use ES module syntax.
- Types are expressed via JSDoc (`@type`, `@param`, `@typedef`), checked by `jsconfig.json`. Keep JSDoc accurate when editing — it's the only type safety net.
- When touching `physics.js` / `cloud_and_wave.js`, preserve the address-annotated comments and the bit-trick integer math; these are faithful ports, not idiomatic JS.
