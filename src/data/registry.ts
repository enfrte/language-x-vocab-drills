/**
 * The topic registry — the dataset swap point.
 *
 * Topics are configured per language in `src/config.ts` (LANGUAGES[code].topics,
 * a label → filepath map). Adding a topic to a language is a one-line config
 * change: nothing else changes, because sessions, store keys, deep links,
 * statistics and both stages are generic over the registry.
 *
 * The raw .jsonl texts are bundled at build time with Vite's
 * `import.meta.glob(..., { query: '?raw' })` — the files' text is part of the
 * JavaScript bundle (one lazy chunk per dataset file, precached by the PWA
 * service worker), which is what makes the PWA work fully offline. Only the
 * filepaths listed in the config are registered; other files on disk are
 * never fetched.
 */

import { type LanguageConfig } from '../config';
import { Topic } from './topic';

const DATASET_LOADERS = import.meta.glob<string>(
  '/src/data/datasets/**/*.jsonl',
  { query: '?raw', import: 'default' },
);

/** Derives the topic id from its label: "Adjectives" → "adjectives". */
export function topicIdOf(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, '-');
}

/**
 * Holds the topics of one language as instances of the Topic class. Lookups
 * accept either the topic id string (used in deep links and store keys) or a
 * Topic instance — `normalize()` reduces both to the id.
 */
export class TopicRegistry {
  private readonly topics: Topic[] = [];
  private readonly byId = new Map<string, Topic>();

  add(topic: Topic): void {
    this.topics.push(topic);
    this.byId.set(topic.id, topic);
  }

  /** All topics in registry (config / frequency-mix) order. */
  all(): Topic[] {
    return this.topics.slice();
  }

  /** Normalize an argument that is either a Topic instance or a topic id. */
  normalize(topic: Topic | string): string {
    return typeof topic === 'object' ? topic.id : topic;
  }

  /** Look up a topic by id, or null when unknown (unknown ids fall back safely). */
  byIdOf(id: string): Topic | null {
    return this.byId.get(id) ?? null;
  }

  /** The registry's "home" topic (the first registered one). */
  first(): Topic {
    return this.topics[0];
  }
}

/**
 * Builds the topic registry of one language from its config: the topics map
 * ("Adjectives" → "data/datasets/fi/fi-en-adjectives.jsonl") is resolved
 * against the bundled dataset chunks and turned into Topic instances.
 * Async because each dataset text is a lazily fetched build-time chunk.
 */
export async function createTopicRegistry(language: LanguageConfig): Promise<TopicRegistry> {
  const registry = new TopicRegistry();
  const seen = new Set<string>();
  for (const [label, filePath] of Object.entries(language.topics)) {
    const id = topicIdOf(label);
    if (seen.has(id)) {
      throw new Error(`Duplicate topic id "${id}" for language "${language.code}" (label "${label}")`);
    }
    seen.add(id);
    const key = `/src/${filePath.replace(/^\/+/, '')}`;
    const loader = DATASET_LOADERS[key];
    if (loader === undefined) {
      throw new Error(
        `Topic "${label}" of language "${language.code}": dataset file not found: ${filePath}`,
      );
    }
    registry.add(new Topic({ id, label, file: filePath }, await loader()));
  }
  return registry;
}
