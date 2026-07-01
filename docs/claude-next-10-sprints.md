# Claude Code — Next 10 Micro-Sprints

Small, sequential sprints for Learn 10 Mandarin Words. Each sprint should be one Claude Code run under ~30 turns, with no external credentials, no paid services, no fake data, and no deploy/push unless explicitly requested by the Hermes assistant after independent verification.

Current project state:
- Next.js app deployed on Vercel.
- Dataset: 14 categories, 102 topics, 1,020 items.
- Original 100 topics have GitHub Release MP4 video URLs.
- 2 Useful Phrases topics intentionally do not have generated videos yet.
- Test suite: Node built-in runner.

Validation gate for every sprint:
```bash
npm run test
npm run validate:data
npm run lint
npm run build
```

---

## Sprint 1 — Category pages and category navigation

**Goal:** Add dedicated category pages so users can browse one category at a time instead of only filtering on the home page.

**Tasks:**
- Add `/categories/[slug]` static pages with `generateStaticParams()`.
- Create a category page component that lists topics in that category using existing topic card styling.
- Link category cards on the home page to their category pages.
- Preserve existing home filter behavior; this is additive.
- Add tests for category lookup helpers if helper extraction is useful.

**Files likely touched:** `src/app/categories/[slug]/page.tsx`, `src/components/category-app.tsx`, `src/components/home-app.tsx`, `src/lib/data.ts`, `src/lib/data-logic.ts`, `tests/data.test.mjs`.

**Acceptance:**
- `/categories/useful-phrases` works and shows the two phrase topics.
- All category slugs generate static pages.
- Existing home page still works.

---

## Sprint 2 — Better video lesson UX

**Goal:** Make the video block more useful now that 100 videos are live.

**Tasks:**
- Add a "Video available" / "Video coming soon" badge to topic cards and topic pages.
- Add a direct "Open video" or "Download video" link for MP4-backed topics.
- Add a small note that videos are hosted on GitHub Releases.
- Keep Useful Phrases placeholders clean and intentional.

**Acceptance:**
- MP4 topics clearly show video availability.
- Useful Phrases topics do not look broken.

---

## Sprint 3 — Quiz retry missed words

**Goal:** Improve quiz learning loop by letting users retry missed answers.

**Tasks:**
- Track incorrect answers within the current quiz session.
- After completion, show missed words and a "Retry missed" button.
- Keep existing quiz modes intact.
- No persistent backend; local component state only unless existing progress state is appropriate.

**Acceptance:**
- Users can retry only missed items after a quiz.
- Existing quiz completion score still works.

---

## Sprint 4 — Search result highlighting

**Goal:** Make search feel smarter and easier to scan.

**Tasks:**
- Highlight matched text in topic names, English, hanzi, and pinyin where safe.
- Keep diacritic-tolerant pinyin search working.
- Avoid `dangerouslySetInnerHTML`; use safe token rendering.

**Acceptance:**
- Searching `gou`, `dog`, or `狗` visibly highlights matches.
- No unsafe HTML rendering.

---

## Sprint 5 — Learning path page

**Goal:** Add a guided curriculum page that gives learners a recommended order through existing topics.

**Tasks:**
- Add `/path` page.
- Use existing `recommendedPath`/`nextRecommendedTopic` helpers.
- Group path sections: starter, everyday life, travel, food, useful phrases.
- Add links from home and bottom nav if appropriate.

**Acceptance:**
- `/path` is static and useful without accounts or backend.
- It uses only existing topics/data.

---

## Sprint 6 — Stats dashboard

**Goal:** Add a lightweight local stats page based on current progress state.

**Tasks:**
- Add `/stats` page/client component.
- Show learned topics, favorite words, due reviews, streak, quiz scores if available.
- Use existing localStorage progress only.

**Acceptance:**
- Stats render without login and tolerate empty progress.

---

## Sprint 7 — Phrasebook mode for Useful Phrases

**Goal:** Make Useful Phrases feel different from vocabulary lists.

**Tasks:**
- Add a compact phrasebook display for the Useful Phrases category/topics.
- Emphasize phrase, pinyin, English, speak button, copy button if already safe/client-side.
- Do not alter normal vocab topics.

**Acceptance:**
- Useful Phrases pages feel like practical phrase cards.
- Existing word topics stay unchanged.

---

## Sprint 8 — Content quality lint script

**Goal:** Catch awkward or malformed data before it ships.

**Tasks:**
- Extend validation with content quality warnings: duplicate English labels within a topic, suspicious articles like `an US dollar`, truncated sentence endings, mismatched punctuation.
- Warnings by default; strict mode can fail.
- Add tests around the validator helpers if extracted.

**Acceptance:**
- Validator identifies quality issues without breaking current normal validation unless strict is used.

---

## Sprint 9 — Topic completion next-step flow

**Goal:** After finishing a topic, guide the learner onward.

**Tasks:**
- On topic page, when marked learned or quiz completed, show next recommended topic CTA.
- Include options: Review due words, Favorite this topic, Continue to next topic.
- Use existing helper logic.

**Acceptance:**
- Learners have a clear next action after a lesson.

---

## Sprint 10 — Offline data/video policy polish

**Goal:** Make offline behavior transparent now that videos are remote.

**Tasks:**
- Ensure service worker does not try to cache GitHub MP4s by default.
- Add copy explaining lessons/data work offline but videos require internet unless browser cached them.
- Add a small offline help section on `/offline`.

**Acceptance:**
- Offline page accurately explains video behavior.
- Service worker remains conservative and safe.
