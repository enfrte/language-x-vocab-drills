#!/usr/bin/env node
/**
 * Builds Pandunia -> English datasets (JSONL) from the Panlexia dictionaries.
 *
 * Usage:
 *   node build-pd-en.js [outDir] [--eng eng.tsv] [--pd pandunia.tsv]
 *                       [--freq freq.txt] [--rank] [--no-merge]
 *
 * Without --eng / --pd the files are downloaded from GitHub (Node 18+).
 * The frequency list (en_50k.txt) is read from the script's directory if it is
 * there; otherwise it is downloaded and saved there. --freq overrides this.
 *
 * Frequency sorting: an English frequency list (one "word count" per line,
 * most frequent first) gives each English word a rank. An entry's rank is the
 * rank of its most frequent English translation. Entries, and the "en" arrays
 * inside them, are sorted by that rank; unranked ones go last (alphabetically).
 * Entries of the same word class whose English lists are identical are merged
 * into one line with a comma separated "pd" (e.g. "sal, salam, salut"), so a
 * learner is never shown several answers for the same set of translations.
 * --no-merge turns this off.
 * --rank adds the rank to each line as "rank" (omitted when unranked).
 *
 * Output: one file per word class in outDir (default ./out), e.g.
 *   pd-en-nouns.jsonl, pd-en-verbs.jsonl, pd-en-adjectives.jsonl ...
 * Each line: {"pd":"pandunia word","gr":"adj","en":["Eng 1","Eng 2"]}
 *
 * Panlexia dictionaries are CC BY 4.0, by Risto Kupsala et al.
 * https://github.com/barumau/panlexia
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://raw.githubusercontent.com/barumau/panlexia/refs/heads/master/dict';
const ENG_URL = `${BASE}/E/eng.tsv`;
const PD_URL = `${BASE}/P/pandunia.tsv`;
// English word frequencies from OpenSubtitles (hermitdave/FrequencyWords, CC BY-SA 4.0)
const FREQ_URL =
  'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt';
// Local copy of the frequency list, kept next to this script
const FREQ_LOCAL = path.join(path.dirname(fileURLToPath(import.meta.url)), 'en_50k.txt');

// Word class id (the part of the concept id before the optional number)
// -> label written to "gr" and the name used in the output file.
// WordNet "s" (satellite adjective) is merged into adjectives.
const CLASSES = {
  n:    { gr: 'n',    file: 'nouns' },
  v:    { gr: 'v',    file: 'verbs' },
  a:    { gr: 'adj',  file: 'adjectives' },
  s:    { gr: 'adj',  file: 'adjectives' },
  r:    { gr: 'adv',  file: 'adverbs' },
  pro:  { gr: 'pro',  file: 'pronouns' },
  pp:   { gr: 'pp',   file: 'prepositions' },
  cnj:  { gr: 'cnj',  file: 'conjunctions' },
  int:  { gr: 'int',  file: 'interjections' },
  ptcl: { gr: 'ptcl', file: 'particles' },
  phr:  { gr: 'phr',  file: 'phrases' },
};

// ---------------------------------------------------------------- helpers

function parseArgs(argv) {
  const opts = { outDir: 'out', eng: null, pd: null, freq: null, rank: false, merge: true };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--eng') opts.eng = argv[++i];
    else if (argv[i] === '--pd') opts.pd = argv[++i];
    else if (argv[i] === '--freq') opts.freq = argv[++i];
    else if (argv[i] === '--rank') opts.rank = true;
    else if (argv[i] === '--no-merge') opts.merge = false;
    else opts.outDir = argv[i];
  }
  return opts;
}

async function load(localPath, url) {
  if (localPath) return fs.readFileSync(localPath, 'utf8');
  console.log(`Downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/**
 * Frequency list text: --freq path if given, else the local copy next to the
 * script, else download it and save it there for next time.
 */
async function loadFreq(customPath) {
  if (customPath) return fs.readFileSync(customPath, 'utf8');
  if (fs.existsSync(FREQ_LOCAL)) {
    console.log(`Using local ${FREQ_LOCAL}`);
    return fs.readFileSync(FREQ_LOCAL, 'utf8');
  }
  const text = await load(null, FREQ_URL);
  try {
    fs.writeFileSync(FREQ_LOCAL, text, 'utf8');
    console.log(`Saved ${FREQ_LOCAL}`);
  } catch (err) {
    console.warn(`Could not save ${FREQ_LOCAL}: ${err.message}`);
  }
  return text;
}

/** Parses a Panlexia TSV into [{id, word}], locating columns by header name. */
function parseTsv(text, label) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const header = lines[0].split('\t').map(h => h.trim().toLowerCase());
  const idCol = header.indexOf('id');
  const wordCol = header.indexOf('word');
  if (idCol < 0 || wordCol < 0) {
    throw new Error(`${label}: header needs "id" and "word" columns, got: ${header.join(', ')}`);
  }
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = lines[i].split('\t');
    const id = (cols[idCol] || '').trim();
    const word = (cols[wordCol] || '').trim();
    if (id && word) rows.push({ id, word });
  }
  return rows;
}

/** "PWN:able.s.02" -> { cls: "s" }, "PLX:yes.ptcl" -> { cls: "ptcl" } */
function wordClass(id) {
  const m = id.match(/^[A-Za-z]+:.*\.([a-z]+)(?:\.\d+)?$/);
  return m ? m[1] : null;
}

