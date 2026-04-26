/**
 * The Controller part in MVC pattern
 */
import type { Container, Spritesheet } from 'pixi.js';
import type { Sound } from '@pixi/sound';
import { GROUND_HALF_WIDTH, PikaPhysics, type SoundEvent } from './physics.js';
import { setCustomRng } from './rand.js';
import {
  buildReplay,
  mulberry32,
  type Replay,
  type ReplayInputFrame,
  type RoundReInit,
  snapshotInputs,
} from './replay.js';
import { MenuView, GameView, FadeInOut, IntroView } from './view.js';
import { PikaKeyboard } from './keyboard.js';
import { PikaAudio } from './audio.js';
import { localStorageWrapper } from './utils/local_storage_wrapper.js';

export type GameMode = '1v1' | '2v2';

/** Default key bindings for the two extra slots in 2v2. */
const DEFAULT_KEYS_P3 = {
  left: 'KeyJ',
  right: 'KeyL',
  up: 'KeyI',
  down: 'KeyK',
  powerHit: 'KeyU',
} as const;
const DEFAULT_KEYS_P4 = {
  left: 'Numpad4',
  right: 'Numpad6',
  up: 'Numpad8',
  down: 'Numpad2',
  powerHit: 'Numpad0',
} as const;

function loadModeFromStorage(): GameMode {
  return localStorageWrapper.get('pv-offline-mode') === '2v2' ? '2v2' : '1v1';
}

function makePhysicsForMode(mode: GameMode): PikaPhysics {
  if (mode === '1v1') {
    return new PikaPhysics(true, true);
  }
  return new PikaPhysics([
    { isPlayer2: false, isComputer: true },
    { isPlayer2: true, isComputer: true },
    { isPlayer2: false, isComputer: true },
    { isPlayer2: true, isComputer: true },
  ]);
}

function makeKeyboardsForMode(mode: GameMode): [PikaKeyboard, PikaKeyboard, ...PikaKeyboard[]] {
  const p1 = new PikaKeyboard('KeyD', 'KeyG', 'KeyR', 'KeyV', 'KeyZ', 'KeyF');
  const p2 = new PikaKeyboard('ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter');
  if (mode === '1v1') {
    const r: [PikaKeyboard, PikaKeyboard] = [p1, p2];
    return r;
  }
  const p3 = new PikaKeyboard(
    DEFAULT_KEYS_P3.left,
    DEFAULT_KEYS_P3.right,
    DEFAULT_KEYS_P3.up,
    DEFAULT_KEYS_P3.down,
    DEFAULT_KEYS_P3.powerHit,
  );
  const p4 = new PikaKeyboard(
    DEFAULT_KEYS_P4.left,
    DEFAULT_KEYS_P4.right,
    DEFAULT_KEYS_P4.up,
    DEFAULT_KEYS_P4.down,
    DEFAULT_KEYS_P4.powerHit,
  );
  const r: [PikaKeyboard, PikaKeyboard, PikaKeyboard, PikaKeyboard] = [p1, p2, p3, p4];
  return r;
}

export type GameState = () => void;

const sideToPan = (side: 0 | 1): -1 | 1 => (side === 0 ? -1 : 1);
const xToPan = (x: number): -1 | 0 | 1 =>
  x < GROUND_HALF_WIDTH ? -1 : x > GROUND_HALF_WIDTH ? 1 : 0;

interface FrameTotal {
  intro: number;
  afterMenuSelection: number;
  beforeStartOfNewGame: number;
  startOfNewGame: number;
  afterEndOfRound: number;
  beforeStartOfNextRound: number;
  gameEnd: number;
}

interface NoInputFrameTotal {
  menu: number;
}

interface PikaVolleyView {
  intro: IntroView;
  menu: MenuView;
  game: GameView;
  fadeInOut: FadeInOut;
}

/**
 * Class representing Pikachu Volleyball game
 */
export class PikachuVolleyball {
  view: PikaVolleyView;
  audio: PikaAudio;
  physics: PikaPhysics;
  /**
   * Length 2 (1v1) or 4 (2v2). Tuple type pins indices [0]/[1] as guaranteed
   * present so the menu / intro state machines can dot-access them without a
   * non-null assertion.
   */
  keyboardArray: [PikaKeyboard, PikaKeyboard, ...PikaKeyboard[]];

  /** '1v1' (2 players) or '2v2' (4 players). Persisted to localStorage. */
  mode: GameMode = '1v1';

  /** Stored so {@link setMode} can rebuild GameView without ui.ts plumbing. */
  private readonly stage: Container;
  private readonly sheet: Spritesheet;

