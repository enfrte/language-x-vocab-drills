/**
 * An in-memory ProgressStore for tests — proof that the domain depends only
 * on the ProgressStore interface, never on Dexie/IndexedDB itself.
 */

import type { ProgressStore } from '../src/storage/ProgressStore';

export class InMemoryProgressStore implements ProgressStore {
  public ids = new Map<string, number[]>();
  public numbers = new Map<string, number>();

  loadIds(key: string): Promise<number[]> {
    return Promise.resolve(this.ids.get(key) ? this.ids.get(key)!.slice() : []);
  }

  async saveIds(key: string, ids: readonly number[]): Promise<void> {
    this.ids.set(key, ids.slice());
  }

  loadNumber(key: string): Promise<number | null> {
    const value = this.numbers.get(key);
    return Promise.resolve(typeof value === 'number' ? value : null);
  }

  async saveNumber(key: string, value: number): Promise<void> {
    this.numbers.set(key, value);
  }

  /** Clears one language's records, keeping the other languages intact. */
  async resetAll(languageCode: string): Promise<void> {
    const needle = `:${languageCode}:`;
    for (const key of [...this.ids.keys()]) {
      if (key.includes(needle)) this.ids.delete(key);
    }
    for (const key of [...this.numbers.keys()]) {
      if (key.includes(needle)) this.numbers.delete(key);
    }
  }
}
