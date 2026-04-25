/**
 * This module takes charge of the physical motion of clouds (on the sky) and wave (on the bottom of game screen) in the game.
 * It is also a Model in MVC pattern and also rendered by "view.js".
 *
 * It is gained by reverse engineering the original game.
 * The address of the original function is in the comment.
 * ex) FUN_00404770 means the function at the address 00404770 in the machine code.
 */
import { rand } from './rand.js';

/**
 * Class represents a cloud
 */
export class Cloud {
  topLeftPointX: number;
  topLeftPointY: number;
  topLeftPointXVelocity: number;
  sizeDiffTurnNumber: number;

  constructor() {
    this.topLeftPointX = -68 + (rand() % (432 + 68));
    this.topLeftPointY = rand() % 152;
    this.topLeftPointXVelocity = 1 + (rand() % 2);
    this.sizeDiffTurnNumber = rand() % 11;
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

  constructor() {
    for (let i = 0; i < 432 / 16; i++) {
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
    if (cloud.topLeftPointX > 432) {
      cloud.topLeftPointX = -68;
      cloud.topLeftPointY = rand() % 152;
      cloud.topLeftPointXVelocity = 1 + (rand() % 2);
    }
    cloud.sizeDiffTurnNumber = (cloud.sizeDiffTurnNumber + 1) % 11;
  }

  wave.verticalCoord += wave.verticalCoordVelocity;
  if (wave.verticalCoord > 32) {
    wave.verticalCoord = 32;
    wave.verticalCoordVelocity = -1;
  } else if (wave.verticalCoord < 0 && wave.verticalCoordVelocity < 0) {
    wave.verticalCoordVelocity = 2;
    wave.verticalCoord = -(rand() % 40);
  }

  for (let i = 0; i < 432 / 16; i++) {
    wave.yCoords[i] = 314 - wave.verticalCoord + (rand() % 3);
  }
}