  /** game fps */
  normalFPS = 25;
  /** fps for slow motion */
  slowMotionFPS = 5;

  /** number of frames for slow motion */
  readonly SLOW_MOTION_FRAMES_NUM = 6;
  /** number of frames left for slow motion */
  slowMotionFramesLeft = 0;
  /** number of elapsed normal fps frames for rendering slow motion */
  slowMotionNumOfSkippedFrames = 0;

  /** 0: with computer, 1: with friend. Legacy — slot picker replaced this. */
  selectedWithWho = 0;
  /** 0: 1v1, 1: 2v2 — what the user has highlighted in the menu picker. */
  selectedMode: 0 | 1 = 0;
  /**
   * Menu slot cursor: 0..N-1 highlights player slot N+1; equals playerCount
   * when the cursor is on the START row. Persists across menu visits so
   * returning to the menu doesn't lose the user's place.
   */
  selectedSlot: 0 | 1 | 2 | 3 | 4 = 0;
  /**
   * Per-slot human/CPU state for the menu's slot picker. Always length 4 —
   * even 1v1 keeps four entries so the user's 2v2 picks survive a 1v1 →
   * 2v2 round trip. Default: P1 human, others CPU (matches the legacy
   * "with computer" UX where whoever pressed power-hit was human).
   */
  slotIsHuman: boolean[] = [true, false, false, false];

  /**
   * Previous-frame d-pad state for the menu so navigation fires once per
   * key press instead of every frame the key is held. Reset to 0/0 each
   * time we enter the menu state.
   */
  private menuPrevXDir = 0;
  private menuPrevYDir = 0;

  /** [0] for player 1 score, [1] for player 2 score */
  scores: [number, number] = [0, 0];
  /** winning score: if either one of the players reaches this score, game ends */
  winningScore = 15;

  gameEnded = false;
  roundEnded = false;
  isPlayer2Serve = false;

  /** frame counter */
  frameCounter = 0;
  /** total number of frames for each game state */
  frameTotal: FrameTotal = {
    intro: 165,
    afterMenuSelection: 15,
    beforeStartOfNewGame: 15,
    startOfNewGame: 71,
    afterEndOfRound: 5,
    beforeStartOfNextRound: 30,
    gameEnd: 211,
  };

  /** counter for frames while there is no input from keyboard */
  noInputFrameCounter = 0;
  /** total number of frames to be rendered while there is no input */
  noInputFrameTotal: NoInputFrameTotal = {
    menu: 225,
  };

  paused = false;
  isStereoSound = true;

  /**
   * If true, every match auto-starts recording on entering {@link startOfNewGame}
   * with a fresh random seed. Disabled while a Replay is being played back.
   */
  autoStartRecording = true;

  private _isPracticeMode = false;

  /**
   * Replay recording buffer. When non-null, every physics tick driven by
   * {@link round} pushes the frame's input snapshot here. `null` means
   * recording is off. See {@link startRecording} / {@link stopRecording}.
   */
  private recordingSeed: number | null = null;
  private recordingFrames: ReplayInputFrame[] | null = null;
  private recordingReInits: RoundReInit[] = [];
  /**
   * One-shot signal from {@link beforeStartOfNextRound}: the next recorded
   * frame should be marked as a round-reInit boundary so multi-round replays
   * can reproduce the 2 rand calls consumed by `Player.initializeForNewRound`.
   */
  private pendingReInitMarker: { isPlayer2Serve: boolean } | null = null;

  /**
   * Replay playback buffer. When non-null, {@link round} overrides the live
   * keyboardArray with the scripted input for the current frame. `null` means
   * not replaying. See {@link startReplay}.
   */
  private replayFrames: ReadonlyArray<ReplayInputFrame> | null = null;
  private replayCursor = 0;

  /**
   * Optional renderer-resize callback wired up by main.ts. Used by
   * {@link rebuildForMode} to grow / shrink the canvas to match the active
   * mode's `groundWidth` (1v1 = 432, 2v2 = 576). Null means no-op (e.g. tests).
   */
  private resizeRenderer: ((w: number, h: number) => void) | null = null;

  /** The game state which is being rendered now */
  state: GameState;

