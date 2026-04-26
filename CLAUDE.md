# CLAUDE.md

本檔案提供 Claude Code（claude.ai/code）在這個 repository 工作時所需的指引。

## 指令

- `npm install` — 安裝相依套件。
- `npm start` — 啟動 Vite 8 開發伺服器（預設 port 8080，被佔用會依序退到 8081、8082…）。
- `npm run build` — 把 production bundle 輸出到 `dist/`（Vite + `vite-plugin-pwa` GenerateSW）。
- `npm run preview` — `npm run build` 之後本機端預覽打包結果。
- `npm run typecheck` — 對 `tsconfig.json`（app）與 `tsconfig.node.json`（Vite config）兩份各跑一次 `tsc --noEmit`。Vite/esbuild 在 build 時**不會**做型別檢查，這個指令是唯一的安全網 — commit 前請執行。
- `npm test` / `npm run test:watch` — Vitest（搭 `vitest.config.ts`，node environment）。測試檔以 `*.test.ts` 命名，跟 source 同層放。針對 `physics.ts` 的確定性引擎做 golden snapshot — 透過 `setCustomRng()` 餵 seedable PRNG（mulberry32），驗證載重 quirk（Hyper Ball Glitch、左右牆不對稱、ball-player collision velocity）。修改 `physics.ts` 後請務必跑這個。
- `npm run lint` — `oxlint`（Rust 製，取代 ESLint）。
- `npm run format` / `npm run format:check` — `oxfmt`（Rust 製，取代 Prettier）。涵蓋 `src/`、`vite.config.ts`、`vitest.config.ts`。

## 架構

這是 1997 年 Windows 遊戲「Pikachu Volleyball」（皮卡丘排球）的 **TypeScript ^6.0** 重新實作，由原作機器碼透過 Ghidra、Cheat Engine、OllyDbg 逆向工程而來。程式碼註解中參考的原始函式位址（例如 `FUN_00403dd0`）— 修改時請保留這些註解。

MVC 拆分，全部位於 `src/resources/js/`：

