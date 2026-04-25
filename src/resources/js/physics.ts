/**
 * The Model part in the MVC pattern
 *
 * It is the core module which acts as a physics engine.
 * This physics engine calculates the movements of the ball and the players (Pikachus).
 *
 * It was gained by reverse engineering the original game.
 * The address of each function in the original machine code is specified at the comment above each function.
 * ex) FUN_00403dd0 means the original function at the address 00403dd0.
 *
 *
 * ** Some useful infos below **
 *
 *  Ground width: 432 = 0x1B0
 *  Ground height: 304 = 0x130
 *
 *  X position coordinate: [0, 432], right-direction increasing
 *  Y position coordinate: [0, 304], down-direction increasing
 *
 *  Ball radius: 20 = 0x14
 *  Ball diameter: 40 = 0x28
 *
 *  Player half-width: 32 = 0x20
 *  Player half-height: 32 = 0x20
 *  Player width: 64 = 0x40
 *  Player height: 64 = 0x40
 *
 */
import { letComputerDecideUserInput } from './ai.js';
import { rand } from './rand.js';

/** ground width */
export const GROUND_WIDTH = 432;
/** ground half-width, it is also the net pillar x coordinate */
export const GROUND_HALF_WIDTH = (GROUND_WIDTH / 2) | 0; // integer division
/** player (Pikachu) length: width = height = 64 */
export const PLAYER_LENGTH = 64;
/** player half length */
export const PLAYER_HALF_LENGTH = (PLAYER_LENGTH / 2) | 0; // integer division
/** player's y coordinate when they are touching ground */
const PLAYER_TOUCHING_GROUND_Y_COORD = 244;
/** ball's radius */
export const BALL_RADIUS = 20;
/** ball's y coordinate when it is touching ground */
export const BALL_TOUCHING_GROUND_Y_COORD = 252;
/** net pillar's half width (this value is on this physics engine only, not on the sprite pixel size) */
export const NET_PILLAR_HALF_WIDTH = 25;
/** net pillar top's top side y coordinate */
export const NET_PILLAR_TOP_TOP_Y_COORD = 176;
/** net pillar top's bottom side y coordinate (this value is on this physics engine only) */
const NET_PILLAR_TOP_BOTTOM_Y_COORD = 192;

/**
 * It's for to limit the looping number of the infinite loops.
 * This constant is not in the original machine code. (The original machine code does not limit the looping number.)
 *
 * In the original ball x coord range setting (ball x coord in [20, 432]), the infinite loops in
 * {@link calculateExpectedLandingPointXFor} function and the AI's expectedLandingPointXWhenPowerHit
 * function seems to be always terminated soon.
 * But if the ball x coord range is edited, for example, to [20, 432 - 20] for left-right symmetry,
 * it is observed that the infinite loop in expectedLandingPointXWhenPowerHit does not terminate.
 * So for safety, this infinite loop limit is included for the infinite loops mentioned above.
 */
export const INFINITE_LOOP_LIMIT = 1000;

/**
 * Sound events emitted during a single physics tick.
 *
 * The engine pushes these in the order they occur. Player sounds carry the
 * player index (0 for player1, 1 for player2) so the consumer can pan stereo;
 * ball sounds carry the ball x at the moment of emission for the same reason.
 */
export type SoundEvent =
  | { kind: 'pipikachu' | 'pika' | 'chu'; playerSide: 0 | 1 }
  | { kind: 'powerHit' | 'ballTouchesGround'; x: number };

/** Result of one {@link physicsEngine} tick. */
export interface PhysicsTickResult {
  isBallTouchingGround: boolean;
  sounds: SoundEvent[];
}

/**
 * Class representing a pack of physical objects i.e. players and ball
 * whose physical values are calculated and set by {@link physicsEngine} function
 */
export class PikaPhysics {
  player1: Player;
  player2: Player;
  ball: Ball;

  /**
   * Create a physics pack
   * @param isPlayer1Computer Is player on the left (player 1) controlled by computer?
   * @param isPlayer2Computer Is player on the right (player 2) controlled by computer?
   */
  constructor(isPlayer1Computer: boolean, isPlayer2Computer: boolean) {
    this.player1 = new Player(false, isPlayer1Computer);
    this.player2 = new Player(true, isPlayer2Computer);
    this.ball = new Ball(false);
  }

