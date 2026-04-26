import { beforeEach, describe, expect, it } from 'vitest';
import { Cloud, Wave, cloudAndWaveEngine } from './cloud_and_wave.js';
import { PikaPhysics, PikaUserInput } from './physics.js';
import { rand, setCustomRng } from './rand.js';
import {
  buildReplay,
  deserializeReplay,
  mulberry32,
  type Replay,
  type ReplayInputFrame,
  type SerializedInput,
  runReplay,
  runReplayStreaming,
  serializeReplay,
  snapshotInputs,
} from './replay.js';

beforeEach(() => {
  setCustomRng(mulberry32(0xdead_beef));
});

const NEUTRAL: SerializedInput = { xDirection: 0, yDirection: 0, powerHit: 0 };

function neutralFrames(n: number): Replay['frames'] {
  return Array.from({ length: n }, () => [NEUTRAL, NEUTRAL] as const);
}

describe('replay round-trip', () => {
  it('runReplay reproduces a live engine run', () => {
    const replay: Replay = {
      version: 1,
      seed: 12_345,
      isPlayer1Computer: true,
      isPlayer2Computer: true,
      frames: neutralFrames(150),
    };

    // Live run, same seed + same inputs
    setCustomRng(mulberry32(replay.seed));
    const live = new PikaPhysics(replay.isPlayer1Computer, replay.isPlayer2Computer);
    for (const [a, b] of replay.frames) {
      const liveInputs: [PikaUserInput, PikaUserInput] = [new PikaUserInput(), new PikaUserInput()];
      Object.assign(liveInputs[0], a);
      Object.assign(liveInputs[1], b);
      live.runEngineForNextFrame(liveInputs);
    }

    const replayed = runReplay(replay);

    expect(replayed.ball).toEqual(live.ball);
    expect(replayed.player1).toEqual(live.player1);
    expect(replayed.player2).toEqual(live.player2);
  });

  it('survives JSON serialize/deserialize', () => {
    const original: Replay = {
      version: 1,
      seed: 7,
      isPlayer1Computer: false,
      isPlayer2Computer: false,
      frames: [
        [NEUTRAL, NEUTRAL],
        [{ xDirection: 1, yDirection: 0, powerHit: 0 }, NEUTRAL],
        [{ xDirection: 1, yDirection: -1, powerHit: 1 }, NEUTRAL],
        ...neutralFrames(20),
      ],
    };

    const json = serializeReplay(original);
    const restored = deserializeReplay(json);

    expect(restored).toEqual(original);
    expect(runReplay(restored).ball).toEqual(runReplay(original).ball);
  });

  it('rejects replays with unknown schema version', () => {
    const bad = JSON.stringify({ version: 999, seed: 0, frames: [] });
    expect(() => deserializeReplay(bad)).toThrow(/Unsupported replay/);
  });
});

// Scripted player-1 input over 80 frames: idle 10, walk right 10, jump 1,
// mid-air drift right 5, power-hit 1, settle. Player 2 is computer.
const player1Script = (i: number): { x: -1 | 0 | 1; y: -1 | 0 | 1; hit: 0 | 1 } => {
  if (i < 10) return { x: 0, y: 0, hit: 0 };
  if (i < 20) return { x: 1, y: 0, hit: 0 };
  if (i === 20) return { x: 0, y: -1, hit: 0 };
  if (i < 25) return { x: 1, y: 0, hit: 0 };
  if (i === 25) return { x: 1, y: 0, hit: 1 };
  return { x: 0, y: 0, hit: 0 };
};