- **Model — `physics.ts`**：球與皮卡丘們的確定性物理引擎。直接從逆向工程出來的機器碼移植。使用整數風格的位元運算（`| 0`）以及 `rand.ts` 裡的 seeded PRNG — 在沒有充分理解的情況下，**不要**「現代化」成浮點數或 `Math.random()`，否則會與原作行為失同步。1v1 場地是原作的 432×304；2v2 把寬度加寬到 576×304（4/3 倍寬，高度不變）— 寬度從原本的 module-level `GROUND_WIDTH` 常數轉為 per-instance `PikaPhysics.groundWidth`，並在建構時鏡射到每個 `Player.groundWidth` / `Ball.groundWidth`，讓 engine 內部的 free function 直接從接到的物件讀。1v1 走預設 432，行為與原作完全一致。每次 `runEngineForNextFrame()` 回傳一個 `PhysicsTickResult`（`{ isBallTouchingGround, sounds }`），其中 `sounds: SoundEvent[]` 取代了過去散在 `Player`/`Ball` 上的 mutable `sound.*` flag — engine 不再持有播放狀態，controller (`pikavolley.ts`) 拿到 array 後在 audio 層展開。引擎已從原作的 1v1 寫死，泛化成 N 玩家：`PikaPhysics.players: Player[]` 長度可以是 2（1v1）或 4（2v2），`physicsEngine` 的兩個 player loop 都跑 `players.length`。2v2 起始位置採前後排站位 — `Player.spawnXOffset` 由 `PikaPhysics` constructor 注入：P1 / P2 是前排（`groundHalfWidth - 64`，靠網），P3 / P4 是後排（沿用 1v1 baseline 的 36，靠底線），開場四隻不再重疊。`processPlayerToPlayerCollisions(players)` 在每 tick 的「玩家移動」與「球-玩家碰撞」之間插入一輪，對同隊配對做 AABB 解析（垂直重疊大就疊頭頂、水平重疊大就互推 + clamp 到自己半場）。`Player.hasPlayerOnHead` / `standingOnTeammate` 兩個 flag 由這輪設置，jump 守衛變成「頭上沒人 + (在地或在隊友頭頂)」 — 1v1 時這兩個 flag 永遠 false，行為與原作完全一致。
- **Model — `ai.ts`**：合成 keyboard 輸入的電腦 AI（過去是 `physics.ts` 的一部分，邏輯上是 controller-layer 的決策，所以分出來）。`letComputerDecideUserInput()` 在 `physicsEngine` 的 per-player loop 中、`processPlayerMovementAndSetPlayerPosition` 開頭被呼叫，相對 `calculateExpectedLandingPointXFor` 的時序與原作完全一致。同樣使用 `rand.ts` 的 seeded PRNG。AI 函式本體不分 1v1 / 2v2 — caller（`physics.ts:findNearestOpponent`）餵進來的 `theOtherPlayer` 永遠是「對隊中最靠近球的那個」，1v1 退化為原本的固定對手，2v2 則讓每位 AI 自然針對最可能擊球的對手做 power-hit 規避。
- **Model — `cloud_and_wave.ts`**：同樣是逆向工程出來的，驅動背景的雲與波浪動畫，由 `view.ts` 渲染。**RNG 隔離**：原作機器碼是 physics 與 cloud/wave 共用同一條 `rand()`，本實作刻意改用獨立的 `Math.random()`-based source，避免 `rand.setCustomRng()` 餵的 seeded sequence 被每 frame 的雲 / 波浪更新打亂。`startReplay` 跳過 `startOfNewGame` 的 fade-in（裡面跑了上千次 cloud/wave rand），如果不隔離，replay playback 會從 round-frame 0 就跟 recording 失同步。
- **View — `view.ts`**：PixiJS 渲染。`IntroView`、`MenuView`、`GameView`、`FadeInOut` 在 `pikavolley.ts` 裡被掛到 root stage 之下。`GameView` 構造子接 `playerCount: 2 | 4 = 2` 與 `groundWidth: number = 432`，`playerSprites: AnimatedSprite[]` 與 `shadows.forPlayers: Sprite[]` 兩個陣列依 playerCount 建立；背景 tile / 雲 / 浪 / scoreboard / 網柱位置 / fade overlay 全部依 groundWidth 鋪 — 1v1 走 432，2v2 走 576（4/3 倍寬）。山的 sprite 是單張 432-wide texture，2v2 時拉伸到 groundWidth 填滿（不另外 tile）。中央訊息（`gameStart` / `gameEnd` / `ready`）用 `groundWidth >> 1` 算中心，2v2 不會偏左。`drawPlayersAndBall(physics)` 直接遍歷 `physics.players`。2v2 時 P3 / P4 套上 `tint`（黃綠 / 粉橙）做視覺區分，1v1 完全沿用原色。`MenuView` 改寫成兩段式選單：上方一組 1v1 / 2v2 的 Pixi `Text` 模式選擇（用 i18n key `options.mode_1v1` / `options.mode_2v2`），下方是 4 個 slot 的 HUMAN/CPU 顯示 + 一個 START 列。沒有新增任何 spritesheet 條目；所有新文字都是 Pixi Text。舊的「跟電腦 / 跟朋友」spritesheet 條目仍載入但永遠 `visible = false`。`IntroView` / `MenuView` 的座標都依 1v1 的 432 寬鋪設 — `pikavolley.ts` 在進 intro / menu 時會把 canvas 縮回 432，等到正式進入 round 才依 mode 切到 576；這樣選單畫面不會有左右不對稱的黑邊。內部用了 `getSheetTextures` / `getTexture` 兩個小 helper 在邊界處 throw，避免在整個檔案散布 `!` 非空斷言。
- **Controller — `pikavolley.ts`**：`PikachuVolleyball` class 擁有 physics、view、audio 與一組 `PikaKeyboard`。`mode: '1v1' | '2v2'` 從 `localStorage('pv-offline-mode')` 載入（預設 1v1），決定 `keyboardArray`（`[PikaKeyboard, PikaKeyboard, ...PikaKeyboard[]]`，2 或 4 把）與 physics 的玩家數。2v2 時 P3 / P4 用 J/L/I/K/U 與 Numpad 4/6/8/2/0 預設綁定。模式切換與 human/CPU 分配的唯一入口是**遊戲內選單**（`menu()` state）— 操作：←→ 切 1v1 / 2v2、↑↓ 在 P1..P4 / START 之間移游標、power-hit (任何一位的 hit 鍵都吃) 在 slot 上 toggle HUMAN/CPU、在 START 上呼叫 `launchFromMenu()` 開始；游標預設停在 START，所以一上來按 power-hit 就立刻以預設組合 (P1 = HUMAN, 其餘 = CPU) 開打。↑↓ ←→ 都做 edge-detect（追蹤 `menuPrevYDir` / `menuPrevXDir`，只在 0 → ±1 transition 時觸發），按住不會 auto-scroll。`slotIsHuman: boolean[]`（長度 4）跨選單 visit 持續，1v1 時 P3 / P4 的設定不會被清掉；切回 2v2 仍記得。`launchFromMenu()` 把 `slotIsHuman` 套到 `physics.players[i].isComputer`，並在 mode 改變時呼叫內部 helper `rebuildForMode()`（unsubscribe 舊鍵盤、重建 physics + GameView + canvas resize，但**不**重啟狀態機，所以可以無縫接到 `afterMenuSelection` → `round`）。`setMode()` 公用方法仍保留，呼叫 `rebuildForMode` 後加 `restart()`，是給未來若有外部呼叫者用。HTML 的 Options → Mode 子選單已移除。`setRendererResizer(fn)` 由 `main.ts` 注入，rebuildForMode 會呼叫它把 pixi canvas + CSS `--aspect-ratio` 同步到新寬度（432 ↔ 576）。`scores: [number, number]` 仍是兩隊的計分（球落左半 → 右隊得分），勝利時 `for (const p of physics.players)` 把整隊的 `isWinner` / `gameEnded` 設好。以 `normalFPS = 25` 執行；回合結束後的慢動作會降到 `slowMotionFPS = 5` 持續 `SLOW_MOTION_FRAMES_NUM` 個 frame。`gameLoop()` 是由 PIXI `Ticker` 驅動的狀態機 tick。`state: GameState` 是個 function reference（`= () => void`），會在 method 之間互相重新指派（`intro` / `menu` / `round` 等）— 透過 property 呼叫 `this.state()` 時 `this` 會正確 rebind。`startRecording(seed)` / `stopRecording()` 是 opt-in 的 replay 錄製鉤子（`round()` 會在每個 physics tick 之前 push input snapshot），合約：必須在進入 `round` 前呼叫，否則 RNG 已經被消耗，replay 會對不上。對稱的 `startReplay(replay)` 會 setCustomRng + 依 `replay.playerCount` / `replay.groundWidth` 重建 `PikaPhysics` + 重建 GameView + resize canvas + 把 state 直接設成 `round`，刻意跳過 `startOfNewGame` 的視覺 intro 來避免 `initializeForNewRound` 二次消耗 seed rng。多回合可 bit-perfect 重現：recording 時 `beforeStartOfNextRound` 會落 `pendingReInitMarker`，下次 `round()` push 時 flush 進 `recordingReInits` 帶進 `Replay.roundReInits`；playback 時 controller 自然會走 `beforeStartOfNextRound` 消耗那 2 個 rand，不需要額外手動補。`isRecording` / `isReplaying` getter 給 UI 用。
- **`main.ts`**：bootstrap pixi（合併的 `pixi.js` import + 從 `@pixi/sound` 拿 `Sound` 型別並 side-effect import 註冊 sound 的 Assets parser），`new Application()` 之後 `await app.init({ preference: 'webgl', width: 432, height: 304, ... })`，用 `Assets.load([SPRITE_SHEET, ...SOUNDS], onProgress)` 一次載完 spritesheet 與聲音，接好 UI。`pikaVolley.setRendererResizer(...)` 在這裡被注入：callback 同時 `app.renderer.resize(w, h)` 與在 `:root` 上設 `--aspect-ratio` / `--inverse-aspect-ratio`，讓 CSS 的 canvas 比例隨 mode 動態切換。Sim 與 render 解耦：`app.ticker` 跑在原生 refresh rate 自動 render；`pikaVolley.gameLoop()` 用 fixed-step accumulator 在 ticker callback 內每湊到 `1000/normalFPS = 40ms` 就 tick 一次（max 4 step / callback 防 spiral-of-death，paused 時清零 accumulator）— 這樣 60/144/166 Hz 螢幕都跑同樣的 25 Hz simulation。在最頂端 import `./i18n/index.js`，這樣 i18n 模組對韓文 texture 路徑的覆寫會在 `Assets.load(SPRITE_SHEET)` 之前先寫入 `ASSETS_PATH.TEXTURES`（spritesheet frame key 在 sprite 建立時才會被 view.ts 查找）。
- **`replay.ts`**：把確定性引擎的「seed + 每 frame input array」打包成可序列化的 `Replay` 物件，並提供 `runReplay()` 從頭重跑、`serializeReplay` / `deserializeReplay` 做 JSON round-trip。內含 `mulberry32` 種子 PRNG（測試與 replay 共用）。`Replay.frames` 元素是 `ReplayInputFrame = readonly [Si, Si] | readonly [Si, Si, Si, Si]`（union of tuple），對應 1v1 與 2v2；optional `playerCount?: 2 | 4` 與 `isPlayer3Computer? / isPlayer4Computer?` 在 2v2 時帶上，缺值預設 `playerCount = 2`，所以 2v2 之前錄的舊 1v1 replay JSON 仍可載入並 bit-perfect 重播。`groundWidth?: number` 也是 optional，缺值時 `runReplay` 預設 432，讓加寬場地之前錄的舊 2v2 replay 也仍可 bit-perfect 重跑（它們本來就是 432 寬）；新錄的 2v2 replay 會帶上 `groundWidth: 576`。多回合對局透過 optional `roundReInits: { atFrame, isPlayer2Serve }[]` 標記每個 inter-round 的 `Player.initializeForNewRound()` 點，`runReplay` 會在指定 frame 之前先對 `physics.players` 全體補上 reInit rand 消耗，避免從第 2 回合開始發散。只覆蓋 physics 層的 tick — controller 層的計分 / 慢動作 / 狀態機不在這個 module 的 scope 內。
- **`keyboard.ts`**、**`audio.ts`**、**`ui.ts`**、**`assets_path.ts`**：支援模組。`utils/` 裡放純 DOM 的 helper（dark mode、是否被嵌入別的網站、localStorage wrapper）。
- **`i18n/`**：執行時的 locale 解析 + DOM 翻譯。`i18n/index.ts` 解析 locale（URL `?lang=` → localStorage `pv-locale` → `navigator.language` → `en`），在 module load 時同步套用韓文 texture 覆寫，DOM ready 之後巡訪 `[data-i18n]` / `[data-i18n-html]` / `[data-i18n-attr]`，並把 `[data-locale]` 按鈕接到 `setLocale()`（會持久化並用 `?lang=` 重新載入）。`i18n/translations.ts` 持有 `Record<Locale, Record<string, string>>` 的字典（約 80 個 key）。