  /**
   * run {@link physicsEngine} function with this physics object and user input
   *
   * @param userInputArray userInputArray[0]: PikaUserInput object for player 1, userInputArray[1]: PikaUserInput object for player 2
   */
  runEngineForNextFrame(userInputArray: PikaUserInput[]): PhysicsTickResult {
    return physicsEngine(this.player1, this.player2, this.ball, userInputArray);
  }
}

/**
 * Class (or precisely, Interface) representing user input (from keyboard or joystick, whatever)
 */
export class PikaUserInput {
  /** 0: no horizontal-direction input, -1: left-direction input, 1: right-direction input */
  xDirection = 0;
  /** 0: no vertical-direction input, -1: up-direction input, 1: down-direction input */
  yDirection = 0;
  /** 0: auto-repeated or no power hit input, 1: not auto-repeated power hit input */
  powerHit = 0;
}

/**
 * Class representing a player
 *
 * Player 1 property address: 00411F28 -> +28 -> +10 -> +C -> ...
 * Player 2 property address: 00411F28 -> +28 -> +10 -> +10 -> ...
 * The "..." part is written on the line comment at the right side of each property.
 * e.g. address to player1.isPlayer: 00411F28 -> +28 -> +10 -> +C -> +A0
 * e.g. address to player2.isComputer: 00411F28 -> +28 -> +10 -> +10 -> +A4
 *
 * For initial values: refer to FUN_000403a90 && FUN_00401f40
 */
export class Player {
  /** Is this player on the right side? */
  isPlayer2: boolean; // 0xA0
  /** Is controlled by computer? */
  isComputer: boolean; // 0xA4
  /** -1: left, 0: no diving, 1: right */
  divingDirection = 0; // 0xB4
  lyingDownDurationLeft = -1; // 0xB8
  isWinner = false; // 0xD0
  gameEnded = false; // 0xD4

  /**
   * It flips randomly to 0 or 1 by the {@link letComputerDecideUserInput} function (FUN_00402360)
   * when ball is hanging around on the other player's side.
   * If it is 0, computer player stands by around the middle point of their side.
   * If it is 1, computer player stands by adjacent to the net.
   * 0 or 1
   */
  computerWhereToStandBy = 0; // 0xDC

  // Fields reinitialized in initializeForNewRound; defaults are placeholders.
  /** x coord */
  x = 0; // 0xA8
  /** y coord */
  y = 0; // 0xAC
  /** y direction velocity */
  yVelocity = 0; // 0xB0
  isCollisionWithBallHappened = false; // 0xBC

  /**
   * Player's state
   * 0: normal, 1: jumping, 2: jumping_and_power_hitting, 3: diving
   * 4: lying_down_after_diving
   * 5: win!, 6: lost..
   * 0, 1, 2, 3, 4, 5 or 6
   */
  state = 0; // 0xC0
  frameNumber = 0; // 0xC4
  normalStatusArmSwingDirection = 1; // 0xC8
  delayBeforeNextFrame = 0; // 0xCC

  /**
   * This value is initialized to (_rand() % 5) before the start of every round.
   * The greater the number, the bolder the computer player.
   *
   * If computer has higher boldness,
   * judges more the ball is hanging around the other player's side,
   * has greater distance to the expected landing point of the ball,
   * jumps more,
   * and dives less.
   * See the source code of the {@link letComputerDecideUserInput} function (FUN_00402360).
   *
   * 0, 1, 2, 3 or 4
   */
  computerBoldness = 0; // 0xD8

  /**
   * create a player
   * @param isPlayer2 Is this player on the right side?
   * @param isComputer Is this player controlled by computer?
   */
  constructor(isPlayer2: boolean, isComputer: boolean) {
    this.isPlayer2 = isPlayer2; // 0xA0
    this.isComputer = isComputer; // 0xA4
    this.initializeForNewRound();
  }

