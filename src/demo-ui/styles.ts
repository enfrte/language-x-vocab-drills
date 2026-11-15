/**
 * ⚠️ DEMO FRONTEND — global styles for the example vanilla-TS UI.
 *
 * Semantic theme tokens, ported from the original app's `main-css.imba`.
 * Light is the default; the same tokens are overridden under `html.dark`.
 * Thes `dark` class is applied to <html> by `ui.ts` from `app.theme`.
 */

const CSS = `
:root {
  --bg: #e9eeac;
  --surface: #ffffff;
  --hover: #f6f8e2;
  --text: #0d1713;
  --strong: #0d1713;
  --muted: #4a554f;
  --border: #cdd3a3;
  --error: #dc2626;
  --ok: #16a34a;
  --green: #16a34a;
  --green-hover: #15803d;
  --blue: #2563eb;
  --blue-hover: #1d4ed8;
  --teal: #0d9488;
  --teal-hover: #0f766e;
}
html.dark {
  --bg: #1c1b18;
  --surface: #2b2926;
  --hover: #34312d;
  --text: #e7e5e4;
  --strong: #f5f5f4;
  --muted: #a8a29e;
  --border: #57534e;
  --error: #ef4444;
  --ok: #4ade80;
}

body {
  inset: 0;
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: Arial, sans-serif;
}
.app {padding: 1rem;}
.app-shell { max-width: 960px; padding: 1.25rem; margin-left: auto; margin-right: auto; }
.page-head { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.25rem; }
.page-head h1 { font-size: 1.5rem; font-weight: 700; margin: 0; }
.hero { margin-bottom: 1.5rem; }
.hero h1 { font-size: 2.4rem; font-weight: 800; margin: 0 0 0.5rem 0; }
.lead { color: var(--muted); font-size: 1.05rem; margin: 0 0 0.5rem 0; max-width: 640px; }
.card { background: var(--surface); border-radius: 4px; padding: 1.25rem 1rem; margin-bottom: 1rem; }
.card h2 { margin: 0 0 0.5rem 0; font-size: 1.2rem; }
.card p { color: var(--muted); margin: 0; }

/* Language picker cards (anchors styled as cards) */
a.language-card { display: block; text-decoration: none; color: inherit; }
a.language-card:hover h2 { text-decoration: underline; }
.row { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 1rem; }
.footer { display: flex; gap: 1rem; flex-wrap: wrap; align-items: center; margin-top: 1rem; }
.tracker { color: var(--muted); margin-bottom: 0.75rem; font-size: 0.95rem; }
.feedback { margin-top: 0.75rem; color: var(--error); font-size: 1rem; }
.feedback.ok { color: var(--ok); }
.hr { height: 2px; color: var(--surface); background: var(--surface); border: 0; }

/* Buttons */
.primary, .teal-btn, .next-btn, .back, .secondary, .theme-toggle, .danger, .plain-btn, .options-btn { font-family: inherit; }
.primary { color: #fff; padding: 0.75rem; padding-left: 1.25rem; padding-right: 1.25rem;
  border-radius: 4px; border: 0; font-size: 1rem; font-weight: 600; cursor: pointer;
  background: var(--blue);
}
.primary:hover { background: var(--blue-hover); }
.teal-btn { color: #fff; padding: 0.75rem; padding-left: 1.25rem; padding-right: 1.25rem;
  border-radius: 4px; border: 0; font-size: 1rem; font-weight: 600; cursor: pointer;
  background: var(--teal);
}
.teal-btn:hover { background: var(--teal-hover); }
.next-btn { color: #fff; padding: 0.75rem; border-radius: 4px; border: 0;
  font-size: 1.2rem; font-weight: 700; cursor: pointer; flex: 1 1 100%; display: block;
  background: var(--green);
}
.next-btn:hover { background: var(--green-hover); }
.back { color: var(--muted); padding: 0.5rem 0.75rem; border-radius: 4px; font-size: 0.9rem;
  cursor: pointer; border: 2px solid var(--border); background: transparent;
}
.back:hover { background: var(--hover); }
.secondary { color: var(--muted); padding: 0.75rem 1.25rem; border-radius: 4px; font-size: 1rem;
  cursor: pointer; border: 2px solid var(--border); background: transparent;
}
.secondary:hover { background: var(--hover); }
.danger { background: transparent; font-size: 0.85rem; padding: 0.5rem; border-radius: 2px;
  cursor: pointer; border: 0; color: var(--muted);
}
.danger:hover { color: var(--error); }
.plain-btn { background: var(--surface); }
.theme-toggle { font-size: 0.85rem; padding: 0.5rem 0.75rem; border-radius: 2px;
  cursor: pointer; border: 0; color: var(--muted);
}
.theme-toggle:hover { color: var(--text); }
.disabled { opacity: 0.45; pointer-events: none; }

/* Multiple choice */
.q-prompt { display: block; font-size: 1.4rem; font-weight: 600; margin-bottom: 0.75rem; }
.options-btn { width: 100%; text-align: left; padding: 0.75rem; font-size: 1.2rem;
  font-weight: 500; color: var(--strong); border-radius: 4px; display: block;
  background: var(--surface); border: 2px solid transparent; cursor: pointer;
}
.options-btn:hover { border-color: var(--border); }
.options-btn.right { border-color: var(--ok); }
.options-btn.wrong { background: var(--error); border-color: #ef4444; }
.options-btn.dim { opacity: 0.45; }

/* Word tiles */
.word-list { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.word { background: var(--surface); border-radius: 4px; padding: 0.75rem;
  min-width: 180px; flex: 1 1 220px;
}
.word .xx { display: inline; font-size: 1.5rem; font-weight: 700; color: var(--strong); }
.word .en { display: block; font-size: 0.95rem; color: var(--muted); margin-top: 0.25rem; }
.word .gr { display: inline; font-size: 0.95rem; color: var(--muted); padding-left: 0.5rem; padding-right: 0.5rem; }
`;

export function injectStyles(): void {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
}
