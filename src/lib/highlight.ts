// Pure, dependency-free helpers for highlighting search matches.
//
// Search in this app is diacritic-tolerant: "gou", "gòu", and "gǒu" all match
// the same pinyin. To highlight the matched span in the ORIGINAL text (which
// keeps its tone marks and casing) we normalize each character individually so
// there is a 1:1 map between an original character and its normalized form.
// That lets us find a match in normalized space and paint it back onto the
// untouched source string — no HTML injection, just plain string segments.

/**
 * Strip tone marks / diacritics and lowercase. Mirrors the search haystack in
 * home-app so highlighting matches exactly what search matches.
 */
export function normalizePinyin(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export type HighlightSegment = { text: string; match: boolean };

/**
 * Split `text` into consecutive segments, marking the ones that fall inside a
 * (diacritic-insensitive) occurrence of `query`. Returns a single unmatched
 * segment when the query is empty or absent from the text. Never mutates or
 * reorders the source characters, so joining every segment's `text` reproduces
 * the input exactly.
 */
export function splitHighlight(text: string, query: string): HighlightSegment[] {
  if (!text) return [];
  const q = normalizePinyin(query.trim());
  if (!q) return [{ text, match: false }];

  const chars = [...text];
  // Build the normalized string alongside a map from each normalized-string
  // index back to the index of the original character that produced it.
  let normalized = "";
  const originOf: number[] = [];
  for (let i = 0; i < chars.length; i++) {
    const n = normalizePinyin(chars[i]);
    for (let k = 0; k < n.length; k++) {
      normalized += n[k];
      originOf.push(i);
    }
  }

  // Mark every original character covered by any occurrence of the query.
  const matched = new Array<boolean>(chars.length).fill(false);
  let found = false;
  let from = normalized.indexOf(q);
  while (from !== -1) {
    found = true;
    for (let j = from; j < from + q.length; j++) matched[originOf[j]] = true;
    from = normalized.indexOf(q, from + q.length);
  }
  if (!found) return [{ text, match: false }];

  // Group consecutive original characters sharing the same matched flag.
  const segments: HighlightSegment[] = [];
  for (let i = 0; i < chars.length; i++) {
    const m = matched[i];
    const last = segments[segments.length - 1];
    if (last && last.match === m) last.text += chars[i];
    else segments.push({ text: chars[i], match: m });
  }
  return segments;
}
