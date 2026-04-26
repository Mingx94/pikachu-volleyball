/**
 * The View part in the MVC pattern
 *
 * Some codes in this module were gained by reverse engineering the original machine code.
 * The codes gained by reverse engineering are commented by the address of the function referred to in the machine code.
 * ex) FUN_00405d50 means the function at the address 00405d50 in the machine code.
 */
import { AnimatedSprite, Container, Sprite, Spritesheet, Text, Texture } from 'pixi.js';
import { Cloud, Wave, cloudAndWaveEngine } from './cloud_and_wave.js';
import { ASSETS_PATH } from './assets_path.js';
import type { PikaPhysics } from './physics.js';
import { t as translate } from './i18n/index.js';

const TEXTURES = ASSETS_PATH.TEXTURES;

type TextureDict = Record<string, Texture>;

/** number of clouds to be rendered */
const NUM_OF_CLOUDS = 10;

function getSheetTextures(sheet: Spritesheet): TextureDict {
  return sheet.textures as TextureDict;
}

function getTexture(textures: TextureDict, path: string): Texture {
  const t = textures[path];
  if (!t) throw new Error(`Texture not found: ${path}`);
  return t;
}

/**
 * Class representing intro view where the man with a briefcase mark appears
 */
export class IntroView {
  mark: Sprite;
  container: Container;

  /**
   * Create an IntroView object
   * @param sheet loaded spritesheet
   * @param viewWidth canvas width (1v1 = 432, 2v2 = 576). Centers the mark.
   */
  constructor(sheet: Spritesheet, viewWidth: number = 432) {
    const textures = getSheetTextures(sheet);

    this.mark = makeSpriteWithAnchorXY(textures, TEXTURES.MARK, 0.5, 0.5);
    this.mark.x = viewWidth / 2;
    this.mark.y = 304 / 2;

    this.container = new Container();
    this.container.addChild(this.mark);
  }

  get visible(): boolean {
    return this.container.visible;
  }

  set visible(bool: boolean) {
    this.container.visible = bool;
  }

  /**
   * draw "a man with a briefcase" mark
   */
  drawMark(frameCounter: number): void {
    const mark = this.mark;
    if (frameCounter === 0) {
      mark.alpha = 0;
      return;
    }
    if (frameCounter < 100) {
      mark.alpha = Math.min(1, mark.alpha + 1 / 25);
    } else if (frameCounter >= 100) {
      mark.alpha = Math.max(0, mark.alpha - 1 / 25);
    }
  }
}

interface MenuMessages {
  pokemon: Sprite;
  pikachuVolleyball: Sprite;
  withWho: [Sprite, Sprite];
  sachisoft: Sprite;
  fight: Sprite;
  /**
   * In-game mode picker: "1 vs 1" / "2 vs 2". Pulls strings from i18n
   * (`options.mode_1v1` / `options.mode_2v2`) so localization just works
   * without adding new spritesheet entries. Positioned above the slot list;
   * selected one pulses bigger via {@link MenuView.drawModeMessages}.
   */
  mode: [Text, Text];
  /**
   * Per-slot human/CPU picker rendered as Pixi Text rows. `slot[i]` is the
   * "P1" / "P2" / "P3" / "P4" label; `slotState[i]` is the toggleable "HUMAN"
   * / "CPU" indicator. `start` is the bottom row that launches the game.
   * `cursor` is the "▶" arrow that highlights the active row.
   */
  slot: [Text, Text, Text, Text];
  slotState: [Text, Text, Text, Text];
  start: Text;
  cursor: Text;
}

/**
 * Class representing menu view where you can select "play with computer" or "play with friend"
 */
export class MenuView {
  messages: MenuMessages;
  sittingPikachuTilesContainer: Container;
  container: Container;
  sittingPikachuTilesDisplacement = 0;
  /** 0: with computer, 1: with friend, -1: not selected. Legacy — withWho
   *  sprites stay loaded from the atlas but are no longer drawn; the slot
   *  picker replaced them. */
  selectedWithWho = -1;
  selectedWithWhoMessageSizeIncrement = 2;
  /** 0: 1v1, 1: 2v2, -1: not selected */
  selectedMode = -1;
  selectedModeMessageSizeIncrement = 2;
  /**
   * 0..N-1 highlights a player slot, N highlights the START row. Where
   * N = 2 (1v1) or 4 (2v2) — the controller passes playerCount each draw.
   * -1 means not selected (frame 0 init).
   */
  selectedSlot = -1;

  /**
   * Create a MenuView object
   * @param sheet loaded spritesheet
   */
  constructor(sheet: Spritesheet) {
    const textures = getSheetTextures(sheet);

    this.messages = {
      pokemon: makeSpriteWithAnchorXY(textures, TEXTURES.POKEMON, 0, 0),
      pikachuVolleyball: makeSpriteWithAnchorXY(textures, TEXTURES.PIKACHU_VOLLEYBALL, 0, 0),
      withWho: [
        makeSpriteWithAnchorXY(textures, TEXTURES.WITH_COMPUTER, 0, 0),
        makeSpriteWithAnchorXY(textures, TEXTURES.WITH_FRIEND, 0, 0),
      ],
      sachisoft: makeSpriteWithAnchorXY(textures, TEXTURES.SACHISOFT, 0, 0),
      fight: makeSpriteWithAnchorXY(textures, TEXTURES.FIGHT, 0, 0),
      mode: makeModeLabels(),
      slot: makeSlotLabels(),
      slotState: makeSlotStateLabels(),
      start: makeMenuText(translate('menu.start'), MENU_LIST_FONT_SIZE + 2),
      cursor: makeMenuText('▶', MENU_LIST_FONT_SIZE),
    };
    this.sittingPikachuTilesContainer = makeSittingPikachuTilesContainer(textures);

    // referred to FUN_004059f0
    this.messages.sachisoft.x = 216 - this.messages.sachisoft.texture.width / 2;
    this.messages.sachisoft.y = 264;

    // referred to FUN_00405b70
    this.messages.pikachuVolleyball.x = 140;
    this.messages.pikachuVolleyball.y = 80;
    this.messages.pokemon.x = 170;
    this.messages.pokemon.y = 40;

    this.container = new Container();
    this.container.addChild(this.sittingPikachuTilesContainer);
    this.container.addChild(this.messages.pokemon);
    this.container.addChild(this.messages.pikachuVolleyball);
    this.container.addChild(this.messages.mode[0]);
    this.container.addChild(this.messages.mode[1]);
    for (const t of this.messages.slot) this.container.addChild(t);
    for (const t of this.messages.slotState) this.container.addChild(t);
    this.container.addChild(this.messages.start);
    this.container.addChild(this.messages.cursor);
    this.container.addChild(this.messages.sachisoft);
    this.container.addChild(this.messages.fight);
    this.initializeVisibles();
  }

