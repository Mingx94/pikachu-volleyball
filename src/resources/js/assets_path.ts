/**
 * Manages the paths (file locations) of the game assets.
 */

export interface AssetsPathTextures {
  PIKACHU: (i: number, j: number) => string;
  BALL: (s: number) => string;
  NUMBER: (n: number) => string;

  SKY_BLUE: string;
  MOUNTAIN: string;
  GROUND_RED: string;
  GROUND_LINE: string;
  GROUND_LINE_LEFT_MOST: string;
  GROUND_LINE_RIGHT_MOST: string;
  GROUND_YELLOW: string;
  NET_PILLAR_TOP: string;
  NET_PILLAR: string;
  SHADOW: string;
  BALL_HYPER: string;
  BALL_TRAIL: string;
  BALL_PUNCH: string;
  CLOUD: string;
  WAVE: string;
  BLACK: string;

  SACHISOFT: string;
  READY: string;
  GAME_END: string;

  MARK: string;
  POKEMON: string;
  PIKACHU_VOLLEYBALL: string;
  FIGHT: string;
  WITH_COMPUTER: string;
  WITH_FRIEND: string;
  GAME_START: string;

  SITTING_PIKACHU: string;
}

export interface AssetsPathSounds {
  BGM: string;
  PIPIKACHU: string;
  PIKA: string;
  CHU: string;
  PI: string;
  PIKACHU: string;
  POWERHIT: string;
  BALLTOUCHESGROUND: string;
}

export interface AssetsPath {
  SPRITE_SHEET: string;
  TEXTURES: AssetsPathTextures;
  SOUNDS: AssetsPathSounds;
}

export const ASSETS_PATH: AssetsPath = {
  SPRITE_SHEET: 'resources/assets/images/sprite_sheet.json',
  TEXTURES: {
    PIKACHU: (i, j) => `pikachu/pikachu_${i}_${j}.png`,
    BALL: (s) => `ball/ball_${s}.png`,
    NUMBER: (n) => `number/number_${n}.png`,

    SKY_BLUE: 'objects/sky_blue.png',
    MOUNTAIN: 'objects/mountain.png',
    GROUND_RED: 'objects/ground_red.png',
    GROUND_LINE: 'objects/ground_line.png',
    GROUND_LINE_LEFT_MOST: 'objects/ground_line_leftmost.png',
    GROUND_LINE_RIGHT_MOST: 'objects/ground_line_rightmost.png',
    GROUND_YELLOW: 'objects/ground_yellow.png',
    NET_PILLAR_TOP: 'objects/net_pillar_top.png',
    NET_PILLAR: 'objects/net_pillar.png',
    SHADOW: 'objects/shadow.png',
    BALL_HYPER: 'ball/ball_hyper.png',
    BALL_TRAIL: 'ball/ball_trail.png',
    BALL_PUNCH: 'ball/ball_punch.png',
    CLOUD: 'objects/cloud.png',
    WAVE: 'objects/wave.png',
    BLACK: 'objects/black.png',

    SACHISOFT: 'messages/common/sachisoft.png',
    READY: 'messages/common/ready.png',
    GAME_END: 'messages/common/game_end.png',

    // The following 7 keys are overridden in i18n/index.ts when currentLocale === 'ko'.
    MARK: 'messages/ja/mark.png',
    POKEMON: 'messages/ja/pokemon.png',
    PIKACHU_VOLLEYBALL: 'messages/ja/pikachu_volleyball.png',
    FIGHT: 'messages/ja/fight.png',
    WITH_COMPUTER: 'messages/ja/with_computer.png',
    WITH_FRIEND: 'messages/ja/with_friend.png',
    GAME_START: 'messages/ja/game_start.png',

    SITTING_PIKACHU: 'sitting_pikachu.png',
  },
  SOUNDS: {
    BGM: 'resources/assets/sounds/bgm.mp3',
    PIPIKACHU: 'resources/assets/sounds/WAVE140_1.wav',
    PIKA: 'resources/assets/sounds/WAVE141_1.wav',
    CHU: 'resources/assets/sounds/WAVE142_1.wav',
    PI: 'resources/assets/sounds/WAVE143_1.wav',
    PIKACHU: 'resources/assets/sounds/WAVE144_1.wav',
    POWERHIT: 'resources/assets/sounds/WAVE145_1.wav',
    BALLTOUCHESGROUND: 'resources/assets/sounds/WAVE146_1.wav',
  },
};
