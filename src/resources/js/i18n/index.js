/**
 * Runtime internationalization (i18n) for Pikachu Volleyball.
 *
 * Locale resolution priority:
 *   URL `?lang=` -> localStorage 'pv-locale' -> navigator.language -> 'en'
 *
 * Supported locales: en, ko, zh
 *
 * Korean texture overrides are applied here (synchronously, at module load)
 * so they take effect before main.js queues the spritesheet on the PixiJS Loader.
 * For this reason, main.js MUST import this module before the @pixi/* sub-packages.
 */
'use strict';

import { ASSETS_PATH } from '../assets_path.js';
import { translations } from './translations.js';

const SUPPORTED = ['en', 'ko', 'zh'];

/** @returns {'en' | 'ko' | 'zh'} */
function detectLocale() {
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (SUPPORTED.includes(fromUrl)) return /** @type {any} */ (fromUrl);
  const fromStorage = localStorage.getItem('pv-locale');
  if (SUPPORTED.includes(fromStorage)) return /** @type {any} */ (fromStorage);
  const nav = (navigator.language || 'en').toLowerCase();
  if (nav.startsWith('ko')) return 'ko';
  if (nav.startsWith('zh')) return 'zh';
  return 'en';
}

export const currentLocale = detectLocale();

if (currentLocale === 'ko') {
  Object.assign(ASSETS_PATH.TEXTURES, {
    MARK: 'messages/ko/mark.png',
    POKEMON: 'messages/ko/pokemon.png',
    PIKACHU_VOLLEYBALL: 'messages/ko/pikachu_volleyball.png',
    FIGHT: 'messages/ko/fight.png',
    WITH_COMPUTER: 'messages/ko/with_computer.png',
    WITH_FRIEND: 'messages/ko/with_friend.png',
    GAME_START: 'messages/ko/game_start.png',
  });
}

/**
 * Look up a translation for the current locale, falling back to English then to the key itself.
 * @param {string} key
 * @returns {string}
 */
export function t(key) {
  const localeTable = translations[currentLocale];
  if (localeTable && key in localeTable) return localeTable[key];
  if (key in translations.en) return translations.en[key];
  return key;
}

/**
 * Replace text/HTML/attributes for every element under `root` that carries a
 * `data-i18n`, `data-i18n-html`, or `data-i18n-attr` attribute.
 * @param {ParentNode} [root]
 */
export function applyTranslations(root = document) {
  document.documentElement.lang = currentLocale;

  for (const el of root.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.getAttribute('data-i18n'));
  }
  for (const el of root.querySelectorAll('[data-i18n-html]')) {
    el.innerHTML = t(el.getAttribute('data-i18n-html'));
  }
  for (const el of root.querySelectorAll('[data-i18n-attr]')) {
    const spec = el.getAttribute('data-i18n-attr') || '';
    for (const pair of spec.split(',')) {
      const idx = pair.indexOf(':');
      if (idx <= 0) continue;
      const attr = pair.slice(0, idx).trim();
      const key = pair.slice(idx + 1).trim();
      if (attr && key) el.setAttribute(attr, t(key));
    }
  }
}

/**
 * Switch language. Persists the choice and reloads the page (with `?lang=`)
 * so that texture overrides and translations are applied from a clean slate.
 * @param {string} locale
 */
export function setLocale(locale) {
  if (!SUPPORTED.includes(locale) || locale === currentLocale) return;
  localStorage.setItem('pv-locale', locale);
  const url = new URL(location.href);
  url.searchParams.set('lang', locale);
  location.href = url.toString();
}

/**
 * Wire up `[data-locale]` buttons inside `.languages` containers and mark the
 * button matching `currentLocale` with a leading check mark + `current` class.
 * @param {ParentNode} [root]
 */
export function setupLanguageButtons(root = document) {
  for (const btn of root.querySelectorAll('button.lang-btn[data-locale]')) {
    const locale = btn.getAttribute('data-locale');
    if (locale === currentLocale) {
      btn.classList.add('current');
      // @ts-ignore — HTMLButtonElement.disabled
      btn.disabled = true;
      btn.textContent = '✓ ' + btn.textContent.trim();
    } else {
      btn.addEventListener('click', () => setLocale(locale));
    }
  }
}

function init() {
  applyTranslations();
  setupLanguageButtons();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
