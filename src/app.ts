/**
 * LearnXApp — the application facade for ONE language.
 *
 * One class that wires the pieces together (the language's topic registry,
 * dictionaries, progress store, sessions) and exposes a SMALL, boring API
 * surface that any frontend can drive from the browser console or from
 * React/Solid/Alpine:
 *
 *   app.config.code / app.config.name          which language this app teaches
 *   app.view / app.topicId / app.theme         read state
 *   await app.openLearn('verbs')               /fi/learn/verbs equivalent
 *   await app.openRecall('nouns')              /fi/recall/nouns equivalent
 *   app.close()                                back to the language landing
 *   app.answer('big')   app.advance()   app.startQuiz('xx-en')
 *   await app.snapshotAll()                    progress for the landing page
 *   app.toggleTheme()   await app.resetAll()
 *   app.subscribe(() => render())              evented for reactive UIs
 *
 * A page load serves one language (chosen from the URL, see demo-ui/ui.ts);
 * multi-language support is several app instances, not one instance with
 * switching. Commands delegate to the active session and then notify
 * subscribers. The core never renders anything and never reads the DOM
 * (persistence excepted): that is what makes it frontend-agnostic.
 */

import { LANGUAGES, type LanguageConfig } from './config';
import { createTopicRegistry, TopicRegistry } from './data/registry';
import { Topic } from './data/topic';
import { Dictionary } from './domain/Dictionary';
import { LearnSession } from './domain/LearnSession';
import { RecallSession } from './domain/RecallSession';
import type { LearnedStats, QuestionDirection } from './domain/types';
import type { ProgressStore } from './storage/ProgressStore';
import { DexieProgressStore } from './storage/DexieProgressStore';
import { Settings, type Theme } from './storage/Settings';
import { StoreKeys } from './storage/StoreKeys';

export type AppView = 'landing' | 'learn' | 'recall';
export type AppListener = () => void;

/** Everything a landing page needs about one topic. */
export interface TopicSnapshot {
  topic: Topic;
  learnedIds: number[];
  inProgressIds: number[];
  stats: LearnedStats;
}

export class LearnXApp {
  readonly language: LanguageConfig;
  readonly topics: TopicRegistry;
  private readonly store: ProgressStore;
  readonly settings = new Settings();

  private readonly listeners = new Set<AppListener>();
  private readonly dictionaries = new Map<string, Dictionary>();
  private readonly learnSessions = new Map<string, LearnSession>();
  private readonly recallSessions = new Map<string, RecallSession>();

  private _view: AppView = 'landing';
  private _topicId: string;
  private _theme: Theme;
  private learn: LearnSession | null = null;
  private recall: RecallSession | null = null;

  private constructor(
    language: LanguageConfig,
    topics: TopicRegistry,
    store: ProgressStore,
  ) {
    this.language = language;
    this.topics = topics;
    this.store = store;
    this._topicId = this.topics.first().id;
    this._theme = this.settings.loadTheme();
  }

  /**
   * Async factory: builds the language's topic registry, which fetches the
   * language's bundled dataset chunks.
   */
  static async create(languageCode: string, store?: ProgressStore): Promise<LearnXApp> {
    const language = LANGUAGES[languageCode];
    if (!language) {
      throw new Error(
        `Unknown language code "${languageCode}". Supported: ${Object.keys(LANGUAGES).join(', ')}`,
      );
    }
    return new LearnXApp(language, await createTopicRegistry(language), store ?? new DexieProgressStore());
  }

  // ---- subscriptions ---------------------------------------------------------

