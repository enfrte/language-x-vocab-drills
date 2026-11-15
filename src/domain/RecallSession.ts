/**
 * RecallSession — the "recall words" stage for one topic.
 *
 * Tests every word of the topic's "learned" store, English -> language.
 * The queue starts at the lowest topic id (frequency order) or at the saved
 * recall index of a previous session left partway through. The saved index
 * refers to the word's position in the canonical (frequency-ordered) learned
 * list — NOT the live practice queue, which reshuffles as words are answered.
 *
 * The re-queue rules (from the original app, preserved):
 *   correct answer -> the word moves to the last position of the queue
 *   wrong answer   -> the word moves 5 places after the current position
 * When the queue drains, the saved index resets to 0.
 */

import { Dictionary, meaningText, shuffle } from './Dictionary';
import { MultipleChoiceQuestion } from './MultipleChoiceQuestion';
import type { LanguageConfig } from '../config';
import type { Entry, QuestionDirection, RecallPhase } from './types';
import type { ProgressStore } from '../storage/ProgressStore';
import { StoreKeys } from '../storage/StoreKeys';

const REQUEUE_DISTANCE = 5;

function ascending(a: number, b: number): number {
  return a - b;
}

export class RecallSession {
  readonly topicId: string;
  private readonly keys: StoreKeys;
  private readonly language: LanguageConfig;
  private readonly dictionary: Dictionary;
  private readonly store: ProgressStore;

  private _phase: RecallPhase = 'loading';
  /** Canonical practice order — the topic's learned ids, sorted ascending. */
  private origin: number[] = [];
  /** Dictionary ids in the current practice order. */
  private queue: number[] = [];
  /** Position of the current word in the queue. */
  private pos = 0;
  private question: MultipleChoiceQuestion | null = null;
  private _answered = 0;
  private _correct = 0;

  constructor(
    topicId: string,
    language: LanguageConfig,
    dictionary: Dictionary,
    store: ProgressStore,
  ) {
    this.topicId = topicId;
    this.language = language;
    this.keys = new StoreKeys(language.code, topicId);
    this.dictionary = dictionary;
    this.store = store;
  }

  // ---- state exposed to frontends -------------------------------------------

  get phase(): RecallPhase {
    return this._phase;
  }

  /** Snapshot of the current question for renderers, or null. */
  get questionView() {
    return this.question ? this.question.toView() : null;
  }

  get queueLength(): number {
    return this.queue.length;
  }

  get answeredCount(): number {
    return this._answered;
  }

  get correctCount(): number {
    return this._correct;
  }

  // ---- the loop --------------------------------------------------------------

  /** Loads the learned list and the resume position, then asks the first question. */
  async setup(): Promise<void> {
    const learned = await this.store.loadIds(this.keys.learneds);
    if (!learned.length) {
      this._phase = 'empty';
      return;
    }
    this.origin = learned.slice().sort(ascending);
    this.queue = this.origin.slice();
    // Resume at the saved progress index, clamped in case the learned set has
    // changed since the index was stored.
    const saved = await this.store.loadNumber(this.keys.recallIndex);
    this.pos = saved !== null ? Math.min(Math.max(saved, 0), this.queue.length - 1) : 0;
    this.updateQuestion();
    this._phase = 'quiz';
  }

  private updateQuestion(): void {
    const entry: Entry | undefined = this.dictionary.word(this.queue[this.pos]);
    if (!entry) {
      // Dangling id (the dictionary changed since the id was stored):
      // drop the word from the queue and retry.
      this.queue.splice(this.pos, 1);
      if (this.pos >= this.queue.length) this.pos = 0;
      if (!this.queue.length) {
        this.question = null;
        this._phase = 'done';
        void this.store.saveNumber(this.keys.recallIndex, 0);
        return;
      }
      this.updateQuestion();
      return;
    }
    const options = [entry.xx];
    for (const decoy of this.dictionary.distractors(entry)) {
      options.push(decoy.xx);
    }
    // The word now being asked becomes the resume position, recorded by its
    // index in the canonical learned order (not the live queue order).
    const index = this.origin.indexOf(entry.id);
    void this.store.saveNumber(this.keys.recallIndex, index === -1 ? this.pos : index);
    const prompt = `How do you say “${meaningText(entry)}” (${entry.grammar}) in ${this.language.name}?`;
    this.question = new MultipleChoiceQuestion('en-xx' as QuestionDirection, prompt, shuffle(options), entry.xx);
  }

  /**
   * Records the learner's pick on the current question. Returns true/false,
   * or null when nothing was answerable (no question / already picked).
   */
  answer(option: string): boolean | null {
    if (!this.question || this.question.answered) return null;
    const right = this.question.answer(option);
    if (right === null) return null;
    this._answered++;
    if (right) this._correct++;
    return right;
  }

  /**
   * Applies the re-queue rules for the answered word, then either completes
   * the session (queue empty) or asks the next question. Resolves after the
   * relevant persistence has finished.
   */
  async advance(): Promise<void> {
    if (!this.question || !this.question.answered) return;
    const wasRight = this.question.wasRight;
    // Splice the current word out; the next word slides into this position.
    const [entry] = this.queue.splice(this.pos, 1);
    if (this.pos >= this.queue.length) this.pos = 0;
    if (wasRight) {
      // Correct: move the word to the last position of the queue.
      this.queue.push(entry);
    } else {
      // Wrong: move it a few places after the current position (it will
      // resurface soon, but after other words).
      const insertAt = Math.min(this.pos + REQUEUE_DISTANCE, this.queue.length);
      this.queue.splice(insertAt, 0, entry);
    }
    if (!this.queue.length) {
      this.question = null;
      this._phase = 'done';
      await this.store.saveNumber(this.keys.recallIndex, 0);
      return;
    }
    this.updateQuestion();
  }
}
