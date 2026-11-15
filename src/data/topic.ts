/**
 * The Topic class — a small "data class".
 *
 * A topic wraps one dataset file (e.g. fi-en-verbs.jsonl) and is the unit of
 * navigation: deep links (/<code>/learn/<topic>), store keys
 * (learned:<code>:<topic>) and per-topic statistics all hang off its id.
 *
 * The class exists so future topics can carry behaviour (e.g. a personalised
 * icon or description) without callers changing — they always use the
 * properties of this class.
 */

import type { TopicData } from '../domain/types';

export class Topic {
  readonly id: string;
  readonly label: string;
  readonly file: string;
  /** The raw .jsonl text, bundled at build time (Vite `?raw` import). */
  readonly rawText: string;

  constructor(data: TopicData, rawText: string) {
    this.id = data.id;
    this.label = data.label;
    this.file = data.file;
    this.rawText = rawText;
  }
}