  get visible(): boolean {
    return this.container.visible;
  }

  set visible(bool: boolean) {
    this.container.visible = bool;

    // when turn off view, initialize visibilities of sprites in this view
    if (bool === false) {
      this.initializeVisibles();
    }
  }

  initializeVisibles(): void {
    this.messages.pokemon.visible = false;
    this.messages.pikachuVolleyball.visible = false;
    this.messages.withWho[0].visible = false;
    this.messages.withWho[1].visible = false;
    this.messages.sachisoft.visible = false;
    this.messages.fight.visible = false;
    this.messages.mode[0].visible = false;
    this.messages.mode[1].visible = false;
    for (const t of this.messages.slot) t.visible = false;
    for (const t of this.messages.slotState) t.visible = false;
    this.messages.start.visible = false;
    this.messages.cursor.visible = false;
  }

  /**
   * referred to FUN_00405d50
   * Draw "fight!" message which get bigger and smaller as frame goes
   */
  drawFightMessage(frameCounter: number): void {
    const sizeArray = [20, 22, 25, 27, 30, 27, 25, 22, 20];
    const fightMessage = this.messages.fight;
    const w = fightMessage.texture.width;
    const h = fightMessage.texture.height;

    if (frameCounter === 0) {
      fightMessage.visible = true;
    }

    if (frameCounter < 30) {
      const halfWidth = Math.floor(Math.floor((frameCounter * w) / 30) / 2);
      const halfHeight = Math.floor(Math.floor((frameCounter * h) / 30) / 2);
      fightMessage.width = halfWidth * 2; // width
      fightMessage.height = halfHeight * 2; // height
      fightMessage.x = 100 - halfWidth; // x coord
      fightMessage.y = 70 - halfHeight; // y coord
    } else {
      const index = (frameCounter + 1) % 9;
      const size = sizeArray[index] ?? 20;
      const halfWidth = Math.floor(Math.floor((size * w) / 30) / 2);
      const halfHeight = Math.floor(Math.floor((size * h) / 30) / 2);
      fightMessage.width = halfWidth * 2; // width
      fightMessage.height = halfHeight * 2; // height
      fightMessage.y = 70 - halfHeight; // y coord
      fightMessage.x = 100 - halfWidth; // x coord
    }
  }

  /**
   * Draw sachisoft message as frame goes
   */
  drawSachisoft(frameCounter: number): void {
    if (frameCounter === 0) {
      this.messages.sachisoft.visible = true;
      this.messages.sachisoft.alpha = 0;
    }
    this.messages.sachisoft.alpha = Math.min(1, this.messages.sachisoft.alpha + 0.04);

    if (frameCounter > 70) {
      this.messages.sachisoft.alpha = 1;
    }
  }

  /**
   * referred to FUN_00405ca0
   * Draw sitting pikachu tiles as frame goes
   */
  drawSittingPikachuTiles(frameCounter: number): void {
    if (frameCounter === 0) {
      this.sittingPikachuTilesContainer.visible = true;
      this.sittingPikachuTilesContainer.alpha = 0;
    }

    // movement
    const firstTile = this.sittingPikachuTilesContainer.getChildAt(0) as Sprite;
    const h = firstTile.texture.height;
    this.sittingPikachuTilesDisplacement = (this.sittingPikachuTilesDisplacement + 2) % h;
    this.sittingPikachuTilesContainer.x = -this.sittingPikachuTilesDisplacement;
    this.sittingPikachuTilesContainer.y = -this.sittingPikachuTilesDisplacement;

    if (frameCounter > 30) {
      // alpha
      this.sittingPikachuTilesContainer.alpha = Math.min(
        1,
        this.sittingPikachuTilesContainer.alpha + 0.04,
      );
    }

    if (frameCounter > 70) {
      this.sittingPikachuTilesContainer.alpha = 1;
    }
  }

  /**
   * referred to FUN_00405b70
   * Draw pikachu volleyball message as frame goes
   */
  drawPikachuVolleyballMessage(frameCounter: number): void {
    if (frameCounter === 0) {
      this.messages.pikachuVolleyball.visible = false;
      return;
    }

    if (frameCounter > 30) {
      this.messages.pikachuVolleyball.visible = true;
    }

    if (frameCounter > 30 && frameCounter <= 44) {
      const xDiff = 195 - 15 * (frameCounter - 30);
      this.messages.pikachuVolleyball.x = 140 + xDiff;
    } else if (frameCounter > 44 && frameCounter <= 55) {
      this.messages.pikachuVolleyball.x = 140;
      this.messages.pikachuVolleyball.width = 200 - 15 * (frameCounter - 44);
    } else if (frameCounter > 55 && frameCounter <= 71) {
      this.messages.pikachuVolleyball.x = 140;
      this.messages.pikachuVolleyball.width = 40 + 15 * (frameCounter - 55);
    } else if (frameCounter > 71) {
      this.messages.pikachuVolleyball.x = 140;
      this.messages.pikachuVolleyball.width = this.messages.pikachuVolleyball.texture.width;
    }
  }