describe('controller-pattern recording', () => {
  // Mirrors what pikavolley.ts does inside `round()`:
  //   if (recordingFrames !== null) recordingFrames.push(snapshotInputs(keyboardArray));
  //   physics.runEngineForNextFrame(keyboardArray);
  // and stopRecording() then calls buildReplay(). This pins that the
  // controller's record path produces a Replay that round-trips through
  // runReplay() to bit-identical state.
  it('snapshotting inputs each tick produces a faithful Replay', () => {
    const seed = 0xc0_ff_ee;
    setCustomRng(mulberry32(seed));
    const physics = new PikaPhysics(false, true);

    // PikaUserInput stand-ins for the controller's keyboardArray
    const live: [PikaUserInput, PikaUserInput] = [new PikaUserInput(), new PikaUserInput()];
    const recordingFrames: ReplayInputFrame[] = [];

    for (let i = 0; i < 80; i++) {
      const { x, y, hit } = player1Script(i);
      live[0].xDirection = x;
      live[0].yDirection = y;
      live[0].powerHit = hit;
      // player 2 stays neutral; AI overwrites it inside the engine

      recordingFrames.push(snapshotInputs(live));
      physics.runEngineForNextFrame(live);
    }

    const replay = buildReplay({
      seed,
      isPlayer1Computer: physics.player1.isComputer,
      isPlayer2Computer: physics.player2.isComputer,
      frames: recordingFrames,
    });

    const replayed = runReplay(replay);

    expect(replayed.ball).toEqual(physics.ball);
    expect(replayed.player1).toEqual(physics.player1);
    expect(replayed.player2).toEqual(physics.player2);
  });
});

describe('controller-pattern playback', () => {
  // Mirrors what pikavolley.ts does inside `round()`:
  //   if (replayFrames !== null) Object.assign(keyboardArray[0], frame[0]); ...
  //   physics.runEngineForNextFrame(keyboardArray);
  // Asserts the live override-then-tick path is bit-identical to runReplay,
  // which is the contract that lets startReplay reuse the same Replay artifact.
  it('overriding live keyboardArray each tick matches runReplay', () => {
    const replay: Replay = {
      version: 1,
      seed: 0xfeed_face,
      isPlayer1Computer: false,
      isPlayer2Computer: true,
      frames: Array.from({ length: 60 }, (_, i) => {
        const p1: SerializedInput =
          i === 30 ? { xDirection: 0, yDirection: -1, powerHit: 1 } : NEUTRAL;
        return [p1, NEUTRAL] as const;
      }),
    };

    const engineOnly = runReplay(replay);

    setCustomRng(mulberry32(replay.seed));
    const physics = new PikaPhysics(replay.isPlayer1Computer, replay.isPlayer2Computer);
    const live: [PikaUserInput, PikaUserInput] = [new PikaUserInput(), new PikaUserInput()];
    for (const [a, b] of replay.frames) {
      Object.assign(live[0], a);
      Object.assign(live[1], b);
      physics.runEngineForNextFrame(live);
    }

    expect(physics.ball).toEqual(engineOnly.ball);
    expect(physics.player1).toEqual(engineOnly.player1);
    expect(physics.player2).toEqual(engineOnly.player2);
  });
});

describe('runReplayStreaming generator', () => {
  it('frame-by-frame consumption ends at the same state as runReplay()', () => {
    const replay: Replay = {
      version: 1,
      seed: 0xbeef,
      isPlayer1Computer: true,
      isPlayer2Computer: true,
      frames: neutralFrames(50),
    };

    let lastFromStream: ReturnType<typeof runReplay> | undefined;
    let frameCount = 0;
    for (const state of runReplayStreaming(replay)) {
      lastFromStream = state;
      frameCount++;
    }
    const fromRunReplay = runReplay(replay);

    expect(frameCount).toBe(50);
    expect(lastFromStream?.ball).toEqual(fromRunReplay.ball);
    expect(lastFromStream?.player1).toEqual(fromRunReplay.player1);
    expect(lastFromStream?.player2).toEqual(fromRunReplay.player2);
  });

  it('early break does not throw or leak state into the next replay', () => {
    const replay: Replay = {
      version: 1,
      seed: 1,
      isPlayer1Computer: true,
      isPlayer2Computer: true,
      frames: neutralFrames(20),
    };

    let consumed = 0;
    expect(() => {
      for (const _state of runReplayStreaming(replay)) {
        consumed++;
        if (consumed === 5) break;
      }
    }).not.toThrow();
    expect(consumed).toBe(5);

    // Subsequent full replay should still work and match runReplay semantics
    const fresh = runReplay(replay);
    expect(fresh).toBeDefined();
  });
});