  /**
   * Create a Pikachu Volleyball game which includes physics, view, audio
   * @param stage container that the application's renderer draws each tick
   * @param sheet loaded spritesheet
   * @param sounds map keyed by sound URL → loaded `Sound`
   */
  constructor(stage: Container, sheet: Spritesheet, sounds: Record<string, Sound>) {
    this.stage = stage;
    this.sheet = sheet;
    // Mode is read first so GameView's player-sprite count matches the
    // PikaPhysics player count from the very first frame (no transient
    // 1v1 view rendering 4-player physics).
    this.mode = loadModeFromStorage();
    // Build physics FIRST so GameView's bg / wave / cloud spread is sized
    // for the active groundWidth. Without this, a 2v2 session loaded from
    // localStorage gets a 432-wide GameView background while the canvas
    // resizes to 576 — the right slice of the field renders blank black.
    this.physics = makePhysicsForMode(this.mode);
    this.view = {
      intro: new IntroView(sheet),
      menu: new MenuView(sheet),
      game: new GameView(sheet, this.mode === '2v2' ? 4 : 2, this.physics.groundWidth),
      fadeInOut: new FadeInOut(sheet),
    };
    stage.addChild(this.view.intro.container);
    stage.addChild(this.view.menu.container);
    stage.addChild(this.view.game.container);
    stage.addChild(this.view.fadeInOut.black);
    this.view.intro.visible = false;
    this.view.menu.visible = false;
    this.view.game.visible = false;
    this.view.fadeInOut.visible = false;

    this.audio = new PikaAudio(sounds);
    this.keyboardArray = makeKeyboardsForMode(this.mode);

    this.state = this.intro;
  }

  /**
   * Wire up a renderer-resize callback so {@link rebuildForMode} can grow /
   * shrink the canvas to match the new mode's `groundWidth`. Called once by
   * main.ts after construction.
   */
  setRendererResizer(fn: (w: number, h: number) => void): void {
    this.resizeRenderer = fn;
  }

  /**
   * Internal: rebuild physics / keyboards / GameView and resize canvas to the
   * given mode. Does NOT touch the state machine, so callers in mid-flow
   * (e.g. the menu picker just before `afterMenuSelection`) can switch mode
   * without bouncing back to intro. The {@link setMode} public wrapper adds
   * the historical `restart()` for ui.ts-style "switch then start over" UX.
   */
  private rebuildForMode(mode: GameMode): void {
    if (this.mode !== mode) {
      this.mode = mode;
      localStorageWrapper.set('pv-offline-mode', mode);
    }
    for (const kb of this.keyboardArray) kb.unsubscribe();
    this.physics = makePhysicsForMode(mode);
    this.keyboardArray = makeKeyboardsForMode(mode);
    // Rebuild GameView so its playerSprites array matches the new player
    // count and its background tiles span the new groundWidth. Old view is
    // replaced wholesale; cleanest path given the sprite array is a
    // constructor-time decision in view.ts.
    this.stage.removeChild(this.view.game.container);
    this.view.game = new GameView(this.sheet, mode === '2v2' ? 4 : 2, this.physics.groundWidth);
    // Re-insert at the same z-order: behind fadeInOut, in front of menu.
    this.stage.addChildAt(
      this.view.game.container,
      this.stage.getChildIndex(this.view.fadeInOut.black),
    );
    this.view.game.visible = false;
    // Match canvas / fade overlay to the new groundWidth.
    this.view.fadeInOut.resize(this.physics.groundWidth);
    this.resizeRenderer?.(this.physics.groundWidth, 304);
  }

  /**
   * Public mode switch (kept for parity with the old API and any future
   * external caller). Rebuilds and forces a fresh start at intro so a
   * half-played match doesn't leak into the new mode.
   */
  setMode(mode: GameMode): void {
    if (this.mode === mode) return;
    this.rebuildForMode(mode);
    this.restart();
  }

  /**
   * Game loop
   * This function should be called at regular intervals ( interval = (1 / FPS) second )
   */
  gameLoop(): void {
    if (this.paused === true) {
      return;
    }
    if (this.slowMotionFramesLeft > 0) {
      this.slowMotionNumOfSkippedFrames++;
      if (
        this.slowMotionNumOfSkippedFrames % Math.round(this.normalFPS / this.slowMotionFPS) !==
        0
      ) {
        return;
      }
      this.slowMotionFramesLeft--;
      this.slowMotionNumOfSkippedFrames = 0;
    }
    // catch keyboard input and freeze it
    for (const kb of this.keyboardArray) kb.getInput();
    this.state();
  }

  /** Intro: a man with a brief case */
  intro(): void {
    if (this.frameCounter === 0) {
      this.view.intro.visible = true;
      this.view.fadeInOut.setBlackAlphaTo(0);
      this.audio.sounds.bgm.stop();
      // Intro and menu always render with the original 1v1 layout (sprites
      // are positioned at 216 = half of 432). If we're returning from a 2v2
      // round, shrink the canvas back so the menu doesn't render with empty
      // black space on the right.
      if (this.physics.groundWidth !== 432) {
        this.view.fadeInOut.resize(432);
        this.resizeRenderer?.(432, 304);
      }
    }
    this.view.intro.drawMark(this.frameCounter);
    this.frameCounter++;

    if (this.keyboardArray[0].powerHit === 1 || this.keyboardArray[1].powerHit === 1) {
      this.frameCounter = 0;
      this.view.intro.visible = false;
      this.state = this.menu;
    }

    if (this.frameCounter >= this.frameTotal.intro) {
      this.frameCounter = 0;
      this.view.intro.visible = false;
      this.state = this.menu;
    }
  }

