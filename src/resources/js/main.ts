/**
 * This is the main script which executes the game.
 * General explanations for the all source code files of the game are following.
 *
 ********************************************************************************************************************
 * This web version of the Pikachu Volleyball is made by
 * reverse engineering the core part of the original Pikachu Volleyball game
 * which is developed by "1997 (C) SACHI SOFT / SAWAYAKAN Programmers" & "1997 (C) Satoshi Takenouchi".
 *
 * "physics.ts", "cloud_and_wave.ts", and some codes in "view.ts" are the results of this reverse engineering.
 * Refer to the comments in each file for the machine code addresses of the original functions.
 ********************************************************************************************************************
 *
 * This web version game is mainly composed of three parts which follows MVC pattern.
 *  1) "physics.ts" (Model): The physics engine which takes charge of the dynamics of the ball and the players (Pikachus).
 *                           It is gained by reverse engineering the machine code of the original game.
 *  2) "view.ts" (View): The rendering part of the game which depends on pixi.js (https://www.pixijs.com/, https://github.com/pixijs/pixi.js) library.
 *                       Some codes in this part is gained by reverse engineering the original machine code.
 *  3) "pikavolley.ts" (Controller): Make the game work by controlling the Model and the View according to the user input.
 *
 * And explanations for other source files are below.
 *  - "cloud_and_wave.ts": This is also a Model part which takes charge of the clouds and wave motion in the game. Of course, it is also rendered by "view.ts".
 *                         It is also gained by reverse engineering the original machine code.
 *  - "keyboard.ts": Support the Controller("pikavolley.ts") to get a user input via keyboard.
 *  - "audio.ts": The game audio or sounds. It depends on pixi-sound (https://github.com/pixijs/pixi-sound) library.
 *  - "rand.ts": For the random function used in the Models ("physics.ts", "cloud_and_wave.ts").
 *  - "assets_path.ts": For the assets (image files, sound files) locations.
 *  - "ui.ts": For the user interface (menu bar, buttons etc.) of the html page.
 */
// i18n must run first: it applies the Korean texture-key overrides on
// `ASSETS_PATH.TEXTURES` synchronously, before main.ts queues the spritesheet
// on `Assets.load`.
import './i18n/index.js';
import { Application, Assets, Spritesheet, TextureStyle } from 'pixi.js';
import type { Sound } from '@pixi/sound';
import '@pixi/sound'; // side-effect: registers the sound Assets parser
import { PikachuVolleyball } from './pikavolley.js';
import { ASSETS_PATH } from './assets_path.js';
import { setUpUI } from './ui.js';

// Set the default scale mode to 'nearest' before any texture is loaded so the
// pixel-art spritesheet keeps crisp edges. Resolution: 2 keeps the canvas sharp
// when the browser is asked to bilinear-scale it ("soft" graphic option).
TextureStyle.defaultOptions.scaleMode = 'nearest';

const app = new Application();
await app.init({
  width: 432,
  height: 304,
  antialias: false,
  background: 0x000000,
  backgroundAlpha: 1,
  resolution: 2,
  roundPixels: true,
  preference: 'webgl',
});

const canvas = app.canvas;
canvas.id = 'game-canvas';
getEl('game-canvas-container').appendChild(canvas);
app.renderer.render(app.stage); // To make the initial canvas painting stable in the Firefox browser.

setUpInitialUI();

function getEl(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Element not found: #${id}`);
  return e;
}

/**
 * Set up the initial UI.
 */
function setUpInitialUI(): void {
  const loadingBox = getEl('loading-box');
  const progressBar = getEl('progress-bar');

  const aboutBox = getEl('about-box');
  const aboutBtn = getEl('about-btn') as HTMLButtonElement;
  const closeAboutBtn = getEl('close-about-btn');
  const gameDropdownBtn = getEl('game-dropdown-btn') as HTMLButtonElement;
  const optionsDropdownBtn = getEl('options-dropdown-btn') as HTMLButtonElement;
  gameDropdownBtn.disabled = true;
  optionsDropdownBtn.disabled = true;
  const closeAboutBox = (): void => {
    if (!aboutBox.classList.contains('hidden')) {
      aboutBox.classList.add('hidden');
      aboutBtn.disabled = true;
    }
    aboutBtn.getElementsByClassName('text-play')[0]?.classList.add('hidden');
    aboutBtn.getElementsByClassName('text-about')[0]?.classList.remove('hidden');
    aboutBtn.classList.remove('glow');
    closeAboutBtn.getElementsByClassName('text-play')[0]?.classList.add('hidden');
    closeAboutBtn.getElementsByClassName('text-close')[0]?.classList.remove('hidden');
    closeAboutBtn.classList.remove('glow');

    loadingBox.classList.remove('hidden');
    aboutBtn.removeEventListener('click', closeAboutBox);
    closeAboutBtn.removeEventListener('click', closeAboutBox);

    void loadAndStart(progressBar, loadingBox);
  };
  aboutBtn.addEventListener('click', closeAboutBox);
  closeAboutBtn.addEventListener('click', closeAboutBox);
}

/**
 * Load the spritesheet and sounds, then set up the game and start the ticker.
 */
async function loadAndStart(progressBar: HTMLElement, loadingBox: HTMLElement): Promise<void> {
  // `Assets.load` has two overloads; the first one (`urls: string | UnresolvedAsset`)
  // shadows the array form because `UnresolvedAsset` carries an open `[key: string]: any`
  // index signature. Annotating the result picks the second overload's return type.
  const urls = [ASSETS_PATH.SPRITE_SHEET, ...Object.values(ASSETS_PATH.SOUNDS)];
  const loaded: Record<string, Spritesheet | Sound> = await Assets.load(urls, (progress) => {
    progressBar.style.width = `${Math.round(progress * 100)}%`;
  });
  loadingBox.classList.add('hidden');

  const sheet = loaded[ASSETS_PATH.SPRITE_SHEET] as Spritesheet;
  const sounds: Record<string, Sound> = {};
  for (const url of Object.values(ASSETS_PATH.SOUNDS)) {
    sounds[url] = loaded[url] as Sound;
  }

  const pikaVolley = new PikachuVolleyball(app.stage, sheet, sounds);
  setUpUI(pikaVolley, app.ticker);
  app.ticker.maxFPS = pikaVolley.normalFPS;
  // Application's TickerPlugin auto-renders the stage each tick, so this
  // callback only needs to drive the game-state machine.
  app.ticker.add(() => {
    pikaVolley.gameLoop();
  });
}