### 引擎文件

逆向工程而來的 model layer 詳細分析放在 [`docs/engine/`](./docs/engine/)，涵蓋世界與球的物理、玩家狀態機（含 2v2 隊友碰撞 / 踩頭擋跳）、玩家-球碰撞、電腦 AI，以及背景的雲與波浪引擎。**對 `physics.ts` 或 `cloud_and_wave.ts` 做任何非 trivial 的修改之前先讀那組文件**；它們記錄了 load-bearing 的 quirks（Hyper Ball Glitch、AI 對網柱反彈的故意盲點、為了避開無窮迴圈而留下的不對稱邊界等），以及本實作對原作的擴充（N 玩家泛化、隊友 AABB 解析等）。

### PixiJS 版本

**這個專案用的是 PixiJS v8**（`pixi.js@^8`，合併套件，不再是 v6 那批拆開的 `@pixi/*` sub-package）+ `@pixi/sound@^6`（對應 v8 的 sound 套件）。本 repo 裡 `.claude/skills/pixijs*` 描述的就是 v8，可以直接當參考。要點：

- bootstrap 是 `new Application()` + `await app.init(...)` 兩段式，`main.ts` 用 top-level await。
- 資源用 `Assets.load(urls, onProgress)`，一次拿到 spritesheet 與 sounds（`@pixi/sound` 的 side-effect import 會自動把 sound parser 註冊到 Assets）。沒有 `Loader` 也沒有 `*.registerPlugin`。
- 全域預設 scale mode 改在 `TextureStyle.defaultOptions.scaleMode = 'nearest'` 設定，必須在 `Assets.load` 之前（spritesheet texture 從 default 繼承）。`resolution` / `roundPixels` 都改傳到 `app.init` 的 options。
- Renderer 強制走 WebGL（`preference: 'webgl'`）。v8 已移除 Canvas-only renderer，所以沒有 `forceCanvas` 可用；如果之後再有玩家回報 WebGL 渲染問題，請評估特定 driver workaround、或加 `preference: ['webgl', 'webgpu']` fallback，而不是嘗試走 canvas。
- `app.ticker` 由 `Application` 內建的 TickerPlugin 每 tick 自動 render stage，所以 ticker callback 內**不要**再呼叫 `renderer.render(stage)`，否則會 double render。`gameLoop()` 是 frame-rate-driven 的固定步狀態機，由 `main.ts` 的 accumulator 用 `ticker.deltaMS` 算累積時間 / 40 ms 來控制呼叫頻率（不讀 `delta`）。

