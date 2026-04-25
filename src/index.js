// Entry point for the main page.
// i18n must run before main.js so its Korean texture overrides are applied
// before main.js queues the spritesheet on the PixiJS Loader.
'use strict';
import './resources/js/i18n/index.js';
import './resources/js/main.js';
import './resources/js/utils/dark_color_scheme.js';
import './resources/js/utils/is_embedded_in_other_website.js';
