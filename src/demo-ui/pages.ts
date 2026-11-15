/**
 * ⚠️ DEMO FRONTEND — page renderers.
 *
 * Pure functions returning HTML strings from the app facade's state. All
 * interactions go through `data-action` attributes handled by one delegated
 * click listener in `ui.ts` — the pages themselves hold no state and add no
 * event listeners, which keeps the vanilla renderer simple.
 */

import { currentApp, type TopicSnapshot } from '../app';
import { LANGUAGES } from '../config';
import type { Topic } from '../data/topic';
import type { Entry, QuestionView } from '../domain/types';
import { meaningText } from '../domain/Dictionary';
import { Settings } from '../storage/Settings';

/** Escapes text that isn't authored HTML (dataset words, meanings, ids). */
export function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---- shared fragments ---------------------------------------------------------

function pageHead(topic: Topic, pageTitle: string): string {
  return `
    <div class="page-head">
      <button class="back" data-action="close">Back</button>
      <h1>${esc(topic.label)} · ${esc(pageTitle)}</h1>
    </div>`;
}

/** One word tile: the word, its grammatical class, its English meanings. */
function wordTile(entry: Entry): string {
  return `
    <div class="word">
      <span class="xx">${esc(entry.xx)}</span>
      <span class="gr"><i>${esc(entry.grammar)}</i></span>
      <div class="en">${esc(meaningText(entry))}</div>
    </div>`;
}

/**
 * The shared multiple-choice component (was the Imba `mcq` tag): the prompt
 * and one button per option. After a pick the correct option is green, the
 * picked-but-wrong red, the rest dimmed — and picking again is a no-op
 * (`app.answer` guards it, the buttons are only visual feedback).
 */
function mcq(question: QuestionView | null): string {
  if (!question) return '';
  const picked = question.picked;
  const buttons = question.options
    .map((option) => {
      const answered = picked !== null;
      const isRight = answered && option === question.correct;
      const isWrong = answered && picked !== question.correct && option === picked;
      const isDim = answered && !isRight && !isWrong;
      return `<div class="options-btn${isRight ? ' right' : ''}${isWrong ? ' wrong' : ''}${isDim ? ' dim' : ''}"
          data-action="opt" data-opt="${esc(option)}">${esc(option)}</div>`;
    })
    .join('');
  return `<div class="q-prompt">${esc(question.prompt)}</div><div class="word-list">${buttons}</div>`;
}

function feedback(question: QuestionView | null, okMessage: string, failMessage: string): string {
  if (!question || question.picked === null) return '';
  return `<div class="feedback${question.wasRight ? ' ok' : ''}">${
    question.wasRight ? okMessage : failMessage
  }</div>`;
}

// ---- root page: language picker ---------------------------------------------------

/** The root (/) page: one card per configured language, linking to /<code>. */
export function pickerHtml(): string {
  const cards = Object.values(LANGUAGES)
    .map(
      (language) => `
      <a class="stage-card card language-card" href="/${esc(language.code)}">
        <h2>Learn ${esc(language.name)}</h2>
        <p>${Object.keys(language.topics).length} topic${Object.keys(language.topics).length === 1 ? '' : 's'} ·
          your progress is saved automatically on this device.</p>
      </a>`,
    )
    .join('');

  return `
    <div class="hero">
      <h1>Learn a language</h1>
      <p class="lead">Vocabulary drills, one word at a time. Pick a language to get started.</p>
    </div>
    ${cards}
    <hr class="hr">
    <div class="footer">
      <button class="theme-toggle plain-btn" data-action="toggle-theme">
        ${new Settings().loadTheme() === 'dark' ? '☀️ Light mode' : '🌙 Dark mode'}
      </button>
    </div>`;
}

// ---- landing page -------------------------------------------------------------

export async function landingHtml(): Promise<string> {
  const app = currentApp();
  const snapshots: TopicSnapshot[] = await app.snapshotAll();
  const cards = snapshots
    .map(({ topic, inProgressIds, stats }) => {
      const disabled = stats.count === 0 ? 'disabled' : '';
      return `
      <div class="stage-card card">
        <h2>${esc(topic.label)}</h2>
        <p>Review new words, then test recall from word to English and back.</p>
        <div class="tracker">
          Learned ${stats.count} / ${stats.total} (${stats.percent}%) · ${inProgressIds.length} in progress
        </div>
        <div class="row">
          <button class="primary" data-action="learn" data-topic="${esc(topic.id)}">Learn new words</button>
          <button class="teal-btn ${disabled}" data-action="recall" data-topic="${esc(topic.id)}">
            Recall learned words (${stats.count})
          </button>
        </div>
      </div>`;
    })
    .join('');

  return `
    <div class="hero">
      <h1>Learn ${esc(app.config.name)}</h1>
      <p class="lead">Learn ${esc(app.config.name)}, one word at a time. Pick a topic below —
        your progress is saved automatically on this device.</p>
    </div>
    ${cards}
    <div class="card locked">
      <h2>More topics</h2>
      <p>To be announced.</p>
    </div>
    <hr class="hr">
    <div class="footer">
      <button class="danger plain-btn" data-action="reset">Reset progress</button>
      <button class="theme-toggle plain-btn" data-action="toggle-theme">
        ${app.theme === 'dark' ? '☀️ Light mode' : '🌙 Dark mode'}
      </button>
    </div>`;
}

// ---- learn page ------------------------------------------------------------------

export function learnHtml(): string {
  const app = currentApp();
  const session = app.sessionLearn;
  if (!session) return '<div class="tracker">Loading progress…</div>';
  const head = pageHead(app.topic!, 'Learn words');
  if (session.phase === 'review') {
    if (session.batch.length) {
      const tiles = session.batch.map(wordTile).join('');
      return `
        ${head}
        <h2>New words (${session.batch.length})</h2>
        <div class="word-list">${tiles}</div>
        <div class="row">
          <button class="next-btn" data-action="start-quiz" data-round="xx-en">Test me</button>
        </div>`;
    }
    return head + '<div class="tracker">You have learned every word in this topic!</div>';
  }
  // phase === 'quiz' ('loading' resolves before the page renders)
  const roundLabel = session.round === 'xx-en' ? 'Word → English' : 'English → Word';
  const question = session.questionView;
  return `
    ${head}
    <div class="tracker">${roundLabel} · ${session.queueRemaining} to go · ${session.misses} retries</div>
    ${mcq(question)}
    ${feedback(question, 'Correct!', 'It will come back around in a moment.')}
    ${
      question && question.picked !== null
        ? '<div class="row"><button class="next-btn" data-action="advance">Continue</button></div>'
        : ''
    }`;
}

// ---- recall page -------------------------------------------------------------------

export function recallHtml(): string {
  const app = currentApp();
  const session = app.sessionRecall;
  if (!session) return '<div class="tracker">Loading progress…</div>';
  const head = pageHead(app.topic!, 'Recall words');
  if (session.phase === 'empty') {
    return head + '<div class="tracker">No learned words yet. Learn some words first.</div>';
  }
  if (session.phase === 'done') return head + '<div class="tracker">All recalls complete!</div>';
  // phase === 'quiz'
  const question = session.questionView;
  return `
    ${head}
    <div class="tracker">${session.queueLength} learned words · ${session.correctCount} correct of ${session.answeredCount} answered</div>
    ${mcq(question)}
    ${feedback(question, 'Correct!', 'Not quite — it will come back around soon.')}
    ${
      question && question.picked !== null
        ? '<div class="row"><button class="next-btn" data-action="advance">Next</button></div>'
        : ''
    }`;
}
