import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { buildQuizCard } from "../src/lib/quiz-logic.ts";
import { glossesCollide } from "../src/lib/gloss.ts";

// Data-driven regression net: sweep the shipped dataset and prove that, on
// every topic and in every mode, no card offers a distractor whose owning item's
// English gloss collides with the quizzed item's gloss. This keeps the Sprint 29
// guarantee true as content grows, without adding a strict rule to
// `validate:quality` (which would fail on legitimate near-synonyms by design).

const topicsPath = fileURLToPath(new URL("../src/data/topics.json", import.meta.url));
const { topics } = JSON.parse(readFileSync(topicsPath, "utf8"));

const MODES = ["hanzi-english", "english-hanzi", "hanzi-pinyin", "listening"];
const ANSWER_FIELD = {
  "hanzi-english": "english",
  "english-hanzi": "hanzi",
  "hanzi-pinyin": "pinyin",
  listening: "english",
};

// Deterministic shuffle: pull out any answer-equal element (kept first, matching
// how buildQuizCard seeds the answer) and otherwise preserve order. Being
// order-preserving means the ranked distractors come from the front of the pool,
// giving the filter the strongest chance to be caught if it ever regresses.
const identity = (items) => [...items];
const keyFor = (item) => item.hanzi;

test("every shipped topic in every mode: no distractor collides with the answer's gloss", () => {
  for (const topic of topics) {
    const pool = topic.items;
    for (const mode of MODES) {
      const field = ANSWER_FIELD[mode];
      for (const item of pool) {
        const card = buildQuizCard(item, pool, mode, keyFor, identity);
        for (const choice of card.choices) {
          if (choice === card.answer) continue;
          // Every non-answer choice must map back only to items whose gloss does
          // NOT collide with the quizzed item's gloss.
          const owners = pool.filter((w) => w[field] === choice);
          for (const owner of owners) {
            assert.equal(
              glossesCollide(owner.english, item.english),
              false,
              `${topic.slug ?? topic.category} [${mode}]: choice "${choice}" collides with answer for "${item.english}"`,
            );
          }
        }
      }
    }
  }
});

test("every card in every 10-item topic still gets four choices in every mode", () => {
  for (const topic of topics) {
    const pool = topic.items;
    if (pool.length < 4) continue; // guard, though shipped topics all have 10
    for (const mode of MODES) {
      for (const item of pool) {
        const card = buildQuizCard(item, pool, mode, keyFor, identity);
        assert.equal(
          card.choices.length,
          4,
          `${topic.slug ?? topic.category} [${mode}]: "${item.english}" has ${card.choices.length} choices`,
        );
        assert.equal(new Set(card.choices).size, 4, "choices are unique");
      }
    }
  }
});