  /**
   * referred to FUN_00405b70
   * Draw pokemon message as frame goes
   */
  drawPokemonMessage(frameCounter: number): void {
    if (frameCounter === 0) {
      this.messages.pokemon.visible = false;
      return;
    }

    if (frameCounter > 71) {
      this.messages.pokemon.visible = true;
    }
  }

  /**
   * referred to FUN_00405ec0
   * Draw with who messages (with computer or with friend) as frame goes
   */
  drawWithWhoMessages(frameCounter: number): void {
    const withWho = this.messages.withWho;
    const w = withWho[0].texture.width;
    const h = withWho[0].texture.height;

    if (frameCounter === 0) {
      withWho[0].visible = false;
      withWho[1].visible = false;
      return;
    }

    if (frameCounter > 70) {
      if (this.selectedWithWhoMessageSizeIncrement < 10) {
        this.selectedWithWhoMessageSizeIncrement += 1;
      }
      withWho.forEach((sprite, i) => {
        const selected = Number(this.selectedWithWho === i); // 1 if selected, 0 otherwise
        const halfWidthIncrement = selected * (this.selectedWithWhoMessageSizeIncrement + 2);
        const halfHeightIncrement = selected * this.selectedWithWhoMessageSizeIncrement;

        sprite.visible = true;
        sprite.x = 216 - w / 2 - halfWidthIncrement;
        sprite.y = 184 + 30 * i - halfHeightIncrement;
        sprite.width = w + 2 * halfWidthIncrement;
        sprite.height = h + 2 * halfHeightIncrement;
      });
    }
  }

  /**
   * Select with who for the effect that selected option gets bigger
   * @param i 0: with computer, 1: with friend
   */
  selectWithWho(i: number): void {
    this.selectedWithWho = i;
    this.selectedWithWhoMessageSizeIncrement = 2;
  }

  /**
   * Mirror of {@link drawWithWhoMessages}: paints the two mode labels above
   * the withWho sprites and pulses the selected one. Called every menu tick.
   */
  drawModeMessages(frameCounter: number): void {
    const labels = this.messages.mode;
    if (frameCounter === 0) {
      labels[0].visible = false;
      labels[1].visible = false;
      return;
    }

    if (frameCounter > 70) {
      if (this.selectedModeMessageSizeIncrement < 10) {
        this.selectedModeMessageSizeIncrement += 1;
      }
      const baseSize = MODE_LABEL_BASE_FONT_SIZE;
      const totalWidth = labels[0].width + labels[1].width + MODE_LABEL_GAP;
      let cursorX = 216 - totalWidth / 2;
      labels.forEach((label, i) => {
        const selected = Number(this.selectedMode === i);
        label.visible = true;
        label.style.fontSize = baseSize + selected * this.selectedModeMessageSizeIncrement;
        label.x = cursorX;
        label.y = MODE_LABEL_Y - selected * (this.selectedModeMessageSizeIncrement / 2);
        cursorX += label.width + MODE_LABEL_GAP;
      });
    }
  }

  /**
   * Pulse-resets the selection size animation when the highlighted mode changes.
   * @param i 0: 1v1, 1: 2v2
   */
  selectMode(i: number): void {
    this.selectedMode = i;
    this.selectedModeMessageSizeIncrement = 2;
  }

  /** Re-applies current i18n strings to the mode labels (call on locale change). */
  refreshModeLabels(): void {
    this.messages.mode[0].text = translate('options.mode_1v1');
    this.messages.mode[1].text = translate('options.mode_2v2');
    this.messages.start.text = translate('menu.start');
  }

  /**
   * Cursor highlight for the slot picker. -1 means "not selected" (frame 0
   * init). 0..playerCount-1 lands on a player slot (toggled by power-hit).
   * playerCount lands on the START row (power-hit launches the game).
   */
  selectSlot(i: number): void {
    this.selectedSlot = i;
  }

  /**
   * Draw the per-slot human/CPU picker plus the START row. `playerCount`
   * is 2 (1v1: only P1/P2 visible) or 4 (2v2: all four slots visible).
   * `slotIsHuman` carries the current toggle state for ALL four slots,
   * even in 1v1, so 2v2's settings persist if the user flips back.
   */
  drawSlotList(
    frameCounter: number,
    playerCount: 2 | 4,
    slotIsHuman: ReadonlyArray<boolean>,
  ): void {
    if (frameCounter === 0) {
      for (const t of this.messages.slot) t.visible = false;
      for (const t of this.messages.slotState) t.visible = false;
      this.messages.start.visible = false;
      this.messages.cursor.visible = false;
      return;
    }
    if (frameCounter <= 71) return;

    const labels = this.messages.slot;
    const states = this.messages.slotState;
    for (let i = 0; i < 4; i++) {
      const visible = i < playerCount;
      const labelText = labels[i];
      const stateText = states[i];
      if (labelText !== undefined) labelText.visible = visible;
      if (stateText !== undefined) {
        stateText.visible = visible;
        const isHuman = slotIsHuman[i] === true;
        stateText.text = isHuman ? translate('menu.slot_human') : translate('menu.slot_cpu');
        stateText.style.fill = isHuman ? 0xff_e0_60 : 0xff_ff_ff;
      }
      const rowY = SLOT_LIST_BASE_Y + i * SLOT_LIST_ROW_HEIGHT;
      if (labelText !== undefined) {
        labelText.x = SLOT_LIST_LABEL_X;
        labelText.y = rowY;
      }
      if (stateText !== undefined) {
        stateText.x = SLOT_LIST_STATE_X;
        stateText.y = rowY;
      }
    }

    this.messages.start.visible = true;
    const startY = SLOT_LIST_BASE_Y + playerCount * SLOT_LIST_ROW_HEIGHT + START_ROW_GAP;
    this.messages.start.x = 216 - this.messages.start.width / 2;
    this.messages.start.y = startY;

    // Cursor: hidden if -1, else position at left of the highlighted row.
    const cursor = this.messages.cursor;
    const cursorIdx = this.selectedSlot;
    if (cursorIdx < 0) {
      cursor.visible = false;
    } else {
      cursor.visible = true;
      cursor.x = SLOT_LIST_CURSOR_X;
      cursor.y =
        cursorIdx === playerCount ? startY : SLOT_LIST_BASE_Y + cursorIdx * SLOT_LIST_ROW_HEIGHT;
    }
  }
}

