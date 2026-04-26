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

// 2v2 test setup: 2 left-team players (slots 0, 2) and 2 right-team players
// (slots 1, 3). All AI off so user inputs drive movement directly.
const make2v2 = (): PikaPhysics =>
  new PikaPhysics([
    { isPlayer2: false, isComputer: false },
    { isPlayer2: true, isComputer: false },
    { isPlayer2: false, isComputer: false },
    { isPlayer2: true, isComputer: false },
  ]);

const neutral4 = (): [PikaUserInput, PikaUserInput, PikaUserInput, PikaUserInput] => [
  new PikaUserInput(),
  new PikaUserInput(),
  new PikaUserInput(),
  new PikaUserInput(),
];

describe('PikaPhysics — 2v2 teammate collisions', () => {
  it('horizontal contact pushes both teammates apart and clamps to own half', () => {
    const physics = make2v2();
    // Place P1 (slot 0) and P3 (slot 2) on the left half at the SAME x — they
    // overlap fully. Both run "stand still" inputs → no x movement of their own.
    const p1 = physics.players[0];
    const p3 = physics.players[2];
    if (!p1 || !p3) throw new Error('expected 4 players');
    p1.x = 100;
    p3.x = 100;

    physics.runEngineForNextFrame(neutral4());

    // After resolveTeammatePair: dx=0, overlapX=64 → push half(32) each apart.
    // P1 (a, dx>=0 with sign=+1) → +32; P3 (b) → -32.
    expect(p1.x).toBe(132);
    expect(p3.x).toBe(68);
    // both still on the left half-field
    expect(p3.x).toBeGreaterThanOrEqual(32); // PLAYER_HALF_LENGTH
    // 2v2 runs on the wider court so groundHalfWidth = 288, left half ends at 256.
    expect(p1.x).toBeLessThanOrEqual(288 - 32); // groundHalfWidth - PLAYER_HALF_LENGTH
  });

  it('horizontal push clamps the loser inside the team half-field', () => {
    const physics = make2v2();
    const p1 = physics.players[0];
    const p3 = physics.players[2];
    if (!p1 || !p3) throw new Error('expected 4 players');
    // 2v2 court is 576 wide so the left team's right wall is groundHalfWidth - 32 = 256.
    const leftHalfRightEdge = 288 - 32;
    p1.x = leftHalfRightEdge; // 256 = max left-half x
    p3.x = leftHalfRightEdge - 10; // overlap of 54 in x

    physics.runEngineForNextFrame(neutral4());

    // After push, P1 hits its right wall (clamp to leftHalfRightEdge);
    // P3 stays on its side of the wall.
    expect(p1.x).toBe(leftHalfRightEdge);
    expect(p3.x).toBeLessThanOrEqual(leftHalfRightEdge);
  });

  it('falling onto teammate stacks on their head and grounds the upper player', () => {
    const physics = make2v2();
    const p1 = physics.players[0];
    const p3 = physics.players[2];
    if (!p1 || !p3) throw new Error('expected 4 players');
    // P3 grounded at default. Place P1 mid-air directly above P3, falling.
    p3.x = 100;
    p3.y = 244; // PLAYER_TOUCHING_GROUND_Y_COORD
    p1.x = 100;
    p1.y = 200;
    p1.yVelocity = 30; // already falling fast
    p1.state = 1; // jumping

    physics.runEngineForNextFrame(neutral4());

    // After step 1 movement, P1.y would have been 230 (200 + 30); the resolve
    // step snaps it to p3.y - 64 = 180.
    expect(p1.y).toBe(180);
    expect(p1.yVelocity).toBe(0);
    expect(p1.state).toBe(0); // grounded on teammate's head
    expect(p1.standingOnTeammate).toBe(true);
    expect(p3.hasPlayerOnHead).toBe(true);
    // P3 is unaffected positionally
    expect(p3.y).toBe(244);
  });

  it('player with someone on their head cannot jump', () => {
    const physics = make2v2();
    const p1 = physics.players[0];
    const p3 = physics.players[2];
    if (!p1 || !p3) throw new Error('expected 4 players');
    // Stack P1 on P3's head first
    p3.x = 100;
    p3.y = 244;
    p1.x = 100;
    p1.y = 180;
    physics.runEngineForNextFrame(neutral4()); // sets the flags
    expect(p3.hasPlayerOnHead).toBe(true);

    // Now P3 presses jump
    const inputs = neutral4();
    inputs[2].yDirection = -1;
    physics.runEngineForNextFrame(inputs);

    expect(p3.state).toBe(0); // never transitioned to jumping
    expect(p3.yVelocity).toBe(0);
    expect(p3.y).toBe(244); // still on the ground
  });

  it('player standing on teammate can jump from the head', () => {
    const physics = make2v2();
    const p1 = physics.players[0];
    const p3 = physics.players[2];
    if (!p1 || !p3) throw new Error('expected 4 players');
    p3.x = 100;
    p3.y = 244;
    p1.x = 100;
    p1.y = 180;
    physics.runEngineForNextFrame(neutral4()); // p1.standingOnTeammate becomes true
    expect(p1.standingOnTeammate).toBe(true);

    const inputs = neutral4();
    inputs[0].yDirection = -1;
    physics.runEngineForNextFrame(inputs);

    // Same dynamics as a regular jump from y=244: yVelocity gets set to -16,
    // then gravity adds +1 inside the same tick.
    expect(p1.state).toBe(1);
    expect(p1.yVelocity).toBe(-15); // -16 + 1 from end-of-tick gravity
    expect(p1.y).toBe(164); // 180 + (-16)
    // After jumping, p1 left p3's head → flags reset
    expect(p1.standingOnTeammate).toBe(false);
    expect(p3.hasPlayerOnHead).toBe(false);
  });

  it('horizontal push separates teammates before the ball-collision pass', () => {
    // Teammates at the same x get pushed apart in the resolve pass, which
    // runs BEFORE the ball-collision loop. So a ball passing through the
    // shared midpoint will be hit by exactly one teammate (the one whose
    // post-push position still overlaps the ball), not both.
    const physics = make2v2();
    const p1 = physics.players[0];
    const p3 = physics.players[2];
    const ball = physics.ball;
    if (!p1 || !p3) throw new Error('expected 4 players');
    p1.x = 100;
    p1.y = 244;
    p3.x = 100;
    p3.y = 244;
    // Ball off to the right of the post-push P1 position (132), out of range
    ball.x = 200;
    ball.y = 244;
    ball.xVelocity = 0;
    ball.yVelocity = 5;

    physics.runEngineForNextFrame(neutral4());

    // Push: P1 (a, dx >= 0) → 132, P3 → 68. Ball at 200 → |200-132|=68 > 32,
    // |200-68|=132 > 32 → neither overlaps the ball.
    expect(p1.x).toBe(132);
    expect(p3.x).toBe(68);
    expect(p1.isCollisionWithBallHappened).toBe(false);
    expect(p3.isCollisionWithBallHappened).toBe(false);
  });
});

describe('PikaPhysics — 1v1 unaffected by 2v2 plumbing', () => {
  it('hasPlayerOnHead and standingOnTeammate stay false in 1v1 (no same-team pairs)', () => {
    const physics = new PikaPhysics(false, false);
    const inputs = neutralInputs();
    for (let i = 0; i < 60; i++) physics.runEngineForNextFrame(inputs);
    expect(physics.player1.hasPlayerOnHead).toBe(false);
    expect(physics.player1.standingOnTeammate).toBe(false);
    expect(physics.player2.hasPlayerOnHead).toBe(false);
    expect(physics.player2.standingOnTeammate).toBe(false);
  });
});
