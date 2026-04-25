/**
 * This module takes charge of the user input via keyboard
 */
import { PikaUserInput } from './physics.js';

/**
 * Class representing a keyboard used to control a player
 */
export class PikaKeyboard extends PikaUserInput {
  powerHitKeyIsDownPrevious = false;

  leftKey: Key;
  rightKey: Key;
  upKey: Key;
  downKey: Key;
  powerHitKey: Key;
  downRightKey: Key;

  /**
   * Create a keyboard used for game controller
   * left, right, up, down, powerHit: KeyboardEvent.code value for each
   * Refer {@link https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code/code_values}
   * @param left KeyboardEvent.code value of the key to use for left
   * @param right KeyboardEvent.code value of the key to use for right
   * @param up KeyboardEvent.code value of the key to use for up
   * @param down KeyboardEvent.code value of the key to use for down
   * @param powerHit KeyboardEvent.code value of the key to use for power hit or selection
   * @param downRight KeyboardEvent.code value of the key to use for having the same effect
   *                           when pressing down key and right key at the same time (Only player 1
   *                           has this key)
   */
  constructor(
    left: string,
    right: string,
    up: string,
    down: string,
    powerHit: string,
    downRight: string | null = null,
  ) {
    super();

    this.leftKey = new Key(left);
    this.rightKey = new Key(right);
    this.upKey = new Key(up);
    this.downKey = new Key(down);
    this.powerHitKey = new Key(powerHit);
    this.downRightKey = new Key(downRight);
  }

  /**
   * Get xDirection, yDirection, powerHit input from the keyboard.
   * This method is for freezing the keyboard input during the process of one game frame.
   */
  getInput(): void {
    if (this.leftKey.isDown) {
      this.xDirection = -1;
    } else if (this.rightKey.isDown || this.downRightKey.isDown) {
      this.xDirection = 1;
    } else {
      this.xDirection = 0;
    }

    if (this.upKey.isDown) {
      this.yDirection = -1;
    } else if (this.downKey.isDown || this.downRightKey.isDown) {
      this.yDirection = 1;
    } else {
      this.yDirection = 0;
    }

    const isDown = this.powerHitKey.isDown;
    if (!this.powerHitKeyIsDownPrevious && isDown) {
      this.powerHit = 1;
    } else {
      this.powerHit = 0;
    }
    this.powerHitKeyIsDownPrevious = isDown;
  }

  /**
   * Subscribe keydown, keyup event listeners for the keys of this keyboard
   */
  subscribe(): void {
    this.leftKey.subscribe();
    this.rightKey.subscribe();
    this.upKey.subscribe();
    this.downKey.subscribe();
    this.powerHitKey.subscribe();
    this.downRightKey.subscribe();
  }

  /**
   * Unsubscribe keydown, keyup event listeners for the keys of this keyboard
   */
  unsubscribe(): void {
    this.leftKey.unsubscribe();
    this.rightKey.unsubscribe();
    this.upKey.unsubscribe();
    this.downKey.unsubscribe();
    this.powerHitKey.unsubscribe();
    this.downRightKey.unsubscribe();
  }
}

/**
 * Class representing a key on a keyboard
 * referred to: https://github.com/kittykatattack/learningPixi
 */
class Key {
  value: string | null;
  isDown = false;
  isUp = true;
  downListener: (event: KeyboardEvent) => void;
  upListener: (event: KeyboardEvent) => void;

  /**
   * Create a key.
   * Refer {@link https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code/code_values}
   * @param value KeyboardEvent.code value of this key, or null for an unbound key
   */
  constructor(value: string | null) {
    this.value = value;
    this.downListener = this.downHandler.bind(this);
    this.upListener = this.upHandler.bind(this);
    this.subscribe();
  }

  downHandler(event: KeyboardEvent): void {
    if (this.value !== null && event.code === this.value) {
      this.isDown = true;
      this.isUp = false;
      event.preventDefault();
    }
  }

  upHandler(event: KeyboardEvent): void {
    if (this.value !== null && event.code === this.value) {
      this.isDown = false;
      this.isUp = true;
      event.preventDefault();
    }
  }

  subscribe(): void {
    // I think an event listener for keyup should be attached
    // before the one for keydown to prevent a buggy behavior.
    // If keydown event listener were attached first and
    // a key was downed and upped before keyup event listener were attached,
    // I think the value of this.isDown would be true (and the value of this.isUp would be false)
    // for a while before the user press this key again.
    window.addEventListener('keyup', this.upListener);
    window.addEventListener('keydown', this.downListener);
  }

  unsubscribe(): void {
    window.removeEventListener('keydown', this.downListener);
    window.removeEventListener('keyup', this.upListener);
    this.isDown = false;
    this.isUp = true;
  }
}