  /**
   * Menu: pick mode (1v1 / 2v2) with ←→, navigate the per-slot human/CPU
   * picker with ↑↓, toggle a slot with power-hit, and launch the game by
   * pressing power-hit on the START row at the bottom of the list. Idle
   * timeout still launches with whatever's currently highlighted (demo mode
   * is "all four slots CPU + select START").
   */
  menu(): void {
    if (this.frameCounter === 0) {
      this.view.menu.visible = true;
      this.view.fadeInOut.setBlackAlphaTo(0);
      // Mode highlight defaults to the currently active mode (loaded from
      // localStorage). Slot cursor defaults to START so a quick power-hit
      // launches with the existing config without forcing the user to
      // navigate down through all slots first.
      this.selectedMode = this.mode === '2v2' ? 1 : 0;
      this.view.menu.selectMode(this.selectedMode);
      const initialPlayerCount = this.selectedMode === 1 ? 4 : 2;
      this.selectedSlot = initialPlayerCount as 0 | 1 | 2 | 3 | 4;
      this.view.menu.selectSlot(this.selectedSlot);
      // Reset d-pad edge tracking so navigation only fires on a fresh press
      // after re-entering the menu (e.g. a held key carrying over from the
      // intro state doesn't auto-scroll the cursor).
      this.menuPrevXDir = 0;
      this.menuPrevYDir = 0;
    }
    const visiblePlayerCount: 2 | 4 = this.selectedMode === 1 ? 4 : 2;
    this.view.menu.drawFightMessage(this.frameCounter);
    this.view.menu.drawSachisoft(this.frameCounter);
    this.view.menu.drawSittingPikachuTiles(this.frameCounter);
    this.view.menu.drawPikachuVolleyballMessage(this.frameCounter);
    this.view.menu.drawPokemonMessage(this.frameCounter);
    this.view.menu.drawModeMessages(this.frameCounter);
    this.view.menu.drawSlotList(this.frameCounter, visiblePlayerCount, this.slotIsHuman);
    this.frameCounter++;

    if (
      this.frameCounter < 71 &&
      (this.keyboardArray[0].powerHit === 1 || this.keyboardArray[1].powerHit === 1)
    ) {
      this.frameCounter = 71;
      return;
    }

    if (this.frameCounter <= 71) {
      return;
    }

    let movedThisFrame = false;

    // Edge-detect the d-pad so holding a direction doesn't auto-scroll. A
    // press only fires when the input transitions from 0 → ±1; the user
    // has to release and re-press for each step.
    const yDirRaw =
      this.keyboardArray[0].yDirection !== 0
        ? this.keyboardArray[0].yDirection
        : this.keyboardArray[1].yDirection;
    const yPressed = yDirRaw !== 0 && this.menuPrevYDir === 0 ? yDirRaw : 0;
    this.menuPrevYDir = yDirRaw;

    // ↑↓ navigates the slot cursor. Range: 0..visiblePlayerCount (inclusive),
    // where visiblePlayerCount itself is the START row.
    if (yPressed === -1 && this.selectedSlot > 0) {
      this.selectedSlot = (this.selectedSlot - 1) as 0 | 1 | 2 | 3 | 4;
      this.view.menu.selectSlot(this.selectedSlot);
      this.audio.sounds.pi.play();
      movedThisFrame = true;
    } else if (yPressed === 1 && this.selectedSlot < visiblePlayerCount) {
      this.selectedSlot = (this.selectedSlot + 1) as 0 | 1 | 2 | 3 | 4;
      this.view.menu.selectSlot(this.selectedSlot);
      this.audio.sounds.pi.play();
      movedThisFrame = true;
    }

    // ←→ flips the 1v1 / 2v2 mode highlight. When playerCount shrinks the
    // cursor may land out of bounds — clamp to the new START position.
    const xDirRaw =
      this.keyboardArray[0].xDirection !== 0
        ? this.keyboardArray[0].xDirection
        : this.keyboardArray[1].xDirection;
    const xPressed = xDirRaw !== 0 && this.menuPrevXDir === 0 ? xDirRaw : 0;
    this.menuPrevXDir = xDirRaw;
    if (xPressed === -1 && this.selectedMode === 1) {
      this.selectedMode = 0;
      this.view.menu.selectMode(this.selectedMode);
      this.audio.sounds.pi.play();
      movedThisFrame = true;
    } else if (xPressed === 1 && this.selectedMode === 0) {
      this.selectedMode = 1;
      this.view.menu.selectMode(this.selectedMode);
      this.audio.sounds.pi.play();
      movedThisFrame = true;
    }
    const newPlayerCount = this.selectedMode === 1 ? 4 : 2;
    if (this.selectedSlot > newPlayerCount) {
      this.selectedSlot = newPlayerCount as 0 | 1 | 2 | 3 | 4;
      this.view.menu.selectSlot(this.selectedSlot);
    }

    if (movedThisFrame) {
      this.noInputFrameCounter = 0;
    } else {
      this.noInputFrameCounter++;
    }

    const powerHitPressed =
      this.keyboardArray[0].powerHit === 1 ||
      this.keyboardArray[1].powerHit === 1 ||
      this.keyboardArray[2]?.powerHit === 1 ||
      this.keyboardArray[3]?.powerHit === 1;
    if (powerHitPressed) {
      const slotIdx = this.selectedSlot;
      if (slotIdx === newPlayerCount) {
        this.launchFromMenu();
      } else {
        // Slot toggle. Don't reset frameCounter — stay in the menu so the
        // user can keep tweaking. `pi` for the small click feedback.
        const cur = this.slotIsHuman[slotIdx];
        if (cur !== undefined) this.slotIsHuman[slotIdx] = !cur;
        this.audio.sounds.pi.play();
        this.noInputFrameCounter = 0;
      }
      return;
    }

    if (this.noInputFrameCounter >= this.noInputFrameTotal.menu) {
      this.launchFromMenu();
    }
  }

