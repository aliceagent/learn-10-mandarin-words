// Typed-recall grading: compare a learner's typed pinyin against the dataset's
// tone-marked pinyin and report whether their *letters* and their *tones* were
// right. All of the parsing/grading rules live here (pure, DOM-free) so the
// panel component contains zero grading logic — see Sprint 4 in
// docs/ui-practice-micro-sprints-implementation-plan.md.
//
// Accepted input notations for a word like 狗 (gǒu):
//   • tone marks   — "gǒu"
//   • tone numbers — "gou3"   (digit 1-5 after a syllable; 0 means neutral/5)
//   • bare letters — "gou"    (tones unspecified)
// ü may be typed as "v" or "u:" (both canonicalise to "v"). Separators between
// syllables — space, hyphen, middot, apostrophe — are ignored for letters.

import { stripToneMarks, tonesOf, type Tone } from "./pinyin.ts";

export type TypedGrade = "correct" | "tones-off" | "incorrect";
// A parsed/expected syllable: its bare letters (ü as "v") and a tone. `tone` is
// null only for parsed input where the learner specified no tone for it.
export type TypedSyllable = { letters: string; tone: Tone | null };

// Tone-marked vowel → [base letter, tone]. ü-group bases collapse to "v" so the
// canonical letter form matches the "v" a learner would type.
const MARK: Record<string, [string, Tone]> = {
  "ā": ["a", 1], "á": ["a", 2], "ǎ": ["a", 3], "à": ["a", 4],
  "ē": ["e", 1], "é": ["e", 2], "ě": ["e", 3], "è": ["e", 4],
  "ī": ["i", 1], "í": ["i", 2], "ǐ": ["i", 3], "ì": ["i", 4],
  "ō": ["o", 1], "ó": ["o", 2], "ǒ": ["o", 3], "ò": ["o", 4],
  "ū": ["u", 1], "ú": ["u", 2], "ǔ": ["u", 3], "ù": ["u", 4],
  "ǖ": ["v", 1], "ǘ": ["v", 2], "ǚ": ["v", 3], "ǜ": ["v", 4],
};

// Any tone-marked vowel — used to decide whether unmarked syllables in the
// learner's input should read as neutral (5) or as "tone unspecified" (null).
const MARK_RE = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/;

// Syllable separators removed before letter comparison.
const SEP = /[\s\-·'’]+/;

// Every vowel, including tone-marked forms and the ü ↔ v ↔ ê variants. Matches
// the cluster detection used by tonesOf so tone counts and letter segmentation
// stay aligned.
const VOWELS = "aeiouüvêāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ";
function isVowel(ch: string): boolean {
  return VOWELS.includes(ch);
}

// Split a separator-free chunk into one substring per vowel cluster. Consonants
// between two clusters attach to the following syllable (onset); trailing
// consonants attach to the preceding one. Cluster count equals tonesOf's, so
// tones align 1:1 with the returned syllables.
function segmentChunk(chunk: string): string[] {
  const clusters: [number, number][] = [];
  let start = -1;
  for (let i = 0; i < chunk.length; i++) {
    if (isVowel(chunk[i])) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      clusters.push([start, i]);
      start = -1;
    }
  }
  if (start >= 0) clusters.push([start, chunk.length]);
  if (clusters.length === 0) return chunk.length ? [chunk] : [];
  const out: string[] = [];
  let from = 0;
  for (let k = 0; k < clusters.length; k++) {
    const to = k === clusters.length - 1 ? chunk.length : clusters[k][1];
    out.push(chunk.slice(from, to));
    from = to;
  }
  return out;
}

// Bare-letter form of one raw (possibly tone-marked) syllable: tone marks
// removed, ü → v, lowercased, non-letters dropped.
function bareLetters(raw: string): string {
  return stripToneMarks(raw).toLowerCase().replace(/ü/g, "v").replace(/[^a-z]/g, "");
}

/**
 * Canonical syllables of dataset (tone-marked) pinyin. Letters are tone-stripped
 * and ü-normalised to "v"; each syllable's tone comes from `tonesOf` (never
 * null here — neutral is 5).
 */
