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