### TypeScript 設定

- 啟用 strict 模式（`tsconfig.json` 開了 `strict`、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`noImplicitOverride`、`verbatimModuleSyntax`、`useDefineForClassFields`、`isolatedModules`）。整個 source tree 中 **完全沒有** `@ts-ignore` / `@ts-expect-error` — 請維持這個狀態；若需要繞過 checker，請改型別本身而不是壓住錯誤。
- `"moduleResolution": "bundler"` 讓 TS 能把 `.js` import 路徑解析到對應的 `.ts` 原始檔。Import 路徑保留明確的 `.js` 副檔名（例如 `import { rand } from './rand.js'`） — 這是 ESM bundler resolution 的正解，也與 Vite 在 runtime 提供的內容一致。
- HTML 的 entry tag 直接指向 TS 檔：`<script type="module" src="./index.ts">`。Vite 在 dev 與 rollup build 階段都能處理。
- 另一份 `tsconfig.node.json`（內含 `"types": ["node"]`）涵蓋 `vite.config.ts`，使 app code 的 `tsconfig.json` 維持 `"types": ["vite/client"]`，**不會**讓 Node 全域名稱外洩到瀏覽器 bundle。`npm run typecheck` 兩份都跑。
- 沒有 constructor initializer、會被之後 mutate 的 class field 採用**預設值初始化**（`x = 0`）而不是 definite-assignment assertion（`x!: number`）。這是 strict mode 的要求，也因為 `Player.initializeForNewRound()` 反正會在建構時覆寫這些值。
- `i18n/index.ts` 的 locale 收斂改用回傳 `Locale | null` 的 `asLocale(value)` helper，而非 `value is Locale` 的 type predicate。語意一致、實作更直白。