  /**
   * initialize for new round
   */
  initializeForNewRound(): void {
    this.x = 36; // 0xA8 // initialized to 36 (player1) or 396 (player2)
    if (this.isPlayer2) {
      this.x = GROUND_WIDTH - 36;
    }
    this.y = PLAYER_TOUCHING_GROUND_Y_COORD; // 0xAC   // initialized to 244
    this.yVelocity = 0; // 0xB0  // initialized to 0
    this.isCollisionWithBallHappened = false; // 0xBC   // initialized to 0 i.e false

    this.state = 0; // 0xC0   // initialized to 0
    this.frameNumber = 0; // 0xC4   // initialized to 0
    this.normalStatusArmSwingDirection = 1; // 0xC8  // initialized to 1
    this.delayBeforeNextFrame = 0; // 0xCC  // initialized to 0

    this.computerBoldness = rand() % 5; // 0xD8  // initialized to (_rand() % 5)
  }
}

/**
 * Class representing a ball
 *
 * Ball property address: 00411F28 -> +28 -> +10 -> +14 -> ...
 * The "..." part is written on the line comment at the right side of each property.
 * e.g. address to ball.fineRotation: 00411F28 -> +28 -> +10 -> +14 -> +48
 *
 * For initial Values: refer to FUN_000403a90 && FUN_00402d60
 */
export class Ball {
  /** x coord of expected landing point */
  expectedLandingPointX = 0; // 0x40
  /**
   * ball rotation frame number selector
   * During the period where it continues to be 5, hyper ball glitch occur.
   * 0, 1, 2, 3, 4 or 5
   */
  rotation = 0; // 0x44
  fineRotation = 0; // 0x48
  /** x coord for punch effect */
  punchEffectX = 0; // 0x50
  /** y coord for punch effect */
  punchEffectY = 0; // 0x54

  /** Following previous values are for trailing effect for power hit */
  previousX = 0; // 0x58
  previousPreviousX = 0; // 0x5c
  previousY = 0; // 0x60
  previousPreviousY = 0; // 0x64

  // Fields reinitialized in initializeForNewRound; defaults are placeholders.
  /** x coord */
  x = 0; // 0x30
  /** y coord */
  y = 0; // 0x34
  /** x direction velocity */
  xVelocity = 0; // 0x38
  /** y direction velocity */
  yVelocity = 1; // 0x3C
  /** punch effect radius */
  punchEffectRadius = 0; // 0x4c
  /** is power hit */
  isPowerHit = false; // 0x68

  /**
   * Create a ball
   * @param isPlayer2Serve Will player 2 serve on this new round?
   */
  constructor(isPlayer2Serve: boolean) {
    this.initializeForNewRound(isPlayer2Serve);
  }

  /**
   * Initialize for new round
   * @param isPlayer2Serve will player on the right side serve on this new round?
   */
  initializeForNewRound(isPlayer2Serve: boolean): void {
    this.x = 56; // 0x30    // initialized to 56 or 376
    if (isPlayer2Serve === true) {
      this.x = GROUND_WIDTH - 56;
    }
    this.y = 0; // 0x34   // initialized to 0
    this.xVelocity = 0; // 0x38  // initialized to 0
    this.yVelocity = 1; // 0x3C  // initialized to 1
    this.punchEffectRadius = 0; // 0x4c // initialized to 0
    this.isPowerHit = false; // 0x68  // initialized to 0 i.e. false
  }
}

/**
 * FUN_00403dd0
 * This is the Pikachu Volleyball physics engine!
 * This physics engine calculates and set the physics values for the next frame.
 *
 * @param player1 player on the left side
 * @param player2 player on the right side
 * @param ball ball
 * @param userInputArray userInputArray[0]: user input for player 1, userInputArray[1]: user input for player 2
 */