const MODE_LABEL_Y = 130;
const MODE_LABEL_GAP = 24;
const MODE_LABEL_BASE_FONT_SIZE = 16;
const MENU_LIST_FONT_SIZE = 14;
const SLOT_LIST_BASE_Y = 158;
const SLOT_LIST_ROW_HEIGHT = 18;
const SLOT_LIST_CURSOR_X = 158;
const SLOT_LIST_LABEL_X = 178;
const SLOT_LIST_STATE_X = 232;
const START_ROW_GAP = 6;

function makeModeLabels(): [Text, Text] {
  return [
    makeMenuText(translate('options.mode_1v1'), MODE_LABEL_BASE_FONT_SIZE),
    makeMenuText(translate('options.mode_2v2'), MODE_LABEL_BASE_FONT_SIZE),
  ];
}

function makeSlotLabels(): [Text, Text, Text, Text] {
  return [
    makeMenuText('P1', MENU_LIST_FONT_SIZE),
    makeMenuText('P2', MENU_LIST_FONT_SIZE),
    makeMenuText('P3', MENU_LIST_FONT_SIZE),
    makeMenuText('P4', MENU_LIST_FONT_SIZE),
  ];
}

function makeSlotStateLabels(): [Text, Text, Text, Text] {
  return [
    makeMenuText(translate('menu.slot_cpu'), MENU_LIST_FONT_SIZE),
    makeMenuText(translate('menu.slot_cpu'), MENU_LIST_FONT_SIZE),
    makeMenuText(translate('menu.slot_cpu'), MENU_LIST_FONT_SIZE),
    makeMenuText(translate('menu.slot_cpu'), MENU_LIST_FONT_SIZE),
  ];
}

function makeMenuText(text: string, fontSize: number): Text {
  return new Text({
    text,
    style: {
      fontFamily: 'DotGothic16, "JetBrains Mono", sans-serif',
      fontSize,
      fill: 0xff_ff_ff,
      stroke: { color: 0x00_00_00, width: 3 },
      align: 'center',
    },
  });
}

interface GameViewMessages {
  gameStart: Sprite;
  ready: Sprite;
  gameEnd: Sprite;
}

interface GameViewShadows {
  forPlayers: Sprite[];
  forBall: Sprite;
}

/**
 * Tints applied per slot in 2v2. P1 / P2 stay default (white = no tint) so
 * 1v1 looks identical. P3 / P4 get muted hues so two teammates on the same
 * half-field can be told apart at a glance.
 */
const PLAYER_TINTS: ReadonlyArray<number> = [0xff_ff_ff, 0xff_ff_ff, 0x88_ff_aa, 0xff_aa_ee];

interface ScoreBoardChildren {
  units: AnimatedSprite;
  tens: AnimatedSprite;
}

/**
 * Class represent a game view where pikachus, ball, clouds, waves, and backgrounds are
 */
export class GameView {
  /**
   * Active world width passed in by the controller (1v1 = 432, 2v2 = 576).
   * Used to size the background tiling, wave / cloud span, fade overlay,
   * scoreboard right-edge, and the net pillar's centerline.
   */
  groundWidth: number;
  bgContainer: Container;
  /**
   * One sprite per player slot, indexed by physics player slot. Length 2
   * (1v1) or 4 (2v2). The historical `player1` / `player2` fields are kept
   * as references to `playerSprites[0]` / `playerSprites[1]` for ergonomics
   * — they never go out of bounds and avoid plastering `playerSprites[0]!`
   * across this file.
   */
  playerSprites: AnimatedSprite[];
  player1: AnimatedSprite;
  player2: AnimatedSprite;
  ball: AnimatedSprite;
  ballHyper: Sprite;
  ballTrail: Sprite;
  punch: Sprite;
  scoreBoards: [Container, Container];
  scoreBoardChildren: [ScoreBoardChildren, ScoreBoardChildren];
  shadows: GameViewShadows;
  messages: GameViewMessages;
  cloudContainer: Container;
  cloudSprites: Sprite[];
  waveContainer: Container;
  waveSprites: Sprite[];
  container: Container;
  cloudArray: Cloud[];
  wave: Wave;

