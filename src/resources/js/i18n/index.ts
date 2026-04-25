/**
 * Runtime internationalization (i18n) for Pikachu Volleyball.
 *
 * Locale resolution priority:
 *   URL `?lang=` -> localStorage 'pv-locale' -> navigator.language -> 'en'
 *
 * Supported locales: en, ko, zh
 *
 * Korean texture overrides are applied here (synchronously, at module load)
 * so they take effect before main.ts queues the spritesheet on the PixiJS Loader.
 * For this reason, main.ts MUST import this module before the @pixi/* sub-packages.
 */

import { ASSETS_PATH } from '../assets_path.js';
import { translations } from './translations.js';
import type { Locale } from './translations.js';

const SUPPORTED: readonly Locale[] = ['en', 'ko', 'zh'];

function asLocale(value: string | null): Locale | null {
  if (value === null) return null;
  if ((SUPPORTED as readonly string[]).includes(value)) return value as Locale;
  return null;
}

function detectLocale(): Locale {
  const fromUrl = asLocale(new URLSearchParams(location.search).get('lang'));
  if (fromUrl !== null) return fromUrl;
  const fromStorage = asLocale(localStorage.getItem('pv-locale'));
  if (fromStorage !== null) return fromStorage;
  const nav = (navigator.language || 'en').toLowerCase();
  if (nav.startsWith('ko')) return 'ko';
  if (nav.startsWith('zh')) return 'zh';
  return 'en';
}

export const currentLocale: Locale = detectLocale();

if (currentLocale === 'ko') {
  ASSETS_PATH.TEXTURES.MARK = 'messages/ko/mark.png';
  ASSETS_PATH.TEXTURES.POKEMON = 'messages/ko/pokemon.png';
  ASSETS_PATH.TEXTURES.PIKACHU_VOLLEYBALL = 'messages/ko/pikachu_volleyball.png';
  ASSETS_PATH.TEXTURES.FIGHT = 'messages/ko/fight.png';
  ASSETS_PATH.TEXTURES.WITH_COMPUTER = 'messages/ko/with_computer.png';
  ASSETS_PATH.TEXTURES.WITH_FRIEND = 'messages/ko/with_friend.png';
  ASSETS_PATH.TEXTURES.GAME_START = 'messages/ko/game_start.png';
}

/**
 * Look up a translation for the current locale, falling back to English then to the key itself.
 */
export function t(key: string): string {
  return translations[currentLocale][key] ?? translations.en[key] ?? key;
}

/**
 * Replace text/HTML/attributes for every element under `root` that carries a
 * `data-i18n`, `data-i18n-html`, or `data-i18n-attr` attribute.
 */
export function applyTranslations(root: ParentNode = document): void {
  document.documentElement.lang = currentLocale;

  for (const el of root.querySelectorAll('[data-i18n]')) {
    const key = el.getAttribute('data-i18n');
    if (key !== null) el.textContent = t(key);
  }
  for (const el of root.querySelectorAll('[data-i18n-html]')) {
    const key = el.getAttribute('data-i18n-html');
    if (key !== null) el.innerHTML = t(key);
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
 */
export function setLocale(locale: string): void {
  const target = asLocale(locale);
  if (target === null || target === currentLocale) return;
  localStorage.setItem('pv-locale', target);
  const url = new URL(location.href);
  url.searchParams.set('lang', target);
  location.href = url.toString();
}

/**
 * Wire up `[data-locale]` buttons inside `.languages` containers and mark the
 * button matching `currentLocale` with a leading check mark + `current` class.
 */
export function setupLanguageButtons(root: ParentNode = document): void {
  for (const btn of root.querySelectorAll<HTMLButtonElement>('button.lang-btn[data-locale]')) {
    const locale = btn.getAttribute('data-locale');
    if (locale === currentLocale) {
      btn.classList.add('current');
      btn.disabled = true;
      btn.textContent = '✓ ' + (btn.textContent ?? '').trim();
    } else if (locale !== null) {
      btn.addEventListener('click', () => setLocale(locale));
    }
  }
}

function init(): void {
  applyTranslations();
  setupLanguageButtons();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