  /**
   * Apply the menu's selected mode + slot config to physics and transition
   * to {@link afterMenuSelection}. Shared by the START-row power-hit path
   * and the idle-timeout path so both end up identical.
   */
  private launchFromMenu(): void {
    const targetMode: GameMode = this.selectedMode === 1 ? '2v2' : '1v1';
    // rebuildForMode is a no-op when the chosen mode equals the current one
    // — but we still need to make sure the canvas matches the active
    // groundWidth (intro() may have shrunk it back to 432 even though
    // physics is in 2v2 mode).
    if (targetMode !== this.mode) {
      this.rebuildForMode(targetMode);
    } else {
      this.view.fadeInOut.resize(this.physics.groundWidth);
      this.resizeRenderer?.(this.physics.groundWidth, 304);
    }
    for (let i = 0; i < this.physics.players.length; i++) {
      const slot = this.physics.players[i];
      if (slot !== undefined) slot.isComputer = !this.slotIsHuman[i];
    }
    this.audio.sounds.pikachu.play();
    this.frameCounter = 0;
    this.noInputFrameCounter = 0;
    this.state = this.afterMenuSelection;
  }

  /** Fade out after menu selection */
  afterMenuSelection(): void {
    this.view.fadeInOut.changeBlackAlphaBy(1 / 16);
    this.frameCounter++;
    if (this.frameCounter >= this.frameTotal.afterMenuSelection) {
      this.frameCounter = 0;
      this.state = this.beforeStartOfNewGame;
    }
  }

  /** Delay before start of new game (This is for the delay that exist in the original game) */
  beforeStartOfNewGame(): void {
    this.frameCounter++;
    if (this.frameCounter >= this.frameTotal.beforeStartOfNewGame) {
      this.frameCounter = 0;
      this.view.menu.visible = false;
      this.state = this.startOfNewGame;
    }
  }

  /** Start of new game: Initialize ball and players and print game start message */
  startOfNewGame(): void {
    if (this.frameCounter === 0) {
      // Auto-record this match. Must run BEFORE the initializeForNewRound
      // calls below so the seeded rng is what assigns computerBoldness.
      if (this.autoStartRecording && !this.isRecording) {
        this.startRecording(Math.floor(Math.random() * 0x7fff_ffff));
      }
      this.view.game.visible = true;
      this.gameEnded = false;
      this.roundEnded = false;
      this.isPlayer2Serve = false;
      for (const p of this.physics.players) {
        p.gameEnded = false;
        p.isWinner = false;
      }

      this.scores[0] = 0;
      this.scores[1] = 0;
      this.view.game.drawScoresToScoreBoards(this.scores);

      for (const p of this.physics.players) p.initializeForNewRound();
      this.physics.ball.initializeForNewRound(this.isPlayer2Serve);
      this.view.game.drawPlayersAndBall(this.physics);

      this.view.fadeInOut.setBlackAlphaTo(1); // set black screen
      this.audio.sounds.bgm.play();
    }

    this.view.game.drawGameStartMessage(this.frameCounter, this.frameTotal.startOfNewGame);
    this.view.game.drawCloudsAndWave();
    this.view.fadeInOut.changeBlackAlphaBy(-(1 / 17)); // fade in
    this.frameCounter++;

    if (this.frameCounter >= this.frameTotal.startOfNewGame) {
      this.frameCounter = 0;
      this.view.fadeInOut.setBlackAlphaTo(0);
      this.state = this.round;
    }
  }