  constructor(sheet: Spritesheet, playerCount: 2 | 4 = 2, groundWidth: number = 432) {
    const textures = getSheetTextures(sheet);
    this.groundWidth = groundWidth;

    // Display objects below
    this.bgContainer = makeBGContainer(textures, groundWidth);
    this.playerSprites = makePlayerAnimatedSprites(textures, playerCount);
    for (let i = 0; i < this.playerSprites.length; i++) {
      const sprite = this.playerSprites[i];
      const tint = PLAYER_TINTS[i];
      if (sprite !== undefined && tint !== undefined) sprite.tint = tint;
    }
    const p1 = this.playerSprites[0];
    const p2 = this.playerSprites[1];
    if (p1 === undefined || p2 === undefined) {
      throw new Error(`GameView: playerCount ${playerCount} must yield ≥ 2 sprites`);
    }
    this.player1 = p1;
    this.player2 = p2;
    this.ball = makeBallAnimatedSprites(textures);
    this.ballHyper = makeSpriteWithAnchorXY(textures, TEXTURES.BALL_HYPER, 0.5, 0.5);
    this.ballTrail = makeSpriteWithAnchorXY(textures, TEXTURES.BALL_TRAIL, 0.5, 0.5);
    this.punch = makeSpriteWithAnchorXY(textures, TEXTURES.BALL_PUNCH, 0.5, 0.5);

    // this.scoreBoards[0] for left team, this.scoreBoards[1] for right team
    const board1 = makeScoreBoardSprite(textures);
    const board2 = makeScoreBoardSprite(textures);
    this.scoreBoards = [board1.container, board2.container];
    this.scoreBoardChildren = [
      { units: board1.units, tens: board1.tens },
      { units: board2.units, tens: board2.tens },
    ];

    const playerShadows: Sprite[] = [];
    for (let i = 0; i < this.playerSprites.length; i++) {
      playerShadows.push(makeSpriteWithAnchorXY(textures, TEXTURES.SHADOW, 0.5, 0.5));
    }
    this.shadows = {
      forPlayers: playerShadows,
      forBall: makeSpriteWithAnchorXY(textures, TEXTURES.SHADOW, 0.5, 0.5),
    };

    this.messages = {
      gameStart: makeSpriteWithAnchorXY(textures, TEXTURES.GAME_START, 0, 0),
      ready: makeSpriteWithAnchorXY(textures, TEXTURES.READY, 0, 0),
      gameEnd: makeSpriteWithAnchorXY(textures, TEXTURES.GAME_END, 0, 0),
    };

    const cloud = makeCloudContainer(textures);
    this.cloudContainer = cloud.container;
    this.cloudSprites = cloud.sprites;
    const wave = makeWaveContainer(textures, groundWidth);
    this.waveContainer = wave.container;
    this.waveSprites = wave.sprites;

    // container which include whole display objects
    // Should be careful on addChild order
    // The later added, the more front(z-index) on screen
    this.container = new Container();
    this.container.addChild(this.bgContainer);
    this.container.addChild(this.cloudContainer);
    this.container.addChild(this.waveContainer);
    for (const shadow of this.shadows.forPlayers) this.container.addChild(shadow);
    this.container.addChild(this.shadows.forBall);
    for (const sprite of this.playerSprites) this.container.addChild(sprite);
    this.container.addChild(this.ballTrail);
    this.container.addChild(this.ballHyper);
    this.container.addChild(this.ball);
    this.container.addChild(this.punch);
    this.container.addChild(this.scoreBoards[0]);
    this.container.addChild(this.scoreBoards[1]);
    this.container.addChild(this.messages.gameStart);
    this.container.addChild(this.messages.ready);
    this.container.addChild(this.messages.gameEnd);

    // location and visibility setting
    this.bgContainer.x = 0;
    this.bgContainer.y = 0;
    this.cloudContainer.x = 0;
    this.cloudContainer.y = 0;
    this.waveContainer.x = 0;
    this.waveContainer.y = 0;

    // The "ready" sprite was originally at x=176 in the 432-wide world
    // (≈ groundHalfWidth − 40, so its 80-px-wide texture sits centered).
    // Re-center it on the active groundWidth so 2v2 lines it up too.
    this.messages.ready.x = (groundWidth >> 1) - this.messages.ready.texture.width / 2;
    this.messages.ready.y = 38;
    this.scoreBoards[0].x = 14; // score board is 14 pixel distant from boundary
    this.scoreBoards[0].y = 10;
    this.scoreBoards[1].x = groundWidth - 32 - 32 - 14; // 32 pixel is for number (32x32px) width; one score board has two numbers
    this.scoreBoards[1].y = 10;

    for (const shadow of this.shadows.forPlayers) shadow.y = 273;
    this.shadows.forBall.y = 273;

    this.initializeVisibles();

    // clouds and wave model.
    // This model is included in this view object, not on controller object
    // since it is not dependent on user input, and only used for rendering.
    this.cloudArray = [];
    for (let i = 0; i < NUM_OF_CLOUDS; i++) {
      this.cloudArray.push(new Cloud(groundWidth));
    }
    this.wave = new Wave(groundWidth);
  }

  get visible(): boolean {
    return this.container.visible;
  }

  set visible(bool: boolean) {
    this.container.visible = bool;

    // when turn off view
    if (bool === false) {
      this.initializeVisibles();
    }
  }

  initializeVisibles(): void {
    this.messages.gameStart.visible = false;
    this.messages.ready.visible = false;
    this.messages.gameEnd.visible = false;
  }