function physicsEngine(
  player1: Player,
  player2: Player,
  ball: Ball,
  userInputArray: PikaUserInput[],
): PhysicsTickResult {
  const sounds: SoundEvent[] = [];
  const isBallTouchingGround = processCollisionBetweenBallAndWorldAndSetBallPosition(ball, sounds);

  let player: Player;
  let theOtherPlayer: Player;
  for (let i = 0; i < 2; i++) {
    if (i === 0) {
      player = player1;
      theOtherPlayer = player2;
    } else {
      player = player2;
      theOtherPlayer = player1;
    }

    // FUN_00402d90 omitted
    // FUN_00402810 omitted
    // this javascript code is refactored not to need above two function except for
    // a part of FUN_00402d90:
    // FUN_00402d90 include FUN_004031b0(calculateExpectedLandingPointXFor)
    calculateExpectedLandingPointXFor(ball); // calculate expected_X;

    const userInput = userInputArray[i];
    if (userInput === undefined) continue;
    processPlayerMovementAndSetPlayerPosition(player, userInput, theOtherPlayer, ball, sounds);

    // FUN_00402830 omitted
    // FUN_00406020 omitted
    // These two functions omitted above maybe participate in graphic drawing for a player
  }

  for (let i = 0; i < 2; i++) {
    if (i === 0) {
      player = player1;
    } else {
      player = player2;
    }

    // FUN_00402810 omitted: this javascript code is refactored not to need this function

    const isHappened = isCollisionBetweenBallAndPlayerHappened(ball, player.x, player.y);
    if (isHappened === true) {
      if (player.isCollisionWithBallHappened === false) {
        const userInput = userInputArray[i];
        if (userInput !== undefined) {
          processCollisionBetweenBallAndPlayer(ball, player.x, userInput, player.state, sounds);
          player.isCollisionWithBallHappened = true;
        }
      }
    } else {
      player.isCollisionWithBallHappened = false;
    }
  }

  // FUN_00403040
  // FUN_00406020
  // These two functions omitted above maybe participate in graphic drawing for a player

  return { isBallTouchingGround, sounds };
}

/**
 * FUN_00403070
 * Is collision between ball and player happened?
 */
function isCollisionBetweenBallAndPlayerHappened(
  ball: Ball,
  playerX: number,
  playerY: number,
): boolean {
  let diff = ball.x - playerX;
  if (Math.abs(diff) <= PLAYER_HALF_LENGTH) {
    diff = ball.y - playerY;
    if (Math.abs(diff) <= PLAYER_HALF_LENGTH) {
      return true;
    }
  }
  return false;
}

/**
 * FUN_00402dc0
 * Process collision between ball and world and set ball position
 * @return Is ball touching ground?
 */
function processCollisionBetweenBallAndWorldAndSetBallPosition(
  ball: Ball,
  sounds: SoundEvent[],
): boolean {
  // This is not part of this function in the original assembly code.
  // In the original assembly code, it is processed in other function (FUN_00402ee0)
  // But it is proper to process here.
  ball.previousPreviousX = ball.previousX;
  ball.previousPreviousY = ball.previousY;
  ball.previousX = ball.x;
  ball.previousY = ball.y;

  // "(ball.xVelocity / 2) | 0" is integer division by 2
  let futureFineRotation = ball.fineRotation + ((ball.xVelocity / 2) | 0);
  // If futureFineRotation === 50, it skips next if statement finely.
  // Then ball.fineRotation = 50, and then ball.rotation = 5 (which designates hyper ball sprite!).
  // In this way, hyper ball glitch occur!
  // If this happen at the end of round,
  // since ball.xVelocity is 0-initialized at each start of round,
  // hyper ball sprite is rendered continuously until a collision happens.
  if (futureFineRotation < 0) {
    futureFineRotation += 50;
  } else if (futureFineRotation > 50) {
    futureFineRotation += -50;
  }
  ball.fineRotation = futureFineRotation;
  ball.rotation = (ball.fineRotation / 10) | 0; // integer division

  const futureBallX = ball.x + ball.xVelocity;
  /*
    If the center of ball would get out of left world bound or right world bound, bounce back.

    In this if statement, when considering left-right symmetry,
    "futureBallX > GROUND_WIDTH" should be changed to "futureBallX > (GROUND_WIDTH - BALL_RADIUS)",
    or "futureBallX < BALL_RADIUS" should be changed to "futureBallX < 0".
    Maybe the former one is more proper when seeing Pikachu player's x-direction boundary.
    Is this a mistake of the author of the original game?
    Or, was it set to this value to resolve infinite loop problem? (See comments on the constant INFINITE_LOOP_LIMIT.)
    If apply (futureBallX > (GROUND_WIDTH - BALL_RADIUS)), and if the maximum number of loop is not limited,
    it is observed that infinite loop in the function expectedLandingPointXWhenPowerHit does not terminate.
  */
  if (futureBallX < BALL_RADIUS || futureBallX > GROUND_WIDTH) {
    ball.xVelocity = -ball.xVelocity;
  }

  let futureBallY = ball.y + ball.yVelocity;
  // if the center of ball would get out of upper world bound
  if (futureBallY < 0) {
    ball.yVelocity = 1;
  }

  // If ball touches net
  if (
    Math.abs(ball.x - GROUND_HALF_WIDTH) < NET_PILLAR_HALF_WIDTH &&
    ball.y > NET_PILLAR_TOP_TOP_Y_COORD
  ) {
    if (ball.y <= NET_PILLAR_TOP_BOTTOM_Y_COORD) {
      if (ball.yVelocity > 0) {
        ball.yVelocity = -ball.yVelocity;
      }
    } else {
      if (ball.x < GROUND_HALF_WIDTH) {
        ball.xVelocity = -Math.abs(ball.xVelocity);
      } else {
        ball.xVelocity = Math.abs(ball.xVelocity);
      }
    }
  }

  futureBallY = ball.y + ball.yVelocity;
  // if ball would touch ground
  if (futureBallY > BALL_TOUCHING_GROUND_Y_COORD) {
    // FUN_00408470 omitted
    // the function omitted above receives 100 * (ball.x - 216),
    // i.e. horizontal displacement from net maybe for stereo sound?
    // code function (ballpointer + 0x28 + 0x10)? omitted
    // the omitted two functions maybe do a part of sound playback role.
    sounds.push({ kind: 'ballTouchesGround', x: ball.x });

    ball.yVelocity = -ball.yVelocity;
    ball.punchEffectX = ball.x;
    ball.y = BALL_TOUCHING_GROUND_Y_COORD;
    ball.punchEffectRadius = BALL_RADIUS;
    ball.punchEffectY = BALL_TOUCHING_GROUND_Y_COORD + BALL_RADIUS;
    return true;
  }
  ball.y = futureBallY;
  ball.x = ball.x + ball.xVelocity;
  ball.yVelocity += 1;

  return false;
}

