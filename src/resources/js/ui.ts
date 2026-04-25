/**
 * Manages event listeners relevant to the UI (menu bar, buttons, etc.) of the web page
 */
import type { Ticker } from 'pixi.js';
import { localStorageWrapper } from './utils/local_storage_wrapper.js';
import type { PikachuVolleyball } from './pikavolley.js';

export interface Options {
  graphic?: string | null;
  bgm?: string | null;
  sfx?: string | null;
  speed?: string | null;
  winningScore?: string | null;
}

/**
 * "Game paused by what?" — the greater the number, the higher the precedence.
 */
const PauseResumePrecedence = {
  pauseBtn: 3,
  messageBox: 2,
  dropdown: 1,
  notPaused: 0,
} as const;
type Precedence = (typeof PauseResumePrecedence)[keyof typeof PauseResumePrecedence];

/**
 * Manages pausing and resuming of the game with a precedence-based stack.
 */
class PauseResumeManager {
  private precedence: Precedence = PauseResumePrecedence.notPaused;

  pause(pikaVolley: PikachuVolleyball, precedence: Precedence): void {
    if (precedence > this.precedence) {
      pikaVolley.paused = true;
      this.precedence = precedence;
    }
  }

  resume(pikaVolley: PikachuVolleyball, precedence: Precedence): void {
    if (precedence === this.precedence) {
      pikaVolley.paused = false;
      this.precedence = PauseResumePrecedence.notPaused;
    }
  }
}

const pauseResumeManager = new PauseResumeManager();

/** Get a required element by id; throws if missing. */
function el(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Element not found: #${id}`);
  return e;
}

/** Get a required button element by id; throws if missing. */
function btnEl(id: string): HTMLButtonElement {
  return el(id) as HTMLButtonElement;
}

/**
 * Set up the user interface: menu bar, buttons, dropdowns, submenus, etc.
 */
export function setUpUI(pikaVolley: PikachuVolleyball, ticker: Ticker): void {
  const applyOptions = (options: Options): void => {
    setSelectedOptionsBtn(options);
    switch (options.graphic) {
      case 'sharp':
        el('game-canvas').classList.remove('graphic-soft');
        break;
      case 'soft':
        el('game-canvas').classList.add('graphic-soft');
        break;
    }
    switch (options.bgm) {
      case 'on':
        pikaVolley.audio.turnBGMVolume(true);
        break;
      case 'off':
        pikaVolley.audio.turnBGMVolume(false);
        break;
    }
    switch (options.sfx) {
      case 'stereo':
        pikaVolley.audio.turnSFXVolume(true);
        pikaVolley.isStereoSound = true;
        break;
      case 'mono':
        pikaVolley.audio.turnSFXVolume(true);
        pikaVolley.isStereoSound = false;
        break;
      case 'off':
        pikaVolley.audio.turnSFXVolume(false);
        break;
    }
    switch (options.speed) {
      case 'slow':
        pikaVolley.normalFPS = 20;
        ticker.maxFPS = pikaVolley.normalFPS;
        break;
      case 'medium':
        pikaVolley.normalFPS = 25;
        ticker.maxFPS = pikaVolley.normalFPS;
        break;
      case 'fast':
        pikaVolley.normalFPS = 30;
        ticker.maxFPS = pikaVolley.normalFPS;
        break;
    }
    switch (options.winningScore) {
      case '5':
        pikaVolley.winningScore = 5;
        break;
      case '10':
        pikaVolley.winningScore = 10;
        break;
      case '15':
        pikaVolley.winningScore = 15;
        break;
    }
  };

  const saveOptions = (options: Options): void => {
    setSelectedOptionsBtn(options);
    if (options.graphic) {
      localStorageWrapper.set('pv-offline-graphic', options.graphic);
    }
    if (options.bgm) {
      localStorageWrapper.set('pv-offline-bgm', options.bgm);
    }
    if (options.sfx) {
      localStorageWrapper.set('pv-offline-sfx', options.sfx);
    }
    if (options.speed) {
      localStorageWrapper.set('pv-offline-speed', options.speed);
    }
    if (options.winningScore) {
      localStorageWrapper.set('pv-offline-winningScore', options.winningScore);
    }
  };

  const loadOptions = (): Options => ({
    graphic: localStorageWrapper.get('pv-offline-graphic'),
    bgm: localStorageWrapper.get('pv-offline-bgm'),
    sfx: localStorageWrapper.get('pv-offline-sfx'),
    speed: localStorageWrapper.get('pv-offline-speed'),
    winningScore: localStorageWrapper.get('pv-offline-winningScore'),
  });

  const applyAndSaveOptions = (options: Options): void => {
    applyOptions(options);
    saveOptions(options);
  };

  // Load and apply saved options
  applyOptions(loadOptions());

  setUpBtns(pikaVolley, applyAndSaveOptions);
  setUpToShowDropdownsAndSubmenus(pikaVolley);

  // hide or show menubar if the user presses the "esc" key
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Escape') {
      const menuBar = el('menu-bar');
      if (menuBar.classList.contains('hidden')) {
        menuBar.classList.remove('hidden');
      } else {
        menuBar.classList.add('hidden');
      }
      event.preventDefault();
    } else if (event.code === 'Space') {
      const aboutBox = el('about-box');
      if (aboutBox.classList.contains('hidden')) {
        event.preventDefault();
      }
    }
  });

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      pikaVolley.audio.unmuteAll();
    } else {
      pikaVolley.audio.muteAll();
    }
  });
}