  /**
   * Draw players and ball in the given physics object
   */
  drawPlayersAndBall(physics: PikaPhysics): void {
    const ball = physics.ball;

    for (let i = 0; i < physics.players.length; i++) {
      const player = physics.players[i];
      const sprite = this.playerSprites[i];
      const shadow = this.shadows.forPlayers[i];
      if (player === undefined || sprite === undefined || shadow === undefined) continue;
      sprite.x = player.x;
      sprite.y = player.y;
      // Mirror by team side normally; while diving / lying down, flip toward
      // the direction of the dive (matches the original 1v1 behavior for
      // each side).
      if (player.state === 3 || player.state === 4) {
        if (player.isPlayer2) {
          sprite.scale.x = player.divingDirection === 1 ? 1 : -1;
        } else {
          sprite.scale.x = player.divingDirection === -1 ? -1 : 1;
        }
      } else {
        sprite.scale.x = player.isPlayer2 ? -1 : 1;
      }
      shadow.x = player.x;
      sprite.gotoAndStop(getFrameNumberForPlayerAnimatedSprite(player.state, player.frameNumber));
    }

    this.ball.x = ball.x;
    this.ball.y = ball.y;
    this.shadows.forBall.x = ball.x;
    this.ball.gotoAndStop(ball.rotation);

    // For punch effect, refer FUN_00402ee0
    if (ball.punchEffectRadius > 0) {
      ball.punchEffectRadius -= 2;
      this.punch.width = 2 * ball.punchEffectRadius;
      this.punch.height = 2 * ball.punchEffectRadius;
      this.punch.x = ball.punchEffectX;
      this.punch.y = ball.punchEffectY;
      this.punch.visible = true;
    } else {
      this.punch.visible = false;
    }

    if (ball.isPowerHit === true) {
      this.ballHyper.x = ball.previousX;
      this.ballHyper.y = ball.previousY;
      this.ballTrail.x = ball.previousPreviousX;
      this.ballTrail.y = ball.previousPreviousY;

      this.ballHyper.visible = true;
      this.ballTrail.visible = true;
    } else {
      this.ballHyper.visible = false;
      this.ballTrail.visible = false;
    }
  }

  /**
   * Draw scores to each score board
   * @param scores [0] for player1 score, [1] for player2 score
   */
  drawScoresToScoreBoards(scores: number[]): void {
    for (let i = 0; i < 2; i++) {
      const children = this.scoreBoardChildren[i];
      const score = scores[i];
      if (children === undefined || score === undefined) continue;
      children.units.gotoAndStop(score % 10);
      children.tens.gotoAndStop(Math.floor(score / 10) % 10);
      children.tens.visible = score >= 10;
    }
  }

  /**
   * Draw clouds and wave
   */
  drawCloudsAndWave(): void {
    const cloudArray = this.cloudArray;
    const wave = this.wave;

    cloudAndWaveEngine(cloudArray, wave);

    for (let i = 0; i < NUM_OF_CLOUDS; i++) {
      const cloud = cloudArray[i];
      const cloudSprite = this.cloudSprites[i];
      if (cloud === undefined || cloudSprite === undefined) continue;
      cloudSprite.x = cloud.spriteTopLeftPointX;
      cloudSprite.y = cloud.spriteTopLeftPointY;
      cloudSprite.width = cloud.spriteWidth;
      cloudSprite.height = cloud.spriteHeight;
    }

    for (let i = 0; i < this.waveSprites.length; i++) {
      const waveSprite = this.waveSprites[i];
      const yCoord = wave.yCoords[i];
      if (waveSprite === undefined || yCoord === undefined) continue;
      waveSprite.y = yCoord;
    }
  }

  /**
   * refered FUN_00403f20
   * Draw game start message as frame goes
   * @param frameCounter current frame number
   * @param frameTotal total frame number for game start message
   */
  drawGameStartMessage(frameCounter: number, frameTotal: number): void {
    if (frameCounter === 0) {
      this.messages.gameStart.visible = true;
    } else if (frameCounter >= frameTotal - 1) {
      this.messages.gameStart.visible = false;
      return;
    }

    const gameStartMessage = this.messages.gameStart;
    // game start message rendering
    const w = gameStartMessage.texture.width; // game start message texture width
    const h = gameStartMessage.texture.height; // game start message texture height
    const halfWidth = Math.floor((w * frameCounter) / 50);
    const halfHeight = Math.floor((h * frameCounter) / 50);
    gameStartMessage.x = (this.groundWidth >> 1) - halfWidth;
    gameStartMessage.y = 50 + 2 * halfHeight;
    gameStartMessage.width = 2 * halfWidth;
    gameStartMessage.height = 2 * halfHeight;
  }

  /**
   * Draw ready message
   * @param bool turn on?
   */
  drawReadyMessage(bool: boolean): void {
    this.messages.ready.visible = bool;
  }

  /**
   * Togle ready message.
   * Turn off if it's on, turn on if it's off.
   */
  toggleReadyMessage(): void {
    this.messages.ready.visible = !this.messages.ready.visible;
  }

  /**
   * refered FUN_00404070
   * Draw game end message as frame goes
   */
  drawGameEndMessage(frameCounter: number): void {
    const gameEndMessage = this.messages.gameEnd;
    const w = gameEndMessage.texture.width; // game end message texture width;
    const h = gameEndMessage.texture.height; // game end message texture height;

    if (frameCounter === 0) {
      gameEndMessage.visible = true;
    }
    const cx = this.groundWidth >> 1;
    if (frameCounter < 50) {
      const halfWidthIncrement = 2 * Math.floor(((50 - frameCounter) * w) / 50);
      const halfHeightIncrement = 2 * Math.floor(((50 - frameCounter) * h) / 50);

      gameEndMessage.x = cx - w / 2 - halfWidthIncrement;
      gameEndMessage.y = 50 - halfHeightIncrement;
      gameEndMessage.width = w + 2 * halfWidthIncrement;
      gameEndMessage.height = h + 2 * halfHeightIncrement;
    } else {
      gameEndMessage.x = cx - w / 2;
      gameEndMessage.y = 50;
      gameEndMessage.width = w;
      gameEndMessage.height = h;
    }
  }
}

/**
 * Class representing fade in out effect
 */
export class FadeInOut {
  black: Sprite;