/**
 * FUN_00401fc0
 * Process player movement according to user input and set player position
 */
function processPlayerMovementAndSetPlayerPosition(
  player: Player,
  userInput: PikaUserInput,
  theOtherPlayer: Player,
  ball: Ball,
  sounds: SoundEvent[],
): void {
  const playerSide: 0 | 1 = player.isPlayer2 ? 1 : 0;
  if (player.isComputer === true) {
    letComputerDecideUserInput(player, ball, theOtherPlayer, userInput);
  }

  // if player is lying down.. don't move
  if (player.state === 4) {
    player.lyingDownDurationLeft += -1;
    if (player.lyingDownDurationLeft < -1) {
      player.state = 0;
    }
    return;
  }

  // process x-direction movement
  let playerVelocityX = 0;
  if (player.state < 5) {
    if (player.state < 3) {
      playerVelocityX = userInput.xDirection * 6;
    } else {
      // player.state === 3 i.e. player is diving..
      playerVelocityX = player.divingDirection * 8;
    }
  }

  const futurePlayerX = player.x + playerVelocityX;
  player.x = futurePlayerX;

  // process player's x-direction world boundary
  if (player.isPlayer2 === false) {
    // if player is player1
    if (futurePlayerX < PLAYER_HALF_LENGTH) {
      player.x = PLAYER_HALF_LENGTH;
    } else if (futurePlayerX > GROUND_HALF_WIDTH - PLAYER_HALF_LENGTH) {
      player.x = GROUND_HALF_WIDTH - PLAYER_HALF_LENGTH;
    }
  } else {
    // if player is player2
    if (futurePlayerX < GROUND_HALF_WIDTH + PLAYER_HALF_LENGTH) {
      player.x = GROUND_HALF_WIDTH + PLAYER_HALF_LENGTH;
    } else if (futurePlayerX > GROUND_WIDTH - PLAYER_HALF_LENGTH) {
      player.x = GROUND_WIDTH - PLAYER_HALF_LENGTH;
    }
  }

  // jump
  if (
    player.state < 3 &&
    userInput.yDirection === -1 && // up-direction input
    player.y === PLAYER_TOUCHING_GROUND_Y_COORD // player is touching on the ground
  ) {
    player.yVelocity = -16;
    player.state = 1;
    player.frameNumber = 0;
    // maybe-stereo-sound function FUN_00408470 (0x90) omitted:
    // refer to a detailed comment above about this function
    // maybe-sound code function (playerpointer + 0x90 + 0x10)? omitted
    sounds.push({ kind: 'chu', playerSide });
  }

  // gravity
  const futurePlayerY = player.y + player.yVelocity;
  player.y = futurePlayerY;
  if (futurePlayerY < PLAYER_TOUCHING_GROUND_Y_COORD) {
    player.yVelocity += 1;
  } else if (futurePlayerY > PLAYER_TOUCHING_GROUND_Y_COORD) {
    // if player is landing..
    player.yVelocity = 0;
    player.y = PLAYER_TOUCHING_GROUND_Y_COORD;
    player.frameNumber = 0;
    if (player.state === 3) {
      // if player is diving..
      player.state = 4;
      player.frameNumber = 0;
      player.lyingDownDurationLeft = 3;
    } else {
      player.state = 0;
    }
  }

  if (userInput.powerHit === 1) {
    if (player.state === 1) {
      // if player is jumping..
      // then player do power hit!
      player.delayBeforeNextFrame = 5;
      player.frameNumber = 0;
      player.state = 2;
      // maybe-sound function (playerpointer + 0x90 + 0x18)? omitted
      // maybe-stereo-sound function FUN_00408470 (0x90) omitted:
      // refer to a detailed comment above about this function
      // maybe-sound function (playerpointer + 0x90 + 0x14)? omitted
      sounds.push({ kind: 'pika', playerSide });
    } else if (player.state === 0 && userInput.xDirection !== 0) {
      // then player do diving!
      player.state = 3;
      player.frameNumber = 0;
      player.divingDirection = userInput.xDirection;
      player.yVelocity = -5;
      // maybe-stereo-sound function FUN_00408470 (0x90) omitted:
      // refer to a detailed comment above about this function
      // maybe-sound code function (playerpointer + 0x90 + 0x10)? omitted
      sounds.push({ kind: 'chu', playerSide });
    }
  }

  if (player.state === 1) {
    player.frameNumber = (player.frameNumber + 1) % 3;
  } else if (player.state === 2) {
    if (player.delayBeforeNextFrame < 1) {
      player.frameNumber += 1;
      if (player.frameNumber > 4) {
        player.frameNumber = 0;
        player.state = 1;
      }
    } else {
      player.delayBeforeNextFrame -= 1;
    }
  } else if (player.state === 0) {
    player.delayBeforeNextFrame += 1;
    if (player.delayBeforeNextFrame > 3) {
      player.delayBeforeNextFrame = 0;
      const futureFrameNumber = player.frameNumber + player.normalStatusArmSwingDirection;
      if (futureFrameNumber < 0 || futureFrameNumber > 4) {
        player.normalStatusArmSwingDirection = -player.normalStatusArmSwingDirection;
      }
      player.frameNumber = player.frameNumber + player.normalStatusArmSwingDirection;
    }
  }

  if (player.gameEnded === true) {
    if (player.state === 0) {
      if (player.isWinner === true) {
        player.state = 5;
        // maybe-stereo-sound function FUN_00408470 (0x90) omitted:
        // refer to a detailed comment above about this function
        // maybe-sound code function (0x98 + 0x10) omitted
        sounds.push({ kind: 'pipikachu', playerSide });
      } else {
        player.state = 6;
      }
      player.delayBeforeNextFrame = 0;
      player.frameNumber = 0;
    }
    processGameEndFrameFor(player);
  }
}