describe('multi-round replay', () => {
  // Pikavolley calls Player.initializeForNewRound() once per round (in
  // beforeStartOfNextRound), consuming 2 rand calls. Without `roundReInits`
  // markers, runReplay's per-frame tick path stays "in round 1" forever and
  // the rand sequence diverges starting at round 2's first physics tick.
  // This test sets up a 2-round scenario and asserts that:
  //   1. Without roundReInits → state diverges
  //   2. With roundReInits at the right frame → bit-perfect match
  it('roundReInits markers reproduce inter-round rand consumption', () => {
    const seed = 0xa11_ce;
    const ROUND1_FRAMES = 30;
    const ROUND2_FRAMES = 30;
    const totalFrames = ROUND1_FRAMES + ROUND2_FRAMES;

    // "Live" path: tick 30 frames, do an inter-round reInit (matching what
    // beforeStartOfNextRound does in pikavolley), tick 30 more.
    setCustomRng(mulberry32(seed));
    const live = new PikaPhysics(true, true);
    const liveInputs: [PikaUserInput, PikaUserInput] = [new PikaUserInput(), new PikaUserInput()];
    for (let i = 0; i < ROUND1_FRAMES; i++) live.runEngineForNextFrame(liveInputs);
    live.player1.initializeForNewRound();
    live.player2.initializeForNewRound();
    live.ball.initializeForNewRound(true);
    for (let i = 0; i < ROUND2_FRAMES; i++) live.runEngineForNextFrame(liveInputs);

    const baseReplayArgs = {
      seed,
      isPlayer1Computer: true,
      isPlayer2Computer: true,
      frames: neutralFrames(totalFrames),
    };

    // Without markers — should diverge from live (negative control)
    const broken = runReplay(buildReplay(baseReplayArgs));
    expect(broken.player1.computerBoldness).not.toBe(live.player1.computerBoldness);

    // With marker at the round boundary — should match
    const fixed = runReplay(
      buildReplay({
        ...baseReplayArgs,
        roundReInits: [{ atFrame: ROUND1_FRAMES, isPlayer2Serve: true }],
      }),
    );
    expect(fixed.ball).toEqual(live.ball);
    expect(fixed.player1).toEqual(live.player1);
    expect(fixed.player2).toEqual(live.player2);
  });

  it('finalScores is preserved as pure metadata', () => {
    const replay = buildReplay({
      seed: 1,
      isPlayer1Computer: false,
      isPlayer2Computer: false,
      frames: neutralFrames(3),
      finalScores: [15, 7] as const,
    });
    expect(replay.finalScores).toEqual([15, 7]);
    // runReplay must not throw on it and must not depend on it
    const ran = runReplay(replay);
    expect(ran).toBeDefined();
  });

  it('buildReplay omits roundReInits when empty (clean single-round JSON)', () => {
    const single = buildReplay({
      seed: 1,
      isPlayer1Computer: false,
      isPlayer2Computer: false,
      frames: neutralFrames(5),
    });
    expect(single).not.toHaveProperty('roundReInits');

    const multi = buildReplay({
      seed: 1,
      isPlayer1Computer: false,
      isPlayer2Computer: false,
      frames: neutralFrames(5),
      roundReInits: [{ atFrame: 3, isPlayer2Serve: false }],
    });
    expect(multi.roundReInits).toEqual([{ atFrame: 3, isPlayer2Serve: false }]);
  });
});

