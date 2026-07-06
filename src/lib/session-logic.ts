import type { DueCard, Grade } from "./progress-logic.ts";

// Pure review-session state machine, extracted so the /review queue logic can be
// unit-tested without React. `review-app.tsx` snapshots `dueCards` into a session
// once (never a live memo) and drives it through the functions below; the SM-2
// scheduling math in progress-logic.ts is untouched — this layer only decides
// in-memory ordering (session cap + Again-card recycling) and tallies grades.

// A daily review session is capped so a huge backlog doesn't turn into an
// unbounded slog; the remainder is surfaced as "N more due later" and can be
// started as a fresh session on completion.
export const SESSION_CAP = 20;
// A card graded "Again" is re-queued to reappear after up to this many other
// cards, so the learner sees it again within the same session (relearn) without
// it bouncing back immediately.
export const AGAIN_GAP = 3;
// A rescue drill (focused review over leech-flagged words) is capped smaller
// than a normal session: it's a short, targeted burst over words that keep
// slipping. The session state machine is reused as-is via `startSession(…, RESCUE_CAP)`.
export const RESCUE_CAP = 8;

export type ReviewSession = {
  /** Working queue including requeued copies of Again cards. */
  queue: DueCard[];
  /** Index of the current card within `queue`. */
  position: number;
  /** Every grading event tallied (a twice-graded card contributes twice). */
  counts: Record<Grade, number>;
  /** Deduped keys ever graded "again" this session, in first-seen order. */
  againKeys: string[];
  /** Due cards beyond the cap at session start (offered as "Review N more"). */
  remainingDue: number;
};

function emptyCounts(): Record<Grade, number> {
  return { again: 0, hard: 0, good: 0, easy: 0 };
}

// Seed a session from the day's due queue: take the first `cap` cards as the
// working queue and remember how many due cards were left beyond the cap.
export function startSession(cards: DueCard[], cap: number = SESSION_CAP): ReviewSession {
  return {
    queue: cards.slice(0, cap),
    position: 0,
    counts: emptyCounts(),
    againKeys: [],
    remainingDue: Math.max(0, cards.length - cap),
  };
}

// Apply a grade to the current card and advance. Pure: returns a NEW session,
// never mutates the input. Tallying happens for every grade. An "Again" grade
// additionally splices a copy of the current card back into the queue
// `AGAIN_GAP` cards ahead (clamped to the queue end, so grading the LAST card
// "again" appends it and extends the session — it must be re-passed before the
// session can complete) and records the key in `againKeys`.
export function gradeCard(session: ReviewSession, grade: Grade): ReviewSession {
  const current = session.queue[session.position];
  const counts = { ...session.counts, [grade]: session.counts[grade] + 1 };

  let queue = session.queue;
  let againKeys = session.againKeys;

  if (grade === "again" && current) {
    const insertAt = Math.min(session.position + 1 + AGAIN_GAP, session.queue.length);
    queue = [...session.queue.slice(0, insertAt), current, ...session.queue.slice(insertAt)];
    if (!againKeys.includes(current.key)) {
      againKeys = [...againKeys, current.key];
    }
  }

  return {
    ...session,
    queue,
    counts,
    againKeys,
    position: session.position + 1,
  };
}

// True once every card in the (possibly extended) queue has been passed.
export function isSessionComplete(session: ReviewSession): boolean {
  return session.position >= session.queue.length;
}

// The "toughest this session" list: the cards ever graded "Again", resolved
// against the queue in first-seen order and deduped by key.
export function toughestCards(session: ReviewSession): DueCard[] {
  const out: DueCard[] = [];
  for (const key of session.againKeys) {
    const card = session.queue.find((c) => c.key === key);
    if (card) out.push(card);
  }
  return out;
}