/**
 * FUN_004025e0
 * Process game end frame (for winner and loser motions) for the given player
 */
function processGameEndFrameFor(player: Player): void {
  if (player.gameEnded === true && player.frameNumber < 4) {
    player.delayBeforeNextFrame += 1;
    if (player.delayBeforeNextFrame > 4) {
      player.delayBeforeNextFrame = 0;
      player.frameNumber += 1;
    }
  }
}

/**
 * FUN_004030a0
 * Process collision between ball and player.
 * This function only sets velocity of ball and expected landing point x of ball.
 * This function does not set position of ball.
 * The ball position is set by {@link processCollisionBetweenBallAndWorldAndSetBallPosition} function
 */
function processCollisionBetweenBallAndPlayer(
  ball: Ball,
  playerX: number,
  userInput: PikaUserInput,
  playerState: number,
  sounds: SoundEvent[],
): void {
  // playerX is pika's x position
  // if collision occur,
  // greater the x position difference between pika and ball,
  // greater the x velocity of the ball.
  if (ball.x < playerX) {
    // Since javascript division is float division by default,
    // Here we use "| 0" to do integer division (refer to: https://stackoverflow.com/a/17218003/8581025)
    ball.xVelocity = -((Math.abs(ball.x - playerX) / 3) | 0);
  } else if (ball.x > playerX) {
    ball.xVelocity = (Math.abs(ball.x - playerX) / 3) | 0;
  }

  // If ball velocity x is 0, randomly choose one of -1, 0, 1.
  if (ball.xVelocity === 0) {
    ball.xVelocity = (rand() % 3) - 1;
  }

  const ballAbsYVelocity = Math.abs(ball.yVelocity);
  ball.yVelocity = -ballAbsYVelocity;

  if (ballAbsYVelocity < 15) {
    ball.yVelocity = -15;
  }

  // player is jumping and power hitting
  if (playerState === 2) {
    if (ball.x < GROUND_HALF_WIDTH) {
      ball.xVelocity = (Math.abs(userInput.xDirection) + 1) * 10;
    } else {
      ball.xVelocity = -(Math.abs(userInput.xDirection) + 1) * 10;
    }
    ball.punchEffectX = ball.x;
    ball.punchEffectY = ball.y;

    ball.yVelocity = Math.abs(ball.yVelocity) * userInput.yDirection * 2;
    ball.punchEffectRadius = BALL_RADIUS;
    // maybe-stereo-sound function FUN_00408470 (0x90) omitted:
    // refer to a detailed comment above about this function
    // maybe-soundcode function (ballpointer + 0x24 + 0x10) omitted:
    sounds.push({ kind: 'powerHit', x: ball.x });

    ball.isPowerHit = true;
  } else {
    ball.isPowerHit = false;
  }

  calculateExpectedLandingPointXFor(ball);
}

