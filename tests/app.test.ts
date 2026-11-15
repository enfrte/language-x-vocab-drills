/**
 * Integration tests for the app facade: the real per-language wiring
 * (config → registry → dictionaries → store keys), using the actual bundled
 * datasets via the same lazy loaders the browser uses.
 */

import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { LANGUAGES } from '../src/config';
import { StoreKeys } from '../src/storage/StoreKeys';
import { InMemoryProgressStore } from './InMemoryProgressStore';

describe('LearnXApp', () => {
  it('builds the Finnish registry from the config', async () => {
    const app = await createApp('fi', new InMemoryProgressStore());
    expect(app.config.code).toBe('fi');
    expect(app.config.name).toBe('Finnish');
    const ids = app.topics.all().map((topic) => topic.id);
    expect(ids).toEqual(['verbs', 'adjectives', 'adverbs', 'pronouns', 'suffixes']);
    // Unlisted files on disk are ignored — the 11 MB nouns dataset is not
    // registered.
    expect(ids).not.toContain('nouns');
    // The dataset text was really loaded (lazy chunk) and parsed.
    expect(app.dictionary('verbs').wordCount).toBeGreaterThan(1000);
    expect(app.dictionary('verbs').word(0)!.xx.length).toBeGreaterThan(0);
  });

  it('builds the Māori registry from its own datasets', async () => {
    const app = await createApp('mi', new InMemoryProgressStore());
    expect(app.config.name).toBe('Māori');
    expect(app.topics.all().map((topic) => topic.id)).toEqual(['nouns', 'verbs', 'adjectives', 'adverbs']);
    expect(app.dictionary('nouns').word(0)!.xx).toBe('tangata');
  });

  it('keeps languages and topics independent in the store keys', async () => {
    const store = new InMemoryProgressStore();
    const finnish = await createApp('fi', store);
    const maori = await createApp('mi', store);

    await finnish.openLearn('verbs');
    await maori.openLearn('nouns');
    const finnishLearn = await store.loadIds(new StoreKeys('fi', 'verbs').learnInProgress);
    const maoriLearn = await store.loadIds(new StoreKeys('mi', 'nouns').learnInProgress);
    expect(finnishLearn).toHaveLength(5);
    expect(maoriLearn).toHaveLength(5);

    // Resetting one language leaves the other untouched.
    await finnish.resetAll();
    expect(await store.loadIds(new StoreKeys('fi', 'verbs').learnInProgress)).toEqual([]);
    expect(await store.loadIds(new StoreKeys('mi', 'nouns').learnInProgress)).toHaveLength(5);
  });

  it('falls back to the first topic for unknown topic ids', async () => {
    const app = await createApp('fi', new InMemoryProgressStore());
    await app.openLearn('no-such-topic');
    expect(app.topicId).toBe('verbs');
    expect(app.view).toBe('learn');
  });

  it('rejects unsupported language codes', async () => {
    await expect(createApp('xx')).rejects.toThrow(/Unknown language code/);
    await expect(createApp('../../etc')).rejects.toThrow(/Unknown language code/);
  });

  it('reflects the configured languages', () => {
    expect(Object.keys(LANGUAGES)).toEqual(['fi', 'mi']);
  });
});