  /** Round: the players play volleyball in this game state */
  round(): void {
    // Replay playback: overwrite live keyboard input with the scripted frame.
    // Must run BEFORE pressedPowerHit is read so the replay's powerHit is
    // honored by the both-computer skip-to-intro branch below.
    if (this.replayFrames !== null) {
      const frame = this.replayFrames[this.replayCursor];
      if (frame === undefined) {
        this.replayFrames = null; // exhausted — live keyboard takes over
      } else {
        for (let i = 0; i < frame.length; i++) {
          const kb = this.keyboardArray[i];
          const slot = frame[i];
          if (kb !== undefined && slot !== undefined) Object.assign(kb, slot);
        }
        this.replayCursor++;
      }
    }

    const pressedPowerHit = this.keyboardArray.some((kb) => kb.powerHit === 1);
    const allComputer = this.physics.players.every((p) => p.isComputer);

    if (allComputer && pressedPowerHit) {
      this.frameCounter = 0;
      this.view.game.visible = false;
      this.state = this.intro;
      return;
    }

    if (this.recordingFrames !== null) {
      if (this.pendingReInitMarker !== null) {
        this.recordingReInits.push({
          atFrame: this.recordingFrames.length,
          isPlayer2Serve: this.pendingReInitMarker.isPlayer2Serve,
        });
        this.pendingReInitMarker = null;
      }
      this.recordingFrames.push(snapshotInputs(this.keyboardArray));
    }

    const { isBallTouchingGround, sounds } = this.physics.runEngineForNextFrame(this.keyboardArray);

    this.playSoundEffect(sounds);
    this.view.game.drawPlayersAndBall(this.physics);
    this.view.game.drawCloudsAndWave();

    if (this.gameEnded === true) {
      this.view.game.drawGameEndMessage(this.frameCounter);
      this.frameCounter++;
      if (
        this.frameCounter >= this.frameTotal.gameEnd ||
        (this.frameCounter >= 70 && pressedPowerHit)
      ) {
        this.frameCounter = 0;
        this.view.game.visible = false;
        this.state = this.intro;
      }
      return;
    }

    if (
      isBallTouchingGround &&
      this._isPracticeMode === false &&
      this.roundEnded === false &&
      this.gameEnded === false
    ) {
      // Ball landing on left half (x < net) → right team scores. The right
      // team in 2v2 is every player with `isPlayer2 === true`.
      const ballLandedLeft = this.physics.ball.punchEffectX < GROUND_HALF_WIDTH;
      const winningTeamIsRight = ballLandedLeft;
      const teamScoreIdx = winningTeamIsRight ? 1 : 0;
      this.isPlayer2Serve = ballLandedLeft;
      this.scores[teamScoreIdx] += 1;
      if (this.scores[teamScoreIdx] >= this.winningScore) {
        this.gameEnded = true;
        for (const p of this.physics.players) {
          p.isWinner = p.isPlayer2 === winningTeamIsRight;
          p.gameEnded = true;
        }
      }
      this.view.game.drawScoresToScoreBoards(this.scores);
      if (this.roundEnded === false && this.gameEnded === false) {
        this.slowMotionFramesLeft = this.SLOW_MOTION_FRAMES_NUM;
      }
      this.roundEnded = true;
    }

    if (this.roundEnded === true && this.gameEnded === false) {
      // if this is the last frame of this round, begin fade out
      if (this.slowMotionFramesLeft === 0) {
        this.view.fadeInOut.changeBlackAlphaBy(1 / 16); // fade out
        this.state = this.afterEndOfRound;
      }
    }
  }

  /** Fade out after end of round */
  afterEndOfRound(): void {
    this.view.fadeInOut.changeBlackAlphaBy(1 / 16);
    this.frameCounter++;
    if (this.frameCounter >= this.frameTotal.afterEndOfRound) {
      this.frameCounter = 0;
      this.state = this.beforeStartOfNextRound;
    }
  }

