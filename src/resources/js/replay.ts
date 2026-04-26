/**
 * Frame-perfect replay primitive for the physics engine.
 *
 * The engine in {@link physics.ts} is fully deterministic: given a fixed PRNG
 * seed and a fixed sequence of {@link PikaUserInput} pairs, the resulting
 * {@link Player} / {@link Ball} state at every frame is reproducible bit-for-bit.
 * This module turns that property into a serializable artifact.
 *
 * It does NOT model the controller layer (`pikavolley.ts`) — round / score /
 * slow-motion belong to the controller, and a replay here only captures
 * physics ticks. To replay a full match, the controller would record its own
 * input stream and feed it through {@link runReplay}.
 */
import { PikaPhysics, PikaUserInput } from './physics.js';
import { setCustomRng, type RNG } from './rand.js';

/**
 * Plain-data view of {@link PikaUserInput} so a Replay survives `JSON.stringify`.
 */
export interface SerializedInput {
  xDirection: -1 | 0 | 1;
  yDirection: -1 | 0 | 1;
  powerHit: 0 | 1;
}

/**
 * A serializable record of a deterministic engine run.
 *
 * `frames[i]` is the [player1, player2] input pair fed into the engine on the
 * i-th physics tick. `seed` is the mulberry32 seed for {@link rand.setCustomRng}.
 */
/**
 * Marker for an inter-round reInit. The recorder emits one of these every
 * time `pikavolley.beforeStartOfNextRound` fires its
 * `Player.initializeForNewRound()` calls (which consume 2 seeded rand for
 * computerBoldness re-rolls). Without these markers, multi-round replays
 * diverge at round 2 because runReplay would not know to consume those
 * extra rand calls.
 */
export interface RoundReInit {
  /** Apply the reInit BEFORE running frames[atFrame]. */
  atFrame: number;
  isPlayer2Serve: boolean;
}

/**
 * One frame's worth of input. 2 inputs for 1v1 (the original schema), 4
 * inputs for 2v2. Modeled as a union of two tuple types so destructuring
 * (`for (const [a, b] of frames)`) keeps narrowing under
 * `noUncheckedIndexedAccess`.
 */
export type ReplayInputFrame =
  | readonly [SerializedInput, SerializedInput]
  | readonly [SerializedInput, SerializedInput, SerializedInput, SerializedInput];

export interface Replay {
  version: 1;
  seed: number;
  isPlayer1Computer: boolean;
  isPlayer2Computer: boolean;
  /**
   * 2v2-only AI flag for the left team's second player. Optional; defaults
   * to `true` (CPU). Old 1v1 replays don't carry this field.
   */
  isPlayer3Computer?: boolean;
  /**
   * 2v2-only AI flag for the right team's second player. Optional; defaults
   * to `true` (CPU). Old 1v1 replays don't carry this field.
   */
  isPlayer4Computer?: boolean;
  /**
   * Player count: 2 (1v1, the default) or 4 (2v2). Optional — old replays
   * recorded before 2v2 existed have no such field and are interpreted as
   * `2`. Each `frames[i]` must have length matching this.
   */
  playerCount?: 2 | 4;
  frames: ReadonlyArray<ReplayInputFrame>;
  /**
   * Optional inter-round reInit markers. Absent or empty for single-round
   * replays. Must be sorted by `atFrame` ascending.
   */
  roundReInits?: ReadonlyArray<RoundReInit>;
  /**
   * Optional final scores at the moment the recording was stopped. Pure
   * metadata — {@link runReplay} does not consume this; it's for stats /
   * leaderboards / UI summaries on top of saved replays.
   */
  finalScores?: readonly [number, number];
}

/**
 * mulberry32: 32-bit seedable PRNG returning [0, 1).
 * Used to drive {@link rand} reproducibly across replay runs.
 */