### Build 佈局

`vite.config.ts` 設定 `root: 'src'`、`publicDir: '../public'`、`base: './'`（相對路徑，方便部署到 sub-path），並在 `rollupOptions.input` 列出兩個 HTML 入口：`src/index.html`（主頁）與 `src/update-history/index.html`。每個 HTML 都只載入**一個** entry script（`src/index.ts`、`src/update-history/index.ts`），由它再 import 該頁所需的模組 — 把模組「展開」成多個 `<script type="module">` 會讓 Rollup 產生空的 placeholder chunk，並從輸出的 HTML 裡丟掉其中一個 script tag，所以**不要**再把 script tag 散開。

`public/` 放所有 runtime 必須保留檔名的東西：`manifest.json` 與 `resources/assets/**`（精靈圖、音效、icon）。PixiJS Loader 透過 `assets_path.ts` 內的相對路徑（`resources/assets/...`，沒有 `..`）抓這些檔。`src/resources/style.css` 留在 `src/` 之下，會被 Vite 加上 hash — 沒問題，因為只有 HTML 的 `<link>` 引用它。

`vite-plugin-pwa` 產生 `sw.js`（`generateSW` 策略、`cleanupOutdatedCaches`、`skipWaiting: false`、`manifest: false` 因此 `public/manifest.json` 是 manifest 的唯一來源）。`src/index.html` 裡那塊 `<script type="module">` 透過 workbox-window CDN 註冊 service worker；該呼叫被 `import.meta.env.PROD` 包住，因為 dev mode 不會提供 `sw.js`。

