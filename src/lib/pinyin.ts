// Pure pinyin helpers: derive tone numbers from tone-marked pinyin.
//
// Tones are ALWAYS derived from the existing tone-marked pinyin in the dataset;
// there is no hardcoded per-word tone table. A syllable with no tone mark is
// treated as neutral (tone 5). The tone-mark table mirrors the one used by
// `scripts/validate-data.mjs`.
//
// Multi-syllable words are handled whether written with separators
// (`duì bu qǐ`, `xī-ān`) or concatenated (`tùzi`, `jīnyú`): each syllable owns
// exactly one vowel cluster, so we count tones per vowel cluster. A tone mark
// anywhere in a cluster sets that syllable's tone; an unmarked cluster is
// neutral (5). This aligns one tone per syllable / per hanzi character.

export type Tone = 1 | 2 | 3 | 4 | 5;

// Map every tone-marked vowel to [base letter, tone number].
const TONE_MARK_TABLE: Record<string, [string, 1 | 2 | 3 | 4]> = {
  ā: ["a", 1], á: ["a", 2], ǎ: ["a", 3], à: ["a", 4],
  ē: ["e", 1], é: ["e", 2], ě: ["e", 3], è: ["e", 4],
  ī: ["i", 1], í: ["i", 2], ǐ: ["i", 3], ì: ["i", 4],
  ō: ["o", 1], ó: ["o", 2], ǒ: ["o", 3], ò: ["o", 4],
  ū: ["u", 1], ú: ["u", 2], ǔ: ["u", 3], ù: ["u", 4],
  ǖ: ["ü", 1], ǘ: ["ü", 2], ǚ: ["ü", 3], ǜ: ["ü", 4],
};

// Vowel letters, including the plain (v ↔ ü) and circumflex (ê) variants plus
// every tone-marked vowel. Consonants and separators break vowel clusters.
const VOWEL = /[aeiouüvêāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i;

/**
 * Remove tone marks from pinyin, keeping the base letters (ü preserved).
 * Useful for display when hiding the tone from the learner.
 */
export function stripToneMarks(pinyin: string): string {
  let out = "";
  for (const ch of pinyin) {
    const mapped = TONE_MARK_TABLE[ch];
    out += mapped ? mapped[0] : ch;
  }
  return out;
}

/**
 * Tone of a single syllable, derived from its tone mark.
 * Returns 5 (neutral) when the syllable carries no tone mark.
 * If more than one mark is present (unexpected), the first one wins.
 */
export function toneOfSyllable(pinyin: string): Tone {
  for (const ch of pinyin) {
    const mapped = TONE_MARK_TABLE[ch];
    if (mapped) return mapped[1];
  }
  return 5;
}

/**
 * Tone sequence for a (possibly multi-syllable) pinyin string.
 * Each maximal vowel cluster is one syllable; separators and punctuation are
 * ignored. Marked clusters yield their tone (1–4); unmarked clusters yield 5.
 */
export function tonesOf(pinyin: string): Tone[] {
  const tones: Tone[] = [];
  let inCluster = false;
  let clusterTone: Tone = 5;
  for (const ch of pinyin) {
    if (VOWEL.test(ch)) {
      if (!inCluster) {
        inCluster = true;
        clusterTone = 5;
      }
      const mapped = TONE_MARK_TABLE[ch];
      if (mapped && clusterTone === 5) clusterTone = mapped[1];
    } else if (inCluster) {
      tones.push(clusterTone);
      inCluster = false;
    }
  }
  if (inCluster) tones.push(clusterTone);
  return tones;
}

/**
 * Split (tone-marked) pinyin into `count` bare per-syllable chunks for display,
 * aligned to the same separator split TonePractice uses. Tone marks are stripped,
 * then the word is split on the syllable separators (space, hyphen, middot,
 * apostrophe — straight or curly). Falls back to the whole tone-stripped word as
 * a single chunk when the split count disagrees with `count`, so a display label
 * never misaligns with its tone row. Extracted verbatim from tone-practice.tsx's
 * private `displaySyllables` so the Tone panel and the Boss Round share one
 * source of truth and it can be unit-tested.
 */
export function bareSyllables(pinyin: string, count: number): string[] {
  const bare = stripToneMarks(pinyin);
  const chunks = bare.split(/[\s\-·'’]+/).filter(Boolean);
  if (chunks.length === count) return chunks;
  return [bare];
}

// ── Syllable segmentation for tone coloring (Sprint 10) ──────────────────────

/**
 * One piece of a pinyin string: either a syllable (carrying its `tone`) or a
 * separator/punctuation run (`tone: null`). See `pinyinSegments`.
 */
export type PinyinSegment = { text: string; tone: Tone | null };

// A character that is part of a pinyin syllable — any vowel (including ü / ê /
// tone-marked forms) or an ASCII consonant. Everything else (spaces, hyphens,
// middots, apostrophes, punctuation) sits between syllables.
function isPinyinLetter(ch: string): boolean {
  return VOWEL.test(ch) || /[a-z]/i.test(ch);
}

// Split a separator-free letter chunk into one substring per vowel cluster,
// mirroring `segmentChunk` in typing-logic.ts but keeping the ORIGINAL
// tone-marked characters. Onset consonants attach to the following cluster;
// trailing consonants attach to the preceding syllable, so each returned
// substring holds exactly one vowel cluster (and therefore at most one tone
// mark). A vowel-less chunk (no cluster) is returned whole.
function segmentLetterChunk(chunk: string): string[] {
  const clusters: [number, number][] = [];
  let start = -1;
  for (let i = 0; i < chunk.length; i++) {
    if (VOWEL.test(chunk[i])) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      clusters.push([start, i]);
      start = -1;
    }
  }
  if (start >= 0) clusters.push([start, chunk.length]);
  if (clusters.length === 0) return [chunk];
  const out: string[] = [];
  let from = 0;
  for (let k = 0; k < clusters.length; k++) {
    const to = k === clusters.length - 1 ? chunk.length : clusters[k][1];
    out.push(chunk.slice(from, to));
    from = to;
  }
  return out;
}

/**
 * Split tone-marked pinyin into ordered segments so each syllable can be colored
 * by its tone while the separators between them stay untouched. Syllable
 * segments carry a tone (1–5); separator/punctuation segments carry `tone: null`.
 *
 * Two invariants hold (and are dataset-tested):
 *   • `segments.map(s => s.text).join("") === pinyin` — nothing is added,
 *     dropped, or reordered, so rendering can never mangle the source string.
 *   • the non-null tones deep-equal `tonesOf(pinyin)` — color always lands on the
 *     same syllable the tone belongs to.
 *
 * An empty string yields `[]`.
 */
export function pinyinSegments(pinyin: string): PinyinSegment[] {
  const segments: PinyinSegment[] = [];
  let i = 0;
  while (i < pinyin.length) {
    const letter = isPinyinLetter(pinyin[i]);
    let j = i + 1;
    while (j < pinyin.length && isPinyinLetter(pinyin[j]) === letter) j++;
    const run = pinyin.slice(i, j);
    if (letter) {
      for (const syllable of segmentLetterChunk(run)) {
        // A real syllable always contains a vowel cluster; a vowel-less run
        // (never seen in the dataset) is treated as a separator so it doesn't
        // add a phantom tone that tonesOf never counted.
        const tone = VOWEL.test(syllable) ? toneOfSyllable(syllable) : null;
        segments.push({ text: syllable, tone });
      }
    } else {
      segments.push({ text: run, tone: null });
    }
    i = j;
  }
  return segments;
}
