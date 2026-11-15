/**
 * Global application configuration.
 *
 * This is the ONLY file that hard-codes which languages are being taught.
 * To add a language: drop dataset files into `src/data/datasets/<code>/`,
 * add one entry to LANGUAGES below, and map the topics you want to expose
 * to their dataset filepaths. Files on disk that are not listed here are
 * simply ignored (not registered, not reachable in the UI).
 *
 * - `code`   — ISO 639-1 two-letter code of the language being learned ("fi").
 *              It is also the JSON key used inside the .jsonl dataset files:
 *              {"fi": "beige", "gr": "adj", "en": ["beige"]}.
 * - `name`   — display name ("How do you say X in Finnish?").
 * - `source` — the teaching language. Fixed as "en" (English) on purpose: the
 *              datasets are dictionaries in the shape <learned>-en.
 * - `topics` — the topics exposed for the language, mapped to dataset
 *              filepaths: "Adjectives" = "data/datasets/fi/fi-en-adjectives.jsonl".
 *              Card order on the landing page follows the key order.
 */

/** Configuration of one supported language. */
export interface LanguageConfig {
  /** ISO 639-1 code. Matches the dictionary field key ("fi") and the URL (/fi). */
  code: string;
  /** Human-readable name of the language being learned. */
  name: string;
  /** Teaching language (never changes in this project). */
  source: string;
  /** Topic label → dataset filepath (relative to src/, e.g. "data/datasets/fi/fi-en-verbs.jsonl"). */
  topics: Record<string, string>;
}

/**
 * The supported languages, keyed by ISO 639-1 code. The key order is the
 * order the languages appear in (e.g. on the root language picker).
 */
export const LANGUAGES: Record<string, LanguageConfig> = {
  fi: {
    code: 'fi',
    name: 'Finnish',
    source: 'en',
    topics: {
      'Nouns': 'data/datasets/fi/fi-en-nouns.jsonl',
      'Verbs': 'data/datasets/fi/fi-en-verbs.jsonl',
      'Pronouns': 'data/datasets/fi/fi-en-pronouns.jsonl',
      'Adjectives': 'data/datasets/fi/fi-en-adjectives.jsonl',
      'Adverbs': 'data/datasets/fi/fi-en-adverbs.jsonl',
      'Suffixes': 'data/datasets/fi/fi-en-suffixes.jsonl',
    },
  },
  mi: {
    code: 'mi',
    name: 'Māori',
    source: 'en',
    topics: {
      'Nouns': 'data/datasets/mi/mi-en-dic-nouns.jsonl',
      'Verbs': 'data/datasets/mi/mi-en-dic-verbs.jsonl',
      'Adjectives': 'data/datasets/mi/mi-en-dic-adjectives.jsonl',
      'Adverbs': 'data/datasets/mi/mi-en-dic-adverbs.jsonl',
    },
  },
    pd: {
    code: 'pd',
    name: 'Pandunia',
    source: 'en',
    topics: {
      'Nouns': 'data/datasets/pd/pd-en-nouns.jsonl',
      'Verbs': 'data/datasets/pd/pd-en-verbs.jsonl',
      'Adjectives': 'data/datasets/pd/pd-en-adjectives.jsonl',
      'Adverbs': 'data/datasets/pd/pd-en-adverbs.jsonl',
      'Prepositions': 'data/datasets/pd/pd-en-prepositions.jsonl',
      'Pronouns': 'data/datasets/pd/pd-en-pronouns.jsonl',
      'Particles': 'data/datasets/pd/pd-en-particles.jsonl',
      'Conjunctions': 'data/datasets/pd/pd-en-conjunctions.jsonl',
      'Interjections': 'data/datasets/pd/pd-en-interjections.jsonl',
      'Phrases': 'data/datasets/pd/pd-en-phrases.jsonl',
    },
  }
};

/** Looks up a language by ISO 639-1 code, or null when unsupported. */
export function getLanguage(code: string): LanguageConfig | null {
  return Object.prototype.hasOwnProperty.call(LANGUAGES, code) ? LANGUAGES[code] : null;
}

/** Package / Vercel project name — intentionally language-generic. */
export const APP_NAME = 'language-x-vocab-drills';

/** How many new words a Learn batch contains. */
export const LEARN_BATCH_SIZE = 5;
