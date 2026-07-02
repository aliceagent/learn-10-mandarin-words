import test from "node:test";
import assert from "node:assert/strict";

import {
  AGAIN_GAP,
  SESSION_CAP,
  gradeCard,
  isSessionComplete,
  startSession,
  toughestCards,
} from "../src/lib/session-logic.ts";

// Minimal DueCard fixtures — only the fields the session machine reads (`key`)
// need to be meaningful; the rest carry recognizable placeholders.
function makeCards(n) {
  return Array.from({ length: n }, (_, i) => ({
    topicSlug: "t",
    topicTitle: "Topic",
    hanzi: `h${i}`,
    pinyin: `p${i}`,
    english: `e${i}`,
    key: `k${i}`,
    dueAt: "2020-01-01T00:00:00.000Z",
    intervalDays: 1,
  }));
}

// Grade the current card by its key, so scripts read clearly regardless of
// requeue shuffling.
function gradeCurrent(session, grade) {
  return gradeCard(session, grade);
}

test("startSession caps the queue and reports the remainder", () => {
  const capped = startSession(makeCards(25));
  assert.equal(capped.queue.length, SESSION_CAP);
  assert.equal(capped.queue.length, 20);
  assert.equal(capped.remainingDue, 5);
  assert.equal(capped.position, 0);
  assert.deepEqual(capped.counts, { again: 0, hard: 0, good: 0, easy: 0 });
  assert.deepEqual(capped.againKeys, []);

  const small = startSession(makeCards(3));
  assert.equal(small.queue.length, 3);
  assert.equal(small.remainingDue, 0);
});

test("startSession([]) is immediately complete", () => {
  const session = startSession([]);
  assert.equal(session.queue.length, 0);
  assert.equal(session.remainingDue, 0);
  assert.ok(isSessionComplete(session));
});

test("gradeCard('again') requeues the current card at position + 1 + AGAIN_GAP", () => {
  const session = startSession(makeCards(10));
  const next = gradeCurrent(session, "again");
  assert.equal(AGAIN_GAP, 3);
  // Inserted at position (0) + 1 + 3 = index 4.
  assert.equal(next.queue[4].key, "k0");
  assert.equal(next.queue.length, 11);
  assert.equal(next.position, 1);
  assert.deepEqual(next.againKeys, ["k0"]);
  assert.equal(next.counts.again, 1);
});

test("gradeCard('again') on the last card appends and extends the session", () => {
  let session = startSession(makeCards(3));
  // Advance to the last card (index 2) with two Good grades.
  session = gradeCurrent(session, "good");
  session = gradeCurrent(session, "good");
  assert.equal(session.position, 2);
  const extended = gradeCurrent(session, "again");
  assert.equal(extended.queue.length, 4);
  assert.equal(extended.queue[3].key, "k2");
  assert.equal(extended.position, 3);
  // Not complete yet: the requeued card still sits at index 3.
  assert.ok(!isSessionComplete(extended));
});

test("againKeys dedupes a card graded 'again' twice", () => {
  let session = startSession(makeCards(6));
  // Grade k0 again → requeued at index 0+1+3 = 4. Queue: k0,k1,k2,k3,k0,k4,k5.
  session = gradeCurrent(session, "again");
  // Walk positions 1..3 (k1,k2,k3) with Good to reach the requeued k0 at index 4.
  session = gradeCurrent(session, "good");
  session = gradeCurrent(session, "good");
  session = gradeCurrent(session, "good");
  assert.equal(session.queue[session.position].key, "k0");
  session = gradeCurrent(session, "again");
  assert.deepEqual(session.againKeys, ["k0"]);
  assert.equal(session.counts.again, 2);
});

test("counts accumulate across a scripted 6-grade session", () => {
  let session = startSession(makeCards(6));
  for (const grade of ["good", "again", "hard", "easy", "good", "good"]) {
    session = gradeCurrent(session, grade);
  }
  assert.deepEqual(session.counts, { again: 1, hard: 1, good: 3, easy: 1 });
});

test("isSessionComplete tracks the position boundary", () => {
  let session = startSession(makeCards(2));
  assert.ok(!isSessionComplete(session));
  session = gradeCurrent(session, "good");
  assert.ok(!isSessionComplete(session));
  session = gradeCurrent(session, "good");
  assert.ok(isSessionComplete(session));
});

test("toughestCards returns unique again cards in first-seen order", () => {
  let session = startSession(makeCards(8));
  session = gradeCurrent(session, "good"); // k0 done
  session = gradeCurrent(session, "again"); // k1 requeued
  session = gradeCurrent(session, "again"); // k2 requeued
  const tough = toughestCards(session);
  assert.deepEqual(tough.map((c) => c.key), ["k1", "k2"]);
});

test("gradeCard is pure — the input session is unchanged", () => {
  const session = startSession(makeCards(5));
  const snapshot = JSON.stringify(session);
  gradeCard(session, "again");
  assert.equal(JSON.stringify(session), snapshot);
});
