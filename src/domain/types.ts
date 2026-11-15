/**
 * Domain value types.
 *
 * These interfaces are the shared vocabulary of the app. Every class in
 * `src/domain/`, `src/storage/` and any frontend you plug in speaks them.
 */

/** The direction of a question (opaque round tokens: word→English / English→word). */
export type QuestionDirection = 'xx-en' | 'en-xx';

/**
 * One vocabulary entry from a dataset file.
 *
 * `id` is the positional index of the line in the topic's .jsonl file and is
 * the stable key used by ALL progress stores. Never reorder a dataset file:
 * saved progress would silently mis-correlate (the sessions tolerate dangling
 * ids by dropping them, but it is best avoided).
 */
export interface Entry {
  /** Positional index within the topic's dataset — the stable progress key. */
  id: number;
/** The word in the language being learned (the dataset's language-code key). */
  xx: string;
  /** Grammatical class / part of speech, e.g. "noun". May be "". */
  grammar: string;
  /**English meanings. May be empty. */
  meanings: string[];
}

/**
 * A topic is one dataset file presented as its own learning track, with its
 * own progress store keys and deep links.
 */
export interface TopicData {
  /** Unique topic id ("nouns"); scopes store keys and deep links. */
  id: string;
  /** Display label ("Nouns"). */
  label: string;
  /** Source path of the packaged dataset (registry information / display). */
  file: string;
}

/** Progress statistics for one topic, as shown on the landing page. */
export interface LearnedStats {
  count: number;
  total: number;
  percent: number;
}

/**
 * The immutable snapshot of a multiple-choice question, ready to render.
 * Frontends receive these — never the live question object — so a React/
 * Solid/Alpine renderer can treat it as props.
 */
export interface QuestionView {
  prompt: string;
  options: string[];
  correct: string;
  /** The option the learner picked, or null before picking. */
  picked: string | null;
  /** Whether the picked option was correct (+1 pick has happened). */
  wasRight: boolean;
}

/** The phase a LearnSession is in. */
export type LearnPhase = 'loading' | 'review' | 'quiz';

/** The phase a RecallSession is in. */
export type RecallPhase = 'loading' | 'empty' | 'quiz' | 'done';
