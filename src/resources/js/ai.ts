/**
 * Computer AI for Pikachu Volleyball.
 *
 * Decides the user input for a player controlled by computer based on the game
 * situation (the player itself, the ball, and the other player). Originally
 * lived inside physics.ts, but is logically a Controller-layer concern (it
 * decides an input that is then fed into the physics engine), so it is split
 * into its own module.
 *
 * The AI is called from inside {@link physics.processPlayerMovementAndSetPlayerPosition}
 * during the per-player loop in physicsEngine, so the timing relative to
 * {@link physics.calculateExpectedLandingPointXFor} is preserved exactly.
 *
 * Functions in this file are reverse-engineered from the original 1997 game.
 * The address of each function in the original machine code is in the comment
 * above each function (e.g. FUN_00402360).
 */
import type { Ball, PikaUserInput, Player } from './physics.js';
import {
  BALL_RADIUS,
  BALL_TOUCHING_GROUND_Y_COORD,
  GROUND_HALF_WIDTH,
  GROUND_WIDTH,
  INFINITE_LOOP_LIMIT,
  NET_PILLAR_HALF_WIDTH,
  NET_PILLAR_TOP_TOP_Y_COORD,
  PLAYER_HALF_LENGTH,
  PLAYER_LENGTH,
} from './physics.js';
import { rand } from './rand.js';

/**
 * FUN_00402360
 * Computer controls its player by this function.
 * Computer decides the user input for the player it controls,
 * according to the game situation it figures out
 * by the given parameters (player, ball and theOtherPlayer),
 * and reflects these to the given user input object.
 *
 * @param player The player whom computer controls
 * @param ball ball
 * @param theOtherPlayer The other player
 * @param userInput user input of the player whom computer controls
 */
export function letComputerDecideUserInput(
  player: Player,
  ball: Ball,
  theOtherPlayer: Player,
  userInput: PikaUserInput,
): void {
  userInput.xDirection = 0;
  userInput.yDirection = 0;
  userInput.powerHit = 0;

  let virtualExpectedLandingPointX = ball.expectedLandingPointX;
  if (Math.abs(ball.x - player.x) > 100 && Math.abs(ball.xVelocity) < player.computerBoldness + 5) {
    const leftBoundary = Number(player.isPlayer2) * GROUND_HALF_WIDTH;
    if (
      (ball.expectedLandingPointX <= leftBoundary ||
        ball.expectedLandingPointX >=
          Number(player.isPlayer2) * GROUND_WIDTH + GROUND_HALF_WIDTH) &&
      player.computerWhereToStandBy === 0
    ) {
      // If conditions above met, the computer estimates the proper location to stay as the middle point of their side
      virtualExpectedLandingPointX = leftBoundary + ((GROUND_HALF_WIDTH / 2) | 0);
    }
  }

  if (Math.abs(virtualExpectedLandingPointX - player.x) > player.computerBoldness + 8) {
    if (player.x < virtualExpectedLandingPointX) {
      userInput.xDirection = 1;
    } else {
      userInput.xDirection = -1;
    }
  } else if (rand() % 20 === 0) {
    player.computerWhereToStandBy = rand() % 2;
  }

  if (player.state === 0) {
    if (
      Math.abs(ball.xVelocity) < player.computerBoldness + 3 &&
      Math.abs(ball.x - player.x) < PLAYER_HALF_LENGTH &&
      ball.y > -36 &&
      ball.y < 10 * player.computerBoldness + 84 &&
      ball.yVelocity > 0
    ) {
      userInput.yDirection = -1;
    }

    const leftBoundary = Number(player.isPlayer2) * GROUND_HALF_WIDTH;
    const rightBoundary = (Number(player.isPlayer2) + 1) * GROUND_HALF_WIDTH;
    if (
      ball.expectedLandingPointX > leftBoundary &&
      ball.expectedLandingPointX < rightBoundary &&
      Math.abs(ball.x - player.x) > player.computerBoldness * 5 + PLAYER_LENGTH &&
      ball.x > leftBoundary &&
      ball.x < rightBoundary &&
      ball.y > 174
    ) {
      // If conditions above met, the computer decides to dive!
      userInput.powerHit = 1;
      if (player.x < ball.x) {
        userInput.xDirection = 1;
      } else {
        userInput.xDirection = -1;
      }
    }
  } else if (player.state === 1 || player.state === 2) {
    if (Math.abs(ball.x - player.x) > 8) {
      if (player.x < ball.x) {
        userInput.xDirection = 1;
      } else {
        userInput.xDirection = -1;
      }
    }
    if (Math.abs(ball.x - player.x) < 48 && Math.abs(ball.y - player.y) < 48) {
      const willInputPowerHit = decideWhetherInputPowerHit(player, ball, theOtherPlayer, userInput);
      if (willInputPowerHit === true) {
        userInput.powerHit = 1;
        if (Math.abs(theOtherPlayer.x - player.x) < 80 && userInput.yDirection !== -1) {
          userInput.yDirection = -1;
        }
      }
    }
  }
}