`package.json` 有一個 `overrides` 區塊把 `vite-plugin-pwa.vite` 對應到 `$vite`。沒有這個設定的話 npm 會拒絕安裝，因為 `vite-plugin-pwa@1.2.0` 的 peer-dep 範圍最高只到 `vite@^7`，但專案在 Vite 8。這個 plugin 實際運作沒問題；這個 pin 只是為了讓 npm 的 peer-dep 解析過得去。

### 語系處理

每個頁面只有**一份** HTML（沒有 `en/`、`ko/`、`zh/` 子資料夾）。`src/index.html` 與 `src/update-history/index.html` 裡所有要翻譯的文字都用 `data-i18n="key"`（textContent）、`data-i18n-html="key"`（innerHTML，給含內嵌 `<a>` / `<span>` 的翻譯）或 `data-i18n-attr="alt:key.alt,src:key.src"`（屬性）標註。`src/resources/js/i18n/translations.ts` 的翻譯表型別是 `Record<Locale, Record<string, string>>`，其中 `Locale = 'en' | 'ko' | 'zh'`，所以新增一個字串時三個 locale 都要加 key。缺 key 會 fallback 到英文。

韓文 texture 覆寫（用 `messages/ko/*.png` 取代預設的 `messages/ja/*.png`）只在 `currentLocale === 'ko'` 時於 `i18n/index.ts` 內套用。要加更多語系專屬的 texture 變體，得擴充那個區塊並把資產放到 `public/resources/assets/images/messages/<locale>/` — 但 spritesheet（`sprite_sheet.json` / `.png`）是單一 atlas，所以任何新 texture 都得先打包進去。

## 慣例

- 原始檔都是 `.ts`（沒有 `'use strict';` — TS 模組預設就是 strict）。
- **Formatter — oxfmt**（`.oxfmtrc.json`）：`singleQuote: true`、`endOfLine: lf`。其他預設值大致與 Prettier 對齊。
- **Linter — oxlint**（`oxlint.config.ts`）：啟用 `typescript`、`unicorn`、`import` plugins，套用 `correctness: error` / `suspicious: warn` 兩個 category，外加明確的 `eqeqeq` 與 `prefer-const`。`import/no-unassigned-import` 被**關閉**，因為專案有幾個刻意的 side-effect import（`./i18n/index.js`、`@pixi/sound` 等）。
- 型別用 TS 語法表達（interface、`Record<...>`、`[number, number]` 之類的 tuple 型別、`as const` 字面量物件等）。JSDoc 拿來寫描述沒問題，但已經不再是型別的真正來源。
- 修改 `physics.ts` / `cloud_and_wave.ts` 時，請保留位址註解與 bit-trick 整數運算；這些是忠實移植，不是慣用 JS。`docs/engine/` 的詳細分析記錄了哪些行為是刻意保留的 quirk。
