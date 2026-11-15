/**
 * Demo-UI smoke test — drives the REAL vanilla-TS modules (ui.ts routing +
 * pages.ts renderers) against minimal DOM stubs, proving the path routing
 * and page rendering behave as designed without needing a browser:
 *
 *   /                → language picker
 *   /fi              → Finnish landing (topics from config)
 *   /fi/learn/verbs  → Learn stage (batch review)
 *   /xx /unknown     → falls back to the picker
 *   /mi/learn/nouns  → switching languages installs a new app instance
 */

import { describe, expect, it, beforeAll } from 'vitest';

// The demo-ui drives the REAL app facade (default Dexie progress store).
// fake-indexeddb provides IndexedDB in Node so the full persistence path is
// exercised (fresh DB per test file run — see version/db name).
import 'fake-indexeddb/auto';

// ---- minimal DOM/browser stubs, installed before the modules load ----------

class FakeElement {
  innerHTML = '';
  classList = { toggle: () => {} };
  dataset: Record<string, string> = {};
}

const body = new FakeElement() as unknown as HTMLElement;
const fakeDocument = {
  getElementById: (id: string) => (id === 'app' ? body : null),
  documentElement: new FakeElement() as unknown as HTMLElement,
  title: '',
  addEventListener: () => {},
  createElement: () => new FakeElement() as unknown as HTMLElement,
};

const storage = new Map<string, string>();
const fakeWindow = {
  location: { pathname: '/', href: '', origin: 'http://localhost:5173' },
  history: { pushState: (_s: unknown, _t: unknown, path: string) => { fakeWindow.location.pathname = path; } },
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
  },
  addEventListener: () => {},
  confirm: () => false,
  document: fakeDocument,
};

type Globals = Record<string, unknown> & typeof globalThis;
const g = globalThis as Globals;
g.document = fakeDocument as unknown as Document;
g.window = fakeWindow as unknown as Window & typeof globalThis;
g.location = fakeWindow.location as unknown as Location;
g.history = fakeWindow.history as unknown as History;
g.localStorage = fakeWindow.localStorage as unknown as Storage;

// The route the "browser" is at — mutable before each syncRoute().
function goto(path: string): void {
  fakeWindow.location.pathname = path;
}

describe('demo-ui routing (real modules, stubbed DOM)', () => {
  let render: () => Promise<void>;
  let syncRoute: () => Promise<void>;
  let parsePath: () => { code: string | null; view: string };

  beforeAll(async () => {
    ({ render, syncRoute, parsePath } = await import('../src/demo-ui/ui'));
  });

  it('root shows the language picker with every configured language', async () => {
    goto('/');
    await syncRoute();
    await render();
    expect(body.innerHTML).toContain('Learn a language');
    expect(body.innerHTML).toContain('href="/fi"');
    expect(body.innerHTML).toContain('Learn Finnish');
    expect(body.innerHTML).toContain('href="/mi"');
    expect(body.innerHTML).toContain('Learn Māori');
  });

  it('/fi shows the Finnish landing page with configured topics only', async () => {
    goto('/fi');
    await syncRoute();
    await render();
    expect(body.innerHTML).toContain('Learn Finnish');
    expect(body.innerHTML).toContain('Verbs');
    expect(body.innerHTML).toContain('Adjectives');
    expect(body.innerHTML).toContain('Pronouns');
    // The unlisted (too large) nouns topic is not reachable.
    expect(body.innerHTML).not.toMatch(/>Nouns</);
  });

  it('/fi/learn/verbs opens the Learn stage with a fresh batch', async () => {
    goto('/fi/learn/verbs');
    await syncRoute();
    await render();
    expect(body.innerHTML).toContain('Learn words');
    expect(body.innerHTML).toContain('New words (5)');
    expect(body.innerHTML).toContain('Test me');
  });

  it('/fi/recall with nothing learned shows the empty phase', async () => {
    goto('/fi/recall/verbs');
    await syncRoute();
    await render();
    expect(body.innerHTML).toContain('Recall words');
    expect(body.innerHTML).toContain('No learned words yet');
  });

  it('unknown language codes fall back to the picker', async () => {
    goto('/xx');
    await syncRoute();
    await render();
    expect(parsePath().code).toBeNull();
    expect(body.innerHTML).toContain('Learn a language');

    goto('/xx/learn/verbs');
    await syncRoute();
    await render();
    expect(parsePath().code).toBeNull();
    expect(body.innerHTML).toContain('Learn a language');
  });

  it('navigating between languages installs a fresh app for each', async () => {
    goto('/mi/learn/nouns');
    await syncRoute();
    await render();
    expect(body.innerHTML).toContain('Learn words');

    // Back to Finnish: a new app, landing state.
    goto('/fi');
    await syncRoute();
    await render();
    expect(body.innerHTML).toContain('Learn Finnish');
    expect(body.innerHTML).not.toContain('New words');
  });
});
