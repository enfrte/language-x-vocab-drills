/**
 * The persistence contract (an interface, used like an abstract class in
 * other languages).
 *
 * Everything that touches the network, the DOM or IndexedDB lives behind a
 * small interface like this one. The domain classes call it; any frontend
 * never does. A different implementation (localStorage, remote API…) can be
 * swapped in without changing a single line of the domain.
 */

export interface ProgressStore {
  /** Reads the string-list record for a key, or [] when absent/corrupt. Returns a copy. */
  loadIds(key: string): Promise<number[]>;
  /** Writes the string-list record for a key. */
  saveIds(key: string, ids: readonly number[]): Promise<void>;
  /** Reads the number record for a key, or null when absent/not a number. */
  loadNumber(key: string): Promise<number | null>;
  /** Writes the number record for a key. */
  saveNumber(key: string, value: number): Promise<void>;
  /** Clears one language's progress (every topic of that language at once). */
  resetAll(languageCode: string): Promise<void>;
}
