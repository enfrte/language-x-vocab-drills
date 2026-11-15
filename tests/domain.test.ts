/**
 * Smoke tests that mirror the domain behaviour documented for the original
 * learn-maori app — the port must behave the same way.
 *
 * The tests use the packaged Māori nouns dataset directly, which also proves
 * the domain is generic over languages.
 */

import { describe, expect, it } from 'vitest';
import { LANGUAGES, type LanguageConfig } from '../src/config';
import { createTopicRegistry, topicIdOf } from '../src/data/registry';
import { Dictionary, meaningText } from '../src/domain/Dictionary';
import { LearnSession } from '../src/domain/LearnSession';
import { RecallSession } from '../src/domain/RecallSession';
import { StoreKeys } from '../src/storage/StoreKeys';
import { InMemoryProgressStore } from './InMemoryProgressStore';
import nounsDataset from '../src/data/datasets/mi/mi-en-dic-nouns.jsonl?raw';

const MI_LANGUAGE: LanguageConfig = LANGUAGES['mi'];

const dictionary = new Dictionary(nounsDataset, MI_LANGUAGE.code);

describe('Dictionary', () => {
  it('parses entries with positional ids and grammar groups', () => {
    expect(dictionary.wordCount).toBeGreaterThan(10);
    const first = dictionary.word(0)!;
    expect(first.id).toBe(0);
    expect(typeof first.xx).toBe('string');
    dictionary.group('noun').forEach((entry) => expect(entry.grammar).toBe('noun'));
  });

  it('renders multi-meaning entries as a numbered list', () => {
    const entry = dictionary.word(1)!;
    if (entry.meanings.length > 1) {
      expect(meaningText(entry)).toContain('1. ');
    }
  });

  it('reads the word from the language-code key of the dataset', () => {
    const finnishDataset = '{"fi":"talo","gr":"noun","en":["house"]}';
    const finnish = new Dictionary(finnishDataset, 'fi');
    expect(finnish.word(0)!.xx).toBe('talo');
    expect(finnish.word(0)!.meanings).toEqual(['house']);
  });

  it('picks unseen words in dictionary order, excluding learned ids', () => {
    const picks = dictionary.pickUnseen(3, [0, 1]);
    expect(picks.map((e) => e.id)).toEqual([2, 3, 4]);
  });

  it('returns decoys that are never the entry itself', () => {
    const entry = dictionary.word(0)!;
    for (const decoy of dictionary.distractors(entry, 3)) {
      expect(decoy.id).not.toBe(0);
      expect(decoy.xx).not.toBe(entry.xx);
    }
  });
});

describe('Topic registry', () => {
  it('builds one topic per configured entry, ids derived from labels', async () => {
    const finnish = LANGUAGES['fi'];
    const registry = await createTopicRegistry(finnish);
    const ids = registry.all().map((topic) => topic.id);
    expect(ids).toEqual(Object.keys(finnish.topics).map(topicIdOf));
  });

  it('throws a clear error when a configured dataset file is missing', async () => {
    const bogus: LanguageConfig = {
      code: 'fi',
      name: 'Finnish',
      source: 'en',
      topics: { 'Ghosts': 'data/datasets/fi/fi-en-nope.jsonl' },
    };
    await expect(createTopicRegistry(bogus)).rejects.toThrow(/not found/);
  });
});