  /** Before start of next round, initialize ball and players, and print ready message */
  beforeStartOfNextRound(): void {
    if (this.frameCounter === 0) {
      this.view.fadeInOut.setBlackAlphaTo(1);
      this.view.game.drawReadyMessage(false);

      for (const p of this.physics.players) p.initializeForNewRound();
      this.physics.ball.initializeForNewRound(this.isPlayer2Serve);
      // Mark this reInit so the next recorded frame in `round()` pins it as a
      // multi-round boundary in the Replay artifact.
      if (this.recordingFrames !== null) {
        this.pendingReInitMarker = { isPlayer2Serve: this.isPlayer2Serve };
      }
      this.view.game.drawPlayersAndBall(this.physics);
    }

    this.view.game.drawCloudsAndWave();
    this.view.fadeInOut.changeBlackAlphaBy(-(1 / 16));

    this.frameCounter++;
    if (this.frameCounter % 5 === 0) {
      this.view.game.toggleReadyMessage();
    }

    if (this.frameCounter >= this.frameTotal.beforeStartOfNextRound) {
      this.frameCounter = 0;
      this.view.game.drawReadyMessage(false);
      this.view.fadeInOut.setBlackAlphaTo(0);
      this.roundEnded = false;
      this.state = this.round;
    }
  }

  /** Play sound effects emitted by the physics engine during {@link round} */
  playSoundEffect(events: SoundEvent[]): void {
    const audio = this.audio;
    const stereo = this.isStereoSound;
    for (const event of events) {
      switch (event.kind) {
        case 'pipikachu':
          audio.sounds.pipikachu.play(stereo ? sideToPan(event.playerSide) : 0);
          break;
        case 'pika':
          audio.sounds.pika.play(stereo ? sideToPan(event.playerSide) : 0);
          break;
        case 'chu':
          audio.sounds.chu.play(stereo ? sideToPan(event.playerSide) : 0);
          break;
        case 'powerHit':
          audio.sounds.powerHit.play(stereo ? xToPan(event.x) : 0);
          break;
        case 'ballTouchesGround':
          audio.sounds.ballTouchesGround.play(stereo ? xToPan(event.x) : 0);
          break;
      }
    }
  }

  /** Called if restart button clicked */
  restart(): void {
    this.frameCounter = 0;
    this.noInputFrameCounter = 0;
    this.slowMotionFramesLeft = 0;
    this.slowMotionNumOfSkippedFrames = 0;
    this.recordingSeed = null;
    this.recordingFrames = null;
    this.recordingReInits = [];
    this.pendingReInitMarker = null;
    this.replayFrames = null;
    this.replayCursor = 0;
    this.view.menu.visible = false;
    this.view.game.visible = false;
    this.state = this.intro;
  }

  /**
   * Begin recording a Replay. Must be called BEFORE the first physics tick of
   * the match you want to capture (e.g. while the controller is still in
   * `intro` or `menu`) — `setCustomRng` is reset here, so any RNG-dependent
   * state already produced by an in-flight match (computerBoldness, etc.)
   * will not be reproducible from `seed`.
   */
  startRecording(seed: number): void {
    setCustomRng(mulberry32(seed));
    this.recordingSeed = seed;
    this.recordingFrames = [];
    this.recordingReInits = [];
    this.pendingReInitMarker = null;
  }