/**
 * FUN_004031b0
 * Calculate x coordinate of expected landing point of the ball
 */
function calculateExpectedLandingPointXFor(ball: Ball): void {
  const copyBall = {
    x: ball.x,
    y: ball.y,
    xVelocity: ball.xVelocity,
    yVelocity: ball.yVelocity,
  };
  let loopCounter = 0;
  while (true) {
    loopCounter++;

    const futureCopyBallX = copyBall.xVelocity + copyBall.x;
    if (futureCopyBallX < BALL_RADIUS || futureCopyBallX > GROUND_WIDTH) {
      copyBall.xVelocity = -copyBall.xVelocity;
    }
    if (copyBall.y + copyBall.yVelocity < 0) {
      copyBall.yVelocity = 1;
    }

    // If copy ball touches net
    if (
      Math.abs(copyBall.x - GROUND_HALF_WIDTH) < NET_PILLAR_HALF_WIDTH &&
      copyBall.y > NET_PILLAR_TOP_TOP_Y_COORD
    ) {
      // It maybe should be <= NET_PILLAR_TOP_BOTTOM_Y_COORD as in FUN_00402dc0, is it the original game author's mistake?
      if (copyBall.y < NET_PILLAR_TOP_BOTTOM_Y_COORD) {
        if (copyBall.yVelocity > 0) {
          copyBall.yVelocity = -copyBall.yVelocity;
        }
      } else {
        if (copyBall.x < GROUND_HALF_WIDTH) {
          copyBall.xVelocity = -Math.abs(copyBall.xVelocity);
        } else {
          copyBall.xVelocity = Math.abs(copyBall.xVelocity);
        }
      }
    }

    copyBall.y = copyBall.y + copyBall.yVelocity;
    // if copyBall would touch ground
    if (copyBall.y > BALL_TOUCHING_GROUND_Y_COORD || loopCounter >= INFINITE_LOOP_LIMIT) {
      break;
    }
    copyBall.x = copyBall.x + copyBall.xVelocity;
    copyBall.yVelocity += 1;
  }
  ball.expectedLandingPointX = copyBall.x;
}
