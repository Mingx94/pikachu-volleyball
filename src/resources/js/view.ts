/**
 * The View part in the MVC pattern
 *
 * Some codes in this module were gained by reverse engineering the original machine code.
 * The codes gained by reverse engineering are commented by the address of the function referred to in the machine code.
 * ex) FUN_00405d50 means the function at the address 00405d50 in the machine code.
 */
import { AnimatedSprite, Container, Sprite, Spritesheet, Texture } from 'pixi.js';
import { Cloud, Wave, cloudAndWaveEngine } from './cloud_and_wave.js';
import { ASSETS_PATH } from './assets_path.js';
import type { PikaPhysics } from './physics.js';

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
   */
  constructor(sheet: Spritesheet) {
    const textures = getSheetTextures(sheet);

    this.mark = makeSpriteWithAnchorXY(textures, TEXTURES.MARK, 0.5, 0.5);
    this.mark.x = 432 / 2;
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
}

/**
 * Class representing menu view where you can select "play with computer" or "play with friend"
 */
export class MenuView {
  messages: MenuMessages;
  sittingPikachuTilesContainer: Container;
  container: Container;
  sittingPikachuTilesDisplacement = 0;
  /** 0: with computer, 1: with friend, -1: not selected */
  selectedWithWho = -1;
  selectedWithWhoMessageSizeIncrement = 2;

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
    this.container.addChild(this.messages.withWho[0]);
    this.container.addChild(this.messages.withWho[1]);
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
}

interface GameViewMessages {
  gameStart: Sprite;
  ready: Sprite;
  gameEnd: Sprite;
}

interface GameViewShadows {
  forPlayer1: Sprite;
  forPlayer2: Sprite;
  forBall: Sprite;
}

interface ScoreBoardChildren {
  units: AnimatedSprite;
  tens: AnimatedSprite;
}

/**
 * Class represent a game view where pikachus, ball, clouds, waves, and backgrounds are
 */
export class GameView {
  bgContainer: Container;
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