export function mulberry32(seed: number): RNG {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d_2b_79_f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function inflateInput(s: SerializedInput): PikaUserInput {
  const input = new PikaUserInput();
  input.xDirection = s.xDirection;
  input.yDirection = s.yDirection;
  input.powerHit = s.powerHit;
  return input;
}

function serializeInput(i: PikaUserInput): SerializedInput {
  return {
    xDirection: i.xDirection as -1 | 0 | 1,
    yDirection: i.yDirection as -1 | 0 | 1,
    powerHit: i.powerHit as 0 | 1,
  };
}

/**
 * Snapshot the live {@link PikaUserInput} array into a {@link ReplayInputFrame}
 * suitable for storing into a Replay. Accepts length-2 (1v1) or length-4
 * (2v2); other lengths throw — this is a controller-layer invariant, not
 * user input.
 */
export function snapshotInputs(inputs: readonly PikaUserInput[]): ReplayInputFrame {
  if (inputs.length === 2) {
    const [a, b] = inputs;
    if (a === undefined || b === undefined) {
      throw new Error('unreachable: length 2 with undefined element');
    }
    return [serializeInput(a), serializeInput(b)];
  }
  if (inputs.length === 4) {
    const [a, b, c, d] = inputs;
    if (a === undefined || b === undefined || c === undefined || d === undefined) {
      throw new Error('unreachable: length 4 with undefined element');
    }
    return [serializeInput(a), serializeInput(b), serializeInput(c), serializeInput(d)];
  }
  throw new Error(`snapshotInputs: unsupported player count ${inputs.length}`);
}

/**
 * Stream a captured engine run frame-by-frame.
 *
 * Yields the same mutable {@link PikaPhysics} instance after each tick. If a
 * caller needs per-frame history (e.g. to scrub or rewind), they must
 * `structuredClone` the yielded value — the next iteration will mutate it in
 * place. The generator's return value is the same instance after the final
 * frame.
 *
 * Early break (`break` out of `for...of`) is safe: no resources are held
 * beyond the closed-over `physics`. The PRNG remains seeded — call
 * `setCustomRng` again if you need to reset it.
 */
export function* runReplayStreaming(replay: Replay): Generator<PikaPhysics, PikaPhysics, void> {
  setCustomRng(mulberry32(replay.seed));
  const playerCount = replay.playerCount ?? 2;
  const physics =
    playerCount === 2
      ? new PikaPhysics(replay.isPlayer1Computer, replay.isPlayer2Computer)
      : new PikaPhysics([
          { isPlayer2: false, isComputer: replay.isPlayer1Computer },
          { isPlayer2: true, isComputer: replay.isPlayer2Computer },
          { isPlayer2: false, isComputer: replay.isPlayer3Computer ?? true },
          { isPlayer2: true, isComputer: replay.isPlayer4Computer ?? true },
        ]);
  const reInits = replay.roundReInits ?? [];
  let reInitIdx = 0;
  for (let i = 0; i < replay.frames.length; i++) {
    while (reInitIdx < reInits.length) {
      const next = reInits[reInitIdx];
      if (next === undefined || next.atFrame !== i) break;
      for (const player of physics.players) player.initializeForNewRound();
      physics.ball.initializeForNewRound(next.isPlayer2Serve);
      reInitIdx++;
    }
    const frame = replay.frames[i];
    if (frame === undefined) break;
    physics.runEngineForNextFrame(frame.map(inflateInput));
    yield physics;
  }
  return physics;
}

/**
 * Replay a captured engine run from scratch.
 * Returns the {@link PikaPhysics} at the end of the last frame.
 */
export function runReplay(replay: Replay): PikaPhysics {
  const stream = runReplayStreaming(replay);
  let result = stream.next();
  while (!result.done) result = stream.next();
  return result.value;
}

/**
 * Construct a {@link Replay} from a recorded run. Centralizes the
 * `version: 1` literal so callers don't have to remember the schema tag.
 * `roundReInits` is omitted when empty so single-round replays stay clean.
 */
export function buildReplay(args: {
  seed: number;
  isPlayer1Computer: boolean;
  isPlayer2Computer: boolean;
  frames: ReadonlyArray<ReplayInputFrame>;
  /** 2v2-only — set together with `playerCount: 4`. */
  isPlayer3Computer?: boolean;
  /** 2v2-only — set together with `playerCount: 4`. */
  isPlayer4Computer?: boolean;
  /** 2 (default) or 4. Omit / set to 2 for 1v1; set to 4 for 2v2. */
  playerCount?: 2 | 4;
  roundReInits?: ReadonlyArray<RoundReInit>;
  finalScores?: readonly [number, number];
}): Replay {
  let replay: Replay = {
    version: 1,
    seed: args.seed,
    isPlayer1Computer: args.isPlayer1Computer,
    isPlayer2Computer: args.isPlayer2Computer,
    frames: args.frames,
  };
  if (args.playerCount === 4) {
    replay = {
      ...replay,
      playerCount: 4,
      isPlayer3Computer: args.isPlayer3Computer ?? true,
      isPlayer4Computer: args.isPlayer4Computer ?? true,
    };
  }
  if (args.roundReInits !== undefined && args.roundReInits.length > 0) {
    replay = { ...replay, roundReInits: args.roundReInits };
  }
  if (args.finalScores !== undefined) {
    replay = { ...replay, finalScores: args.finalScores };
  }
  return replay;
}

export function serializeReplay(replay: Replay): string {
  return JSON.stringify(replay);
}

export function deserializeReplay(json: string): Replay {
  const parsed: unknown = JSON.parse(json);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as { version: unknown }).version !== 1
  ) {
    throw new Error(`Unsupported replay: ${json.slice(0, 40)}…`);
  }
  return parsed as Replay;
}
