/**
 * Browser-console access to the whole domain layer.
 *
 * After loading the app, open DevTools and use the `lex` object, e.g.:
 *
 *   lex.app.view                    // 'landing' | 'learn' | 'recall'
 *   lex.app.config.code             // the active language ("fi")
 *   await lex.app.snapshotAll()     // progress for every topic
 *   lex.app.dictionary('verbs')     // the Dictionary instance
 *   lex.app.dictionary('verbs').wordCount
 *   lex.app.dictionary('verbs').pickUnseen(5, [])
 *   await lex.app.openLearn('verbs')
 *   lex.app.answer('house'); lex.app.advance()
 *   await lex.app.resetAll()
 *
 * `lex.app` is a live getter: it always points at the app singleton of the
 * language the page is currently serving.
 */

import { currentApp } from './app';
import { Dictionary, meaningText, shuffle } from './domain/Dictionary';

export const CONSOLE_API_NAME = 'lex';

/** Attaches the console API to the global object (idempotent). */
export function installConsoleApi(target: object = globalThis): void {
  Object.defineProperty(target, CONSOLE_API_NAME, {
    value: Object.freeze({
      get app() {
        return currentApp();
      },
      get config() {
        return currentApp().config;
      },
      Dictionary,
      meaningText,
      shuffle,
    }),
    writable: false,
    configurable: true,
  });
  console.info(
    `[${CONSOLE_API_NAME}] Console API installed — try ${CONSOLE_API_NAME}.app.snapshotAll()`,
  );
}