/**
 * Attach event listeners to the buttons
 */
function setUpBtns(
  pikaVolley: PikachuVolleyball,
  applyAndSaveOptions: (options: Options) => void,
): void {
  const gameDropdownBtn = btnEl('game-dropdown-btn');
  const optionsDropdownBtn = btnEl('options-dropdown-btn');
  const aboutBtn = btnEl('about-btn');
  gameDropdownBtn.disabled = false;
  optionsDropdownBtn.disabled = false;
  aboutBtn.disabled = false;

  const pauseBtn = el('pause-btn');
  pauseBtn.addEventListener('click', () => {
    if (pauseBtn.classList.contains('selected')) {
      pauseBtn.classList.remove('selected');
      pauseResumeManager.resume(pikaVolley, PauseResumePrecedence.pauseBtn);
    } else {
      pauseBtn.classList.add('selected');
      pauseResumeManager.pause(pikaVolley, PauseResumePrecedence.pauseBtn);
    }
  });

  const restartBtn = el('restart-btn');
  restartBtn.addEventListener('click', () => {
    if (pauseBtn.classList.contains('selected')) {
      pauseBtn.classList.remove('selected');
      pauseResumeManager.resume(pikaVolley, PauseResumePrecedence.pauseBtn);
    }
    pikaVolley.restart();
  });

  const graphicSharpBtn = el('graphic-sharp-btn');
  const graphicSoftBtn = el('graphic-soft-btn');
  graphicSharpBtn.addEventListener('click', () => {
    applyAndSaveOptions({ graphic: 'sharp' });
  });
  graphicSoftBtn.addEventListener('click', () => {
    applyAndSaveOptions({ graphic: 'soft' });
  });

  const bgmOnBtn = el('bgm-on-btn');
  const bgmOffBtn = el('bgm-off-btn');
  bgmOnBtn.addEventListener('click', () => {
    applyAndSaveOptions({ bgm: 'on' });
  });
  bgmOffBtn.addEventListener('click', () => {
    applyAndSaveOptions({ bgm: 'off' });
  });

  const stereoBtn = el('stereo-btn');
  const monoBtn = el('mono-btn');
  const sfxOffBtn = el('sfx-off-btn');
  stereoBtn.addEventListener('click', () => {
    applyAndSaveOptions({ sfx: 'stereo' });
  });
  monoBtn.addEventListener('click', () => {
    applyAndSaveOptions({ sfx: 'mono' });
  });
  sfxOffBtn.addEventListener('click', () => {
    applyAndSaveOptions({ sfx: 'off' });
  });

  // Game speed:
  //   slow: 1 frame per 50ms = 20 FPS
  //   medium: 1 frame per 40ms = 25 FPS
  //   fast: 1 frame per 33ms = 30.303030... FPS
  const slowSpeedBtn = el('slow-speed-btn');
  const mediumSpeedBtn = el('medium-speed-btn');
  const fastSpeedBtn = el('fast-speed-btn');
  slowSpeedBtn.addEventListener('click', () => {
    applyAndSaveOptions({ speed: 'slow' });
  });
  mediumSpeedBtn.addEventListener('click', () => {
    applyAndSaveOptions({ speed: 'medium' });
  });
  fastSpeedBtn.addEventListener('click', () => {
    applyAndSaveOptions({ speed: 'fast' });
  });

  const winningScore5Btn = el('winning-score-5-btn');
  const winningScore10Btn = el('winning-score-10-btn');
  const winningScore15Btn = el('winning-score-15-btn');
  const noticeBox1 = el('notice-box-1');
  const noticeOKBtn1 = el('notice-ok-btn-1');
  const winningScoreInNoticeBox1 = el('winning-score-in-notice-box-1');
  function isWinningScoreAlreadyReached(winningScore: number): boolean {
    const isGamePlaying =
      pikaVolley.state === pikaVolley.round ||
      pikaVolley.state === pikaVolley.afterEndOfRound ||
      pikaVolley.state === pikaVolley.beforeStartOfNextRound;
    if (
      isGamePlaying &&
      (pikaVolley.scores[0] >= winningScore || pikaVolley.scores[1] >= winningScore)
    ) {
      return true;
    }
    return false;
  }
  const noticeBox2 = el('notice-box-2');
  const noticeOKBtn2 = el('notice-ok-btn-2');
  winningScore5Btn.addEventListener('click', () => {
    if (winningScore5Btn.classList.contains('selected')) {
      return;
    }
    if (pikaVolley.isPracticeMode === true) {
      noticeBox2.classList.remove('hidden');
      gameDropdownBtn.disabled = true;
      optionsDropdownBtn.disabled = true;
      aboutBtn.disabled = true;
      pauseResumeManager.pause(pikaVolley, PauseResumePrecedence.messageBox);
      return;
    }
    if (isWinningScoreAlreadyReached(5)) {
      winningScoreInNoticeBox1.textContent = '5';
      noticeBox1.classList.remove('hidden');
      gameDropdownBtn.disabled = true;
      optionsDropdownBtn.disabled = true;
      aboutBtn.disabled = true;
      pauseResumeManager.pause(pikaVolley, PauseResumePrecedence.messageBox);
      return;
    }
    applyAndSaveOptions({ winningScore: '5' });
  });
  winningScore10Btn.addEventListener('click', () => {
    if (winningScore10Btn.classList.contains('selected')) {
      return;
    }
    if (pikaVolley.isPracticeMode === true) {
      noticeBox2.classList.remove('hidden');
      gameDropdownBtn.disabled = true;
      optionsDropdownBtn.disabled = true;
      aboutBtn.disabled = true;
      pauseResumeManager.pause(pikaVolley, PauseResumePrecedence.messageBox);
      return;
    }
    if (isWinningScoreAlreadyReached(10)) {
      winningScoreInNoticeBox1.textContent = '10';
      noticeBox1.classList.remove('hidden');
      gameDropdownBtn.disabled = true;
      optionsDropdownBtn.disabled = true;
      aboutBtn.disabled = true;
      pauseResumeManager.pause(pikaVolley, PauseResumePrecedence.messageBox);
      return;
    }
    applyAndSaveOptions({ winningScore: '10' });
  });
  winningScore15Btn.addEventListener('click', () => {
    if (winningScore15Btn.classList.contains('selected')) {
      return;
    }
    if (pikaVolley.isPracticeMode === true) {
      noticeBox2.classList.remove('hidden');
      gameDropdownBtn.disabled = true;
      optionsDropdownBtn.disabled = true;
      aboutBtn.disabled = true;
      pauseResumeManager.pause(pikaVolley, PauseResumePrecedence.messageBox);
      return;
    }
    if (isWinningScoreAlreadyReached(15)) {
      winningScoreInNoticeBox1.textContent = '15';
      noticeBox1.classList.remove('hidden');
      gameDropdownBtn.disabled = true;
      optionsDropdownBtn.disabled = true;
      aboutBtn.disabled = true;
      pauseResumeManager.pause(pikaVolley, PauseResumePrecedence.messageBox);
      return;
    }
    applyAndSaveOptions({ winningScore: '15' });
  });
  noticeOKBtn1.addEventListener('click', () => {
    if (!noticeBox1.classList.contains('hidden')) {
      noticeBox1.classList.add('hidden');
      gameDropdownBtn.disabled = false;
      optionsDropdownBtn.disabled = false;
      aboutBtn.disabled = false;
      pauseResumeManager.resume(pikaVolley, PauseResumePrecedence.messageBox);
    }
  });
  noticeOKBtn2.addEventListener('click', () => {
    if (!noticeBox2.classList.contains('hidden')) {
      noticeBox2.classList.add('hidden');
      gameDropdownBtn.disabled = false;
      optionsDropdownBtn.disabled = false;
      aboutBtn.disabled = false;
      pauseResumeManager.resume(pikaVolley, PauseResumePrecedence.messageBox);
    }
  });

  const practiceModeOnBtn = el('practice-mode-on-btn');
  const practiceModeOffBtn = el('practice-mode-off-btn');
  practiceModeOnBtn.addEventListener('click', () => {
    practiceModeOffBtn.classList.remove('selected');
    practiceModeOnBtn.classList.add('selected');
    pikaVolley.isPracticeMode = true;
  });
  practiceModeOffBtn.addEventListener('click', () => {
    practiceModeOnBtn.classList.remove('selected');
    practiceModeOffBtn.classList.add('selected');
    pikaVolley.isPracticeMode = false;
  });

  const aboutBox = el('about-box');
  const closeAboutBtn = el('close-about-btn');
  aboutBtn.addEventListener('click', () => {
    if (aboutBox.classList.contains('hidden')) {
      aboutBox.classList.remove('hidden');
      gameDropdownBtn.disabled = true;
      optionsDropdownBtn.disabled = true;
      pauseResumeManager.pause(pikaVolley, PauseResumePrecedence.messageBox);
    } else {
      aboutBox.classList.add('hidden');
      gameDropdownBtn.disabled = false;
      optionsDropdownBtn.disabled = false;
      pauseResumeManager.resume(pikaVolley, PauseResumePrecedence.messageBox);
    }
  });
  closeAboutBtn.addEventListener('click', () => {
    if (!aboutBox.classList.contains('hidden')) {
      aboutBox.classList.add('hidden');
      gameDropdownBtn.disabled = false;
      optionsDropdownBtn.disabled = false;
      pauseResumeManager.resume(pikaVolley, PauseResumePrecedence.messageBox);
    }
  });

  const resetToDefaultBtn = el('reset-to-default-btn');
  resetToDefaultBtn.addEventListener('click', () => {
    // turn off practice mode
    practiceModeOffBtn.click();

    // and restore the reset options to default
    const defaultOptions: Options = {
      graphic: 'sharp',
      bgm: 'on',
      sfx: 'stereo',
      speed: 'medium',
      winningScore: '15',
    };
    applyAndSaveOptions(defaultOptions);
  });
}