describe('LearnSession', () => {
  it('runs the full loop: review -> quiz both rounds -> batch promoted to learned', async () => {
    const store = new InMemoryProgressStore();
    const session = new LearnSession('nouns', MI_LANGUAGE, dictionary, store);
    await session.setup();
    expect(session.phase).toBe('review');
    expect(session.batch).toHaveLength(5);

    const entry0 = dictionary.word(0)!;
    // Round 1: xx -> en (xx is the generic quiz-direction placeholder).
    session.startQuiz('xx-en');
    expect(session.phase).toBe('quiz');
    expect(session.round).toBe('xx-en');
    const q1 = session.questionView!;
    expect(q1.options).toContain(meaningText(entry0));
    expect(session.answer(q1.correct)).toBe(true);
    await session.advance();
    // Round 1 completes for all 5, then the app flips to round 2 (en -> xx)
    for (let i = 0; i < 20 && session.phase === 'quiz'; i++) {
      const q = session.questionView!;
      expect(session.answer(q.correct)).toBe(true);
      await session.advance();
    }
    // After queue drained on round 1 it restarted as 'en-xx'; both rounds
    // completed -> completeBatch ran -> back to review with a fresh batch.
    expect(session.phase).toBe('review');
    const keys = new StoreKeys('mi', 'nouns');
    const learned = await store.loadIds(keys.learneds);
    expect(learned).toEqual([0, 1, 2, 3, 4]);
    expect(await store.loadIds(keys.learnInProgress)).toEqual([5, 6, 7, 8, 9]);
  });

  it('uses the language name in en -> word prompts', async () => {
    const store = new InMemoryProgressStore();
    const session = new LearnSession('nouns', MI_LANGUAGE, dictionary, store);
    await session.setup();
    session.startQuiz('en-xx');
    expect(session.questionView!.prompt).toContain('in Māori');
  });

  it('re-queues a wrongly answered word within the round', async () => {
    const store = new InMemoryProgressStore();
    const session = new LearnSession('nouns', MI_LANGUAGE, dictionary, store);
    await session.setup();
    session.startQuiz('en-xx');
    const question = session.questionView!;
    const wrong = question.options.find((o) => o !== question.correct)!;
    expect(session.answer(wrong)).toBe(false);
    // The wrong word is re-queued at the tail (it comes back around); the
    // head stays until "Continue" consumes it — same as the original app.
    expect(session.queueRemaining).toBe(6);
    const rightQuestion = session.questionView!;
    expect(rightQuestion.picked).toBe(wrong);
    await session.advance();
    expect(session.queueRemaining).toBe(5);
    expect(session.misses).toBe(1);
  });
});

describe('RecallSession', () => {
  it('is empty before anything is learned', async () => {
    const store = new InMemoryProgressStore();
    const session = new RecallSession('nouns', MI_LANGUAGE, dictionary, store);
    await session.setup();
    expect(session.phase).toBe('empty');
  });

  it('quizzes every learned word and never drops the queue empty', async () => {
    const store = new InMemoryProgressStore();
    const session = new RecallSession('nouns', MI_LANGUAGE, dictionary, store);
    await session.setup();
    expect(session.phase).toBe('empty');
    const keys = new StoreKeys('mi', 'nouns');
    await store.saveIds(keys.learneds, [0, 1, 2]);
    await session.setup();
    expect(session.phase).toBe('quiz');
    expect(session.queueLength).toBe(3);
    // The temporary practice session answer for a few words — the queue
    // always retains its words (right -> tail), matching the original app.
    for (let i = 0; i < 10 && session.phase === 'quiz'; i++) {
      const q = session.questionView!;
      session.answer(q.correct);
      await session.advance();
    }
    expect(session.phase).toBe('quiz'); // practice continues until reset
    expect(session.correctCount).toBe(10);
  });

  it('re-queues a wrong answer 5 places after the current position', async () => {
    const store = new InMemoryProgressStore();
    const keys = new StoreKeys('mi', 'nouns');
    await store.saveIds(keys.learneds, [0, 1, 2, 3, 4, 5, 6]);
    const session = new RecallSession('nouns', MI_LANGUAGE, dictionary, store);
    await session.setup();
    const q = session.questionView!;
    const wrong = q.options.find((o) => o !== q.correct)!;
    session.answer(wrong);
    await session.advance();
    expect(session.answeredCount).toBe(1);
    expect(session.correctCount).toBe(0);
    expect(session.queueLength).toBe(7); // the word is still in the queue
  });
});

describe('StoreKeys', () => {
  it('scopes every record key by language and topic id', () => {
    const keys = new StoreKeys('fi', 'verbs');
    expect(keys.learnInProgress).toBe('in-progress:fi:verbs');
    expect(keys.learneds).toBe('learned:fi:verbs');
    expect(keys.recallIndex).toBe('recall-index:fi:verbs');
  });

  it('keeps different languages independent', () => {
    const finnish = new StoreKeys('fi', 'nouns');
    const maori = new StoreKeys('mi', 'nouns');
    expect(finnish.learneds).not.toBe(maori.learneds);
  });
});

describe('ProgressStore.resetAll', () => {
  it('clears only the given language, keeping the others', async () => {
    const store = new InMemoryProgressStore();
    await store.saveIds(new StoreKeys('fi', 'verbs').learneds, [1, 2]);
    await store.saveIds(new StoreKeys('mi', 'nouns').learneds, [3]);
    await store.saveNumber(new StoreKeys('fi', 'verbs').recallIndex, 7);

    await store.resetAll('fi');

    expect(await store.loadIds(new StoreKeys('fi', 'verbs').learneds)).toEqual([]);
    expect(await store.loadNumber(new StoreKeys('fi', 'verbs').recallIndex)).toBeNull();
    expect(await store.loadIds(new StoreKeys('mi', 'nouns').learneds)).toEqual([3]);
  });
});
