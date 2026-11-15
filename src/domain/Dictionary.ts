/**
 * The Dictionary class — parses and inspects one topic's vocabulary.
 *
 * Pure TypeScript: no DOM, no framework, no storage. It takes the raw text of
 * a packaged .jsonl file (one JSON object per line) and the language's word
 * key (the ISO 639-1 code, e.g. "fi" — the JSON key holding the word), and builds:
 *
 *   words    — all entries in dictionary (frequency) order, with positional ids
 *   groups   — Map of grammatical class ("noun") to entries of that class
 *
 * The grammatical groups exist for multiple-choice decoy selection: distractors
 * of the same word class feel more plausible than random ones.
 */

import type { Entry, LearnedStats } from './types';

/** Shuffles a copy of the array (Fisher–Yates). The input is never touched. */
export function shuffle<T>(items: readonly T[]): T[] {
  const copy = items.slice();
  let i = copy.length - 1;
  while (i > 0) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
    i--;
  }
  return copy;
}

/**
 * Renders the meanings of an entry as one string:
 *   0 meanings -> ""  ·  1 -> the meaning  ·  n -> "1. x, 2. y, ... "
 * (In the original this helper was duplicated in each stage file.)
 */
export function meaningText(entry: Entry): string {
  if (entry.meanings.length === 0) return '';
  if (entry.meanings.length === 1) return entry.meanings[0];
  return entry.meanings.map((meaning, i) => `${i + 1}. ${meaning}`).join(', ');
}

export class Dictionary {
  private readonly entries: Entry[] = [];
  private readonly grammarGroups = new Map<string, Entry[]>();

  constructor(
    rawText: string,
    /** The dataset's JSON key for the learned word — the language code ("fi"). */
    wordKey: string,
  ) {
    this.parse(rawText, wordKey);
  }

  private parse(text: string, wordKey: string): void {
    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;
      const item = JSON.parse(line) as Record<string, unknown>;
      const entry: Entry = {
        id: this.entries.length,
        xx: String(item[wordKey] ?? ''),
        grammar: String(item['gr'] ?? ''),
        meanings: Array.isArray(item['en']) ? (item['en'] as string[]) : [],
      };
      this.entries.push(entry);
      const group = this.grammarGroups.get(entry.grammar) ?? [];
      group.push(entry);
      this.grammarGroups.set(entry.grammar, group);
    }
  }

  /** All entries in dictionary (frequency) order. */
  get words(): Entry[] {
    return this.entries.slice();
  }

  get wordCount(): number {
    return this.entries.length;
  }

  /** Single-word lookup by positional id. */
  word(id: number): Entry | undefined {
    return this.entries[id];
  }

  /** Map stored ids to entries, skipping ids that no longer resolve. */
  entriesFor(ids: readonly number[]): Entry[] {
    const entries: Entry[] = [];
    for (const id of ids) {
      const word = this.word(id);
      if (word) entries.push(word);
    }
    return entries;
  }

  /** Entries grouped by grammatical class. */
  group(grammar: string): Entry[] {
    return this.grammarGroups.get(grammar) ?? [];
  }

  /** Map entries to their stable positional ids (used whenever progress is saved). */
  static toIds(entries: readonly Entry[]): number[] {
    return entries.map((entry) => entry.id);
  }

  /** Count / total / percent for a learned-id list. */
  learnedStats(learnedIds: readonly number[]): LearnedStats {
    const total = this.wordCount;
    const count = learnedIds.length;
    const percent = total ? Math.round((count * 100) / total) : 0;
    return { count, total, percent };
  }

  /**
   * Picks n words the student has not seen yet, in dictionary (frequency)
   * order — deliberately deterministic, matching the original app's behaviour
   * (there, `shuffle(unseen)` was commented out; keep it that way unless
   * intentional).
   */
  pickUnseen(n: number, excluded: readonly number[]): Entry[] {
    const excludedSet = new Set(excluded);
    const unseen: Entry[] = [];
    for (const entry of this.entries) {
      if (excludedSet.has(entry.id)) continue;
      unseen.push(entry);
    }
    return unseen.slice(0, n);
  }

  /**
   * Multiple-choice decoys for an entry: never the entry itself, never its
   * word or its English meaning. Prefers words of the same grammatical class,
   * falls back to any word in the dictionary.
   */
  distractors(entry: Entry, want = 3): Entry[] {
    const picks: Entry[] = [];
    const usedXx = new Set<string>([entry.xx]);
    const usedMeaning = new Set<string>([meaningText(entry)]);

    const addPicks = (pool: readonly Entry[]): void => {
      for (const candidate of shuffle(pool)) {
        if (picks.length >= want) break;
        if (usedXx.has(candidate.xx) || usedMeaning.has(meaningText(candidate))) continue;
        usedXx.add(candidate.xx);
        usedMeaning.add(meaningText(candidate));
        picks.push(candidate);
      }
    };

    addPicks(this.group(entry.grammar));
    if (picks.length < want) addPicks(this.words);
    return picks;
  }
}