/**
 * Set selected (checked) options btn fit to options
 */
function setSelectedOptionsBtn(options: Options): void {
  if (options.graphic) {
    const graphicSharpBtn = el('graphic-sharp-btn');
    const graphicSoftBtn = el('graphic-soft-btn');
    switch (options.graphic) {
      case 'sharp':
        graphicSoftBtn.classList.remove('selected');
        graphicSharpBtn.classList.add('selected');
        break;
      case 'soft':
        graphicSharpBtn.classList.remove('selected');
        graphicSoftBtn.classList.add('selected');
        break;
    }
  }
  if (options.bgm) {
    const bgmOnBtn = el('bgm-on-btn');
    const bgmOffBtn = el('bgm-off-btn');
    switch (options.bgm) {
      case 'on':
        bgmOffBtn.classList.remove('selected');
        bgmOnBtn.classList.add('selected');
        break;
      case 'off':
        bgmOnBtn.classList.remove('selected');
        bgmOffBtn.classList.add('selected');
        break;
    }
  }
  if (options.sfx) {
    const stereoBtn = el('stereo-btn');
    const monoBtn = el('mono-btn');
    const sfxOffBtn = el('sfx-off-btn');
    switch (options.sfx) {
      case 'stereo':
        monoBtn.classList.remove('selected');
        sfxOffBtn.classList.remove('selected');
        stereoBtn.classList.add('selected');
        break;
      case 'mono':
        sfxOffBtn.classList.remove('selected');
        stereoBtn.classList.remove('selected');
        monoBtn.classList.add('selected');
        break;
      case 'off':
        stereoBtn.classList.remove('selected');
        monoBtn.classList.remove('selected');
        sfxOffBtn.classList.add('selected');
        break;
    }
  }
  if (options.speed) {
    const slowSpeedBtn = el('slow-speed-btn');
    const mediumSpeedBtn = el('medium-speed-btn');
    const fastSpeedBtn = el('fast-speed-btn');
    switch (options.speed) {
      case 'slow':
        mediumSpeedBtn.classList.remove('selected');
        fastSpeedBtn.classList.remove('selected');
        slowSpeedBtn.classList.add('selected');
        break;
      case 'medium':
        fastSpeedBtn.classList.remove('selected');
        slowSpeedBtn.classList.remove('selected');
        mediumSpeedBtn.classList.add('selected');
        break;
      case 'fast':
        slowSpeedBtn.classList.remove('selected');
        mediumSpeedBtn.classList.remove('selected');
        fastSpeedBtn.classList.add('selected');
        break;
    }
  }
  if (options.winningScore) {
    const winningScore5Btn = el('winning-score-5-btn');
    const winningScore10Btn = el('winning-score-10-btn');
    const winningScore15Btn = el('winning-score-15-btn');
    switch (options.winningScore) {
      case '5':
        winningScore10Btn.classList.remove('selected');
        winningScore15Btn.classList.remove('selected');
        winningScore5Btn.classList.add('selected');
        break;
      case '10':
        winningScore15Btn.classList.remove('selected');
        winningScore5Btn.classList.remove('selected');
        winningScore10Btn.classList.add('selected');
        break;
      case '15':
        winningScore5Btn.classList.remove('selected');
        winningScore10Btn.classList.remove('selected');
        winningScore15Btn.classList.add('selected');
        break;
    }
  }
}