  constructor(sheet: Spritesheet) {
    const textures = getSheetTextures(sheet);

    // Display objects below
    this.bgContainer = makeBGContainer(textures);
    const playerSprites = makePlayerAnimatedSprites(textures);
    this.player1 = playerSprites[0];
    this.player2 = playerSprites[1];
    this.ball = makeBallAnimatedSprites(textures);
    this.ballHyper = makeSpriteWithAnchorXY(textures, TEXTURES.BALL_HYPER, 0.5, 0.5);
    this.ballTrail = makeSpriteWithAnchorXY(textures, TEXTURES.BALL_TRAIL, 0.5, 0.5);
    this.punch = makeSpriteWithAnchorXY(textures, TEXTURES.BALL_PUNCH, 0.5, 0.5);

    // this.scoreBoards[0] for player1, this.scoreBoards[1] for player2
    const board1 = makeScoreBoardSprite(textures);
    const board2 = makeScoreBoardSprite(textures);
    this.scoreBoards = [board1.container, board2.container];
    this.scoreBoardChildren = [
      { units: board1.units, tens: board1.tens },
      { units: board2.units, tens: board2.tens },
    ];

    this.shadows = {
      forPlayer1: makeSpriteWithAnchorXY(textures, TEXTURES.SHADOW, 0.5, 0.5),
      forPlayer2: makeSpriteWithAnchorXY(textures, TEXTURES.SHADOW, 0.5, 0.5),
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
    const wave = makeWaveContainer(textures);
    this.waveContainer = wave.container;
    this.waveSprites = wave.sprites;

    // container which include whole display objects
    // Should be careful on addChild order
    // The later added, the more front(z-index) on screen
    this.container = new Container();
    this.container.addChild(this.bgContainer);
    this.container.addChild(this.cloudContainer);
    this.container.addChild(this.waveContainer);
    this.container.addChild(this.shadows.forPlayer1);
    this.container.addChild(this.shadows.forPlayer2);
    this.container.addChild(this.shadows.forBall);
    this.container.addChild(this.player1);
    this.container.addChild(this.player2);
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

    this.messages.ready.x = 176;
    this.messages.ready.y = 38;
    this.scoreBoards[0].x = 14; // score board is 14 pixel distant from boundary
    this.scoreBoards[0].y = 10;
    this.scoreBoards[1].x = 432 - 32 - 32 - 14; // 32 pixel is for number (32x32px) width; one score board has two numbers
    this.scoreBoards[1].y = 10;

    this.shadows.forPlayer1.y = 273;
    this.shadows.forPlayer2.y = 273;
    this.shadows.forBall.y = 273;

    this.initializeVisibles();

    // clouds and wave model.
    // This model is included in this view object, not on controller object
    // since it is not dependent on user input, and only used for rendering.
    this.cloudArray = [];
    for (let i = 0; i < NUM_OF_CLOUDS; i++) {
      this.cloudArray.push(new Cloud());
    }
    this.wave = new Wave();
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
    const player1 = physics.player1;
    const player2 = physics.player2;
    const ball = physics.ball;

    this.player1.x = player1.x;
    this.player1.y = player1.y;
    if (player1.state === 3 || player1.state === 4) {
      this.player1.scale.x = player1.divingDirection === -1 ? -1 : 1;
    } else {
      this.player1.scale.x = 1;
    }
    this.shadows.forPlayer1.x = player1.x;

    this.player2.x = player2.x;
    this.player2.y = player2.y;
    if (player2.state === 3 || player2.state === 4) {
      this.player2.scale.x = player2.divingDirection === 1 ? 1 : -1;
    } else {
      this.player2.scale.x = -1;
    }
    this.shadows.forPlayer2.x = player2.x;

    const frameNumber1 = getFrameNumberForPlayerAnimatedSprite(player1.state, player1.frameNumber);
    const frameNumber2 = getFrameNumberForPlayerAnimatedSprite(player2.state, player2.frameNumber);
    this.player1.gotoAndStop(frameNumber1);
    this.player2.gotoAndStop(frameNumber2);

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

    for (let i = 0; i < 432 / 16; i++) {
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
    gameStartMessage.x = 216 - halfWidth;
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
    if (frameCounter < 50) {
      const halfWidthIncrement = 2 * Math.floor(((50 - frameCounter) * w) / 50);
      const halfHeightIncrement = 2 * Math.floor(((50 - frameCounter) * h) / 50);

      gameEndMessage.x = 216 - w / 2 - halfWidthIncrement;
      gameEndMessage.y = 50 - halfHeightIncrement;
      gameEndMessage.width = w + 2 * halfWidthIncrement;
      gameEndMessage.height = h + 2 * halfHeightIncrement;
    } else {
      gameEndMessage.x = 216 - w / 2;
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

  constructor(sheet: Spritesheet) {
    const textures = getSheetTextures(sheet);
    this.black = makeSpriteWithAnchorXY(textures, TEXTURES.BLACK, 0, 0);
    this.black.width = 432;
    this.black.height = 304;
    this.black.x = 0;
    this.black.y = 0;
    this.black.alpha = 1;
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
 * Make sitting pikachu tiles
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
 * Make background
 */
function makeBGContainer(textures: TextureDict): Container {
  const bgContainer = new Container();

  // sky
  let texture = getTexture(textures, TEXTURES.SKY_BLUE);
  for (let j = 0; j < 12; j++) {
    for (let i = 0; i < 432 / 16; i++) {
      const tile = new Sprite(texture);
      addChildToParentAndSetLocalPosition(bgContainer, tile, 16 * i, 16 * j);
    }
  }

  // mountain
  texture = getTexture(textures, TEXTURES.MOUNTAIN);
  addChildToParentAndSetLocalPosition(bgContainer, new Sprite(texture), 0, 188);

  // ground_red
  texture = getTexture(textures, TEXTURES.GROUND_RED);
  for (let i = 0; i < 432 / 16; i++) {
    const tile = new Sprite(texture);
    addChildToParentAndSetLocalPosition(bgContainer, tile, 16 * i, 248);
  }

  // ground_line
  texture = getTexture(textures, TEXTURES.GROUND_LINE);
  for (let i = 1; i < 432 / 16 - 1; i++) {
    const tile = new Sprite(texture);
    addChildToParentAndSetLocalPosition(bgContainer, tile, 16 * i, 264);
  }
  texture = getTexture(textures, TEXTURES.GROUND_LINE_LEFT_MOST);
  addChildToParentAndSetLocalPosition(bgContainer, new Sprite(texture), 0, 264);
  texture = getTexture(textures, TEXTURES.GROUND_LINE_RIGHT_MOST);
  addChildToParentAndSetLocalPosition(bgContainer, new Sprite(texture), 432 - 16, 264);

  // ground_yellow
  texture = getTexture(textures, TEXTURES.GROUND_YELLOW);
  for (let j = 0; j < 2; j++) {
    for (let i = 0; i < 432 / 16; i++) {
      const tile = new Sprite(texture);
      addChildToParentAndSetLocalPosition(bgContainer, tile, 16 * i, 280 + 16 * j);
    }
  }

  // net pillar
  texture = getTexture(textures, TEXTURES.NET_PILLAR_TOP);
  addChildToParentAndSetLocalPosition(bgContainer, new Sprite(texture), 213, 176);
  texture = getTexture(textures, TEXTURES.NET_PILLAR);
  for (let j = 0; j < 12; j++) {
    const tile = new Sprite(texture);
    addChildToParentAndSetLocalPosition(bgContainer, tile, 213, 184 + 8 * j);
  }

  return bgContainer;
}

/**
 * Make animated sprites for both players
 * @return [0] for player 1, [1] for player2
 */
function makePlayerAnimatedSprites(textures: TextureDict): [AnimatedSprite, AnimatedSprite] {
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
  const player1AnimatedSprite = new AnimatedSprite(playerTextureArray, false);
  const player2AnimatedSprite = new AnimatedSprite(playerTextureArray, false);

  player1AnimatedSprite.anchor.x = 0.5;
  player1AnimatedSprite.anchor.y = 0.5;
  player2AnimatedSprite.anchor.x = 0.5;
  player2AnimatedSprite.anchor.y = 0.5;

  return [player1AnimatedSprite, player2AnimatedSprite];
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
 * Make a container with wave sprites
 */
function makeWaveContainer(textures: TextureDict): CloudOrWaveContainer {
  const container = new Container();
  const texture = getTexture(textures, TEXTURES.WAVE);
  const sprites: Sprite[] = [];
  for (let i = 0; i < 432 / 16; i++) {
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