export function expectedSyllables(pinyin: string): TypedSyllable[] {
  const tones = tonesOf(pinyin);
  const raw = pinyin.split(SEP).filter(Boolean).flatMap(segmentChunk);
  return raw.map((r, i) => ({ letters: bareLetters(r), tone: tones[i] ?? 5 }));
}

/**
 * Parse learner input into syllables. Tone marks and trailing digits (0 → 5)
 * set a syllable's tone; a syllable with neither is neutral (5) when the input
 * uses tone marks elsewhere, otherwise unspecified (null). "u:" and "v" both
 * mean ü ("v"). Digits and explicit separators terminate a syllable; otherwise
 * vowel-cluster segmentation splits concatenated input. Whitespace-only (or
 * digits with no letters) yields [].
 */
export function parseTypedPinyin(input: string): TypedSyllable[] {
  const s = input.toLowerCase().replace(/u:/g, "ü");
  const hasMark = MARK_RE.test(s);
  const out: TypedSyllable[] = [];

  // Pending run of base letters plus the mark-derived tone for each of its
  // vowel clusters, flushed into syllables on a digit, separator, or end.
  let run = "";
  let markTones: (Tone | null)[] = [];
  let inCluster = false;

  function addLetter(base: string, markTone: Tone | null) {
    if (isVowel(base)) {
      if (!inCluster) {
        inCluster = true;
        markTones.push(null);
      }
      if (markTone != null && markTones[markTones.length - 1] == null) {
        markTones[markTones.length - 1] = markTone;
      }
    } else {
      inCluster = false;
    }
    run += base;
  }

  function flush(digitTone: Tone | null) {
    if (run.length > 0) {
      const sylls = segmentChunk(run);
      for (let i = 0; i < sylls.length; i++) {
        let tone: Tone | null = markTones[i] ?? null;
        if (i === sylls.length - 1 && digitTone != null) tone = digitTone;
        if (tone == null && hasMark) tone = 5;
        out.push({ letters: sylls[i].replace(/[^a-z]/g, ""), tone });
      }
    }
    run = "";
    markTones = [];
    inCluster = false;
  }

  for (const ch of s) {
    if (ch >= "0" && ch <= "9") {
      const d = ch.charCodeAt(0) - 48;
      const digitTone: Tone | null = d === 0 ? 5 : d >= 1 && d <= 5 ? (d as Tone) : null;
      flush(digitTone);
    } else if (SEP.test(ch)) {
      flush(null);
    } else if (MARK[ch]) {
      addLetter(MARK[ch][0], MARK[ch][1]);
    } else if (ch === "ü") {
      addLetter("v", null);
    } else if (ch >= "a" && ch <= "z") {
      addLetter(ch, null);
    }
    // Anything else (stray punctuation) is ignored.
  }
  flush(null);
  return out;
}

/**
 * Grade typed pinyin against the expected tone-marked pinyin.
 *   • letters mismatch → "incorrect"
 *   • letters match, every tone specified and right → "correct"
 *   • letters match but any tone omitted or wrong → "tones-off"
 * When syllable counts disagree (concatenated input the segmenter split
 * differently), fall back to comparing concatenated letters: right letters can
 * never grade "incorrect" — the worst outcome is "tones-off".
 */
export function gradeTypedPinyin(input: string, expectedPinyin: string): TypedGrade {
  const expected = expectedSyllables(expectedPinyin);
  const parsed = parseTypedPinyin(input);
  const concat = (arr: TypedSyllable[]) => arr.map((x) => x.letters).join("");

  const perSyllable =
    parsed.length === expected.length &&
    expected.every((e, i) => parsed[i].letters === e.letters);
  if (perSyllable) {
    const tonesRight = expected.every((e, i) => parsed[i].tone != null && parsed[i].tone === e.tone);
    return tonesRight ? "correct" : "tones-off";
  }
  if (concat(parsed) === concat(expected)) return "tones-off";
  return "incorrect";
}

/**
 * Tone-number rendering of tone-marked pinyin (neutral → 5), concatenated:
 * "gǒu" → "gou3", "tùzi" → "tu4zi5".
 */
export function toneNumberForm(pinyin: string): string {
  return expectedSyllables(pinyin)
    .map((syl) => syl.letters + String(syl.tone ?? 5))
    .join("");
}