/** Frequency list text -> Map(lowercase word -> rank, 1 = most frequent). */
function parseFreq(text) {
  const ranks = new Map();
  let rank = 0;
  for (const line of text.split(/\r?\n/)) {
    const word = line.trim().split(/\s+/)[0];
    if (!word) continue;
    const w = word.toLowerCase();
    if (!ranks.has(w)) ranks.set(w, ++rank);
  }
  return ranks;
}

/**
 * Rank of an English word or phrase. Exact match first; for multi-word
 * entries ("ice cream") fall back to the rarest of its parts, if all are ranked.
 */
function englishRank(ranks, english) {
  const w = english.toLowerCase();
  if (ranks.has(w)) return ranks.get(w);
  const parts = w.split(/[\s\-_]+/).filter(Boolean);
  if (parts.length > 1 && parts.every(p => ranks.has(p))) {
    return Math.max(...parts.map(p => ranks.get(p)));
  }
  return Infinity;
}

/**
 * Merges entries whose English lists contain exactly the same words (in any
 * order). The Pandunia words are joined alphabetically: "sal, salam, salut".
 * All entries passed in share the same word class.
 */
function mergeIdentical(entries) {
  const groups = new Map();
  for (const e of entries) {
    const key = [...e.en].map(w => w.toLowerCase()).sort().join('\0');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  return [...groups.values()].map(group => {
    if (group.length === 1) return group[0];
    const pds = group.map(e => e.pd).sort((a, b) => a.localeCompare(b));
    return { ...group[0], pd: pds.join(', ') };
  });
}

function pushUnique(arr, value) {
  if (!arr.includes(value)) arr.push(value);
}

// ------------------------------------------------------------------- main

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const [engText, pdText] = await Promise.all([
    load(opts.eng, ENG_URL),
    load(opts.pd, PD_URL),
  ]);

  let ranks = new Map();
  try {
    ranks = parseFreq(await loadFreq(opts.freq));
    console.log(`Frequency list: ${ranks.size} words`);
  } catch (err) {
    console.warn(`Could not load frequency list (${err.message}); sorting alphabetically.`);
  }

  const engRows = parseTsv(engText, 'eng.tsv');
  const pdRows = parseTsv(pdText, 'pandunia.tsv');
  console.log(`English rows: ${engRows.length}, Pandunia rows: ${pdRows.length}`);

  // concept id -> English words
  const engByConcept = new Map();
  for (const { id, word } of engRows) {
    if (!engByConcept.has(id)) engByConcept.set(id, []);
    pushUnique(engByConcept.get(id), word);
  }

  // outputKey (file) -> Map("pdword\0gr" -> entry)
  const buckets = new Map();
  const skippedNoEnglish = []; // { pd, id }
  let skippedNoClass = 0;

  for (const { id, word } of pdRows) {
    const cls = wordClass(id);
    if (!cls) { skippedNoClass++; continue; }

    const english = engByConcept.get(id);
    if (!english || english.length === 0) { skippedNoEnglish.push({ pd: word, id }); continue; }

    const info = CLASSES[cls] || { gr: cls, file: cls };
    if (!buckets.has(info.file)) buckets.set(info.file, new Map());
    const bucket = buckets.get(info.file);

    // One entry per Pandunia word + word class; English from every concept
    // that the word is attached to is merged into the same entry.
    const key = `${word}\0${info.gr}`;
    let entry = bucket.get(key);
    if (!entry) {
      entry = { pd: word, gr: info.gr, en: [] };
      bucket.set(key, entry);
    }
    for (const e of english) pushUnique(entry.en, e);
  }

  fs.mkdirSync(opts.outDir, { recursive: true });
  let mergedAway = 0;
  for (const [file, bucket] of [...buckets].sort()) {
    const outPath = path.join(opts.outDir, `pd-en-${file}.jsonl`);
    let entries = [...bucket.values()];
    for (const e of entries) {
      const ranked = e.en
        .map(w => ({ w, r: englishRank(ranks, w) }))
        .sort((a, b) => a.r - b.r || a.w.localeCompare(b.w));
      e.en = ranked.map(x => x.w);
      e.rank = ranked[0].r; // best (lowest) rank among the translations
    }
    if (opts.merge) {
      const before = entries.length;
      entries = mergeIdentical(entries);
      mergedAway += before - entries.length;
    }
    entries.sort((a, b) => a.rank - b.rank || a.pd.localeCompare(b.pd));
    const lines = entries.map(e => {
      const { rank, ...rest } = e;
      if (opts.rank && Number.isFinite(rank)) rest.rank = rank;
      return JSON.stringify(rest);
    });
    fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
    console.log(`${outPath}: ${lines.length} entries`);
  }

  if (opts.merge) {
    console.log(`Merged ${mergedAway} entries that shared an identical English list`);
  }
  if (skippedNoEnglish.length) {
    console.log(`\nSkipped ${skippedNoEnglish.length} Pandunia rows without an English counterpart:`);
    const width = Math.max(...skippedNoEnglish.map(r => r.pd.length));
    for (const { pd, id } of skippedNoEnglish) {
      console.log(`  ${pd.padEnd(width)}  ${id}`);
    }
  }
  if (skippedNoClass) {
    console.log(`Skipped ${skippedNoClass} rows with no recognisable word class`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});