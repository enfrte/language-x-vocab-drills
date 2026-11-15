/**
 * LearnSession — the "learn words" stage for one topic.
 *
 * The loop of the original application, preserved exactly:
 *
 *   resume stored batch (or pick the next LEARN_BATCH_SIZE unseen words)
 *     -> REVIEW the words on screen
 *     -> QUIZ round 'xx-en'  (word -> English; misses re-queue at the end)
 *     -> QUIZ round 'en-xx'  (English -> word; misses re-queue at the end)
 *     -> COMPLETE: batch ids are merged into the topic's "learned" store and
 *        the batch slot cleared; a fresh batch of unseen words is chosen and
 *        saved as the new "in-progress" batch. Repeats until the topic is
 *        exhausted (batch stays empty -> the UI shows a done message).
 *
 * This class is async on purpose: it persists progress after every meaningful
 * event, so a reload mid-batch resumes cleanly.
 */

import { LEARN_BATCH_SIZE } from '../config';
import type { LanguageConfig } from '../config';
import { Dictionary, meaningText, shuffle } from './Dictionary';
import { MultipleChoiceQuestion } from './MultipleChoiceQuestion';
import type { Entry, LearnPhase, QuestionDirection } from './types';
import type { ProgressStore } from '../storage/ProgressStore';
import { StoreKeys } from '../storage/StoreKeys';

export class LearnSession {
  readonly topicId: string;
  private readonly keys: StoreKeys;
  private readonly language: LanguageConfig;
  private readonly dictionary: Dictionary;
  private readonly store: ProgressStore;

  private _phase: LearnPhase = 'loading';
  private _round: QuestionDirection = 'xx-en';
  /** The entries of the current batch (the words under review/quiz). */
  private _batch: Entry[] = [];
  /** Entries of the batch still to recall in the current round. */
  private queue: Entry[] = [];
  private question: MultipleChoiceQuestion | null = null;
  private _misses = 0;

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

  get phase(): LearnPhase {
    return this._phase;
  }

  get round(): QuestionDirection {
    return this._round;
  }

  get batch(): Entry[] {
    return this._batch.slice();
  }

  /** Entries still awaiting a correct answer in the current round. */
  get queueRemaining(): number {
    return this.queue.length;
  }

  get misses(): number {
    return this._misses;
  }

  /** Snapshot of the current question for renderers, or null. */
  get questionView() {
    return this.question ? this.question.toView() : null;
  }

  /** True when the whole topic's vocabulary has been learned. */
  get isTopicComplete(): boolean {
    return this._batch.length === 0;
  }

  // ---- the loop --------------------------------------------------------------

  /**
   * Loads or resumes the batch. Called once when the session is opened; a
   * stored batch is resumed, otherwise a new batch is picked and saved.
   */
  async setup(): Promise<void> {
    const storedIds = await this.store.loadIds(this.keys.learnInProgress);
    const learnedIds = await this.store.loadIds(this.keys.learneds);
    const ids = storedIds.length ? storedIds : Dictionary.toIds(this.dictionary.pickUnseen(LEARN_BATCH_SIZE, learnedIds));
    this._batch = this.dictionary.entriesFor(ids);
    if (!storedIds.length) {
      await this.store.saveIds(this.keys.learnInProgress, ids);
    }
    this._phase = 'review';
  }

  /** Starts a quiz round over the current batch ('xx-en' first, then 'en-xx'). */
  startQuiz(round: QuestionDirection): void {
    this.queue = this.batch.slice();
    this._round = round;
    this._misses = 0;
    this._phase = 'quiz';
    void this.nextQuestion();
  }

  private async nextQuestion(): Promise<void> {
    if (!this.queue.length) {
      // The round just finished. Run the reverse round, then complete the batch.
      if (this._round === 'xx-en') {
        this.startQuiz('en-xx');
        return;
      }
      return this.completeBatch();
    }
    const entry = this.queue[0];
    if (this._round === 'xx-en') {
      const options = [meaningText(entry)];
      for (const decoy of this.dictionary.distractors(entry)) {
        options.push(meaningText(decoy));
      }
      this.question = new MultipleChoiceQuestion(
        this._round,
        `What does “${entry.xx}” (${entry.grammar}) mean?`,
        shuffle(options),
        meaningText(entry),
      );
    } else {
      const options = [entry.xx];
      for (const decoy of this.dictionary.distractors(entry)) {
        options.push(decoy.xx);
      }
      this.question = new MultipleChoiceQuestion(
        this._round,
        `What does “${meaningText(entry)}” (${entry.grammar}) mean in ${this.language.name}?`,
        shuffle(options),
        entry.xx,
      );
    }
  }

  /**
   * Records the learner's pick on the current question. A wrongly answered
   * word is re-queued at the end of `queue` (it must be answered correctly
   * before the round can end). Returns true/false, or null when nothing was
   * answerable (no question / already picked).
   */
  answer(option: string): boolean | null {
    if (!this.question || this.question.answered) return null;
    const right = this.question.answer(option);
    if (right === null) return null;
    if (!right) {
      this._misses++;
      this.queue.push(this.queue[0]);
    }
    return right;
  }

  /**
   * Consumes the head word — whether right or wrong (a wrong one was already
   * re-queued by `answer()`) — and asks the next question. Resolves after any
   * batch-completion persistence has finished.
   */
  async advance(): Promise<void> {
    if (this._phase !== 'quiz' || !this.question || !this.question.answered) return;
    this.queue.shift();
    this.question = null;
    await this.nextQuestion();
  }

  /**
   * Promotes the batch: merge batch ids into the learned store (deduped),
   * clear the in-progress batch slot, then pick and store the next batch of
   * unseen words. When the dictionary is exhausted the batch stays empty.
   */
  private async completeBatch(): Promise<void> {
    this._phase = 'review'; // guards against repeated calls while saving
    const learnedIds = await this.store.loadIds(this.keys.learneds);
    const learnedSet = new Set(learnedIds);
    for (const entry of this._batch) {
      if (!learnedSet.has(entry.id)) {
        learnedSet.add(entry.id);
        learnedIds.push(entry.id);
      }
    }
    await this.store.saveIds(this.keys.learneds, learnedIds);
    await this.store.saveIds(this.keys.learnInProgress, []);
    const unseenIds = Dictionary.toIds(this.dictionary.pickUnseen(LEARN_BATCH_SIZE, learnedIds));
    await this.store.saveIds(this.keys.learnInProgress, unseenIds);
    this._batch = this.dictionary.entriesFor(unseenIds);
  }
}
