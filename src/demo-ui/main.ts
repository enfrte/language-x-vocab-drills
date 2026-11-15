/**
 * ⚠️ DEMO FRONTEND — the vanilla-TS entry point.
 *
 * Bootstrap order matters: the theme `dark` class is applied synchronously
 * (from persisted settings) BEFORE the first render, so there is no flash of
 * the wrong theme — same trick as the original app. The active language comes
 * from the URL path (/fi, /mi, …); syncRoute installs the right app instance
 * and any deep link (/fi/learn/verbs) before the first paint.
 */

import { registerSW } from 'virtual:pwa-register';
import { installConsoleApi } from '../console';
import { injectStyles } from './styles';
import { applyThemeClass, handleClick, render, syncRoute } from './ui';

// PWA: register the generated service worker (offline precache, auto-update).
registerSW({ immediate: true });

console.info('[demo-ui] Vanilla TypeScript demo frontend for learn-language-x');

// Console API + styles + theme class applied before the first async render.
installConsoleApi();
injectStyles();
applyThemeClass();

// Boot: resolve the language + any deep link (/fi/learn/verbs), then paint.
void (async () => {
  await syncRoute();
  await render();
})();

// Back/forward navigation re-syncs the app with the location path.
globalThis.addEventListener('popstate', () => {
  void syncRoute();
});

// The single delegated click handler for every [data-action].
document.addEventListener('click', handleClick);
