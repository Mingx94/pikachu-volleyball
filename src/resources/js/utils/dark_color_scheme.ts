import { localStorageWrapper } from './local_storage_wrapper.js';

const THEME_COLOR_LIGHT = '#FFFFFF';
const THEME_COLOR_DARK = '#202124';

setUpDarkColorSchemeCheckbox();

function setUpDarkColorSchemeCheckbox(): void {
  const darkColorSchemeCheckboxElements = Array.from(
    document.getElementsByClassName('dark-color-scheme-checkbox'),
  ) as HTMLInputElement[];
  const colorScheme = localStorageWrapper.get('colorScheme');
  if (colorScheme === 'dark' || colorScheme === 'light') {
    darkColorSchemeCheckboxElements.forEach((elem) => {
      elem.checked = colorScheme === 'dark';
    });
    applyColorScheme(colorScheme);
  } else {
    const doesPreferDarkColorScheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
    // The following line is not for "document.documentElement.dataset.colorScheme = colorScheme;".
    // document.documentElement.dataset.colorScheme is not needed to be set for displaying dark color scheme,
    // since style.css has media query "@media (prefers-color-scheme: dark)" which deals with it without JavaScript.
    // The following line is for setting theme color and etc...
    applyColorScheme(doesPreferDarkColorScheme ? 'dark' : 'light');
    darkColorSchemeCheckboxElements.forEach((elem) => {
      elem.checked = doesPreferDarkColorScheme;
    });
  }
  darkColorSchemeCheckboxElements.forEach((elem) => {
    elem.addEventListener('change', () => {
      const newScheme = elem.checked ? 'dark' : 'light';
      applyColorScheme(newScheme);
      localStorageWrapper.set('colorScheme', newScheme);
      // For syncing states of other checkbox elements
      darkColorSchemeCheckboxElements.forEach((element) => {
        if (element !== elem) {
          element.checked = elem.checked;
        }
      });
    });
  });
}

function applyColorScheme(colorScheme: 'dark' | 'light'): void {
  document.documentElement.dataset.colorScheme = colorScheme;
  const themeColorMetaElement = document.querySelector('meta[name="theme-color"]');
  if (themeColorMetaElement !== null) {
    // The line below is for the status bar color, which is set by theme-color
    // meta tag content, of PWA in Apple devices.
    themeColorMetaElement.setAttribute(
      'content',
      colorScheme === 'dark' ? THEME_COLOR_DARK : THEME_COLOR_LIGHT,
    );
  }
}