/**
 * FUN_00402630
 * This function is called by {@link letComputerDecideUserInput},
 * and also sets x and y direction user input so that it participate in
 * the decision of the direction of power hit.
 *
 * @return Will input power hit?
 */
function decideWhetherInputPowerHit(
  player: Player,
  ball: Ball,
  theOtherPlayer: Player,
  userInput: PikaUserInput,
): boolean {
  if (rand() % 2 === 0) {
    for (let xDirection = 1; xDirection > -1; xDirection--) {
      for (let yDirection = -1; yDirection < 2; yDirection++) {
        const expectedLandingPointX = expectedLandingPointXWhenPowerHit(
          xDirection,
          yDirection,
          ball,
        );
        if (
          (expectedLandingPointX <= Number(player.isPlayer2) * GROUND_HALF_WIDTH ||
            expectedLandingPointX >= Number(player.isPlayer2) * GROUND_WIDTH + GROUND_HALF_WIDTH) &&
          Math.abs(expectedLandingPointX - theOtherPlayer.x) > PLAYER_LENGTH
        ) {
          userInput.xDirection = xDirection;
          userInput.yDirection = yDirection;
          return true;
        }
      }
    }
  } else {
    for (let xDirection = 1; xDirection > -1; xDirection--) {
      for (let yDirection = 1; yDirection > -2; yDirection--) {
        const expectedLandingPointX = expectedLandingPointXWhenPowerHit(
          xDirection,
          yDirection,
          ball,
        );
        if (
          (expectedLandingPointX <= Number(player.isPlayer2) * GROUND_HALF_WIDTH ||
            expectedLandingPointX >= Number(player.isPlayer2) * GROUND_WIDTH + GROUND_HALF_WIDTH) &&
          Math.abs(expectedLandingPointX - theOtherPlayer.x) > PLAYER_LENGTH
        ) {
          userInput.xDirection = xDirection;
          userInput.yDirection = yDirection;
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * FUN_00402870
 * This function is called by {@link decideWhetherInputPowerHit},
 * and calculates the expected x coordinate of the landing point of the ball
 * when power hit
 *
 * @return x coord of expected landing point when power hit the ball
 */
function expectedLandingPointXWhenPowerHit(
  userInputXDirection: number,
  userInputYDirection: number,
  ball: Ball,
): number {
  const copyBall = {
    x: ball.x,
    y: ball.y,
    xVelocity: ball.xVelocity,
    yVelocity: ball.yVelocity,
  };
  if (copyBall.x < GROUND_HALF_WIDTH) {
    copyBall.xVelocity = (Math.abs(userInputXDirection) + 1) * 10;
  } else {
    copyBall.xVelocity = -(Math.abs(userInputXDirection) + 1) * 10;
  }
  copyBall.yVelocity = Math.abs(copyBall.yVelocity) * userInputYDirection * 2;

  let loopCounter = 0;
  while (true) {
    loopCounter++;

    const futureCopyBallX = copyBall.x + copyBall.xVelocity;
    if (futureCopyBallX < BALL_RADIUS || futureCopyBallX > GROUND_WIDTH) {
      copyBall.xVelocity = -copyBall.xVelocity;
    }
    if (copyBall.y + copyBall.yVelocity < 0) {
      copyBall.yVelocity = 1;
    }
    if (
      Math.abs(copyBall.x - GROUND_HALF_WIDTH) < NET_PILLAR_HALF_WIDTH &&
      copyBall.y > NET_PILLAR_TOP_TOP_Y_COORD
    ) {
      /*
        The code below maybe is intended to make computer do mistakes.
        The player controlled by computer occasionally power hit ball that is bounced back by the net pillar,
        since code below do not anticipate the bounce back.
      */
      if (copyBall.yVelocity > 0) {
        copyBall.yVelocity = -copyBall.yVelocity;
      }
      /*
      An alternative code for making the computer not do those mistakes is as below.

      if (copyBall.y <= NET_PILLAR_TOP_BOTTOM_Y_COORD) {
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
      */
    }
    copyBall.y = copyBall.y + copyBall.yVelocity;
    if (copyBall.y > BALL_TOUCHING_GROUND_Y_COORD || loopCounter >= INFINITE_LOOP_LIMIT) {
      return copyBall.x;
    }
    copyBall.x = copyBall.x + copyBall.xVelocity;
    copyBall.yVelocity += 1;
  }
}