/**
 * Attach event listeners to show dropdowns and submenus properly
 */
function setUpToShowDropdownsAndSubmenus(pikaVolley: PikachuVolleyball): void {
  // hide dropdowns and submenus if the user clicks outside of these
  window.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !target.matches('.dropdown-btn, .submenu-btn')) {
      hideSubmenus();
      hideDropdownsExcept('');
      pauseResumeManager.resume(pikaVolley, PauseResumePrecedence.dropdown);
    }
  });

  // set up to show dropdowns
  el('game-dropdown-btn').addEventListener('click', () => {
    toggleDropdown('game-dropdown', pikaVolley);
  });
  el('options-dropdown-btn').addEventListener('click', () => {
    toggleDropdown('options-dropdown', pikaVolley);
  });

  // set up to show submenus on mouseover event
  el('graphic-submenu-btn').addEventListener('mouseover', () => {
    showSubmenu('graphic-submenu-btn', 'graphic-submenu');
  });
  el('bgm-submenu-btn').addEventListener('mouseover', () => {
    showSubmenu('bgm-submenu-btn', 'bgm-submenu');
  });
  el('sfx-submenu-btn').addEventListener('mouseover', () => {
    showSubmenu('sfx-submenu-btn', 'sfx-submenu');
  });
  el('speed-submenu-btn').addEventListener('mouseover', () => {
    showSubmenu('speed-submenu-btn', 'speed-submenu');
  });
  el('winning-score-submenu-btn').addEventListener('mouseover', () => {
    showSubmenu('winning-score-submenu-btn', 'winning-score-submenu');
  });
  el('practice-mode-submenu-btn').addEventListener('mouseover', () => {
    showSubmenu('practice-mode-submenu-btn', 'practice-mode-submenu');
  });
  el('reset-to-default-btn').addEventListener('mouseover', () => {
    hideSubmenus();
  });

  // set up to show submenus on click event
  // (it is for touch device equipped with physical keyboard)
  el('bgm-submenu-btn').addEventListener('click', () => {
    showSubmenu('bgm-submenu-btn', 'bgm-submenu');
  });
  el('sfx-submenu-btn').addEventListener('click', () => {
    showSubmenu('sfx-submenu-btn', 'sfx-submenu');
  });
  el('speed-submenu-btn').addEventListener('click', () => {
    showSubmenu('speed-submenu-btn', 'speed-submenu');
  });
  el('winning-score-submenu-btn').addEventListener('click', () => {
    showSubmenu('winning-score-submenu-btn', 'winning-score-submenu');
  });
  el('practice-mode-submenu-btn').addEventListener('click', () => {
    showSubmenu('practice-mode-submenu-btn', 'practice-mode-submenu');
  });
  el('reset-to-default-btn').addEventListener('click', () => {
    hideSubmenus();
  });
}

