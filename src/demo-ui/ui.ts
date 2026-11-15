/**
 * ⚠️ DEMO FRONTEND — render loop, path router and the single click handler.
 *
 * The pattern any framework reproduces with its own mechanisms:
 *   app.subscribe(...)  →  read app state  →  set container.innerHTML
 * with one delegated listener translating clicks into app commands.
 *
 * Routing is path-based:
 *   /                        → language picker (no app needed)
 *   /<code>                  → language landing page
 *   /<code>/learn/<topic>    → Learn stage
 *   /<code>/recall/<topic>   → Recall stage
 * A page load serves one language: when the URL's code differs from the
 * active app's, a fresh app instance is installed (see setApp in app.ts).
 * Deep links work because both the Vercel rewrite and the Vite/PWA fallback
 * serve index.html for every path.
 */

import { createApp, currentApp, setApp, type AppView } from '../app';
import { getLanguage } from '../config';
import { landingHtml, learnHtml, pickerHtml, recallHtml } from './pages';
import { Settings } from '../storage/Settings';

const container = (): HTMLElement => {
  const root = document.getElementById('app');
  if (!root) throw new Error('Missing #app root element in index.html');
  return root;
};

/** The theme setting, readable without an app instance (root picker page). */
const settings = new Settings();

/** Applies the theme to <html>; presentation only, the state lives in storage. */
export function applyThemeClass(): void {
  document.documentElement.classList.toggle('dark', settings.loadTheme() === 'dark');
}

/** Keeps the <title>/<html lang> in sync with the route. */
function updateDocument(route: { code: string | null }): void {
  if (route.code) {
    document.documentElement.lang = currentApp().config.code;
    document.title = `Learn ${currentApp().config.name}`;
  } else {
    document.documentElement.lang = 'en';
    document.title = 'Learn a Language';
  }
}

let renderToken = 0;

/** Re-renders the page from the current route/app state. Async-safe (latest wins). */
export async function render(): Promise<void> {
  applyThemeClass();
  const token = ++renderToken;
  const route = parsePath();
  const root = container();
  let html: string;
  if (route.code === null) {
    html = pickerHtml();
  } else {
    const app = currentApp();
    if (app.view === 'learn') {
      html = learnHtml();
    } else if (app.view === 'recall') {
      html = recallHtml();
    } else {
      html = await landingHtml();
    }
  }
  if (token !== renderToken) return; // a newer render superseded this one
  root.innerHTML = html;
  updateDocument(route);
}

// ---- path routing ---------------------------------------------------------------

/** Parses "/fi/learn/nouns" / "/mi" / anything unknown → picker. */
export function parsePath(): { code: string | null; view: AppView; topicId: string } {
  const segments = globalThis.location.pathname.split('/').filter(Boolean);
  const code = segments[0] ?? null;
  if (!code || !getLanguage(code)) return { code: null, view: 'landing', topicId: '' };
  const [kind, topicId] = segments.slice(1);
  if (kind === 'learn' && topicId) return { code, view: 'learn', topicId };
  if (kind === 'recall') return { code, view: 'recall', topicId: topicId || '' };
  return { code, view: 'landing', topicId: '' };
}

/**
 * Subscribes the render loop to the CURRENT app singleton. Called again
 * whenever a new app instance is installed (navigating between languages).
 */
let watched: unknown = null;
function watchApp(): void {
  const instance = currentAppOrNull();
  if (!instance || watched === instance) return;
  watched = instance;
  instance.subscribe(() => {
    void render();
  });
}

function currentAppOrNull(): ReturnType<typeof currentApp> | null {
  try {
    return currentApp();
  } catch {
    return null;
  }
}

/** Installs the app singleton for the route's language (if needed). */
async function ensureApp(code: string): Promise<void> {
  const active = currentAppOrNull();
  if (active && active.config.code === code) return;
  setApp(await createApp(code));
  watchApp();
}

/** Syncs the app with the location path (deep links, back/forward). */
export async function syncRoute(): Promise<void> {
  const route = parsePath();
  if (route.code === null) return; // picker page needs no app
  await ensureApp(route.code);
  const app = currentApp();
  if (route.view === 'learn') {
    await app.openLearn(route.topicId);
  } else if (route.view === 'recall') {
    await app.openRecall(route.topicId || app.topicId);
  } else if (app.view !== 'landing') {
    app.close();
  }
}

/** SPA navigation: push the path, then let syncRoute drive the app. */
function navigate(path: string): void {
  globalThis.history.pushState({}, '', path);
  void syncRoute();
}

// ---- commands ---------------------------------------------------------------------

/** The one delegated click handler: data-action → app command. */
export function handleClick(event: MouseEvent): void {
  const element = (event.target as HTMLElement | null)?.closest('[data-action]');
  if (!(element instanceof HTMLElement)) return;
  const action = element.dataset['action'];
  const topic = element.dataset['topic'];
  const option = element.dataset['opt'];
  const atPicker = parsePath().code === null;
  const app = atPicker ? null : currentApp();
  const code = app?.config.code ?? '';

  switch (action) {
    case 'learn':
      // Single source of truth = the path; `popstate`/syncRoute drive the app.
      navigate(`/${code}/learn/${topic}`);
      break;
    case 'recall':
      navigate(`/${code}/recall/${topic}`);
      break;
    case 'close':
      navigate(`/${code}`);
      break;
    case 'start-quiz':
      app!.startQuiz((element.dataset['round'] ?? 'xx-en') as 'xx-en' | 'en-xx');
      break;
    case 'opt':
      if (option !== undefined) app!.answer(option);
      break;
    case 'advance':
      void app!.advance();
      break;
    case 'toggle-theme':
      if (app) {
        app.toggleTheme();
      } else {
        // No app on the picker page: flip the setting directly, then re-render
        // so the button label follows.
        settings.saveTheme(settings.loadTheme() === 'dark' ? 'light' : 'dark');
        void render();
      }
      break;
    case 'reset':
      if (
        globalThis.confirm(
          `Reset all progress for ${app!.config.name}? This clears learned and in-progress words for every topic.`,
        )
      ) {
        void app!.resetAll();
      }
      break;
    default:
      break;
  }
}