  /**
   * Begin playing back a Replay through the live controller. Constructs a
   * fresh PikaPhysics with the replay's seed (matching what {@link runReplay}
   * does) and jumps directly to {@link round}, skipping {@link startOfNewGame}'s
   * fade-in / "GAME START" intro — entering startOfNewGame would call
   * {@link physics.Player.initializeForNewRound} a second time, double-consuming
   * the seeded rand and breaking computerBoldness alignment with runReplay.
   *
   * Limitation: the captured Replay format only seeds before the first round,
   * so multi-round matches diverge starting at round 2 (each new round's
   * `beforeStartOfNextRound` re-rolls computerBoldness from rand, which the
   * replay format does not encode). Single-round playback is bit-perfect.
   */
  startReplay(replay: Replay): void {
    setCustomRng(mulberry32(replay.seed));
    const playerCount = replay.playerCount ?? 2;
    // Old 2v2 replays were captured at GROUND_WIDTH=432. New ones carry
    // groundWidth explicitly; default to 432 for backward compat so old
    // recordings still play deterministically.
    const replayGroundWidth = replay.groundWidth ?? 432;
    if (playerCount === 2) {
      this.physics = new PikaPhysics(replay.isPlayer1Computer, replay.isPlayer2Computer);
    } else {
      this.physics = new PikaPhysics(
        [
          { isPlayer2: false, isComputer: replay.isPlayer1Computer },
          { isPlayer2: true, isComputer: replay.isPlayer2Computer },
          { isPlayer2: false, isComputer: replay.isPlayer3Computer ?? true },
          { isPlayer2: true, isComputer: replay.isPlayer4Computer ?? true },
        ],
        replayGroundWidth,
      );
    }
    // Sync the controller's mode tag and rebuild the GameView / canvas so
    // sprite count and tile spread match the replay's player count + width.
    const replayMode: GameMode = playerCount === 4 ? '2v2' : '1v1';
    this.mode = replayMode;
    this.stage.removeChild(this.view.game.container);
    this.view.game = new GameView(this.sheet, playerCount, this.physics.groundWidth);
    this.stage.addChildAt(
      this.view.game.container,
      this.stage.getChildIndex(this.view.fadeInOut.black),
    );
    this.view.fadeInOut.resize(this.physics.groundWidth);
    this.resizeRenderer?.(this.physics.groundWidth, 304);
    this.scores = [0, 0];
    this.gameEnded = false;
    this.roundEnded = false;
    this.isPlayer2Serve = false;
    this.frameCounter = 0;
    this.noInputFrameCounter = 0;
    this.slowMotionFramesLeft = 0;
    this.slowMotionNumOfSkippedFrames = 0;
    this.replayFrames = replay.frames;
    this.replayCursor = 0;
    // Don't record the replay we're playing back — would cascade into a
    // recording-of-a-recording that's not useful.
    this.autoStartRecording = false;
    this.recordingSeed = null;
    this.recordingFrames = null;
    this.recordingReInits = [];
    this.pendingReInitMarker = null;
    this.view.fadeInOut.setBlackAlphaTo(0);
    this.view.intro.visible = false;
    this.view.menu.visible = false;
    this.view.game.visible = true;
    this.view.game.drawScoresToScoreBoards(this.scores);
    this.view.game.drawPlayersAndBall(this.physics);
    this.audio.sounds.bgm.play();
    this.state = this.round;
  }

  get isReplaying(): boolean {
    return this.replayFrames !== null;
  }

  get isRecording(): boolean {
    return this.recordingFrames !== null;
  }

  /**
   * Snapshot the in-progress recording into a Replay without stopping it.
   * Returns `null` if recording is not active. Useful for "Save Replay"
   * mid-match — the recording continues building from the same buffer.
   */
  peekRecording(): Replay | null {
    if (this.recordingFrames === null || this.recordingSeed === null) return null;
    return buildReplay({
      seed: this.recordingSeed,
      isPlayer1Computer: this.physics.player1.isComputer,
      isPlayer2Computer: this.physics.player2.isComputer,
      ...(this.physics.players.length === 4
        ? {
            playerCount: 4 as const,
            isPlayer3Computer: this.physics.players[2]?.isComputer ?? true,
            isPlayer4Computer: this.physics.players[3]?.isComputer ?? true,
            groundWidth: this.physics.groundWidth,
          }
        : {}),
      frames: [...this.recordingFrames],
      ...(this.recordingReInits.length > 0 ? { roundReInits: [...this.recordingReInits] } : {}),
      finalScores: [this.scores[0], this.scores[1]],
    });
  }

  /**
   * Finalize and return the captured Replay, or `null` if recording was not
   * active. Recording is cleared either way.
   */
  stopRecording(): Replay | null {
    if (this.recordingFrames === null || this.recordingSeed === null) {
      this.recordingFrames = null;
      this.recordingSeed = null;
      this.recordingReInits = [];
      this.pendingReInitMarker = null;
      return null;
    }
    const replay = buildReplay({
      seed: this.recordingSeed,
      isPlayer1Computer: this.physics.player1.isComputer,
      isPlayer2Computer: this.physics.player2.isComputer,
      ...(this.physics.players.length === 4
        ? {
            playerCount: 4 as const,
            isPlayer3Computer: this.physics.players[2]?.isComputer ?? true,
            isPlayer4Computer: this.physics.players[3]?.isComputer ?? true,
          }
        : {}),
      frames: this.recordingFrames,
      ...(this.recordingReInits.length > 0 ? { roundReInits: this.recordingReInits } : {}),
      finalScores: [this.scores[0], this.scores[1]],
    });
    this.recordingFrames = null;
    this.recordingSeed = null;
    this.recordingReInits = [];
    this.pendingReInitMarker = null;
    return replay;
  }

  get isPracticeMode(): boolean {
    return this._isPracticeMode;
  }

  set isPracticeMode(bool: boolean) {
    this._isPracticeMode = bool;
    this.view.game.scoreBoards[0].visible = !bool;
    this.view.game.scoreBoards[1].visible = !bool;
  }
}
