/**
 * This module takes charge of the game audio (or sounds)
 */
import { sound, Sound, filters } from '@pixi/sound';
import type { LoaderResource } from '@pixi/loaders';
import { ASSETS_PATH } from './assets_path.js';

const SOUNDS = ASSETS_PATH.SOUNDS;

const SOUND_KEYS = [
  'bgm',
  'pipikachu',
  'pika',
  'chu',
  'pi',
  'pikachu',
  'powerHit',
  'ballTouchesGround',
] as const;
type SoundKey = (typeof SOUND_KEYS)[number];

type Sounds = { [K in SoundKey]: PikaStereoSound };

function getSound(resources: Record<string, LoaderResource>, key: string): Sound {
  const res = resources[key];
  if (!res || !res.sound) {
    throw new Error(`Sound not loaded: ${key}`);
  }
  return res.sound;
}

/**
 * Class representing audio
 */
export class PikaAudio {
  sounds: Sounds;
  /** proper bgm volume */
  readonly properBGMVolume = 0.2;
  /** proper sfx volume */
  readonly properSFXVolume = 0.35;

  /**
   * Create a PikaAudio object
   * @param resources loader.resources
   */
  constructor(resources: Record<string, LoaderResource>) {
    this.sounds = {
      bgm: new PikaStereoSound(getSound(resources, SOUNDS.BGM)),
      pipikachu: new PikaStereoSound(getSound(resources, SOUNDS.PIPIKACHU)),
      pika: new PikaStereoSound(getSound(resources, SOUNDS.PIKA)),
      chu: new PikaStereoSound(getSound(resources, SOUNDS.CHU)),
      pi: new PikaStereoSound(getSound(resources, SOUNDS.PI)),
      pikachu: new PikaStereoSound(getSound(resources, SOUNDS.PIKACHU)),
      powerHit: new PikaStereoSound(getSound(resources, SOUNDS.POWERHIT)),
      ballTouchesGround: new PikaStereoSound(getSound(resources, SOUNDS.BALLTOUCHESGROUND)),
    };

    this.sounds.bgm.loop = true;
    this.adjustVolume();
  }

  adjustVolume(): void {
    for (const key of SOUND_KEYS) {
      if (key === 'bgm') {
        this.sounds[key].volume = this.properBGMVolume;
      } else {
        this.sounds[key].volume = this.properSFXVolume;
      }
    }
  }

  turnBGMVolume(turnOn: boolean): void {
    this.sounds.bgm.volume = turnOn ? this.properBGMVolume : 0;
  }

  turnSFXVolume(turnOn: boolean): void {
    const volume = turnOn ? this.properSFXVolume : 0;
    for (const key of SOUND_KEYS) {
      if (key !== 'bgm') {
        this.sounds[key].volume = volume;
      }
    }
  }

  muteAll(): void {
    sound.muteAll();
  }

  unmuteAll(): void {
    sound.unmuteAll();
  }
}

/**
 * Class representing a stereo sound
 */
class PikaStereoSound {
  center: Sound;
  left: Sound;
  right: Sound;

  constructor(centerSound: Sound) {
    this.center = centerSound;
    this.left = Sound.from(centerSound.url);
    this.right = Sound.from(centerSound.url);

    const centerPanning = new filters.StereoFilter(0);
    const leftPanning = new filters.StereoFilter(-0.75);
    const rightPanning = new filters.StereoFilter(0.75);
    this.center.filters = [centerPanning];
    this.left.filters = [leftPanning];
    this.right.filters = [rightPanning];
  }

  /** volume: number in [0, 1] */
  set volume(v: number) {
    this.center.volume = v;
    this.left.volume = v;
    this.right.volume = v;
  }

  set loop(bool: boolean) {
    this.center.loop = bool;
    this.left.loop = bool;
    this.right.loop = bool;
  }

  /**
   * play this stereo sound
   * @param leftOrCenterOrRight -1: left, 0: center, 1: right
   */
  play(leftOrCenterOrRight = 0): void {
    if (leftOrCenterOrRight === 0) {
      this.center.play();
    } else if (leftOrCenterOrRight === -1) {
      this.left.play();
    } else if (leftOrCenterOrRight === 1) {
      this.right.play();
    }
  }

  stop(): void {
    this.center.stop();
    this.left.stop();
    this.right.stop();
  }
}