  /** Registers a change listener; returns an unsubscribe function. */
  subscribe(listener: AppListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Notifies every subscriber that app state may have changed. */
  notify(): void {
    for (const listener of this.listeners) listener();
  }

  // ---- read state --------------------------------------------------------------

  get view(): AppView {
    return this._view;
  }

  /** The topic id for the learn/recall views. */
  get topicId(): string {
    return this._topicId;
  }

  /** The topic the learn/recall views are showing (or null when unknown). */
  get topic(): Topic | null {
    return this.topics.byIdOf(this._topicId);
  }

  get theme(): Theme {
    return this._theme;
  }

  /** The public language configuration (code/name/source/topics) for renderers. */
  get config(): LanguageConfig {
    return this.language;
  }

  /** The active session matching the current view, or null on the landing. */
  get session(): LearnSession | RecallSession | null {
    return this._view === 'learn' ? this.learn : this.recall;
  }

  /** The active LearnSession, or null (convenience for typed renderers). */
  get sessionLearn(): LearnSession | null {
    return this.learn;
  }

  /** The active RecallSession, or null. */
  get sessionRecall(): RecallSession | null {
    return this.recall;
  }

  /** Memoized Dictionary for a topic (id string or Topic instance). */
  dictionary(topic: Topic | string): Dictionary {
    const id = typeof topic === 'object' ? topic.id : topic;
    let dictionary = this.dictionaries.get(id);
    if (!dictionary) {
      const topicRecord = this.topics.byIdOf(id);
      dictionary = new Dictionary(topicRecord ? topicRecord.rawText : '', this.language.code);
      this.dictionaries.set(id, dictionary);
    }
    return dictionary;
  }

  /** Async per-topic progress data for the landing page. */
  async snapshot(topic: Topic | string): Promise<TopicSnapshot> {
    const topicRecord: Topic =
      typeof topic === 'object' ? topic : (this.topics.byIdOf(topic) ?? this.topics.first());
    const keys = new StoreKeys(this.language.code, topicRecord.id);
    const [learnedIds, inProgressIds] = await Promise.all([
      this.store.loadIds(keys.learneds),
      this.store.loadIds(keys.learnInProgress),
    ]);
    return {
      topic: topicRecord,
      learnedIds,
      inProgressIds,
      stats: this.dictionary(topicRecord).learnedStats(learnedIds),
    };
  }

  /** Progress snapshots of every topic in registry order. */
  async snapshotAll(): Promise<TopicSnapshot[]> {
    return Promise.all(this.topics.all().map((topic) => this.snapshot(topic)));
  }

  // ---- navigation ------------------------------------------------------------

  /**
   * Opens the Learn stage for a topic (unknown ids fall back to the first
   * topic). No-op when the same Learn page is already open.
   */
  async openLearn(topicId: string): Promise<void> {
    const id = this.resolve(topicId);
    if (this._view === 'learn' && this._topicId === id) return;
    let session = this.learnSessions.get(id);
    if (!session) {
      session = new LearnSession(id, this.language, this.dictionary(id), this.store);
      this.learnSessions.set(id, session);
      await session.setup(); // resume stored batch or pick a new one
    }
    this._view = 'learn';
    this._topicId = id;
    this.learn = session;
    this.notify();
  }

  /** Opens the Recall stage for a topic ('empty' phase when nothing learned). */
  async openRecall(topicId: string): Promise<void> {
    const id = this.resolve(topicId);
    if (this._view === 'recall' && this._topicId === id) return;
    let session = this.recallSessions.get(id);
    if (!session) {
      session = new RecallSession(id, this.language, this.dictionary(id), this.store);
      this.recallSessions.set(id, session);
      await session.setup();
    }
    this._view = 'recall';
    this._topicId = id;
    this.recall = session;
    this.notify();
  }

  /** Returns to the language's landing page. */
  close(): void {
    this._view = 'landing';
    this.notify();
  }

  // ---- session commands (frontends + console) ---------------------------------

  /** Answers the current question. No-op when there is nothing to answer. */
  answer(option: string): boolean | null {
    const result = this.session?.answer(option) ?? null;
    if (result !== null) this.notify();
    return result;
  }

  /** Continues to the next question after an answer. Resolves after any
   *  persistence (batch promotion, resume index) has finished. */
  async advance(): Promise<void> {
    if (!this.session) return;
    await this.session.advance();
    this.notify();
  }

  /** Starts a Learn quiz round ('xx-en' or 'en-xx'). */
  startQuiz(round: QuestionDirection): void {
    if (this.learn) {
      this.learn.startQuiz(round);
      this.notify();
    }
  }

  // ---- settings & maintenance ---------------------------------------------------

  /** Flips the theme and persists it. Presentation (CSS class) is the UI's job. */
  toggleTheme(): void {
    this._theme = this._theme === 'light' ? 'dark' : 'light';
    this.settings.saveTheme(this._theme);
    this.notify();
  }

  /** Clears every topic's progress of THIS language and every in-memory session. */
  async resetAll(): Promise<void> {
    await this.store.resetAll(this.language.code);
    this.learnSessions.clear();
    this.recallSessions.clear();
    this.learn = null;
    this.recall = null;
    this._view = 'landing';
    this.notify();
  }

  /** Validates a topic id, falling back to the registry's first topic. */
  private resolve(topicId: string): string {
    return this.topics.byIdOf(topicId) ? topicId : this.topics.first().id;
  }
}

/** Factory for frontends that want an isolated instance (tests, multi-tab). */
export function createApp(languageCode: string, store?: ProgressStore): Promise<LearnXApp> {
  return LearnXApp.create(languageCode, store);
}

/**
 * The shared singleton used by the demo UI and the browser console. It is
 * null until the URL-selected language's app is installed (demo-ui/ui.ts
 * `setApp`); every read goes through `currentApp()`.
 */
export let app: LearnXApp | null = null;

/** Replaces the shared singleton (used when the URL selects another language). */
export function setApp(next: LearnXApp): void {
  app = next;
}

/** The active app singleton, or a clear error when none is installed yet. */
export function currentApp(): LearnXApp {
  if (!app) throw new Error('No app instance installed yet — call setApp() first.');
  return app;
}