  constructor(sheet: Spritesheet, viewWidth: number = 432) {
    const textures = getSheetTextures(sheet);
    this.black = makeSpriteWithAnchorXY(textures, TEXTURES.BLACK, 0, 0);
    this.black.width = viewWidth;
    this.black.height = 304;
    this.black.x = 0;
    this.black.y = 0;
    this.black.alpha = 1;
  }

  /** Re-cover the canvas after a mode change (canvas widened/narrowed). */
  resize(viewWidth: number): void {
    this.black.width = viewWidth;
  }

  get visible(): boolean {
    return this.black.visible;
  }

  set visible(bool: boolean) {
    this.black.visible = bool;
  }

  /**
   * Set black alpha for fade in out
   * @param alpha number in [0, 1]
   */
  setBlackAlphaTo(alpha: number): void {
    this.black.alpha = alpha;
    if (this.black.alpha === 0) {
      this.black.visible = false;
    } else {
      this.black.visible = true;
    }
  }

  /**
   * Increase black alpha for fade in out
   * @param alphaIncrement if alphaIncrement > 0: fade out, else fade in
   */
  changeBlackAlphaBy(alphaIncrement: number): void {
    if (alphaIncrement >= 0) {
      this.black.alpha = Math.min(1, this.black.alpha + alphaIncrement);
    } else {
      this.black.alpha = Math.max(0, this.black.alpha + alphaIncrement);
    }
    if (this.black.alpha === 0) {
      this.black.visible = false;
    } else {
      this.black.visible = true;
    }
  }
}

/**
 * Make sitting pikachu tiles. Tile count is computed from canvas dimensions
 * so the menu background fills the full visible area regardless of mode
 * (1v1 = 432, 2v2 = 576). The +2 padding lets the displacement-scroll loop
 * keep tiles flush to the right and bottom edges as the container slides.
 */
function makeSittingPikachuTilesContainer(textures: TextureDict): Container {
  const container = new Container();
  const texture = getTexture(textures, TEXTURES.SITTING_PIKACHU);
  const w = texture.width;
  const h = texture.height;

  for (let j = 0; j < Math.floor(304 / h) + 2; j++) {
    for (let i = 0; i < Math.floor(432 / w) + 2; i++) {
      const tile = new Sprite(texture);
      addChildToParentAndSetLocalPosition(container, tile, w * i, h * j);
    }
  }

  return container;
}

/**
 * Make background. `groundWidth` controls the tile counts (sky, ground_red,
 * ground_line, ground_yellow) and the right-edge cap, plus the net pillar's
 * centerline (originally 213 = 216 - 3 in the 432-wide world).
 */
function makeBGContainer(textures: TextureDict, groundWidth: number = 432): Container {
  const bgContainer = new Container();
  const tileCols = (groundWidth / 16) | 0;
  const halfWidth = (groundWidth / 2) | 0;
  const netPillarX = halfWidth - 3;

  // sky
  let texture = getTexture(textures, TEXTURES.SKY_BLUE);
  for (let j = 0; j < 12; j++) {
    for (let i = 0; i < tileCols; i++) {
      const tile = new Sprite(texture);
      addChildToParentAndSetLocalPosition(bgContainer, tile, 16 * i, 16 * j);
    }
  }

  // mountain. Single 432-wide sprite by default; for the wider 2v2 court we
  // stretch it horizontally to span the full groundWidth so there's no black
  // band between the rightmost edge of the original mountain texture and the
  // canvas edge. Vertical scale stays native — only x is stretched.
  texture = getTexture(textures, TEXTURES.MOUNTAIN);
  const mountain = new Sprite(texture);
  mountain.x = 0;
  mountain.y = 188;
  mountain.width = groundWidth;
  bgContainer.addChild(mountain);

  // ground_red
  texture = getTexture(textures, TEXTURES.GROUND_RED);
  for (let i = 0; i < tileCols; i++) {
    const tile = new Sprite(texture);
    addChildToParentAndSetLocalPosition(bgContainer, tile, 16 * i, 248);
  }

  // ground_line
  texture = getTexture(textures, TEXTURES.GROUND_LINE);
  for (let i = 1; i < tileCols - 1; i++) {
    const tile = new Sprite(texture);
    addChildToParentAndSetLocalPosition(bgContainer, tile, 16 * i, 264);
  }
  texture = getTexture(textures, TEXTURES.GROUND_LINE_LEFT_MOST);
  addChildToParentAndSetLocalPosition(bgContainer, new Sprite(texture), 0, 264);
  texture = getTexture(textures, TEXTURES.GROUND_LINE_RIGHT_MOST);
  addChildToParentAndSetLocalPosition(bgContainer, new Sprite(texture), groundWidth - 16, 264);

  // ground_yellow
  texture = getTexture(textures, TEXTURES.GROUND_YELLOW);
  for (let j = 0; j < 2; j++) {
    for (let i = 0; i < tileCols; i++) {
      const tile = new Sprite(texture);
      addChildToParentAndSetLocalPosition(bgContainer, tile, 16 * i, 280 + 16 * j);
    }
  }

  // net pillar
  texture = getTexture(textures, TEXTURES.NET_PILLAR_TOP);
  addChildToParentAndSetLocalPosition(bgContainer, new Sprite(texture), netPillarX, 176);
  texture = getTexture(textures, TEXTURES.NET_PILLAR);
  for (let j = 0; j < 12; j++) {
    const tile = new Sprite(texture);
    addChildToParentAndSetLocalPosition(bgContainer, tile, netPillarX, 184 + 8 * j);
  }

  return bgContainer;
}

/**
 * Make `count` animated sprites for player slots, all sharing one texture
 * atlas. Slots 0/1 are P1/P2 (1v1 or 2v2), slots 2/3 are the second
 * teammates in 2v2.
 */
