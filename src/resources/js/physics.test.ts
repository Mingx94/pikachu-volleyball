import { beforeEach, describe, expect, it } from 'vitest';
import { PikaPhysics, PikaUserInput } from './physics.js';
import { setCustomRng } from './rand.js';
import { mulberry32 } from './replay.js';

const neutralInputs = (): [PikaUserInput, PikaUserInput] => [
  new PikaUserInput(),
  new PikaUserInput(),
];

beforeEach(() => {
  setCustomRng(mulberry32(0xdead_beef));
});

describe('PikaPhysics — determinism hook', () => {
  it('produces identical state given the same seed and same inputs', () => {
    const inputs = neutralInputs();

    setCustomRng(mulberry32(42));
    const a = new PikaPhysics(true, true);
    for (let i = 0; i < 100; i++) a.runEngineForNextFrame(inputs);

    setCustomRng(mulberry32(42));
    const b = new PikaPhysics(true, true);
    for (let i = 0; i < 100; i++) b.runEngineForNextFrame(inputs);

    expect(a.ball).toEqual(b.ball);
    expect(a.player1).toEqual(b.player1);
    expect(a.player2).toEqual(b.player2);
  });
});

describe('PikaPhysics — free-fall serve', () => {
  it('player-1 serve: ball starts at (56, 0) with yVelocity=1', () => {
    const physics = new PikaPhysics(false, false);
    expect(physics.ball.x).toBe(56);
    expect(physics.ball.y).toBe(0);
    expect(physics.ball.yVelocity).toBe(1);
  });

  // Free-fall under gravity: y_n = n*(n+1)/2 with yVelocity_n = n.
  // After 20 frames: y = 210, yVelocity = 21. Frame 21's projected y
  // would be 231, which lands inside player 1's collision box (y in
  // [212, 276]) — so the ball never reaches the ground in a clean serve.
  it('passive serve: ball collides with player 1 at frame 21 and bounces', () => {
    const physics = new PikaPhysics(false, false);
    const inputs = neutralInputs();

    for (let i = 0; i < 20; i++) physics.runEngineForNextFrame(inputs);
    expect(physics.ball.x).toBe(56);
    expect(physics.ball.y).toBe(210);
    expect(physics.ball.yVelocity).toBe(21);

    physics.runEngineForNextFrame(inputs);
    // ball lands on player 1; yVelocity negated, xVelocity from offset
    expect(physics.ball.x).toBe(56);
    expect(physics.ball.y).toBe(231);
    expect(physics.ball.xVelocity).toBe(6); // (|56 - 36| / 3) | 0
    expect(physics.ball.yVelocity).toBe(-22); // negated, |yVel| >= 15
    expect(physics.ball.isPowerHit).toBe(false);
    expect(physics.player1.isCollisionWithBallHappened).toBe(true);
  });
});

describe('PikaPhysics — preserved quirks (load-bearing)', () => {
  // docs/engine/01-world-and-ball.md §6
  // When fineRotation lands on exactly 50, neither bounds branch fires
  // (strict < / >), so rotation = (50 / 10) | 0 = 5 — the hyper-ball sprite
  // index. This is the original 1997 glitch; intentionally preserved.
  it('Hyper Ball Glitch: fineRotation == 50 selects rotation 5', () => {
    const physics = new PikaPhysics(false, false);
    physics.ball.fineRotation = 49;
    physics.ball.xVelocity = 2; // futureFineRotation = 49 + (2/2|0) = 50

    physics.runEngineForNextFrame(neutralInputs());

    expect(physics.ball.fineRotation).toBe(50);
    expect(physics.ball.rotation).toBe(5);
  });

  // docs/engine/01-world-and-ball.md §4
  // Left wall bounces at ball edge (x < BALL_RADIUS = 20);
  // right wall bounces at ball center (x > GROUND_WIDTH = 432).
  // The asymmetry exists in the original; documented as possibly intentional
  // to keep the AI's predictor loop terminating.
  it('Wall asymmetry: left bounces at ball edge', () => {
    const physics = new PikaPhysics(false, false);
    physics.ball.x = 21;
    physics.ball.y = 100;
    physics.ball.xVelocity = -2; // futureBallX = 19 < 20 → bounce
    physics.ball.yVelocity = 0;

    physics.runEngineForNextFrame(neutralInputs());

    expect(physics.ball.xVelocity).toBe(2);
  });

  it('Wall asymmetry: ball at center x=432 still does NOT bounce off right wall', () => {
    const physics = new PikaPhysics(false, false);
    physics.ball.x = 430;
    physics.ball.y = 100;
    physics.ball.xVelocity = 2; // futureBallX = 432 → NOT > 432 → no bounce
    physics.ball.yVelocity = 0;

    physics.runEngineForNextFrame(neutralInputs());

    expect(physics.ball.xVelocity).toBe(2); // unchanged
  });

  it('Wall asymmetry: only x > 432 triggers right-wall bounce', () => {
    const physics = new PikaPhysics(false, false);
    physics.ball.x = 431;
    physics.ball.y = 100;
    physics.ball.xVelocity = 2; // futureBallX = 433 > 432 → bounce
    physics.ball.yVelocity = 0;

    physics.runEngineForNextFrame(neutralInputs());

    expect(physics.ball.xVelocity).toBe(-2);
  });

  // docs/engine/01-world-and-ball.md §5 + §8
  // Real physics uses `ball.y <= 192` for the net-pillar-top branch:
  //   if (ball.y <= NET_PILLAR_TOP_BOTTOM_Y_COORD)  → vertical bounce (top of pillar)
  //   else                                          → horizontal push (side of pillar)
  // The AI predictor (calculateExpectedLandingPointXFor) uses `<` instead of
  // `<=` — a documented original-game inconsistency. We pin the real-physics
  // boundary value here; if `<=` is changed to `<`, this test fails and
  // forces the change to be reviewed against the predictor.
  it('Net pillar top edge: ball.y == 192 takes the vertical-bounce branch', () => {
    const physics = new PikaPhysics(false, false);
    physics.ball.x = 210; // |210 - 216| = 6 < 25 → inside net column
    physics.ball.y = 192; // exactly NET_PILLAR_TOP_BOTTOM_Y_COORD
    physics.ball.xVelocity = 0;
    physics.ball.yVelocity = 5;

    physics.runEngineForNextFrame(neutralInputs());

    // top-branch: yVelocity negated, then +1 from end-of-tick gravity
    expect(physics.ball.yVelocity).toBe(-4);
    expect(physics.ball.y).toBe(187); // 192 + (-5)
    expect(physics.ball.xVelocity).toBe(0); // unchanged
  });

  it('Net pillar side: ball.y == 193 takes the horizontal-push branch', () => {
    const physics = new PikaPhysics(false, false);
    physics.ball.x = 210; // ball is on the LEFT of net center → pushed left
    physics.ball.y = 193; // 1 below NET_PILLAR_TOP_BOTTOM_Y_COORD
    physics.ball.xVelocity = 5;
    physics.ball.yVelocity = 5;

    physics.runEngineForNextFrame(neutralInputs());

    // side-branch: ball.x < 216 → xVelocity = -|5|; yVelocity untouched (then +1)
    expect(physics.ball.xVelocity).toBe(-5);
    expect(physics.ball.yVelocity).toBe(6); // 5 + 1 from gravity
  });
});