/**
 * Toggle (show or hide) the dropdown menu
 */
function toggleDropdown(dropdownID: string, pikaVolley: PikachuVolleyball): void {
  hideSubmenus();
  hideDropdownsExcept(dropdownID);
  const willShow = el(dropdownID).classList.toggle('show');
  if (willShow) {
    pauseResumeManager.pause(pikaVolley, PauseResumePrecedence.dropdown);
  } else {
    pauseResumeManager.resume(pikaVolley, PauseResumePrecedence.dropdown);
  }
}

/**
 * Show the submenu
 */
function showSubmenu(submenuBtnID: string, subMenuID: string): void {
  hideSubmenus();
  el(submenuBtnID).classList.add('open');
  el(subMenuID).classList.add('show');
}

/**
 * Hide all other dropdowns except the dropdown
 */
function hideDropdownsExcept(dropdownID: string): void {
  const dropdowns = document.getElementsByClassName('dropdown');
  for (let i = 0; i < dropdowns.length; i++) {
    const d = dropdowns[i];
    if (d && d.id !== dropdownID) {
      d.classList.remove('show');
    }
  }
}

/**
 * Hide all submenus
 */
function hideSubmenus(): void {
  const submenus = document.getElementsByClassName('submenu');
  for (let i = 0; i < submenus.length; i++) {
    submenus[i]?.classList.remove('show');
  }
  const submenuBtns = document.getElementsByClassName('submenu-btn');
  for (let i = 0; i < submenuBtns.length; i++) {
    submenuBtns[i]?.classList.remove('open');
  }
}