function makePlayerAnimatedSprites(textures: TextureDict, count: number): AnimatedSprite[] {
  const getPlayerTexture = (i: number, j: number): Texture =>
    getTexture(textures, TEXTURES.PIKACHU(i, j));
  const playerTextureArray: Texture[] = [];
  for (let i = 0; i < 7; i++) {
    if (i === 3) {
      playerTextureArray.push(getPlayerTexture(i, 0));
      playerTextureArray.push(getPlayerTexture(i, 1));
    } else if (i === 4) {
      playerTextureArray.push(getPlayerTexture(i, 0));
    } else {
      for (let j = 0; j < 5; j++) {
        playerTextureArray.push(getPlayerTexture(i, j));
      }
    }
  }
  const sprites: AnimatedSprite[] = [];
  for (let i = 0; i < count; i++) {
    const sprite = new AnimatedSprite(playerTextureArray, false);
    sprite.anchor.x = 0.5;
    sprite.anchor.y = 0.5;
    sprites.push(sprite);
  }
  return sprites;
}

/**
 * Make animated sprite of ball
 */
function makeBallAnimatedSprites(textures: TextureDict): AnimatedSprite {
  // The original code passes 'hyper' (string) as the suffix for the hyper-ball frame.
  // Cast through unknown to allow both numeric ball variants and the special hyper key.
  const getBallTexture = (s: number | string): Texture =>
    getTexture(textures, TEXTURES.BALL(s as number));
  const ballTextureArray = [
    getBallTexture(0),
    getBallTexture(1),
    getBallTexture(2),
    getBallTexture(3),
    getBallTexture(4),
    getBallTexture('hyper'),
  ];
  const ballAnimatedSprite = new AnimatedSprite(ballTextureArray, false);

  ballAnimatedSprite.anchor.x = 0.5;
  ballAnimatedSprite.anchor.y = 0.5;

  return ballAnimatedSprite;
}

/**
 * Make sprite with the texture on the path and with the given anchor x, y
 */
function makeSpriteWithAnchorXY(
  textures: TextureDict,
  path: string,
  anchorX: number,
  anchorY: number,
): Sprite {
  const sprite = new Sprite(getTexture(textures, path));
  sprite.anchor.x = anchorX;
  sprite.anchor.y = anchorY;
  return sprite;
}

interface ScoreBoardSprite {
  container: Container;
  units: AnimatedSprite;
  tens: AnimatedSprite;
}

/**
 * Make a score board container.
 * Returns the container plus typed references to its `units` (child 0) and `tens` (child 1) animated sprites.
 */
function makeScoreBoardSprite(textures: TextureDict): ScoreBoardSprite {
  const getNumberTexture = (n: number): Texture => getTexture(textures, TEXTURES.NUMBER(n));
  const numberTextureArray: Texture[] = [];
  for (let i = 0; i < 10; i++) {
    numberTextureArray.push(getNumberTexture(i));
  }
  const units = new AnimatedSprite(numberTextureArray, false);
  const tens = new AnimatedSprite(numberTextureArray, false);

  const scoreBoard = new Container();
  addChildToParentAndSetLocalPosition(scoreBoard, units, 32, 0); // for units
  addChildToParentAndSetLocalPosition(scoreBoard, tens, 0, 0); // for tens

  scoreBoard.setChildIndex(units, 0); // for units
  scoreBoard.setChildIndex(tens, 1); // for tens

  return { container: scoreBoard, units, tens };
}

interface CloudOrWaveContainer {
  container: Container;
  sprites: Sprite[];
}

/**
 * Make a container with cloud sprites
 */
function makeCloudContainer(textures: TextureDict): CloudOrWaveContainer {
  const container = new Container();
  const texture = getTexture(textures, TEXTURES.CLOUD);
  const sprites: Sprite[] = [];
  for (let i = 0; i < NUM_OF_CLOUDS; i++) {
    const cloud = new Sprite(texture);
    cloud.anchor.x = 0;
    cloud.anchor.y = 0;
    container.addChild(cloud);
    sprites.push(cloud);
  }
  return { container, sprites };
}

/**
 * Make a container with wave sprites. `groundWidth` controls how many 16-px
 * wave tiles are laid down, matching the {@link Wave.yCoords} array length.
 */
function makeWaveContainer(textures: TextureDict, groundWidth: number = 432): CloudOrWaveContainer {
  const container = new Container();
  const texture = getTexture(textures, TEXTURES.WAVE);
  const sprites: Sprite[] = [];
  const tileCount = (groundWidth / 16) | 0;
  for (let i = 0; i < tileCount; i++) {
    const tile = new Sprite(texture);
    addChildToParentAndSetLocalPosition(container, tile, 16 * i, 0);
    sprites.push(tile);
  }
  return { container, sprites };
}

/**
 * Add child to parent and set local position
 */
function addChildToParentAndSetLocalPosition(
  parent: Container,
  child: Sprite,
  x: number,
  y: number,
): void {
  parent.addChild(child);
  child.anchor.x = 0;
  child.anchor.y = 0;
  child.x = x;
  child.y = y;
}

/**
 * Get frame number for player animated sprite corresponds to the player state
 *
 * number of frames for state 0, state 1 and state 2 is 5 for each.
 * number of frames for state 3 is 2.
 * number of frames for state 4 is 1.
 * number of frames for state 5, state 6 is 5 for each.
 */
function getFrameNumberForPlayerAnimatedSprite(state: number, frameNumber: number): number {
  if (state < 4) {
    return 5 * state + frameNumber;
  } else if (state === 4) {
    return 17 + frameNumber;
  }
  // state > 4
  return 18 + 5 * (state - 5) + frameNumber;
}
