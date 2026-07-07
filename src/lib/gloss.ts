// Pure English-gloss helpers used to keep quiz distractors fair: a distractor
// must never share a meaning with the correct answer, or the card has two
// defensibly-correct choices. Nothing here touches the DOM, storage, or a
// backend — collisions are a pure function of the two gloss strings.
//
// The dataset writes near-synonyms deliberately (e.g. 包子 "steamed bun" vs
// 馒头 "steamed bun (plain)", or 不好意思 "excuse me / sorry"), so this logic is
// a *runtime* filter, not a data lint: the content stays as-is and the quiz
// builder simply never offers a colliding pair together.

/**
 * Lowercased gloss with parentheticals, punctuation, and extra whitespace
 * removed. Parenthetical qualifiers are dropped so "steamed bun (plain)"
 * normalizes to the same core meaning as "steamed bun"; hyphens and spaces are
 * kept so "hot dog" and "ice-cream" survive as multi-word senses.
 */
export function normalizeGloss(gloss: string): string {
  return gloss
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ") // drop parenthetical qualifiers
    // Strip punctuation, keeping spaces, hyphens, and any Unicode letter/number
    // (so accented glosses — and non-Latin scripts — survive intact).
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalized sense segments of a gloss, split on "/", ";", ",". Each segment is
 * normalized independently and empties are dropped, so "excuse me / sorry"
 * yields ["excuse me", "sorry"].
 */
export function glossSegments(gloss: string): string[] {
  return gloss
    .split(/[/;,]/)
    .map((part) => normalizeGloss(part))
    .filter((part) => part.length > 0);
}

/**
 * True when two glosses share any normalized sense segment (whole-segment
 * equality only, so "hot" does NOT collide with "hot dog"). Glosses with no
 * segments (empty/whitespace/punctuation-only) never collide.
 */
export function glossesCollide(a: string, b: string): boolean {
  const segmentsA = new Set(glossSegments(a));
  if (segmentsA.size === 0) return false;
  for (const segment of glossSegments(b)) {
    if (segmentsA.has(segment)) return true;
  }
  return false;
}
