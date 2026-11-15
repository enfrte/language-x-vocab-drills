/**
 * Settings — small user preferences (the theme) kept in localStorage, separate
 * from the Dexie-based progress store. localStorage is synchronous, so the
 * theme can be applied before the app first renders (no flash of the wrong
 * theme). Wraps every access in try/catch: private browsing may deny it.
 */

const THEME_KEY = 'theme';

export type Theme = 'light' | 'dark';

export class Settings {
  loadSetting(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  saveSetting(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // unavailable (permissions/privacy mode) — the setting simply won't persist
    }
  }

  loadTheme(): Theme {
    return this.loadSetting(THEME_KEY) === 'dark' ? 'dark' : 'light';
  }

  saveTheme(theme: Theme): void {
    this.saveSetting(THEME_KEY, theme);
  }
}
