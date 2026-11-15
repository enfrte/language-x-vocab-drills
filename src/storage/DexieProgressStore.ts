/**
 * The Dexie implementation of ProgressStore.
 *
 * One Dexie database table named "progress", keyed by the store key string.
 * Because ids are strings, every record is a plain object:
 *
 *   { key: "in-progress:fi:verbs", ids: [0, 1, 2, 3, 4] }
 *   { key: "recall-index:mi:nouns", value: 12 }
 *
 * Keys are language-scoped (see StoreKeys), so several languages can share
 * this one database without their progress colliding. The database name
 * derives from APP_NAME ("learn-language-x").
 */

import Dexie from 'dexie';
import { APP_NAME } from '../config';
import type { ProgressStore } from './ProgressStore';

class ProgressDexie extends Dexie {
  progress!: Dexie.Table<{ key: string; ids?: number[]; value?: number }, string>;

  constructor() {
    super(APP_NAME);
    this.version(1).stores({ progress: 'key' });
  }
}

export class DexieProgressStore implements ProgressStore {
  private readonly db = new ProgressDexie();

  async loadIds(key: string): Promise<number[]> {
    const record = await this.db.progress.get(key);
    return record && Array.isArray(record.ids) ? record.ids.slice() : [];
  }

  async saveIds(key: string, ids: readonly number[]): Promise<void> {
    await this.db.progress.put({ key, ids: ids.slice() });
  }

  async loadNumber(key: string): Promise<number | null> {
    const record = await this.db.progress.get(key);
    return record && typeof record.value === 'number' ? record.value : null;
  }

  async saveNumber(key: string, value: number): Promise<void> {
    await this.db.progress.put({ key, value });
  }

  /** Deletes every record of one language, keeping the other languages intact. */
  async resetAll(languageCode: string): Promise<void> {
    const needle = `:${languageCode}:`;
    const doomed = await this.db.progress
      .filter((record) => record.key.includes(needle))
      .primaryKeys();
    await this.db.progress.bulkDelete(doomed);
  }
}
