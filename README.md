# learn-language-x

Demo: https://language-x-vocab-drills.vercel.app/

A frontend-agnostic vocabulary learning PWA. All business logic lives in pure
TypeScript classes (`src/domain/`, `src/data/`, `src/storage/`); a minimal
vanilla-TS demo UI (`src/demo-ui/`) proves it works and is meant to be replaced
or paired with React / Solid / Alpine without touching the core.

The supported languages are configured in one place — `LANGUAGES` in
`src/config.ts`. Each entry is keyed by its ISO 639-1 two-letter code (which is
also the dataset JSON key and the URL path) and maps topic labels to dataset
filepaths:

```ts
fi: {
  code: 'fi', name: 'Finnish', source: 'en',
  topics: { 'Verbs': 'data/datasets/fi/fi-en-verbs.jsonl', ... },
},
```

Dataset files live in `src/data/datasets/<code>/` (one `.jsonl` per topic, in
the shape `{"fi": "word", "gr": "noun", "en": ["meaning"]}`). Files on disk
that are not listed in the config are ignored. URLs: `/` lists the languages,
`/<code>` is a language's landing page, and `/<code>/learn/<topic>` and
`/<code>/recall/<topic>` are the stages. Progress is stored per language and
topic (`learned:fi:verbs`, …) in one IndexedDB database.

> Docs: open `docs/tutorial.html` (TypeScript walkthrough for newcomers) and
> `docs/architecture.html` (complete reference) in a browser.

## Quickstart

```bash
npm install
npm run dev        # Vite dev server
npm run build      # typecheck + production build with PWA precache
npm run preview    # serve dist/ (check the PWA)
npm test           # domain smoke tests (vitest)
```

Deploy: push to Vercel (framework preset: Vite, build output `dist/`). A
`vercel.json` is included for SPA rewrites. After the first visit the service
worker precaches everything (including the bundled datasets), so the app works
offline and is installable.

## Try it from the browser console

The facade is exposed as `window.lex`:

```js
lex.app.config.code                           // the active language ("fi")
lex.app.view                                  // 'landing' | 'learn' | 'recall'
await lex.app.snapshotAll()                   // per-topic progress
lex.app.dictionary('verbs').wordCount         // topic's vocabulary size
await lex.app.openLearn('verbs')              // start learning
lex.app.answer('house'); await lex.app.advance()
await lex.app.resetAll()                      // clear this language's progress
```

## Layout

```
src/
  config.ts                  → LANGUAGES (code → topics → dataset filepaths; the swap point)
  data/                      → dataset files + Topic/TopicRegistry (per-language)
  domain/                    → pure classes: Dictionary, LearnSession, RecallSession,
                               MultipleChoiceQuestion, types
  storage/                   → ProgressStore interface + Dexie implementation, Settings
  app.ts                     → LearnXApp facade, one instance per language
  demo-ui/                   ⚠️ ⇢ minimal vanilla-TS example frontend (replaceable)
  console.ts                 → installs window.lex
  tests → tests/             → vitest smoke tests of the ported behaviours
```


## Pandunia support 

Demo: https://language-x-vocab-drills.vercel.app/pd

`scripts/build-pd-en.js`

This script creates the topics for Pandunia from [Panlexia repo](https://github.com/barumau/panlexia). It also attempts to sort the entries by frequency using a dataset from a movie subtitles word frequency sorter. 

Run it with `npm run build:pd-en` --this can be used to rebuild when there are updated from the [Panlexia](https://github.com/barumau/panlexia) 

To use a different output directory, pass it after --: `npm run build:pd-en -- some/dir`
