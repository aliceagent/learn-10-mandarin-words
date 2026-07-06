import type { FlashcardStat, TopicSummary } from "./types";
// Value imports need the explicit `.ts` extension so they resolve under
// `node --test` (Node's native TS runner does not add extensions); `next build`
// and tsc accept it via `allowImportingTsExtensions`. Mirrors session-logic.ts.
import { MASTERED_INTERVAL_DAYS, todayISO, type DueCard } from "./progress-logic.ts";
import { wordKey } from "./data-logic.ts";

// Pure, DOM-free helpers for the "comeback session" — a gentle warm-up offered to
// learners who've been away 7+ days. Everything here reads only fields that
// already exist in the persisted schema (studiedDates + flashcardStats); no new
// storage, no clock beyond an injectable `today`. The React layer
// (comeback-app.tsx) drives a normal ReviewSession over `comebackDeck`, so all
// scheduling still flows through the real SM-2 path.

// A learner is "lapsed" once their most recent study day is at least this many
// days old. Seven mirrors MASTERED_INTERVAL_DAYS: a week away is the point where
// the streak is long dead and the review queue has piled up.
export const LAPSE_THRESHOLD_DAYS = 7;
// A comeback deck is intentionally tiny — a confidence-first warm-up, not a
// backlog. Five mastered words is a ~60-second win.
export const COMEBACK_DECK_SIZE = 5;

// True for finite, parseable date strings. Kept local (progress-logic's copy is
// private) so a corrupt studiedDates entry can never throw the day math below.
function isValidDay(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(new Date(value).getTime());
}

// The most recent valid study day, or null when nothing valid was ever studied.
// Compares by parsed time (not lexically) so a stray full timestamp can't win
// over a later plain day string; malformed entries are dropped defensively.
export function lastStudiedDay(studiedDates: string[]): string | null {
  let best: string | null = null;
  let bestMs = -Infinity;
  for (const day of studiedDates) {
    if (!isValidDay(day)) continue;
    const ms = new Date(day).getTime();
    if (ms > bestMs) {
      bestMs = ms;
      best = day;
    }
  }
  return best;
}

// Whole-day gap between the last study day and `today`, using the same
// 86400000-ms arithmetic as computeStreak. Null when never studied. A negative
// result (a future-dated corrupt entry) clamps to 0 rather than reporting a
// nonsensical "studied in the future".
export function daysSinceLastStudy(studiedDates: string[], today: string = todayISO()): number | null {
  const last = lastStudiedDay(studiedDates);
  if (last === null) return null;
  const diff = Math.round((new Date(today).getTime() - new Date(last).getTime()) / 86400000);
  return diff < 0 ? 0 : diff;
}

// A learner is lapsed once they've been away LAPSE_THRESHOLD_DAYS+ days. A
// never-studied user is NOT lapsed — they get first-run onboarding, not a
// comeback (there's nothing to warm up from).
export function isLapsed(studiedDates: string[], today: string = todayISO()): boolean {
  const days = daysSinceLastStudy(studiedDates, today);
  return days !== null && days >= LAPSE_THRESHOLD_DAYS;
}

// Structural topic shape so the deck builder accepts both a full `Topic[]` (the
// /comeback route's `MandarinData`) and a `TopicSummary[]` (the home page's
// slimmed `HomeData`) — exactly the fields `wordKey` and the DueCard need.
type ComebackTopic = Pick<TopicSummary, "slug" | "titleEn" | "items">;

// Build a warm-up deck of at most `limit` words, drawn strongest-first from words
// the learner already knows. Mastered words (interval ≥ a week) come first, sorted
// by interval descending with a stable `key`-ascending tiebreak; if there aren't
// enough, we top up with other studied words (reviewCount > 0), same ordering.
// `dueAt` is ignored entirely — a warm-up word need not be due; that's the point.
export function comebackDeck(
  topics: ComebackTopic[],
  flashcardStats: Record<string, FlashcardStat>,
  limit: number = COMEBACK_DECK_SIZE,
): DueCard[] {
  const mastered: DueCard[] = [];
  const studied: DueCard[] = [];

  for (const topic of topics) {
    for (const item of topic.items) {
      const key = wordKey(topic, item);
      const stat = flashcardStats[key];
      if (!stat) continue;
      const card: DueCard = {
        topicSlug: topic.slug,
        topicTitle: topic.titleEn,
        hanzi: item.hanzi,
        pinyin: item.pinyin,
        english: item.english,
        key,
        dueAt: stat.dueAt,
        intervalDays: stat.intervalDays,
        // Legacy pre-v8 stats may predate the lapse counter; default to 0 so the
        // DueCard contract's `lapses: number` never leaks `undefined`.
        lapses: stat.lapses ?? 0,
      };
      if (stat.intervalDays >= MASTERED_INTERVAL_DAYS) mastered.push(card);
      else if (stat.reviewCount > 0) studied.push(card);
    }
  }

  const byStrength = (a: DueCard, b: DueCard) =>
    b.intervalDays - a.intervalDays || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  mastered.sort(byStrength);
  studied.sort(byStrength);

  return [...mastered, ...studied].slice(0, Math.max(0, limit));
}
