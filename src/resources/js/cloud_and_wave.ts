/**
 * This module takes charge of the physical motion of clouds (on the sky) and wave (on the bottom of game screen) in the game.
 * It is also a Model in MVC pattern and also rendered by "view.js".
 *
 * It is gained by reverse engineering the original game.
 * The address of the original function is in the comment.
 * ex) FUN_00404770 means the function at the address 00404770 in the machine code.
 *
 * Note on RNG: the original game shares a single rand() between physics and
 * cloud/wave. This implementation deliberately uses an independent
 * Math.random-based source instead, so the seeded {@link rand.setCustomRng}
 * sequence used by the deterministic engine is NOT perturbed by the per-frame
 * cloud/wave updates. Without this isolation, replay playback diverges from
 * recording: the controller calls drawCloudsAndWave during startOfNewGame
 * (~71 ticks) and beforeStartOfNextRound (~30 ticks) — every one of those
 * ticks consumes ~27 rand calls — but startReplay skips startOfNewGame's
 * fade-in entirely, so the AI's RNG trajectory at round-frame 0 ends up
 * thousands of calls ahead of what was recorded. Cloud/wave is purely
 * cosmetic, so independent rng is the cheapest fix.
 *
 * `groundWidth` is parameterized so 2v2's wider (576 px) court spreads
 * clouds across the full sky and lays a wider ribbon of wave tiles. 1v1
 * keeps the original 432 px world.
 */
function visualRand(): number {
  return Math.floor(32_768 * Math.random());
}

/**
 * Class represents a cloud
 */
export class Cloud {
  topLeftPointX: number;
  topLeftPointY: number;
  topLeftPointXVelocity: number;
  sizeDiffTurnNumber: number;
  /** World width this cloud lives in. Used at respawn to wrap correctly. */
  groundWidth: number;

  constructor(groundWidth: number = 432) {
    this.groundWidth = groundWidth;
    this.topLeftPointX = -68 + (visualRand() % (groundWidth + 68));
    this.topLeftPointY = visualRand() % 152;
    this.topLeftPointXVelocity = 1 + (visualRand() % 2);
    this.sizeDiffTurnNumber = visualRand() % 11;
  }

  get sizeDiff(): number {
    // this same as return [0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 0][this.sizeDiffTurnNumber]
    return 5 - Math.abs(this.sizeDiffTurnNumber - 5);
  }

  get spriteTopLeftPointX(): number {
    return this.topLeftPointX - this.sizeDiff;
  }

  get spriteTopLeftPointY(): number {
    return this.topLeftPointY - this.sizeDiff;
  }

  get spriteWidth(): number {
    return 48 + 2 * this.sizeDiff;
  }

  get spriteHeight(): number {
    return 24 + 2 * this.sizeDiff;
  }
}

/**
 * Class representing wave
 */
export class Wave {
  verticalCoord = 0;
  verticalCoordVelocity = 2;
  yCoords: number[] = [];

  constructor(groundWidth: number = 432) {
    const tileCount = (groundWidth / 16) | 0;
    for (let i = 0; i < tileCount; i++) {
      this.yCoords.push(314);
    }
  }
}

/**
 * FUN_00404770
 * Move clouds and wave
 */
export function cloudAndWaveEngine(cloudArray: Cloud[], wave: Wave): void {
  for (let i = 0; i < 10; i++) {
    const cloud = cloudArray[i];
    if (cloud === undefined) continue;
    cloud.topLeftPointX += cloud.topLeftPointXVelocity;
    if (cloud.topLeftPointX > cloud.groundWidth) {
      cloud.topLeftPointX = -68;
      cloud.topLeftPointY = visualRand() % 152;
      cloud.topLeftPointXVelocity = 1 + (visualRand() % 2);
    }
    cloud.sizeDiffTurnNumber = (cloud.sizeDiffTurnNumber + 1) % 11;
  }

  wave.verticalCoord += wave.verticalCoordVelocity;
  if (wave.verticalCoord > 32) {
    wave.verticalCoord = 32;
    wave.verticalCoordVelocity = -1;
  } else if (wave.verticalCoord < 0 && wave.verticalCoordVelocity < 0) {
    wave.verticalCoordVelocity = 2;
    wave.verticalCoord = -(visualRand() % 40);
  }

  for (let i = 0; i < wave.yCoords.length; i++) {
    wave.yCoords[i] = 314 - wave.verticalCoord + (visualRand() % 3);
  }
}
