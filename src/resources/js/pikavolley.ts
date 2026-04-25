/**
 * The Controller part in MVC pattern
 */
import type { Container, Spritesheet } from 'pixi.js';
import type { Sound } from '@pixi/sound';
import { GROUND_HALF_WIDTH, PikaPhysics, type SoundEvent } from './physics.js';
import { MenuView, GameView, FadeInOut, IntroView } from './view.js';
import { PikaKeyboard } from './keyboard.js';
import { PikaAudio } from './audio.js';

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
  keyboardArray: [PikaKeyboard, PikaKeyboard];

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

  /** 0: with computer, 1: with friend */
  selectedWithWho = 0;

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

  private _isPracticeMode = false;

  /** The game state which is being rendered now */
  state: GameState;

  /**
   * Create a Pikachu Volleyball game which includes physics, view, audio
   * @param stage container that the application's renderer draws each tick
   * @param sheet loaded spritesheet
   * @param sounds map keyed by sound URL → loaded `Sound`
   */
  constructor(stage: Container, sheet: Spritesheet, sounds: Record<string, Sound>) {
    this.view = {
      intro: new IntroView(sheet),
      menu: new MenuView(sheet),
      game: new GameView(sheet),
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
    this.physics = new PikaPhysics(true, true);
    this.keyboardArray = [
      new PikaKeyboard('KeyD', 'KeyG', 'KeyR', 'KeyV', 'KeyZ', 'KeyF'), // for player1
      new PikaKeyboard(
        // for player2
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
        'Enter',
      ),
    ];

    this.state = this.intro;
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
    this.keyboardArray[0].getInput();
    this.keyboardArray[1].getInput();
    this.state();
  }

  /** Intro: a man with a brief case */
  intro(): void {
    if (this.frameCounter === 0) {
      this.view.intro.visible = true;
      this.view.fadeInOut.setBlackAlphaTo(0);
      this.audio.sounds.bgm.stop();
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

  /** Menu: select who do you want to play. With computer? With friend? */
  menu(): void {
    if (this.frameCounter === 0) {
      this.view.menu.visible = true;
      this.view.fadeInOut.setBlackAlphaTo(0);
      this.selectedWithWho = 0;
      this.view.menu.selectWithWho(this.selectedWithWho);
    }
    this.view.menu.drawFightMessage(this.frameCounter);
    this.view.menu.drawSachisoft(this.frameCounter);
    this.view.menu.drawSittingPikachuTiles(this.frameCounter);
    this.view.menu.drawPikachuVolleyballMessage(this.frameCounter);
    this.view.menu.drawPokemonMessage(this.frameCounter);
    this.view.menu.drawWithWhoMessages(this.frameCounter);
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

    if (
      (this.keyboardArray[0].yDirection === -1 || this.keyboardArray[1].yDirection === -1) &&
      this.selectedWithWho === 1
    ) {
      this.noInputFrameCounter = 0;
      this.selectedWithWho = 0;
      this.view.menu.selectWithWho(this.selectedWithWho);
      this.audio.sounds.pi.play();
    } else if (
      (this.keyboardArray[0].yDirection === 1 || this.keyboardArray[1].yDirection === 1) &&
      this.selectedWithWho === 0
    ) {
      this.noInputFrameCounter = 0;
      this.selectedWithWho = 1;
      this.view.menu.selectWithWho(this.selectedWithWho);
      this.audio.sounds.pi.play();
    } else {
      this.noInputFrameCounter++;
    }

    if (this.keyboardArray[0].powerHit === 1 || this.keyboardArray[1].powerHit === 1) {
      if (this.selectedWithWho === 1) {
        this.physics.player1.isComputer = false;
        this.physics.player2.isComputer = false;
      } else {
        if (this.keyboardArray[0].powerHit === 1) {
          this.physics.player1.isComputer = false;
          this.physics.player2.isComputer = true;
        } else if (this.keyboardArray[1].powerHit === 1) {
          this.physics.player1.isComputer = true;
          this.physics.player2.isComputer = false;
        }
      }
      this.audio.sounds.pikachu.play();
      this.frameCounter = 0;
      this.noInputFrameCounter = 0;
      this.state = this.afterMenuSelection;
      return;
    }

    if (this.noInputFrameCounter >= this.noInputFrameTotal.menu) {
      this.physics.player1.isComputer = true;
      this.physics.player2.isComputer = true;
      this.frameCounter = 0;
      this.noInputFrameCounter = 0;
      this.state = this.afterMenuSelection;
    }
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
      this.view.game.visible = true;
      this.gameEnded = false;
      this.roundEnded = false;
      this.isPlayer2Serve = false;
      this.physics.player1.gameEnded = false;
      this.physics.player1.isWinner = false;
      this.physics.player2.gameEnded = false;
      this.physics.player2.isWinner = false;

      this.scores[0] = 0;
      this.scores[1] = 0;
      this.view.game.drawScoresToScoreBoards(this.scores);

      this.physics.player1.initializeForNewRound();
      this.physics.player2.initializeForNewRound();
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
    const pressedPowerHit =
      this.keyboardArray[0].powerHit === 1 || this.keyboardArray[1].powerHit === 1;

    if (
      this.physics.player1.isComputer === true &&
      this.physics.player2.isComputer === true &&
      pressedPowerHit
    ) {
      this.frameCounter = 0;
      this.view.game.visible = false;
      this.state = this.intro;
      return;
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
      if (this.physics.ball.punchEffectX < GROUND_HALF_WIDTH) {
        this.isPlayer2Serve = true;
        this.scores[1] += 1;
        if (this.scores[1] >= this.winningScore) {
          this.gameEnded = true;
          this.physics.player1.isWinner = false;
          this.physics.player2.isWinner = true;
          this.physics.player1.gameEnded = true;
          this.physics.player2.gameEnded = true;
        }
      } else {
        this.isPlayer2Serve = false;
        this.scores[0] += 1;
        if (this.scores[0] >= this.winningScore) {
          this.gameEnded = true;
          this.physics.player1.isWinner = true;
          this.physics.player2.isWinner = false;
          this.physics.player1.gameEnded = true;
          this.physics.player2.gameEnded = true;
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

      this.physics.player1.initializeForNewRound();
      this.physics.player2.initializeForNewRound();
      this.physics.ball.initializeForNewRound(this.isPlayer2Serve);
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
    this.view.menu.visible = false;
    this.view.game.visible = false;
    this.state = this.intro;
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