describe('cloud/wave RNG isolation', () => {
  // Pikavolley's controller calls drawCloudsAndWave() every tick of
  // startOfNewGame, round(), and beforeStartOfNextRound(). startReplay()
  // skips the 71-tick startOfNewGame fade-in. If cloud/wave shared the
  // seeded `rand()`, those skipped ticks would leave the AI's RNG state
  // off by ~71 * 27 = ~1900 calls at round-frame 0, and replay playback
  // would diverge from recording. These tests pin that cloud/wave uses an
  // independent rng so the seeded sequence stays stable regardless of how
  // many cloud/wave ticks occur around it.
  it('cloudAndWaveEngine does not consume seeded rand', () => {
    setCustomRng(mulberry32(0x12_34_56));
    const baseline = [rand(), rand(), rand(), rand(), rand()];

    setCustomRng(mulberry32(0x12_34_56));
    const clouds: Cloud[] = Array.from({ length: 10 }, () => new Cloud());
    const wave = new Wave();
    for (let i = 0; i < 200; i++) cloudAndWaveEngine(clouds, wave);
    const afterCloudWave = [rand(), rand(), rand(), rand(), rand()];

    expect(afterCloudWave).toEqual(baseline);
  });

  it('Cloud constructor does not consume seeded rand', () => {
    setCustomRng(mulberry32(0x42));
    const baseline = [rand(), rand(), rand()];

    setCustomRng(mulberry32(0x42));
    const sink: Cloud[] = [];
    for (let i = 0; i < 10; i++) sink.push(new Cloud());
    expect(sink).toHaveLength(10);
    const after = [rand(), rand(), rand()];

    expect(after).toEqual(baseline);
  });

  // Mirrors the actual production bug: the controller records frames during
  // `round()` while drawCloudsAndWave runs every tick, then startReplay
  // skips startOfNewGame. If cloud/wave was on the seeded rng this test
  // would fail because the AI's recorded inputs were captured against a
  // different rng trajectory than the one runReplay reproduces.
  it('runReplay matches a controller-style record path that interleaves cloud/wave', () => {
    const seed = 0xab_cd;
    const FRAMES = 200;

    setCustomRng(mulberry32(seed));
    const recPhysics = new PikaPhysics(true, false);
    const clouds: Cloud[] = Array.from({ length: 10 }, () => new Cloud());
    const wave = new Wave();
    // Simulate startOfNewGame's 71 cloud/wave ticks
    for (let i = 0; i < 71; i++) cloudAndWaveEngine(clouds, wave);

    const recFrames: ReplayInputFrame[] = [];
    const live: [PikaUserInput, PikaUserInput] = [new PikaUserInput(), new PikaUserInput()];
    for (let i = 0; i < FRAMES; i++) {
      // Player 2 jitters to make the recording have non-trivial input
      live[1].xDirection = (i % 5) - 2 > 0 ? 1 : -1;
      live[1].powerHit = i === 50 ? 1 : 0;
      recFrames.push(snapshotInputs(live));
      recPhysics.runEngineForNextFrame(live);
      cloudAndWaveEngine(clouds, wave);
    }

    const replay = buildReplay({
      seed,
      isPlayer1Computer: true,
      isPlayer2Computer: false,
      frames: recFrames,
    });
    const replayed = runReplay(replay);

    expect(replayed.ball).toEqual(recPhysics.ball);
    expect(replayed.player1).toEqual(recPhysics.player1);
    expect(replayed.player2).toEqual(recPhysics.player2);
  });
});

describe('replay records non-trivial player input', () => {
  // Scripted serve: jump on frame 1, power-hit on frame 4 (mid-jump).
  // Pins the full keyboard → physics path through a Replay artifact.
  it('player-1 jumps and power-hits to scripted timing', () => {
    const jump: SerializedInput = { xDirection: 0, yDirection: -1, powerHit: 0 };
    const hit: SerializedInput = { xDirection: 0, yDirection: 0, powerHit: 1 };

    const replay: Replay = {
      version: 1,
      seed: 1,
      isPlayer1Computer: false,
      isPlayer2Computer: false,
      frames: [
        [jump, NEUTRAL],
        [NEUTRAL, NEUTRAL],
        [NEUTRAL, NEUTRAL],
        [hit, NEUTRAL],
        ...neutralFrames(10),
      ],
    };

    const physics = runReplay(replay);

    // After scripted jump+hit, player 1 should be airborne (state 1 or 2)
    // and not lying down (state 4) or fallen back to ground (state 0).
    expect([1, 2]).toContain(physics.player1.state);
    expect(physics.player1.y).toBeLessThan(244); // PLAYER_TOUCHING_GROUND_Y_COORD
  });
});
