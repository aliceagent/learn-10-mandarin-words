# Fable 30-Sprint Implementation Roadmap

Detailed Fable plans for 30 incremental website improvements. Opus should implement exactly one sprint at a time and leave changes uncommitted for Hermes verification.

## Selected sprint list

1. **Slow-replay pronunciation button: second TTS speed (~0.6x) on SpeakButton** — Learners can replay a word or sentence extra slowly to hear tone contours they missed at normal speed.
2. **Tone minimal-pair drill: same base syllable, different tone, drawn from the dataset** — Contrasting real dataset words like mǎi/mài trains the tonal distinctions that most commonly confuse beginners.
3. **Shared-character connections: show other dataset words containing the same hanzi on the words panel** — Seeing 茶 recur across tea, teacup, and teahouse builds character-level intuition instead of isolated word memorization.
4. **Sentence listening comprehension quiz mode: hear an example sentence via TTS, pick the English** — Extends listening practice from single words to full sentences using the 2,040 example sentences already shipped.
5. **Leech detection: flag repeatedly-failed words and offer a focused rescue drill** — Words that keep failing reviews get explicit attention instead of silently cycling through the queue forever.
6. **End-of-session recap screen with missed words and one-tap re-drill** — Immediately re-practicing the exact words missed in a quiz or review session is the highest-value moment to correct them.
7. **Review forecast: 7-day upcoming-due bar chart on the review page** — Seeing how many cards come due tomorrow and this week helps learners plan and keeps the SRS queue from surprising them.
8. **Streak freeze token earned by completing a full week of daily goals** — One earned grace day protects a long streak from a single missed day, the most common reason streak motivation collapses.
9. **Comeback session: gentle refresher flow for learners returning after 7+ days away** — A short warm-up of previously-mastered words welcomes lapsed learners back instead of confronting them with a huge due pile.
10. **Recently-studied shelf on home: last three topics with quick resume links** — Returning learners get straight back into yesterday's topics without hunting through the 102-topic library.
11. **Daily challenge archive: calendar of past challenge results with emoji score strips** — A Wordle-style history of daily challenge outcomes gives learners a visible record worth keeping intact.
12. **Lightning round best-score history: sparkline of recent runs plus score tiers** — Seeing score progression over time and tier thresholds to chase makes beating your personal best more compelling.
13. **Duel player names and persistent head-to-head win record** — Named rivals and a running win tally turn one-off pass-and-play duels into an ongoing household rivalry.
14. **Memory flip game: face-down hanzi/English pair-matching grid per topic** — A concentration-style game adds a low-pressure, playful recall mode distinct from the existing visible-pairs match panel.
15. **Weekly recap share card: words practiced, accuracy, and streak for the past week** — A week-level summary image gives learners a satisfying shareable milestone beyond single-session scores.
16. **Light theme option: manual light/dark toggle persisted in localStorage** — The app is currently dark-only, and a light theme makes daytime and outdoor mobile study far more comfortable.
17. **Settings page consolidating tone colors, audio, goal, theme, and data export/import** — Preferences currently scattered across pages become discoverable in one place learners expect to find them.
18. **Optional haptic feedback on quiz answers via navigator.vibrate, off by default** — Subtle correct/incorrect vibration makes mobile practice feel responsive without requiring eyes on the feedback text.
19. **Printable topic cheat sheet: print stylesheet and print button on topic pages** — A clean paper reference of a topic's ten words and sentences supports offline handwriting and desk study.
20. **Keyboard shortcuts help overlay plus full keyboard support for scramble, match, and boss panels** — A discoverable '?' overlay and keyboard paths through the game panels make every activity usable without a pointer.
21. **Screen-reader announcement pass: aria-live for quiz verdicts, combo changes, and timer milestones** — Screen-reader users currently miss the real-time feedback that sighted users rely on during quizzes and timed rounds.
22. **Hanzi text-size preference: three character-size levels applied across all practice surfaces** — Larger characters make stroke detail legible for learners with low vision and anyone studying unfamiliar hanzi.
23. **Lazy-load heavy interactive panels (share-card canvas, boss round, duel) via dynamic imports with a bundle-size budget test** — Deferring rarely-used game code shrinks the initial JavaScript payload every visitor downloads on first paint.
24. **Slim the home page payload: ship a lightweight topic index instead of the full 1,020-word dataset** — The library and search need titles and slugs, not every sentence, so first load gets meaningfully faster on slow connections.
25. **Offline-saved badges on library topic cards plus bulk save-category-offline action** — Learners preparing for a flight can see at a glance what is available offline and save a whole category in one tap.
26. **Service worker update toast: notify when a new version is waiting and offer one-tap refresh** — Installed PWA users stop getting stuck on stale cached versions without knowing an update exists.
27. **Offline-aware audio handling: disable listening modes gracefully with clear messaging when TTS voices are unavailable** — Instead of silent broken audio buttons offline, learners get an honest explanation and are steered to visual modes.
28. **Validator rule: pinyin syllable count must match hanzi character count, reported as warnings** — Automatically catching pinyin/hanzi mismatches across 1,020 entries protects learners from memorizing transcription errors.
29. **Quiz distractor QA: never offer a distractor whose English gloss matches the correct answer's gloss** — Eliminates unfair quiz questions where two choices are both technically correct because topics share a gloss.
30. **Quality-lint extensions: flag duplicate English glosses within a topic and inconsistent sentence punctuation** — Systematic checks keep the dataset's glosses and sentence formatting consistent as content is touched over time.

## Shared validation gate

```bash
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build
```

---

All findings are grounded; the plan below reflects the actual code. The key discovery: `useSpeech()` already accepts a `rate` override (`src/components/use-speech.ts:36`), so this sprint is almost entirely a one-component UI change plus a tested constant — genuinely small and shippable.

## Sprint 1 — Slow-replay pronunciation button: second TTS speed (~0.6x) on SpeakButton

### Goal and user value

Add a second, slower playback control next to every existing pronunciation button so learners can replay a word or example sentence at ~0.6× rate and hear tone contours (rising 2nd, dipping 3rd, falling 4th) that blur together at normal speed. Because the change lives inside the shared `SpeakButton` component, all ~20 call sites (flashcards, quiz, typing, cloze, scramble, boss, practice, review, daily, lightning, duel, tone trainer, phrasebook, favorites, word search) get the feature at once with zero call-site edits.

### Current-state findings (grounded in actual files)

- **`src/components/speak-button.tsx`** — the shared control. Props: `{ text, lang?, label?, className? }`. Renders a single speaker-icon `<button>`, gets `{ status, speaking, failed, speak, stop }` from `useSpeech()`. Its header comment says the props API is intentionally stable so the 12+ call sites need no edits — this sprint preserves that contract.
- **`src/components/use-speech.ts`** — the hardened speech hook. Crucially, `speak` already has the signature `speak(text: string, opts?: { lang?: string; rate?: number })` and applies `utt.rate = opts?.rate ?? SPEECH_RATE` (line 136). **No hook changes are needed** — the slow path is just `speak(text, { lang, rate: SLOW_SPEECH_RATE })`. All browser quirk handling (cancel→speak race deferral, stuck-pause `resume()`, keep-alive interval, GC retention) applies to the slow utterance for free.
- **`src/lib/speech.ts`** — the pure, DOM-free helper module (unit-tested under `node --test`). Defines `SPEECH_RATE = 0.85` ("slightly slowed so tones are audible"). The new slow constant belongs here, following the established pure-lib / hook split.
- **`tests/speech.test.mjs`** — existing tests import directly from `../src/lib/speech.ts` and cover voice ranking/support classification. New rate tests slot in here.
- **Call sites never pass `className`** — a repo-wide grep found no call site supplying it, so wrapping the button in a small flex group is layout-safe. Call sites place `SpeakButton` inline inside flex rows (e.g. `src/components/topic/flashcards-panel.tsx:176`, `src/components/phrasebook-panel.tsx:73` for sentences).
- **Precedent for speed UI**: `src/components/video-player.tsx` + `src/lib/video-controls.ts` already render playback-rate pills labeled `0.75×`/`1×` via `rateLabel()`. A compact `0.6×` pill on SpeakButton matches this existing visual language.
- **Adjacent speech paths that should NOT change**: `src/components/use-listen-all.ts` (listen-all autoplay, sets `utt.rate = SPEECH_RATE` directly, line 144) and the keyboard "speak" shortcut path (`src/components/practice-app.tsx:124` via `use-practice-shortcuts.ts`) — both stay at normal rate this sprint.

### Exact implementation steps in sequence

1. **`src/lib/speech.ts`**: add `SLOW_SPEECH_RATE = 0.6` next to `SPEECH_RATE`, with a doc comment explaining it's the absolute utterance rate for the slow-replay control (tone contours audible; below ~0.5 many engines sound glitchy). Add tiny pure helper `speechRateFor(pace)` so the pace→rate mapping is unit-testable and the hook/component never hardcode numbers.
2. **`src/components/speak-button.tsx`**:
   - Add local state `const [pace, setPace] = useState<SpeechPace>("normal")` recording which control was last tapped, so the pulse animation lands on the correct button while `speaking` is true.
   - Extract the shared click logic: if `unavailable` return; if `speaking && pace === thisButtonPace` → `stop()`; otherwise `setPace(thisButtonPace); speak(text, { lang, rate: speechRateFor(thisButtonPace) })`. (Tapping slow while normal is mid-playback intentionally restarts slow — the hook's cancel-race deferral already handles this.)
   - Wrap output in `<span className="inline-flex items-center gap-1">`; keep the existing icon button exactly as-is (same classes, same `className` prop behavior) as the "normal" control; add a second compact pill button labeled `0.6×` for slow.
   - Mirror all existing accessibility/state handling on the slow button: `aria-pressed`, `aria-disabled`, unavailable opacity, failed title, pulse-when-speaking (only when `pace === "slow"`).
3. **`tests/speech.test.mjs`**: add tests for the new constant and helper (see test plan).
4. Run the full validation gate.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/speech.ts` | Add `SLOW_SPEECH_RATE`, `SpeechPace`, `speechRateFor()` |
| `src/components/speak-button.tsx` | Two-button group, `pace` state, slow click handler |
| `tests/speech.test.mjs` | New rate/pace tests |

No changes to `use-speech.ts`, no call-site edits, no data or storage changes.

### Proposed names and TypeScript signatures

```ts
// src/lib/speech.ts
/** Absolute utterance rate for the slow-replay control (~0.6×) — slow enough
 *  to expose tone contours, above the ~0.5 floor where engines get glitchy. */
export const SLOW_SPEECH_RATE = 0.6;

export type SpeechPace = "normal" | "slow";

/** Map a pace to its utterance rate. */
export function speechRateFor(pace: SpeechPace): number;
```

```tsx
// src/components/speak-button.tsx (internal — public props unchanged)
const [pace, setPace] = useState<SpeechPace>("normal");
const handleSpeak = (nextPace: SpeechPace) => void;
```

Slow button visual (matches existing token vocabulary in the file — `rounded-full`, `border-white/10`, `text-slate-400`, emerald hover):

```tsx
<button
  type="button"
  className="inline-flex items-center justify-center rounded-full border border-white/10 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-slate-400 transition hover:border-emerald-300 hover:text-emerald-300"
>
  0.6×
</button>
```

### UI copy / microcopy

- Slow button visible text: **`0.6×`** (matches the `rateLabel` convention `0.75×` in `video-controls.ts`).
- Default slow aria-label/title: **`Pronounce slowly: ${text}`** (parallels the existing `Pronounce: ${text}`).
- When a `label` prop is supplied: **`${label} (slow)`** — e.g. "Hear pronunciation (slow)".
- While slow audio plays: **`Stop audio`** (reuse existing).
- Unavailable: **`Audio unavailable — no Chinese voice on this device`** (reuse existing, unchanged).
- After failure: **`Couldn't play audio — tap to try again`** (reuse existing).

### Test plan

Extend `tests/speech.test.mjs` (pure, `node --test`, no DOM):

1. `SLOW_SPEECH_RATE` is strictly less than `SPEECH_RATE` and within `(0.5, 1)` — encodes both "actually slower" and "above the glitch floor".
2. `speechRateFor("normal")` returns `SPEECH_RATE`; `speechRateFor("slow")` returns `SLOW_SPEECH_RATE`.

The component itself has no existing test harness (no React testing setup in the repo — all tests are pure-lib `.mjs`), so component behavior is covered by manual QA, consistent with how `SpeakButton`/`useSpeech` are already validated.

### Manual QA checklist

- [ ] `npm run dev` → open a topic page → Words/Flashcards tab: each speaker icon now has a small `0.6×` pill beside it; row layout not broken (check tight layouts: word-search results, phrasebook sentence rows, quiz header).
- [ ] Tap `0.6×` on a word: audio plays noticeably slower than the normal button; tones distinguishable.
- [ ] Tap `0.6×` on an example sentence (phrasebook panel): whole sentence plays slowly; keep-alive prevents mid-sentence cutoff on a long utterance.
- [ ] While normal playback is running, tap `0.6×`: normal stops, slow restarts from the beginning (no dropped utterance).
- [ ] While slow playback is running, tap `0.6×` again: playback stops. Pulse animation appears on the slow pill only, not the normal icon.
- [ ] Tap normal while slow is playing: switches to normal-rate playback.
- [ ] Hover/focus titles read correctly ("Pronounce slowly: 你好", "Stop audio").
- [ ] Simulate no Chinese voice (or Firefox with no zh voice): both buttons show dimmed/disabled state with the same unavailable title.
- [ ] Keyboard: both buttons reachable by Tab, activate on Enter/Space, `aria-pressed` toggles.
- [ ] No hydration warning in console on first load (both buttons render identically on SSR and first client render — no new DOM-derived render state).

### Acceptance criteria

1. Every `SpeakButton` in the app shows a normal control and a `0.6×` slow control with zero call-site code changes.
2. Slow playback uses `rate = 0.6` through the existing hardened `useSpeech` path (voice selection, cancel-race, keep-alive all apply).
3. `SPEECH_RATE` (0.85) remains the default for the normal button, listen-all, and the practice keyboard shortcut — unchanged behavior everywhere except the new control.
4. Accessibility parity: slow button has meaningful aria-label, `aria-pressed`, `aria-disabled`, and unavailable/failed states identical in behavior to the normal button.
5. Full gate passes: `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build`.

### Risk and rollback notes

- **Layout regression at dense call sites** is the main risk — the component grows from one button to a wrapped pair. Mitigated by keeping the pill tiny (`text-[10px]`, `px-1.5`) and the wrapper `inline-flex`; QA explicitly checks the tightest rows (search results, phrasebook). No call site passes `className`, so the prop's semantics changing from "the button" to "the normal button" affects nothing in practice.
- **Engine quirks at low rate**: some voices distort below ~0.5; 0.6 is a safe floor. If a specific device sounds bad, the constant is one line to tune.
- **Rollback** is trivial and isolated: revert the single commit; no storage schema, no data files, no shared-hook changes, so nothing else can break.

### Non-goals / deferrals

- No slow mode for the listen-all autoplay loop (`use-listen-all.ts`) — separate sprint if wanted.
- No keyboard shortcut for slow replay (`shortcut-logic.ts` / `use-practice-shortcuts.ts` untouched; "P"-style speak stays normal-rate).
- No persisted speed preference in localStorage (the video-player rate-persistence pattern exists if a later sprint wants it).
- No per-call-site opt-out prop (`hideSlow`) unless QA reveals a layout that genuinely can't fit the pill.
- No changes to voice selection, support classification, or error handling.

### Ready-to-run Opus implementation prompt for Sprint 1

```text
Implement Sprint 1 of the Learn 10 Mandarin Words roadmap: a slow-replay (~0.6×)
pronunciation control on the shared SpeakButton. Read AGENTS.md first — this is
Next.js 16 with breaking changes; consult node_modules/next/dist/docs/ if any
framework question arises (this sprint should need none: it's a pure client
component + pure lib change).

Context (verified):
- src/components/speak-button.tsx is the single shared pronunciation control
  (props: text, lang?, label?, className?) used by ~20 call sites. Do NOT change
  its public props or edit any call site.
- src/components/use-speech.ts already supports a rate override:
  speak(text, { lang?, rate? }) applies utt.rate = opts?.rate ?? SPEECH_RATE.
  Do NOT modify this hook.
- src/lib/speech.ts is the pure DOM-free helper module (SPEECH_RATE = 0.85),
  unit-tested in tests/speech.test.mjs via `node --test`.

Changes:
1. src/lib/speech.ts — add:
   - export const SLOW_SPEECH_RATE = 0.6 (doc comment: absolute utterance rate
     for slow replay; exposes tone contours; stays above the ~0.5 rate floor
     where engines glitch)
   - export type SpeechPace = "normal" | "slow"
   - export function speechRateFor(pace: SpeechPace): number — returns
     SPEECH_RATE for "normal", SLOW_SPEECH_RATE for "slow".
   Match the file's existing comment style.
2. src/components/speak-button.tsx — render an inline-flex gap-1 <span> wrapping:
   (a) the existing speaker-icon button, byte-for-byte same styling and
   className-prop behavior, and (b) a new compact slow button showing the text
   "0.6×" (rounded-full pill, border-white/10, text-[10px] tabular-nums,
   text-slate-400, emerald hover — match the file's existing classes).
   Add useState<SpeechPace>("normal") tracking the last-tapped pace. Click logic
   for each button: if unavailable, no-op; if speaking AND pace matches this
   button, stop(); else setPace(...) then speak(text, { lang,
   rate: speechRateFor(pace) }). Pulse/active styling (animate-pulse,
   emerald border/text) applies only to the button whose pace is active while
   speaking. Slow button a11y mirrors the normal one: aria-pressed,
   aria-disabled, title states — default label `Pronounce slowly: ${text}`,
   or `${label} (slow)` when the label prop is given; "Stop audio" while
   speaking; reuse the existing unavailable and failed strings verbatim.
   Keep the component SSR/hydration-safe: no window access during render.
3. tests/speech.test.mjs — add tests: SLOW_SPEECH_RATE < SPEECH_RATE and within
   (0.5, 1); speechRateFor("normal") === SPEECH_RATE;
   speechRateFor("slow") === SLOW_SPEECH_RATE.

Out of scope: use-listen-all.ts, shortcut-logic.ts/use-practice-shortcuts.ts,
any localStorage persistence, any call-site edits, any data file changes.

Validation gate — all must pass before you're done:
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build

Commit as: "sprint 1: slow-replay pronunciation: 0.6x second speed on SpeakButton"
```

---

I've completed my repo inspection. Key finding: the dataset genuinely contains 12 tone-only minimal-pair groups (e.g. 书 shū / 树 shù, 刀 dāo / 岛 dǎo), and there's a rich set of existing tone/pinyin/quiz helpers to reuse — this sprint is almost entirely composition. Here is the plan.

---

## Sprint 2 — Tone minimal-pair drill: same base syllable, different tone, drawn from the dataset

### Goal and user value

Ship a small standalone drill ("Tone Twins", route `/tone-pairs`) that plays a word aloud and asks the learner to pick **which of two real dataset words they heard** — words that share the exact same tone-stripped pinyin and differ only by tone (书 shū *book* vs 树 shù *tree*). This is the single hardest discrimination for beginners, and unlike the existing whole-pattern tone trainer (Sprint 8's `ToneListenTrainer`), it forces a *contrastive* choice between two concrete, already-learned vocabulary items. Every pair is drawn from `src/data/topics.json` — no invented vocabulary (note: mǎi/mài from the backlog rationale is **not** in the dataset and must not be added; the 12 real pairs below are used instead).

### Current-state findings grounded in actual files/components/helpers

**Dataset reality (verified by scripted analysis of `src/data/topics.json` — 102 topics, 1,020 words).** Grouping every word by ü-preserving tone-stripped pinyin (mirroring `stripToneMarks`) and requiring ≥2 distinct tone patterns yields **12 groups**:

| base | pair |
|---|---|
| baozi | 包子 bāozi (steamed bun) / 豹子 bàozi (leopard) |
| beizi | 杯子 bēizi (cup) / 被子 bèizi (quilt) |
| dao | 刀 dāo (knife) / 岛 dǎo (island) |
| lei | 雷 léi (thunder) / 累 lèi (tired) |
| qiche | 汽车 qìchē (car) / 骑车 qíchē (cycling) |
| shu | 书 shū (book) / 树 shù (tree) |
| ting | 停 tíng (stop) / 听 tīng (to hear) |
| xia | 虾 xiā (shrimp) / 下 xià (down) |
| xingxing | 星星 xīngxing / 星形 xīngxíng — **both English "star", must be filtered out** |
| yang | 羊 yáng (sheep) / 痒 yǎng (itchy) |
| you | 油 yóu (oil) / 右 yòu (right) |
| yu | 鱼 yú (fish) / 玉 yù (jade) |

That's **11 usable pairs** after filtering same-English groups. Two correctness traps confirmed in the data: 驴 lǘ / 鹿 lù is **not** a tone-only pair (ü ≠ u — `stripToneMarks` in `src/lib/pinyin.ts:34` correctly preserves ü, so grouping must use it, not naive diacritic removal), and the same-English 星星/星形 group must be excluded or the reveal is ambiguous.

**Reusable building blocks (all verified in-repo):**
- `src/lib/pinyin.ts` — `stripToneMarks`, `tonesOf`, `type Tone`. Tones are always derived from tone-marked pinyin; there is no per-word tone table (house rule).
- `src/lib/tone-trainer-logic.ts` — `patternKey`, `TONE_GLYPHS`, `patternGlyphs`, `patternAriaLabel`, `streakLabel` are exported and directly reusable.
- `src/lib/quiz-logic.ts:43` — `defaultShuffle`, the injectable-shuffle convention every logic module follows for testability.
- `src/lib/data-logic.ts` via `src/lib/data.ts:37` — `wordKey(topic, item)` = `topic.slug:hanzi`, the identity used by `quizStats`/daily goal.
- `src/components/use-progress.ts:118` — `recordQuizAnswer(key, correct)` routes through `withPractice`, stamping `studiedDates`, `dailyActivity`, and the daily-goal ring. **No schema change needed** — this drill persists nothing new.
- `src/components/use-speech.ts` — hardened Web Speech hook with `status` (`"no-chinese-voice"` etc.); `src/components/tone-listen-trainer.tsx` shows the exact audio-first UX conventions to copy (play button, Replay, no-voice warning copy at lines 231–235, speak-inside-click-handler for mobile autoplay at line 124).
- `src/components/tone-pinyin.tsx`, `use-tone-colors.ts`, `src/lib/tone-colors.ts` (`TONE_TEXT_CLASS`) — tone-colored pinyin rendering; `src/lib/lang.ts` — `HANZI_LANG` / `PINYIN_LANG` per-element lang tags (project rule).
- **Standalone-page template**: `src/app/lightning/page.tsx` (server page: `Metadata` + canonical + passes `data` into a `"use client"` app component) and `src/components/lightning-app.tsx` (page shell `main.mx-auto.max-w-3xl`, `LoadingScreen`, idle→running→done phases).
- `src/lib/analytics.ts` — typed `AnalyticsEvent` union; new events must be added there (privacy-first no-op transport).
- `src/lib/seo.ts:104-106` — utility routes (`/duel`, `/lightning`, `/daily`) are hand-listed in `sitemapEntries`; `tests/seo.test.mjs` covers it.
- `public/sw.js:38` — `PRECACHE_URLS` does **not** include `/lightning` or `/duel`, so the new route needs no service-worker change.
- Test/house style: pure logic modules import siblings with explicit `.ts` extensions (for `node --test`), components stay thin; tests live in `tests/*.test.mjs` using `node:test` + identity shuffles (see `tests/tone-trainer-logic.test.mjs`).
- `AGENTS.md`: this is a breaking-changes Next.js 16 — read `node_modules/next/dist/docs/` before writing route code (the new page mirrors `lightning/page.tsx` exactly, so framework risk is minimal).

### Exact implementation steps in sequence

1. **Create `src/lib/tone-pairs-logic.ts`** (pure, DOM-free, explicit `.ts` sibling imports):
   - `pairBase(pinyin)` — `stripToneMarks(pinyin).toLowerCase()` with separator runs (`/[\s\-·'’]+/g`) removed, so ü is preserved and multi-word pinyin groups robustly.
   - `buildTonePairGroups(topics)` — walk all topics/items; bucket by `pairBase`; within a bucket dedupe by hanzi (first occurrence wins, so a word appearing in two topics counts once); keep buckets with ≥2 members whose `patternKey(tonesOf(pinyin))` values are distinct **and** whose lowercased English labels are distinct (kills 星星/星形); return groups sorted by `base` for determinism. Each member carries `key` (via `wordKey`), `hanzi`, `pinyin`, `english`, `tones`, `topicSlug`, `topicTitle`.
   - `buildTonePairSession(groups, shuffle = defaultShuffle, limit = TONE_PAIRS_SESSION_SIZE)` — shuffle groups, take up to `limit` (default **10**, on-brand), for each pick the spoken target as the first element of the shuffled members and set `options` to all members shuffled.
   - Reuse `patternKey`/`TONE_GLYPHS` from `tone-trainer-logic.ts`; add `resultMessage(score, total)` for summary copy.
2. **Create `tests/tone-pairs-logic.test.mjs`** (fixtures + dataset invariants — see Test plan).
3. **Create `src/components/tone-pairs-app.tsx`** (`"use client"`): page shell modeled on `lightning-app.tsx`, round UX modeled on `tone-listen-trainer.tsx` (play button → pick one of the pair cards → reveal → next). Records each answer via `recordQuizAnswer(target.key, correct)`. After answering, reveal both words with tone-colored `TonePinyin` and per-word `SpeakButton`s so the learner can A/B the contrast. Track `tone_pairs_completed` on finish.
4. **Create `src/app/tone-pairs/page.tsx`** — server page mirroring `src/app/lightning/page.tsx` (metadata title "Tone Twins", canonical `/tone-pairs`, renders `<TonePairsApp data={data} />`).
5. **Add the event** `"tone_pairs_completed"` to the `AnalyticsEvent` union in `src/lib/analytics.ts`.
6. **Add `/tone-pairs`** to the utilities block in `sitemapEntries` (`src/lib/seo.ts:104-106`, `priority: 0.8, changeFrequency: "monthly"`) and update `tests/seo.test.mjs` accordingly.
7. **Link it from home**: add `<Link href="/tone-pairs">Tone Twins</Link>` to the footer nav row in `src/components/home-app.tsx:359-366` (matching Daily/Duel style). Nothing else — keep the surface small.
8. Run the full validation gate.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/tone-pairs-logic.ts` | **new** — pure pairing/session logic |
| `tests/tone-pairs-logic.test.mjs` | **new** — fixture + dataset-invariant tests |
| `src/components/tone-pairs-app.tsx` | **new** — client drill UI |
| `src/app/tone-pairs/page.tsx` | **new** — route + metadata |
| `src/lib/analytics.ts` | add `"tone_pairs_completed"` to union |
| `src/lib/seo.ts` | add `/tone-pairs` utility entry |
| `tests/seo.test.mjs` | expect the new sitemap entry |
| `src/components/home-app.tsx` | footer link |

### Proposed function/component names and TypeScript signatures

```ts
// src/lib/tone-pairs-logic.ts
export const TONE_PAIRS_SESSION_SIZE = 10;

export type TonePairWord = {
  key: string;         // wordKey: `${topicSlug}:${hanzi}`
  hanzi: string;
  pinyin: string;      // tone-marked, from the dataset
  english: string;
  tones: Tone[];       // tonesOf(pinyin)
  topicSlug: string;
  topicTitle: string;
};

export type TonePairGroup = { base: string; words: TonePairWord[] }; // words.length >= 2

export type TonePairRound = {
  base: string;
  target: TonePairWord;       // the word spoken aloud
  options: TonePairWord[];    // the whole group, shuffled (2–3 cards)
};

export function pairBase(pinyin: string): string;
export function buildTonePairGroups(topics: Topic[]): TonePairGroup[];
export function buildTonePairSession(
  groups: TonePairGroup[],
  shuffle?: <T>(items: T[]) => T[],
  limit?: number,
): TonePairRound[];
export function resultMessage(score: number, total: number): string;
```

```tsx
// src/components/tone-pairs-app.tsx
export function TonePairsApp({ data }: { data: MandarinData }): React.JSX.Element;
```

The component reuses `useProgress().recordQuizAnswer`, `useSpeech`, `useToneColors`, `streakLabel` — no new hooks, no new storage keys.

### UI copy / microcopy

- Page title / hero: **"Tone Twins"** — "Two real words, same sounds, different tones. Can your ear tell 书 shū from 树 shù?"
- Idle screen button: **"Start ear training"**; sub-line: "10 quick rounds · words you already know · results stay on this device."
- In-round: "Pair {n} of {total}" · "Listen, then pick the word you heard" · "Replay".
- No-voice fallback (copy matches `tone-listen-trainer.tsx:231-235`): "Your device has no Chinese voice installed, so listening mode may be silent."
- Reveal, correct: "Correct — that was {hanzi} {pinyin} ({english})." Wrong: "Not quite — you heard {hanzi} {pinyin} ({english}), not {other.hanzi} {other.pinyin}."
- Contrast line under reveal: "Same syllable, different tone: {pinyinA} vs {pinyinB}." with speak buttons labeled "Hear {hanzi}".
- Summary: "Ear training complete!" · score `x/10` · perfect: "Perfect — no tone can fool you."; ≥80%: "Sharp ears — one more run makes it stick."; else: "Tone twins are tricky — replay and listen for the pitch shape."
- Footer note (house pattern): "Every pair is two real words from the topic library. Your results stay on this device."
- Option cards show hanzi (`lang={HANZI_LANG}`, `font-hanzi`) + tone-marked pinyin via `TonePinyin` (`lang={PINYIN_LANG}`) + English — pinyin always accompanies Chinese text (project rule).

### Test plan

`tests/tone-pairs-logic.test.mjs` (`node --test`, identity shuffle, explicit `.ts` imports):
- **Fixture tests**: (a) two words with base "shu" and distinct tones/English form one group; (b) lǘ vs lù do **not** group (ü preserved); (c) same-hanzi duplicates across topics collapse to one member; (d) same-English group (two "star" words) is excluded; (e) a bucket with two words with the *same* tone pattern is excluded; (f) `buildTonePairSession` respects `limit`, target ∈ options, options are exactly the group members, and each round's option keys are unique.
- **Dataset invariant tests** (import `../src/data/topics.json` like `tone-trainer-logic.test.mjs` does): `buildTonePairGroups(data.topics)` yields ≥5 groups (currently 11, so the drill is meaningfully populated); every group's words share `pairBase`, have pairwise-distinct `patternKey(tones)` and distinct lowercased English; every `key` resolves to a real topic+hanzi; spot-check the "shu" group exists.
- Update `tests/seo.test.mjs` for the `/tone-pairs` sitemap entry.
- Existing suites (`pinyin`, `tone-trainer-logic`, `sw-policy`, `offline`, etc.) must stay green untouched.

### Manual QA checklist

- [ ] `/tone-pairs` loads statically; idle screen renders before any progress load flash (uses `LoadingScreen` while `!loaded`).
- [ ] Tap Start → play button speaks the target; nothing on screen identifies which twin it is before answering (both cards visible, neither highlighted).
- [ ] Pick correct/wrong → card flashes emerald/rose (`animate-quiz-correct`/`animate-quiz-wrong`), reveal shows both words with pinyin + English, speak buttons pronounce each twin.
- [ ] Next round auto-speaks inside the click handler (works on iOS Safari / Android Chrome autoplay policy).
- [ ] Answers move the daily-goal ring on home and show in `/stats` weak words (keys are real `wordKey`s).
- [ ] Tone colors toggle affects pinyin rendering on cards; reduced-motion OS setting suppresses celebrate animations.
- [ ] Desktop Firefox/desktop with no zh voice: warning copy appears, drill remains navigable.
- [ ] Footer "Tone Twins" link on home navigates; browser back returns cleanly.
- [ ] Replaying a session reshuffles pair order and spoken member.

### Acceptance criteria

1. `/tone-pairs` ships a working ≤10-round minimal-pair listening drill using **only** words present in `src/data/topics.json`, paired strictly by identical `stripToneMarks` base and differing tone patterns.
2. Each answer is recorded once via `recordQuizAnswer` under the word's canonical `wordKey`; no new localStorage keys, no `ProgressState` schema change.
3. All Chinese text renders with pinyin and correct `lang` attributes; tone-colors preference is respected.
4. The ü/u distinction is enforced (no lǘ/lù pairing) and same-English groups are excluded — both unit-tested.
5. Full gate passes: `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build`.

### Risk and rollback notes

- **TTS tone accuracy** is the load-bearing dependency: the drill speaks the hanzi (as `ToneListenTrainer` already does), so a device with a poor/absent Chinese voice degrades the experience. Mitigated by the existing `useSpeech` status warning and the post-answer reveal + per-word replay. 累 is polyphonic (lèi/lěi) but isolated zh-CN TTS reads lèi, matching the dataset pinyin — verify in manual QA.
- **Small pair pool (11)** means sessions repeat content across runs. Acceptable: repetition is the point of minimal-pair training; the shuffled target member varies which twin is spoken.
- **Dataset drift**: future vocabulary edits could shrink pairs below a useful count — the ≥5 dataset invariant test will flag it, and the component renders a graceful empty state if groups ever vanish.
- **Rollback**: the feature is purely additive — four new files plus three one-line-ish edits (`analytics.ts`, `seo.ts` + its test, `home-app.tsx` footer). Reverting the single sprint commit removes it with no data migration (nothing new was persisted).

### Non-goals / deferrals

- No new vocabulary (mǎi/mài stays out — not in the dataset), no HSK metadata, no audio files (Web Speech only).
- No reading-direction mode (English → pick the tone-marked pinyin) — possible later extension on the same logic module.
- No per-pair mastery persistence, streak storage, or schema bump; no share card; no keyboard shortcuts; no bottom-nav or topic-page integration; no service-worker precache entry.
- No changes to `validate-data.mjs` / quality lint — the dataset is untouched.

### Ready-to-run Opus implementation prompt for Sprint 2

```text
Implement Sprint 2 of the Learn 10 Mandarin Words app (Next.js 16 / React 19 / Tailwind 4,
static local-first, repo root = project root): a tone minimal-pair listening drill
("Tone Twins") at /tone-pairs. READ node_modules/next/dist/docs/ guidance first per
AGENTS.md (this Next.js has breaking changes). Do not add vocabulary, backends, or
external services. Dataset words only.

CONTEXT (verified): src/data/topics.json contains exactly these tone-only minimal pairs
(same stripToneMarks base, different tone pattern): baozi, beizi, dao, lei, qiche, shu,
ting, xia, yang, you, yu — plus xingxing (星星/星形) which has identical English "star"
and MUST be filtered out. 驴 lǘ / 鹿 lù must NOT pair (ü ≠ u; stripToneMarks in
src/lib/pinyin.ts preserves ü).

BUILD:
1. src/lib/tone-pairs-logic.ts — pure, DOM-free, explicit .ts sibling imports (house
   style: see src/lib/tone-trainer-logic.ts). Export TONE_PAIRS_SESSION_SIZE = 10;
   types TonePairWord {key,hanzi,pinyin,english,tones,topicSlug,topicTitle},
   TonePairGroup {base,words}, TonePairRound {base,target,options};
   pairBase(pinyin) = stripToneMarks(pinyin).toLowerCase() with /[\s\-·'’]+/g removed;
   buildTonePairGroups(topics) = bucket all words by pairBase, dedupe by hanzi, keep
   buckets with ≥2 members having pairwise-distinct patternKey(tonesOf(pinyin)) AND
   pairwise-distinct lowercased english, sorted by base; buildTonePairSession(groups,
   shuffle = defaultShuffle, limit = TONE_PAIRS_SESSION_SIZE) = shuffle groups, take
   limit, target = first shuffled member, options = shuffled members; resultMessage.
   Reuse: stripToneMarks/tonesOf/Tone from ./pinyin.ts, patternKey/TONE_GLYPHS from
   ./tone-trainer-logic.ts, defaultShuffle from ./quiz-logic.ts, wordKey from
   ./data-logic.ts.
2. tests/tone-pairs-logic.test.mjs (node:test, identity shuffle) — fixture tests:
   shu-pair groups; lǘ/lù does not group; same-hanzi dedupe; same-english exclusion;
   same-tone-pattern exclusion; session limit/target∈options/unique keys. Dataset
   tests (import ../src/data/topics.json): ≥5 groups; per-group invariants (shared
   base, distinct patterns, distinct english, keys resolve to real topic+hanzi);
   "shu" group exists.
3. src/components/tone-pairs-app.tsx ("use client") — page shell modeled on
   src/components/lightning-app.tsx (main.mx-auto.max-w-3xl, LoadingScreen until
   progress loaded, idle → running → done); round UX modeled on
   src/components/tone-listen-trainer.tsx: big play button speaks target.hanzi,
   Replay link, no-voice warning copy copied verbatim from tone-listen-trainer.tsx,
   option cards = the pair (hanzi lang=HANZI_LANG font-hanzi, TonePinyin pinyin
   lang=PINYIN_LANG, english), first tap wins, record once via
   useProgress().recordQuizAnswer(target.key, correct), reveal shows both twins with
   SpeakButtons + contrast line "Same syllable, different tone: X vs Y", auto-speak
   next target inside the Next click handler (mobile autoplay), streak chip via
   streakLabel, summary screen with score/10 + Play again (reshuffle via seed bump,
   same pattern as tone-listen-trainer). Track "tone_pairs_completed"
   {total, correct, bestStreak} on completion. Respect useToneColors +
   useReducedMotion. Render a graceful empty state if buildTonePairGroups returns [].
4. src/app/tone-pairs/page.tsx — mirror src/app/lightning/page.tsx: Metadata title
   "Tone Twins", description mentioning device-local/no-account, alternates.canonical
   "/tone-pairs", render <TonePairsApp data={data} />.
5. src/lib/analytics.ts — add "tone_pairs_completed" to AnalyticsEvent.
6. src/lib/seo.ts — add { url: absoluteUrl("/tone-pairs"), priority: 0.8,
   changeFrequency: "monthly" } beside /lightning in sitemapEntries; update
   tests/seo.test.mjs to expect it.
7. src/components/home-app.tsx — add <Link href="/tone-pairs">Tone Twins</Link> to
   the footer nav row (beside Daily/Duel). No other surfaces. Do NOT touch
   public/sw.js, ProgressState, or the dataset.

Match existing visual language exactly (rounded-3xl border-white/10 bg-surface cards,
emerald-400 primary buttons, min-h-[44px] tap targets, rose for wrong). Pinyin must
accompany all Chinese text.

VALIDATION GATE (all must pass before you're done):
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build
```

---

All research done — I've grounded the plan in the actual panel, data helpers, test conventions, and a dataset analysis (1,020 words, 881 distinct hanzi, 939 words share at least one character, but 子 appears in 67 words so caps are mandatory). Here is the sprint plan.

---

## Sprint 3 — Shared-character connections: show other dataset words containing the same hanzi on the words panel

### Goal and user value

When a learner reads 奶茶 on a topic's Words tab, they should see that 茶 also lives in 绿茶, 茶几, and 茶馆 — turning ten isolated words into a character network. The dataset strongly supports this: **939 of 1,020 words share at least one hanzi with another word** (茶 appears in 15 words across 6 topics — exactly the tea/teacup/teahouse story from the backlog). Each connection links to its home topic, so this also becomes an organic cross-topic discovery surface with zero new content: everything shown is drawn from `src/data/topics.json`.

### Current-state findings (grounded in actual files)

- **`src/components/topic/words-panel.tsx`** — the Words tab. Presentational; receives `topic`, `favoriteWords`, `flashcardStats`, optional `speechAvailable`, and `onToggleFavorite`. Each word renders as an `<article data-word-key=…>` card: hanzi (`font-hanzi`, `lang={HANZI_LANG}`), pinyin via `<TonePinyin>`, english, then a `border-t border-white/10` sentences section (`words-panel.tsx:105-117`). A new connections section slots naturally below the sentences, inside the card.
- **`src/app/topics/[slug]/page.tsx`** — server component; already imports `data` and `getTopic` from `@/lib/data` and passes `topic` into the client `TopicApp`. This is the right place to precompute connections **server-side**, because `topic-app.tsx` is `"use client"` and importing the full dataset there would bundle `topics.json` (~350KB) into the topic-page client chunk — the exact problem `toTopicSummary` exists to avoid (documented at `src/lib/types.ts:55-62` and `src/lib/data-logic.ts:11-17`).
- **`src/components/topic-app.tsx:392-401`** — renders `WordsPanel` when `mode === "words"`; the new prop threads through here. `WordsPanel` has exactly one caller (verified by grep), and its optional-prop pattern (`speechAvailable = false`) is the established way to keep hypothetical future callers compiling.
- **`src/lib/data-logic.ts` / `src/lib/search-logic.ts`** — the house pattern: pure, dataset-parameterized logic modules, bound to the real dataset in `src/lib/data.ts`, unit-tested from `tests/*.test.mjs` which import `.ts` files directly under `node --test` (see `tests/search-logic.test.mjs:4-6`). `wordKey` is `${topic.slug}:${item.hanzi}` (`data-logic.ts:43-45`).
- **`src/components/word-search-results.tsx:66-72`** — existing precedent for a word→topic link ("in {topicTitle}", `text-slate-500 hover:text-emerald-300`); the connections UI should visually rhyme with it.
- **`src/lib/analytics.ts`** — typed event union; a new event name must be added there (`AnalyticsEvent`).
- **Dataset realities** (measured against `topics.json`): duplicate hanzi across topics exist (奶茶 is in both `ten-types-of-drinks` and `ten-types-of-tea`) → identical-hanzi words must be excluded as "connections" (they're the same word, not a connection). Useful-phrases items contain CJK punctuation (，！？) → character extraction must filter to CJK ideographs. 子 appears in 67 words → per-character caps are required.

### Exact implementation steps in sequence

1. **Create `src/lib/connections-logic.ts`** (pure, dataset-parameterized, mirroring `search-logic.ts`):
   - `hanziChars(text)` — distinct CJK ideographs (`/[\u3400-\u4DBF\u4E00-\u9FFF]/`) in order of first appearance; drops punctuation/latin.
   - `topicCharConnections(topics, topic)` — for each item in `topic`, for each of its chars, collect every other dataset word containing that char, **excluding words whose hanzi string is identical** (self + cross-topic duplicates). Collect in dataset order, dedupe by hanzi (first occurrence wins), stable-sort cross-topic words before same-topic ones, cap at `MAX_CONNECTIONS_PER_CHAR = 4`, keep the uncapped `totalCount`. Skip chars with zero connections. Return `Record<wordKey, CharConnectionGroup[]>`.
   - The `topics` parameter should accept a `TopicSummary`-compatible shape (no `sentences` needed).
2. **Bind in `src/lib/data.ts`**: add `charConnectionsForTopic(topic)` delegating to `logic.topicCharConnections(data.topics, topic)`, per the existing wrapper pattern.
3. **Wire the server page** `src/app/topics/[slug]/page.tsx`: compute `const connections = charConnectionsForTopic(topic)` and pass `<TopicApp topic={topic} connections={connections} />`. The capped map serializes to only a few KB of RSC payload per topic.
4. **Thread the prop** through `src/components/topic-app.tsx`: accept `connections` and forward it to `WordsPanel` (words mode only).
5. **Create `src/components/topic/char-connections.tsx`**: a small presentational component rendering the groups for one card — per group, the shared character as a lead-in, then linked rows (hanzi with the shared char emphasized, pinyin via `TonePinyin`, english, "in {topicTitle}"), plus a "+N more" note when `totalCount > words.length`. Fires the analytics event on link click via a callback or direct `track`.
6. **Render it in `words-panel.tsx`**: accept optional `connections` prop (default `undefined` → section absent, preserving the panel's other-callers-compile-unchanged convention); below the sentences block, render `<CharConnections groups={connections?.[key]} … />` when non-empty, as a second `border-t` section inside the card.
7. **Add `"connection_opened"`** to the `AnalyticsEvent` union in `src/lib/analytics.ts`; fire with `{ topic: topic.slug, char, to: word.topicSlug }`.
8. **Write `tests/connections-logic.test.mjs`** (synthetic fixtures + real-dataset invariants — see test plan).
9. Run the full validation gate.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/connections-logic.ts` | **new** — pure connection-building logic |
| `src/lib/data.ts` | add `charConnectionsForTopic` wrapper |
| `src/app/topics/[slug]/page.tsx` | compute + pass `connections` |
| `src/components/topic-app.tsx` | thread `connections` prop to `WordsPanel` |
| `src/components/topic/words-panel.tsx` | optional `connections` prop; render section |
| `src/components/topic/char-connections.tsx` | **new** — presentational connections block |
| `src/lib/analytics.ts` | add `"connection_opened"` event |
| `tests/connections-logic.test.mjs` | **new** — unit + dataset-invariant tests |

### Proposed names and TypeScript signatures

```ts
// src/lib/connections-logic.ts
import type { Topic, TopicSummary, VocabItemSummary } from "./types";

export const MAX_CONNECTIONS_PER_CHAR = 4;

export type ConnectedWord = {
  hanzi: string;
  pinyin: string;
  english: string;
  topicSlug: string;
  topicTitle: string;   // titleEn
  /** True when the connection lives in the same topic the learner is viewing. */
  sameTopic: boolean;
};

export type CharConnectionGroup = {
  char: string;                 // the shared hanzi
  words: ConnectedWord[];       // deduped by hanzi, cross-topic first, ≤ MAX_CONNECTIONS_PER_CHAR
  totalCount: number;           // uncapped count, powers "+N more"
};

/** Distinct CJK ideographs in `text`, in order of first appearance. */
export function hanziChars(text: string): string[];

/** wordKey → connection groups for every item in `topic`. Chars with no connections are omitted;
 *  words whose key has no groups are omitted from the record entirely. */
export function topicCharConnections(
  topics: Pick<TopicSummary, "slug" | "titleEn" | "items">[],
  topic: Pick<Topic, "slug"> & { items: VocabItemSummary[] },
): Record<string, CharConnectionGroup[]>;
```

```ts
// src/lib/data.ts
export function charConnectionsForTopic(topic: Topic): Record<string, CharConnectionGroup[]>;

// src/components/topic/char-connections.tsx
export function CharConnections({ groups, topicSlug }: {
  groups: CharConnectionGroup[];
  topicSlug: string;              // for the analytics payload
}): React.JSX.Element;

// words-panel.tsx — new prop
connections?: Record<string, CharConnectionGroup[]>;
```

### UI copy / microcopy

- Section heading (per card, small like the review-count line): **`Character connections`**
- Group lead-in: **`茶 also appears in`** (the char rendered `font-hanzi` `lang={HANZI_LANG}`, emerald-highlighted)
- Connection row: `绿茶` + `lǜ chá` (TonePinyin, `lang={PINYIN_LANG}`) + `green tea`, with the shared char inside the hanzi emphasized (`text-emerald-300`), and the topic link **`in Ten Types of Tea`** (matching `word-search-results.tsx` styling)
- Overflow note: **`+62 more`** (plain text, `text-slate-500`; keep it quiet)
- Section `aria-label`: **`Words sharing characters with {hanzi}`**

### Test plan (`tests/connections-logic.test.mjs`, run via `npm run test`)

Synthetic-fixture tests (minimal topic shapes, per the `search-logic.test.mjs` style):
1. `hanziChars` extracts distinct CJK chars in order and drops punctuation (`"谢谢！"` → `["谢"]`), latin, and whitespace.
2. Words with identical hanzi are never connections (fixture with 奶茶 in two topics: neither lists the other's 奶茶... actually: 茶 card lists 奶茶 exactly once, deduped).
3. Per-group cap: a char in 6 fixture words yields `words.length === 4`, `totalCount === 5` (6 minus self).
4. Cross-topic connections sort before same-topic ones; dataset order preserved within each half.
5. Chars with no other occurrences are omitted; a word with no connections at all is absent from the record.
6. Record keys are canonical `wordKey`s (`slug:hanzi`).

Real-dataset invariants (import `topics.json` like `data.test.mjs`):
7. Backlog scenario: the record for `ten-types-of-drinks` maps `ten-types-of-drinks:茶` to a 茶 group whose `totalCount ≥ 10` and which references `ten-types-of-tea`.
8. Every `hanziChars(item.hanzi)` is non-empty for all 1,020 items.
9. Every connected word's `(topicSlug, hanzi)` exists in the dataset, and no group exceeds `MAX_CONNECTIONS_PER_CHAR`.

### Manual QA checklist

- [ ] `/topics/ten-types-of-drinks` → Words tab: 茶 card shows a 茶 group with cross-topic words (绿茶, 茶几, …) and a "+N more" note.
- [ ] Shared character is visibly highlighted inside each connection's hanzi; pinyin appears on every Chinese line (TonePinyin, tone-colors toggle respected).
- [ ] Clicking a connection navigates to its topic page; the target word is present there.
- [ ] A useful-phrases topic (Phrasebook default → switch to Words): no crash, punctuation produces no bogus groups.
- [ ] A 子-heavy topic (e.g. furniture): groups are capped at 4, card doesn't balloon.
- [ ] "Play all" listening drill still highlights/scrolls cards correctly (section didn't break `data-word-key` targeting).
- [ ] Mobile width: connections wrap cleanly inside the card; Save button and SpeakButton untouched.
- [ ] `NEXT_PUBLIC_ANALYTICS=console npm run dev`: clicking a connection logs `connection_opened`.

### Acceptance criteria

1. Every word card on the Words tab shows a "Character connections" section when at least one other dataset word (different hanzi) shares a CJK character; the section is absent otherwise.
2. Connections show hanzi + pinyin + english + source topic, link to that topic, and are capped at 4 per character with an accurate "+N more".
3. No identical-hanzi word ever appears as its own connection; groups contain no duplicates.
4. `topics.json` is **not** added to any client chunk — connections arrive as a precomputed, capped prop from the server page (verify topic-page chunk size is roughly unchanged in `npm run build` output).
5. All five gate commands pass; no changes to `topics.json`, localStorage schema, or `ProgressState`.

### Risk and rollback notes

- **Purely additive and stateless**: no dataset edits (validators unaffected), no `ProgressState`/schema change, no new storage keys. Rollback = remove the section render + prop threading; the logic module and tests can stay harmlessly.
- **RSC payload growth** is the main risk; caps bound it to a few KB per topic. Check `npm run build` output for the topics route before/after.
- **Card visual density**: worst case ~2–3 groups × 4 rows per card. If it feels heavy in QA, the in-scope mitigation is reducing `MAX_CONNECTIONS_PER_CHAR`, not adding collapse UI.

### Non-goals / deferrals

- No character meanings, radical breakdowns, or etymology — that would require invented content, which is out of bounds.
- No dedicated per-character pages or a character index (a natural later sprint on top of this logic).
- No connections in Flashcards/Quiz/Phrasebook panels or the favorites page — Words tab only.
- No collapse/expand interaction; caps keep the section small enough to render statically.

### Ready-to-run Opus implementation prompt for Sprint 3

```text
Implement Sprint 3 of the Learn 10 Mandarin Words roadmap: shared-character connections
on the topic Words panel. Next.js 16 / React 19 / Tailwind 4; read AGENTS.md and
node_modules/next/dist/docs/ before writing Next.js-specific code. READ the referenced
files before editing them.

FEATURE: On each word card in src/components/topic/words-panel.tsx, below the example
sentences, show a "Character connections" section: for each CJK character of the word
that appears in other dataset words, list those words (hanzi with the shared character
emphasized in emerald, pinyin via the existing TonePinyin component with lang from
src/lib/lang.ts, english, and an "in {topicTitle}" link to /topics/{slug} styled like
src/components/word-search-results.tsx lines 66-72).

ARCHITECTURE (non-negotiable):
1. New pure module src/lib/connections-logic.ts, dataset-parameterized like
   src/lib/search-logic.ts. Export:
   - MAX_CONNECTIONS_PER_CHAR = 4
   - hanziChars(text: string): string[] — distinct chars matching
     /[\u3400-\u4DBF\u4E00-\u9FFF]/, order of first appearance (phrases contain
     CJK punctuation that must be dropped)
   - types ConnectedWord {hanzi,pinyin,english,topicSlug,topicTitle,sameTopic} and
     CharConnectionGroup {char,words,totalCount}
   - topicCharConnections(topics, topic): Record<wordKey, CharConnectionGroup[]>
     Rules: exclude candidate words whose hanzi string is identical to the current
     word (the dataset has true duplicates like 奶茶 in ten-types-of-drinks AND
     ten-types-of-tea); collect in dataset order; dedupe by hanzi (first wins);
     stable-sort cross-topic before same-topic; cap words at 4 keeping uncapped
     totalCount; omit charless groups and connectionless words. wordKey format is
     `${slug}:${hanzi}` per src/lib/data-logic.ts.
2. Bind in src/lib/data.ts as charConnectionsForTopic(topic), following its existing
   wrapper pattern.
3. Compute SERVER-SIDE in src/app/topics/[slug]/page.tsx and pass as a prop through
   TopicApp (src/components/topic-app.tsx, words mode only) into WordsPanel. Do NOT
   import topics.json or @/lib/data into any client component — the codebase
   deliberately keeps the dataset out of client chunks (see the toTopicSummary
   comments in src/lib/types.ts and src/lib/data-logic.ts).
4. New presentational component src/components/topic/char-connections.tsx; WordsPanel
   takes an optional connections prop (absent → section not rendered), preserving its
   existing optional-prop convention (speechAvailable).
5. Add "connection_opened" to the AnalyticsEvent union in src/lib/analytics.ts and
   track({topic, char, to}) on connection link clicks.

MICROCOPY: section heading "Character connections"; group lead-in "{char} also appears
in"; overflow "+N more"; section aria-label "Words sharing characters with {hanzi}".
Match the dark card aesthetic already in words-panel.tsx (border-white/10, bg-surface,
text-slate-*, emerald accents). Pinyin must appear on every Chinese line.

TESTS: tests/connections-logic.test.mjs using node:test + assert/strict, importing
../src/lib/connections-logic.ts directly and topics.json with `with {type:"json"}`
(copy the style of tests/search-logic.test.mjs). Cover: punctuation-safe hanziChars;
identical-hanzi exclusion + dedupe; the 4-cap with correct totalCount; cross-topic-
first ordering; canonical wordKey keys; and real-dataset invariants — the
ten-types-of-drinks 茶 entry has a 茶 group with totalCount ≥ 10 referencing
ten-types-of-tea, hanziChars is non-empty for all 1020 items, every connection's
(topicSlug,hanzi) exists in the dataset.

CONSTRAINTS: no new dependencies, no dataset/localStorage/schema changes, no invented
vocabulary or character metadata, no collapse/expand UI. Purely additive.

VALIDATION GATE — all must pass before you finish:
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build
Also confirm in the build output that the /topics/[slug] client chunk size is roughly
unchanged (the dataset must not leak into it).
```

---

All research done — findings are grounded below. Here is the plan.

---

## Sprint 4 — Sentence listening comprehension quiz mode: hear an example sentence via TTS, pick the English

### Goal and user value

Learners can already hear single words and pick their meaning (Quiz → "Listen 🔊" mode). This sprint extends that ear training to full sentences: on each card the learner taps play, hears one of the topic's real example sentences spoken via the browser's Chinese TTS voice, and picks the correct English translation from four choices. Nothing Chinese is shown before answering (that would leak the answer); after answering, the sentence hanzi, the drilled word (hanzi + pinyin + English), and replay/slow-replay controls are revealed. It uses only the 2,040 example sentences already shipped in `src/data/topics.json` — no new content, no backend, and results feed the existing per-word progress stats in localStorage.

### Current-state findings grounded in actual files/components/helpers

- **Data**: `src/data/topics.json` has 102 topics × 10 items × exactly 2 sentences each = 2,040 sentences (verified by script). `Sentence` is `{ cn, en }` (`src/lib/types.ts:1-4`) — **sentences have no pinyin field**, and existing sentence UIs (`cloze-panel.tsx:197`, scramble panel) render sentence hanzi without pinyin; only the drilled word carries pinyin. Sentence `en` strings are unique within every topic (verified: min 20 distinct EN per topic), so four unique choices are always available. `scripts/validate-data.mjs:164-174` already enforces non-empty sentences.
- **Word-listening quiz precedent**: `quiz-logic.ts` has a `"listening"` `QuizMode` whose answers/distractors come from the `english` field, ranked by `englishAnswerScore` (Dice similarity + length + first word, `quiz-logic.ts:124-132`). `rankedDistractors(item, pool, mode, shuffle)` (`quiz-logic.ts:188-201`) works over the structural type `QuizWord = Pick<VocabItem, "hanzi" | "pinyin" | "english">` — so any `{hanzi, pinyin, english}` object works, which lets us reuse it for sentences via a tiny adapter (map `Sentence` → `{hanzi: cn, pinyin: "", english: en}`) with zero changes to `quiz-logic.ts`.
- **Sentence-drill panel precedent**: `ClozePanel` (`src/components/topic/cloze-panel.tsx`) is the exact structural template: pure card/deck builder in `src/lib/cloze-logic.ts` (injectable `shuffle`, one card per item, sentence chosen via `shuffle(item.sentences)[0]`, `null`-dropping deck builder), a panel owning `deck/index/picked/score/done` state, `onRecord(key, correct)` fired once per card via a `picked !== null` guard, and a completion screen with "Try again".
- **Speech plumbing**: `useSpeech()` (`src/components/use-speech.ts`) is the single hardened TTS entry point; `speak(text, opts?: { lang?, rate? })` already accepts a rate override (default `SPEECH_RATE = 0.85`, `src/lib/speech.ts:33`), and its `KEEPALIVE_MS` resume loop was explicitly built for "longer (sentence-length) utterances" (`speech.ts:37-39`) — sentence TTS is already supported. `canAttemptSpeech(status)` (`speech.ts:108-110`) is the availability gate.
- **Speech-gated UI precedent**: `topic-app.tsx:79-80` computes `speechAvailable`; the quiz's "Listen 🔊" chip (`quiz-panel.tsx:166`) and the tone-practice "Listen" sub-mode (`topic-app.tsx:499, 512`) both hide when speech is unavailable — the tone case also guards the render (`toneMode === "listen" && speechAvailable`).
- **Play-first UX precedent**: the listening quiz card (`quiz-panel.tsx:212-245`) shows a big emerald play button, "Listen, then pick the meaning" helper, a "Replay" link only after first play (`playedKey` state), and no-voice microcopy driven by `status === "no-chinese-voice"`.
- **Tabs & wiring**: `topic-app.tsx:42` holds the mode union and `topic-app.tsx:353-370` the scrollable tab strip (9 tabs already; built to scroll). Sentence panels are wired as `<ClozePanel topic={topic} onRecord={recordQuizAnswer} />` (`topic-app.tsx:457-459`). `recordQuizAnswer` keys by `wordKey(topic, item)` = `topic.slug:hanzi` (`src/lib/data-logic.ts:43`), feeding Trickiest words / practice — **no `ProgressState` schema change needed**.
- **Tests**: `tests/cloze-logic.test.mjs` shows the convention — `node:test`, identity shuffle, tiny pets fixture, plus a whole-dataset assertion importing `topics.json` with `with { type: "json" }`, and `.ts`-extension imports (`allowImportingTsExtensions` idiom documented in `cloze-logic.ts:2-7`).
- **AGENTS.md**: warns Next.js 16 differs from training data; this sprint touches no routing/data-fetching APIs — it's one client panel + one pure lib inside an existing client tree, so framework risk is nil (but the implementer should still skim `node_modules/next/dist/docs/` if they touch anything route-level).

### Exact implementation steps in sequence

1. **Create `src/lib/sentence-listen-logic.ts`** (pure, DOM-free, injectable shuffle — mirrors `cloze-logic.ts`):
   - Define `SentenceListenCard` (shape below).
   - `sentencePool(pool, exceptCn)`: flatten all sentences of all pool items, excluding the played sentence by `cn`.
   - `buildSentenceListenCard(item, pool, keyFor, shuffle)`: pick the item's sentence via `shuffle(item.sentences)[0]` (cloze pattern); build EN distractors by adapting sentences to `QuizWord`s (`{hanzi: s.cn, pinyin: "", english: s.en}`) and calling `rankedDistractors(targetAsWord, poolAsWords, "listening", shuffle).slice(0, 3)` — this reuses the existing English-answer similarity ranking and its dedupe/exclude-answer guarantees verbatim. Return `null` if the item has no sentences or fewer than 3 distractors survive (defensive; real data always yields 19+ candidates).
   - `buildSentenceListenDeck(items, pool, keyFor, shuffle)`: map + drop nulls, mirroring `buildClozeDeck`.
   - Export `SLOW_SPEECH_RATE = 0.65` for the "Play slower" replay (passed to `speak`'s existing `rate` option).
2. **Create `tests/sentence-listen-logic.test.mjs`** following `cloze-logic.test.mjs` conventions (fixture, identity shuffle, dataset-wide assertion — details in Test plan).
3. **Create `src/components/topic/sentence-listen-panel.tsx`**, cloned structurally from `ClozePanel` with the prompt block adapted from the quiz panel's listening card: play button pre-answer (with `playedKey`-style replay + no-voice microcopy from `useSpeech().status`), four EN choice buttons (inherit root `lang="en"`, matching `quizChoiceLang`'s `undefined` for listening), post-answer reveal (sentence `cn` with `lang={HANZI_LANG}` + `SpeakButton`, drilled word hanzi/pinyin/english line exactly like `cloze-panel.tsx:191-195`, plus a "Play slower 🐢" button calling `speak(sentenceCn, { rate: SLOW_SPEECH_RATE })`), score/progress bar header, completion screen with Try again.
4. **Wire into `topic-app.tsx`**: add `"sentence-listen"` to the mode union (line 42); add a `<Tab>` labelled "Listening" after "Scramble", rendered only when `speechAvailable` (same conditional-array idiom as the quiz chip); render `{mode === "sentence-listen" && speechAvailable ? <SentenceListenPanel topic={topic} onRecord={recordQuizAnswer} /> : null}` (double gate mirrors the tone-listen guard at line 512).
5. Run the full validation gate; fix lint/type fallout.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/sentence-listen-logic.ts` | **new** — pure card/deck builders + slow-rate constant |
| `src/components/topic/sentence-listen-panel.tsx` | **new** — the drill panel |
| `src/components/topic-app.tsx` | edit — mode union, speech-gated tab, panel render |
| `tests/sentence-listen-logic.test.mjs` | **new** — unit + dataset tests |

No changes to `quiz-logic.ts`, `progress-logic.ts`, `types.ts`, data files, or validators.

### Proposed function/component names and TypeScript signatures

```ts
// src/lib/sentence-listen-logic.ts
export const SLOW_SPEECH_RATE = 0.65;

export type SentenceListenCard = {
  /** wordKey (`topic.slug:hanzi`) — identity for recordQuizAnswer. */
  key: string;
  /** The drilled word (revealed after answering). */
  hanzi: string;
  pinyin: string;
  english: string;
  /** The spoken sentence — NEVER rendered before the learner answers. */
  sentenceCn: string;
  /** Correct choice: the sentence's English translation. */
  answer: string;
  /** Four unique English translations, answer included, display order. */
  choices: string[];
};

export function buildSentenceListenCard(
  item: VocabItem,
  pool: VocabItem[],
  keyFor: (item: VocabItem) => string,
  shuffle?: <T>(items: T[]) => T[],
): SentenceListenCard | null;

export function buildSentenceListenDeck(
  items: VocabItem[],
  pool: VocabItem[],
  keyFor: (item: VocabItem) => string,
  shuffle?: <T>(items: T[]) => T[],
): SentenceListenCard[];
```

```tsx
// src/components/topic/sentence-listen-panel.tsx
export function SentenceListenPanel(props: {
  topic: Topic;
  onRecord: (key: string, correct: boolean) => void;
}): React.JSX.Element | null;
```

### UI copy/microcopy

- Tab label: **Listening** (distinct from the Quiz chip "Listen 🔊" and the "Sentences" cloze tab)
- Section `aria-label`: `Sentence listening practice`
- Header: `Sentence {n} of {total}` / `Score {n}` (matches cloze)
- Pre-answer helper: `Listen to the sentence, then pick its meaning`
- Play button `aria-label`: `Play the sentence`; replay link: `Replay`
- No-voice microcopy (reuse quiz-panel wording): `Your device has no Chinese voice installed, so listening mode may be silent.` / fallback `No sound? Your device may lack a Chinese voice.`
- Post-answer: slow replay button `Play slower 🐢` (`aria-label`: `Replay the sentence slowly`); word reveal line has no label (hanzi/pinyin/english inline, cloze style); next button `Next sentence` / final `See results`
- Completion: `Listening complete!`, perfect: `Perfect — you understood every sentence.`, otherwise: `Training your ear takes reps — try another round.`, button `Try again`

### Test plan

`tests/sentence-listen-logic.test.mjs` (runs under `npm run test` / `node --test`):
1. Card built with identity shuffle picks the item's first sentence; `answer === sentence.en`; `key === keyFor(item)`; word fields copied.
2. `choices` has 4 unique entries, includes `answer`, and never includes the played sentence's own `en` twice.
3. Distractors never equal the answer (dedupe inherited from `rankedDistractors`).
4. Item with no sentences → `null` card; deck builder drops it and keeps order otherwise (mirror cloze deck test).
5. Deck length equals items-with-sentences count for the fixture.
6. **Dataset-wide**: import `topics.json` (`with { type: "json" }`); for every topic, `buildSentenceListenDeck(topic.items, topic.items, keyFor, identity)` yields exactly 10 cards, each with 4 unique choices and `sentenceCn` non-empty — proving the mode can never render a broken card for shipped data.
7. `SLOW_SPEECH_RATE` is < `SPEECH_RATE` (guards against an accidental "slower" that isn't).

### Manual QA checklist

- [ ] Topic page (e.g. `/topics/<any>`): "Listening" tab appears in Chrome/desktop; hidden when DevTools overrides `speechSynthesis` away (or in a browser with no zh voice, tab hides post-hydration).
- [ ] Pre-answer: no hanzi/pinyin/English-sentence visible; play button speaks the sentence; Replay appears only after first play.
- [ ] Correct answer → emerald flash, score increments; wrong → rose flash, correct choice highlighted.
- [ ] Post-answer reveal: sentence hanzi shown with speak button; drilled word shows hanzi + **pinyin** + English; "Play slower 🐢" audibly slower.
- [ ] Finish all 10 → completion screen; "Try again" reshuffles (different sentences/choices possible).
- [ ] Miss a word, then check `/stats` Trickiest words and `/practice` pick it up (recordQuizAnswer path).
- [ ] Tab strip still scrolls cleanly at 360px width; new tab reachable.
- [ ] Switching topics while mid-run resets cleanly (deck is per-mount; mode resets via the existing topic-change block at `topic-app.tsx:123-132`).
- [ ] Screen reader: reveal block announced (`role="status"`), choices `role="listbox"`/`option`.

### Acceptance criteria

1. A speech-capable browser shows a "Listening" tab on every topic page; devices with confirmed-absent Chinese voices never see it.
2. Each run drills all 10 topic words, one real example sentence each, TTS-spoken on tap (never autoplayed), with 4 unique English choices whose distractors are real sentence translations from the same topic.
3. Chinese text is never visible before answering; after answering the sentence hanzi is shown with `lang="zh-Hans"` and the drilled word appears with its pinyin.
4. Answers record through `recordQuizAnswer` once per card (first pick only).
5. Full gate passes: `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build`.

### Risk and rollback notes

- **TTS quality on long utterances** is the main risk; mitigated by existing `KEEPALIVE_MS` resume loop (built for this), the 0.85 default rate, and the slow-replay escape hatch. Worst case the audio is imperfect — the feature degrades, nothing else breaks.
- **Ambiguous distractors**: two topic sentences could translate similarly. Verified all `en` strings are unique per topic, and `rankedDistractors` dedupes by value; residual risk is pedagogical (a tempting distractor), not correctness.
- **Stranded mode**: if speech flips to unavailable mid-session while on the tab, the double gate (`mode === "sentence-listen" && speechAvailable`) renders nothing rather than a dead panel — same accepted behavior as tone-listen.
- **Rollback** is trivial: revert the single commit — two new files plus a ~6-line `topic-app.tsx` diff; no schema, data, or validator changes, so no migration concerns.

### Non-goals / deferrals

- No sentence-level pinyin (the dataset has none; inventing it is forbidden — matches cloze/scramble precedent).
- No recorded human audio, external TTS APIs, or audio files.
- No new `ProgressState` fields, streaks, combos, or boss-round integration for this mode.
- No inclusion in Daily Challenge, `/practice`, or Duel (those read quiz stats already; deeper integration is a later sprint).
- No autoplay or hands-free "play all sentences" run (the `listen-logic.ts` sequencer exists but chaining it here is out of scope).

### Ready-to-run Opus implementation prompt for Sprint 4

```
You are implementing Sprint 4 of the Learn 10 Mandarin Words app (Next.js 16 /
React 19 / Tailwind 4, static + local-first, repo root = cwd). Read AGENTS.md
first — this Next.js version may differ from your training data; consult
node_modules/next/dist/docs/ if any framework question arises (this sprint
should need none: it adds one pure lib module and one client panel).

FEATURE: "Listening" — a sentence listening-comprehension drill on every topic
page. The learner taps play, hears one of the topic's real example sentences
via the browser's Chinese TTS voice, and picks the correct English translation
from 4 choices. No Chinese text is visible before answering. After answering,
reveal the sentence hanzi, the drilled word (hanzi + pinyin + English), and
replay + slow-replay controls. One card per topic word (10 per run).

STUDY THESE FILES BEFORE WRITING CODE (they are the templates):
- src/lib/cloze-logic.ts + src/components/topic/cloze-panel.tsx  (deck/panel pattern)
- src/lib/quiz-logic.ts  (rankedDistractors + QuizWord structural type + "listening" mode)
- src/components/topic/quiz-panel.tsx lines 212-245  (play-first listening card UX)
- src/components/use-speech.ts + src/lib/speech.ts  (speak(text, {rate}), SPEECH_RATE)
- src/components/topic-app.tsx  (mode union line 42, tab strip ~line 353,
  speechAvailable gate lines 79-80, panel wiring ~line 457, tone-listen double
  gate line 512)
- tests/cloze-logic.test.mjs  (test conventions: node:test, identity shuffle,
  .ts-extension imports, dataset-wide assertion via topics.json import)

BUILD:
1. src/lib/sentence-listen-logic.ts — pure, DOM-free, injectable shuffle:
   export const SLOW_SPEECH_RATE = 0.65;
   export type SentenceListenCard = { key; hanzi; pinyin; english; sentenceCn;
     answer; choices } (JSDoc: sentenceCn is spoken, never shown pre-answer).
   buildSentenceListenCard(item, pool, keyFor, shuffle = defaultShuffle):
     - sentence = shuffle(item.sentences)[0]; null if no sentences.
     - Distractors: map every OTHER sentence in the pool (all items' sentences,
       excluding the chosen sentence by cn) to {hanzi: s.cn, pinyin: "",
       english: s.en} and reuse rankedDistractors(targetAsWord, poolAsWords,
       "listening", shuffle).slice(0, 3) — do NOT modify quiz-logic.ts; its
       QuizWord type already accepts this adapter. Comment why this reuse works.
     - choices = shuffle([answer, ...distractors]); return null if < 3
       distractors (defensive — real data always has 19 candidates).
   buildSentenceListenDeck(items, pool, keyFor, shuffle): map + drop nulls,
     mirroring buildClozeDeck.
   Use the `.ts`-extension import of quiz-logic (same comment/idiom as
   cloze-logic.ts line 7).
2. src/components/topic/sentence-listen-panel.tsx — "use client"; props
   { topic: Topic; onRecord: (key: string, correct: boolean) => void }.
   Clone ClozePanel's state shape (deck/index/picked/score/done, deck built once
   in useState initializer, restart rebuilds). Prompt block adapted from
   quiz-panel's listening card: 72px emerald play button (aria-label "Play the
   sentence"), helper "Listen to the sentence, then pick its meaning", Replay
   link only after first play (playedKey pattern), no-voice microcopy driven by
   useSpeech().status exactly as quiz-panel lines 240-244. Choices: 4 English
   buttons, cloze feedback classes (animate-quiz-correct / animate-quiz-wrong),
   role="listbox"/"option", no lang attribute (English inherits root). onRecord
   fired once per card via the picked!==null guard. Post-answer reveal
   (role="status"): sentenceCn with lang={HANZI_LANG} font-hanzi + SpeakButton
   ("Hear the sentence again"), a "Play slower 🐢" button calling
   speak(current.sentenceCn, { rate: SLOW_SPEECH_RATE }) (aria-label "Replay
   the sentence slowly"), the word line copied from cloze-panel lines 191-195
   (hanzi / pinyin / english — pinyin MUST be shown), "Next sentence" / "See
   results" button. Completion screen mirrors cloze: "Listening complete!",
   score/total, perfect copy "Perfect — you understood every sentence.",
   otherwise "Training your ear takes reps — try another round.", "Try again".
3. Wire topic-app.tsx: add "sentence-listen" to the mode union; add
   <Tab>Listening</Tab> after Scramble, rendered only when speechAvailable;
   render the panel as
   {mode === "sentence-listen" && speechAvailable ?
     <SentenceListenPanel topic={topic} onRecord={recordQuizAnswer} /> : null}
   (double gate mirrors the tone-listen guard).
4. tests/sentence-listen-logic.test.mjs — follow cloze-logic.test.mjs
   conventions (pets fixture with 2 sentences per item, identity shuffle,
   keyFor). Cover: card fields + answer = first sentence's en under identity
   shuffle; 4 unique choices incl. answer; distractors never equal the answer;
   no-sentences item -> null and dropped from deck; SLOW_SPEECH_RATE <
   SPEECH_RATE; dataset-wide: for every topic in src/data/topics.json
   (import with `with { type: "json" }`), the deck has exactly 10 cards, each
   with 4 unique choices and non-empty sentenceCn.

CONSTRAINTS: no new dependencies, no data/schema/validator changes, no backend,
no invented content (especially: do NOT fabricate sentence pinyin — sentences
have none; only the drilled word shows pinyin). Match existing comment density
and Tailwind idiom. Do not modify quiz-logic.ts, progress-logic.ts, types.ts,
or scripts/.

VALIDATION GATE (all must pass before you finish):
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build

Commit as: "learning sprint 4: sentence listening comprehension: hear a real
example sentence, pick the English"
```

---

Key design choice worth flagging: I planned this as a **new topic tab** (mirroring the Cloze/Scramble panels) rather than a fifth mode inside the Quiz tab, because the quiz state machine in `topic-app.tsx` is built on `QuizWord` (which deliberately excludes sentences) and threading sentence data through it would touch far more code. The panel-per-mode pattern gives a smaller, independently shippable diff: two new files, one small edit, one test file.

---

I've grounded the plan in the actual scheduler, session machine, hook, and UI. Here it is.

## Sprint 5 — Leech detection: flag repeatedly-failed words and offer a focused rescue drill

### Goal and user value

Words the learner keeps grading "Again" currently just cycle through the review queue forever: `scheduleReview` resets their interval to 1 day, they come back tomorrow, fail again, repeat. Nothing counts *how often* a word has lapsed, so the app can never say "this one isn't sticking." This sprint adds a persisted lapse counter, derives a **leech** status from it (repeatedly missed and still not mastered), flags those words on `/review` and `/stats`, and offers a small **rescue drill** — a focused review session over just the flagged words, run through the existing session machinery and graded with the real SM-2 scheduler so the rescue directly repairs their schedule.

### Current-state findings grounded in actual files/components/helpers

- `src/lib/types.ts:70` — `FlashcardStat` is `{ intervalDays, ease, dueAt, reviewCount }`. **There is no lapse/failure counter anywhere in the persisted schema**, so leech detection cannot be derived from existing data; a schema change is required.
- `src/lib/progress-logic.ts:548` — `scheduleReview(existing, grade, now)` is the single scheduling choke point; an `"again"` grade sets `intervalDays` to 1 (`nextInterval`, line 530) but records nothing durable about the failure. This is the one place to increment a lapse counter.
- `src/lib/progress-logic.ts:36` — `CURRENT_PROGRESS_SCHEMA_VERSION = 7`, with a documented per-version migration ledger. `normalizeStat` (line 89) already repairs `intervalDays`/`reviewCount` with "coerce to safe defaults, never throw" conventions — a new `lapses` field slots into exactly this pattern (v7 → v8, backfill 0).
- `src/lib/progress-logic.ts:441` — `dueCards(topics, flashcardStats, now)` builds the `DueCard[]` queue (topic-resolved display fields + `key`, `dueAt`, `intervalDays`). A leech queue is the same shape minus the due-date filter.
- `src/lib/session-logic.ts` — `startSession(cards, cap)` / `gradeCard` / `isSessionComplete` / `toughestCards` are a pure session state machine already parameterized by an arbitrary `DueCard[]` and cap (`SESSION_CAP = 20`, `AGAIN_GAP = 3`). **The rescue drill needs zero changes here** — it's just `startSession(leechCards(...), RESCUE_CAP)`.
- `src/components/review-app.tsx:71` — `ReviewApp` seeds a one-time session snapshot from `dueCards`, persists each grade via `gradeWord` (`use-progress.ts:151`, which routes through `scheduleReview` and `withPractice` — so rescue grades automatically stamp streaks/daily goals), and has empty / active / complete states we can extend with a rescue entry point and mode-aware copy. Card backs already show "Current interval: Nd" (line 393) — a natural spot for a "Missed N×" chip.
- `src/lib/progress-logic.ts:713` & `729` — the existing "tricky" `WordStatus` and `computeWeakWords` are **quiz-accuracy** signals over `quizStats`. Leeches are the complementary **SRS-failure** signal over `flashcardStats`; the sprint should mirror their conventions (named thresholds, evidence minimums) without touching them.
- `src/lib/progress-logic.ts:400` — `MASTERED_INTERVAL_DAYS = 7` gives a natural *graduation* rule: a word stops being a leech once its interval climbs back to a week, so no explicit "un-flag" mechanism or reset field is needed.
- `src/components/stats-app.tsx:165` — the stat grid renders `StatCard`s from `computeStats` (`progress-logic.ts:357`), which already loops over all flashcard stats to count `dueReviews`; a `leechWords` count is one more accumulator in the same loop, and `StatCard` accepts `href` for a link to `/review`.
- `src/lib/analytics.ts:16` — `AnalyticsEvent` is a closed union; `review_completed` exists. Rescue events must be added to the union or `track()` won't type-check.
- Tests are Node-native (`node --test`) `.mjs` files importing TS directly: `tests/progress-logic.test.mjs` already covers `normalizeStat`, `scheduleReview`, `dueCards`, `normalizeProgress` migrations, with a `makeTopic` fixture helper to reuse.
- `tests/quality-lint.test.mjs` / `npm run validate:*` validate `src/data/topics.json` only — this sprint touches no dataset, so those gates should pass untouched.

### Exact implementation steps in sequence

1. **Schema: add `lapses` to `FlashcardStat`** (`src/lib/types.ts`). Non-negative integer, count of `"again"` grades ever recorded. Document it as added in schema v8.
2. **Migration** (`src/lib/progress-logic.ts`): bump `CURRENT_PROGRESS_SCHEMA_VERSION` to 8 and extend the version-ledger comment (`v7 → v8: added lapses to each FlashcardStat; older stats backfill to 0, losing nothing else`). In `defaultStat`, add `lapses: 0`. In `normalizeStat`, coerce `lapses` exactly like `reviewCount` (finite, ≥ 0, rounded; else 0).
3. **Count lapses at the choke point**: in `scheduleReview`, return `lapses: stat.lapses + (grade === "again" ? 1 : 0)`. No other write path exists, so nothing else changes (`previewIntervals` calls `scheduleReview` but only reads `intervalDays` — unaffected).
4. **Leech derivation** (new section in `progress-logic.ts`, next to the Weak/tricky section): add `LEECH_LAPSE_THRESHOLD = 4`, `isLeech(stat)` (lapses ≥ threshold AND `intervalDays < MASTERED_INTERVAL_DAYS`), and `leechCards(topics, flashcardStats)` mirroring `dueCards` but filtering on `isLeech` (ignoring `dueAt`), sorted most-lapsed first with deterministic tiebreaks. Add `lapses` to the `DueCard` type and populate it in **both** `dueCards` and `leechCards` (the only two constructors).
5. **Stats count**: add `leechWords` to `ProgressStats` and accumulate it inside `computeStats`'s existing loop via `isLeech`.
6. **Rescue cap** (`src/lib/session-logic.ts`): export `RESCUE_CAP = 8` (constant only — the state machine is reused as-is).
7. **Analytics** (`src/lib/analytics.ts`): add `"rescue_drill_completed"` to `AnalyticsEvent`.
8. **`/review` UI** (`src/components/review-app.tsx`):
   - Add `mode: "due" | "rescue"` state (default `"due"`), seeded alongside the existing one-time session snapshot.
   - `startRescue()` — explicit user action: `setSession(startSession(leechCards(data.topics, progress.flashcardStats), RESCUE_CAP))`, set mode, reset `revealed`.
   - Compute `leeches = leechCards(...)` once per progress change (memo). When `mode === "due"` and `leeches.length > 0`, render a rescue panel: in the **empty state** card (as a second CTA next to "Browse topics") and, when a due session is active/complete, as a compact banner section under the header.
   - In rescue mode: header copy switches ("Rescue Drill", "N words that keep slipping…"), the card-count line uses the rescue queue, and the completion screen's primary button becomes "Rescue N more" (re-derives `leechCards` — words graded well enough may have graduated, which is the point). Fire `track("rescue_drill_completed", { count })` where `review_completed` fires today, keyed on mode.
   - On the card **back** face, when `current.lapses >= LEECH_LAPSE_THRESHOLD`, show a small chip next to "Current interval: Nd": `Missed {lapses}×`.
   - Grading, drag/fling, toasts, `ShareScoreButton` (keep `kind: "review"`), and `toughestCards` all work unchanged because rescue is just another `ReviewSession`.
9. **`/stats` UI** (`src/components/stats-app.tsx`): add one `StatCard` — value `stats.leechWords`, `href="/review"` — to the existing grid.
10. **Tests** (extend `tests/progress-logic.test.mjs`; new asserts in `tests/session-logic.test.mjs` are not needed): see test plan.
11. Run the full validation gate.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/types.ts` | `FlashcardStat.lapses` |
| `src/lib/progress-logic.ts` | schema v8, `defaultStat`/`normalizeStat`/`scheduleReview` lapses, `LEECH_LAPSE_THRESHOLD`, `isLeech`, `leechCards`, `DueCard.lapses`, `computeStats.leechWords` |
| `src/lib/session-logic.ts` | `RESCUE_CAP` constant |
| `src/lib/analytics.ts` | `"rescue_drill_completed"` event |
| `src/components/review-app.tsx` | rescue mode, panels, chip, mode-aware copy |
| `src/components/stats-app.tsx` | leech `StatCard` |
| `tests/progress-logic.test.mjs` | new + updated assertions |

(`use-progress.ts` needs no changes — `gradeWord` already flows through `scheduleReview`.)

### Proposed names and signatures

```ts
// progress-logic.ts
export const LEECH_LAPSE_THRESHOLD = 4;
export function isLeech(stat: FlashcardStat | undefined): boolean;
export function leechCards(
  topics: Topic[],
  flashcardStats: Record<string, FlashcardStat>,
): DueCard[]; // sorted: b.lapses - a.lapses, then oldest dueAt, then key

export type DueCard = { /* existing fields */; lapses: number };
export type ProgressStats = { /* existing fields */; leechWords: number };

// session-logic.ts
export const RESCUE_CAP = 8;

// review-app.tsx (internal)
type ReviewMode = "due" | "rescue";
function startRescue(): void;
```

`isLeech` semantics: `normalizeStat` the input (tolerant of legacy/corrupt entries, per house style), then `lapses >= LEECH_LAPSE_THRESHOLD && intervalDays < MASTERED_INTERVAL_DAYS`. Threshold 4 rather than Anki's 8 because this app's decks are 10 words per topic and intervals are short — 4 failed reviews is already a strong signal at this scale; it's a named constant in one place, trivially tunable.

### UI copy / microcopy

- Rescue banner (due mode, leeches exist): heading **"{N} word{s} keep slipping"**; body **"You've missed these {N}+ times in review. A short rescue drill gives them focused attention until they stick."** (first `{N}` is the count, second is `LEECH_LAPSE_THRESHOLD`); button **"Start rescue drill"** (amber accent, matching the existing "to re-check" chip family).
- Empty-state CTA: **"Rescue {N} tricky word{s}"**.
- Rescue mode header: **"Rescue Drill"** / subline **"{N} words that keep slipping. Grade honestly — a Good or Easy here reschedules them for real."**
- Card-back chip: **"Missed {lapses}×"** with `aria-label="Missed {lapses} times in review"`.
- Rescue completion: **"Rescue drill complete!"** / **"You worked through {N} word{s}. Words graduate off the rescue list once their review interval reaches a week."**; more-button **"Rescue {N} more"**.
- Stats card: value `{N}`, label **"word{s} flagged for rescue"**, sublabel **"missed {threshold}+ reviews — run a rescue drill"**.
- All hanzi lines in any rescue list/card use the existing pattern: `lang={HANZI_LANG}` hanzi + `<TonePinyin>` pinyin + English, as in `review-app.tsx:270-275`.

### Test plan (`tests/progress-logic.test.mjs`, reusing `makeTopic`)

1. `defaultStat` includes `lapses: 0`.
2. `scheduleReview` increments `lapses` only on `"again"`; `hard`/`good`/`easy` preserve it; a stat missing `lapses` (legacy v7 shape) schedules without throwing and backfills 0.
3. `normalizeStat` coerces `lapses`: missing/negative/NaN/`"3"` → 0 or rounded; valid float rounds.
4. `normalizeProgress` on a v7-shaped save keeps every flashcard stat and stamps `lapses: 0`; `schemaVersion` becomes 8.
5. `isLeech`: false below threshold, true at threshold with a short interval, **false at threshold once `intervalDays >= MASTERED_INTERVAL_DAYS`** (graduation), false for `undefined`.
6. `leechCards`: includes non-due leeches (future `dueAt`), excludes low-lapse and mastered words, sorts by lapses desc with deterministic ties, resolves display fields/`key` via `wordKey`.
7. `dueCards` now carries `lapses` on each card.
8. `computeStats` counts `leechWords` correctly and returns 0 on `emptyProgress`.

### Manual QA checklist

- [ ] Fresh profile: `/review` shows no rescue banner; `/stats` rescue card shows 0.
- [ ] Seed a leech (grade one word "Again" 4 times across sessions, or hand-edit `learn-10-mandarin-progress-v1` in devtools): banner appears with correct count; card back shows "Missed 4×".
- [ ] Start rescue drill: queue contains only flagged words (including ones not currently due), capped at 8; header/copy switch to rescue.
- [ ] Grade a rescue card "Good": toast shows the scheduled interval; word's `dueAt` moves out (check localStorage) — rescue grades are real.
- [ ] Complete the drill: "Rescue drill complete!" summary, tally and toughest-list render, share button still works.
- [ ] Grade a leech up to a 7-day interval (Easy twice): it disappears from the rescue list and the stats count drops.
- [ ] Existing v7 save in localStorage loads without console errors; export → import round-trips with `lapses` intact.
- [ ] Swipe/fling, reduced-motion, and keyboard grading behave identically in rescue mode; pinyin renders with tone colors when toggled.

### Acceptance criteria

1. Every `"again"` grade durably increments that word's `lapses`; no other grade does.
2. A word with ≥ 4 lapses and interval < 7 days is visibly flagged on `/review` (banner + card chip) and counted on `/stats`.
3. The rescue drill runs only flagged words (max 8), regardless of due date, through the normal grading flow with real persistence.
4. Words graduate off the rescue list when their interval reaches `MASTERED_INTERVAL_DAYS`.
5. Pre-existing saves migrate silently (v8) with zero data loss; export/import unaffected.
6. `npm run test`, `validate:data`, `validate:quality`, `lint`, and `build` all pass.

### Risk and rollback notes

- **Schema risk is the main one**, and it's well-worn: this is the 6th additive field migration through `normalizeProgress`; backfilling `lapses: 0` loses nothing and old clients reading a v8 save simply ignore the extra field. Rollback = revert the commit; v8 saves normalize fine under v7 code because `normalizeStat` ignores unknown fields.
- **Historical blindness**: existing users' past failures weren't counted, so leeches surface only from post-deploy behavior. Acceptable — stated nowhere as retroactive.
- **Double-counting within a session**: an "Again" card is requeued in-session (`AGAIN_GAP`) and re-grading it fires `gradeWord` again (documented deliberate behavior in `review-app.tsx:89-94`), so one bad session can add 2 lapses. That's arguably signal, not noise; if it over-flags, raise `LEECH_LAPSE_THRESHOLD` — one constant.
- Rescue mode is additive UI in `review-app.tsx`; the due-review path is untouched when no leeches exist, so blast radius is small.

### Non-goals / deferrals

- No lapse-based ease penalty or interval changes — scheduling math (`nextInterval`, `EASE_DELTA`) is untouched.
- No merging with the quiz-accuracy "tricky" status or `computeWeakWords`; they remain a separate, complementary signal.
- No leech surfacing on topic pages, home, `next-step-panel.tsx`, or achievements (candidate for a later sprint).
- No manual "suspend/dismiss this leech" control, no lapse-reset mechanism, no notification/reminder.
- No dataset (`topics.json`) or validation-script changes.

### Ready-to-run Opus implementation prompt for Sprint 5

```text
Implement Sprint 5 of the Learn 10 Mandarin Words app (Next.js 16 / React 19 / Tailwind 4,
static, localStorage-only — read AGENTS.md and node_modules/next/dist/docs/ before writing
Next.js-specific code): leech detection + rescue drill. Follow the existing code style:
heavily-commented pure logic modules, DOM-free helpers with injectable clocks, and
never-throw normalizers.

1. src/lib/types.ts — add `lapses: number` to FlashcardStat (count of "again" grades;
   non-negative integer; added in schema v8). Document it like the sibling fields.

2. src/lib/progress-logic.ts:
   - Bump CURRENT_PROGRESS_SCHEMA_VERSION to 8; extend the version-history comment:
     v7 → v8 added `lapses` per flashcard stat, older stats backfill 0, losing nothing.
   - defaultStat: include lapses: 0.
   - normalizeStat: coerce lapses exactly like reviewCount (finite, >= 0, rounded, else 0).
   - scheduleReview: increment lapses by 1 only when grade === "again".
   - Add `lapses: number` to the DueCard type and populate it in dueCards.
   - New exported helpers (new "Leech detection" section, near the Weak/tricky section):
       export const LEECH_LAPSE_THRESHOLD = 4;
       export function isLeech(stat: FlashcardStat | undefined): boolean
         // normalizeStat first; true iff lapses >= LEECH_LAPSE_THRESHOLD
         // AND intervalDays < MASTERED_INTERVAL_DAYS (mastery graduates a leech)
       export function leechCards(topics: Topic[], flashcardStats: Record<string, FlashcardStat>): DueCard[]
         // like dueCards but filtered by isLeech, IGNORING dueAt; sort lapses desc,
         // then oldest dueAt, then key (stable/deterministic)
   - computeStats/ProgressStats: add `leechWords` (count of stats passing isLeech),
     accumulated in the existing loop.

3. src/lib/session-logic.ts — export const RESCUE_CAP = 8 with a short comment. No other
   changes; the session machine is reused as-is.

4. src/lib/analytics.ts — add "rescue_drill_completed" to AnalyticsEvent.

5. src/components/review-app.tsx:
   - Add mode state: "due" | "rescue" (default "due"). Memoize
     leechCards(data.topics, progress.flashcardStats) against progress.
   - startRescue(): setSession(startSession(leeches, RESCUE_CAP)), set mode "rescue",
     reset revealed. Restarting from the completion screen re-derives leechCards.
   - Due mode, leeches present: render an amber-accented rescue banner section under the
     header (heading "{N} words keep slipping", body "You've missed these {THRESHOLD}+
     times in review. A short rescue drill gives them focused attention until they
     stick.", button "Start rescue drill"); in the empty "All caught up!" state add a
     "Rescue {N} tricky words" CTA button beside "Browse topics".
   - Rescue mode: h1 "Rescue Drill"; subline "{N} words that keep slipping. Grade
     honestly — a Good or Easy here reschedules them for real."; completion heading
     "Rescue drill complete!" with body noting words graduate once their interval
     reaches a week; the review-more button reads "Rescue {N} more"; fire
     track("rescue_drill_completed", { count }) instead of review_completed.
   - Card back: when current.lapses >= LEECH_LAPSE_THRESHOLD, show a "Missed {lapses}×"
     chip (aria-label "Missed {lapses} times in review") next to the interval line.
   - Keep grading/persistence identical (gradeWord), keep drag/fling, toasts, tone
     colors, TonePinyin on all pinyin, and 44px min touch targets.

6. src/components/stats-app.tsx — add one StatCard to the grid: value stats.leechWords,
   label "word(s) flagged for rescue" (pluralize), sublabel "missed 4+ reviews — run a
   rescue drill", href "/review".

7. tests/progress-logic.test.mjs — extend using the existing makeTopic fixture:
   defaultStat lapses; scheduleReview increments on again only and tolerates legacy
   stats without lapses; normalizeStat coercion cases; normalizeProgress migrates a
   v7 save (backfills lapses 0, stamps v8); isLeech threshold/graduation/undefined
   cases; leechCards filtering + ordering + non-due inclusion; dueCards carries lapses;
   computeStats.leechWords (including emptyProgress → 0).

Do NOT touch topics.json, validation scripts, scheduling math (nextInterval/EASE_DELTA),
quiz-based tricky/weak-word logic, or use-progress.ts.

Validation gate (all must pass):
  npm run test
  npm run validate:data
  npm run validate:quality
  npm run lint
  npm run build
```

---

I've inspected the repo and have everything needed. The key finding shaping this plan: the **topic quiz already has** a recap with missed words and "Retry missed" (`quiz-panel.tsx`), but the two other session surfaces are incomplete — `/review` has a recap with a "Toughest this session" list that only *links away* (no re-drill), and `/daily` has a recap with **no missed-word list at all**. That's the gap this sprint closes.

## Sprint 6 — End-of-session recap screen with missed words and one-tap re-drill

### Goal and user value

When a learner finishes a review or daily-challenge session, the words they just got wrong are at their highest-leverage moment for correction. Today the `/review` recap shows those words but only offers a link to their topic pages, and the `/daily` recap doesn't show them at all. This sprint adds a shared, one-tap **re-drill**: a short, in-place multiple-choice pass over exactly the missed words, with distractors drawn from each word's own topic, looping until the learner clears them (or bails). It is deliberately **scheduling-neutral**: it records quiz accuracy (feeding the existing weak-words signal) but never touches SM-2 flashcard scheduling, so a session's grades stay intact.

### Current-state findings (grounded in actual files)

- **Topic quiz — already done.** `src/components/topic/quiz-panel.tsx:86-152` renders a completion screen with a missed-word list (hanzi + pinyin + english) and a "Retry missed (N)" button; `src/lib/quiz-logic.ts` provides `buildQuiz(items, pool, …)` where a retry passes the missed subset as `items` and the full topic as `pool` (`quiz-logic.ts:235-243`) plus `itemsForKeys` (`quiz-logic.ts:247-254`). No work needed here — it's the pattern to replicate.
- **`/review` recap exists but has no re-drill.** `src/components/review-app.tsx:235-319` shows a grade tally and a "Toughest this session" list built from `toughestCards(session)` (`src/lib/session-logic.ts:84-91`, the deduped keys ever graded "Again"). Each tough card only offers a `Link` to `/topics/{slug}` (`review-app.tsx:276-281`). `DueCard` carries `key`, `hanzi`, `pinyin`, `english`, `topicSlug`, `topicTitle` (`src/lib/progress-logic.ts:425-434`) — everything needed to resolve a drill deck.
- **`/daily` recap has neither missed list nor re-drill.** `src/components/daily-app.tsx:151-197` shows score, streak, Wordle-style share, and two links out. The live run tracks `outcomes: boolean[]` index-aligned with `session.questions` (`daily-app.tsx:52,82`), and each `DailyQuestion` carries `card.key` (a `wordKey`), `item`, and `topicSlug` (`src/lib/daily-logic.ts:29-35`) — so missed words are derivable **for the live run only**. The stored prior-day result persists only score/total (`daily-app.tsx:126-132`), not which words were missed, so no re-drill is possible in the "already done today" state.
- **Persistence surfaces to reuse, and one to avoid.** `useProgress().recordQuizAnswer(key, correct)` updates `quizStats` and stamps daily activity (`src/components/use-progress.ts:118-121`) — safe and desirable during a re-drill (feeds `computeWeakWords`, `progress-logic.ts:483-505`). `gradeWord` (`use-progress.ts:151-161`) runs SM-2 `scheduleReview` — the re-drill must **never** call it, or it would double-schedule cards just graded.
- **Deck-building machinery already exists and is reusable.** `buildQuizCard(item, pool, mode, keyFor, shuffle)` (`quiz-logic.ts:206-229`) builds a 4-choice card with tone/similarity-ranked distractors; `src/lib/practice-logic.ts:34-60` (`resolveWeakItems`) already demonstrates the wordKey → `{item, topic, poolItems}` resolution this sprint needs, keyed by `wordKey` from `src/lib/data-logic.ts:43-45`.
- **Established component patterns to follow:** session snapshot via the "adjust state during render" / `useState(initializer)` pattern to avoid mid-run reshuffles (`practice-app.tsx:37-58`, `review-app.tsx:63-73`); analytics via the typed `track` union in `src/lib/analytics.ts:15-39`; tests are `node --test` `.mjs` files importing TS with explicit `.ts` extensions (`tests/session-logic.test.mjs:1-11`).
- **Framework:** no new routes, layouts, or data fetching — all changes are inside existing `"use client"` components, so Next 16 routing quirks aren't in play. Per `AGENTS.md`, the implementer should still skim `node_modules/next/dist/docs/` before touching component code.

### Exact implementation steps in sequence

1. **Create `src/lib/redrill-logic.ts`** (pure, DOM-free, mirrors `practice-logic.ts`):
   - `RedrillEntry` type: `{ key, item, topicSlug, topicTitle, poolItems }`.
   - `redrillEntries(topics, keys)`: resolve wordKeys to entries via a `wordKey` index (same policy as `resolveWeakItems`: preserve key order, silently drop unresolvable keys, pool = owning topic's full item list).
   - `buildRedrillDeck(entries, shuffle?)`: one `buildQuizCard` per entry in `"hanzi-english"` mode with `keyFor: () => entry.key` (identical to `buildPracticeQuiz`, `practice-logic.ts:65-71`).
   - Use explicit `.ts` extensions on runtime imports (`quiz-logic.ts`, `data-logic.ts`) so `node --test` resolves them — same convention documented at the top of `practice-logic.ts`.
2. **Create `src/components/redrill-panel.tsx`** (`"use client"`): a self-contained mini quiz over the entries — prompt hanzi + `SpeakButton`, pinyin revealed with the answer via the card's `promptPinyin`, 4 choices with the existing correct/wrong animation classes, then a mini summary. Deck is snapshotted in a `useState` initializer (never rebuilt on re-render). On finishing a pass: if some words were missed again, offer "Drill again (N)" (rebuild deck from the still-missed subset); otherwise show the cleared state. Calls `onRecordAnswer(key, correct)` per answer and `onClose()` to return to the recap. Fire `track("redrill_completed", { count, cleared })` when a pass ends.
3. **Add `"redrill_completed"`** to the `AnalyticsEvent` union in `src/lib/analytics.ts`.
4. **Wire into `/review`** (`review-app.tsx`): add `const [drillEntries, setDrillEntries] = useState<RedrillEntry[] | null>(null)`. In the recap's "Toughest this session" block, add a primary button "Drill these again (N)" that sets `drillEntries` from `redrillEntries(data.topics, tough.map(c => c.key))`. When `drillEntries` is set, render `<RedrillPanel …>` instead of the recap card, passing `recordQuizAnswer` (already available from the `useProgress()` destructure — extend it) and `onClose={() => setDrillEntries(null)}`. **Do not** route drill answers through `gradeWord`.
5. **Wire into `/daily`** (`daily-app.tsx`): during the live run, collect `missedKeys` in `handleAnswer` (alongside the existing `outcomes` update). On the `done` completion screen only (never the `storedResult` replay state, which has no per-word data), render a missed-word list (hanzi + pinyin + english from `question.item`, matching the list style in `quiz-panel.tsx:109-124`) and a "Re-drill the N you missed" button that opens `RedrillPanel` in place of the recap, with microcopy noting it doesn't change today's official score (the result is already persisted first-completion-wins, `progress-logic.ts:646-662`).
6. **Add `tests/redrill-logic.test.mjs`** (see test plan).
7. Run the full validation gate.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/redrill-logic.ts` | **new** — pure resolution + deck building |
| `src/components/redrill-panel.tsx` | **new** — shared drill UI |
| `src/components/review-app.tsx` | drill state + button in recap, panel swap |
| `src/components/daily-app.tsx` | missedKeys, missed list, drill button, panel swap |
| `src/lib/analytics.ts` | add `"redrill_completed"` event |
| `tests/redrill-logic.test.mjs` | **new** — unit tests |

### Proposed names and signatures

```ts
// src/lib/redrill-logic.ts
export type RedrillEntry = {
  key: string;            // wordKey (`topic.slug:hanzi`)
  item: VocabItem;
  topicSlug: string;
  topicTitle: string;
  poolItems: VocabItem[]; // owning topic's items — distractor pool
};

export function redrillEntries(topics: Topic[], keys: Iterable<string>): RedrillEntry[];

export function buildRedrillDeck(
  entries: RedrillEntry[],
  shuffle: <T>(items: T[]) => T[] = defaultShuffle,
): QuizCard[];
```

```tsx
// src/components/redrill-panel.tsx
export function RedrillPanel({ entries, onRecordAnswer, onClose }: {
  entries: RedrillEntry[];
  onRecordAnswer: (key: string, correct: boolean) => void;
  onClose: () => void;
}): React.JSX.Element;
```

Internal panel state: `deck: QuizCard[]` (useState initializer), `index`, `picked: string | null`, `missedKeys: string[]`, `done: boolean`; `drillAgain()` rebuilds the deck from `entries.filter(e => missedKeys.includes(e.key))` and resets the run.

### UI copy / microcopy

- Review recap button (inside the Toughest section): **"Drill these again (3)"**
- Daily recap section header: **"3 to review"**; button: **"Re-drill the 3 you missed"**; subline: *"A quick extra pass — today's score stays as is."*
- Panel header: **"Quick re-drill"** · progress: *"Word 1 of 3"*
- Cleared: **"All corrected! 🎉"** / *"You nailed all 3 on this pass."* → button **"Done"**
- Still missed: **"Almost there"** / *"2 still tricky — one more pass?"* → buttons **"Drill again (2)"** (primary) and **"Done for now"**
- Pinyin always accompanies hanzi in the list and the post-answer reveal (project rule; `promptPinyin` handles the card, list items render all three lines as in `quiz-panel.tsx:115-121`).

### Test plan

`tests/redrill-logic.test.mjs`, node:test + strict assert, importing from `../src/lib/redrill-logic.ts`:
- `redrillEntries` resolves keys to the right items with `poolItems` equal to the owning topic's full item list.
- Preserves input key order; drops unresolvable keys silently; empty keys → `[]`.
- `buildRedrillDeck` with an identity shuffle: one card per entry, `card.key === entry.key`, answer is the entry's english, 4 unique choices, `promptPinyin` set (hanzi-english mode).
- A single-entry deck still gets 3 distractors when the topic pool is large (the practice-logic guarantee, per `buildQuizCard`'s pool-based draw).

Existing suites (`session-logic`, `quiz-logic`, `practice-logic`, `daily-logic`) must pass unchanged — this sprint adds no behavior changes to those modules.

### Manual QA checklist

1. Grade several cards "Again" in a `/review` session → recap shows "Drill these again (N)"; tap it → drill runs over exactly those words.
2. In DevTools, confirm `learn-10-mandarin-progress-v1.flashcardStats` **unchanged** by drill answers; `quizStats` attempts increment.
3. Miss every drill word → "Drill again (N)" loops; clear them → "All corrected!"; "Done" returns to the intact recap (tally/toughest unchanged).
4. Review session with zero "Again" grades → no drill button (unchanged recap).
5. `/daily` live run with misses → recap lists them with pinyin + offers re-drill; re-drill does not alter `dailyChallenge[today]` or the share strip.
6. Perfect daily run → no missed section. Reload `/daily` after completion (stored-result state) → no missed list/re-drill offered.
7. Keyboard/AT sanity: buttons are real `<button>`s ≥44px, choices keep the `role="listbox"`/`option` pattern; reduced-motion unaffected (reuses existing animation classes only).
8. Mobile viewport: panel fits within the recap card width, bottom nav unobstructed.

### Acceptance criteria

- `/review` recap offers a one-tap re-drill whenever ≥1 card was graded "Again"; the drill covers exactly those words and never mutates `flashcardStats`.
- `/daily` live-run recap lists missed words (hanzi + pinyin + english) and offers a one-tap re-drill; the official daily result and share strip are unaffected.
- Drill answers persist through `recordQuizAnswer` (weak-words signal updates).
- Missed-again words can be re-drilled repeatedly until cleared.
- No new routes, no localStorage schema change (`CURRENT_PROGRESS_SCHEMA_VERSION` stays 7), no new dependencies.
- Full gate passes: `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build`.

### Risk and rollback notes

- **Biggest correctness risk:** routing drill answers through `gradeWord` would double-schedule just-graded cards. Guard: the panel only ever receives `recordQuizAnswer`; call it out in code comments and review.
- **Mid-run reshuffle risk:** `recordQuizAnswer` mutates `quizStats` on every answer; any deck derivation that reads progress live would reshuffle. Mitigated by the established snapshot pattern (deck in a `useState` initializer).
- **Daily stored-result state:** per-word outcomes aren't persisted (`DailyChallengeResult` is score/total only) — the plan deliberately scopes re-drill to the live run rather than expanding the schema.
- **Rollback:** purely additive UI + two new files; a single `git revert` restores prior behavior. No stored-data migration in either direction.

### Non-goals / deferrals

- `/practice` missed-only re-drill — its recap already lists missed words, and "Practice again" re-resolves the weak list (which includes fresh misses at `minAttempts: 2`). Defer.
- Recaps for Lightning, Duel, Boss, tone trainers — different session shapes; separate sprints.
- Persisting daily per-word outcomes (schema v8) to enable re-drill on the stored-result state.
- Listening-mode or mixed-mode re-drill; SM-2/scheduling changes; extending `SESSION_CAP` behavior.

### Ready-to-run Opus implementation prompt for Sprint 6

```
You are implementing Sprint 6 of the "Learn 10 Mandarin Words" app (Next.js 16 / React 19 / Tailwind 4,
static, local-first, no backend). Per AGENTS.md, this Next.js version has breaking changes — read the
relevant guides in node_modules/next/dist/docs/ before writing code (you are only editing existing
"use client" components and adding one lib module + one component; no new routes).

GOAL: End-of-session recap with missed words and one-tap re-drill, on /review and /daily.
The topic quiz (src/components/topic/quiz-panel.tsx) already has this — replicate its pattern, do not touch it.

1. NEW src/lib/redrill-logic.ts (pure, DOM-free, mirrors src/lib/practice-logic.ts, including the
   explicit `.ts` runtime import extensions for node --test):
   - export type RedrillEntry = { key: string; item: VocabItem; topicSlug: string; topicTitle: string; poolItems: VocabItem[] }
   - export function redrillEntries(topics: Topic[], keys: Iterable<string>): RedrillEntry[]
     Build a wordKey index (src/lib/data-logic.ts wordKey), preserve input key order, silently drop
     unresolvable keys, poolItems = owning topic's full items.
   - export function buildRedrillDeck(entries, shuffle = defaultShuffle): QuizCard[]
     One buildQuizCard per entry, mode "hanzi-english", keyFor: () => entry.key (see buildPracticeQuiz).

2. NEW src/components/redrill-panel.tsx ("use client"):
   export function RedrillPanel({ entries, onRecordAnswer, onClose }): a compact in-place quiz.
   - Deck snapshotted via useState initializer (NEVER rebuilt on re-render — quizStats mutates per answer).
   - Per card: hanzi prompt + SpeakButton, 4 choices reusing the existing correct/wrong classes
     (animate-quiz-correct / animate-quiz-wrong, see practice-app.tsx), pinyin shown with the reveal
     via card.promptPinyin (pinyin must always accompany hanzi).
   - Track missedKeys; on pass end show either "All corrected! 🎉 / You nailed all N on this pass." with
     a "Done" button, or "Almost there / N still tricky — one more pass?" with "Drill again (N)" (primary,
     rebuilds deck from still-missed entries) and "Done for now".
   - Call onRecordAnswer(card.key, correct) once per answer. Fire track("redrill_completed",
     { count, cleared }) when a pass ends. Header "Quick re-drill", progress "Word X of N".
   - Match existing styling idiom: rounded-3xl border border-white/10 bg-surface cards, emerald primary
     pills, min-h-[44px] buttons, role="listbox"/"option" choices.

3. src/lib/analytics.ts: add "redrill_completed" to the AnalyticsEvent union.

4. src/components/review-app.tsx: in the completion recap's "Toughest this session" block, add a primary
   button "Drill these again (N)" (only when tough.length > 0). It sets drill state from
   redrillEntries(data.topics, tough.map(c => c.key)); while set, render RedrillPanel instead of the recap,
   onClose clears it back to the recap. Destructure recordQuizAnswer from the existing useProgress() call
   and pass it as onRecordAnswer. CRITICAL: never route drill answers through gradeWord — the drill must
   not touch SM-2 flashcardStats.

5. src/components/daily-app.tsx: collect missedKeys in handleAnswer (alongside outcomes). On the `done`
   completion screen ONLY (never the storedResult replay state — per-word outcomes aren't persisted),
   render a missed-word list (hanzi + pinyin + english from question.item, styled like the missed list in
   quiz-panel.tsx) headed "N to review", plus a button "Re-drill the N you missed" with subline
   "A quick extra pass — today's score stays as is." Opens RedrillPanel in place of the recap; answers go
   through recordQuizAnswer; the persisted dailyChallenge result and share strip must be unaffected.

6. NEW tests/redrill-logic.test.mjs (node:test + assert/strict, import from ../src/lib/redrill-logic.ts):
   resolution correctness (items + poolItems), key-order preservation, unresolvable keys dropped,
   empty input → [], and deck building under an identity shuffle (card.key === entry.key, answer is the
   entry's english, 4 unique choices, promptPinyin set, single-entry deck still gets 3 distractors from
   its topic pool).

Constraints: no new routes, no localStorage schema change (schemaVersion stays 7), no new dependencies,
no invented vocabulary or external content, pinyin on every Chinese line.

Validation gate (all must pass):
  npm run test
  npm run validate:data
  npm run validate:quality
  npm run lint
  npm run build

Commit as: "sprint 6: end-of-session recap re-drill: one-tap missed-word drill on review + daily"
```

---

I've inspected the review page, SRS scheduler, storage layer, and the closest existing chart precedent (the /stats heatmap). Here is the plan.

## Sprint 7 — Review forecast: 7-day upcoming-due bar chart on the review page

### Goal and user value

Add a small, sleek 7-column bar chart to `/review` showing how many flashcards come due today and on each of the next six days. Learners can see tomorrow's load before it arrives, plan sessions around heavy days, and never get ambushed by a 20-card backlog. Purely a **read** over data the app already persists — no schema change, no new storage, no network, no chart library.

### Current-state findings (grounded in actual files)

- **Route**: `src/app/review/page.tsx` is a thin server page that renders `<ReviewApp data={data} />` (`src/components/review-app.tsx`).
- **SRS data**: every graded word has a `FlashcardStat { intervalDays, ease, dueAt, reviewCount }` (`src/lib/types.ts:70`) keyed by `wordKey` in `progress.flashcardStats`, persisted to localStorage via the `useProgress` hook. `scheduleReview` (`src/lib/progress-logic.ts:548`) stamps `dueAt` as a full ISO timestamp at `now + intervalDays` days — so future due dates already exist; nothing new needs persisting.
- **Due-queue precedent**: `dueCards(topics, flashcardStats, now)` (`progress-logic.ts:441`) filters `dueAt <= now`; `computeStats` (`progress-logic.ts:357`) counts `dueReviews` the same way. Neither looks forward — that's the gap this sprint fills.
- **Chart precedent**: Sprint 5's heatmap is the house pattern to copy exactly: a pure, DOM-free builder in `src/lib/heatmap-logic.ts` (injectable `endDay`, UTC-day convention via `todayISO()`, hardcoded deterministic labels, `DAY_MS = 86_400_000`) plus a presentational client component `src/components/study-heatmap.tsx` (Tailwind-only bars, one labelled `role="img"` container with a summary sentence, `aria-hidden` cells, emerald intensity classes).
- **Review page states**: `review-app.tsx` renders three states — empty ("All caught up!", line 219), active card (line 320), and session complete (line 235). The forecast is most valuable in the empty and complete states ("when should I come back?"), and `progress.flashcardStats` is live state there, so the chart will update as grades land.
- **Session cap detail**: `SESSION_CAP = 20` in `src/lib/session-logic.ts` — the forecast reads persisted stats, not the session queue, so requeued "Again" copies can't double-count.
- **Test convention**: `node --test` over `tests/*.test.mjs`, importing lib files with explicit `.ts` extensions and a pinned deterministic date (see `tests/heatmap-logic.test.mjs`, which pins `END = "2026-07-05"`).
- One nuance to encode deliberately: `dueCards` compares full timestamps, but a day-bucketed chart's "Today" bar naturally includes overdue cards **and** cards due later today (UTC). That's the honest "due today" number; the Today bar may therefore read slightly higher than the current queue length. Document it in the builder's comment.

### Exact implementation steps in sequence

1. **Create `src/lib/forecast-logic.ts`** — pure, DOM-free, mirroring `heatmap-logic.ts`:
   - `FORECAST_DAYS = 7`, `DAY_MS = 86_400_000`, hardcoded `WEEKDAY_NAMES = ["Sun".."Sat"]` (UTC, locale-independent).
   - `buildForecast(flashcardStats, endless-injectable now)` buckets each stat by the UTC day of `dueAt` (`.slice(0, 10)` convention): due day ≤ today → bucket 0 (overdue folds into Today); today+1 … today+6 → buckets 1–6; beyond the window → excluded (but counted in a `beyondWindow` total for the summary sentence). Invalid/non-ISO `dueAt` values are skipped defensively (reuse the `isValidISO` idiom).
   - Labels: bucket 0 → `"Today"`, bucket 1 → `"Tmrw"` (short label; full word in the tooltip/aria), buckets 2–6 → UTC weekday names.
   - Also export `forecastSummaryLabel(model)` for the `role="img"` container and `forecastBarTitle(day)` for per-bar native tooltips, mirroring `cellTitle`/`heatmapSummaryLabel`.
2. **Create `src/components/review-forecast.tsx`** — presentational client component, no state of its own: `useMemo` over `buildForecast(flashcardStats)`, render 7 equal-width columns with CSS-percentage bar heights scaled to `model.max`, count above each bar, day label below. Today's bar in solid emerald (`bg-emerald-400`), future bars in `bg-emerald-400/45`, zero-count days as a 2px `bg-white/[0.06]` baseline stub. Container: `role="img"` + summary label; bars `aria-hidden` with `title` tooltips — the StudyHeatmap a11y pattern.
3. **Render it in `review-app.tsx`**: after the main state block (below the empty-state card / completion card / active section, above `<Toast>`), gated on `Object.keys(progress.flashcardStats).length > 0` so brand-new users (who already get the "Browse topics" empty state) don't see an all-zero chart. Because `progress.flashcardStats` is live, grading a card visibly shifts its bar into a future day.
4. **Create `tests/forecast-logic.test.mjs`** with a pinned `now` (e.g. `new Date("2026-07-05T12:00:00Z")`).
5. Run the full validation gate.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/forecast-logic.ts` | new — pure builder + label helpers |
| `src/components/review-forecast.tsx` | new — presentational bar chart |
| `src/components/review-app.tsx` | edit — import + render `<ReviewForecast />` |
| `tests/forecast-logic.test.mjs` | new — unit tests |

### Proposed names and TypeScript signatures

```ts
// src/lib/forecast-logic.ts
export const FORECAST_DAYS = 7;

export type ForecastDay = {
  day: string;      // "YYYY-MM-DD" (UTC, todayISO convention)
  label: string;    // "Today" | "Tmrw" | "Mon" … "Sat"
  count: number;    // cards whose dueAt falls on this UTC day (bucket 0 includes overdue)
  isToday: boolean;
};

export type ForecastModel = {
  days: ForecastDay[];     // exactly FORECAST_DAYS entries, today first
  total: number;           // sum of counts in the window
  max: number;             // largest single-day count (0 when empty), for bar scaling
  beyondWindow: number;    // tracked cards due after the window (for the summary line)
};

export function buildForecast(
  flashcardStats: Record<string, FlashcardStat>,
  now: Date = new Date(),
  days: number = FORECAST_DAYS,
): ForecastModel;

export function forecastSummaryLabel(model: ForecastModel): string;
export function forecastBarTitle(day: ForecastDay): string;
```

```tsx
// src/components/review-forecast.tsx
export function ReviewForecast({
  flashcardStats,
}: { flashcardStats: Record<string, FlashcardStat> }): React.JSX.Element;
```

### UI copy / microcopy

- Section heading (matches "Toughest this session" style): `Upcoming reviews` — `text-sm font-semibold uppercase tracking-wide text-slate-400`.
- Subline: `Cards coming due over the next 7 days. Overdue cards count toward today.`
- Bar tooltip (`title`): `Today — 4 cards due` / `Tomorrow — 2 cards due` / `Thu Jul 9 — 1 card due` (singular/plural handled).
- `role="img"` summary: `Review forecast: 4 cards due today, 7 more over the next 6 days.` (append `, 12 due later` when `beyondWindow > 0`; `No cards due in the next 7 days.` when `total === 0`).
- All-zero window with tracked cards: keep the chart baseline plus a quiet line: `Nothing due this week — nice pacing.`

### Test plan (`tests/forecast-logic.test.mjs`)

Pin `now = new Date("2026-07-05T12:00:00Z")`; all assertions deterministic.

1. Empty stats → 7 zero days, `total 0`, `max 0`, `beyondWindow 0`; labels start `["Today","Tmrw", …]` with correct UTC weekdays after.
2. Overdue card (`dueAt` days in the past) → counted in bucket 0, `isToday` bar.
3. Due later today UTC (`2026-07-05T23:00:00Z`) → bucket 0; due `2026-07-06T00:30:00Z` → bucket 1 (day-boundary check).
4. Due on day +6 → last bucket; due on day +7 → excluded, `beyondWindow` incremented.
5. Corrupt `dueAt` (`"garbage"`, `undefined`-ish stat) → skipped, never throws.
6. `max`/`total` arithmetic with a multi-card spread; `forecastSummaryLabel` wording for zero, singular, plural, and `beyondWindow` cases; `forecastBarTitle` for Today/Tomorrow/weekday.

### Manual QA checklist

- [ ] With graded cards: `/review` shows the chart in empty, active, and completed states; heights proportional; today highlighted.
- [ ] Grade a card "Good"/"Easy" → its bar visibly moves to +2d/+4d without reload.
- [ ] Fresh browser profile (no localStorage) → no chart, empty state unchanged.
- [ ] Bar tooltips show on hover; VoiceOver/NVDA reads the single summary sentence, not 7 bars.
- [ ] Mobile width (~375px): 7 columns fit without horizontal scroll; text doesn't wrap ugly.
- [ ] No layout shift on the loading→loaded transition (chart only renders after `loaded`).

### Acceptance criteria

1. `/review` renders a 7-day due-count bar chart derived solely from persisted `flashcardStats`; overdue cards count toward Today.
2. Chart appears in all three review states when ≥1 card is tracked, and never for a fresh user.
3. All logic lives in a pure, `node --test`-covered module with injectable `now`; the component holds no state.
4. UTC-day bucketing matches the existing `todayISO()` convention (heatmap/streak stay in lock-step).
5. Full gate green: `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build`.

### Risk and rollback notes

- **Timezone drift**: users far from UTC may see "Today" flip early/late — accepted and consistent with the existing streak/heatmap UTC convention; do not introduce local-time math for just this surface.
- **Today-bar vs. queue-count mismatch**: Today can exceed the current due-queue length (cards due later today). The subline copy ("coming due") and builder comment make this intentional; do not "fix" it by switching to timestamp comparison.
- **Perf**: O(tracked words) per render behind `useMemo` — negligible.
- **Rollback**: entirely additive; deleting the `<ReviewForecast />` render line (or the two new files) restores the previous page byte-for-byte. No persisted-schema change, so no migration risk.

### Non-goals / deferrals

- No forecast beyond 7 days, no hover-to-drill-down, no per-topic breakdown.
- No chart library, SVG axis machinery, or animations.
- No changes to scheduling math, `computeStats`, session logic, or the /stats page (a stats-page copy of the chart is a natural later sprint).
- No "reschedule/smooth my load" actions.

### Ready-to-run Opus implementation prompt for Sprint 7

```text
You are implementing Sprint 7 of "Learn 10 Mandarin Words" (Next.js 16 / React 19 / Tailwind 4,
static, local-first, localStorage progress). Read AGENTS.md first — this Next.js version has
breaking changes; consult node_modules/next/dist/docs/ before writing framework-touching code.

TASK: Add a 7-day upcoming-due review forecast bar chart to the /review page.

Follow the existing heatmap pattern precisely (src/lib/heatmap-logic.ts + src/components/study-heatmap.tsx):
pure DOM-free logic module + stateless presentational component, UTC-day convention via todayISO(),
hardcoded deterministic labels, Tailwind-only bars, role="img" container with a summary sentence and
aria-hidden bars.

1. NEW src/lib/forecast-logic.ts
   - FORECAST_DAYS = 7; types ForecastDay { day, label, count, isToday } and
     ForecastModel { days, total, max, beyondWindow }.
   - buildForecast(flashcardStats: Record<string, FlashcardStat>, now = new Date(), days = FORECAST_DAYS):
     bucket each stat by UTC day of dueAt (.slice(0,10)); due day <= today → bucket 0 (overdue folds
     into Today — comment this deliberately, including that Today may exceed dueCards().length because
     dueCards compares full timestamps); today+1..+6 → buckets 1..6; later → beyondWindow. Skip
     invalid dueAt defensively (isValidISO idiom from progress-logic.ts). Labels: "Today", "Tmrw",
     then UTC weekday names from a hardcoded array.
   - forecastSummaryLabel(model) and forecastBarTitle(day) helpers (mirror cellTitle /
     heatmapSummaryLabel). Value imports from lib files must use explicit .ts extensions
     (node --test requirement — see the comment at the top of progress-logic.ts).
2. NEW src/components/review-forecast.tsx ("use client")
   - Props: { flashcardStats }. useMemo(buildForecast). 7 equal-width columns; bar height =
     percentage of model.max; count above bar, label below; today bar bg-emerald-400, future bars
     bg-emerald-400/45, zero days a 2px bg-white/[0.06] stub. Heading "Upcoming reviews"
     (text-sm font-semibold uppercase tracking-wide text-slate-400), subline "Cards coming due over
     the next 7 days. Overdue cards count toward today." When total === 0 add "Nothing due this
     week — nice pacing." Container role="img" + aria-label from forecastSummaryLabel; bars
     aria-hidden with title tooltips from forecastBarTitle.
3. EDIT src/components/review-app.tsx
   - Render <ReviewForecast flashcardStats={progress.flashcardStats} /> once, after the three-state
     block and before <Toast>, gated on Object.keys(progress.flashcardStats).length > 0. Do not touch
     session logic, grading, or scheduling.
4. NEW tests/forecast-logic.test.mjs (node:test + assert/strict, import "../src/lib/forecast-logic.ts")
   - Pin now = new Date("2026-07-05T12:00:00Z"). Cover: empty stats; overdue → Today; the
     UTC day boundary (23:00Z today vs 00:30Z tomorrow); day +6 in window vs day +7 → beyondWindow;
     corrupt dueAt skipped without throwing; max/total math; summary-label wording (zero, singular,
     plural, beyondWindow); bar titles.

CONSTRAINTS: no new dependencies, no schema/persistence changes, no network, no chart library,
pinyin stays on Chinese lines, keep the dark emerald/slate visual language. Match surrounding
comment density and style.

VALIDATION GATE (all must pass):
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build
```

---

I've inspected the streak, daily-goal, persistence, and UI code paths. Here is the grounded plan.

## Sprint 8 — Streak freeze token earned by completing a full week of daily goals

### Goal and user value

A single missed day is the most common way a long streak — and the motivation attached to it — dies. This sprint adds an earned safety net: complete your daily goal 7 days in a row and you bank one **Streak Freeze ❄️** (max 2). If you then miss exactly one day, a freeze is consumed automatically and the streak survives. Because freezes are *earned* by consistent goal completion, they reinforce the daily-goal loop rather than cheapening the streak. Everything stays pure, local-first, and in the existing `localStorage` blob.

### Current-state findings (grounded in actual files)

- **Streaks** — `computeStreak(studiedDates, today)` in `src/lib/progress-logic.ts:292` walks consecutive ISO days ending today-or-yesterday over `progress.studiedDates`. `streakAtRisk` (`progress-logic.ts:591`) is `streak > 0 && !studiedDates.includes(today)`. `longestStreak` (`progress-logic.ts:313`) feeds the streak-3/streak-7 achievements in `src/lib/achievements-logic.ts:156`.
- **Daily goal** — `onboarding.dailyGoal` (set via onboarding or the stats-page `GoalCard`) plus `dailyActivity` (ISO day → distinct wordKeys, schema v4). `goalProgress(progress, today)` at `progress-logic.ts:630` derives `{practiced, goal, met}`. Critically, `DAILY_ACTIVITY_RETENTION_DAYS = 14` (`progress-logic.ts:55`) — **14 days of history is retained, so a 7-day goal-week lookback is fully computable from persisted data.**
- **The write choke point** — `withPractice(current, key)` in `src/components/use-progress.ts:37` runs on every graded/quizzed word, and already detects the exact below-goal → at-goal crossing (it fires the `daily_goal_met` analytics event there). This is the natural, fires-once-per-day place to check "did this crossing complete a 7-day goal week?"
- **Persistence & migration** — `ProgressState` (`src/lib/types.ts:114`) is at `CURRENT_PROGRESS_SCHEMA_VERSION = 7` (`progress-logic.ts:36`). `normalizeProgress` (`progress-logic.ts:253`) is the single load/import entry point; every field has a never-throws normalizer (`normalizeBossStats`, `normalizeDailyChallenge`, etc.) — the new field must follow the same pattern. Storage key is `learn-10-mandarin-progress-v1` in `use-progress.ts:25`; the hook hydrates in a `useEffect` (`use-progress.ts:53`) — that's where load-time freeze consumption belongs.
- **Streak UI surfaces** — amber streak pill + at-risk variant in `src/components/stats-app.tsx:117-130` and `src/components/home-app.tsx:117-131`; `computeStats(...).streak` (`progress-logic.ts:357`) feeds both `stats-app.tsx` and the heatmap header; the goal ring/editor lives in `GoalCard` (`stats-app.tsx:339`) and the home snapshot (`home-app.tsx:157-186`).
- **Analytics** — `track()` in `src/lib/analytics.ts:77` is a typed no-op choke point; new event names must be added to the `AnalyticsEvent` union (`analytics.ts:15`).
- **Tests** — plain `node --test` `.mjs` files in `tests/`, importing with explicit `.ts` extensions (`tests/progress-logic.test.mjs` imports from `../src/lib/progress-logic.ts`). Helpers take injectable `today`/`now` for determinism. All day math is UTC (`todayISO` → `toISOString().slice(0,10)`).

### Design decisions

- **State shape (schema v7 → v8):** one new `ProgressState` field:
  ```ts
  streakFreezes: { available: number; lastEarnedOn: string | null; frozenDates: string[] }
  ```
  `frozenDates` are the ISO days a freeze covered. They are **not** added to `studiedDates` — `daysStudied`, the heatmap, and achievements keep counting only real study days; only streak math unions them in.
- **Earning:** on the goal-met crossing inside `withPractice`, award a freeze iff the goal was met (against the current goal) on all 7 days `today−6…today`, `available < MAX_STREAK_FREEZES (2)`, and `lastEarnedOn` is null or ≥ 7 days ago (prevents one hot week paying out daily). If blocked only by the cap, don't stamp `lastEarnedOn` (the week isn't "spent").
- **Spending (automatic, load-time):** on hydration, if `available > 0`, yesterday is in neither `studiedDates` nor `frozenDates`, and the day before yesterday **is** in that union, freeze yesterday. A ≥2-day gap never consumes (the streak is already dead — don't waste tokens).

### Exact implementation steps in sequence

1. **`src/lib/types.ts`** — add `StreakFreezeState` type; add `streakFreezes` to `ProgressState` with a doc comment ("Added in schema v8").
2. **`src/lib/progress-logic.ts`** — bump `CURRENT_PROGRESS_SCHEMA_VERSION` to 8 (extend the version-history comment); add `streakFreezes` default to `emptyProgress`; add constants `MAX_STREAK_FREEZES = 2`, `GOAL_WEEK_DAYS = 7`.
3. **Same file** — add `normalizeStreakFreezes(raw)` (never throws: clamp `available` to `0…MAX`, validate `lastEarnedOn` as an ISO day else null, filter/dedupe/sort `frozenDates` via the existing `isISODayKey`); wire it into `normalizeProgress`.
4. **Same file** — add the pure helpers: `goalMetOn`, `consecutiveGoalDays` (for the "n of 7" UI), `earnFreezeOnGoalMet`, `applyStreakFreeze`, `studiedWithFreezes`. Reuse `practicedCountOn` and the existing 86 400 000-ms day arithmetic.
5. **Same file** — route streak reads through the union: in `computeStats` change the `streak:` line to `computeStreak(studiedWithFreezes(progress), isoDay(now))` (leave `daysStudied` on `studiedDates.length`).
6. **`src/lib/analytics.ts`** — add `"streak_freeze_earned"` and `"streak_freeze_used"` to the `AnalyticsEvent` union.
7. **`src/components/use-progress.ts`** — (a) in the hydration effect, wrap the parse: `applyStreakFreeze(normalizeProgress(JSON.parse(stored)), todayISO())`, and fire `track("streak_freeze_used", ...)` when it changed state; (b) in `withPractice`, inside the existing goal-crossing branch, call `earnFreezeOnGoalMet` and fire `track("streak_freeze_earned", ...)` when it awards.
8. **`src/components/stats-app.tsx`** — pass the union to the at-risk check (`streakAtRisk(studiedWithFreezes(progress))`); add a small ❄️ chip next to the streak pill when `available > 0`; in `GoalCard`, add one subline showing progress toward the next freeze (`consecutiveGoalDays`, capped at 7) and a "streak saved" note when yesterday ∈ `frozenDates`.
9. **`src/components/home-app.tsx`** — same union swap for its local `computeStreak`/`streakAtRisk` calls (`home-app.tsx:53-54`); append a compact `❄️ N` suffix inside the streak pill (and aria-label) when freezes are available.
10. **`tests/progress-logic.test.mjs`** — add the test cases below.
11. Run the full gate (`npm run test`, `validate:data`, `validate:quality`, `lint`, `build`).

### Likely files touched

| File | Change |
|---|---|
| `src/lib/types.ts` | `StreakFreezeState`, `ProgressState.streakFreezes` |
| `src/lib/progress-logic.ts` | schema v8, defaults, normalizer, earn/spend/union helpers, `computeStats` streak line |
| `src/lib/analytics.ts` | two new event names |
| `src/components/use-progress.ts` | load-time `applyStreakFreeze`; earn check in `withPractice` |
| `src/components/stats-app.tsx` | freeze chip, GoalCard subline, at-risk union |
| `src/components/home-app.tsx` | pill suffix, streak/at-risk union |
| `tests/progress-logic.test.mjs` | new unit tests |

### Proposed names and signatures

```ts
// types.ts
export type StreakFreezeState = {
  /** Banked freeze tokens, 0..MAX_STREAK_FREEZES. */
  available: number;
  /** ISO day the last token was earned, or null. Enforces non-overlapping weeks. */
  lastEarnedOn: string | null;
  /** ISO days a consumed freeze covered. Unioned into streak math only. */
  frozenDates: string[];
};

// progress-logic.ts
export const MAX_STREAK_FREEZES = 2;
export const GOAL_WEEK_DAYS = 7;

export function normalizeStreakFreezes(raw: unknown): StreakFreezeState;

/** True when `day`'s practiced count meets the (current) daily goal. */
export function goalMetOn(progress: ProgressState, day: string): boolean;

/** Consecutive goal-met days ending on `today` (0 if today unmet). Drives "n of 7" copy. */
export function consecutiveGoalDays(progress: ProgressState, today?: string): number;

/** Pure earn check for the goal-met crossing. Returns the same object when nothing is earned. */
export function earnFreezeOnGoalMet(progress: ProgressState, today?: string): ProgressState;

/** Pure load-time consumption: freeze yesterday iff exactly one day was missed and a token exists. */
export function applyStreakFreeze(progress: ProgressState, today?: string): ProgressState;

/** studiedDates ∪ frozenDates — feed to computeStreak / streakAtRisk. */
export function studiedWithFreezes(progress: ProgressState): string[];
```

Both `earnFreezeOnGoalMet` and `applyStreakFreeze` return the input object unchanged (referential equality) on no-op, matching the `recordBestCombo` pattern in `use-progress.ts:139` so callers can detect "something happened" for analytics without extra flags.

### UI copy / microcopy

- Freeze chip (stats header, next to streak pill): `❄️ 1 streak freeze` / `❄️ 2 streak freezes`; `title`/aria: "Covers one missed day automatically".
- GoalCard subline, goal set & building: `3 of 7 goal days toward a streak freeze ❄️`
- GoalCard subline, at cap: `Freeze stash full — 2 ❄️ banked`
- Streak-saved note (stats, when yesterday is frozen): `❄️ A streak freeze covered yesterday — your streak is safe.`
- Home pill suffix (freezes available): `🔥 12 day streak · ❄️ 1`; aria-label: `12 day streak, 1 streak freeze banked`.
- No pinyin/hanzi involved — all-English UI strings, consistent with existing streak copy.

### Test plan (`tests/progress-logic.test.mjs`)

- **Normalization:** missing field → default `{available: 0, lastEarnedOn: null, frozenDates: []}`; junk (`"x"`, negative/`NaN` available, non-array frozenDates, invalid day keys) never throws; `available` clamps to `MAX_STREAK_FREEZES`; frozenDates deduped/sorted; schema version stamps 8.
- **Earning:** 7 consecutive goal-met days → +1 token and `lastEarnedOn` stamped; 6 days → no-op (same reference); a gap day resets eligibility; `dailyGoal: 0` never earns; second award blocked until 7 days after `lastEarnedOn`; at cap → no award and `lastEarnedOn` untouched.
- **Spending:** yesterday missed with T−2 studied and a token → yesterday added to `frozenDates`, `available` decremented; 2-day gap → no-op; 0 tokens → no-op; already-alive streak (studied yesterday) → no-op; works whether or not today has already been studied.
- **Union streak:** `computeStreak(studiedWithFreezes(...))` bridges a frozen day (e.g. studied days T−3, T−2, frozen T−1 → streak 3 anchored yesterday); `computeStats(...).streak` reflects it while `daysStudied` doesn't count frozen days; `streakAtRisk` over the union still flags an unstudied today.
- All tests use injectable `today` strings — no real clock.

### Manual QA checklist

1. Fresh profile: set a daily goal of 5 on `/stats`, no freeze chip shown, GoalCard shows `0 of 7 goal days…`.
2. In DevTools, seed `dailyActivity` with 6 prior goal-met days, then practice to today's goal in the quiz → GoalCard flips to "Goal met 🎉" and the ❄️ chip appears (dev console shows `streak_freeze_earned` with `NEXT_PUBLIC_ANALYTICS=console`).
3. Edit the stored blob: remove yesterday from `studiedDates`, keep T−2, reload → console shows `streak_freeze_used`, streak pill keeps its count, stats shows the "covered yesterday" note, chip count drops by 1, `daysStudied` unchanged.
4. Repeat with a 2-day hole → streak reads 0 and the token is **not** consumed.
5. Export progress, re-import → freeze state round-trips. Import a pre-sprint export → app loads cleanly with the default freeze state.
6. Home page pill shows the `❄️ N` suffix; keyboard/screen-reader labels read sensibly; layout intact at mobile width.

### Acceptance criteria

- Completing the daily goal 7 consecutive days banks exactly one freeze (max 2), exactly once per non-overlapping week.
- One missed day is auto-covered on next load when a token exists; the streak number survives; two or more missed days are never covered.
- Frozen days never inflate `daysStudied`, the heatmap, or achievements.
- Old saves (v≤7) and corrupt freeze data load without errors; export/import round-trips.
- Full gate passes: `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build`.

### Risk and rollback notes

- **Day boundaries are UTC** (`todayISO()` uses `toISOString()`), so an evening learner may see the freeze consumed "early" by wall-clock — this matches every existing streak/goal surface, so no new inconsistency; don't introduce local-time math here.
- **Goal edits rewrite history:** `goalMetOn` evaluates past days against the *current* goal (only today's count is stored per day, not the goal at the time). Lowering the goal can retroactively complete a week; acceptable for a local, single-user app — document in the helper comment.
- **Consumption only runs at hydration**, so a tab left open across midnight won't consume until reload — same staleness class as the existing streak pill; not worth a timer.
- **Downgrade safety:** an older build reading a v8 blob ignores `streakFreezes` via its `normalizeProgress` and re-stamps v7 — freeze state is lost but nothing breaks.
- **Rollback:** single revert of the sprint commit. Blobs written with v8 remain loadable by the reverted code (unknown field dropped, version re-stamped). No data migration to unwind.

### Non-goals / deferrals

- No manual "spend a freeze" button, no freeze shop/purchase, no multi-day freezes.
- Heatmap does not render frozen days as a distinct (ice-colored) square — nice follow-up, out of scope.
- Streak achievements (`streak-3`/`streak-7`) and `longestStreak` stay on real studied days.
- `challengeStreak` (Daily Challenge) is untouched — freezes protect the study streak only.
- No push/notification nagging, no backend, no new localStorage keys (everything rides the existing blob).

### Ready-to-run Opus implementation prompt for Sprint 8

```text
Implement Sprint 8 of the Learn 10 Mandarin Words app (Next.js 16 / React 19 / Tailwind 4,
static + localStorage, repo root = project root): a Streak Freeze token earned by completing
the daily goal 7 days in a row, auto-spent to cover a single missed day.

Read AGENTS.md first — this Next.js version has breaking changes; consult
node_modules/next/dist/docs/ if any framework question arises. Do not add packages,
backends, accounts, or external APIs. All state lives in the existing localStorage blob.

1. src/lib/types.ts — add:
   export type StreakFreezeState = { available: number; lastEarnedOn: string | null; frozenDates: string[] };
   and a `streakFreezes: StreakFreezeState` field on ProgressState (doc comment: added in schema v8;
   frozenDates are ISO days covered by a spent freeze, unioned into streak math only).

2. src/lib/progress-logic.ts —
   - Bump CURRENT_PROGRESS_SCHEMA_VERSION to 8 and extend the v-history comment (v7 → v8: added
     streakFreezes; older saves default to {available:0, lastEarnedOn:null, frozenDates:[]}).
   - Add streakFreezes default to emptyProgress.
   - export const MAX_STREAK_FREEZES = 2; export const GOAL_WEEK_DAYS = 7;
   - export function normalizeStreakFreezes(raw: unknown): StreakFreezeState — never throws;
     clamp available to 0..MAX (round, non-finite→0), lastEarnedOn must pass the existing
     isISODayKey else null, frozenDates filtered by isISODayKey, deduped, sorted. Wire into
     normalizeProgress. Follow the style of normalizeBossStats.
   - export function goalMetOn(progress, day): boolean — onboarding.dailyGoal > 0 &&
     practicedCountOn(progress.dailyActivity, day) >= goal. Note in a comment that past days are
     evaluated against the CURRENT goal (dailyActivity retains 14 days — see
     DAILY_ACTIVITY_RETENTION_DAYS — so a 7-day lookback is always available).
   - export function consecutiveGoalDays(progress, today = todayISO()): number — consecutive
     goal-met days ending today (0 if today unmet), using the same 86400000-ms day stepping as
     computeStreak.
   - export function earnFreezeOnGoalMet(progress, today = todayISO()): ProgressState — pure;
     award one token iff goalMetOn for all 7 days today..today-6, available < MAX_STREAK_FREEZES,
     and (lastEarnedOn === null || today is >= 7 days after lastEarnedOn). On award return a new
     state with available+1 and lastEarnedOn = today; otherwise return the INPUT OBJECT UNCHANGED
     (referential no-op, like recordBestCombo) — and when blocked only by the cap, do NOT stamp
     lastEarnedOn.
   - export function applyStreakFreeze(progress, today = todayISO()): ProgressState — pure; let
     union = studiedDates ∪ frozenDates; iff available > 0 AND yesterday(today-1) ∉ union AND
     (today-2) ∈ union, return new state with yesterday appended to frozenDates (kept sorted) and
     available-1; else return the input unchanged. A gap of 2+ days must never consume.
   - export function studiedWithFreezes(progress): string[] — deduped union of studiedDates and
     streakFreezes.frozenDates.
   - In computeStats, compute `streak` from studiedWithFreezes(progress) (keep daysStudied =
     studiedDates.length).

3. src/lib/analytics.ts — add "streak_freeze_earned" and "streak_freeze_used" to AnalyticsEvent.

4. src/components/use-progress.ts —
   - Hydration effect: const next = applyStreakFreeze(normalizeProgress(JSON.parse(stored)), todayISO());
     if it differs from the normalized state, track("streak_freeze_used", { remaining: next.streakFreezes.available });
     setProgress(next).
   - withPractice: inside the existing below-goal → at-goal crossing branch (where daily_goal_met
     fires), run earnFreezeOnGoalMet on the post-activity state; if it returned a new object,
     track("streak_freeze_earned", { available: <new count> }) and use the earned state.

5. src/components/stats-app.tsx —
   - Use streakAtRisk(studiedWithFreezes(progress)) for the at-risk pill.
   - When progress.streakFreezes.available > 0, render a chip next to the streak pill:
     "❄️ {n} streak freeze{s}" (rounded-full, border-sky-400/60 text-sky-300, matching the amber
     at-risk pill's structure), title/aria "Covers one missed day automatically".
   - When yesterday (todayISO minus 1 day) is in frozenDates, render a small note near the streak
     pill: "❄️ A streak freeze covered yesterday — your streak is safe."
   - GoalCard: when a goal is set, add one text-xs subline: at cap → "Freeze stash full — 2 ❄️ banked";
     else → "{consecutiveGoalDays(progress)} of 7 goal days toward a streak freeze ❄️" (cap displayed n at 7).

6. src/components/home-app.tsx — swap its computeStreak/streakAtRisk inputs to
   studiedWithFreezes(progress); when freezes are available append "· ❄️ {n}" inside the amber
   streak pill and extend its aria-label ("…, {n} streak freeze(s) banked"). Keep styling changes minimal.

7. tests/progress-logic.test.mjs — extend (imports use the explicit ../src/lib/progress-logic.ts
   path; injectable `today` strings, no real clock):
   - normalizeStreakFreezes: missing/junk input → defaults; clamps available to MAX; drops invalid
     frozenDates keys; dedupes+sorts; never throws; normalizeProgress stamps schemaVersion 8.
   - earnFreezeOnGoalMet: awards on 7 consecutive met days (goal from onboarding.dailyGoal,
     activity fixtures in dailyActivity); returns same reference on 6 days, on a gapped week, on
     goal 0, at cap, and within 7 days of lastEarnedOn; cap-blocked call leaves lastEarnedOn null.
   - applyStreakFreeze: consumes for a single missed yesterday (with and without today studied);
     same reference for 2-day gaps, zero tokens, and unbroken streaks; frozen day lands in
     frozenDates sorted and available decrements.
   - studiedWithFreezes + computeStreak bridge a frozen day; computeStats streak counts it while
     daysStudied does not; streakAtRisk over the union stays true when today is unstudied.

Constraints: pure helpers stay DOM/localStorage-free with injectable today/now; follow the
existing comment style (explain WHY, note schema version); UI stays in the existing dark
emerald/amber Tailwind idiom; no new localStorage keys.

Validation gate (all must pass):
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build
```

---

I explored the repo (progress/session logic, review app, home app, types, analytics, seo/sitemap, test conventions) and the plan below is grounded in those files. Everything needed already exists in `studiedDates` + `flashcardStats` — this sprint needs **no schema bump** and is purely additive.

## Sprint 9 — Comeback session: gentle refresher flow for learners returning after 7+ days away

### Goal and user value

A learner who returns after a week+ away currently lands on a home page whose most prominent retention hooks are a dead streak and a `/review` queue that may hold dozens of overdue cards (`session-logic.ts` caps a session at 20, but the "N more due later" copy still confronts them with the backlog). This sprint adds a **welcome-back path**: the home page detects the lapse and offers a tiny, confidence-first warm-up — 5 words the learner had already mastered — with just two gentle grades ("Forgot" / "Got it"). Completing it stamps today's study date through the existing practice pipeline, which restarts the habit loop and naturally dismisses the banner. Value: lapsed learners get a 60-second win instead of a wall of debt, which is the single highest-leverage retention moment the app doesn't yet handle.

### Current-state findings grounded in actual files/components/helpers

- **Lapse detection is already derivable.** `ProgressState.studiedDates` (`src/lib/types.ts:150`) is an append-only list of ISO day strings, stamped by `recordStudyToday` inside `withPractice` (`src/components/use-progress.ts:27-47`) on every graded/quizzed interaction. `computeStreak` / `longestStreak` (`src/lib/progress-logic.ts:292-328`) already do day-diff arithmetic over it (`86400000`-ms deltas on ISO day strings) — the same technique gives "days since last study". No new persisted field is needed.
- **"Previously mastered" is already defined.** `MASTERED_INTERVAL_DAYS = 7` (`src/lib/progress-logic.ts:400`) is the single mastery threshold, used by `topicProgress` and `wordStatus` (precedence "mastered > tricky > learning > new", `progress-logic.ts:743-755`). A comeback deck of `intervalDays >= MASTERED_INTERVAL_DAYS` words reuses this exactly.
- **A reusable card-session state machine exists.** `startSession(cards, cap)`, `gradeCard`, `isSessionComplete` in `src/lib/session-logic.ts` are pure, take any `DueCard[]`, accept a custom cap, and requeue "again"-graded cards `AGAIN_GAP` positions ahead — precisely the "see forgotten words again before finishing" behavior a gentle warm-up wants. `DueCard` (`src/lib/progress-logic.ts:425-434`) is a plain display record (`topicSlug`, `hanzi`, `pinyin`, `english`, `key`, `dueAt`, `intervalDays`), so a comeback deck builder can emit it directly and the machine works unchanged.
- **Persistence choke point exists.** `gradeWord(key, grade)` from `useProgress` (`use-progress.ts:151-161`) runs `scheduleReview` and routes through `withPractice`, so grading in a comeback session automatically stamps `studiedDates` + `dailyActivity` — the banner self-dismisses after the first graded card with zero extra code.
- **Banner slot pattern exists.** `home-app.tsx` renders `DailyChallengeBanner` (`src/components/home-app.tsx:216`, defined at 389-417) as a private function component gated on `loaded` — a `Link`-wrapped emerald card. A welcome-back banner can mirror this exactly, in the same spot.
- **Page wiring pattern exists.** `/review` is a 13-line server page (`src/app/review/page.tsx`) passing the module-scope `data` from `src/lib/data.ts` into a `"use client"` app component. `/comeback` follows the same shape.
- **Display conventions to respect:** pinyin rendered via `<TonePinyin>` with `lang={PINYIN_LANG}` and hanzi with `lang={HANZI_LANG}` + `font-hanzi` (see `review-app.tsx:384-393`), `ToneColorsToggle` offered on review surfaces, `min-h-[44px]` touch targets, `bg-surface` / `border-white/10` card idiom.
- **Analytics:** `track` accepts only events in the `AnalyticsEvent` union (`src/lib/analytics.ts:15-39`); a new `"comeback_completed"` literal must be added there.
- **Sitemap:** utility routes are hand-listed in `src/lib/seo.ts:115` (`["/review", "/stats", "/favorites", "/privacy"]`) and covered by `tests/seo.test.mjs`; `/comeback` should be added and the test updated.
- **Test convention:** DOM-free `node:test` + `assert/strict` files under `tests/`, importing lib code with explicit `.ts` extensions (see `tests/session-logic.test.mjs`; the extension requirement is documented at `progress-logic.ts:10-16`).

### Exact implementation steps in sequence

1. **Create `src/lib/comeback-logic.ts`** (pure, DOM-free, mirrors the header-comment style of `session-logic.ts`). Import `wordKey` from `./data-logic.ts` and `MASTERED_INTERVAL_DAYS`, `todayISO`, type `DueCard` from `./progress-logic.ts` (explicit `.ts` extensions). Implement:
   - `LAPSE_THRESHOLD_DAYS = 7`, `COMEBACK_DECK_SIZE = 5` as exported constants.
   - `lastStudiedDay` — max valid ISO day in `studiedDates`, else `null` (drop malformed strings defensively, like `longestStreak` does).
   - `daysSinceLastStudy` — whole-day diff to injectable `today`, `null` when never studied; clamp negatives (a future-dated corrupt entry) to `0`.
   - `isLapsed` — `daysSince !== null && daysSince >= LAPSE_THRESHOLD_DAYS`. Never-studied users are **not** lapsed (they get onboarding, not a comeback).
   - `comebackDeck` — walk `topics × items` like `dueCards` (`progress-logic.ts:441-466`); collect words with a stat where `intervalDays >= MASTERED_INTERVAL_DAYS` (mastered), sorted strongest-first (`intervalDays` desc, then `key` asc for stability); if fewer than `limit`, top up with remaining studied words (`reviewCount > 0`), same ordering; return at most `limit` `DueCard`s. Ignores `dueAt` entirely — warm-up words need not be due; that's the point.
2. **Create `tests/comeback-logic.test.mjs`** (see Test plan).
3. **Add `"comeback_completed"`** to the `AnalyticsEvent` union in `src/lib/analytics.ts`.
4. **Create `src/components/comeback-app.tsx`** (`"use client"`). Uses `useProgress`; seeds a one-time session snapshot with the same adjust-state-while-rendering pattern as `review-app.tsx:71-73`: `startSession(comebackDeck(data.topics, progress.flashcardStats), COMEBACK_DECK_SIZE)`. Renders:
   - **Empty state** (deck length 0): friendly card pointing to `/` ("Browse topics").
   - **Active card**: simplified review card (hanzi front → Reveal → pinyin/english back; `SpeakButton`, `TonePinyin`, lang attrs, `ToneColorsToggle`). No drag/fling — keep this surface calm and small; buttons only.
   - **Two grades only**: "Forgot" → `gradeWord(key, "again")` + `gradeCard(session, "again")` (requeues it in-session via `AGAIN_GAP`); "Got it" → `gradeWord(key, "good")` + `gradeCard(session, "good")`.
   - **Completion state**: celebration, count refreshed, `track("comeback_completed", { count })`, CTA to `/review` showing the live due count (`dueCards(data.topics, progress.flashcardStats).length`) when > 0, else "Browse topics"; secondary link home.
5. **Create `src/app/comeback/page.tsx`** — server page mirroring `review/page.tsx`: metadata (`title: "Welcome back"`, canonical `/comeback`) + `<ComebackApp data={data} />`.
6. **Add the banner to `src/components/home-app.tsx`**: a private `WelcomeBackBanner({ daysAway })` mirroring `DailyChallengeBanner`, rendered directly above it, gated on `loaded && isLapsed(progress.studiedDates) && comebackDeck(data.topics, progress.flashcardStats).length > 0` (compute the deck length in a `useMemo`; note `HomeData` carries `TopicSummary` items — `comebackDeck` should therefore accept `Pick<TopicSummary, "slug" | "titleEn" | "items">[]`-ish structural typing like `masterySummary` does, so it works on both datasets). When lapsed, also **suppress the dead-streak framing**: leave existing streak chips as-is (streak is already 0 so the "Local first" chip shows — verified in `home-app.tsx:117-131`; no change needed).
7. **Add `/comeback` to the utility-route list in `src/lib/seo.ts:115`** and update the corresponding assertion in `tests/seo.test.mjs`.
8. Run the full validation gate.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/comeback-logic.ts` | new — pure lapse detection + deck builder |
| `tests/comeback-logic.test.mjs` | new — unit tests |
| `src/components/comeback-app.tsx` | new — warm-up session UI |
| `src/app/comeback/page.tsx` | new — route + metadata |
| `src/components/home-app.tsx` | edit — `WelcomeBackBanner` |
| `src/lib/analytics.ts` | edit — add `"comeback_completed"` |
| `src/lib/seo.ts` + `tests/seo.test.mjs` | edit — sitemap entry |

### Proposed function/component names and TypeScript signatures

```ts
// src/lib/comeback-logic.ts
export const LAPSE_THRESHOLD_DAYS = 7;
export const COMEBACK_DECK_SIZE = 5;

export function lastStudiedDay(studiedDates: string[]): string | null;
export function daysSinceLastStudy(studiedDates: string[], today?: string): number | null;
export function isLapsed(studiedDates: string[], today?: string): boolean;

// Structural topic type so it accepts both Topic[] and TopicSummary[]
type ComebackTopic = Pick<TopicSummary, "slug" | "titleEn" | "items">;
export function comebackDeck(
  topics: ComebackTopic[],
  flashcardStats: Record<string, FlashcardStat>,
  limit?: number, // default COMEBACK_DECK_SIZE
): DueCard[];
```

```tsx
// src/components/comeback-app.tsx
export function ComebackApp({ data }: { data: MandarinData }): React.JSX.Element;

// private, inside home-app.tsx (mirrors DailyChallengeBanner)
function WelcomeBackBanner({ daysAway }: { daysAway: number }): React.JSX.Element;
```

### UI copy/microcopy

- **Home banner**: `👋 Welcome back — it's been {N} days` / sub: `Ease back in with a quick warm-up of words you already know. No pressure, no pile.` / CTA pill: `Warm up`.
- **Page heading**: `Welcome back` / intro: `A gentle {deck.length}-word warm-up from words you've mastered before. Then pick up right where you left off.`
- **Grade buttons**: `Forgot` (aria: `I forgot this word — show it again soon`) and `Got it` (aria: `I still know this word`).
- **Requeue chip** (reuse review-app's pattern): `{n} to re-check`.
- **Completion**: `Warmed up! 🎉` / `You refreshed {total} word{s}. That's the hard part done.` / primary CTA: `Review {M} due words` or `Browse topics`; secondary: `Back to home`.
- **Empty state**: `Nothing to warm up yet` / `Study a topic and grade some flashcards first — we'll build your comeback session from words you've mastered.` / CTA: `Browse topics`.

### Test plan

`tests/comeback-logic.test.mjs` (node:test, `.ts`-extension imports, fixtures modeled on `tests/session-logic.test.mjs`):

- `lastStudiedDay`: empty → null; unsorted input → max; malformed entries dropped.
- `daysSinceLastStudy`: injectable `today`; exact-day math (`"2026-06-29"` vs `"2026-07-06"` → 7); never studied → null; future-dated entry clamps to 0.
- `isLapsed` boundaries: 6 days → false; exactly 7 → true; 30 → true; never studied → false; empty array → false.
- `comebackDeck`: mastered-only when enough exist; strongest-first ordering (interval desc) with stable key tiebreak; tops up with studied-but-unmastered when mastered < limit; returns `[]` when nothing studied; respects `limit`; ignores `dueAt` (a mastered word due next month is still included); tolerates a missing stat for some words.
- `tests/seo.test.mjs`: update the utility-entries assertion to include `/comeback`.
- Existing suites (`progress-logic`, `session-logic`, `home-data`) must pass untouched — this sprint adds no schema change, so no `normalizeProgress` churn.

### Manual QA checklist

1. Fresh profile (no localStorage): home shows onboarding, **no** comeback banner; `/comeback` directly shows the empty state.
2. Seed a lapsed profile: in devtools, edit `learn-10-mandarin-progress-v1` — set `studiedDates` to `["2026-06-20"]` and give 6+ words `flashcardStats` entries with `intervalDays: 8, reviewCount: 3`. Reload home → banner shows "it's been 16 days" with `Warm up` CTA.
3. Tap through `/comeback`: card flips on Reveal; pinyin renders with tone colors when toggled; `Forgot` requeues the word (re-check chip appears, word reappears later in session); `Got it` advances.
4. Complete the session → completion card, correct refreshed count, `Review N due` CTA matches `/review`'s queue; with analytics `console` mode, `comeback_completed` logs once.
5. Return to home → banner is gone (today is now in `studiedDates`); streak chip shows a fresh streak state.
6. Lapsed but zero studied words (only `learnedTopics` set): banner does **not** render.
7. Mobile viewport: banner and grade buttons meet 44px targets; keyboard-only run-through works (Reveal → Forgot/Got it are real buttons).

### Acceptance criteria

- A learner whose most recent `studiedDates` entry is ≥ 7 days old **and** who has at least one studied word sees the welcome-back banner on `/`; nobody else does.
- `/comeback` runs a ≤ 5-card session drawn mastered-first, grades persist through the real `gradeWord` SM-2 path, "Forgot" words repeat within the session, and completing any card stamps today's study date (banner self-dismisses).
- Chinese text always carries pinyin (`TonePinyin`) with correct `lang` attributes; no new vocabulary or metadata is invented; no network/backend is introduced.
- `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build` all pass.

### Risk and rollback notes

- **Early-review side effect**: grading a not-yet-due mastered card reschedules it from today (`scheduleReview` doesn't distinguish early reviews). "Got it" → interval doubles (harmless, learner-favorable); "Forgot" → resets to 1d (correct — they did forget). Acceptable within the existing simplified SM-2 model; call it out in the PR.
- **Home bundle**: `comebackDeck` runs over `TopicSummary[]` in a `useMemo` — same O(words) cost as the existing `studiedWordsCount` filter; negligible.
- **Rollback**: single-commit revert. No persisted-schema change (no `CURRENT_PROGRESS_SCHEMA_VERSION` bump), so rolling back cannot strand user data; the only cross-file edits are the banner block, one union literal, and one sitemap entry.

### Non-goals / deferrals

- No persistent "dismiss banner" preference (any practice dismisses it naturally; revisit only if users report annoyance).
- No streak-repair / "streak freeze" mechanics, no schema change, no notification/reminder system (impossible without a backend anyway).
- No comeback-specific quiz modes — flashcard-only keeps it gentle; `/review` remains the full-grade surface.
- No auto-redirect from `/` to `/comeback`; the banner invites, never hijacks.

### Ready-to-run Opus implementation prompt for Sprint 9

```text
Implement Sprint 9 of the Learn 10 Mandarin Words roadmap: a "comeback session" — a
gentle warm-up flow for learners returning after 7+ days away. Next.js 16 / React 19 /
Tailwind 4, static + localStorage-only. Read AGENTS.md first: this Next.js version has
breaking changes — consult node_modules/next/dist/docs/ before writing framework code.
No backend, no new vocabulary/data, no schema-version bump.

1. NEW src/lib/comeback-logic.ts (pure, DOM-free; import wordKey from "./data-logic.ts"
   and MASTERED_INTERVAL_DAYS, todayISO, type DueCard from "./progress-logic.ts" with
   explicit .ts extensions — required by node --test, see progress-logic.ts:10):
   - export const LAPSE_THRESHOLD_DAYS = 7, COMEBACK_DECK_SIZE = 5.
   - lastStudiedDay(studiedDates: string[]): string | null — max valid ISO day, drop
     malformed entries.
   - daysSinceLastStudy(studiedDates, today = todayISO()): number | null — whole-day
     UTC diff (86400000-ms arithmetic like computeStreak); null if never studied;
     clamp negatives to 0.
   - isLapsed(studiedDates, today?): boolean — daysSince >= LAPSE_THRESHOLD_DAYS;
     never-studied → false.
   - comebackDeck(topics, flashcardStats, limit = COMEBACK_DECK_SIZE): DueCard[] —
     topics is structurally Pick<TopicSummary, "slug" | "titleEn" | "items">[] so both
     Topic[] and TopicSummary[] work. Collect words whose stat has intervalDays >=
     MASTERED_INTERVAL_DAYS (mastered), sort intervalDays desc then key asc, top up
     with reviewCount > 0 words if short, cap at limit. Ignore dueAt. Emit DueCard
     records (topicSlug, topicTitle=titleEn, hanzi, pinyin, english, key=wordKey,
     dueAt, intervalDays).
2. NEW tests/comeback-logic.test.mjs (node:test + assert/strict, fixtures like
   tests/session-logic.test.mjs): boundaries 6d=false/7d=true; never-studied=false;
   deck ordering, top-up, limit, empty, missing-stat tolerance; injectable today.
3. src/lib/analytics.ts: add "comeback_completed" to the AnalyticsEvent union.
4. NEW src/components/comeback-app.tsx ("use client"): export function ComebackApp({
   data }: { data: MandarinData }). Use useProgress; seed ONE session snapshot with
   the adjust-state-while-rendering pattern from review-app.tsx:71 —
   startSession(comebackDeck(data.topics, progress.flashcardStats), COMEBACK_DECK_SIZE)
   from session-logic. Card UI: hanzi front (lang from HANZI_LANG, font-hanzi,
   SpeakButton) → Reveal button → back with TonePinyin (lang PINYIN_LANG) + english.
   Include ToneColorsToggle. NO drag/fling. Exactly two grade buttons: "Forgot" →
   gradeWord(key, "again") + gradeCard(session, "again"); "Got it" → gradeWord(key,
   "good") + gradeCard(session, "good"). Show review-app's "{n} to re-check" chip via
   againKeys. Completion: track("comeback_completed", { count }); CTA "Review {M} due
   words" (M = dueCards(data.topics, progress.flashcardStats).length) when M > 0 else
   "Browse topics"; secondary "Back to home". Empty deck: "Nothing to warm up yet"
   state linking to /. Match existing styling idiom (bg-surface, border-white/10,
   rounded-3xl, min-h-[44px] targets, emerald CTAs).
5. NEW src/app/comeback/page.tsx: mirror src/app/review/page.tsx — metadata title
   "Welcome back", canonical "/comeback", render <ComebackApp data={data} />.
6. src/components/home-app.tsx: add private WelcomeBackBanner({ daysAway }) mirroring
   DailyChallengeBanner (Link card → /comeback, copy: "👋 Welcome back — it's been {N}
   days" / "Ease back in with a quick warm-up of words you already know. No pressure,
   no pile." / pill "Warm up"). Render it immediately ABOVE the DailyChallengeBanner,
   gated on loaded && isLapsed(progress.studiedDates) && useMemo'd
   comebackDeck(data.topics, progress.flashcardStats).length > 0.
7. src/lib/seo.ts: add "/comeback" to the utility route array (line ~115) and update
   tests/seo.test.mjs accordingly.

Copy rules: every Chinese line carries pinyin; keep tone-color support via TonePinyin.
Do not modify progress schema, normalizeProgress, or scheduleReview.

Validation gate (all must pass):
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build
```

---

All findings are in. Here is the plan, grounded in the actual code.

---

## Sprint 10 — Recently-studied shelf on home: last three topics with quick resume links

### Goal and user value

Returning learners land on the home page and get one-tap resume links to the last three topics they actually opened — no scrolling through the 102-topic library grid or relying on the single "Continue learning" recommendation (which suggests the *next* unlearned topic, not the ones they were just working in). Theme: retention — reduce the friction between "I'm back" and "I'm studying."

### Current-state findings (grounded in actual files)

- **Home page**: `src/app/page.tsx` renders `HomeApp` (`src/components/home-app.tsx`, client component) with slimmed `HomeData` from `homeData()` in `src/lib/data.ts` (`TopicSummary[]` — no sentences). Home already has an ordered stack of sections: hero + snapshot → `DailyChallengeBanner` (inline, `home-app.tsx:389`) → `ContinueLearningCard` (from `src/components/onboarding.tsx:161`) → feature row → categories → library grid.
- **There is no record of which topics were visited/studied recently.** `ProgressState` (`src/lib/types.ts:114`) is schema **v7** and holds `learnedTopics`, `favoriteTopics`, `flashcardStats`, `quizStats`, `dailyActivity` (wordKeys per ISO day, pruned to 14 days), `dailyChallenge`, `bestQuizCombo`, `bossStats`, `studiedDates`, `onboarding` — none captures topic-level recency with ordering. (`dailyActivity` *could* approximate it, but it only records graded/quizzed words — a learner who watched a topic's video or browsed its words would never appear, and video lessons are a headline feature. A small persisted list is the honest fix.)
- **Migration machinery is well-established**: `CURRENT_PROGRESS_SCHEMA_VERSION = 7` in `src/lib/progress-logic.ts:36` with a documented per-version changelog; `normalizeProgress` (line 253) is the single load/import entry point, built from per-field `normalize*` helpers that never throw. Adding a field means: bump version, extend `emptyProgress`, add a normalizer, extend the docblock.
- **The persistence hook**: `src/components/use-progress.ts` (`STORAGE_KEY = "learn-10-mandarin-progress-v1"`) loads via `normalizeProgress`, persists on change, and exposes memoized actions. Important precedent: actions that are *not* practice (e.g. `toggleFavoriteTopic`) deliberately skip `recordStudyToday`/`withPractice` — a mere topic visit must NOT stamp `studiedDates` (streak) or `dailyActivity` (daily goal). Also note `recordBestCombo` (line 139) establishes the "return `current` unchanged when nothing would change, avoiding a needless write" pattern — we'll reuse it.
- **The natural recording choke point**: `TopicApp` (`src/components/topic-app.tsx:113-116`) already has a once-per-topic-mount effect that fires `track("topic_start", ...)` with deps `[topic.slug]`. Every topic study session goes through this component.
- **Rendering building blocks**: `ContinueLearningCard` shows the exact card idiom to mirror (uppercase emerald kicker, `titleEn`, `font-hanzi` `titleCn`, emerald pill link). `topicProgress(topic, flashcardStats)` (`progress-logic.ts:407`) gives `studied/total` per topic; `getTopic(topics, slug)` (`src/lib/data-logic.ts:7`) resolves slugs. Note: topic titles have no pinyin field in the dataset — existing surfaces (`ContinueLearningCard`, `TopicCard`) render `titleCn` alone in `font-hanzi`, so the shelf follows that established convention.
- **Analytics**: `src/lib/analytics.ts` has a closed `AnalyticsEvent` union (local-only, never networks); `search_result_opened` with `{ topic, rank }` is the precedent for a click event.
- **Tests**: `node --test` over `tests/*.test.mjs`, importing lib files with explicit `.ts` extensions (`tests/progress-logic.test.mjs:38`). Pure logic only — no component tests.

### Exact implementation steps in sequence

1. **`src/lib/types.ts`** — add to `ProgressState`:
   ```ts
   /**
    * Topic slugs most-recently opened first, deduped, capped at
    * RECENT_TOPICS_MAX. Powers the home "Jump back in" shelf. Added in schema v8.
    */
   recentTopics: string[];
   ```
2. **`src/lib/progress-logic.ts`** — schema + pure helpers:
   - Bump `CURRENT_PROGRESS_SCHEMA_VERSION` to `8`; extend the version docblock (`v7 → v8: added recentTopics (most-recently-opened topic slugs). Older saves lack the field and migrate to an empty [], losing nothing else.`).
   - Add `recentTopics: []` to `emptyProgress`.
   - Add `export const RECENT_TOPICS_MAX = 8;` (persist more than the 3 shown, so a renamed/removed slug can't empty the shelf).
   - Add `recordRecentTopic` (pure, move-to-front + dedupe + cap). **Critical detail**: return the input array *reference-unchanged* when `slug` is already at index 0 — this is what makes the recording effect loop-free (see step 4).
   - Add `normalizeRecentTopics(raw: unknown): string[]` — reuse `asStringArray`, dedupe preserving first occurrence, cap at `RECENT_TOPICS_MAX`, never throw. Wire it into `normalizeProgress`.
3. **`src/components/use-progress.ts`** — add a `recordTopicVisit(slug)` action to the memoized return object. It calls `recordRecentTopic` and returns `current` unchanged when the helper returns the same reference (mirroring `recordBestCombo`). It must NOT go through `withPractice` or `recordStudyToday` — visiting a page is not practice and must not affect streaks or the daily goal.
4. **`src/components/topic-app.tsx`** — record the visit on topic mount. Extend the existing `topic_start` effect area with a sibling effect gated on `loaded`:
   ```ts
   useEffect(() => {
     if (!loaded) return;
     recordTopicVisit(topic.slug);
   }, [loaded, topic.slug, recordTopicVisit]);
   ```
   This satisfies exhaustive-deps and cannot loop: after the first write, `recordRecentTopic` returns the same array, `recordTopicVisit` returns `current`, React bails out of the re-render, and `recordTopicVisit`'s identity stops changing. (`loaded` must be destructured from the existing `useProgress()` call at line 37.)
5. **`src/lib/data-logic.ts`** — dataset resolution helper `resolveRecentTopics` (generic over `Pick<Topic, "slug">` like `nextRecommendedTopic`): map slugs through `getTopic`, drop unknown slugs silently (dataset drift), take first `limit = 3`. No re-export needed in `data.ts` — home-app imports from `@/lib/data-logic` directly, as it already does for `nextRecommendedTopic`.
6. **`src/lib/analytics.ts`** — add `"recent_topic_resumed"` to the `AnalyticsEvent` union.
7. **New file `src/components/recent-topics-shelf.tsx`** — presentational client component; parent owns state (same pattern as `ContinueLearningCard`). Renders `null` for an empty list. Three compact cards in a responsive grid, each a single `<Link href={/topics/${slug}}>`: kicker-style heading row, `titleEn`, `font-hanzi` emerald `titleCn`, a quiet `{studied}/10 studied` line via `topicProgress`, and a "Resume →" affordance. Match the flat surface idiom (`rounded-3xl border border-white/10 bg-surface`, hover `bg-surface-hover`, no shadows — the codebase's flat-background convention noted at `home-app.tsx:111-113`).
8. **`src/components/home-app.tsx`** — render the shelf directly **after** `ContinueLearningCard` (recommendation first, resume shelf second — they answer "what's next" vs. "where was I") and only when `loaded` (like its siblings, avoiding SSR/hydration mismatch):
   ```tsx
   {loaded ? (
     <RecentTopicsShelf
       topics={resolveRecentTopics(data.topics, progress.recentTopics)}
       flashcardStats={progress.flashcardStats}
       onResume={(slug, rank) => track("recent_topic_resumed", { topic: slug, rank })}
     />
   ) : null}
   ```
9. **Tests** (step-by-step below in Test plan): extend `tests/progress-logic.test.mjs` and `tests/data-logic` coverage (the `data.test.mjs` file already imports `data-logic.ts` helpers; add there).
10. Run the full validation gate.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/types.ts` | `recentTopics: string[]` on `ProgressState` |
| `src/lib/progress-logic.ts` | v8 bump, `emptyProgress`, `RECENT_TOPICS_MAX`, `recordRecentTopic`, `normalizeRecentTopics` |
| `src/components/use-progress.ts` | `recordTopicVisit` action |
| `src/components/topic-app.tsx` | visit-recording effect on mount |
| `src/lib/data-logic.ts` | `resolveRecentTopics` |
| `src/lib/analytics.ts` | new event name |
| `src/components/recent-topics-shelf.tsx` | **new** shelf component |
| `src/components/home-app.tsx` | import + render shelf |
| `tests/progress-logic.test.mjs`, `tests/data.test.mjs` | new unit tests |

### Proposed names and signatures

```ts
// progress-logic.ts
export const RECENT_TOPICS_MAX = 8;
export function recordRecentTopic(recent: string[] | undefined, slug: string): string[];
// returns `recent` reference-unchanged when slug is already at index 0
function normalizeRecentTopics(raw: unknown): string[]; // module-private, like normalizeDailyActivity

// data-logic.ts
export function resolveRecentTopics<T extends Pick<Topic, "slug">>(
  topics: T[],
  recentSlugs: string[],
  limit = 3,
): T[];

// use-progress.ts (added to the returned actions object)
recordTopicVisit: (slug: string) => void;

// recent-topics-shelf.tsx
export function RecentTopicsShelf({ topics, flashcardStats, onResume }: {
  topics: TopicSummary[];                       // already resolved + capped to 3
  flashcardStats: Record<string, FlashcardStat>;
  onResume?: (slug: string, rank: number) => void;
}): React.ReactNode;
```

### UI copy / microcopy

- Section kicker (uppercase, emerald, matching `ContinueLearningCard`): **"Recently studied"**
- Heading: **"Jump back in"**
- Subline: **"Pick up where you left off — your last topics, one tap away."**
- Per card: `titleEn`, `titleCn` (font-hanzi, emerald), `"{studied}/10 studied"`, link affordance **"Resume →"**
- Accessibility: card `aria-label={`Resume ${topic.titleEn}`}`; empty state renders nothing (no placeholder copy — first-time users see the existing "Start here" CTA instead).

### Test plan

`tests/progress-logic.test.mjs`:
1. `recordRecentTopic` prepends a new slug; moves an existing slug to front and dedupes; caps at `RECENT_TOPICS_MAX` (oldest dropped); tolerates `undefined` input.
2. **Reference no-op**: `recordRecentTopic(arr, arr[0])` returns `arr` itself (`assert.equal`, not `deepEqual`) — this guards the effect-loop safety.
3. `normalizeProgress`: a v7-shaped save (no `recentTopics`) migrates to `recentTopics: []` with everything else preserved and `schemaVersion === 8`; corrupt values (`recentTopics: "junk"`, arrays with numbers/duplicates, > max entries) normalize to a clean, deduped, capped string array; `emptyProgress` deep-equality test at the top of the file will pick up the new field automatically.
4. Export/import round-trip: `normalizeProgress(JSON.parse(JSON.stringify(state)))` preserves `recentTopics` order.

`tests/data.test.mjs` (uses the real `topics.json` via `data-logic.ts` imports):
5. `resolveRecentTopics` returns topics in the given slug order, drops unknown slugs, respects `limit` (default 3), and returns `[]` for `[]`.

### Manual QA checklist

- [ ] Fresh profile (cleared localStorage): home shows **no** shelf; onboarding + "Start here" unaffected.
- [ ] Open three different topics, return home: shelf shows all three, most-recent first, correct `titleCn`/`titleEn`.
- [ ] Open a fourth topic: shelf still shows three, oldest gone from display.
- [ ] Re-open topic #2 and return: it moved to the front; no duplicates.
- [ ] Clicking "Resume →" lands on `/topics/[slug]`.
- [ ] Merely visiting a topic does **not** create a streak day: check the snapshot streak chip stays unchanged after visit-only sessions (guards the `withPractice` exclusion).
- [ ] `studied/10` count on shelf cards matches the topic page's studied count after grading a few flashcards.
- [ ] Export progress → clear storage → import: shelf restores.
- [ ] Hand-edit localStorage `recentTopics` to junk (`"x"`, `[42]`, unknown slugs): no crash, shelf degrades gracefully.
- [ ] No hydration warning in the console on home; mobile (~375px) layout: cards stack cleanly; `NEXT_PUBLIC_ANALYTICS=console` dev run logs `recent_topic_resumed` with `{ topic, rank }`.

### Acceptance criteria

1. Opening any topic page records it into persisted progress (`recentTopics`, schema v8) without touching `studiedDates`, `dailyActivity`, or any other field.
2. Home renders a "Jump back in" shelf with the last **three distinct** topics opened, most-recent first, each linking to `/topics/[slug]`; hidden entirely when there is no history.
3. Old saves (v7 and earlier) and imported files load without data loss; corrupt `recentTopics` never throws.
4. All five gate commands pass: `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build`.

### Risk and rollback notes

- **Effect re-run loop** is the main correctness risk: the memoized `recordTopicVisit` changes identity on every progress change. Mitigated by the reference-equality no-op contract (tested in isolation via `assert.equal` on the array reference). If issues surface, the fallback is a `[topic.slug]`-only dep with an eslint suppression — behavior-identical.
- **Schema bump** is additive-only; `normalizeProgress` "always stamps the current version" so downgrade/rollback of the code simply ignores the extra field (unknown keys are dropped by normalization, losing only shelf history — no user-meaningful data).
- **Rollback**: the feature is fully removable by reverting the single commit; no data migration to undo. Persisted `recentTopics` in users' storage would be silently stripped on next load by the old `normalizeProgress`.
- No new dependencies, routes, or server code; static output unchanged.

### Non-goals / deferrals

- No timestamps per visit ("2 days ago" labels) — would need `{slug, at}[]` entries; defer until a sprint wants recency copy.
- No dedup/suppression against the `ContinueLearningCard` recommendation — if the recommended next topic was also recently opened it may appear twice; acceptable, and hiding it would make the shelf feel unreliable.
- No recording of practice-surface topic exposure outside `/topics/[slug]` (review queue, daily challenge, duel) — the shelf is about resuming *lessons*.
- Not reusing the full `TopicCard` (library card is too heavy for a shelf row); no mastery dots on shelf cards this sprint.
- No changes to `/path`, `/stats`, or category pages.

### Ready-to-run Opus implementation prompt for Sprint 10

```text
You are implementing Sprint 10 of "Learn 10 Mandarin Words" (Next.js 16 / React 19 /
Tailwind 4, static, local-first, all progress in browser localStorage). Read
AGENTS.md first: this Next.js version may differ from your training data — consult
node_modules/next/dist/docs/ if any framework question arises (this sprint only
touches client components and next/link, so surface area is small).

FEATURE — "Recently studied" shelf on the home page: persist the last topics the
learner opened and show the three most recent as quick-resume cards.

Implement exactly this, in order:

1. src/lib/types.ts — add `recentTopics: string[]` to ProgressState with a JSDoc
   comment: most-recently-opened first, deduped, capped, added in schema v8.

2. src/lib/progress-logic.ts —
   a. Bump CURRENT_PROGRESS_SCHEMA_VERSION from 7 to 8 and extend the version
      changelog comment (v7 → v8: added recentTopics; older saves migrate to []).
   b. Add `recentTopics: []` to emptyProgress.
   c. Add `export const RECENT_TOPICS_MAX = 8;`
   d. Add pure `export function recordRecentTopic(recent: string[] | undefined,
      slug: string): string[]` — move-to-front + dedupe + cap at RECENT_TOPICS_MAX.
      CRITICAL CONTRACT: when `slug` is already at index 0, return the input array
      reference-unchanged (this makes the recording effect loop-free downstream).
   e. Add module-private `normalizeRecentTopics(raw: unknown): string[]` following
      the style of normalizeDailyActivity: reuse asStringArray, dedupe preserving
      first occurrence, cap at RECENT_TOPICS_MAX, never throw. Wire it into
      normalizeProgress.

3. src/components/use-progress.ts — add action `recordTopicVisit: (slug: string) =>
   void` to the memoized return object. It must call recordRecentTopic and, like the
   existing recordBestCombo, return `current` unchanged when recordRecentTopic
   returned the same reference. It must NOT go through withPractice or
   recordStudyToday — a visit is not practice and must not affect streaks/goals.

4. src/components/topic-app.tsx — destructure `loaded` and `recordTopicVisit` from
   the existing useProgress() call, then add next to the topic_start effect:
     useEffect(() => {
       if (!loaded) return;
       recordTopicVisit(topic.slug);
     }, [loaded, topic.slug, recordTopicVisit]);
   (Loop-free because of the reference no-op contract in step 2d.)

5. src/lib/data-logic.ts — add:
     export function resolveRecentTopics<T extends Pick<Topic, "slug">>(
       topics: T[], recentSlugs: string[], limit = 3): T[]
   Map slugs through getTopic, silently drop unknown slugs, take first `limit`.

6. src/lib/analytics.ts — add "recent_topic_resumed" to the AnalyticsEvent union.

7. NEW src/components/recent-topics-shelf.tsx — "use client"; presentational only
   (parent owns state, matching ContinueLearningCard in onboarding.tsx). Props:
     { topics: TopicSummary[]; flashcardStats: Record<string, FlashcardStat>;
       onResume?: (slug: string, rank: number) => void }
   Render null when topics is empty. Otherwise a section (mx-auto max-w-7xl px-6
   md:px-10, with top margin consistent with sibling sections) containing:
   kicker "Recently studied" (text-xs font-semibold uppercase tracking-wide
   text-emerald-300), heading "Jump back in", subline "Pick up where you left off —
   your last topics, one tap away.", then a grid (gap-3 sm:grid-cols-2
   lg:grid-cols-3) of cards. Each card is one next/link Link to /topics/${slug}
   with aria-label `Resume ${titleEn}`, styled flat like the codebase convention:
   rounded-3xl border border-white/10 bg-surface p-5 transition
   hover:bg-surface-hover (no shadows/backdrop blur). Card contents: titleEn
   (font-semibold text-white), titleCn (font-hanzi text-emerald-300),
   "{studied}/10 studied" (text-xs text-slate-500, using topicProgress from
   progress-logic), and "Resume →" (text-sm font-semibold, emerald on hover).
   Call onResume?.(slug, index) on click.

8. src/components/home-app.tsx — import RecentTopicsShelf and resolveRecentTopics,
   and render DIRECTLY AFTER the ContinueLearningCard block:
     {loaded ? (
       <RecentTopicsShelf
         topics={resolveRecentTopics(data.topics, progress.recentTopics)}
         flashcardStats={progress.flashcardStats}
         onResume={(slug, rank) => track("recent_topic_resumed", { topic: slug, rank })}
       />
     ) : null}

9. Tests (node --test style, import lib files with explicit .ts extensions like the
   existing tests):
   - tests/progress-logic.test.mjs: recordRecentTopic prepend / move-to-front /
     dedupe / cap / undefined input; the reference no-op (assert.equal of the
     returned array to the input array when slug already first); normalizeProgress
     migrates a v7 save to recentTopics: [] at schemaVersion 8; corrupt
     recentTopics (string, mixed-type array, duplicates, over-cap) normalizes
     safely; JSON round-trip preserves order.
   - tests/data.test.mjs: resolveRecentTopics ordering, unknown-slug dropping,
     limit default of 3, empty input.

Constraints: no new dependencies, no server/API code, no invented vocabulary or
metadata, keep the flat dark UI idiom, do not change any other ProgressState
behavior (streaks/goals must be unaffected by visits — verify by reading
withPractice/recordStudyToday call sites).

Validation gate — ALL must pass before you finish:
  npm run test
  npm run validate:data
  npm run validate:quality
  npm run lint
  npm run build
```

---

One design note worth flagging: I chose a small persisted `recentTopics` list (schema v8) over deriving recency from the existing `dailyActivity` map. Derivation would need zero schema change, but `dailyActivity` only records graded/quizzed words — a learner who watched a topic's video or browsed its word list would never appear on the shelf, and it's pruned to 14 days. The codebase already has a mature, well-tested migration pattern (seven schema versions with per-field normalizers), so the additive bump is low-risk.

---

I've grounded the plan in the actual code — the daily challenge (Sprint 1) already persists exactly what an archive needs (`progress.dailyChallenge`, a `YYYY-MM-DD → {score, total, completedAt}` map pruned to 60 days), so this sprint is purely a read-only derivation plus one new component on the existing `/daily` route. Here's the plan.

## Sprint 11 — Daily challenge archive: calendar of past challenge results with emoji score strips

### Goal and user value

Give learners a Wordle-style history of their Daily Challenge: a compact month calendar on `/daily` where each completed day is a colored cell, tapping a day reveals its emoji score strip (`🟩🟩🟥…`) and score, and a small summary row shows plays, perfect days, and the current challenge streak. The record already exists in localStorage — this sprint makes it visible, which makes the streak worth protecting and the daily habit worth keeping.

### Current-state findings (grounded in actual files)

- **Persistence already exists — no schema change needed.** `ProgressState.dailyChallenge` (`src/lib/types.ts:138`) maps ISO day → `DailyChallengeResult { score, total, completedAt }` (schema v5). Writes go through `recordDailyChallenge` (`src/lib/progress-logic.ts:646`, first-completion-wins) and are pruned to `DAILY_CHALLENGE_RETENTION_DAYS = 60` (`src/lib/progress-logic.ts:59`). Loads are sanitized by `normalizeDailyChallenge` (`src/lib/progress-logic.ts:173`) — the archive can trust `score ≤ total` and valid day keys.
- **Emoji strips have a single source of truth.** `outcomeStrip(outcomes: boolean[])` in `src/lib/daily-logic.ts:174` produces the `🟩/🟥` strip. Per-question order is **not** persisted — only counts — and `daily-app.tsx:124–132` already establishes the reconstruction convention for stored days: `score` greens followed by `total − score` reds. The archive should reuse exactly that.
- **The calendar-grid pattern is established.** `src/lib/heatmap-logic.ts` (Sprint 5) is the house style for pure, DOM-free grid derivation: UTC-day math with `DAY_MS`/`getUTCDay()`, hardcoded locale-independent `MONTH_NAMES`, injectable `endDay`/`today` for deterministic tests, defensive ISO-day validation. `src/components/study-heatmap.tsx` is the rendering precedent (tier→Tailwind class map, legend, a11y approach).
- **Streak helper exists.** `challengeStreak(map, today)` (`src/lib/progress-logic.ts:668`) is already computed and shown on the completed card in `daily-app.tsx:120` — the archive summary can reuse it without new logic.
- **Host surface.** `/daily` renders `DailyApp` (`src/app/daily/page.tsx` → `src/components/daily-app.tsx`), a client component with `useProgress()` already loaded; the archive slots in as a sibling section under the completed/active card. No new route, no `sitemap.ts`/`seo.ts` change (`/daily` is already listed at `src/lib/seo.ts:106`).
- **Conventions to respect:** pure logic in `src/lib/*-logic.ts` with explicit `.ts` extensions on runtime imports (for `node --test` — see the comment at `daily-logic.ts:2–5`); tests in `tests/*.test.mjs` using `node:test` + `assert/strict`; UTC day convention via `todayISO()` (`progress-logic.ts:285`); UI tokens `bg-surface`, `rounded-3xl border border-white/10`, emerald accent (see `daily-app.tsx`, `study-heatmap.tsx`).

### Exact implementation steps in sequence

1. **Create `src/lib/challenge-archive-logic.ts`** — pure, DOM-free, mirroring `heatmap-logic.ts`:
   - UTC month-grid builder over the challenge map: current month plus any earlier months (newest first) that contain results, capped at 3 (60-day retention can span at most 3 calendar months). Weeks run Sun→Sat; leading/trailing cells outside the month are padding; days after `today` are flagged future.
   - Score-tier mapping for cell color (miss/low/mid/high/perfect).
   - Strip reconstruction reusing `outcomeStrip` from `daily-logic.ts` with the greens-then-reds convention from `daily-app.tsx`.
   - Summary aggregation (played / perfect / average) over the already-pruned map.
   - Deterministic label helpers (hardcoded month names, no `Intl`).
2. **Write `tests/challenge-archive-logic.test.mjs`** covering grid shape, month selection, tier bands, strip reconstruction, future/today flags, summary math, and junk-input tolerance (mirror `heatmap-logic.test.mjs` style).
3. **Create `src/components/challenge-archive.tsx`** — purely presentational client component taking `dailyChallenge` + `today`. Renders the summary chips, the month grid(s) with result cells as buttons, and a detail line (emoji strip + score + date) for the selected day. Default-select the most recent result. Empty state renders a one-line teaser instead of a grid.
4. **Wire into `daily-app.tsx`**: render `<ChallengeArchive dailyChallenge={progress.dailyChallenge} today={session.day} />` as a new section below the completed/active block (visible in both states, so learners can browse history before playing).
5. Run the full gate: `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build`.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/challenge-archive-logic.ts` | new — pure archive/calendar derivation |
| `tests/challenge-archive-logic.test.mjs` | new — unit tests |
| `src/components/challenge-archive.tsx` | new — calendar UI |
| `src/components/daily-app.tsx` | +import, +one section rendering the archive |

No changes to `types.ts`, `progress-logic.ts`, `use-progress.ts`, routes, or data files.

### Proposed names and TypeScript signatures

```ts
// src/lib/challenge-archive-logic.ts
import type { DailyChallengeResult } from "./types";
import { outcomeStrip } from "./daily-logic.ts";
import { todayISO } from "./progress-logic.ts";

export const ARCHIVE_MAX_MONTHS = 3; // 60-day retention spans ≤ 3 calendar months

export type ScoreTier = 0 | 1 | 2 | 3 | 4;
// no result → handled by cell, tiers for results: 0–2 → 1 … total → 4, etc.
export function scoreTier(score: number, total: number): ScoreTier;

export type ArchiveCell = {
  day: string;                          // "YYYY-MM-DD" UTC
  result: DailyChallengeResult | null;
  inMonth: boolean;                     // false → padding cell
  isToday: boolean;
  isFuture: boolean;
};

export type ArchiveMonth = {
  key: string;                          // "YYYY-MM"
  label: string;                        // "July 2026" (hardcoded month names)
  weeks: ArchiveCell[][];               // rows of 7, Sun→Sat
};

// Newest-first months: current month always, older months only if they
// hold at least one result; capped at ARCHIVE_MAX_MONTHS.
export function buildChallengeArchive(
  map: Record<string, DailyChallengeResult> | undefined,
  today?: string,                       // injectable, defaults todayISO()
): ArchiveMonth[];

// Greens-then-reds reconstruction (order is not persisted) → "🟩🟩🟥…"
export function resultStrip(result: DailyChallengeResult): string;

export type ArchiveSummary = { played: number; perfect: number; average: number };
export function archiveSummary(
  map: Record<string, DailyChallengeResult> | undefined,
): ArchiveSummary;

// "Jul 5 — 8/10" | "Jul 5 — not played" | "… (today)"; aria/title text
export function archiveCellLabel(cell: ArchiveCell): string;
```

```tsx
// src/components/challenge-archive.tsx
export function ChallengeArchive({
  dailyChallenge,
  today,
}: {
  dailyChallenge: Record<string, DailyChallengeResult>;
  today: string;
}): React.JSX.Element;
```

Cells with a result are `<button>`s (selectable); tier→class map follows `LEVEL_CLASS` in `study-heatmap.tsx` (e.g. `bg-white/[0.06]` base → emerald ramp → `bg-emerald-400` for perfect; consider amber/rose only if it stays clean — emerald ramp is the safer house style). Today gets the existing `ring-1 ring-emerald-300` treatment.

### UI copy / microcopy

- Section heading: **"Challenge archive"**; subline: *"Your last 60 days of daily challenges."*
- Summary chips: `🗓️ {played} played` · `🏆 {perfect} perfect` · `🔥 {streak}-day streak` (streak chip only when > 0, matching `daily-app.tsx:179`).
- Selected-day detail: date on one line, then `🟩🟩🟩🟥…` strip, then `8/10`.
- Cell tooltips/aria: `"Jul 5 — 8/10"`, `"Jul 5 — not played"`, `"Jul 6 — 9/10 (today)"`.
- Empty state: *"No challenges yet — finish today's ten to start your archive."*
- Reconstruction honesty (small footnote under the detail strip): *"Strip shows your score, not question order."* — optional but recommended since order isn't persisted.

No Chinese text appears in this feature, so the pinyin-with-hanzi rule isn't triggered.

### Test plan (`tests/challenge-archive-logic.test.mjs`)

- `buildChallengeArchive`: every week has exactly 7 cells; first cell of each week is a UTC Sunday; all in-month days of `today`'s month present exactly once; days after `today` have `isFuture: true`; `isToday` set only on `today`.
- Month selection: empty map → just the current month; a result 2 months back → that month included; months with no results (other than current) excluded; never more than 3 months; newest first.
- `scoreTier`: band edges (0, low, mid, high, `score === total` → 4); tolerates `total = 0` without NaN.
- `resultStrip`: `{score: 3, total: 5}` → `"🟩🟩🟩🟥🟥"`; matches `outcomeStrip` on the reconstructed array; `score = total` → all green.
- `archiveSummary`: played/perfect counts, average rounding, empty map → zeros (no NaN).
- `archiveCellLabel`: played / not-played / today-suffix variants.
- Defensive: junk day keys or malformed results in the map don't throw (mirror `normalizeDailyChallenge` tolerance).
- Injectable `today` throughout — no real-clock dependence.

### Manual QA checklist

1. Fresh profile (clear localStorage) → `/daily` shows the empty-state teaser, no grid.
2. Complete today's challenge → archive appears with today's cell filled, selected by default, strip + score matching the completion card.
3. Seed several past days via DevTools (`localStorage` key `learn-10-mandarin-progress-v1`, add entries under `dailyChallenge`) → correct cells light up; a result 2 months back adds that month grid; tapping cells swaps the detail strip.
4. Perfect-score day renders the brightest tier; strip is all green.
5. Reload mid-view → archive persists; day straddle: cell ring marks today per UTC.
6. Keyboard: tab reaches result cells, Enter selects, detail updates; unplayed/future cells are not focusable.
7. Mobile width (~375px): 7-column grid fits without horizontal scroll; chips wrap cleanly.
8. Existing flows unaffected: active run, completed card, share button, streak pill all unchanged.

### Acceptance criteria

- `/daily` shows a calendar archive of the last ≤60 days of daily-challenge results with no new persistence, schema bump, network calls, or routes.
- Each played day shows a score-tinted cell; selecting it shows the emoji strip and `score/total`; today is visually marked.
- Summary chips (played / perfect / streak) agree with `challengeStreak` and the stored map.
- New logic is 100% pure and unit-tested; all five gate commands pass.

### Risk and rollback notes

- **Risk: order-vs-count confusion.** Strips are reconstructions (greens first). Mitigated by the footnote and by following the identical existing convention in `daily-app.tsx:124–132` — no new inconsistency introduced.
- **Risk: UTC month boundaries** surprising users far from UTC. Accepted: the whole app (streaks, heatmap, challenge day) is UTC-day-based; deviating here would desync the archive from the streak.
- **Risk: layout crowding on `/daily`.** The archive is an isolated trailing section; worst case it's visually heavy, not functionally breaking.
- **Rollback:** revert the single commit — two new files plus a ~5-line addition to `daily-app.tsx`; no data migration to unwind, stored progress untouched either way.

### Non-goals / deferrals

- Persisting per-question outcome order (would be schema v8; enables true Wordle strips) — deferred.
- Extending retention beyond 60 days, or an "all-time" archive.
- A dedicated `/daily/archive` route, sitemap/SEO changes, or archive sharing (share stays on the completion card).
- Backfilling archive cells from `dailyActivity`/`studiedDates` (different semantics — study ≠ challenge).
- Month-to-month pagination beyond the ≤3 retained months.

### Ready-to-run Opus implementation prompt for Sprint 11

```
You are implementing Sprint 11 of the Learn 10 Mandarin Words app (Next.js 16 /
React 19 / Tailwind 4, static, local-first, no backend). Read AGENTS.md first and
consult node_modules/next/dist/docs/ if any framework question arises.

TASK — Daily challenge archive on /daily: a calendar of past Daily Challenge
results with emoji score strips. Read-only over existing data; NO schema change.

CONTEXT (verify before coding):
- Results already persist: ProgressState.dailyChallenge in src/lib/types.ts
  ("YYYY-MM-DD" → { score, total, completedAt }), written by recordDailyChallenge
  and pruned to DAILY_CHALLENGE_RETENTION_DAYS = 60 in src/lib/progress-logic.ts.
- Emoji strip helper: outcomeStrip in src/lib/daily-logic.ts. Question order is
  NOT persisted; daily-app.tsx (displayOutcomes) already reconstructs stored days
  as score greens followed by (total−score) reds — reuse that exact convention.
- Calendar/grid house style: src/lib/heatmap-logic.ts (pure, UTC DAY_MS math,
  hardcoded month names, injectable today, defensive ISO validation) and
  src/components/study-heatmap.tsx (tier→Tailwind class map, emerald ramp,
  today ring, legend).
- challengeStreak(map, today) exists in src/lib/progress-logic.ts.

BUILD:
1. src/lib/challenge-archive-logic.ts (pure, DOM-free; runtime imports from
   sibling lib files MUST use explicit ".ts" extensions — see the comment atop
   daily-logic.ts): scoreTier(score,total): 0|1|2|3|4; ArchiveCell / ArchiveMonth
   types; buildChallengeArchive(map, today = todayISO()) → newest-first months
   (current month always; older months only if they contain results; max 3),
   weeks as rows of 7 Sun→Sat with inMonth/isToday/isFuture flags;
   resultStrip(result) via outcomeStrip (greens-then-reds); archiveSummary(map)
   → { played, perfect, average }; archiveCellLabel(cell) for title/aria text.
   Locale-independent labels (hardcoded month names, no Intl). Never throw on
   junk input.
2. tests/challenge-archive-logic.test.mjs (node:test + assert/strict, importing
   ../src/lib/challenge-archive-logic.ts): 7-cell weeks starting on UTC Sundays;
   month inclusion/exclusion and the 3-month cap; isFuture/isToday; tier bands
   incl. total=0 safety; strip reconstruction; summary math incl. empty map;
   label variants; injectable today everywhere (no real clock).
3. src/components/challenge-archive.tsx ("use client", purely presentational):
   props { dailyChallenge, today }. Section heading "Challenge archive", subline
   "Your last 60 days of daily challenges." Summary chips (🗓️ played, 🏆 perfect,
   🔥 streak via challengeStreak — streak chip only when > 0). Month grids with
   played-day cells as <button>s (tier-tinted emerald ramp per study-heatmap's
   LEVEL_CLASS pattern; today ring ring-1 ring-emerald-300); unplayed/future
   cells non-interactive. Selecting a cell shows a detail line: date, emoji
   strip, score/total, plus footnote "Strip shows your score, not question
   order." Default-select the newest result. Empty map → render only:
   "No challenges yet — finish today's ten to start your archive." Match app
   styling: rounded-3xl border border-white/10 bg-surface, slate/emerald palette,
   min-h-[44px] touch targets where applicable.
4. Wire into src/components/daily-app.tsx: render the archive as a trailing
   section inside <main>, visible in BOTH the active and completed states, using
   progress.dailyChallenge and session.day. Do not alter the run/completion/share
   logic.

CONSTRAINTS: no new routes, no schema/version bump, no localStorage writes, no
external services, no invented vocabulary. Keep the diff minimal (2 new files +
1 test + a small daily-app.tsx addition).

VALIDATION GATE (all must pass):
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build
```

---

I have everything I need — here's the grounded plan.

## Sprint 12 — Lightning round best-score history: sparkline of recent runs plus score tiers

### Goal and user value

Give the Lightning Round a sense of trajectory: after every 60-second run, the learner sees a small sparkline of their recent scores and a named score tier (Spark → Bolt → Storm → Thunderclap) with the exact points needed to reach the next tier. Beating your personal best becomes a visible climb instead of a single number, which is the whole retention hook of a timed mode. Everything stays device-local in the existing lightning localStorage slot.

### Current-state findings (grounded in actual files)

- **`src/lib/lightning-logic.ts`** holds all pure, DOM-free game rules. The persisted shape is `LightningBest { bestScore, bestCorrect, runs, updatedAt }` (line 215) under `LIGHTNING_STORAGE_KEY = "learn-10-mandarin-lightning-v1"` (line 38) — deliberately **outside** `ProgressState`, so extending it never touches progress export/import or the schema version. `normalizeLightningBest` (line 230) already coerces any unknown payload defensively, and `mergeRunIntoBest` (line 249) is the single pure fold point where a finished run meets stored state, with an injectable `now` for tests. **This is exactly where run history belongs — no new storage key needed; old v1 payloads just lack a `history` field and normalize can default it to `[]`.**
- **Scoring bounds** are known: `POINTS_PER_CORRECT = 100`, combo caps at ×3 after 6 straight (`multiplierFor`, line 174). A strong player answering ~30 in 60s tops out around 8,000–8,500 points; realistic good runs land 2,000–5,000. Tier thresholds below are calibrated to that.
- **`src/components/use-lightning-best.ts`** is the hydration-safe store hook: zero-state first render, post-mount read, `recordRun` re-reads storage before merging (multi-tab safe, line 63). Its local `ZERO_BEST` constant (line 22) duplicates the zero shape and must gain `history: []`. No other hook logic changes — `recordRun` already routes through `mergeRunIntoBest`.
- **`src/components/lightning-app.tsx`** renders three phases. The idle screen shows personal best (lines 250–257); the done screen shows new-best/regular results plus a "gap to beat" line (lines 361–411). Both are the natural sparkline/tier surfaces. `track("lightning_completed", …)` fires on finish (line 122) and `AnalyticsProps` is a free-form `Record<string, string | number | boolean>` (`src/lib/analytics.ts:42`), so adding a `tier` prop is legal without touching the event union.
- **Precedent for capped run history**: `src/lib/duel-logic.ts` stores results newest-first capped at `DUEL_HISTORY_LIMIT = 20` via `appendDuelRecord`/`normalizeDuelHistory` (lines 175–228). Mirror that shape and defensive style.
- **Precedent for tiered copy**: `src/lib/share-card-logic.ts` (lines 68–88) does tiered headlines from a success fraction; `src/lib/heatmap-logic.ts` has intensity tiers. Naming a `tierForScore` helper fits house style.
- **Precedent for inline SVG**: `src/components/progress-ring.tsx` is a small presentational SVG component (lines 33–61) — the sparkline should follow the same pattern. There is no charting library and none should be added (deps are just next/react/tailwind, `package.json`).
- **Tests**: `tests/lightning-logic.test.mjs` runs under `node --test`, imports the lib directly with `.ts` extensions (which is why `lightning-logic.ts` uses explicit `.ts` in its own imports — preserve that), and already fixtures `mergeRunIntoBest`/`normalizeLightningBest`. New pure helpers slot straight in.
- **`src/components/stats-app.tsx`** already consumes `useLightningBest` for a stat card (lines 39–40, 202–205) whose sublabel is `"60-second challenge"` — a one-line spot to surface the tier name.

### Exact implementation steps in sequence

1. **Extend the persisted model in `src/lib/lightning-logic.ts`** (pure logic only):
   - Add `LIGHTNING_HISTORY_LIMIT = 20` and `type LightningRunRecord = { score: number; correct: number; answered: number; at: string }` (ISO timestamp).
   - Extend `LightningBest` with `history: LightningRunRecord[]` — newest-first, like duel history.
   - Extend `normalizeLightningBest`: default missing/corrupt `history` to `[]`; drop malformed entries (non-finite/negative numbers, invalid ISO — reuse the existing `isValidISO` and coercion style); cap at `LIGHTNING_HISTORY_LIMIT`. Old v1 payloads (no `history` key) must round-trip losslessly with `history: []`.
   - Extend `mergeRunIntoBest`: prepend `{ score: run.score, correct: run.correct, answered: run.answered, at: now.toISOString() }` to `history`, capped. Keep the existing rule that a zero-answered run never sets a best — but decide (and test) that zero-answered runs are also **not** appended to history, so an accidental "start then walk away" doesn't dent the sparkline. `runs`/`updatedAt` behavior unchanged.
2. **Add score tiers in `src/lib/lightning-logic.ts`**:
   - `export const SCORE_TIERS: LightningTier[]` with `type LightningTier = { name: string; emoji: string; min: number }`, ascending: Spark ⚡ 500 · Bolt 🌩️ 1,500 · Storm ⛈️ 3,000 · Thunderclap 🌪️ 5,000 (below 500 is untiered).
   - `tierForScore(score: number): LightningTier | null` and `nextTier(score: number): { tier: LightningTier; pointsAway: number } | null` (null once Thunderclap is reached). Both tolerant of non-finite input (return null), mirroring `multiplierFor`'s defensiveness.
3. **Add the sparkline geometry helper in `src/lib/lightning-logic.ts`** so it's unit-testable without React: `sparklinePoints(scores: number[], width: number, height: number): string` — takes scores oldest→newest, returns an SVG `points` string, padding a small margin, mapping max score to top. Handle the degenerate cases: empty → `""`, single point → centered point, all-equal scores → flat midline (avoid divide-by-zero).
4. **Update `src/components/use-lightning-best.ts`**: add `history: []` to `ZERO_BEST`. Nothing else — load/merge/persist paths already flow through the extended normalizer and merger.
5. **Create `src/components/lightning-sparkline.tsx`**: small presentational client component (pattern: `progress-ring.tsx`) taking `history: LightningRunRecord[]` and optional `bestScore`. Reverse to oldest→newest, call `sparklinePoints`, render a fixed-viewBox `<svg>` (~`viewBox="0 0 160 40"`, `preserveAspectRatio="none"`) with an emerald `<polyline>` (`stroke="var(--color-accent)"` to match the existing token usage in lightning-app), a brighter dot on the latest run, and an optional dashed best-score reference line. Include `role="img"` with a real `aria-label` (e.g. "Last 6 runs, latest 2,400, best 3,100") and render nothing (or the empty-state copy) when history has < 2 entries.
6. **Wire into `src/components/lightning-app.tsx`**:
   - **Idle screen** (inside the existing `best.bestScore > 0` branch): under the personal-best number, add the tier badge (name + emoji, amber-chip styling like the combo chip), the sparkline with a "Last N runs" caption, and the next-tier chase line from `nextTier(best.bestScore)`.
   - **Done screen**: below the score, show the tier the finished run landed in and either the next-tier chase copy or the top-tier line; append the sparkline (which now includes this run, since `recordRun` fired in `finish()` before phase flips to `done`).
   - Add `tier: tierForScore(finalRun.score)?.name ?? "none"` to the existing `track("lightning_completed", …)` payload in `finish()`.
7. **One-line polish in `src/components/stats-app.tsx`**: when `lightningBest.bestScore > 0`, set the lightning card sublabel to the tier name (e.g. "Bolt tier · 60-second challenge"), falling back to the current copy.
8. **Extend `tests/lightning-logic.test.mjs`** (see test plan), then run the full validation gate.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/lightning-logic.ts` | History type/limit, extended `LightningBest`/normalizer/merger, tiers, sparkline geometry |
| `src/components/use-lightning-best.ts` | `ZERO_BEST` gains `history: []` |
| `src/components/lightning-sparkline.tsx` | **New** presentational SVG component |
| `src/components/lightning-app.tsx` | Idle + done screens: sparkline, tier badge, chase copy; analytics prop |
| `src/components/stats-app.tsx` | Tier name in the lightning stat-card sublabel |
| `tests/lightning-logic.test.mjs` | New/extended unit tests |

### Proposed names and signatures

```ts
// src/lib/lightning-logic.ts
export const LIGHTNING_HISTORY_LIMIT = 20;

export type LightningRunRecord = {
  score: number;
  correct: number;
  answered: number;
  at: string; // ISO
};

export type LightningBest = {
  bestScore: number;
  bestCorrect: number;
  runs: number;
  updatedAt: string | null;
  history: LightningRunRecord[]; // newest-first, capped
};

export type LightningTier = { name: string; emoji: string; min: number };
export const SCORE_TIERS: LightningTier[];

export function tierForScore(score: number): LightningTier | null;
export function nextTier(score: number): { tier: LightningTier; pointsAway: number } | null;
export function sparklinePoints(scores: number[], width: number, height: number): string;
// normalizeLightningBest / mergeRunIntoBest keep their existing signatures.
```

```tsx
// src/components/lightning-sparkline.tsx
export function LightningSparkline(props: {
  history: LightningRunRecord[]; // newest-first, as stored
  bestScore?: number;
  className?: string;
}): React.JSX.Element | null;
```

### UI copy / microcopy

- Idle screen, under the best score: tier chip `⚡ Spark` / `🌩️ Bolt` / `⛈️ Storm` / `🌪️ Thunderclap`; caption `Last 6 runs` (actual count, max 20); chase line `1,200 points to Bolt 🌩️`.
- Idle, best score set but below Spark: `500 points to Spark ⚡`.
- Idle, fewer than 2 recorded runs: `Play a few rounds to see your score trend.`
- Done screen, tiered run: `Bolt tier 🌩️` + `1,400 to Storm ⛈️ — go again?`; top tier: `Thunderclap 🌪️ — the top tier. Defend it.`
- Done screen, untiered run: `500 points reaches Spark ⚡`.
- Sparkline `aria-label`: `Score trend for your last {n} runs. Latest {score}, best {best}.`
- Stats card sublabel: `{Tier} tier · 60-second challenge`.

All numbers rendered with `toLocaleString()`, matching the existing score display.

### Test plan (`tests/lightning-logic.test.mjs`, `node --test` style already in place)

- **normalizeLightningBest**: legacy v1 payload without `history` → `history: []`, other fields intact; corrupt `history` (non-array, entries with negative/`NaN` scores or bad ISO `at`) → bad entries dropped; over-long history → capped at 20; valid payload round-trips.
- **mergeRunIntoBest**: run prepended newest-first with injected `now` ISO; cap enforced when history is full; zero-answered run increments `runs` but appends nothing and never sets a best (existing behavior preserved); new-best and non-best runs both appear in history.
- **tierForScore**: boundary values — 499 → null, 500 → Spark, 1,500 → Bolt, 3,000 → Storm, 5,000 and above → Thunderclap; `NaN`/negative → null.
- **nextTier**: 0 → Spark with `pointsAway: 500`; 2,600 → Storm with 400; ≥ 5,000 → null.
- **sparklinePoints**: empty → `""`; single score → one centered point; two known scores map to expected coordinates (higher score → smaller y); all-equal scores → flat line, no `NaN` in output; output has one `x,y` pair per score.
- Existing lightning tests must pass unchanged.

### Manual QA checklist

1. Fresh profile (clear `learn-10-mandarin-lightning-v1`): idle screen shows "No best score yet" and the "play a few rounds" trend hint; no sparkline, no tier chip.
2. Seed a **legacy** payload in DevTools (`{"bestScore":2100,"bestCorrect":18,"runs":5,"updatedAt":"2026-07-01T00:00:00.000Z"}`) → page loads cleanly, Bolt tier shows, sparkline absent (empty history), no console errors.
3. Play a round: done screen shows score, tier (or "reach Spark" line), chase copy, and the sparkline including the run just played; "Go again" (and the `R` shortcut) still works.
4. Play 3+ rounds with varying scores: sparkline slopes correctly oldest→newest, latest-run dot on the right, dashed best line at the max.
5. Beat the best: "New personal best!" screen unchanged plus tier/chase copy; idle screen afterwards reflects the new tier.
6. `/stats` lightning card sublabel shows the tier name once a best exists.
7. Reduced motion (`prefers-reduced-motion`): no new animation introduced; existing pulse behavior unchanged.
8. Mobile width (~375px): sparkline scales without overflow; tap targets still ≥ 44px.
9. Corrupt the stored JSON by hand → app falls back to zero-state, never crashes.

### Acceptance criteria

- Recent lightning runs (up to 20) persist under the existing `learn-10-mandarin-lightning-v1` key; legacy payloads load without data loss or errors.
- Idle and done screens render a sparkline once ≥ 2 runs exist, a tier badge once a tiered score exists, and next-tier chase copy with the exact point gap.
- Tier thresholds: 500 / 1,500 / 3,000 / 5,000; tier and sparkline helpers are pure and unit-tested.
- No new dependencies, no network calls, no changes to `ProgressState` or progress export/import.
- Full gate passes: `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build`.

### Risk and rollback notes

- **Schema risk is the main one**: we're widening a persisted shape in place. Mitigated because `normalizeLightningBest` is already the single defensive entry point and old payloads simply lack the new key; the new normalizer must never throw. If anything goes wrong post-ship, reverting the commit is safe — the old normalizer ignores the extra `history` field it doesn't know about (it rebuilds only known fields), so forward-written payloads degrade gracefully under rolled-back code.
- **Multi-tab**: `recordRun` re-reads storage before merging, so history appends from two tabs interleave rather than clobber — unchanged behavior, worth one QA glance.
- **UI regression risk** is confined to `/lightning`'s idle/done branches and one sublabel in `/stats`; the running phase is untouched.
- Rollback = revert the single sprint commit; no data migration to undo.

### Non-goals / deferrals

- No full run-history list/table UI, timestamps display, or per-run drill-down — sparkline only.
- No tier-unlock celebrations, achievements integration (`achievements-logic.ts`), or share-card changes (`share-card-canvas.ts`) — natural follow-ups, out of scope.
- No sparkline on `/stats` (card sublabel only) and no changes to duel/boss/daily modes.
- No storage-key version bump, export/import integration, or settings for history length.
- No charting library.

### Ready-to-run Opus implementation prompt for Sprint 12

```
You are implementing Sprint 12 of the "Learn 10 Mandarin Words" app (Next.js 16 /
React 19 / Tailwind 4, static, local-first, no backend). Read AGENTS.md first and
consult node_modules/next/dist/docs/ if any framework question arises. Keep the
existing code style: heavily commented pure-logic modules, defensive normalizers,
explicit .ts extensions in src/lib imports (required for node --test).

GOAL
Add a device-local run history + score tiers to the Lightning Round (/lightning):
a sparkline of recent scores and named tiers with next-tier chase copy.

SPEC
1. src/lib/lightning-logic.ts (pure logic, no DOM):
   - LIGHTNING_HISTORY_LIMIT = 20.
   - type LightningRunRecord = { score: number; correct: number; answered: number; at: string }.
   - Extend LightningBest with history: LightningRunRecord[] (newest-first, capped).
   - normalizeLightningBest: default missing/corrupt history to []; drop malformed
     entries (non-finite/negative numbers, invalid ISO via the existing isValidISO);
     cap at the limit; legacy payloads without history must round-trip with history: [].
     Never throw.
   - mergeRunIntoBest: prepend the finished run as a record (ISO from the injectable
     `now`), capped. Zero-answered runs still increment `runs` but are NOT appended
     to history and never set a best.
   - Tiers: export SCORE_TIERS: LightningTier[] with
     type LightningTier = { name: string; emoji: string; min: number } —
     Spark ⚡ 500, Bolt 🌩️ 1500, Storm ⛈️ 3000, Thunderclap 🌪️ 5000.
     tierForScore(score): LightningTier | null (null below 500 or non-finite).
     nextTier(score): { tier, pointsAway } | null (null at/above 5000).
   - sparklinePoints(scores: number[], width: number, height: number): string —
     SVG polyline points for scores oldest→newest, small internal padding, higher
     score = smaller y. Empty → ""; single score → one centered point; all-equal →
     flat midline; never NaN.
2. src/components/use-lightning-best.ts: add history: [] to ZERO_BEST. No other changes.
3. New src/components/lightning-sparkline.tsx ("use client", pattern: progress-ring.tsx):
   props { history: LightningRunRecord[]; bestScore?: number; className?: string }.
   Reverse newest-first history to oldest→newest, render <svg viewBox="0 0 160 40">
   with an accent polyline via sparklinePoints, a dot on the latest run, and a dashed
   best-score reference line when bestScore > 0. role="img" + aria-label
   "Score trend for your last {n} runs. Latest {score}, best {best}." Return null
   when history.length < 2.
4. src/components/lightning-app.tsx:
   - Idle screen (best.bestScore > 0 branch): tier chip (amber combo-chip styling),
     LightningSparkline + "Last {n} runs" caption, chase line
     "{gap} points to {tier} {emoji}" from nextTier(best.bestScore). With < 2 runs:
     "Play a few rounds to see your score trend."
   - Done screen: tier line for the finished run ("Bolt tier 🌩️" or
     "500 points reaches Spark ⚡"), chase copy ("{gap} to {tier} {emoji} — go again?"
     or "Thunderclap 🌪️ — the top tier. Defend it."), and the sparkline.
   - Add tier: tierForScore(finalRun.score)?.name ?? "none" to the existing
     track("lightning_completed", ...) payload.
   - Use toLocaleString() for all numbers. Do not touch the running phase, timer,
     shortcuts, or scoring.
5. src/components/stats-app.tsx: lightning stat-card sublabel becomes
   "{Tier} tier · 60-second challenge" when a tiered best exists; keep current
   fallbacks otherwise.
6. tests/lightning-logic.test.mjs: add tests for legacy-payload normalization,
   history cap + newest-first order, zero-answered runs excluded from history,
   tier boundaries (499/500/1500/3000/5000, NaN), nextTier gaps and top-tier null,
   and sparklinePoints (empty/single/two-known/all-equal, no NaN). Keep the existing
   fixture + injected-now style.

CONSTRAINTS
- No new dependencies, no network, no changes to ProgressState or progress
  export/import, no new localStorage keys.
- Pinyin handling, speech, and the active-round UI are untouched.
- Keep comments in the established explanatory style.

VALIDATION GATE (all must pass before you finish):
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build
```

---

I have a full picture now. Here is the plan.

---

## Sprint 13 — Duel player names and persistent head-to-head win record

### Goal and user value

Turn one-off pass-and-play duels into an ongoing household rivalry. Player names are already captured and remembered (Sprint 10 over-delivered there), but nothing is done with the stored results: nobody can see "Alice leads Bob 4–2." This sprint adds a **persistent, name-attributed head-to-head win tally** — shown on the duel setup screen (live, as you type your names) and on the results screen right after a duel — computed entirely from the existing device-local `localStorage` history. No backend, no new storage keys.

### Current-state findings (grounded in actual files)

- **`src/lib/duel-logic.ts`** — pure DOM-free duel state machine plus the storage schema. Already has: `DuelHistory { schemaVersion: 1; names: [string, string]; results: DuelRecord[] }`, `DuelRecord { at, topicSlug, mode, scores }`, `DUEL_NAME_MAX_LENGTH = 12`, `DUEL_HISTORY_LIMIT = 20`, `emptyDuelHistory()`, `normalizeDuelHistory()` (defensive, never throws, drops malformed records), `appendDuelRecord()` (newest-first, capped), and `duelResult()` returning `winner: 0 | 1 | "tie"`.
- **`src/components/use-duel-history.ts`** — load-once/save-on-change hook on key `"learn-10-mandarin-duel-v1"`, deliberately separate from `ProgressState` (a duel is two people; it must never touch the owner's progress/export/streak). Exposes `history`, `loaded`, `setNames`, `recordResult`.
- **`src/components/duel-app.tsx`** — the four screens (setup → handoff → question → results). Name inputs exist (`nameA`/`nameB`, seeded once from `history.names` via adjust-state-during-render at duel-app.tsx:72), `displayNames` falls back to `"Player 1"`/`"Player 2"`, `setNames(displayNames)` persists on duel start (duel-app.tsx:106), and a `recordedRef`-guarded effect calls `recordResult({at, topicSlug, mode, scores})` once on the `done` phase (duel-app.tsx:111-130). The **only** surfacing of history today is a faint "N past duels remembered on this device" line on setup (duel-app.tsx:383-387). `ScoreChip` (duel-app.tsx:691) is a reusable name+number chip.
- **Two real gaps:**
  1. `DuelRecord` does **not** store who played — a tally computed from raw `results` would silently re-attribute old duels if the household's names change (e.g., Charlie and Dana borrow the device).
  2. No helper computes wins/ties, and no UI shows a running record.
- **Scores are index-stable**: on rematch the *turn assignment* flips so the loser goes first (duel-app.tsx:101-104), but `scores[0]` always belongs to Player 1 (`nameA`). So `[names, scores]` per record is a sound attribution.
- **`tests/duel-logic.test.mjs`** — `node --test` suite importing `../src/lib/duel-logic.ts` directly (native TS test runner; that's why duel-logic.ts uses explicit `.ts` import extensions). Uses an identity shuffle for determinism. This is where new tests go.
- **`package.json`** — `test: "node --test"`, plus `validate:data` / `validate:quality` (vocab data scripts; untouched by this sprint) and `lint`/`build`.
- No changes needed in `src/app/duel/page.tsx`, `home-app.tsx` (just the entry card), `analytics.ts` (`"duel_completed"` union member exists), or `seo.ts`.

### Exact implementation steps in sequence

1. **`src/lib/duel-logic.ts` — schema: per-record names.** Add `names: [string, string]` to `DuelRecord`. In `normalizeRecord`, accept records **without** names (legacy payloads) by returning `names: ["", ""]`, and normalize present names through the existing `normalizeName` (string check + `DUEL_NAME_MAX_LENGTH` cap). In `normalizeDuelHistory`, back-fill any record whose names are both empty with the top-level stored `names` — correct for legacy data because v1 only ever remembered one pair. Keep `schemaVersion: 1` and the same storage key: the change is additive and old payloads still parse.
2. **`src/lib/duel-logic.ts` — matching + tally helpers.** Add `canonicalDuelName` (trim + lowercase, for matching only — display keeps user casing) and `headToHeadFor(history, names)`. Matching is **order-insensitive**: if a record's canonical pair is the reverse of the current pair, swap its scores before tallying, so the record survives the two players swapping input slots. Edge case: if both canonical names are identical (or both empty), match by index order only. A record counts as a win for the higher score, a tie on equal scores.
3. **`src/components/duel-app.tsx` — write names into each record.** In the done-phase effect (line ~116), add `names: displayNames` to the `recordResult` payload. (`displayNames` already applies the `"Player 1"`/`"Player 2"` fallback, so records always carry concrete names.)
4. **`src/components/duel-app.tsx` — `RivalryTally` presentational component.** A single compact line built from `HeadToHead` + display names (copy below). Reuse the visual language of `ScoreChip` (rounded-full, border-white/10, emerald accents) — no new design system pieces.
5. **Setup screen.** Compute `headToHeadFor(history, displayNames)` in `DuelApp` and pass it into `SetupScreen`. When `total > 0`, render the rivalry line inside the "Players" card (under the two inputs) so it live-updates as names are typed and typing "Alice"/"Bob" instantly resurfaces that pair's record. Keep the existing "N past duels remembered" footer line as-is (it counts all duels, not just this pair).
6. **Results screen.** Pass the same computed tally into `ResultsScreen` and render it beneath the winner headline / score chips. Because `recordResult` fires in an effect on reaching `done`, `history` re-renders to **include the just-finished duel** — the tally the players see already counts it. When `total === 1`, show the "first duel" variant instead of a 1–0 line.
7. **`tests/duel-logic.test.mjs` — unit tests** (see test plan) using the existing identity-shuffle/fixture style.
8. Run the full validation gate.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/duel-logic.ts` | `DuelRecord.names`, `canonicalDuelName`, `HeadToHead` type, `headToHeadFor`, normalize back-fill |
| `src/components/duel-app.tsx` | record names on completion; `RivalryTally` component; wire into `SetupScreen` + `ResultsScreen` |
| `tests/duel-logic.test.mjs` | new test cases for normalization back-fill and `headToHeadFor` |

`src/components/use-duel-history.ts` likely needs **no change** — `recordResult` already accepts a whole `DuelRecord`, and types flow through.

### Proposed names and signatures

```ts
// src/lib/duel-logic.ts
export type DuelRecord = {
  at: string;
  topicSlug: string;
  mode: QuizMode;
  scores: [number, number];
  /** Display names at the time of the duel (index 0 = Player 1). */
  names: [string, string];
};

/** Matching key for a player name: trimmed + lowercased. Display keeps user casing. */
export function canonicalDuelName(raw: string): string;

export type HeadToHead = {
  /** Wins attributed to the CURRENT pair's index 0 / index 1. */
  wins: [number, number];
  ties: number;
  /** Total past duels between this pair (wins + ties). */
  total: number;
};

/**
 * Tally every stored result between exactly this pair of names,
 * order-insensitively (a reversed record has its scores swapped first).
 */
export function headToHeadFor(history: DuelHistory, names: [string, string]): HeadToHead;
```

```tsx
// src/components/duel-app.tsx (module-private, like ScoreChip)
function RivalryTally({ tally, names, justFinished }: {
  tally: HeadToHead;
  names: [string, string];
  justFinished?: boolean; // results-screen variant tweaks the lead-in copy
}): React.JSX.Element | null;
```

### UI copy / microcopy

- Setup, under the name inputs (only when `tally.total > 0`):
  - `⚔️ Alice 3 – 2 Bob` with ` · 1 tie` appended when `ties > 0`
  - sub-line: `Head-to-head on this device`
- Results screen, under the score chips:
  - `total === 1`: `First duel between Alice and Bob — the rivalry begins!`
  - otherwise: `Head-to-head: Alice 4 – 2 Bob` (+ ` · 1 tie` when applicable)
- Order the two sides so the **leader reads first** is tempting but adds swap-logic confusion — keep input order (Player 1 first), matching every other duel surface (`ScoreChip` rows). All copy is English UI text; no Chinese lines involved, so no pinyin obligations.

### Test plan (`tests/duel-logic.test.mjs`, `npm run test`)

1. `normalizeRecord`/`normalizeDuelHistory`: a legacy record without `names` survives and is back-filled from top-level `names`; junk name values become `""` then back-fill; over-long names are truncated to `DUEL_NAME_MAX_LENGTH`; a fully valid record round-trips unchanged.
2. `appendDuelRecord` still caps at `DUEL_HISTORY_LIMIT` with the new field present.
3. `headToHeadFor`:
   - empty history → `{wins: [0,0], ties: 0, total: 0}`
   - counts wins per index and ties for an exactly-matching pair
   - **reversed pair** (`["Bob","Alice"]` record vs `["Alice","Bob"]` query) matches with scores swapped
   - case/whitespace-insensitive matching (`" alice "` ≡ `"Alice"`)
   - records for a different pair (`["Charlie","Dana"]`) are excluded
   - identical canonical names on both sides fall back to ordered matching without double-counting
4. Existing duel state-machine tests must pass untouched.

### Manual QA checklist

- [ ] `npm run dev`, open `/duel` with a clean profile: no rivalry line on setup (no history yet).
- [ ] Enter names "Alice"/"Bob", finish a duel: results show the first-duel line; return to setup ("New duel") — rivalry line reads `Alice 1 – 0 Bob` (or tie).
- [ ] Play a rematch (loser starts): tally updates and attribution is correct despite the flipped first player.
- [ ] Swap the names into opposite inputs ("Bob" in Player 1): tally still finds the pair, with wins on the right sides.
- [ ] Change one name to "Charlie": rivalry line disappears (new pair, no history); finish a duel; switch back to "Alice"/"Bob" — the old tally is intact.
- [ ] Reload the page: names re-seed into the inputs and the tally persists (localStorage).
- [ ] Legacy data: in devtools, overwrite `learn-10-mandarin-duel-v1` with a pre-sprint payload (records without `names`); reload — no crash, old duels attributed to the stored name pair.
- [ ] DevTools → block storage (or private mode quirks): duel still plays; tally simply reflects in-memory session.
- [ ] Mobile width: rivalry line truncates gracefully with 12-char names.

### Acceptance criteria

1. Completing a duel stores the two display names on the result record under the existing `learn-10-mandarin-duel-v1` key; no new storage keys; `ProgressState` untouched.
2. Setup screen shows the current pair's live win record (wins–wins, ties, order-insensitive, case-insensitive) whenever that pair has at least one stored duel.
3. Results screen shows the updated head-to-head including the duel that just ended, with a distinct first-duel message.
4. Pre-sprint localStorage payloads load without error and their results are attributed to the remembered names.
5. `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build` all pass.

### Risk and rollback notes

- **Schema drift** is the main risk; it's contained by keeping `schemaVersion: 1` + the same key and making `names` tolerated-if-absent in `normalizeRecord`. **Downgrade is safe**: the current code's `normalizeRecord` rebuilds records from known fields only, so a rollback silently strips `names` and everything else keeps working.
- **Misattribution of legacy records** if a household had already changed names before this ships — accepted; the back-fill from top-level `names` is the best available evidence and only affects at most 20 records.
- Rollback = revert the single commit; no data migration needed either direction.

### Non-goals / deferrals

- No win-streak callouts ("Alice has won 3 straight") — good Sprint-14-adjacent follow-up.
- No multi-pair roster/leaderboard page, no per-topic or per-mode breakdown, no avatars/emoji per player.
- No inclusion of duel data in progress export/import (explicitly out, per the Sprint-10 design comment in `use-duel-history.ts`).
- No raising of `DUEL_HISTORY_LIMIT` (20 recent duels is plenty for a tally; note: the tally is therefore a *recent* record by design — call this out in code comments, not UI).
- No changes to duel gameplay, scoring, or the state machine.

### Ready-to-run Opus implementation prompt for Sprint 13

```text
Implement Sprint 13 of the "Learn 10 Mandarin Words" app (Next.js 16 / React 19 / Tailwind 4,
static/local-first, no backend): duel player names on stored results + a persistent
head-to-head win record for the pass-and-play duel at /duel.

Read AGENTS.md first — this Next.js version has breaking changes; consult
node_modules/next/dist/docs/ before touching any framework-level code (this sprint
shouldn't need to: it's one pure lib + one client component + tests).

Context (verified):
- src/lib/duel-logic.ts: pure duel state machine + storage schema. DuelHistory
  {schemaVersion:1, names:[string,string], results: DuelRecord[]}; DuelRecord
  {at, topicSlug, mode, scores:[number,number]}; helpers normalizeDuelHistory,
  appendDuelRecord, duelResult; constants DUEL_NAME_MAX_LENGTH=12, DUEL_HISTORY_LIMIT=20.
  Uses explicit `.ts` import extensions (Node native TS test runner).
- src/components/use-duel-history.ts: load/save hook on localStorage key
  "learn-10-mandarin-duel-v1". Deliberately separate from ProgressState — keep it that way.
- src/components/duel-app.tsx: setup/handoff/question/results screens. Name inputs
  exist and persist; a recordedRef-guarded effect records {at, topicSlug, mode, scores}
  on the done phase. scores[0] always belongs to Player 1 (rematch flips turn order,
  not score indices). ScoreChip is the existing chip primitive.
- tests/duel-logic.test.mjs: node --test suite importing ../src/lib/duel-logic.ts.

Tasks:
1. duel-logic.ts: add names:[string,string] to DuelRecord. normalizeRecord must accept
   legacy records without names (-> ["",""]) and cap present names at DUEL_NAME_MAX_LENGTH;
   normalizeDuelHistory back-fills both-empty record names from the top-level stored names.
   Keep schemaVersion 1 and the same storage key (additive change; rollback-safe).
2. duel-logic.ts: add canonicalDuelName(raw)=trim+lowercase (matching only), and
   headToHeadFor(history, names) -> {wins:[number,number], ties, total}. Match records
   order-insensitively (reversed pair => swap scores before tallying); if both canonical
   names are identical or empty, match by index order only. Win = higher score; tie = equal.
3. duel-app.tsx: include names: displayNames in the recordResult payload. Add a small
   module-private RivalryTally component (styled like ScoreChip: rounded-full, white/10
   borders, emerald accents). Render it (a) in the Players card on the setup screen,
   live from the typed names, only when total > 0, and (b) on the results screen under
   the score chips — the recording effect updates history first, so the tally shown
   includes the just-finished duel.
   Copy: "⚔️ Alice 3 – 2 Bob" + " · 1 tie" when ties>0; sub-line "Head-to-head on this
   device"; results first-duel variant: "First duel between Alice and Bob — the rivalry
   begins!"; otherwise "Head-to-head: Alice 4 – 2 Bob".
4. tests/duel-logic.test.mjs: cover legacy back-fill, name truncation, reversed-pair
   matching with swapped scores, case/whitespace-insensitive matching, non-matching pair
   exclusion, empty history zeros, identical-name ordered fallback, and that
   appendDuelRecord's cap still holds. Follow the file's existing identity-shuffle style.

Constraints: no new localStorage keys, no ProgressState coupling, no new deps, no backend,
match existing comment density and Tailwind idiom, keep the sprint scoped to these 3 files.

Validation gate (all must pass):
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build
```

---

I've explored the codebase — the existing `match-logic.ts` / `match-panel.tsx` pair, the scramble/cloze panel conventions, the flashcard 3D-flip CSS, the test style, and the topic-app tab wiring. Here is the plan.

# Sprint 14 — Memory flip game: face-down hanzi/English pair-matching grid per topic

## Goal and user value

Add a "Memory" tab to every topic page: a concentration-style game where all cards start face down, the learner flips two at a time, and a flip stays up only when a hanzi card and its English translation are found together. Unlike the existing Match tab (both columns always visible, pure recognition speed), Memory adds spatial recall and a low-stakes, playful pace — you can't lose, you just keep flipping. It reuses the topic's own 10 words, records only *positive* practice signals (a memory mismatch is positional luck, not lexical weakness), and persists nothing new beyond the existing localStorage progress paths.

## Current-state findings (grounded in actual files)

- **The visible-pairs match game already exists and is the closest sibling.** `src/lib/match-logic.ts` is a pure, DOM-free module: `buildMatchingRounds(items, keyFor, shuffle, roundSize=5)` chunks a topic into rounds of 5 pairs, and `selectTile()` is a synchronous never-mutating reducer returning `{ state, result }`. `src/components/topic/match-panel.tsx` holds only React state, a `MISMATCH_FLASH_MS = 350` timer (cleaned up in a `useEffect` return), a `busy` tap-block, and an `aria-live` announcement `<p role="status">`. The new memory game should mirror this exact split.
- **Tab wiring lives in `src/components/topic-app.tsx`.** The mode union at line 42 lists `"phrasebook" | "words" | ... | "boss"`; tabs render at lines 358–368 inside a horizontally scrollable `nav` (`tab-scroll` wrapper with right-edge fade), so a 10th tab needs no layout work. Panels render conditionally below; `MatchPanel` gets `onRecord={recordQuizAnswer}` and `onTakeQuiz={() => setMode("quiz")}` (line 453).
- **Progress recording is already centralized.** `recordQuizAnswer(key, correct)` from `useProgress` (`src/components/use-progress.ts`) feeds `quizStats` and `dailyActivity` (`src/lib/types.ts` lines 80–83, 126–132). `wordKey(topic, item)` from `src/lib/data-logic.ts:43` is the identity key everywhere.
- **Shuffle convention:** `defaultShuffle` in `src/lib/quiz-logic.ts:43`, always injectable so tests pass an identity shuffle. Logic modules import it with an explicit `.ts` extension (`./quiz-logic.ts`) so `node --test` resolves it — documented in the headers of both `match-logic.ts` and `scramble-logic.ts`.
- **Flip animation precedent exists.** `src/app/globals.css` (lines ~190–226) already ships a 3D flip (`.card-scene` / `.card-3d.is-flipped` / `.card-face` with `backface-visibility: hidden` and a Safari `translateZ(0)` nudge) for the flashcard deck, plus a `prefers-reduced-motion` block at the bottom of the file. The flashcard classes carry a `min-height: 280px` and heavy shadow, so Memory needs its own lighter variants, not reuse.
- **Reduced motion:** `src/components/use-reduced-motion.ts` exposes `useReducedMotion()` (hydration-safe `useSyncExternalStore`), used by the flashcard deck.
- **Pinyin on Chinese lines:** `TonePinyin` (`src/components/tone-pinyin.tsx`) renders pinyin with optional tone colors; Chinese text carries `lang={HANZI_LANG}` (`"zh-Hans"` from `src/lib/lang.ts:15`) and the `font-hanzi` class — see the match-panel tiles (lines 246–262) for the exact pattern.
- **Analytics:** `src/lib/analytics.ts` is a typed no-op choke point; `"matching_completed"` is in the `AnalyticsEvent` union, fired from the match panel on final-round completion. Memory needs a `"memory_completed"` member.
- **Test conventions:** `tests/match-logic.test.mjs` uses `node:test` + `assert/strict`, imports the `.ts` module directly, builds fake items via `makeItems(n)`, and pins order with an identity shuffle. `npm run test` is `node --test`.
- **Data shape:** topics have exactly 10 `VocabItem`s (`hanzi`, `pinyin`, `english`, `sentences`) in `src/data/topics.json`; no new vocabulary is needed or allowed.

## Exact implementation steps in sequence

1. **Create `src/lib/memory-logic.ts`** — pure, DOM-free, mirroring `match-logic.ts`:
   - Import `defaultShuffle` from `./quiz-logic.ts` (explicit `.ts` extension, same comment as siblings).
   - `buildMemoryRounds(items, keyFor, shuffle = defaultShuffle, roundSize = 5)`: chunk the shuffled items into rounds of 5 pairs; each round's `cards` array holds both the hanzi card and the english card for every pair, **shuffled together into one array** (unlike match-logic's two columns). Card `id` is `` `${side}:${key}` ``; hanzi cards also carry `pinyin` for the face-up render.
   - `initialMemoryState()` and a pure reducer `flipCard(state, card)` returning `{ state, result }` with results `"reveal" | "match" | "mismatch" | "ignored"`:
     - card's key already in `matchedKeys`, or card already face up, or two cards already face up (mismatch pending) → `"ignored"`, same state.
     - no face-up card → put it in `faceUp`, `"reveal"`.
     - one face-up card → `turns + 1`; same `key`, other side → `"match"` (append key to `matchedKeys`, clear `faceUp`); otherwise `"mismatch"` (keep **both** in `faceUp` so the panel can show them before flipping back).
   - `clearMismatch(state)`: empties `faceUp` (called by the panel's timer).
   - `isRoundComplete(state, round)`: `matchedKeys.length === round.pairs.length`.
2. **Add `"memory_completed"` to the `AnalyticsEvent` union** in `src/lib/analytics.ts`.
3. **Add Memory flip CSS to `src/app/globals.css`**, next to the flashcard flip block: `.memory-scene { perspective: 800px; }`, `.memory-card` (preserve-3d, `transition: transform 0.35s`), `.memory-card.is-up { transform: rotateY(180deg); }`, `.memory-face` / `.memory-face-front` (the face-down back) / `.memory-face-back` (the content) with `backface-visibility: hidden` and the `translateZ(0)` Safari nudge. Extend the existing `prefers-reduced-motion` block: `.memory-card { transition: none; }` so cards swap instantly.
4. **Create `src/components/topic/memory-panel.tsx`** (`"use client"`), modeled line-for-line on `match-panel.tsx`'s structure:
   - State: `rounds` (built once per mount/restart), `roundIndex`, `state` (from the reducer), cumulative `finished` totals, `busy` + `flipBackTimer` ref (cleared on unmount), `announcement` for the `aria-live` region.
   - `MISMATCH_SHOW_MS = 900` (longer than match's 350ms — the learner must *read* both cards to build memory). With `useReducedMotion()` true, keep the same delay but no rotation animation (CSS handles it).
   - On `"match"`: `onRecord(key, true)` — **positive-only**; never record `false` (rationale below), announce `Matched {english}`, fire `track("memory_completed", { topic, turns, pairs })` when the last round completes.
   - On `"mismatch"`: set `busy`, show both cards, after the timer call `clearMismatch` and unset `busy`.
   - Render: header row (`Round 1 of 2`, `3/5 pairs · 8 turns`), instruction line, then a `grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3` of card buttons. Face-down face shows a large `?` (aria-hidden) on the shared tile surface (`border-white/10 bg-white/[0.04]`); face-up hanzi cards show `font-hanzi` hanzi with `lang={HANZI_LANG}` plus a small `<TonePinyin>` line (`lang={PINYIN_LANG}`); face-up English cards show the translation. Matched cards stay face up at reduced opacity with `animate-quiz-correct`, `disabled`.
   - Accessibility: each card is a `<button>` with `aria-pressed` for face-up, `aria-label` of `"Face-down card"` when hidden and its label (+ `", matched"`) when up — hidden content must not leak to screen readers before the flip.
   - Between-rounds interstitial and final summary reuse the match panel's card layout and button styles verbatim (emerald `Play again`, outlined `Take the quiz` via `onTakeQuiz`), with a 🎉/💪 split on whether total turns equaled total pairs.
5. **Wire the tab in `src/components/topic-app.tsx`**: add `"memory"` to the mode union (line 42), import `MemoryPanel`, add `<Tab active={mode === "memory"} onClick={() => setMode("memory")}>Memory</Tab>` after the Match tab (line 365), and render `<MemoryPanel topic={topic} onRecord={recordQuizAnswer} onTakeQuiz={() => setMode("quiz")} />` after the match block (line 454).
6. **Create `tests/memory-logic.test.mjs`** mirroring `match-logic.test.mjs` (identity shuffle, `makeItems(n)` helper) — cases listed under Test plan.
7. **Run the full validation gate** and fix anything it surfaces.

**Why positive-only recording:** the match panel records misses because a visible-pairs mismatch is a vocabulary error. In concentration, early mismatches are unavoidable chance, so feeding them into `quizStats` would wrongly flag words as "tricky" on `/stats` and in `/practice`. Recording `onRecord(key, true)` once per matched pair keeps `correct ≤ attempts` valid, feeds `dailyActivity` (streaks/goal ring) — and needs no schema change.

## Likely files touched

| File | Change |
|---|---|
| `src/lib/memory-logic.ts` | **new** — pure round-builder + flip reducer |
| `src/components/topic/memory-panel.tsx` | **new** — the Memory tab panel |
| `src/components/topic-app.tsx` | mode union, import, tab, panel render |
| `src/app/globals.css` | memory flip classes + reduced-motion override |
| `src/lib/analytics.ts` | add `"memory_completed"` |
| `tests/memory-logic.test.mjs` | **new** — reducer/builder unit tests |

No changes to `src/lib/types.ts`, `progress-logic.ts`, or `topics.json` — no schema bump.

## Proposed names and TypeScript signatures

```ts
// src/lib/memory-logic.ts
export type MemoryCard = {
  id: string;                       // `${side}:${key}` — unique per round
  key: string;                      // wordKey (`topic.slug:hanzi`)
  side: "hanzi" | "english";
  label: string;                    // hanzi or english text
  pinyin?: string;                  // set on hanzi cards only
};

export type MemoryRound = {
  pairs: { key: string; hanzi: string; pinyin: string; english: string }[];
  cards: MemoryCard[];              // both sides, shuffled into ONE array
};

export type MemoryState = {
  faceUp: MemoryCard[];             // 0, 1, or 2 (2 = mismatch showing)
  matchedKeys: string[];
  turns: number;                    // completed two-card flips
};

export type MemoryOutcome = {
  state: MemoryState;
  result: "reveal" | "match" | "mismatch" | "ignored";
};

export function buildMemoryRounds(
  items: VocabItem[],
  keyFor: (i: VocabItem) => string,
  shuffle?: <T>(x: T[]) => T[],
  roundSize?: number,               // default 5 → 10 cards/round, 2 rounds/topic
): MemoryRound[];

export function initialMemoryState(): MemoryState;
export function flipCard(state: MemoryState, card: MemoryCard): MemoryOutcome;
export function clearMismatch(state: MemoryState): MemoryState;
export function isRoundComplete(state: MemoryState, round: MemoryRound): boolean;
```

```tsx
// src/components/topic/memory-panel.tsx
export function MemoryPanel(props: {
  topic: Topic;
  onRecord: (key: string, correct: boolean) => void;
  onTakeQuiz: () => void;
}): React.JSX.Element | null;

const MISMATCH_SHOW_MS = 900;
```

## UI copy / microcopy

- Tab label: **Memory**
- Header: `Round 1 of 2` · `3/5 pairs · 8 turns`
- Instruction: **“Flip two cards to find a word and its meaning.”**
- Face-down card content: `?` (aria-hidden); `aria-label="Face-down card"`
- Announcements (aria-live, matching the Match tab’s voice): `Matched {english}` / `Not a match`
- Round interstitial: `Round 1 done` · `{turns} turns` · button `Round 2`
- Final summary, perfect (total turns === total pairs): 🎉 **“Incredible memory!”** · `{turns} turns · every pair first try`
- Final summary, normal: 🎉 **“All pairs found!”** · `{turns} turns · {pairs} pairs`
- Buttons: `Play again` (emerald pill) · `Take the quiz` (outline pill)

## Test plan (`tests/memory-logic.test.mjs`)

All with the identity shuffle and `makeItems(n)`, per the house style:

1. `buildMemoryRounds` splits 10 items into 2 rounds; each round has 5 pairs and **10 cards** (5 hanzi + 5 english), every pair represented once per side; hanzi cards carry `pinyin`, english cards don't; ids are `side:key` and unique.
2. Tolerates non-10 counts (7 items → rounds of 5 and 2 pairs).
3. `flipCard` on empty state → `"reveal"`, card in `faceUp`, `turns` unchanged.
4. Second flip, same key, other side → `"match"`: key appended to `matchedKeys`, `faceUp` cleared, `turns + 1`.
5. Second flip, different key → `"mismatch"`: **both** cards remain in `faceUp`, `turns + 1`, `matchedKeys` unchanged; `clearMismatch` then empties `faceUp` without touching counts.
6. Ignored cases return the same state object: re-flipping the already-face-up card; flipping a matched card; any flip while two cards are face up.
7. Purity: input state is never mutated (deep-compare before/after).
8. Full-round walkthrough: matching all 5 pairs in order yields `isRoundComplete === true` and `turns === 5`.

Plus the existing suites must stay green (`npm run test` runs everything under `tests/`).

## Manual QA checklist

- [ ] Open any topic → **Memory** tab appears after Match; tab strip still scrolls cleanly at 360px width.
- [ ] All 10 cards start face down showing `?`; no hanzi/English visible in the DOM accessibility name before flipping.
- [ ] Flip two non-matching cards: both stay visible ~0.9s, then flip back; taps during that window do nothing.
- [ ] Flip a hanzi card: pinyin shows under the hanzi (and recolors when the Tone-colors toggle is on).
- [ ] Match a pair: cards stay up, dim, pop animation plays; pair counter increments.
- [ ] Clear round 1 → interstitial → Round 2 → final summary with turns count; `Play again` reshuffles; `Take the quiz` switches tabs.
- [ ] Match a few pairs, then check `/stats`: no word from the memory game appears in “Trickiest words”; daily-goal ring credits the practiced words.
- [ ] OS reduced-motion on: cards swap faces instantly, mismatch pause still readable.
- [ ] Keyboard-only: tab through cards, flip with Enter/Space, hear aria-live announcements (VoiceOver/NVDA spot check).
- [ ] Mobile Safari spot check: no backface flicker (translateZ nudge applied).

## Acceptance criteria

1. Every topic page has a Memory tab with a face-down grid built from that topic's own 10 words — no new vocabulary or data.
2. Game rules: two flips per turn, pairs lock face up, mismatches flip back after a visible pause; two rounds of 5 pairs; completion screen with turn count and replay.
3. Matched pairs record `recordQuizAnswer(key, true)` once each; mismatches record nothing; no `ProgressState` schema change.
4. Hanzi faces carry `lang="zh-Hans"`, `font-hanzi`, and a pinyin line via `TonePinyin`.
5. Reduced-motion users get instant face swaps; card buttons are keyboard-operable with correct aria labels and live announcements.
6. `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build` all pass.

## Risk and rollback notes

- **Risk: stat pollution.** Mitigated by positive-only recording; if even that skews accuracy displays, dropping the `onRecord` call is a one-line rollback with no data migration.
- **Risk: timer/interaction races** (third tap during the mismatch window, unmount mid-flash). Mitigated by the reducer's `"ignored"` result for a full `faceUp`, the `busy` guard, and clearing the timer in the `useEffect` cleanup — the exact pattern already proven in `match-panel.tsx`.
- **Risk: 3D-flip rendering quirks on iOS Safari.** Copy the flashcard deck's known-good CSS recipe (`backface-visibility` + `translateZ(0)`).
- **Rollback:** the feature is a leaf — delete the two new files, revert the ~6-line `topic-app.tsx` diff, the CSS block, the analytics union member, and the test file. Nothing persisted needs cleanup.

## Non-goals / deferrals

- No hanzi↔pinyin or audio↔hanzi memory variants (future sprint could add a mode chip).
- No best-turns persistence, leaderboard, or new localStorage keys/schema bump.
- No cross-topic or category-wide memory decks.
- No sounds/haptics; no changes to the existing Match tab.
- No standalone `/memory` route — this lives inside the topic page like every other drill.

## Ready-to-run Opus implementation prompt for Sprint 14

```text
You are implementing Sprint 14 of "Learn 10 Mandarin Words" (Next.js 16 / React 19 / Tailwind 4, static + localStorage-only). Read AGENTS.md first: this Next.js version has breaking changes — consult node_modules/next/dist/docs/ before using any framework API (this sprint is client-component-only, so framework risk is low).

TASK: Add a concentration-style "Memory" flip game tab to every topic page: all cards face down, flip two per turn, a hanzi card and its English card lock face-up when matched. Two rounds of 5 pairs per 10-word topic.

STUDY THESE FILES FIRST and mirror their conventions exactly:
- src/lib/match-logic.ts + tests/match-logic.test.mjs — pure logic module + reducer + identity-shuffle tests; note the `./quiz-logic.ts` explicit-extension import comment.
- src/components/topic/match-panel.tsx — panel structure: mismatch timer with cleanup, busy guard, aria-live status, interstitial + summary screens, tile styling, HANZI_LANG usage.
- src/components/topic-app.tsx lines 42, 358–368, 451–454 — mode union, Tab strip, panel wiring (onRecord={recordQuizAnswer}, onTakeQuiz).
- src/app/globals.css flashcard flip block (~lines 190–226) and the prefers-reduced-motion block.
- src/components/tone-pinyin.tsx, src/lib/lang.ts, src/components/use-reduced-motion.ts.

BUILD:
1. src/lib/memory-logic.ts (pure, DOM-free, injectable shuffle defaulting to defaultShuffle from ./quiz-logic.ts):
   - MemoryCard { id: `${side}:${key}`, key, side: "hanzi"|"english", label, pinyin? (hanzi cards only) }
   - MemoryRound { pairs: {key,hanzi,pinyin,english}[], cards: MemoryCard[] } — cards = both sides of each pair shuffled into ONE array.
   - buildMemoryRounds(items, keyFor, shuffle=defaultShuffle, roundSize=5)
   - initialMemoryState(): { faceUp: MemoryCard[], matchedKeys: string[], turns: number }
   - flipCard(state, card) → { state, result: "reveal"|"match"|"mismatch"|"ignored" }, pure/never-mutating:
     ignored: card's key matched, card already face up, or faceUp.length === 2.
     reveal: faceUp empty → add card.
     match: second card, same key, other side → matchedKeys+key, faceUp cleared, turns+1.
     mismatch: second card, different key → BOTH stay in faceUp, turns+1.
   - clearMismatch(state) → faceUp cleared; isRoundComplete(state, round).
2. src/components/topic/memory-panel.tsx ("use client"): MemoryPanel({ topic, onRecord, onTakeQuiz }). Rounds built once per mount/restart. MISMATCH_SHOW_MS = 900 with a cleaned-up timer + busy guard. On match call onRecord(key, true); NEVER record false (memory misses are positional chance, not vocab errors — keep them out of quizStats). Grid: grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3; face-down face shows aria-hidden "?"; face-up hanzi face: font-hanzi + lang from HANZI_LANG + small TonePinyin line (lang PINYIN_LANG); matched cards stay up, dimmed, disabled, animate-quiz-correct. Buttons carry aria-pressed and aria-label "Face-down card" until revealed (content must not leak to AT while hidden). aria-live status announces "Matched {english}" / "Not a match". Header: "Round 1 of 2" + "{matched}/{pairs} pairs · {turns} turns"; instruction "Flip two cards to find a word and its meaning." Interstitial ("Round 1 done", button "Round 2") and final summary (🎉 "All pairs found!" / perfect-run "Incredible memory!" when total turns === total pairs; "Play again" emerald pill + "Take the quiz" outline pill) styled exactly like match-panel's. Fire track("memory_completed", { topic: topic.slug, turns, pairs }) once on final completion.
3. globals.css: .memory-scene/.memory-card/.is-up/.memory-face(+front/back) 3D flip (perspective, preserve-3d, backface-visibility hidden, translateZ(0) Safari nudge, 0.35s transition); extend the existing prefers-reduced-motion block so .memory-card gets transition: none.
4. src/lib/analytics.ts: add "memory_completed" to AnalyticsEvent.
5. src/components/topic-app.tsx: add "memory" to the mode union, import MemoryPanel, add <Tab>Memory</Tab> right after Match, render <MemoryPanel topic={topic} onRecord={recordQuizAnswer} onTakeQuiz={() => setMode("quiz")} /> after the match block.
6. tests/memory-logic.test.mjs (node:test + assert/strict, identity shuffle, makeItems helper like tests/match-logic.test.mjs): round shape for 10 and 7 items; reveal/match/mismatch/ignored transitions; clearMismatch; state purity; full-round walkthrough (5 in-order matches → complete, turns === 5).

CONSTRAINTS: No new dependencies, routes, localStorage keys, or ProgressState schema changes. No invented vocabulary — only topic.items. Pinyin must appear on hanzi card faces. Do not modify match-logic/match-panel.

VALIDATION GATE (all must pass; fix failures before finishing):
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build
```

---

All the groundwork is mapped. One important finding shapes this sprint: the past week's **words practiced** (`dailyActivity`, 14-day retention) and **streak** (`studiedDates`) are already persisted, but **per-week accuracy is not derivable** — `quizStats` is all-time only. The plan below adds a tiny schema v8 per-day quiz tally following the exact v4 `dailyActivity` precedent, then reuses the entire sprint-6 share-card stack (`share-card-logic.ts`, `share-card-canvas.ts`, `ShareScoreButton`) with a fourth card variant.

## Sprint 15 — Weekly recap share card: words practiced, accuracy, and streak for the past week

### Goal and user value

Give learners a week-level shareable milestone: a "This week" section on `/stats` with a one-tap share card summarizing the trailing 7 days — distinct words practiced, quiz accuracy, days active (as a 7-dot row), and current streak. It reuses the existing on-device canvas + Web Share → clipboard → download ladder, so nothing is uploaded unless the user shares it. Beyond single-session score cards (practice/review) and the all-time stats card, this is the satisfying "look what I did this week" artifact the backlog calls for.

### Current-state findings (grounded in actual files)

**Share-card stack (Sprint 6) is fully reusable:**
- `src/lib/share-card-logic.ts` — pure, DOM-free layer. `ShareCardData` is a discriminated union with three variants (`stats` | `practice` | `review`), plus `shareTitle()`, `buildShareText(data, siteHost)`, `scoreEmojiBar()`, `wrapText()`, and the `SHARE_CARD_COLORS` / 1080×1350 constants. Unit-tested in `tests/share-card-logic.test.mjs`. Adding a variant means extending the union and the two text functions.
- `src/lib/share-card-canvas.ts` — client-only renderer. `renderShareCard(data, {toneColors})` draws brand eyebrow → headline (`shareTitle`) → big numeral (`bigNumeral()` at line 119, a per-variant switch) → featured words (`featuredWords()` at line 135) → footer. Delivery ladder: `deliverShareCard()`, `copyImage()`, `downloadImage()`, plus capability probes. All extension points are small local functions.
- `src/components/share-score-button.tsx` — the trigger + preview dialog. `type Surface = "stats" | "practice" | "review"` (line 21), label switch at line 69, and `hasSomethingToShare()` (line 38) gates rendering. Fires `track("score_card_shared", { surface, method })`.

**Weekly data availability:**
- Words practiced per day: `progress.dailyActivity` (`Record<ISO day, wordKey[]>`, deduped per day, pruned to `DAILY_ACTIVITY_RETENTION_DAYS = 14` in `src/lib/progress-logic.ts:55`) — comfortably covers a 7-day window. Written by `withPractice()` in `src/components/use-progress.ts:37`, which every quiz answer and flashcard grade flows through.
- Streak: `computeStreak(studiedDates, today)` at `src/lib/progress-logic.ts:292`, UTC-day convention via `todayISO()`. `studiedDates` is full history.
- Days active: `studiedDates` membership per day. Note the heatmap's documented caveat (`src/lib/heatmap-logic.ts:73-77`): a day can be in `studiedDates` without a `dailyActivity` entry (e.g. `toggleLearnedTopic` stamps only `recordStudyToday`). So "active day" must read `studiedDates`, not `dailyActivity` keys.
- **Accuracy for the past week: not currently persisted.** `quizStats` (`Record<wordKey, {correct, attempts}>`, schema v3) is all-time with no timestamps. `dailyChallenge` has per-day score/total but covers only Daily Challenge runs — misleading as "weekly accuracy". A minimal schema bump is needed.
- The schema-migration machinery is well-established: `CURRENT_PROGRESS_SCHEMA_VERSION = 7` with a documented v-history (`progress-logic.ts:24-36`), `normalizeProgress()` as the single never-throws entry point, and per-field `normalize*` + pure `record*` helpers (e.g. `normalizeDailyActivity`/`recordDailyPractice` for v4, `normalizeDailyChallenge`/`recordDailyChallenge` for v5). `recordQuizAnswer` in `use-progress.ts:118` is the single choke point for every quiz-style answer across quiz, typing, match, cloze, scramble, tone trainer, boss, lightning, daily, and practice surfaces (verified by grep — all call `recordQuizAnswer` or pass it as `onRecord`).
- Deterministic date formatting precedent: `heatmap-logic.ts` hardcodes `MONTH_NAMES` to stay locale-independent; reuse that idiom for the week label.
- `/stats` UI: `src/components/stats-app.tsx` header already hosts the stats `ShareScoreButton` (line 131); sections follow a consistent `<section className="mt-10">` pattern.
- Tests: `node --test` over `tests/*.test.mjs`, importing pure modules directly from `../src/lib/*.ts` (value imports inside `src/lib` use explicit `.ts` extensions for Node's TS runner — see the header comments in `progress-logic.ts` and `share-card-logic.ts`).

### Exact implementation steps in sequence

1. **Schema v8 — per-day quiz tally** (`src/lib/types.ts`, `src/lib/progress-logic.ts`):
   - Add `dailyQuiz: Record<string, QuizStat>` to `ProgressState` (ISO day → `{correct, attempts}`), reusing the existing `QuizStat` type.
   - Bump `CURRENT_PROGRESS_SCHEMA_VERSION` to 8 with a v7→v8 history comment ("older saves lack the field and migrate to an empty `{}`, losing nothing else").
   - Add `DAILY_QUIZ_RETENTION_DAYS = 14` (matches `dailyActivity`; a 7-day window needs at most 7).
   - Add `normalizeDailyQuiz(raw)` mirroring `normalizeDailyActivity` + `normalizeQuizStat` (drop bad day keys/values, enforce `correct ≤ attempts`, prune to retention). Wire into `emptyProgress` and `normalizeProgress`.
   - Add pure `recordDailyQuizAnswer(map, day, correct)` mirroring `recordDailyPractice` (increment today's tally, prune, never mutate input).
2. **Hook wiring** (`src/components/use-progress.ts`): in `recordQuizAnswer`, additionally set `dailyQuiz: recordDailyQuizAnswer(current.dailyQuiz, todayISO(), correct)`. No other action changes (`gradeWord` deliberately excluded — accuracy is the quiz signal, same as Trickiest words).
3. **New pure module** `src/lib/weekly-recap-logic.ts`: `computeWeeklyRecap(progress, endDay = todayISO())` derives the trailing-7-UTC-day window (endDay inclusive) — distinct words practiced (union of `dailyActivity` day sets), `dayFlags` (oldest→newest from `studiedDates`), `activeDays`, summed `correct`/`attempts` from `dailyQuiz` with `accuracy: null` when `attempts === 0`, `streak` via `computeStreak`, and a deterministic `weekLabel` ("Jun 30 – Jul 6") using a hardcoded month-name table (heatmap idiom). Use `.ts`-extension value imports; never throws on corrupt input.
4. **Card variant** (`src/lib/share-card-logic.ts`): add `{ kind: "weekly"; ... }` to `ShareCardData`; extend `shareTitle` with tiered weekly headlines and `buildShareText` with the weekly body (copy below). `scoreFraction` returns 0 for weekly (like stats).
5. **Canvas** (`src/lib/share-card-canvas.ts`): extend `bigNumeral` (value = words practiced, caption "words this week"); `featuredWords` returns `[]` for weekly. Add a small weekly-only block under the numeral: a centered row of 7 dots (filled `accent` when active, hairline `border` circle when not, drawn with `arc()`), weekday letters beneath in `inkLow`, then one `inkMid` stat line ("92% quiz accuracy · 5/7 days active", accuracy segment omitted when `null`) and the `weekLabel` in `inkLow`. No hanzi on this card, so the pinyin rule is untouched.
6. **Button** (`src/components/share-score-button.tsx`): extend `Surface` with `"weekly"`, label "Share weekly recap 📅", and `hasSomethingToShare` → `wordsPracticed > 0 || activeDays > 0`. Analytics stays `score_card_shared` with the new surface value.
7. **Stats page** (`src/components/stats-app.tsx`): add a "This week" `<section className="mt-10">` between the stat grid and the heatmap: a `bg-surface` card showing the four numbers + the 7-dot row (small JSX version) and the weekly `ShareScoreButton` (`data` from a memoized `computeWeeklyRecap(progress)`). Section renders always; the share button hides itself on an empty week.
8. **Tests**: new `tests/weekly-recap-logic.test.mjs`; extend `tests/progress-logic.test.mjs` (v8 migration, `normalizeDailyQuiz`, `recordDailyQuizAnswer`) and `tests/share-card-logic.test.mjs` (weekly `shareTitle` tiers, `buildShareText` shape).
9. Run the full validation gate.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/types.ts` | `dailyQuiz` field on `ProgressState` |
| `src/lib/progress-logic.ts` | v8 bump, `normalizeDailyQuiz`, `recordDailyQuizAnswer`, retention const |
| `src/components/use-progress.ts` | `recordQuizAnswer` writes `dailyQuiz` |
| `src/lib/weekly-recap-logic.ts` | **new** — pure weekly derivation |
| `src/lib/share-card-logic.ts` | `weekly` variant, `shareTitle`, `buildShareText` |
| `src/lib/share-card-canvas.ts` | `bigNumeral`, dot row + stat line for weekly |
| `src/components/share-score-button.tsx` | `Surface`, label, `hasSomethingToShare` |
| `src/components/stats-app.tsx` | "This week" section + weekly share button |
| `tests/weekly-recap-logic.test.mjs` | **new** |
| `tests/progress-logic.test.mjs`, `tests/share-card-logic.test.mjs` | added cases |

### Proposed names and signatures

```ts
// src/lib/progress-logic.ts
export const DAILY_QUIZ_RETENTION_DAYS = 14;
export function normalizeDailyQuiz(raw: unknown): Record<string, QuizStat>;
export function recordDailyQuizAnswer(
  map: Record<string, QuizStat> | undefined, day: string, correct: boolean,
): Record<string, QuizStat>;

// src/lib/weekly-recap-logic.ts
export const RECAP_WINDOW_DAYS = 7;
export type WeeklyRecap = {
  wordsPracticed: number;   // distinct wordKeys across the window
  activeDays: number;       // 0–7, from studiedDates
  dayFlags: boolean[];      // length 7, oldest → newest (endDay last)
  correct: number;
  attempts: number;
  accuracy: number | null;  // correct/attempts in [0,1]; null when attempts === 0
  streak: number;           // computeStreak(studiedDates, endDay)
  weekLabel: string;        // "Jun 30 – Jul 6" (deterministic, UTC)
};
export function computeWeeklyRecap(progress: ProgressState, endDay?: string): WeeklyRecap;

// src/lib/share-card-logic.ts — new union member
| {
    kind: "weekly";
    wordsPracticed: number;
    activeDays: number;
    dayFlags: boolean[];
    accuracy: number | null;
    streak: number;
    weekLabel: string;
  }
```

The stats-app section can be a local `ThisWeekCard({ recap, data }: { recap: WeeklyRecap; data: ShareCardData })` alongside the existing local `StatCard`/`GoalCard` components.

### UI copy / microcopy

- Section heading: **This week** · sub-line: "Your last 7 days, computed on this device. Share it as a card."
- Share button: **Share weekly recap 📅**
- Card headline tiers (`shareTitle`): `activeDays === 7` → "Perfect week 🎉" · `activeDays >= 4` → "Strong week 💪" · otherwise → "A week in motion 🌱"
- Big numeral caption: "words this week"
- Stat line: `92% quiz accuracy · 5/7 days active` (accuracy segment dropped when `null` → `5/7 days active`); streak echoed as `🔥 5-day streak` when `> 0`
- Text snippet (`buildShareText`):
  ```
  🀄 Learn 10 Mandarin Words
  A week in motion 🌱 (Jun 30 – Jul 6)
  23 words · 92% quiz accuracy · 5/7 days active
  🔥 5-day streak
  learn-10-mandarin-words.vercel.app
  ```
- Accuracy footnote in the section (since old saves start empty): "Quiz accuracy counts answers from this week on this device."

### Test plan (`node --test`, existing conventions)

- `weekly-recap-logic.test.mjs`: window boundaries (day exactly 7 back excluded, endDay included); dedup of the same wordKey across multiple days; `activeDays` counts a `studiedDates` day that has no `dailyActivity` entry; `accuracy === null` with zero attempts vs. correct fraction otherwise; `dayFlags` length 7 and order; `weekLabel` across a month boundary; empty/corrupt progress → all-zeros recap, never throws; injectable `endDay` determinism.
- `progress-logic.test.mjs` additions: v7 save (no `dailyQuiz`) normalizes to `{}` and stamps version 8; `normalizeDailyQuiz` drops junk keys/values and enforces `correct ≤ attempts`; `recordDailyQuizAnswer` increments, prunes past 14 days, never mutates input.
- `share-card-logic.test.mjs` additions: weekly `shareTitle` tier boundaries (7 / 4 / 1 active days); `buildShareText` includes words · accuracy · days line, omits accuracy when null, ends with host; pinyin-rule tests untouched (no words on the weekly card).

### Manual QA checklist

- [ ] Fresh profile: `/stats` shows "This week" with zeros; share button hidden.
- [ ] Answer a few topic-quiz questions → words/accuracy/dot-for-today update; button appears.
- [ ] Deliberately miss some answers → accuracy reflects misses (matches `correct/attempts`).
- [ ] Open the dialog: preview renders (dots, numeral, stat line, week label); Share / Copy image / Copy text / Save PNG all work per browser capability; Escape and focus trap still work.
- [ ] Import a pre-sprint progress export → no crash; accuracy shows the days-only line until new answers land.
- [ ] Grade flashcards only (no quiz): day dot lights and words count, accuracy stays days-only — as documented.
- [ ] Reload → `dailyQuiz` persisted in `learn-10-mandarin-progress-v1`, `schemaVersion: 8`.
- [ ] Mobile viewport: section layout and dialog unaffected.

### Acceptance criteria

1. `/stats` has a "This week" section with words practiced, quiz accuracy (or days-only fallback), active days, and streak for the trailing 7 UTC days.
2. "Share weekly recap 📅" produces a 1080×1350 card via the existing dialog with headline tier, big words-count numeral, 7-dot day row, stat line, week label, brand + host footer — fully on-device.
3. `recordQuizAnswer` persists a per-day accuracy tally (schema v8) with 14-day pruning; older saves migrate losslessly via `normalizeProgress`.
4. Empty week hides the share button; zero-attempt weeks never render "NaN%" anywhere.
5. Full gate passes: `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build`.

### Risk and rollback notes

- **Schema bump** is the main risk; it follows the v4/v5 pattern exactly and `normalizeProgress` is additive (`dailyQuiz` absent → `{}`), so old exports/imports keep working. Rollback: the whole feature is additive — revert the commit; a v8 save read by v7 code would be fine anyway since `normalizeProgress` ignores unknown fields and re-stamps the version.
- **First-week accuracy is partial** (tally starts at ship). Mitigated by the `null` → days-only fallback and the footnote copy; self-heals within 7 days of use.
- **Canvas drawing** risk is low: the weekly card adds only `arc()` dots and text — no new fonts beyond what `ensureFonts` already loads; tofu risk is nil since the card renders no hanzi.
- UTC-day convention matches streak/heatmap, so no new timezone drift is introduced.

### Non-goals / deferrals

- No calendar-week (Mon–Sun) alignment or week picker — trailing 7 days only.
- No historical recaps ("3 weeks ago") and no auto-prompt ("your recap is ready") — deferred.
- No per-day accuracy chart on `/stats`; the dot row is presence-only.
- No flashcard-grade accuracy blending; accuracy = quiz-signal only, consistent with Trickiest words.
- No OG/route-based image generation — the card stays a client-side canvas like sprint 6.

### Ready-to-run Opus implementation prompt for Sprint 15

```text
Implement Sprint 15 of learn-10-mandarin-words (Next.js 16 / React 19 / Tailwind 4, static
local-first): a weekly recap share card (words practiced, quiz accuracy, active days, streak
for the trailing 7 UTC days) on /stats, reusing the Sprint-6 share-card stack. Read
AGENTS.md first and the Next.js docs under node_modules/next/dist/docs/ if any framework
question arises. No backend, no new packages, no external APIs, no invented vocabulary.

1) Schema v8 — per-day quiz tally:
   - src/lib/types.ts: add `dailyQuiz: Record<string, QuizStat>` to ProgressState (ISO day
     "YYYY-MM-DD" → {correct, attempts}), with a doc comment matching the dailyActivity style.
   - src/lib/progress-logic.ts: bump CURRENT_PROGRESS_SCHEMA_VERSION to 8 and document
     v7→v8 in the version-history comment ("older saves lack the field and migrate to an
     empty {}, losing nothing else"). Add DAILY_QUIZ_RETENTION_DAYS = 14. Add
     normalizeDailyQuiz(raw: unknown): Record<string, QuizStat> mirroring
     normalizeDailyActivity (drop invalid ISO day keys and non-object values, coerce via the
     normalizeQuizStat invariants, prune to newest 14 day-keys, never throw). Add pure
     recordDailyQuizAnswer(map, day, correct): returns a NEW map incrementing that day's
     {correct, attempts}, pruning to retention, never mutating input — mirror
     recordDailyPractice. Wire dailyQuiz into emptyProgress and normalizeProgress.
   - src/components/use-progress.ts: in recordQuizAnswer, also set
     dailyQuiz: recordDailyQuizAnswer(current.dailyQuiz, todayISO(), correct).
     Do NOT touch gradeWord (accuracy is the quiz signal, same as Trickiest words).

2) New pure module src/lib/weekly-recap-logic.ts (DOM-free, value imports with explicit .ts
   extensions like heatmap-logic.ts; header comment explaining what it reads):
   export const RECAP_WINDOW_DAYS = 7;
   export type WeeklyRecap = { wordsPracticed; activeDays; dayFlags: boolean[]; correct;
     attempts; accuracy: number | null; streak; weekLabel: string };
   export function computeWeeklyRecap(progress: ProgressState, endDay = todayISO()): WeeklyRecap.
   Window = 7 UTC days ending at endDay inclusive. wordsPracticed = size of the union of
   dailyActivity wordKey sets in-window. dayFlags/activeDays from studiedDates membership
   (a studiedDates day with no dailyActivity entry still counts — same caveat heatmap-logic
   documents). correct/attempts summed from dailyQuiz in-window via normalizeQuizStat;
   accuracy = correct/attempts or null when attempts === 0. streak =
   computeStreak(studiedDates, endDay). weekLabel like "Jun 30 – Jul 6" using a hardcoded
   month-name table (heatmap-logic idiom — deterministic, locale-independent). Never throw
   on corrupt/empty input.

3) src/lib/share-card-logic.ts: add a fourth ShareCardData variant
   { kind: "weekly"; wordsPracticed; activeDays; dayFlags: boolean[]; accuracy: number|null;
     streak; weekLabel } . shareTitle weekly tiers: activeDays === 7 → "Perfect week 🎉",
   >= 4 → "Strong week 💪", else "A week in motion 🌱". scoreFraction returns 0 for weekly.
   buildShareText weekly body: title+" ("+weekLabel+")", then
   "<words> words · <pct>% quiz accuracy · <activeDays>/7 days active" (omit the accuracy
   segment when null), then "🔥 <streak>-day streak" only when streak > 0, then siteHost.
   Guard all numbers with the existing clampInt so NaN can never render.

4) src/lib/share-card-canvas.ts: extend bigNumeral (weekly → value = wordsPracticed,
   caption "words this week") and featuredWords (weekly → []). For kind === "weekly" only,
   draw under the caption: a centered row of 7 circles from dayFlags (filled
   SHARE_CARD_COLORS.accent when active; 2px SHARE_CARD_COLORS.border stroke when not),
   single-letter weekday labels beneath in inkLow (derive letters from the window's UTC
   weekdays), then one inkMid stat line ("92% quiz accuracy · 5/7 days active", days-only
   when accuracy is null; append " · 🔥 N-day streak" when streak > 0), then weekLabel in
   inkLow. No hanzi on this card, so no new font loads are needed.

5) src/components/share-score-button.tsx: extend Surface with "weekly", label
   "Share weekly recap 📅", hasSomethingToShare for weekly = wordsPracticed > 0 ||
   activeDays > 0. Everything else (dialog, ladder, track("score_card_shared")) unchanged.

6) src/components/stats-app.tsx: add a "This week" <section className="mt-10"> between the
   stat grid and the Study activity heatmap. Inside a rounded-2xl border-white/10 bg-surface
   card (match existing StatCard styling): the four figures (words, accuracy or "—",
   active days, streak), a small JSX 7-dot row mirroring dayFlags, the weekly
   ShareScoreButton fed from a useMemo computeWeeklyRecap(progress), and the footnote
   "Quiz accuracy counts answers from this week on this device." Section always renders;
   the button hides itself on an empty week. Copy: heading "This week", sub-line
   "Your last 7 days, computed on this device. Share it as a card."

7) Tests (node --test, .mjs files importing ../src/lib/*.ts like the existing suites):
   - NEW tests/weekly-recap-logic.test.mjs: window boundary in/out, cross-day wordKey dedup,
     studiedDates-only day counts as active, accuracy null at zero attempts, dayFlags
     length/order, weekLabel across a month boundary, corrupt/empty progress never throws,
     injectable endDay determinism.
   - tests/progress-logic.test.mjs: v7 save without dailyQuiz migrates to {} at version 8;
     normalizeDailyQuiz drops junk and enforces correct ≤ attempts; recordDailyQuizAnswer
     increments, prunes past 14 days, and never mutates its input.
   - tests/share-card-logic.test.mjs: weekly shareTitle tier boundaries; weekly
     buildShareText contains the words/accuracy/days line, omits accuracy when null, omits
     the streak line at streak 0, and ends with the host.

Keep comment density/style consistent with neighboring files (each existing lib file opens
with a purpose comment). Do not rename or refactor existing exports. Validation gate — all
must pass before you're done:
  npm run test
  npm run validate:data
  npm run validate:quality
  npm run lint
  npm run build
```

---

# Sprint 16 — Light theme option: manual light/dark toggle persisted in localStorage

## Goal and user value

Add a manual light/dark toggle so daytime and outdoor mobile study is comfortable. Dark stays the default brand experience; light is a device-local opt-in persisted in `localStorage`, applied before first paint (no flash), synced across tabs, and covering every route — with pinyin tone colors re-tuned so the pedagogical color channel stays ≥4.5:1 readable on a light ground.

## Current-state findings (grounded in actual files)

**Theming architecture.** `src/app/globals.css` already has a real token layer: `:root` defines `--background: #020617` / `--foreground: #f8fafc`, and a Tailwind 4 `@theme inline` block defines semantic tokens — surfaces (`--color-surface: #0d1220`, `--color-surface-2`, `--color-surface-hover`, `--color-surface-accent`), borders (`--color-border`, `--color-border-strong`), the ink ladder (`--color-ink-high/mid/low`), one accent + semantics (`--color-accent: #34d399`, `--color-warn`, `--color-danger`), and tone colors `--color-tone-1…5` (Sprint 10). Because the block is `inline` and several tokens already point at `:root` vars, the CSS-variable override mechanism for theming is half-built.

**But adoption is partial.** A literal audit across `src/` found ~800 hard-coded dark-theme Tailwind literals: `text-white` ×196, `border-white/10` ×143, `text-slate-400` ×127, `text-slate-950` ×78 (dark ink *on emerald fills* — must NOT flip), `text-slate-300` ×72, `bg-slate-950` ×12, `bg-slate-900` ×6, `bg-white/[0.03–0.06]` ×~30, plus accent literals: `text-emerald-300` ×111, `border-emerald-300` ×81, `bg-emerald-300` ×76 (solid CTA fills paired with `text-slate-950`), `text-emerald-200` ×39, `text-rose-200` ×19, `text-amber-300` ×8, etc. Zero `dark:` variants exist, and there is no solid `bg-white`. Editing 800 call sites is not a small sprint — but **Tailwind 4 lets us re-point palette primitives** (`--color-white`, `--color-slate-400`, `--color-emerald-300`, …) at CSS variables in `@theme inline`, flipping hundreds of literals at once. Opacity modifiers keep working because Tailwind 4 compiles `border-white/10` to `color-mix(in oklab, var(--color-white) 10%, transparent)`.

**Role collisions found (the only hand-edits needed):**
- `slate-950`: `text-slate-950` (×78) means "always-dark ink on emerald fill" (correct in both themes), but `bg-slate-950` (×12, incl. `body` in `src/app/layout.tsx:69` and `bg-slate-950/95` in `src/components/bottom-nav.tsx:59`) means "app ground". Fix the 12 `bg-` sites by hand; leave the token unmapped.
- `emerald-300`: text/border (×192, must darken on light) vs. solid CTA fill `bg-emerald-300 text-slate-950` (×76, must stay mint — mint + dark text is fine on light too). Migrate solid fills to a new `bg-cta` token, then remap `emerald-300`.
- One-offs: `text-emerald-400` ×2, `text-rose-400` ×1, near-solid `bg-emerald-300/90` ×1 — hand-fix.

**Hard-coded hexes inside `globals.css` itself:** focus ring `#34d399` (line 96), `::selection` (lines 100–103), `.card-face` shadow/ring (lines 216–218), `.progress-bar-track` `rgba(255,255,255,0.08)` / fill `#34d399` (lines 282–296), `.kbd` border (line 342). `.tab-scroll::after` already uses `var(--color-surface)` and flips for free.

**Settings pattern to mirror.** `src/lib/tone-colors.ts` (pure, `node --test`-able: storage key + `normalize`/`serialize`) plus `src/components/use-tone-colors.ts` (module-level store, `useSyncExternalStore`, `false` server snapshot, hydrate-on-first-subscribe, cross-tab `storage` listener, try/catch for private mode) and the chip UI in `src/components/tone-colors-toggle.tsx`. The theme setting should be a third instance of this exact pattern.

**Framework guidance (per AGENTS.md).** Next 16 ships a first-party guide at `node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md` whose **Themes** section prescribes exactly this: inline `<script>` in `<head>` via `dangerouslySetInnerHTML` that reads `localStorage` and sets `data-theme` on `<html>` before paint, with `suppressHydrationWarning` on `<html>`. Follow it verbatim.

**Misc:** `layout.tsx:57–60` exports `viewport` with `themeColor: "#020617"` and `colorScheme: "dark"` (the latter must move to CSS or light-mode form controls render dark). `src/app/manifest.ts:15–16` and `src/app/opengraph-image.tsx` are dark — intentionally out of scope. There's no settings page; the toggle chip belongs on the Home hero (`src/components/home-app.tsx`) and Stats header (`src/components/stats-app.tsx:111`), mirroring how `ToneColorsToggle` mounts in two places. Tests live in `tests/*.test.mjs` under `node --test`.

## Exact implementation steps (in sequence)

1. **`src/lib/theme.ts` (new, pure).** Storage key `"learn-10-mandarin-theme"`, `Theme` type, `normalizeThemeSetting` (only exact `"light"` → light; everything else → `"dark"`, mirroring `normalizeToneColorsSetting`'s strictness), `serializeThemeSetting`, `THEME_COLOR` map for the browser-chrome meta (`dark: "#020617"`, `light: "#f8fafc"`), and `THEME_INIT_SCRIPT` — the exact inline-script string, exported as a constant so it's unit-testable:
   `(function(){try{if(localStorage.getItem("learn-10-mandarin-theme")==="light")document.documentElement.dataset.theme="light"}catch(e){}})()`
   Dark needs no attribute — absence of `data-theme` *is* dark, so the server HTML never mismatches for dark users.

2. **`globals.css` — raw variable layer.** Move every physical value that must flip into `:root` raw vars (dark values, byte-identical to today), and add one `[data-theme="light"] { … }` override block. Add `color-scheme: dark` to `:root` and `color-scheme: light` to the light block. Proposed light values (verify ≥4.5:1 for text roles against `#f8fafc`/`#ffffff` during QA):

   | Token | Dark (today) | Light (proposed) |
   |---|---|---|
   | `--background` / `--foreground` | `#020617` / `#f8fafc` | `#f8fafc` / `#0f172a` |
   | surface / surface-2 / surface-hover / surface-accent | `#0d1220` / `#020617` / `#161d2e` / `#08131e` | `#ffffff` / `#f1f5f9` / `#f8fafc`→hover `#eef2f7` / `#ecfdf5` |
   | border / border-strong | `rgb(255 255 255 / .10 / .15)` | `rgb(2 6 23 / .08 / .14)` |
   | ink-high / mid / low | `#f8fafc` / `#94a3b8` / `#64748b` | `#0f172a` / `#475569` / `#64748b` |
   | accent / warn / danger | `#34d399` / `#fbbf24` / `#fb7185` | `#059669` / `#b45309` / `#e11d48` |
   | tone-1…5 | `#f87171 #4ade80 #60a5fa #c084fc #94a3b8` | `#dc2626 #15803d #2563eb #9333ea #64748b` |

3. **`globals.css` — palette-primitive remaps in `@theme inline`.** Point these Tailwind primitives at new raw vars (dark value = Tailwind default, unchanged): `--color-white` (dark `#fff` → light `#0f172a`; flips all ~420 `text-white`/`border-white/N`/`bg-white/[N]` ink-and-hairline uses), `--color-slate-100/200/300/400/500/600` (light: `#1e293b`, `#1e293b`, `#334155`, `#475569`, `#64748b`, `#94a3b8`), `--color-emerald-200/300` (light `#065f46` / `#047857`), `--color-amber-200/300` (light `#92400e` / `#b45309`), `--color-rose-200/300` (light `#9f1239` / `#be123c`). Add `--color-cta: var(--cta)` with `--cta: #6ee7b7` in **both** themes (solid mint CTA + dark text reads fine on light). Deliberately **unmapped**: `slate-950`, `emerald-400/500`, `rose-400`, `amber-400`, `emerald-50/100/950` — these are fill/on-fill roles that must not flip.

4. **`globals.css` — de-hex the utility classes.** Focus ring and `::selection` → `var(--color-accent)` (+ selection text `var(--background)`); `.progress-bar-track` → `var(--color-border)`; `.progress-bar-fill` → `var(--color-accent)`; `.kbd` border → `var(--color-border)`; `.card-face` ring `rgba(255,255,255,0.05)` → a new `--card-ring` raw var and soften the drop shadow under light.

5. **Bounded literal sweep (the only component edits).**
   a. `bg-slate-950` → `bg-background` (12 sites; `bottom-nav.tsx` becomes `bg-background/95` — opacity modifiers work on the token). `bg-slate-900` → `bg-surface-2` or `bg-surface` per context (6 sites).
   b. `bg-emerald-300` (solid, no `/`) → `bg-cta` — mechanical regex `bg-emerald-300(?![/0-9])` across ~76 sites, incl. `hover:`/`focus:` prefixed forms.
   c. Hand-fix one-offs: `text-emerald-400` ×2 → `text-accent`; `text-rose-400` ×1 → `text-danger`; `bg-emerald-300/90` ×1 → `bg-cta/90`; eyeball the 5 `text-emerald-100`/`text-emerald-50` sites (on-fill ink — likely fine untouched).

6. **`src/app/layout.tsx`.** Add `suppressHydrationWarning` to `<html>`; add `<head><script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} /></head>` exactly per the local Next guide; change `<body className="min-h-full bg-slate-950 text-white">` → `bg-background text-foreground`; delete `colorScheme: "dark"` from `viewport` (now CSS-owned); keep `themeColor: "#020617"` as the SSR default.

7. **`src/components/use-theme.ts` (new).** Clone the `use-tone-colors.ts` store shape. `setTheme` additionally: sets/removes `document.documentElement.dataset.theme`, updates `<meta name="theme-color">` content from `THEME_COLOR`, and `track("theme_toggled", { theme })`. The cross-tab `storage` listener applies the same DOM updates.

8. **`src/components/theme-toggle.tsx` (new).** Chip styled like `ToneColorsToggle` (44px min-height, `aria-pressed`, sun/moon inline SVG). Mount in `home-app.tsx` hero and `stats-app.tsx` header.

9. **`tests/theme.test.mjs` (new).** See test plan.

10. Run the full validation gate; QA both themes.

## Likely files touched

New: `src/lib/theme.ts`, `src/components/use-theme.ts`, `src/components/theme-toggle.tsx`, `tests/theme.test.mjs`.
Edited: `src/app/globals.css`, `src/app/layout.tsx`, `src/components/home-app.tsx`, `src/components/stats-app.tsx`, `src/components/bottom-nav.tsx`, plus the ~20 files holding `bg-slate-950`/`bg-slate-900`/solid `bg-emerald-300` literals (`stats-app.tsx`, `favorites-app.tsx`, `category-app.tsx`, `topic/cloze-panel.tsx`, `app/error.tsx`, `app/offline/page.tsx`, `app/privacy/page.tsx`, `app/topics/[slug]/not-found.tsx`, …).
Untouched on purpose: `src/app/manifest.ts`, `src/app/opengraph-image.tsx`, `src/lib/share-card-canvas.ts`, `src/lib/tone-colors.ts`.

## Proposed names and signatures

```ts
// src/lib/theme.ts
export type Theme = "dark" | "light";
export const THEME_STORAGE_KEY = "learn-10-mandarin-theme";
export function normalizeThemeSetting(value: unknown): Theme;   // only "light" → "light"
export function serializeThemeSetting(theme: Theme): "light" | "dark";
export const THEME_COLOR: Record<Theme, string>;                // { dark: "#020617", light: "#f8fafc" }
export const THEME_INIT_SCRIPT: string;                         // pre-paint <head> script body

// src/components/use-theme.ts
export function useTheme(): { theme: Theme; toggle: () => void };

// src/components/theme-toggle.tsx
export function ThemeToggle(): JSX.Element;
```

## UI copy / microcopy

- Chip label: **"Light theme"** (matches the "Tone colors" chip register).
- `aria-label`: `"Switch to light theme"` / `"Switch to dark theme"`.
- Helper text (only where space allows, e.g. Stats): `"Easier on the eyes outdoors. Saved on this device."`
- No other copy changes; pinyin/hanzi rendering untouched.

## Test plan (`tests/theme.test.mjs`, node --test)

1. `normalizeThemeSetting`: `"light"` → `"light"`; `"dark"`, `null`, `"on"`, `""`, `42`, `{}` → `"dark"` (garbage-tolerant default, mirrors `tone-colors` tests).
2. Round-trip: `normalize(serialize(t)) === t` for both themes.
3. `THEME_COLOR` has exactly `dark`/`light` keys, both `#rrggbb`.
4. **Execute `THEME_INIT_SCRIPT`** via `new Function` with stubbed `localStorage`/`document` globals: stored `"light"` → sets `dataset.theme = "light"`; stored `"dark"`/absent → dataset untouched; `localStorage.getItem` throwing → no throw (try/catch holds).
5. `THEME_INIT_SCRIPT` contains `THEME_STORAGE_KEY` (guards against key drift between script and store).

## Manual QA checklist

- [ ] Toggle on Home: entire page flips instantly (nav, cards, chips, search); reload keeps light; DevTools → Application shows `learn-10-mandarin-theme: "light"`.
- [ ] Hard reload with light stored: **no dark flash** before paint (throttle CPU/network to confirm).
- [ ] Dark mode is pixel-identical to before the sprint (default users see zero change).
- [ ] Sweep every route in light: `/`, `/topics/[slug]` (flashcards, quiz, cloze, scramble, tone trainer), `/review`, `/practice`, `/daily`, `/lightning`, `/duel`, `/path`, `/stats` (heatmap), `/favorites`, `/categories/[slug]`, `/privacy`, `/offline`, 404 — no white-on-white or unreadable text.
- [ ] Tone colors ON in light: all five tones legible on card surfaces; legend in `ToneColorsToggle` legible.
- [ ] Solid CTA buttons (`bg-cta text-slate-950`) look right in both themes; `text-slate-950` on emerald fills stayed dark in light mode.
- [ ] Keyboard focus ring and `::selection` visible in both themes; form controls (`select`, `input`) follow `color-scheme`.
- [ ] Second tab syncs when toggling in the first; private/incognito mode toggles without errors (in-memory only).
- [ ] Mobile: browser chrome `theme-color` updates on toggle; bottom nav translucency reads correctly over light content.
- [ ] `prefers-reduced-motion` behavior unchanged.

## Acceptance criteria

1. Manual toggle available on Home and Stats; persists across reloads under `learn-10-mandarin-theme`; default remains dark for new/garbage/absent values.
2. No pre-paint flash on hard load in either theme; no React hydration errors in the console.
3. All routes and practice modes readable in light theme; tone colors meet ≥4.5:1 on light surfaces; dark theme visually unchanged.
4. Cross-tab sync works; private mode degrades gracefully.
5. `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build` all pass.

## Risk and rollback notes

- **Biggest lever = biggest risk:** remapping `--color-white` and the slate/accent primitives flips ~700 literals at once. Mitigation: dark raw values are byte-identical to today's, so dark mode cannot regress; light is opt-in, so any missed spot is behind the toggle. The role-collision tokens (`slate-950`, `emerald-400`, `rose-400`) are deliberately unmapped.
- **Confusing indirection:** `text-white` no longer means white in light mode. Mitigate with a loud comment block in `globals.css` (the file already documents its token ladder this way) naming the remapped primitives and the unmapped ones.
- **Inline script + hydration:** exact pattern from the local Next 16 guide (`suppressHydrationWarning` on `<html>`, script in `<head>`); the script only ever *adds* the attribute for light, so dark SSR output matches the DOM.
- **Rollback:** revert the single sprint commit. Partial rollback: remove the `<head>` script and toggle mounts — with `data-theme` never set, the entire light block is dormant CSS.

## Non-goals / deferrals

- No `prefers-color-scheme` auto-detection or "System" third state (deferred; `normalizeThemeSetting` extends cleanly).
- No re-theming of the OG image, PWA manifest colors, share-card canvas (dark is the share brand), or apple status-bar style.
- No settings page; no inclusion of theme in progress export/import (device-local, like tone colors).
- No per-component design polish pass in light mode beyond the token table — refinement is a later polish sprint.

## Ready-to-run Opus implementation prompt

```
Implement Sprint 16 of the Learn 10 Mandarin Words app (Next.js 16 / React 19 / Tailwind 4,
static local-first, dark-only today): a manual light/dark theme toggle persisted in
localStorage. Dark stays the default. Read AGENTS.md first, then read
node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md ("Themes"
section) and follow its inline-script pattern exactly.

Mechanism (CSS variables, NOT a component sweep):
1. Create src/lib/theme.ts mirroring src/lib/tone-colors.ts: THEME_STORAGE_KEY
   "learn-10-mandarin-theme", type Theme = "dark" | "light", normalizeThemeSetting (only the
   exact string "light" yields "light"), serializeThemeSetting, THEME_COLOR
   { dark: "#020617", light: "#f8fafc" }, and THEME_INIT_SCRIPT — an IIFE string that reads
   localStorage in try/catch and sets document.documentElement.dataset.theme="light" only
   when the stored value is "light" (dark = attribute absent).
2. In src/app/globals.css: move themable physical values into :root raw vars (keep dark
   values byte-identical) and add one [data-theme="light"] override block, including
   color-scheme: dark on :root and light in the block. Light values: background #f8fafc,
   foreground #0f172a, surface #ffffff, surface-2 #f1f5f9, surface-hover #eef2f7,
   surface-accent #ecfdf5, border rgb(2 6 23/.08), border-strong rgb(2 6 23/.14), ink-high
   #0f172a, ink-mid #475569, ink-low #64748b, accent #059669, warn #b45309, danger #e11d48,
   tones 1–5: #dc2626 #15803d #2563eb #9333ea #64748b.
3. In the @theme inline block, re-point Tailwind palette primitives at raw vars so existing
   literals flip: --color-white (light #0f172a), --color-slate-100/200/300/400/500/600
   (light #1e293b/#1e293b/#334155/#475569/#64748b/#94a3b8), --color-emerald-200/300 (light
   #065f46/#047857), --color-amber-200/300 (light #92400e/#b45309), --color-rose-200/300
   (light #9f1239/#be123c). Add --color-cta = #6ee7b7 in BOTH themes. Do NOT remap
   slate-950, emerald-400/500, rose-400, amber-400, emerald-50/100/950 (fill / on-fill
   roles). Add a comment block documenting remapped vs deliberately-unmapped primitives.
4. Replace hard-coded hexes inside globals.css utilities with vars: focus-visible outline
   and ::selection → var(--color-accent) (selection text var(--background));
   .progress-bar-track and .kbd border → var(--color-border); .progress-bar-fill →
   var(--color-accent); .card-face ring/shadow → new raw vars with softer light values.
5. Bounded sweep: bg-slate-950 → bg-background (12 sites; bottom-nav.tsx uses
   bg-background/95), bg-slate-900 → bg-surface-2/bg-surface per context (6 sites); solid
   bg-emerald-300 (regex bg-emerald-300(?![/0-9]), incl. hover:/focus: forms, ~76 sites) →
   bg-cta; hand-fix text-emerald-400 ×2 → text-accent, text-rose-400 ×1 → text-danger,
   bg-emerald-300/90 ×1 → bg-cta/90. Leave text-slate-950 untouched everywhere.
6. src/app/layout.tsx: suppressHydrationWarning on <html>; <head> with a <script
   dangerouslySetInnerHTML={{__html: THEME_INIT_SCRIPT}} />; body className →
   "min-h-full bg-background text-foreground"; delete colorScheme from the viewport export
   (CSS owns it now); keep themeColor "#020617".
7. src/components/use-theme.ts: clone the use-tone-colors.ts useSyncExternalStore pattern
   (server snapshot "dark", hydrate on first subscribe, storage-event cross-tab sync,
   try/catch). setTheme also sets/removes documentElement.dataset.theme, updates
   <meta name="theme-color"> from THEME_COLOR, and calls track("theme_toggled",{theme}).
   The storage listener applies the same DOM updates.
8. src/components/theme-toggle.tsx: chip styled like tone-colors-toggle.tsx (min-h-[44px],
   aria-pressed, sun/moon inline SVG, label "Light theme", aria-label "Switch to
   light/dark theme"). Mount it in the home-app.tsx hero and the stats-app.tsx header
   ("Your Stats"), with helper text "Easier on the eyes outdoors. Saved on this device."
   on Stats only.
9. tests/theme.test.mjs (node --test): normalize/serialize cases incl. garbage inputs;
   THEME_COLOR shape; execute THEME_INIT_SCRIPT via new Function with stubbed
   localStorage/document (light sets the attribute, dark/absent does not, a throwing
   localStorage does not crash); assert the script string contains THEME_STORAGE_KEY.

Do NOT touch: src/app/manifest.ts, src/app/opengraph-image.tsx, src/lib/share-card-canvas.ts,
progress export/import, or any vocabulary data. No new dependencies.

Validation gate (all must pass):
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build

Then QA: dark mode must be pixel-identical to before; with light stored, hard reload shows
no dark flash; sweep every route in light mode (topics incl. all practice panels, review,
practice, daily, lightning, duel, path, stats, favorites, categories, privacy, offline, 404)
for readability; verify tone colors ON in light meets contrast on white cards; verify
cross-tab sync and private-mode safety.
```

---

I've grounded the plan in the actual code — all the pieces exist scattered exactly as the backlog rationale claims: tone colors on topic/review pages, export/import buried in the home hero card, goal editing on `/stats`, playback rate inside the video player, and no theme system at all (the app is deliberately dark-only). Here is the plan.

---

## Sprint 17 — Settings page consolidating tone colors, audio, goal, theme, and data export/import

### Goal and user value

Ship a `/settings` page that gathers every device-local preference — tone colors, audio (speech check + video playback speed), daily goal, theme, and progress export/import — into the one place learners expect to find them. Today each preference is only discoverable on the page where it happens to be used; a learner who wants to export progress must know it lives inside the home-page "Today's snapshot" card. Everything reuses existing stores and keys, so this is pure consolidation: no new persistence formats, no migrations.

### Current-state findings (grounded in actual files)

- **Tone colors** — pure logic in `src/lib/tone-colors.ts` (key `learn-10-mandarin-tone-colors`, `normalizeToneColorsSetting`/`serializeToneColorsSetting`); a module-level `useSyncExternalStore` store in `src/components/use-tone-colors.ts` shared by every subscriber, so a toggle anywhere re-renders all pinyin in sync. The existing chip UI `src/components/tone-colors-toggle.tsx` is mounted on topic pages and the review header (right-aligned styling, includes the mā má mǎ mà legend).
- **Audio** — two things exist: (1) Web Speech via `src/components/use-speech.ts` returning `{ status, speaking, failed, speak, stop }` with `SpeechSupport` classification in `src/lib/speech.ts` (`loading | unsupported | no-chinese-voice | ready`), surfaced through `src/components/speak-button.tsx`; (2) video playback rate — pure helpers `PLAYBACK_RATES`, `normalizeRate`, `rateLabel` in `src/lib/video-controls.ts`, but the storage key `RATE_STORAGE_KEY = "learn-10-mandarin-video-rate"` is module-private in `src/components/video-player.tsx:20` (read on mount at line 41, written at line 76). There is no user-facing speech-rate setting (`SPEECH_RATE = 0.85` is a constant).
- **Daily goal** — stored in `ProgressState.onboarding.dailyGoal`; edited via `setDailyGoal` from `src/components/use-progress.ts:114` and the `GoalCard` in `src/components/stats-app.tsx:339–428` (chips reuse `GOAL_OPTIONS` exported from `src/components/onboarding.tsx:14` — Casual 5 / Steady 10 / Serious 20, plus a 1–100 custom number input).
- **Theme** — there is **no theme system**. `src/app/layout.tsx:57–60` sets `viewport.colorScheme: "dark"` and `themeColor: "#020617"`; the body is hard-coded `bg-slate-950`. `src/app/globals.css` has no `prefers-color-scheme` or `data-theme` hooks. A light theme is far beyond a small sprint.
- **Export/import** — `exportProgress` (Blob download named `mandarin-progress-<date>.json`) and `importProgress` (JSON.parse → `normalizeProgress`, throws on bad JSON) live in `src/components/use-progress.ts:70–87`. The only UI is two buttons + hidden file input in the home snapshot card, `src/components/home-app.tsx:188–211`, with a bare `alert()` on failure (line 69). Progress key: `learn-10-mandarin-progress-v1`; `normalizeProgress` in `src/lib/progress-logic.ts:253` already sanitizes arbitrary parsed input (schema v7).
- **Navigation** — `src/components/bottom-nav.tsx` has five mobile items (adding a sixth would crowd it); desktop discovery happens through quiet text links in the home hero (`home-app.tsx:100–107`). Pages follow a server-wrapper pattern (`src/app/stats/page.tsx` → `<StatsApp />` with `Metadata` + canonical).
- **Conventions** — pure logic in `src/lib/*.ts` with `node --test` tests in `tests/*.test.mjs` importing `.ts` directly (see `tests/tone-trainer-logic.test.mjs`); analytics events are a closed union in `src/lib/analytics.ts:15`; toasts exist in `src/components/toast.tsx`; per `AGENTS.md`, read `node_modules/next/dist/docs/` before writing any Next.js code.

### Exact implementation steps in sequence

1. **Read the Next.js 16 routing/metadata docs** in `node_modules/next/dist/docs/` (per AGENTS.md) before creating the route.
2. **Create `src/lib/settings-logic.ts`** (pure, DOM-free, mirroring `tone-colors.ts` conventions): move `RATE_STORAGE_KEY` here-adjacent (see step 3), add `describeSpeechSupport`, `validateProgressFile`, `progressExportFilename` (signatures below).
3. **Export the video-rate storage key from `src/lib/video-controls.ts`** (`export const RATE_STORAGE_KEY = "learn-10-mandarin-video-rate"`), and update `src/components/video-player.tsx` to import it instead of declaring its own copy. No behavior change.
4. **Refactor `exportProgress`** in `use-progress.ts` to use `progressExportFilename(todayISO())` — filename behavior identical, now unit-tested.
5. **Extract `GoalEditor`** (`src/components/goal-editor.tsx`) from the chips + custom-input block of `GoalCard` (`stats-app.tsx:383–423`), and have `GoalCard` render it. Identical markup/classes so `/stats` is visually unchanged.
6. **Create `src/components/settings-app.tsx`** (client) with four sections rendered as flat Level-1 cards (`rounded-3xl border border-white/10 bg-surface`, matching the snapshot card):
   - *Appearance*: tone-colors switch via `useToneColors()` (settings-styled row, reusing `TONE_TEXT_CLASS` legend rendering from `tone-colors-toggle.tsx`), plus a **non-interactive Theme row** stating the app is dark-only (honest placeholder; no dead controls).
   - *Audio*: Mandarin voice status row via `useSpeech()` + `describeSpeechSupport`, with a "Test audio" `SpeakButton` saying 你好 (nǐ hǎo — pinyin shown on the Chinese line via `TonePinyin`); video playback speed pills using `PLAYBACK_RATES`/`rateLabel`, reading/writing `RATE_STORAGE_KEY` with `normalizeRate`, try/catch-wrapped like `use-tone-colors.ts`.
   - *Daily goal*: `GoalEditor` wired to `setDailyGoal` from `useProgress()`.
   - *Data*: Export / Import buttons reusing `exportProgress` and a `validateProgressFile`-guarded import with `Toast` feedback (replacing the `alert()` pattern), plus a note linking to `/privacy`.
7. **Create `src/app/settings/page.tsx`** — server wrapper with `Metadata` (title "Settings", description, `alternates.canonical: "/settings"`) rendering `<SettingsApp />`, mirroring `src/app/stats/page.tsx`.
8. **Consolidate entry points in `home-app.tsx`**: replace the export/import buttons + hidden file input (lines 188–211) with a single quiet "Settings →" link row in the snapshot card, and add a "Settings" link to the desktop quiet-links row (lines 100–107). Remove the now-unused `handleImport`, `fileInputRef`, `exportProgress`/`importProgress` destructuring.
9. **Add a gear "Settings" link to the `/stats` page header** in `stats-app.tsx` (small icon link, top-right) so mobile users reach settings from a bottom-nav destination.
10. **Add analytics events** `"progress_exported"` and `"progress_imported"` to the `AnalyticsEvent` union in `src/lib/analytics.ts` and `track(...)` them in the settings data section.
11. **Add `/settings` to `src/app/sitemap.ts`** following the existing static-route entries.
12. **Write `tests/settings-logic.test.mjs`** covering the new pure helpers (see test plan).
13. Run the full validation gate.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/settings-logic.ts` | **new** — pure helpers |
| `src/app/settings/page.tsx` | **new** — server wrapper + metadata |
| `src/components/settings-app.tsx` | **new** — client page body |
| `src/components/goal-editor.tsx` | **new** — extracted from GoalCard |
| `tests/settings-logic.test.mjs` | **new** — unit tests |
| `src/lib/video-controls.ts` | export `RATE_STORAGE_KEY` |
| `src/components/video-player.tsx` | import shared key |
| `src/components/use-progress.ts` | use `progressExportFilename` |
| `src/components/stats-app.tsx` | GoalCard uses `GoalEditor`; header settings link |
| `src/components/home-app.tsx` | export/import block → settings link; hero link |
| `src/lib/analytics.ts` | two new event names |
| `src/app/sitemap.ts` | add `/settings` |

### Proposed names and TypeScript signatures

```ts
// src/lib/settings-logic.ts
import type { SpeechSupport } from "./speech.ts";
import type { ProgressState } from "./types.ts";

/** User-facing description of Mandarin speech support for the Audio section. */
export function describeSpeechSupport(
  status: SpeechSupport,
): { label: string; detail: string; tone: "ok" | "warn" | "muted" };

/** Parse + sanitize an uploaded progress file. Never throws. */
export function validateProgressFile(
  json: string,
): { ok: true; state: ProgressState } | { ok: false; error: string };

/** e.g. progressExportFilename("2026-07-06") → "mandarin-progress-2026-07-06.json" */
export function progressExportFilename(day: string): string;
```

```tsx
// src/components/goal-editor.tsx
export function GoalEditor(props: {
  current: number;                 // progress.onboarding.dailyGoal (0 = unset)
  onChange: (goal: number) => void; // setDailyGoal from useProgress
}): React.JSX.Element;

// src/components/settings-app.tsx
export function SettingsApp(): React.JSX.Element;          // no props; all state from hooks
function SettingsSection(props: { title: string; description?: string; children: React.ReactNode }): React.JSX.Element;
function PlaybackRateSetting(): React.JSX.Element;         // localStorage-backed pills
function DataSection(): React.JSX.Element;                 // export/import + toast state
```

### UI copy / microcopy

- Page header: **Settings** — "Preferences are saved on this device — no account, no cloud."
- Appearance / Tone colors: **"Tone colors"** — "Color each pinyin syllable by its tone." (matches existing chip copy; legend `mā má mǎ mà · ma` shown when on)
- Appearance / Theme row: **"Theme"** — value **"Dark"**, detail "Learn 10 is designed dark-first. More themes may come later."
- Audio / voice status via `describeSpeechSupport`: ready → "Mandarin voice ready"; no-chinese-voice → "No Mandarin voice installed — add a Chinese voice in your system settings"; unsupported → "Speech isn't supported in this browser"; loading → "Checking voices…". Test row: 你好 with pinyin "nǐ hǎo" and a **"Test audio"** button.
- Audio / playback speed: **"Lesson video speed"** — "Default speed for lesson videos. You can still change it on any video."
- Daily goal: **"Daily goal"** — "Distinct words practiced per day. Your streak and home-page ring follow this."
- Data / export: **"Export progress"** — "Download everything as a JSON file — a good backup before switching devices."
- Data / import: **"Import progress"** — "Replaces the progress on this device with the file's contents."
- Toasts: "Progress imported ✓" / "Could not import: that file isn't a valid progress export." / "Progress downloaded".
- Data footnote: "Tone colors and video speed stay on this device and aren't included in the export. See our [Privacy](/privacy) page."

### Test plan (`tests/settings-logic.test.mjs`)

- `describeSpeechSupport` returns distinct label/tone for all four `SpeechSupport` values (exhaustive over the union).
- `validateProgressFile`: valid export round-trips (`JSON.stringify` of a normalized state → `ok: true` with same learned topics/goal); garbage string, `"null"`, `"[]"`, and `"{}"` → `{ok: true}`-with-empty-normalized or `{ok: false}` exactly matching `normalizeProgress` semantics (assert it never throws); truncated JSON → `ok: false` with the friendly error.
- `progressExportFilename("2026-07-06")` → `"mandarin-progress-2026-07-06.json"`.
- Existing suites (`progress-logic`, `video-controls`, `sw-policy`) must stay green — they pin the behavior this sprint reuses.

### Manual QA checklist

1. Visit `/settings` on mobile and desktop — dark flat cards, no layout shift on hydration.
2. Toggle tone colors on `/settings`, then open a topic page: pinyin is colored and the topic-page chip shows pressed (shared store). Toggle off there; return to settings — switch reflects off. Repeat in a second tab (storage-event sync).
3. Set playback speed to 1.5×, open a topic with a video: player starts at 1.5×. Change it in the player to 0.75×; reload `/settings`: shows 0.75×.
4. Change daily goal via chip and via custom input; `/stats` GoalCard and home ring update; onboarding modal unaffected for a fresh profile.
5. Tap "Test audio": hears 你好 (or sees honest unavailable copy in a browser with no zh voice).
6. Export → file downloads as `mandarin-progress-<today>.json`; wipe site data; import that file → streak, learned topics, goal restored; import a `.txt` of garbage → error toast, existing progress untouched.
7. Home page: snapshot card shows the Settings link (export/import buttons gone); hero quiet links include Settings; `/stats` header gear navigates.
8. Private/incognito mode: page renders and toggles work in-memory without crashing (try/catch paths).

### Acceptance criteria

- `/settings` exists, is statically built, in the sitemap, with canonical metadata.
- All five briefed areas present: tone colors (functional), audio (voice status + test + video speed), goal (functional), theme (honest informational row), export/import (functional with toast feedback).
- No new localStorage keys; all existing keys and formats unchanged; export file format byte-identical in shape.
- Home export/import UI is replaced by a link to `/settings` (single source of truth for data actions).
- `npm run test`, `validate:data`, `validate:quality`, `lint`, `build` all pass.

### Risk and rollback notes

- **Low risk**: the page is additive; the only edits to existing behavior are the home-card swap and the `RATE_STORAGE_KEY`/filename refactors (identical values, now shared). Rollback is a single revert; no data migration in either direction.
- Playback-speed sync is read-on-mount in `video-player.tsx` — a rate changed while a video is already open won't live-update it. Acceptable and documented in the microcopy ("default speed").
- Import still fully replaces state (existing behavior). The copy now says so explicitly; merge/preview is deferred.
- Watch: removing `fileInputRef`/`handleImport` from `home-app.tsx` must not orphan other uses (they have none today — verified at `home-app.tsx:22,61–74`).

### Non-goals / deferrals

- No light theme or theme switcher (no theme infrastructure exists; the row is informational only).
- No speech-rate or voice-picker setting (`SPEECH_RATE` stays a constant).
- No "reset all progress" destructive action, no import preview/merge, no bundling device prefs into the export file (would change the export schema).
- No bottom-nav sixth item; no changes to onboarding.

### Ready-to-run Opus implementation prompt for Sprint 17

```text
Implement Sprint 17 of Learn 10 Mandarin Words: a /settings page consolidating device-local preferences. Next.js 16 / React 19 / Tailwind 4, static/local-first, dark-only UI. Per AGENTS.md, read the relevant guides in node_modules/next/dist/docs/ BEFORE writing any Next.js code.

Reuse existing stores — create NO new localStorage keys:
- Tone colors: useToneColors() in src/components/use-tone-colors.ts (shared useSyncExternalStore store; key learn-10-mandarin-tone-colors).
- Video speed: PLAYBACK_RATES/normalizeRate/rateLabel in src/lib/video-controls.ts. Move RATE_STORAGE_KEY ("learn-10-mandarin-video-rate") from src/components/video-player.tsx:20 into video-controls.ts as an export and import it in the player.
- Speech: useSpeech() from src/components/use-speech.ts and SpeakButton from src/components/speak-button.tsx.
- Goal: setDailyGoal + progress.onboarding.dailyGoal via useProgress(); GOAL_OPTIONS from src/components/onboarding.tsx.
- Export/import: exportProgress/importProgress in src/components/use-progress.ts; normalizeProgress in src/lib/progress-logic.ts.

Build:
1. src/lib/settings-logic.ts (pure, DOM-free, doc-comment style of src/lib/tone-colors.ts):
   describeSpeechSupport(status: SpeechSupport): { label; detail; tone: "ok"|"warn"|"muted" };
   validateProgressFile(json: string): { ok: true; state: ProgressState } | { ok: false; error: string } (never throws);
   progressExportFilename(day: string): string → "mandarin-progress-<day>.json". Refactor exportProgress in use-progress.ts to use it (identical output).
2. src/components/goal-editor.tsx: extract the chips + 1–100 custom input from GoalCard (src/components/stats-app.tsx:383–423) into GoalEditor({ current, onChange }); GoalCard renders it — /stats must look identical.
3. src/components/settings-app.tsx (client) + src/app/settings/page.tsx (server wrapper with Metadata: title "Settings", canonical "/settings", pattern of src/app/stats/page.tsx). Sections as flat cards (rounded-3xl border border-white/10 bg-surface, emerald accents, min-h-[44px] touch targets):
   - Appearance: tone-colors toggle row (aria-pressed, legend mā má mǎ mà · ma via TONE_TEXT_CLASS when on) + non-interactive Theme row: value "Dark", detail "Learn 10 is designed dark-first. More themes may come later."
   - Audio: voice status row from describeSpeechSupport(useSpeech().status); test row rendering 你好 with pinyin "nǐ hǎo" (TonePinyin) and a SpeakButton; "Lesson video speed" pills over PLAYBACK_RATES persisting via RATE_STORAGE_KEY with normalizeRate, try/catch-wrapped (private-mode safe, see use-tone-colors.ts).
   - Daily goal: GoalEditor wired to setDailyGoal; copy "Distinct words practiced per day."
   - Data: Export ("Download everything as a JSON file") and Import ("Replaces the progress on this device with the file's contents") using validateProgressFile + the Toast component (src/components/toast.tsx) — no alert(). Footnote: tone colors/video speed are not in the export; link to /privacy.
4. Consolidate entries: in src/components/home-app.tsx replace the export/import buttons + hidden input (lines ~188–211) with one quiet "Settings" link row; add "Settings" to the desktop quiet-links (lines ~100–107); delete the now-unused handleImport/fileInputRef/export-import destructuring. Add a small gear "Settings" link to the stats-app header. Do NOT touch bottom-nav.tsx.
5. Add "progress_exported" and "progress_imported" to the AnalyticsEvent union (src/lib/analytics.ts) and track() them in the Data section. Add /settings to src/app/sitemap.ts.
6. tests/settings-logic.test.mjs (node:test + assert/strict, import ../src/lib/settings-logic.ts like tests/tone-trainer-logic.test.mjs): exhaustive describeSpeechSupport over all four statuses; validateProgressFile round-trip, garbage, truncated JSON, "null"/"{}" (assert it never throws); progressExportFilename.

Constraints: no new deps, no backend, pinyin shown on all Chinese text, hydration-safe (server snapshot / mount-effect reads only — no SSR localStorage), keep the existing export JSON shape byte-compatible.

Validation gate (all must pass):
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build
```

---

I've inspected the quiz surfaces, the settings-toggle precedent (tone colors), the storage patterns, and the test conventions. Here's the grounded plan.

## Sprint 18 — Optional haptic feedback on quiz answers via navigator.vibrate, off by default

### Goal and user value

Add an opt-in "Vibration" preference that fires a short haptic pulse when a learner answers a quiz question — one crisp tick for correct, a distinct double-buzz for incorrect. On mobile, this makes practice feel responsive without needing eyes on the feedback text (useful mid-commute, or in listening mode where attention is on the audio). It is off by default, device-local (localStorage, never part of progress export), and entirely hidden on devices without `navigator.vibrate` support (notably iOS Safari), so no dead UI ever appears.

### Current-state findings grounded in actual files/components/helpers

- **There is an exact precedent for a device-local boolean preference: the tone-colors setting (Sprint 10).** It's split into a pure, DOM-free helper (`src/lib/tone-colors.ts` — storage key `"learn-10-mandarin-tone-colors"`, `normalizeToneColorsSetting` accepting only the exact string `"on"`, `serializeToneColorsSetting`), a module-level store hook (`src/components/use-tone-colors.ts` — `useSyncExternalStore` with a `false` server snapshot, lazy hydration on first subscribe, cross-tab `storage` event sync, try/catch around all storage access), and a chip toggle (`src/components/tone-colors-toggle.tsx` — `aria-pressed`, "Saved on this device" microcopy). The haptics setting should mirror this structure file-for-file.
- **Quiz answers are handled in five multiple-choice surfaces**, each with a single choke-point handler where correctness is computed:
  - Topic quiz: `answerQuiz(choice)` in `src/components/topic-app.tsx:142` (computes `correct`, records progress, drives combo). The `QuizPanel` (`src/components/topic/quiz-panel.tsx`) is presentation-only and receives `onAnswer` — no change needed there.
  - Smart practice: `handleAnswer` in `src/components/practice-app.tsx:89`.
  - Daily challenge: `handleAnswer` (a `useCallback`) in `src/components/daily-app.tsx:76`.
  - Lightning round: `handleAnswer` in `src/components/lightning-app.tsx:185` (guards on phase/deadline before computing `correct`).
  - Duel: `handleAnswer` in `src/components/duel-app.tsx:136` — this one is a pure state-machine dispatch (`answerCurrent(s, choice)`); correctness must be computed locally as `choice === card.answer` before dispatching.
- **Toggle mounting precedent:** `ToneColorsToggle` is mounted in `src/components/topic-app.tsx:375` (right-aligned block under the mode tabs) and `src/components/review-app.tsx:215`. The setting is global even though the toggle appears in only two places — same model works for haptics.
- **Analytics:** `src/lib/analytics.ts` has a typed `AnalyticsEvent` union including `"tone_colors_toggled"`; the tone-colors hook calls `track("tone_colors_toggled", { enabled })` on toggle. A `"haptics_toggled"` event follows the same pattern. `track` is a privacy-safe no-op by default — no external providers.
- **Feature detection precedent:** `copy-button.tsx:30` hides itself when `navigator.clipboard` is missing, but does so with an inline `typeof navigator` check that is only hydration-safe by accident. The safer in-repo pattern is `use-reduced-motion.ts` / `use-tone-colors.ts`: `useSyncExternalStore` with a `false` server snapshot so SSR and first client paint agree, and the real value appears post-hydration. Haptics support detection should use that pattern.
- **Tests:** `tests/*.test.mjs` run under `node --test` and import TypeScript lib files directly (e.g. `tests/quiz-logic.test.mjs` imports `../src/lib/quiz-logic.ts`). This only works for DOM-free modules — so `src/lib/haptics.ts` must contain no `navigator`/`window` access, exactly like `tone-colors.ts` (which even documents this: "Kept here so the coercion + class-mapping logic is unit-testable under `node --test` without rendering").
- **No existing vibration code:** `grep navigator.` shows clipboard, share, serviceWorker, and onLine uses only — this sprint introduces the first `navigator.vibrate` call.
- Per `AGENTS.md`, this is a breaking-changes Next.js 16 build — but this sprint touches only existing `"use client"` components and pure libs; no routing/data-fetching APIs are involved.

### Exact implementation steps in sequence

1. **Create `src/lib/haptics.ts`** (pure, DOM-free — mirror of `tone-colors.ts`):
   - `HAPTICS_STORAGE_KEY = "learn-10-mandarin-haptics"`.
   - `normalizeHapticsSetting(value: unknown): boolean` — only exact `"on"` enables; everything else (null, garbage, legacy values) reads as off. Default off falls out of this.
   - `serializeHapticsSetting(enabled: boolean): "on" | "off"`.
   - `type HapticKind = "correct" | "incorrect"` and `HAPTIC_PATTERNS: Record<HapticKind, readonly number[]>` — correct: `[20]` (single crisp tick); incorrect: `[40, 60, 40]` (double buzz, clearly distinguishable without looking). Doc-comment that patterns are millisecond vibrate/pause pairs for `navigator.vibrate`.
2. **Create `src/components/use-haptics.ts`** (`"use client"` — mirror of `use-tone-colors.ts`):
   - Module-level store: `enabled`, `hydrated`, listener set, `readStored()` via `normalizeHapticsSetting`, cross-tab `storage` sync, `getServerSnapshot() → false`, try/catch-wrapped writes.
   - Support detection: module-level `supported` snapshot (`typeof navigator !== "undefined" && "vibrate" in navigator`) exposed through the same `useSyncExternalStore` hook with a `false` server snapshot, so the toggle renders nothing on the server and on unsupported devices with no hydration mismatch.
   - `useHaptics(): { enabled, supported, toggle }`; `toggle` persists and calls `track("haptics_toggled", { enabled: next })`.
   - Exported module-level `vibrateFeedback(kind: HapticKind): void` for answer handlers: **lazily hydrates the store if no component has subscribed yet** (important — on `/daily`, `/lightning`, `/practice`, `/duel` the toggle is not mounted, so nothing else hydrates the store), then no-ops unless enabled and supported, then `navigator.vibrate(HAPTIC_PATTERNS[kind])` inside try/catch. Handlers never thread the setting through props.
3. **Create `src/components/haptics-toggle.tsx`** — a chip styled identically to `ToneColorsToggle` (same border/emerald active classes, `min-h-[44px]`, `aria-pressed`), rendering `null` when `!supported`. Label "Vibration", helper text per the microcopy section.
4. **Mount the toggle in `src/components/topic-app.tsx`** — inside the existing right-aligned preference block at line ~375, alongside `<ToneColorsToggle />` (stack them with a small gap in that flex column).
5. **Wire `vibrateFeedback` into the five answer handlers**, one line each, immediately after correctness is known and before/alongside state updates:
   - `topic-app.tsx` `answerQuiz` (after the `picked` guard): `vibrateFeedback(correct ? "correct" : "incorrect")`.
   - `practice-app.tsx` `handleAnswer`, `daily-app.tsx` `handleAnswer` (add nothing to the `useCallback` dep array — `vibrateFeedback` is a module-level import), `lightning-app.tsx` `handleAnswer` (after the deadline guard), `duel-app.tsx` `handleAnswer` (compute `const correct = choice === card.answer` locally, guarded on `card` and `state.phase === "question"`).
6. **Add `"haptics_toggled"` to the `AnalyticsEvent` union in `src/lib/analytics.ts`** (alphabetically near `tone_colors_toggled`).
7. **Create `tests/haptics.test.mjs`** (see test plan).
8. Run the full validation gate.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/haptics.ts` | new — pure helpers + patterns |
| `src/components/use-haptics.ts` | new — store hook + `vibrateFeedback` |
| `src/components/haptics-toggle.tsx` | new — toggle chip |
| `src/components/topic-app.tsx` | mount toggle; vibrate in `answerQuiz` |
| `src/components/practice-app.tsx` | vibrate in `handleAnswer` |
| `src/components/daily-app.tsx` | vibrate in `handleAnswer` |
| `src/components/lightning-app.tsx` | vibrate in `handleAnswer` |
| `src/components/duel-app.tsx` | vibrate in `handleAnswer` |
| `src/lib/analytics.ts` | add `"haptics_toggled"` event |
| `tests/haptics.test.mjs` | new — unit tests |

### Proposed function/component names and TypeScript signatures

```ts
// src/lib/haptics.ts (DOM-free)
export const HAPTICS_STORAGE_KEY = "learn-10-mandarin-haptics";
export type HapticKind = "correct" | "incorrect";
export const HAPTIC_PATTERNS: Record<HapticKind, readonly number[]>;
export function normalizeHapticsSetting(value: unknown): boolean;
export function serializeHapticsSetting(enabled: boolean): "on" | "off";

// src/components/use-haptics.ts ("use client")
export function useHaptics(): { enabled: boolean; supported: boolean; toggle: () => void };
/** Fire answer feedback. Safe no-op when disabled, unsupported, or SSR. */
export function vibrateFeedback(kind: HapticKind): void;

// src/components/haptics-toggle.tsx
export function HapticsToggle(): React.JSX.Element | null;
```

### UI copy / microcopy

- Toggle chip label: **`Vibration`**
- Helper text (matching the tone-colors sentence rhythm): **`Buzz on quiz answers. Saved on this device.`**
- `aria-label`: **`Turn vibration on`** / **`Turn vibration off`** (matching the tone-colors phrasing).
- No copy anywhere when unsupported — the control simply doesn't render.

### Test plan

`tests/haptics.test.mjs` under `node --test`, importing `../src/lib/haptics.ts` (same pattern as `tests/quiz-logic.test.mjs`):

- `normalizeHapticsSetting`: `"on"` → true; `"off"`, `null`, `""`, `"true"`, `1`, `undefined`, `{}` → false (default-off + garbage tolerance).
- Round-trip: `normalize(serialize(true)) === true`, `normalize(serialize(false)) === false`.
- `HAPTIC_PATTERNS`: has exactly `correct` and `incorrect` keys; every entry is a positive integer; the two patterns differ; correct is a single short pulse (`length === 1`, ≤ 50 ms) so "correct" stays subtle.
- `HAPTICS_STORAGE_KEY` starts with `"learn-10-mandarin-"` (matches the app's key namespace).

The hook/toggle are not unit-tested (no DOM test rig exists in this repo — consistent with `use-tone-colors.ts` having no test); their logic is deliberately kept to the already-proven store pattern.

### Manual QA checklist

On an Android phone/emulator (Chrome — supports `navigator.vibrate`):
1. Open a topic page → "Vibration" chip appears next to "Tone colors", off by default; no vibration when answering.
2. Enable it → answer a quiz question correctly → single short tick; answer wrongly → double buzz, distinguishable by feel.
3. Works in all four topic quiz modes including Listen 🔊; also on `/practice`, `/daily`, `/lightning`, `/duel` **without visiting a topic page first in that tab** (verifies lazy store hydration in `vibrateFeedback`).
4. Reload → setting persists; two tabs open → toggling in one updates the other (storage event).
5. On iOS Safari / desktop without vibration: chip absent everywhere; answers work normally; no console errors.
6. Private/incognito mode with storage blocked: toggle still flips for the current tab, nothing throws.
7. No hydration warnings in the dev console on topic pages (server paint = no chip, chip appears post-hydration only when supported).

### Acceptance criteria

- Default is off: a fresh profile (or any garbage localStorage value) never vibrates.
- With the setting on, every first answer in the five MC quiz surfaces triggers the correct-or-incorrect pattern exactly once (respecting each handler's existing `picked`/phase/deadline guards).
- Toggle is hidden (not disabled) when `navigator.vibrate` is unavailable, with no hydration mismatch.
- Setting is localStorage-only under its own key — `ProgressState` and progress export/import are untouched.
- `haptics_toggled` fires through the existing local-only `track()` choke point; no network calls.
- All five gate commands pass: `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build`.

### Risk and rollback notes

- **iOS has no `navigator.vibrate`** — mitigated by hiding the toggle entirely via hydration-safe support detection; the feature is additive for Android/some desktops.
- **Chrome ignores `vibrate()` before a user gesture** — not an issue here: every call is inside an answer-tap click handler.
- **Hydration mismatch risk** from `navigator` checks — mitigated by the `useSyncExternalStore` false-server-snapshot pattern already proven in `use-tone-colors.ts`/`use-reduced-motion.ts`; do **not** copy the inline check style from `copy-button.tsx`.
- **Silent-failure risk on `/daily` etc. if the store never hydrates** — addressed explicitly by lazy hydration inside `vibrateFeedback`; QA step 3 covers it.
- **Rollback:** the feature is isolated to three new files plus one-line call sites and one toggle mount. Reverting the commit fully removes it; a stale `learn-10-mandarin-haptics` key left in localStorage is harmless (nothing else reads it).

### Non-goals / deferrals

- No haptics on non-quiz activities: flashcard grading, typing, match, cloze, scramble, tone trainers, and the boss round are deferred (boss is a natural fast-follow using the same one-liner).
- No vibration on combo milestones, completion screens, or new-best moments — answers only, keeping the signal meaningful.
- No pattern customization or intensity settings; no toggle placement on `/practice`, `/daily`, etc. (the topic-page toggle sets the global device preference) — revisit if a settings surface ever consolidates these chips.
- No coupling to `prefers-reduced-motion` (vibration is not motion, and the feature is opt-in anyway).

### Ready-to-run Opus implementation prompt for Sprint 18

```text
Implement Sprint 18 of the "Learn 10 Mandarin Words" app (Next.js 16 / React 19 / Tailwind 4,
static local-first, repo root = project root): optional haptic feedback on quiz answers via
navigator.vibrate, OFF by default. Read AGENTS.md first — this Next.js version has breaking
changes; consult node_modules/next/dist/docs/ if any framework question arises (this sprint
should only touch "use client" components and pure libs).

Mirror the existing tone-colors preference (Sprint 10) file-for-file:
src/lib/tone-colors.ts (pure helpers), src/components/use-tone-colors.ts (module-level store +
useSyncExternalStore, false server snapshot, lazy hydration on first subscribe, cross-tab
storage sync, try/catch storage access), src/components/tone-colors-toggle.tsx (chip UI).

1. NEW src/lib/haptics.ts — DOM-free (it is imported by node --test):
   - export const HAPTICS_STORAGE_KEY = "learn-10-mandarin-haptics"
   - export type HapticKind = "correct" | "incorrect"
   - export const HAPTIC_PATTERNS: Record<HapticKind, readonly number[]> =
     { correct: [20], incorrect: [40, 60, 40] }
   - export function normalizeHapticsSetting(value: unknown): boolean  // only exact "on" → true
   - export function serializeHapticsSetting(enabled: boolean): "on" | "off"

2. NEW src/components/use-haptics.ts ("use client") — copy the use-tone-colors.ts store
   structure. Additionally:
   - Detect support as typeof navigator !== "undefined" && "vibrate" in navigator, exposed
     hydration-safely (false server snapshot).
   - export function useHaptics(): { enabled: boolean; supported: boolean; toggle(): void }
     — toggle persists and calls track("haptics_toggled", { enabled: next }).
   - export function vibrateFeedback(kind: HapticKind): void — module-level; MUST lazily
     hydrate the store from localStorage if nothing has subscribed yet (pages like /daily
     never mount the toggle); no-op unless enabled && supported; call
     navigator.vibrate(HAPTIC_PATTERNS[kind]) in try/catch.

3. NEW src/components/haptics-toggle.tsx — chip styled exactly like ToneColorsToggle
   (same classes, min-h-[44px], aria-pressed). Returns null when !supported. Label
   "Vibration"; helper text "Buzz on quiz answers. Saved on this device."; aria-label
   "Turn vibration on" / "Turn vibration off".

4. Mount <HapticsToggle /> in src/components/topic-app.tsx in the existing right-aligned
   preference block (~line 375) alongside <ToneColorsToggle />, stacked cleanly.

5. Add vibrateFeedback(correct ? "correct" : "incorrect") — one line, after correctness is
   known and after each handler's existing guards — in:
   - src/components/topic-app.tsx answerQuiz (~line 142)
   - src/components/practice-app.tsx handleAnswer (~line 89)
   - src/components/daily-app.tsx handleAnswer useCallback (~line 76; module import, do not
     touch the dep array)
   - src/components/lightning-app.tsx handleAnswer (~line 185, after the deadline guard)
   - src/components/duel-app.tsx handleAnswer (~line 136; compute
     const correct = choice === card.answer locally before dispatching answerCurrent,
     guarded on card being non-null)
   Do NOT modify src/components/topic/quiz-panel.tsx (presentation-only).

6. Add "haptics_toggled" to the AnalyticsEvent union in src/lib/analytics.ts.

7. NEW tests/haptics.test.mjs (node --test, import ../src/lib/haptics.ts like
   tests/quiz-logic.test.mjs does): normalize accepts only "on" (test "off", null, "",
   "true", 1, undefined, {} → false); serialize/normalize round-trips; HAPTIC_PATTERNS has
   exactly the two kinds, all positive integers, patterns differ, correct is a single pulse
   ≤ 50ms; storage key starts with "learn-10-mandarin-".

Constraints: no new dependencies, no network, no ProgressState changes (setting lives under
its own localStorage key), no vibration outside the five answer handlers, feature invisible
on unsupported browsers (iOS Safari), no hydration warnings. Match surrounding code style
and comment density.

Validation gate — all must pass before you are done:
  npm run test
  npm run validate:data
  npm run validate:quality
  npm run lint
  npm run build
```

---

I've inspected everything I need — topic page, `TopicApp`, globals.css, types, data helpers, test conventions, and the roadmap ground rules. Here is the plan.

---

## Sprint 19 — Printable topic cheat sheet: print stylesheet and print button on topic pages

### Goal and user value

Give every topic page a clean, paper-friendly one-to-two-page cheat sheet: the topic's ten words (hanzi, tone-marked pinyin, English) plus their example sentences, printable via a "Print cheat sheet" button (or the browser's native Ctrl/Cmd+P). Learners get an offline desk reference for handwriting practice and study away from the screen. Everything is derived from data already in `src/data/topics.json` — no new content, no network, no persistence changes.

### Current-state findings (grounded in actual files)

- **No print handling exists anywhere.** `grep -r "print"` across `src/` finds nothing; `src/app/globals.css` has no `@media print` block. Printing today produces the dark app UI (dark `--background: #020617` body, fixed bottom nav, sticky header) — effectively unusable on paper.
- **Topic page composition**: `src/app/topics/[slug]/page.tsx` is a server component (`generateStaticParams` over `data.topics`, 102 topics) that renders two `JsonLd` blocks plus the client `TopicApp` (`src/components/topic-app.tsx`). This gives a clean seam: a print-only, server-rendered sheet can be added as a sibling of `<TopicApp>` in `page.tsx` with zero client JS.
- **`TopicApp` renders the whole screen UI** inside one `<main>` (topic-app.tsx:199): sticky header, hero with progress/actions, video panel, mode-tab strip, panels, tone practice, and `Toast`. Hiding that single `<main>` in print hides all screen chrome at once. The "lesson-actions row" (topic-app.tsx:286–305, Save list / Mark learned buttons) is the natural home for the print button.
- **Fixed chrome outside `TopicApp`**: `BottomNav` (`src/components/bottom-nav.tsx`, a fixed client nav) is rendered globally in `src/app/layout.tsx:71` and must be hidden in print separately.
- **Data shapes** (`src/lib/types.ts`): `VocabItem = { hanzi, pinyin, english, sentences }`, and `Sentence = { cn, en }` — **sentences have no pinyin field**. The screen UI (`src/components/topic/words-panel.tsx:106–116`) already prints sentences as hanzi + English only. The cheat sheet must match that and not invent sentence pinyin. Word-level pinyin (tone-marked) exists and goes on every Chinese word line.
- **Pinyin rendering**: `TonePinyin` (`src/components/tone-pinyin.tsx`) is a client component whose tone palette (`--color-tone-*` in globals.css:58–62) is tuned for contrast on `#020617`. For black-ink-on-white paper, the sheet should render the raw pinyin string (tone marks already carry tone) — no `TonePinyin`, no client dependency.
- **CJK font**: `.font-hanzi` (globals.css:108) uses Noto Sans SC (loaded in layout.tsx:18–23, `preload: false`) with system CJK fallbacks — safe for print.
- **Tailwind 4** is imported via `@import "tailwindcss"` (globals.css:1); the `print:` variant is available, so `print:hidden` / `hidden print:block` is the idiomatic mechanism.
- **Small client-button precedent**: `src/components/copy-button.tsx` — "use client", graceful capability guard, no network. A `PrintButton` should follow this pattern, including a local `track()` call (`src/lib/analytics.ts` is used the same way in topic-app.tsx:115).
- **Test conventions**: `npm run test` is `node --test`; tests in `tests/*.test.mjs` import TypeScript sources directly (e.g. `tests/share-card-logic.test.mjs` imports `../src/lib/share-card-logic.ts`). Every `src/lib/*-logic.ts` module has a matching test file — a new `print-logic.ts` should too.
- **Useful helpers**: `src/lib/seo.ts` exports `SITE_NAME` and `absoluteUrl(path)` for the sheet's footer source line. `docs/claude-next-sprints.md` ground rules apply (no installs, no invented content, keep diff focused).
- **AGENTS.md warning**: this Next.js 16 build may differ from training data; the sprint touches no new framework APIs (no new routes, only CSS + components), which keeps that risk near zero, but the implementer should still consult `node_modules/next/dist/docs/01-app` if any App Router question comes up.

### Exact implementation steps in sequence

1. **Create `src/lib/print-logic.ts`** — pure, testable helpers (no DOM):
   - `cheatSheetTitle(topic)` → `"Ten Types of Pets · 十种宠物"` (English + Chinese title on one line).
   - `cheatSheetMetaLine(topic)` → `"10 words · Animals & Living Things · Learn 10 Mandarin Words"` (word count from `topic.items.length`, category, `SITE_NAME`).
   - `cheatSheetSourceUrl(topic)` → `absoluteUrl(\`/topics/${topic.slug}\`)`.
2. **Create `tests/print-logic.test.mjs`** — node:test coverage of the three helpers (see Test plan).
3. **Create `src/components/topic/topic-cheat-sheet.tsx`** — a **server** component (no `"use client"`), print-only markup. Root: `<section className="cheat-sheet hidden print:block" aria-hidden="true">`. Contents:
   - Header: title line, meta line, a hairline rule.
   - Words: one compact block per `topic.items` entry — hanzi (large, `.font-hanzi`, `lang={HANZI_LANG}`), pinyin next to it (`.font-hanzi`, `lang={PINYIN_LANG}`, plain string), English; then its sentences indented beneath (cn with `lang={HANZI_LANG}` + en). Each word block gets `break-inside-avoid` so a word never splits across pages. Reuse `HANZI_LANG` / `PINYIN_LANG` from `src/lib/lang.ts` exactly as `words-panel.tsx` does.
   - Footer: source URL line + a short note that progress/audio live in the app.
   - All colors via print-safe utilities (`text-black`, `text-neutral-600`, `border-neutral-300`) — do not reuse the dark-theme tokens.
4. **Create `src/components/print-button.tsx`** — `"use client"`, modeled on `copy-button.tsx`:
   - Renders a pill button matching the lesson-actions row styling, with `print:hidden`.
   - `onClick`: `track("cheat_sheet_print", { topic })` then `window.print()`.
5. **Wire into the topic page** (`src/app/topics/[slug]/page.tsx`): render `<TopicCheatSheet topic={topic} />` as a sibling after `<TopicApp topic={topic} />`.
6. **Hide screen UI in print**:
   - `src/components/topic-app.tsx:199`: add `print:hidden` to the `<main>` className.
   - `src/components/bottom-nav.tsx`: add `print:hidden` to the fixed nav's root className.
   - Add `<PrintButton topic={topic.slug} />` to the lesson-actions row in topic-app.tsx (after "Mark learned").
7. **Add a print block to `src/app/globals.css`** (bottom, own commented section, matching the file's comment style):
   ```css
   @media print {
     @page { margin: 14mm; }
     body { background: #fff; color: #000; }
     .cheat-sheet { color-scheme: light; }
   }
   ```
   (The body flip guarantees no dark ground bleeds through even outside the sheet.)
8. **Run the validation gate** and fix anything it surfaces.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/print-logic.ts` | new — pure text helpers |
| `tests/print-logic.test.mjs` | new — unit tests |
| `src/components/topic/topic-cheat-sheet.tsx` | new — print-only server component |
| `src/components/print-button.tsx` | new — client button |
| `src/app/topics/[slug]/page.tsx` | render cheat sheet |
| `src/components/topic-app.tsx` | `print:hidden` on `<main>`; button in actions row |
| `src/components/bottom-nav.tsx` | `print:hidden` on nav |
| `src/app/globals.css` | `@media print` block |

### Proposed names and TypeScript signatures

```ts
// src/lib/print-logic.ts
export function cheatSheetTitle(topic: Pick<Topic, "titleEn" | "titleCn">): string;
export function cheatSheetMetaLine(topic: Pick<Topic, "items" | "category">): string;
export function cheatSheetSourceUrl(topic: Pick<Topic, "slug">): string;

// src/components/topic/topic-cheat-sheet.tsx (server component)
export function TopicCheatSheet({ topic }: { topic: Topic }): React.JSX.Element;

// src/components/print-button.tsx (client component)
export function PrintButton({ topic }: { topic: string }): React.JSX.Element;
```

### UI copy / microcopy

- Button label: **"Print cheat sheet"**; `aria-label`: `"Print this topic's cheat sheet"`.
- Sheet meta line: `"10 words · {category} · Learn 10 Mandarin Words"`.
- Sentences are labeled implicitly (indented under each word); no extra heading needed. If one is wanted: **"Example sentences"** — but prefer the quiet version.
- Footer: `"Printed from {url} — audio, quizzes, and your progress live in the app."`
- No invented pinyin on sentence lines (the data has none); word lines always show hanzi + pinyin + English.

### Test plan

`tests/print-logic.test.mjs` (node:test + assert/strict, importing `../src/lib/print-logic.ts`, mirroring `share-card-logic.test.mjs`):

1. `cheatSheetTitle` joins `titleEn` and `titleCn` with the `·` separator and contains both verbatim.
2. `cheatSheetMetaLine` reports the real item count (use a 10-item fixture and a 3-item fixture — count must not be hardcoded), the category name, and `SITE_NAME`.
3. `cheatSheetSourceUrl` returns an absolute URL ending in `/topics/{slug}` (consistent with `absoluteUrl` in `seo.ts`).
4. Full gate: `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build` all pass (build also proves the server component compiles into the static topic pages).

### Manual QA checklist

- [ ] `npm run dev`, open `/topics/ten-types-of-pets`, screen UI unchanged (tabs, video, tone practice all present; no visible cheat sheet).
- [ ] "Print cheat sheet" button appears in the actions row next to "Mark learned"; ≥44px tap target; keyboard focus ring visible.
- [ ] Click the button → native print dialog opens; preview shows white background, black text, all ten words with hanzi + pinyin + English, both sentences per word (hanzi + English), header and footer lines.
- [ ] DevTools → Rendering → "Emulate CSS media type: print": app chrome (sticky header, video, tabs, bottom nav, the print button itself) is gone; only the sheet renders.
- [ ] No word block splits across a page boundary; total output ≈ 2 A4 pages.
- [ ] Ctrl/Cmd+P directly (without the button) produces the same sheet.
- [ ] A Useful Phrases topic (phrasebook layout on screen) prints the same word-list sheet.
- [ ] "Save as PDF" filename/title reflects the topic (comes from existing `generateMetadata`).
- [ ] Non-topic page (e.g. `/`) still prints without errors (white body; screen layout — acceptable, out of scope).
- [ ] Tone-colors toggle ON does not affect the printed sheet (plain black pinyin).

### Acceptance criteria

1. Every one of the 102 topic pages prints a legible black-on-white cheat sheet with title, ten words (hanzi, tone-marked pinyin, English), and all example sentences (cn + en), via both the button and native print.
2. No screen chrome (nav, video, tabs, buttons, progress UI) appears in print; no sheet content appears on screen.
3. Zero behavior change to any existing screen feature or localStorage schema; no new dependencies.
4. New `print-logic` unit tests pass; the full validation gate passes.

### Risk and rollback notes

- **`hidden print:block` ordering** — relies on Tailwind emitting the `print:` variant after base utilities (it does; this is the documented pattern). If a stacking issue appears, fall back to an explicit `.cheat-sheet { display: none }` / `@media print { .cheat-sheet { display: block } }` pair in globals.css.
- **Duplicate DOM** — the sheet duplicates word content in the page HTML (~few KB per static page). It's `display: none` on screen, so it is out of the accessibility tree; `aria-hidden` is belt-and-braces. No SEO concern (same-page content).
- **Fonts in print preview** — Noto Sans SC is `preload: false`; the first preview could momentarily use system CJK fallbacks, which are all acceptable print faces.
- **Global body flip** affects printing of non-topic pages (white background under dark components). Strictly an improvement over today; noted as out of scope.
- **Rollback** is trivial and additive: delete the four new files, revert the three one-line class/wiring edits and the CSS block. No data or schema migration involved.

### Non-goals / deferrals

- No per-sentence pinyin (not in the data; would be invented content — prohibited).
- No handwriting trace grids/stroke boxes (possible follow-up; large printed hanzi already support copying).
- No print support for category/favorites/stats pages, no dedicated `/print` route, no PDF generation library, no print of learner progress (progress is device-local and belongs in the app).
- No tone-colored pinyin in print (contrast tuned for dark screens, and ink cost).

### Ready-to-run Opus implementation prompt for Sprint 19

```text
You are implementing Sprint 19 of "Learn 10 Mandarin Words" (Next.js 16 App Router,
React 19, Tailwind 4, static + localStorage-only; repo root is the CWD).

FIRST: read AGENTS.md — this Next.js version may differ from your training data;
consult node_modules/next/dist/docs/01-app if any App Router question arises.
Ground rules: no new packages, no network content, no invented vocabulary or pinyin,
keep the diff focused on this sprint.

GOAL: printable topic cheat sheet — a print stylesheet plus a "Print cheat sheet"
button on topic pages. Printing a topic page must yield a clean black-on-white
1–2 page reference: topic title (EN + 中文), the ten words (hanzi, tone-marked
pinyin, English), and each word's example sentences (hanzi + English — the Sentence
type has NO pinyin field; do not invent any).

IMPLEMENT, in order:
1. src/lib/print-logic.ts (pure, no DOM):
   - cheatSheetTitle(topic: Pick<Topic,"titleEn"|"titleCn">): string → "TitleEn · 中文"
   - cheatSheetMetaLine(topic: Pick<Topic,"items"|"category">): string →
     "{n} words · {category} · {SITE_NAME}" (SITE_NAME from src/lib/seo.ts)
   - cheatSheetSourceUrl(topic: Pick<Topic,"slug">): string → absoluteUrl(`/topics/${slug}`)
2. tests/print-logic.test.mjs — node:test + assert/strict, importing
   ../src/lib/print-logic.ts (mirror tests/share-card-logic.test.mjs). Cover: title
   contains both titles; meta line uses the real item count (test 10- and 3-item
   fixtures), category, and SITE_NAME; source URL is absolute and ends /topics/{slug}.
3. src/components/topic/topic-cheat-sheet.tsx — SERVER component (no "use client").
   Root <section className="cheat-sheet hidden print:block" aria-hidden="true">.
   Header (title + meta line + hairline rule), then one block per topic.items entry:
   hanzi (large, className "font-hanzi", lang={HANZI_LANG}), pinyin (plain string —
   do NOT use TonePinyin — className "font-hanzi", lang={PINYIN_LANG}), English,
   then sentences indented (cn with lang={HANZI_LANG}, en below). HANZI_LANG /
   PINYIN_LANG come from src/lib/lang.ts (see topic/words-panel.tsx for usage).
   Each word block gets break-inside-avoid. Use print-safe utilities (text-black,
   text-neutral-600, border-neutral-300), NOT the dark-theme tokens. Footer:
   "Printed from {cheatSheetSourceUrl(topic)} — audio, quizzes, and your progress
   live in the app."
4. src/components/print-button.tsx — "use client", modeled on copy-button.tsx.
   export function PrintButton({ topic }: { topic: string }). Pill button styled like
   the lesson-actions buttons in topic-app.tsx (min-h-[44px] rounded-full border …),
   plus print:hidden. Label "Print cheat sheet"; aria-label "Print this topic's
   cheat sheet". onClick: track("cheat_sheet_print", { topic }) (src/lib/analytics.ts)
   then window.print().
5. Wiring:
   - src/app/topics/[slug]/page.tsx: render <TopicCheatSheet topic={topic} /> after
     <TopicApp topic={topic} />.
   - src/components/topic-app.tsx: add print:hidden to the top-level <main> className;
     add <PrintButton topic={topic.slug} /> at the end of the lesson-actions row
     (next to "Mark learned").
   - src/components/bottom-nav.tsx: add print:hidden to the fixed nav root.
6. src/app/globals.css — append a commented "── Print (Sprint 19) ──" section:
   @media print { @page { margin: 14mm; } body { background:#fff; color:#000; }
   .cheat-sheet { color-scheme: light; } }

DO NOT change types.ts, progress schema, topics.json, or any quiz/practice logic.

VALIDATE (all must pass; fix failures before finishing):
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build

Then sanity-check via DevTools print emulation reasoning: screen UI unchanged;
in print only the cheat sheet renders. Finish with a short summary of files changed.
```

---

I've inspected the actual panels, the existing shortcut infrastructure, and the repo's modal/dialog patterns. Here is the grounded plan for Sprint 20.

---

## Sprint 20 — Keyboard shortcuts help overlay plus full keyboard support for scramble, match, and boss panels

### Goal and user value

Every activity on the topic page becomes fully playable without a pointer, and the shortcuts become discoverable. Today the `/practice`, `/daily`, `/lightning`, and `/duel` drills have a mature keyboard layer (digits to answer, Enter/→ to advance), but the three newest topic-page games — Scramble, Match, and Boss — have none, and nothing anywhere tells the learner that shortcuts exist. This sprint adds (1) a `?`-triggered "Keyboard shortcuts" modal overlay on the topic page, contextual to the active tab, and (2) shortcut paths through the scramble, match, and boss panels built on the same pure-logic + thin-hook architecture the app already uses. Small, additive, no schema or storage changes.

### Current-state findings grounded in actual files/components/helpers

- **A proven shortcut architecture already exists.** `src/lib/shortcut-logic.ts` is a pure, DOM-free key→intent resolver (`resolvePracticeShortcut`) with universal guards (`hasModifier`, `repeat`, `targetIsEditable`, `targetIsButton`), unit-tested in `tests/shortcut-logic.test.mjs`. `src/components/use-practice-shortcuts.ts` is the thin adapter: one mount-only document `keydown` listener, latest handlers read from a ref, `isEditableTarget`/`isActivationTarget` classifiers. It is wired into `practice-app.tsx:114`, `lightning-app.tsx:204`, `daily-app.tsx:100`, and `duel-app.tsx:150` — but **nothing under `src/components/topic/` uses it** (grep for `aria-keyshortcuts|usePracticeShortcuts` in `src/components/topic/` returns zero hits).
- **A modal dialog pattern already exists twice.** `src/components/onboarding.tsx` (lines 20–80) and `src/components/share-score-button.tsx` (lines 115–150) both implement `role="dialog"` + `aria-modal="true"`, a `FOCUSABLE_SELECTOR` focus trap, Escape-to-close, focus-into-dialog on open, and focus-restore on close. The overlay should copy this pattern verbatim.
- **Keycap styling exists.** `.kbd` in `src/app/globals.css` (line 336) is the established low-ink keycap, used with `hidden md:inline-flex` + `aria-hidden="true"` in `daily-app.tsx:258`, `practice-app.tsx:295`, etc. Real controls carry `aria-keyshortcuts` (`lightning-app.tsx:339`, `daily-app.tsx:250`).
- **ScramblePanel** (`src/components/topic/scramble-panel.tsx`): tap-only. State is `ScrambleState` (`placedIds`) from `src/lib/scramble-logic.ts` with pure `placeTile`/`returnTile`/`isComplete`/`checkArrangement`; `MAX_TILES = 8` (`scramble-logic.ts:19`), so digits 1–8 cover the bank. Distinct phases: arranging (place/unplace/check), solved (Next), done (Try again). Hint toggle at line 180.
- **MatchPanel** (`src/components/topic/match-panel.tsx`): tap-only, 5 hanzi + 5 English tiles per round via `buildMatchingRounds`/`selectTile` from `src/lib/match-logic.ts`. `MatchingState.selected: MatchTile | null` drives selection; a `busy` flag blocks input during the 350 ms mismatch flash; there's a `roundComplete` interstitial ("Round 2" button) and a final summary ("Play again"). It already has an `aria-live` announcement region (`srStatus`).
- **BossPanel** (`src/components/topic/boss-panel.tsx`): tap-only across three phases (`intro`/`running`/`result`) and four stage kinds. `QuizStage` and `ClozeStage` are 4-choice pickers; `ToneStage` is per-syllable 1–5 tone chips + a Check button; `TypingStage` is a form whose `<input id="boss-typing-input">` already submits on Enter natively. Each stage owns local state and is remounted via `key={stageIndex}` (line 217), which makes per-stage hooks clean. `NextButton` (line 256) is shared post-grade.
- **TopicApp** (`src/components/topic-app.tsx`): owns the `mode` union (`"phrasebook" | "words" | ... | "boss"`, line 42) and renders each panel conditionally, so it is the natural place to own the overlay's open state and to disable panel shortcuts while the overlay is open.
- **Interactive elements are all native `<button>`s**, so Tab/Enter/Space already work at a basic level — the gap is the shortcut layer plus discoverability, not focusability.
- Tests import TypeScript directly (`../src/lib/scramble-logic.ts`) under `node --test`; new pure libs get the same treatment. No Next.js-specific APIs are involved (all additions are `"use client"` components/hooks), so no `node_modules/next/dist/docs/` divergence risk beyond what's already in the touched files.

### Exact implementation steps in sequence

1. **Create `src/lib/panel-shortcut-logic.ts`** — pure, DOM-free resolvers modeled on `shortcut-logic.ts`, sharing one `PanelTargetContext` guard shape (`hasModifier`, `repeat`, `targetIsEditable`, `targetIsButton`). Three resolvers:
   - `resolveScrambleShortcut`: digits `1–9` → `place` (0-based, guarded by `bankCount`, only while arranging); `Backspace` → `return-last` (only when ≥1 placed and not solved); `Enter`/`ArrowRight` → `check` when complete-but-unchecked, `next` when solved (Enter suppressed on button targets, mirroring `shortcut-logic.ts:59-62`); `h`/`H` → `toggle-hint`; `r`/`R` → `again` only on the done screen.
   - `resolveMatchShortcut`: while playing and not `busy`: digits `1–5` → `pick-left` when nothing is selected or an English tile is selected; `pick-right` when a hanzi tile is selected (ctx carries `selectedSide: "hanzi" | "english" | null`); `Escape` → `clear-selection` (only when a selection exists — otherwise `null` so Escape stays free); on the interstitial: `Enter`/`ArrowRight` → `continue`; on the final summary: `r`/`R` → `again`.
   - `resolveBossShortcut`: parameterized by stage phase — intro: `Enter` → `start`; choice stages (quiz/cloze) unanswered: digits `1–4` → `choose` (guarded by `choiceCount`); tone stage unchecked: digits `1–5` → `tone` (fills the first unfilled syllable — the panel computes which); `Enter` → `check` when the tone picks are complete; any stage graded: `Enter`/`ArrowRight` → `next`; result phase: `r`/`R` or `Enter` → `again`; cloze/typing input focus is protected by the universal `targetIsEditable` guard.
2. **Create `tests/panel-shortcut-logic.test.mjs`** following the `baseCtx(overrides)` style of `tests/shortcut-logic.test.mjs`: guard short-circuits, digit bounds, phase matrices, Enter-on-button suppression, busy/selected-side branching for match.
3. **Create `src/lib/shortcut-help-logic.ts`** — the overlay's content model as pure data: `ShortcutRow`/`ShortcutGroup` types and `shortcutGroupsFor(kind)` returning a universal "This page" group plus the group for the active panel kind. Add `tests/shortcut-help-logic.test.mjs` (every kind yields non-empty groups, universal group always first, no duplicate key labels within a group).
4. **Create `src/components/use-panel-shortcuts.ts`** — a generic version of `use-practice-shortcuts.ts`: mount-once document listener, ref for latest props, reusing the same `isEditableTarget`/`isActivationTarget` classifiers (extract or duplicate the two 8-line helpers; extraction into the hook file is fine). Takes `{ enabled, resolve, onIntent }` and calls `e.preventDefault()` only when an intent resolves.
5. **Create `src/components/shortcuts-help.tsx`** — a visible trigger button + the modal. The modal copies the `onboarding.tsx` dialog mechanics exactly (focus trap with `FOCUSABLE_SELECTOR`, Escape closes, focus restore). The component also owns the global `?` listener (open when `e.key === "?"`, not editable target, no ctrl/meta/alt — note Shift must NOT be treated as a blocking modifier since `?` is Shift+/). Renders groups from `shortcutGroupsFor` using `.kbd` keycaps.
6. **Wire TopicApp** (`src/components/topic-app.tsx`): add `const [helpOpen, setHelpOpen] = useState(false)`; render `<ShortcutsHelp>` in the row next to `<ToneColorsToggle />` (line 374, `mt-3 flex justify-end` — becomes `justify-between` or gains the trigger); map `mode` → help panel kind; pass `shortcutsEnabled={!helpOpen}` to `ScramblePanel`, `MatchPanel`, `BossPanel`.
7. **Wire ScramblePanel**: add optional `shortcutsEnabled?: boolean` prop (default `true`); call `usePanelShortcuts` above the early returns (hooks-before-returns, same comment pattern as `practice-app.tsx:78`); intents dispatch to the existing `place`/`unplace`/`check`/`next`/`restart`/`setShowHint` handlers (place resolves `bankTiles[index].id`; return-last resolves the last of `state.placedIds`). Add `aria-keyshortcuts={i < 9 ? `${i + 1}` : undefined}` on bank tiles with a `<kbd className="kbd hidden md:inline-flex" aria-hidden="true">` hint, `aria-keyshortcuts="Enter"` on Check order / Next sentence, and `aria-keyshortcuts="Backspace"` on placed tiles.
8. **Wire MatchPanel**: same prop; intents map `pick-left` → `round.hanziTiles[i]`, `pick-right` → `round.englishTiles[i]` through the existing `handleTap` (which already no-ops via `busy`; additionally skip already-matched tiles in the dispatcher), `clear-selection` → `setState((s) => ({ ...s, selected: null }))`, `continue` → `nextRound`, `again` → `playAgain`. Add numeric `.kbd` hints + `aria-keyshortcuts` on tiles (1–5 per column).
9. **Wire BossPanel**: `BossPanel` itself handles intro (`Enter` → `setPhase("running")`) and result (`R`/`Enter` → `restart`) with one hook; each stage component (`QuizStage`, `ClozeStage`, `ToneStage`, `TypingStage`) adds its own `usePanelShortcuts` call — safe because `key={stageIndex}` remounts them and phases are mutually exclusive. ToneStage fills the first `null` entry in `picks` on digits and maps `Enter` to `check`/`NextButton`. TypingStage only needs graded-phase `next` (Enter submit is already native). Thread `shortcutsEnabled` down through `BossStageView`. Add `aria-keyshortcuts` on choices (1–4), tone chips (1–5), and `NextButton` ("Enter").
10. **Run the validation gate** (`npm run test`, `validate:data`, `validate:quality`, `lint`, `build`) and fix anything it surfaces.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/panel-shortcut-logic.ts` | new — pure resolvers for the three panels |
| `src/lib/shortcut-help-logic.ts` | new — overlay content model |
| `src/components/use-panel-shortcuts.ts` | new — generic keydown adapter hook |
| `src/components/shortcuts-help.tsx` | new — trigger button + modal overlay |
| `src/components/topic-app.tsx` | wire overlay state, trigger, `shortcutsEnabled` props |
| `src/components/topic/scramble-panel.tsx` | shortcuts + `aria-keyshortcuts`/`.kbd` hints |
| `src/components/topic/match-panel.tsx` | shortcuts + hints + selection-clear |
| `src/components/topic/boss-panel.tsx` | shortcuts per phase/stage + hints |
| `tests/panel-shortcut-logic.test.mjs` | new — resolver matrices |
| `tests/shortcut-help-logic.test.mjs` | new — help-content invariants |

### Proposed function/component names and TypeScript signatures

```ts
// src/lib/panel-shortcut-logic.ts
export type PanelTargetContext = {
  hasModifier: boolean;   // ctrl/meta/alt only — Shift stays free for "?"
  repeat: boolean;
  targetIsEditable: boolean;
  targetIsButton: boolean;
};

export type ScramblePhase = "arranging" | "solved" | "done";
export type ScrambleShortcut =
  | { type: "place"; index: number }
  | { type: "return-last" }
  | { type: "check" } | { type: "next" }
  | { type: "toggle-hint" } | { type: "again" };
export function resolveScrambleShortcut(
  key: string,
  ctx: PanelTargetContext & { phase: ScramblePhase; bankCount: number; placedCount: number; complete: boolean },
): ScrambleShortcut | null;

export type MatchPhase = "playing" | "interstitial" | "complete";
export type MatchShortcut =
  | { type: "pick-left"; index: number } | { type: "pick-right"; index: number }
  | { type: "clear-selection" } | { type: "continue" } | { type: "again" };
export function resolveMatchShortcut(
  key: string,
  ctx: PanelTargetContext & { phase: MatchPhase; selectedSide: "hanzi" | "english" | null; pairCount: number; busy: boolean },
): MatchShortcut | null;

export type BossKeyPhase =
  | { phase: "intro" } | { phase: "result" }
  | { phase: "choices"; answered: boolean; choiceCount: number }   // quiz + cloze stages
  | { phase: "tones"; checked: boolean; complete: boolean }
  | { phase: "typing"; graded: boolean };
export type BossShortcut =
  | { type: "start" } | { type: "choose"; index: number }
  | { type: "tone"; tone: 1 | 2 | 3 | 4 | 5 }
  | { type: "check" } | { type: "next" } | { type: "again" };
export function resolveBossShortcut(key: string, ctx: PanelTargetContext & BossKeyPhase): BossShortcut | null;
```

```ts
// src/lib/shortcut-help-logic.ts
export type HelpPanelKind = "scramble" | "match" | "boss" | "other";
export type ShortcutRow = { keys: string[]; description: string };
export type ShortcutGroup = { title: string; rows: ShortcutRow[] };
export function shortcutGroupsFor(kind: HelpPanelKind): ShortcutGroup[];
```

```ts
// src/components/use-panel-shortcuts.ts
export function usePanelShortcuts<Intent>(opts: {
  enabled: boolean;
  resolve: (key: string, target: PanelTargetContext) => Intent | null;
  onIntent: (intent: Intent) => void;
}): void;

// src/components/shortcuts-help.tsx
export function ShortcutsHelp(props: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  kind: HelpPanelKind;
}): React.JSX.Element;
```

### UI copy/microcopy

- Trigger button: `Shortcuts` with a `.kbd` "?" keycap; `aria-label="Keyboard shortcuts — press question mark to open"`.
- Dialog title: **Keyboard shortcuts**. Subtitle: *"Press ? anywhere on this page to open this guide. Shortcuts never fire while you're typing."*
- Group **This page**: `?` — Open this guide · `Esc` — Close it · `Tab` — Move between controls.
- Group **Scramble**: `1–8` — Place a tile from the bank · `Backspace` — Return the last placed tile · `Enter` or `→` — Check the order, then next sentence · `H` — Show or hide the word hint · `R` — Try again (results screen).
- Group **Match**: `1–5` — Pick a word on the left · `1–5` again — Pick its match on the right · `Esc` — Clear your selection · `Enter` — Start the next round · `R` — Play again (results screen).
- Group **Boss round**: `Enter` — Start the round, check, and move on · `1–4` — Answer the question · `1–5` — Set the tone for the next syllable · `R` — Challenge again (results screen).
- Close button: **Got it**.

### Test plan

- `tests/panel-shortcut-logic.test.mjs` (node --test, pure): universal guards short-circuit all three resolvers (modifier / repeat / editable target); scramble digit bounds vs `bankCount`, Backspace requires `placedCount > 0`, Enter maps to check-vs-next by phase and is suppressed on button targets while `ArrowRight` is not; match digits route left/right by `selectedSide`, everything nulls while `busy`, Escape nulls with no selection; boss digits gated by `answered`/`checked`/`choiceCount`, typing phase yields nothing until graded, intro/result Enter/R behavior.
- `tests/shortcut-help-logic.test.mjs`: each `HelpPanelKind` returns the universal group first plus at most one panel group; no empty rows; key labels unique per group.
- Full gate: `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build`.

### Manual QA checklist

- [ ] On a topic page, press `?` → overlay opens; `Esc` closes; focus returns to the previously focused element; Tab/Shift+Tab cycle inside the dialog only.
- [ ] Overlay content changes when the active tab is Scramble vs Match vs Boss vs any other tab.
- [ ] `?` does nothing while the Boss typing input (or any input) is focused.
- [ ] Scramble: solve a full card keyboard-only (digits → Enter to check → Enter to advance → R on the summary); Backspace pulls back the last tile; H toggles the hint; digits do nothing after solving.
- [ ] Match: clear both rounds keyboard-only; Esc clears a selection; digits are dead during the rose mismatch flash; Enter advances the interstitial; no double-advance when the round button itself is focused (Enter on a focused button fires exactly once).
- [ ] Boss: complete all four stages keyboard-only, including tones by digits and typed pinyin by normal typing + Enter; Enter starts from the intro and restarts from the result.
- [ ] While the overlay is open, panel shortcuts are inert (digits don't answer underneath the modal).
- [ ] Held keys don't machine-gun (auto-repeat guard); Ctrl/Cmd browser shortcuts are untouched.
- [ ] Focus rings are visible on tiles/choices when tabbing (add `focus-visible` classes if any control lacks one).
- [ ] Mobile viewport: `.kbd` hints hidden below `md`; trigger button still tappable (≥44 px); touch play unchanged.

### Acceptance criteria

1. Scramble, Match, and Boss are each completable start-to-finish with keyboard only, with no pointer use and no double-fired actions.
2. A `?` key press (outside text inputs) and a visible "Shortcuts" button both open an accessible modal (`role="dialog"`, `aria-modal`, focus trap, Escape, focus restore) listing the shortcuts for the active tab.
3. Shortcut-bearing controls carry `aria-keyshortcuts`; desktop-only `.kbd` hints match the existing `/practice` visual register.
4. Shortcuts never fire during text entry, with a held modifier, on key auto-repeat, or while the overlay is open.
5. All five gate commands pass; no changes to localStorage schema, vocabulary data, or routes.

### Risk and rollback notes

- **Enter double-fire** on focused buttons is the classic hazard here; it's mitigated by reusing the `targetIsButton` suppression already proven in `shortcut-logic.ts:59-62` — keep `ArrowRight` as the button-safe advance.
- **Listener collisions**: the overlay, TopicApp-level `?`, and per-panel hooks are all document-level listeners. Mutually exclusive phase guards plus the `shortcutsEnabled={!helpOpen}` prop keep them disjoint; the resolver-returns-null-means-no-preventDefault contract keeps unclaimed keys native.
- **Boss stage remounts**: per-stage hooks rely on `key={stageIndex}` remounting; if that key is ever removed, stale listeners could linger — the hook's cleanup-on-unmount covers it either way.
- **Rollback**: purely additive UI layer — two new libs, two new components, three panels touched. Reverting the single sprint commit restores current behavior exactly; no data migration to unwind.

### Non-goals / deferrals

- No shortcuts for the topic-page Quiz, Sentences (cloze), Type, Cards, or Words tabs (Quiz/cloze can adopt the same resolver pattern in a later sprint).
- No roving-tabindex / arrow-key 2D grid navigation for the match board — native Tab order plus digit shortcuts is the shippable slice.
- No `?` overlay on `/practice`, `/daily`, `/lightning`, `/duel` (the component is reusable; wiring those routes is a follow-up).
- No persistence of "has seen the overlay", no first-visit auto-open, no shortcut customization.
- No `P`-to-pronounce inside boss/scramble (SpeakButtons remain click/Tab targets).

### Ready-to-run Opus implementation prompt for Sprint 20

```text
You are implementing Sprint 20 of the Learn 10 Mandarin Words app (Next.js 16 / React 19 / Tailwind 4,
static/local-first, no backend). Read AGENTS.md first — this Next.js version may differ from your
training data; consult node_modules/next/dist/docs/ if any framework question arises (this sprint is
client-component-only, so none is expected).

GOAL
Add (1) a "?"-triggered keyboard-shortcuts help overlay on the topic page and (2) full keyboard
shortcut support for the Scramble, Match, and Boss panels. Follow the repo's established pattern:
pure DOM-free key→intent resolvers in src/lib + a thin document-keydown hook in src/components.

STUDY FIRST (do not skip)
- src/lib/shortcut-logic.ts and src/components/use-practice-shortcuts.ts — the architecture to mirror
  (universal guards: hasModifier=ctrl/meta/alt, repeat, targetIsEditable, targetIsButton; Enter
  suppressed on button targets, ArrowRight not; preventDefault only when an intent resolves).
- tests/shortcut-logic.test.mjs — the baseCtx(overrides) test style; tests import ../src/lib/*.ts.
- src/components/onboarding.tsx (lines 20–80) — the dialog pattern to copy: role="dialog",
  aria-modal, FOCUSABLE_SELECTOR focus trap, Escape closes, focus restore on unmount.
- .kbd class in src/app/globals.css and its usage in daily-app.tsx (kbd hidden md:inline-flex,
  aria-hidden, with aria-keyshortcuts on the real control).
- The three panels: src/components/topic/scramble-panel.tsx, match-panel.tsx, boss-panel.tsx, and
  their libs src/lib/scramble-logic.ts, match-logic.ts, boss-logic.ts. Note MatchPanel's `busy`
  mismatch-flash flag and BossPanel's key={stageIndex} stage remounting.
- src/components/topic-app.tsx — owns the mode union and renders the panels.

BUILD
1. src/lib/panel-shortcut-logic.ts — pure resolvers sharing a PanelTargetContext:
   - resolveScrambleShortcut(key, ctx{phase:"arranging"|"solved"|"done", bankCount, placedCount,
     complete, ...target}): digits 1–9 → {place,index} (bounds-checked, arranging only);
     Backspace → return-last (placedCount>0, not solved); Enter/ArrowRight → check (complete &&
     arranging) or next (solved), Enter suppressed on buttons; h/H → toggle-hint (not done);
     r/R → again (done only).
   - resolveMatchShortcut(key, ctx{phase:"playing"|"interstitial"|"complete", selectedSide, pairCount,
     busy, ...target}): playing+!busy: digits 1–5 → pick-left when selectedSide is null|"english",
     pick-right when "hanzi"; Escape → clear-selection only when selectedSide != null; interstitial:
     Enter/ArrowRight → continue (Enter suppressed on buttons); complete: r/R → again.
   - resolveBossShortcut(key, ctx = target & ({phase:"intro"} | {phase:"result"} |
     {phase:"choices",answered,choiceCount} | {phase:"tones",checked,complete} |
     {phase:"typing",graded})): intro Enter→start; choices unanswered digits 1–4→choose; tones
     unchecked digits 1–5→tone, Enter→check when complete; any graded/answered/checked stage
     Enter/ArrowRight→next; result Enter or r/R→again. Enter always suppressed on button targets.
   All resolvers short-circuit on hasModifier/repeat/targetIsEditable. Shift is NOT a modifier here.
2. src/lib/shortcut-help-logic.ts — HelpPanelKind = "scramble"|"match"|"boss"|"other";
   shortcutGroupsFor(kind) returns a universal "This page" group (? / Esc / Tab) first, plus the
   matching panel group. Use this copy verbatim:
   Scramble: "1–8 Place a tile from the bank", "Backspace Return the last placed tile",
   "Enter or → Check the order, then next sentence", "H Show or hide the word hint",
   "R Try again (results screen)". Match: "1–5 Pick a word on the left", "1–5 again Pick its match
   on the right", "Esc Clear your selection", "Enter Start the next round", "R Play again (results
   screen)". Boss: "Enter Start the round, check, and move on", "1–4 Answer the question",
   "1–5 Set the tone for the next syllable", "R Challenge again (results screen)".
3. src/components/use-panel-shortcuts.ts — generic hook usePanelShortcuts<Intent>({enabled, resolve,
   onIntent}); mirror use-practice-shortcuts.ts exactly (ref for latest props, mount-once listener,
   isEditableTarget/isActivationTarget classifiers, preventDefault only on a resolved intent).
4. src/components/shortcuts-help.tsx — ShortcutsHelp({open, onOpen, onClose, kind}): a quiet
   "Shortcuts" trigger button with a .kbd "?" keycap (aria-label "Keyboard shortcuts — press question
   mark to open"), plus the modal copied from onboarding.tsx mechanics. Dialog title "Keyboard
   shortcuts"; subtitle "Press ? anywhere on this page to open this guide. Shortcuts never fire while
   you're typing."; close button "Got it". The component registers the document-level "?" opener
   (skip when target is editable or ctrl/meta/alt held; Shift is required for "?" so allow it).
   Render rows with .kbd keycaps; match the app's dark surface/emerald visual language.
5. Wire src/components/topic-app.tsx: const [helpOpen, setHelpOpen] = useState(false); render
   ShortcutsHelp beside ToneColorsToggle in the mt-3 row (justify-between); map mode→kind
   (scramble/match/boss → themselves, else "other"); pass shortcutsEnabled={!helpOpen} to
   ScramblePanel, MatchPanel, BossPanel.
6. Wire the three panels (add optional shortcutsEnabled?: boolean = true prop to each):
   - ScramblePanel: usePanelShortcuts ABOVE the early returns (hooks-before-returns; see
     practice-app.tsx:78 comment pattern). place → bankTiles[index]?.id via place(); return-last →
     last of state.placedIds via unplace(); check/next/again/toggle-hint → existing handlers.
     aria-keyshortcuts numbers + kbd hints on bank tiles, "Backspace" on placed tiles, "Enter" on
     Check order / Next sentence / Try again.
   - MatchPanel: pick-left → round.hanziTiles[i], pick-right → round.englishTiles[i], dispatched
     through handleTap but skipping tiles whose key is already matched; clear-selection →
     setState(s => ({...s, selected: null})); continue → nextRound; again → playAgain.
     aria-keyshortcuts 1–5 per column + kbd hints (hidden md:inline-flex).
   - BossPanel: one hook at panel level for intro (Enter→setPhase("running")) and result
     (Enter/R→restart), enabled only in those phases; one hook inside each stage component
     (QuizStage/ClozeStage: digits→answer(card.choices[i]), Enter/→→NextButton's onResolve;
     ToneStage: digits fill the first null entry in picks, Enter→check then next; TypingStage:
     only graded-phase next — native form Enter already submits). Thread shortcutsEnabled through
     BossStageView. aria-keyshortcuts on choices (1–4), tone chips (1–5), NextButton ("Enter").
7. Tests: tests/panel-shortcut-logic.test.mjs and tests/shortcut-help-logic.test.mjs in the
   baseCtx(overrides) style — cover guard short-circuits, digit bounds, phase matrices,
   Enter-on-button suppression, match busy/selectedSide branching, boss per-phase gating, and
   help-content invariants (universal group first, non-empty rows, unique keys per group).

CONSTRAINTS
- Read-only data: no changes to topics.json, localStorage schema, routes, or dependencies.
- Keep pinyin/hanzi rendering untouched; the overlay is English-only (no lang-attr concerns).
- Match existing comment density and style; comments explain constraints, not narration.
- Do not break existing usePracticeShortcuts consumers; do not modify shortcut-logic.ts.

VALIDATION GATE (all must pass before you finish)
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build

Manual sanity (dev server): keyboard-only full run of Scramble, Match (both rounds), and Boss (all
four stages incl. typed pinyin); ? opens the overlay, Esc closes with focus restored, panel keys are
inert while it's open, and typing in the boss input never triggers shortcuts.
```

---

All findings are in — I have everything needed to write a grounded plan. Here is the sprint plan.

---

## Sprint 21 — Screen-reader announcement pass: aria-live for quiz verdicts, combo changes, and timer milestones

### Goal and user value

Screen-reader users can play the topic quiz and the Lightning Round without sight of the color flashes: every answer gets a spoken verdict ("Correct!" / "Not quite — the answer is 好, hǎo"), combo gains and breaks are announced, and the 60-second Lightning timer speaks its 30s / 10s / 5s milestones plus a final "time's up" result. All feedback that today lives only in `animate-quiz-correct` / `animate-quiz-wrong` CSS flashes and color-tier chips becomes audible. No visual changes, no data changes, fully local.

### Current-state findings (grounded in actual files)

**The app already has a house live-region style to follow.** `src/components/topic/match-panel.tsx:56,131-135` keeps an `announcement` string in state rendered into a persistent `<p className="sr-only" role="status" aria-live="polite">`, set on each match ("Matched hello") and cleared on round reset. `src/components/tone-listen-trainer.tsx:302` uses a persistent `aria-live="polite"` sr-only span for streak notes. `src/components/toast.tsx:23-24` uses `role="status"` + `aria-live="polite"`. Result screens across the app (`boss-panel.tsx:546`, `daily-app.tsx:275`, `duel-app.tsx:561`) mark their verdict block `role="status"`.

**Gap 1 — quiz verdicts are visual-only.** In `src/components/topic/quiz-panel.tsx:276-300`, the correct/wrong verdict after `onAnswer` is conveyed exclusively by button styling (`animate-quiz-correct` / `animate-quiz-wrong`, lines 289-290) and `aria-selected`. Nothing announces "correct" or "wrong", and in the three non-listening modes nothing announces the right answer. (Listening mode is the partial exception: the post-answer reveal at line 249 is `role="status"`, but it reads only the hanzi + pinyin, not a verdict.)

**Gap 2 — combo announcements are incomplete and can double-fire against a future verdict region.** `quiz-panel.tsx:198-200` has an `aria-live="polite"` span carrying `comboMilestoneLabel(quizState.combo)` — milestones ×3/×5/×10 are announced (per `src/lib/combo-logic.ts:37-50`), but combo *breaks* are silent. Notably, `QuizViewState.brokenCombo` (`quiz-panel.tsx:20`) is computed in `topic-app.tsx:162` on every wrong answer and passed down, but **is never rendered anywhere** — it's ready-made fuel for a "combo broken at ×N" announcement.

**Gap 3 — the Lightning Round is almost entirely silent.** In `src/components/lightning-app.tsx`:
- The countdown (lines 276-283) has `role="timer"` with an `aria-label` — screen readers correctly do *not* announce `role="timer"` content changes, and there are no milestone announcements. The visual urgency shifts at `AMBER_MS` (10s) and `DANGER_MS` (5s) (`lightning-app.tsx:39-40`) are color-only.
- Answer verdicts flash for `FEEDBACK_MS` (350ms, line 34) and auto-advance — never announced.
- The combo chip (lines 300-309) has an `aria-label` but is not a live region; multiplier changes (`multiplierFor`, `lightning-logic.ts:174-177`) are silent.
- The results screen (lines 361-411) — "Time's up!" / "New personal best!" + score — has no `role="status"`, so the round ends in silence.

**Scope note:** `duel-app.tsx` has no countdown timer (verified by grep), so "timer milestones" means the Lightning Round only. Duel/boss/daily verdicts already have `role="status"` blocks and are out of scope.

**Test infrastructure:** all tests are pure `node --test` `.mjs` files in `tests/` importing lib code with explicit `.ts` extensions (see `tests/lightning-logic.test.mjs:1-17`); there is no React component test rig. So announcement *logic* must live in a pure lib module. Also noted: `combo-logic.ts` currently has zero test coverage (no test file references it).

### Exact implementation steps in sequence

1. **Create `src/lib/announce-logic.ts`** — pure, DOM-free announcement-string helpers (mirrors the `combo-logic.ts` pure-helper convention, header comment included). Contents:
   - `quizVerdictAnnouncement(correct, answer, answerPinyin?)` — verdict + right answer, appending pinyin when provided (satisfies the pinyin-on-Chinese-lines rule in spoken form).
   - `comboChangeAnnouncement({ combo, brokenCombo })` — returns `comboMilestoneLabel(combo)` prefixed with "Combo " on exact milestones (reuses `combo-logic.ts` so copy stays single-sourced), `"Combo broken at ×N."` when `brokenCombo ≥ 2` (matches the ≥2 chip-visibility threshold at `quiz-panel.tsx:190`), else `null`.
   - `multiplierAnnouncement(prevMultiplier, multiplier)` — Lightning: `"Combo ×2 — double points."` / `"Combo ×3 — triple points."` on a rise, `"Combo lost."` on a reset from >1, else `null`.
   - `TIMER_ANNOUNCE_SECONDS = [30, 10, 5]` and `crossedTimerMilestone(prevMs, currMs)` — returns the largest milestone crossed between two ticks (or `null`), tolerant of the 100ms `TICK_MS` granularity and of a backgrounded tab skipping past several milestones at once (announce only the lowest one crossed, e.g. resume at 4s → announce 5s milestone only).
   - `timerMilestoneAnnouncement(seconds)` — `"30 seconds left."` etc.
2. **Create `tests/announce-logic.test.mjs`** covering all helpers (exact-milestone-only firing, broken-combo threshold, multiplier rise/reset/steady, milestone crossing incl. multi-milestone jump and no-cross ticks, garbage-input tolerance per house defensive style).
3. **Wire `src/components/topic/quiz-panel.tsx`:**
   - Add one persistent sr-only live region near the top of the quiz `<section>`: `<p className="sr-only" aria-live="polite" aria-atomic="true">` whose content is derived (no new state): when `quizState.picked !== null`, render `quizVerdictAnnouncement(picked === currentQuiz.answer, currentQuiz.answer, …)` followed by `comboChangeAnnouncement({combo, brokenCombo})`. The answer substring is wrapped in `<span lang={quizChoiceLang(quizMode)}>` (helper already imported patterns exist at line 294) so hanzi/pinyin answers are voiced correctly. Empty string when unanswered — advancing to the next card silently clears it.
   - Remove `aria-live` from the visible milestone span at line 198 (keep the visible flash) so milestones aren't spoken twice; the new region owns all speech.
   - In listening mode, pass no answer restatement into the verdict (just "Correct!" / "Not quite.") since the existing `role="status"` reveal at line 249 already announces the ground-truth hanzi + pinyin.
4. **Wire `src/components/lightning-app.tsx`:**
   - Add `const [announcement, setAnnouncement] = useState("")` (answer/combo channel) and `const [timerAnnouncement, setTimerAnnouncement] = useState("")` (timer channel), each rendered as a persistent sr-only `aria-live="polite" aria-atomic="true"` element inside the running `<section>`. Two regions so a timer milestone never overwrites an in-flight verdict; polite announcements queue.
   - In `handleAnswer` (line 185): after `setRun`, compose verdict + `multiplierAnnouncement(run.multiplier, applyAnswer(run, correct).multiplier)` into `setAnnouncement(...)`. Keep it terse — the round auto-advances every ~350ms.
   - In the timer effect's `tick` (line 132): track the previous remaining in a ref, call `crossedTimerMilestone(prevRef.current, rem)`, and `setTimerAnnouncement(timerMilestoneAnnouncement(m))` when non-null. Reset the ref and both announcement states in `startRound`.
   - Results screen: add `role="status"` to the results card's inner headline wrapper (the `newBest ? … : …` block at lines 364-385) so "Time's up! / New personal best!" + score is announced once on mount — same pattern as `boss-panel.tsx:546`.
5. Run the full gate (`npm run test`, `validate:data`, `validate:quality`, `lint`, `build`) and do the manual QA pass below.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/announce-logic.ts` | **new** — pure announcement helpers |
| `tests/announce-logic.test.mjs` | **new** — unit tests |
| `src/components/topic/quiz-panel.tsx` | verdict+combo live region; strip `aria-live` from visible milestone span |
| `src/components/lightning-app.tsx` | verdict/combo + timer live regions; `role="status"` on results |

### Proposed function/component names and TypeScript signatures

```ts
// src/lib/announce-logic.ts
export function quizVerdictAnnouncement(
  correct: boolean,
  answer?: string,
  answerPinyin?: string | null,
): string;

export function comboChangeAnnouncement(opts: {
  combo: number;
  brokenCombo: number;
}): string | null;

export function multiplierAnnouncement(prevMultiplier: number, multiplier: number): string | null;

export const TIMER_ANNOUNCE_SECONDS: readonly number[]; // [30, 10, 5]
export function crossedTimerMilestone(prevMs: number, currMs: number): number | null;
export function timerMilestoneAnnouncement(seconds: number): string;
```

No new components — both consumers render inline sr-only `<p>` elements per the `match-panel.tsx:131-135` pattern.

### UI copy / microcopy (all screen-reader-only)

- Verdict: **"Correct!"** · **"Not quite — the answer is {answer} ({pinyin})."** (pinyin segment only when the answer line is Chinese)
- Combo milestone (reuses `MILESTONE_LABELS` verbatim): **"Combo ×3 — heating up!"**, **"Combo ×5 — on fire!"**, **"Combo ×10 — unstoppable!"**
- Combo break: **"Combo broken at ×{n}."**
- Lightning multiplier: **"Combo ×2 — double points."** · **"Combo ×3 — triple points."** · **"Combo lost."**
- Timer: **"30 seconds left."** · **"10 seconds left."** · **"5 seconds left."**
- Results (existing visible copy, now announced): "Time's up!" / "New personal best!" + score.

### Test plan

`tests/announce-logic.test.mjs` (node --test, importing `../src/lib/announce-logic.ts`):
- Verdict: correct with/without answer; wrong includes answer; pinyin appended only when given.
- Combo: milestone strings at exactly 3/5/10 and `null` at 4/6/11; break announced at `brokenCombo` ≥ 2, `null` below; break wins/combines sensibly when both could apply (they can't in practice — a wrong answer zeroes `combo`).
- Multiplier: 1→2 and 2→3 announce; 3→3 silent; 3→1 announces "Combo lost."; 1→1 silent; garbage input → `null`.
- Timer: 30_100→29_900 → 30; 5_050→4_950 → 5; 29_900→29_800 → `null`; tab-resume jump 31_000→3_000 → 5 (lowest crossed only); equal-boundary tick doesn't double-fire.

Component wiring is not unit-testable here (no React test rig in this repo) — covered by manual QA.

### Manual QA checklist

- [ ] VoiceOver (Safari/macOS or iOS) and NVDA or Orca: on a topic quiz, answer correctly → hears "Correct!"; answer wrong → hears "Not quite — the answer is …" with hanzi/pinyin voiced under the right language.
- [ ] Reach ×3 → hears "Combo ×3 — heating up!" exactly once (not repeated at ×4); break a ×3+ streak → "Combo broken at ×3."
- [ ] Milestone text still flashes visibly; it is not spoken twice.
- [ ] Listening mode: verdict is spoken and the answer reveal is not read twice.
- [ ] Lightning: start a round; hear "30 / 10 / 5 seconds left" at the right moments; verdicts and "Combo ×2" announce without cutting off the timer milestones; results screen announces "Time's up" (or "New personal best") + score.
- [ ] Background the tab past a milestone and return → at most one (the lowest) milestone announced, no burst.
- [ ] Sighted regression: quiz and lightning look pixel-identical; keyboard shortcuts (1–4, P, R) unaffected.

### Acceptance criteria

1. Every quiz answer (all four modes) produces exactly one polite announcement containing the verdict, and the correct answer when wrong.
2. Combo milestones announce once each; combo breaks ≥×2 announce with the lost streak size; no double-speak from the visible flash.
3. Lightning announces multiplier rises/resets, 30/10/5-second milestones, and the end-of-round result.
4. No visible UI change; no new localStorage keys; all five gate commands pass.

### Risk and rollback notes

- **Announcement spam in Lightning** (an answer every ~1–2s): mitigated by terse copy and `aria-live="polite"` (queued, never interruptive). If QA finds it noisy, drop per-answer verdicts in Lightning to multiplier-changes-only — a one-line change in `handleAnswer`.
- **Repeat-content non-announcement**: identical consecutive strings in a live region may not re-announce; verdict strings vary by answer word, and the region clears to `""` between questions, so this shouldn't bite. Watch for it on two identical "Correct!" listening-mode answers in a row; if seen, append the prompt word.
- **Mounted `role="status"` reliability** on the results screen varies by SR; it's the established house pattern (boss/daily/duel), so behavior stays consistent app-wide.
- **Rollback**: purely additive — revert the two component diffs; `announce-logic.ts` and its tests are inert if unused.

### Non-goals / deferrals

- Duel, boss round, daily challenge, typing/cloze/scramble panels — they already have `role="status"` verdict blocks; auditing their copy is a future sprint.
- No focus-management or keyboard-navigation changes; no `aria-live="assertive"` anywhere.
- No visible-UI changes, no settings toggle for announcement verbosity, no speech-synthesis (this is SR text, not TTS).
- Backfilling `combo-logic.ts` unit tests (currently zero coverage) — worth doing, but only the parts `announce-logic` touches get indirect coverage this sprint.

### Ready-to-run Opus implementation prompt for Sprint 21

```
You are implementing Sprint 21 of the "Learn 10 Mandarin Words" app (Next.js 16 / React 19 /
Tailwind 4, static, local-first). Per AGENTS.md, read the relevant guides in
node_modules/next/dist/docs/ before writing code — this Next.js version differs from training data.

GOAL: screen-reader announcements (aria-live) for quiz verdicts, combo changes, and Lightning
Round timer milestones. Screen-reader-only; zero visual changes; no new deps or storage keys.

1. NEW src/lib/announce-logic.ts — pure, DOM-free helpers (follow combo-logic.ts's header-comment
   and defensive-input style; explicit `.ts` extension on the combo-logic import so node --test
   resolves it):
   - quizVerdictAnnouncement(correct: boolean, answer?: string, answerPinyin?: string | null): string
     → "Correct!" or "Not quite — the answer is {answer} ({pinyin})." (pinyin segment only when given).
   - comboChangeAnnouncement({combo, brokenCombo}: {combo: number; brokenCombo: number}): string | null
     → "Combo " + comboMilestoneLabel(combo) on exact milestones (reuse combo-logic.ts — do not
     duplicate copy); "Combo broken at ×{brokenCombo}." when brokenCombo >= 2; else null.
   - multiplierAnnouncement(prev: number, curr: number): string | null → "Combo ×2 — double points." /
     "Combo ×3 — triple points." on a rise, "Combo lost." on reset from >1, else null.
   - TIMER_ANNOUNCE_SECONDS = [30, 10, 5]; crossedTimerMilestone(prevMs, currMs): number | null
     (largest→lowest: return only the LOWEST milestone crossed when a backgrounded tab skips
     several; null when none crossed; no double-fire on boundary ticks);
     timerMilestoneAnnouncement(seconds: number): string → "{seconds} seconds left."

2. NEW tests/announce-logic.test.mjs (node:test + node:assert/strict, import from
   "../src/lib/announce-logic.ts"): exact-milestone-only combo firing (3/5/10 announce; 4/6/11 null),
   brokenCombo threshold, multiplier rise/steady/reset/garbage, timer crossing incl. multi-milestone
   jump (31_000→3_000 → 5) and no-cross tick, verdict with/without answer and pinyin.

3. EDIT src/components/topic/quiz-panel.tsx:
   - Add ONE persistent live region inside the quiz <section>:
     <p className="sr-only" aria-live="polite" aria-atomic="true">…</p>, content DERIVED (no new
     state): when quizState.picked !== null render the verdict (picked === currentQuiz.answer)
     followed by comboChangeAnnouncement({combo: quizState.combo, brokenCombo: quizState.brokenCombo});
     empty otherwise. Wrap the answer substring in <span lang={quizChoiceLang(quizMode)}> (already
     imported from @/lib/lang). In listening mode omit the answer restatement (the role="status"
     reveal already reads hanzi+pinyin) — just "Correct!" / "Not quite.".
   - REMOVE aria-live from the visible milestone span (currently line ~198) so milestones aren't
     spoken twice; keep it visible.

4. EDIT src/components/lightning-app.tsx:
   - Two useState strings: `announcement` (verdict+multiplier) and `timerAnnouncement`, each
     rendered as a persistent sr-only <p aria-live="polite" aria-atomic="true"> inside the running
     section. Reset both (and the prev-remaining ref) in startRound.
   - handleAnswer: compute the next run via applyAnswer, then setAnnouncement(verdict +
     multiplierAnnouncement(run.multiplier, nextRun.multiplier) when non-null). Keep copy terse.
   - Timer effect tick: keep prev remaining in a ref; on crossedTimerMilestone(prev, rem) non-null,
     setTimerAnnouncement(timerMilestoneAnnouncement(m)).
   - Results screen: add role="status" to the headline block (the newBest ternary wrapper) so
     "Time's up!"/"New personal best!" + score announces on mount (same pattern as boss-panel.tsx:546).

CONSTRAINTS: no visual/layout changes; aria-live="polite" only (never assertive); pinyin must
accompany hanzi in announcements; follow the existing sr-only live-region house style
(match-panel.tsx:131). Do not touch duel/boss/daily/typing/cloze/scramble panels.

VALIDATION GATE (all must pass):
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build
```

---

I have everything I need — the repo has a perfect precedent to mirror (the Sprint 10 tone-colors preference), and I've inventoried every large-hanzi render site. Here is the plan.

---

## Sprint 22 — Hanzi text-size preference: three character-size levels applied across all practice surfaces

### Goal and user value

Let learners pick one of three hanzi size levels — **Standard**, **Large**, **Extra large** — persisted per-device in localStorage and applied to the character prompts on every practice surface (flashcards, quiz, typing, cloze, scramble, boss, words list, daily review, practice, daily challenge, lightning, duel, tone practice, tone listen trainer). Larger glyphs make stroke detail legible for low-vision learners and anyone studying unfamiliar characters. Off-by-default (Standard = today's sizes), zero effect until the learner opts in.

### Current-state findings grounded in actual files/components/helpers

- **There is an exact architectural precedent to copy: the "Tone colors" preference (Sprint 10).** It is split into:
  - `src/lib/tone-colors.ts` — pure, DOM-free helpers: storage key constant (`learn-10-mandarin-tone-colors`), `normalizeToneColorsSetting(value: unknown)` (garbage-tolerant coercion with a safe default), `serializeToneColorsSetting`, and a static class map `TONE_TEXT_CLASS` (full literal Tailwind class strings so the JIT compiler sees them). Its header comment explicitly says device-local UI preferences live under their own localStorage key, **not** in `ProgressState`, mirroring `src/lib/video-controls.ts`.
  - `src/components/use-tone-colors.ts` — a module-level store subscribed via `useSyncExternalStore` with a server snapshot of the default value (no hydration mismatch; hydrates from localStorage on first subscribe), cross-tab sync via the `storage` event, try/catch around all storage access for private-mode safety, and a `track("tone_colors_toggled", …)` analytics call.
  - `src/components/tone-colors-toggle.tsx` — a quiet right-aligned chip with `aria-pressed`, 44px min tap target, and "Saved on this device." microcopy.
- **The toggle is mounted in exactly two places**: `src/components/topic-app.tsx:375` (under the mode tabs) and `src/components/review-app.tsx:215` (session header). The new size control belongs in the same two rows.
- **Hanzi render sites cluster into a small number of base sizes** (all `font-hanzi`, all carrying `lang={HANZI_LANG}` from `src/lib/lang.ts`):
  - `text-7xl` heroes: `src/components/topic/flashcards-panel.tsx:175`, `src/components/topic/typing-panel.tsx:124`, `src/components/topic/quiz-panel.tsx:262`, `src/components/review-app.tsx:384`, `src/components/practice-app.tsx:269`, `src/components/daily-app.tsx:222`, `src/components/duel-app.tsx:507`, `src/components/lightning-app.tsx:314`.
  - `text-6xl` prompts: `src/components/topic/boss-panel.tsx:299`, `src/components/tone-practice.tsx:84`.
  - `text-5xl` prompts: `src/components/topic/quiz-panel.tsx:251` (pinyin/cloze-style prompt), `src/components/tone-listen-trainer.tsx:241`.
  - `text-4xl` word cards: `src/components/topic/words-panel.tsx:84`, plus the compact flashcard/review backs at `flashcards-panel.tsx:181` and `review-app.tsx:390`.
  - `text-3xl` sentence: cloze sentence at `src/components/topic/cloze-panel.tsx:129`.
  - `text-2xl` tiles/choices: scramble tiles at `scramble-panel.tsx:219,230,247`, cloze choices at `cloze-panel.tsx:179,192`.
- **Three hero sites stack conflicting size utilities today**: `quiz-panel.tsx:262`, `daily-app.tsx:222`, and `duel-app.tsx:507` render `font-hanzi text-7xl … ${mode === "english-hanzi" ? "font-sans text-4xl" : ""}` — two font-size utilities on one element, resolved only by Tailwind's stylesheet order. Threading a dynamic size class into that ternary would make the conflict worse; these three call sites should be restructured to emit exactly one size class per branch (the English-prompt branch must **not** scale — it isn't hanzi).
- **Match panel tiles** (`match-panel.tsx:165,247`, `text-lg`/`text-2xl`) live inside a fixed grid where enlarging text risks overflow — defer (see Non-goals).
- **Tests** are Node built-in runner (`npm run test` → `node --test`), pure-lib only, importing TS directly with explicit extension (see `tests/video-controls.test.mjs` importing `../src/lib/video-controls.ts`). No component/DOM tests exist — so all logic must live in the pure lib.
- `src/lib/analytics.ts` provides `track(event, props)` (used by the tone-colors hook).
- `AGENTS.md` warning applies: this is a breaking-changes Next.js 16 — but this sprint is entirely client-component + Tailwind work, no new framework surface.

### Exact implementation steps in sequence

1. **Create `src/lib/hanzi-size.ts`** (pure, DOM-free, modeled on `tone-colors.ts`): the `HanziSize` union, storage key `"learn-10-mandarin-hanzi-size"`, ordered `HANZI_SIZES` list, `DEFAULT_HANZI_SIZE = "standard"`, `normalizeHanziSize` (only exact `"large"` / `"xl"` strings map; everything else → `"standard"`), `serializeHanziSize`, `hanziSizeLabel`, and the `HANZI_SIZE_CLASS` role→size class map with **full literal Tailwind strings** (each role bumps one text-size step per level; see signatures below).
2. **Create `src/components/use-hanzi-size.ts`**: copy the `use-tone-colors.ts` module-store verbatim, adapted from boolean to `HanziSize` (same `useSyncExternalStore`, server snapshot `"standard"`, first-subscribe hydration, `storage`-event cross-tab sync, try/catch storage access). `setSize` fires `track("hanzi_size_changed", { size })`.
3. **Create `src/components/hanzi-size-control.tsx`**: a right-aligned three-chip segmented control styled like `tone-colors-toggle.tsx` (44px min tap targets, emerald active state). Semantics: `role="radiogroup"` with `aria-label="Hanzi size"`, each chip `role="radio"` + `aria-checked`. Each chip renders 字 in `font-hanzi` at an escalating preview size (`text-sm` / `text-lg` / `text-2xl`) with an `aria-label` giving the level name.
4. **Mount the control** next to `ToneColorsToggle` in `topic-app.tsx` (~line 375) and `review-app.tsx` (~line 215) — wrap both in one `flex flex-wrap justify-end gap-3` row.
5. **Wire the hero sites** (`role: "hero"`): flashcards-panel, typing-panel, review-app, practice-app, lightning-app — call `useHanziSize()` in the component and replace the literal `text-7xl` with `HANZI_SIZE_CLASS.hero[size]`.
6. **Restructure the three conditional heroes** (quiz-panel:262, daily-app:222, duel-app:507) so each branch emits a single size class: english-hanzi mode keeps `font-sans text-4xl` untouched; hanzi modes get `font-hanzi ${HANZI_SIZE_CLASS.hero[size]}`.
7. **Wire the remaining roles**: boss-panel + tone-practice (`prompt`), quiz-panel:251 + tone-listen-trainer (`promptSm`), words-panel:84 + flashcard/review compact backs (`word`), cloze sentence (`sentence`), scramble tiles + cloze choices (`tile`). Scale only the hanzi elements — pinyin and English lines are untouched.
8. **Add `tests/hanzi-size.test.mjs`** (style of `tests/video-controls.test.mjs`).
9. Run the full validation gate.

### Likely files touched

New: `src/lib/hanzi-size.ts`, `src/components/use-hanzi-size.ts`, `src/components/hanzi-size-control.tsx`, `tests/hanzi-size.test.mjs`.
Modified: `src/components/topic-app.tsx`, `review-app.tsx`, `practice-app.tsx`, `daily-app.tsx`, `duel-app.tsx`, `lightning-app.tsx`, `tone-practice.tsx`, `tone-listen-trainer.tsx`, `src/components/topic/flashcards-panel.tsx`, `quiz-panel.tsx`, `typing-panel.tsx`, `cloze-panel.tsx`, `scramble-panel.tsx`, `boss-panel.tsx`, `words-panel.tsx`.

### Proposed function/component names and TypeScript signatures

```ts
// src/lib/hanzi-size.ts
export type HanziSize = "standard" | "large" | "xl";
export type HanziRole = "hero" | "prompt" | "promptSm" | "word" | "sentence" | "tile";

export const HANZI_SIZE_STORAGE_KEY = "learn-10-mandarin-hanzi-size";
export const HANZI_SIZES: readonly HanziSize[]; // ["standard", "large", "xl"]
export const DEFAULT_HANZI_SIZE: HanziSize;     // "standard"

export function normalizeHanziSize(value: unknown): HanziSize; // garbage → "standard"
export function serializeHanziSize(size: HanziSize): HanziSize;
export function hanziSizeLabel(size: HanziSize): string; // "Standard" | "Large" | "Extra large"

/** Full literal class strings so Tailwind JIT emits them. One step up per level. */
export const HANZI_SIZE_CLASS: Record<HanziRole, Record<HanziSize, string>>;
// hero:     text-7xl / text-8xl / text-9xl
// prompt:   text-6xl / text-7xl / text-8xl
// promptSm: text-5xl / text-6xl / text-7xl
// word:     text-4xl / text-5xl / text-6xl
// sentence: text-3xl / text-4xl / text-5xl
// tile:     text-2xl / text-3xl / text-4xl
```

```ts
// src/components/use-hanzi-size.ts
export function useHanziSize(): { size: HanziSize; setSize: (next: HanziSize) => void };

// src/components/hanzi-size-control.tsx
export function HanziSizeControl(): JSX.Element;
```

### UI copy / microcopy

- Group label: **Hanzi size**
- Chips: 字 at three preview sizes; `aria-label`s: **"Standard hanzi size"**, **"Large hanzi size"**, **"Extra large hanzi size"**
- Helper line (matching the tone-colors voice): **"Bigger characters on cards, quizzes, and drills. Saved on this device."**
- Analytics event: `hanzi_size_changed` with `{ size }`.

### Test plan (`tests/hanzi-size.test.mjs`, node --test)

- `HANZI_SIZES` order and `DEFAULT_HANZI_SIZE === "standard"`.
- `normalizeHanziSize` returns each valid value unchanged; falls back to `"standard"` for `null`, `""`, `"huge"`, numbers, objects, and the serialized-then-reparsed round trip of every size.
- `serializeHanziSize`/`normalizeHanziSize` round-trip for all three sizes.
- `HANZI_SIZE_CLASS`: every role has all three sizes; every value matches `/^text-[a-z0-9]+$/`; within each role the three classes are distinct; `standard` equals the documented current base per role (locks in "default = no visual change").
- `hanziSizeLabel` returns the three exact labels.

### Manual QA checklist

- [ ] Topic page: control appears beside Tone colors; default renders identical to production (Standard).
- [ ] Tap Large then XL: flashcard front, quiz prompt, typing prompt, boss prompt, cloze sentence + choices, scramble tiles, words-list hanzi all grow; pinyin and English lines do not.
- [ ] Quiz/daily/duel in **english-hanzi** mode: English prompt stays `text-4xl` at every size level.
- [ ] XL on a 375px-wide viewport with a 3–4 character word (e.g. flashcards): characters wrap without clipping or horizontal scroll.
- [ ] Reload → preference persists; second tab picks up a change made in the first (storage event).
- [ ] Private/incognito mode with storage blocked: control still works for the session, no crash.
- [ ] Keyboard: chips reachable by Tab, state announced (radio semantics), visible focus ring (global `:focus-visible` styles apply).
- [ ] Review session header shows the control; review card hanzi scales.

### Acceptance criteria

1. Three-level preference persisted under `learn-10-mandarin-hanzi-size`, default Standard, never stored in `ProgressState` (export/import unaffected).
2. Standard renders byte-identical class output to today on every touched surface.
3. Large/XL scale the hanzi elements listed above on all topic practice panels and all standalone practice apps; non-hanzi text never scales.
4. No hydration warnings (server snapshot = Standard), no layout clipping at XL on mobile.
5. Validation gate green: `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build`.

### Risk and rollback notes

- **Layout overflow at XL** (`text-9xl` ≈ 8rem/char; a 4-char word exceeds a 390px viewport width and must wrap). CJK wraps per-character by default — verify no `whitespace-nowrap`/fixed heights on hero containers; if a surface clips, cap that role's XL one step lower rather than adding responsive complexity.
- **Conflicting size utilities**: the three conditional heroes currently stack `text-7xl` + `text-4xl` and depend on stylesheet order; the restructure in step 6 removes that fragility — don't regress it by string-appending.
- **Tailwind JIT purging**: classes must be full literals in `HANZI_SIZE_CLASS`, never template-built (`text-${n}xl` would be purged).
- **Rollback** is trivial: the feature is additive and isolated — revert the commit; a stale localStorage key is harmlessly ignored by `normalizeHanziSize` in any prior build (key is namespaced and unread elsewhere).

### Non-goals / deferrals

- **Match panel tiles** (`match-panel.tsx`) — fixed grid, overflow-prone; defer to a follow-up with its own layout QA.
- Browsing/reading surfaces: `phrasebook-panel.tsx`, `favorites-app.tsx`, `word-search-results.tsx`, topic-card decorative watermark hanzi (`topic-card.tsx:113`), `error-screen.tsx`.
- Canvas share card (`share-card-canvas.ts`) and OG images — fixed-pixel art, not practice surfaces.
- Pinyin/English text scaling, browser-zoom detection, per-surface overrides, and a global settings page.

### Ready-to-run Opus implementation prompt for Sprint 22

```text
Implement Sprint 22 of the Learn 10 Mandarin Words app (Next.js 16 / React 19 / Tailwind 4,
static/local-first): a device-local "Hanzi size" preference with three levels — standard,
large, xl — applied to hanzi on all practice surfaces. Read AGENTS.md first and follow it
(this Next.js version has breaking changes; consult node_modules/next/dist/docs/ if any
framework question arises). Do NOT add backends, packages, or external services.

Mirror the existing tone-colors preference exactly (src/lib/tone-colors.ts,
src/components/use-tone-colors.ts, src/components/tone-colors-toggle.tsx):

1. Create src/lib/hanzi-size.ts (pure, DOM-free):
   - export type HanziSize = "standard" | "large" | "xl";
   - export type HanziRole = "hero" | "prompt" | "promptSm" | "word" | "sentence" | "tile";
   - HANZI_SIZE_STORAGE_KEY = "learn-10-mandarin-hanzi-size"; HANZI_SIZES ordered list;
     DEFAULT_HANZI_SIZE = "standard".
   - normalizeHanziSize(value: unknown): HanziSize — only exact "large"/"xl" match,
     everything else (null, garbage, legacy) → "standard". serializeHanziSize(size).
     hanziSizeLabel(size): "Standard" | "Large" | "Extra large".
   - HANZI_SIZE_CLASS: Record<HanziRole, Record<HanziSize, string>> with FULL literal
     Tailwind classes (never template-built): hero text-7xl/text-8xl/text-9xl;
     prompt text-6xl/text-7xl/text-8xl; promptSm text-5xl/text-6xl/text-7xl;
     word text-4xl/text-5xl/text-6xl; sentence text-3xl/text-4xl/text-5xl;
     tile text-2xl/text-3xl/text-4xl.

2. Create src/components/use-hanzi-size.ts: copy the use-tone-colors.ts module-level
   useSyncExternalStore store adapted to HanziSize — server snapshot "standard",
   hydrate from localStorage on first subscribe, cross-tab sync via the storage event,
   try/catch all storage access. useHanziSize(): { size, setSize }; setSize calls
   track("hanzi_size_changed", { size }) from src/lib/analytics.ts.

3. Create src/components/hanzi-size-control.tsx: right-aligned segmented control styled
   like tone-colors-toggle.tsx (min-h-[44px] chips, emerald active state).
   role="radiogroup" aria-label="Hanzi size"; three role="radio" chips rendering 字 in
   font-hanzi at text-sm/text-lg/text-2xl with aria-labels "Standard hanzi size",
   "Large hanzi size", "Extra large hanzi size". Helper text: "Bigger characters on
   cards, quizzes, and drills. Saved on this device."

4. Mount HanziSizeControl beside ToneColorsToggle in src/components/topic-app.tsx (~line
   375) and src/components/review-app.tsx (~line 215), in one flex flex-wrap justify-end
   gap row.

5. Apply sizes — in each component call useHanziSize() and replace the hardcoded size
   class on the HANZI element only (never pinyin/English lines):
   - hero: topic/flashcards-panel.tsx:175, topic/typing-panel.tsx:124, review-app.tsx:384,
     practice-app.tsx:269, lightning-app.tsx:314.
   - hero with english-hanzi conditional — topic/quiz-panel.tsx:262, daily-app.tsx:222,
     duel-app.tsx:507 currently stack "font-hanzi text-7xl" with a conditional
     "font-sans text-4xl"; restructure so each branch emits exactly ONE font-size class:
     english-hanzi keeps font-sans text-4xl (do NOT scale English), hanzi branch gets
     font-hanzi + HANZI_SIZE_CLASS.hero[size].
   - prompt: topic/boss-panel.tsx:299, tone-practice.tsx:84.
   - promptSm: topic/quiz-panel.tsx:251, tone-listen-trainer.tsx:241.
   - word: topic/words-panel.tsx:84, flashcards-panel.tsx:181, review-app.tsx:390.
   - sentence: topic/cloze-panel.tsx:129.
   - tile: scramble-panel tiles (lines ~219/230/247) and cloze-panel choices (~179/192).
   Do NOT touch match-panel.tsx, phrasebook-panel.tsx, favorites, search results,
   topic-card watermark, error screens, or the canvas share card.

6. Add tests/hanzi-size.test.mjs (node --test style of tests/video-controls.test.mjs,
   importing ../src/lib/hanzi-size.ts): defaults/order; normalize round-trips + garbage
   fallback; serialize/normalize round-trip; HANZI_SIZE_CLASS completeness (all roles ×
   sizes, /^text-[a-z0-9]+$/, distinct per role, standard equals the current base sizes
   listed above); hanziSizeLabel exact strings.

Constraints: preference lives ONLY under its own localStorage key (never ProgressState);
"standard" must render identical classes to current production; keep lang attributes
(HANZI_LANG/PINYIN_LANG) intact; preserve existing comment style/density.

Validation gate — all must pass before finishing:
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build
```

---

I have everything I need — repo structure, real build-output measurements, the Next 16 lazy-loading docs, and verified marker strings. Here is the plan.

---

## Sprint 23 — Lazy-load heavy interactive panels (share-card canvas, boss round, duel) via dynamic imports with a bundle-size budget test

### Goal and user value

Every topic page currently ships the full Boss Round panel (~660 lines of stage-rendering code) in its initial JavaScript, and stats/practice/review ship the entire share-card dialog plus the canvas renderer — even though both are used only after an explicit click. This sprint defers that code with `next/dynamic` so first paint on the app's highest-traffic pages (100 topic pages) downloads less JS, and adds a `node --test` bundle-budget test that fails CI if the heavy modules ever creep back into initial chunks or the initial payload regresses past a byte budget. Learners on slow connections get interactive words/cards/quiz sooner; nothing about gameplay changes.

### Current-state findings grounded in actual files/components/helpers

Measured against the existing Turbopack build output in `.next` (Next 16.2.9, `next build`):

- **Topic pages ship the boss round eagerly.** `src/components/topic-app.tsx:30` statically imports `BossPanel` from `src/components/topic/boss-panel.tsx` (658 lines) and renders it only when `mode === "boss"` (topic-app.tsx:467). Initial mode is always `"words"` or `"phrasebook"` (topic-app.tsx:42), so the panel is never in first paint. Measured initial JS for `/topics/ten-types-of-tea`: **1,096 KB across 15 chunks**; boss-panel code (unique literal `"call the tones"`, boss-panel.tsx:39) appears in two of them (`0vk6_j1lj1aj_.js` 25 KB, `0yuoqexm3yer-.js` 93 KB).
- **The share dialog + canvas renderer load eagerly on three routes.** `src/components/share-score-button.tsx` statically imports 8 functions from `src/lib/share-card-canvas.ts` (339 lines) at lines 5–15. The trigger button is always visible, but the dialog/canvas run only after click (`openDialog`, share-score-button.tsx:87). Call sites: `stats-app.tsx:131`, `practice-app.tsx:214`, `review-app.tsx:302`. Measured: stats 688 KB / practice 673 KB / review 679 KB initial JS, each including a 30 KB chunk (`1gut5dt3qhdl0.js`) carrying the canvas code (unique literal `"mandarin-score-card.png"`, share-card-canvas.ts:20) and dialog copy (`"nothing is uploaded unless you share it"`, share-score-button.tsx:253).
- **Duel is already route-isolated — no code change needed, only a guard.** `src/components/duel-app.tsx` (703 lines) is imported solely by the server page `src/app/duel/page.tsx:2`; App Router route-level splitting confines it to a 26 KB chunk loaded only on `/duel`. The "Pass & Play" / "Boss Round" strings visible in the home page's chunks are home-app's own promo card (`home-app.tsx:236-250`) and topic-card's crown tooltip (`topic-card.tsx:89`) — not leaks. Also per `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md:60`, dynamic-importing a Client Component from a Server Component does **not** code-split, so wrapping `DuelApp` in `dynamic()` inside `duel/page.tsx` would be a no-op. The correct deliverable for duel is a regression test that keeps duel code off every other route.
- **Small static leaf imports that must stay static:** `topic-app.tsx:31` imports `BOSS_STAGE_COUNT` from `src/lib/boss-logic.ts` (also imported by `progress-logic.ts:16`) — it's a shared constant and stays. `buildShareText` from `src/lib/share-card-logic.ts` (pure, tiny, unit-tested in `tests/share-card-logic.test.mjs`) moves with the dialog.
- **No `next/dynamic` or `React.lazy` exists anywhere in `src/` today** — this establishes the pattern.
- **Test/marker infrastructure:** `npm run test` is `node --test`, which auto-discovers `tests/*.test.mjs`. `tests/sw-policy.test.mjs` is the established precedent for a test that reads real build artifacts/source with `readFileSync` and asserts policy invariants. Important measurement detail: minified chunks **drop identifier names** (`renderShareCard` appears in no chunk) but **preserve string literals** — the budget test must use source-unique string literals, verified unique via grep: `"call the tones"` (boss-panel only), `"mandarin-score-card.png"` (share-card-canvas only), `"Player 1"` (duel-app only).
- **Per-route initial chunks are discoverable without any manifest:** each prerendered page at `.next/server/app/**/*.html` embeds `<script src="/_next/static/chunks/….js">` tags for exactly its initial JS (Turbopack chunk names are content-hashed; the HTML is the reliable index).
- **Offline interaction:** `public/sw.js:70,217` serves `/_next/static` with stale-while-revalidate — a lazy chunk gets cached after its first fetch, but is not precached (`PRECACHE_URLS`, sw.js:38, is app-shell only). Noted under risks.

### Exact implementation steps in sequence

1. **Extract the share dialog into a new client component `src/components/share-card-dialog.tsx`.** Move from `share-score-button.tsx`: the `FOCUSABLE_SELECTOR` constant, `SITE_HOST` derivation, all `@/lib/share-card-canvas` imports, `buildShareText` usage, the render/blob/copy/share/save handlers, the focus-trap and Escape effects, the dialog JSX (lines 222–306), and the `Toast`. The dialog receives `data`, `surface`, and `onClose`; it runs its focus-into-dialog effect on mount (it only exists while open, so no `open` prop needed).
2. **Slim `src/components/share-score-button.tsx` to the trigger.** It keeps `hasSomethingToShare`, the `open` state, `previouslyFocused` capture/restore, and the trigger button. Declare at module level: `const ShareCardDialog = dynamic(() => import("./share-card-dialog").then((m) => m.ShareCardDialog), { loading: () => <DialogFallback /> })` where `DialogFallback` is a small local component reproducing the backdrop + card shell with the existing "Building your card…" copy (so the chunk-fetch state and the canvas-render state read identically). Render `{open ? <ShareCardDialog data={data} surface={surface} onClose={closeDialog} /> : null}`. No props change at the three call sites.
3. **Lazy-load the boss panel in `src/components/topic-app.tsx`.** Replace the static import at line 30 with a module-level `const BossPanel = dynamic(() => import("./topic/boss-panel").then((m) => m.BossPanel), { loading: () => <p className="mt-8 text-sm text-slate-400" role="status">Loading the boss round…</p> })`. The JSX at lines 467–475 is unchanged (identical props). Keep the `BOSS_STAGE_COUNT` import at line 31. No `ssr: false` needed — the panel never renders during prerender because `mode` starts at `"words"`/`"phrasebook"`.
4. **Build and measure.** Run `npm run build`, then measure per-route initial JS (sum of chunk file sizes referenced by each prerendered HTML) for a topic page and `/stats`, and confirm the marker literals moved out of initial chunks into on-demand chunks.
5. **Write `tests/bundle-budget.test.mjs`** (shape below): marker-exclusion assertions, marker-existence assertions (so exclusion is never vacuously green), duel-isolation guard, chunk-file-existence check, and byte budgets set at **measured post-change size + 10% headroom** (record the measured numbers in a comment; current pre-change baseline for the test's comment: topic 1,096 KB, stats 688 KB). Tests skip with an explanatory message when `.next/server/app` is absent so a build-less `npm run test` stays green.
6. **Run the full validation gate**, re-running `npm run test` after `npm run build` so the budget assertions execute against fresh output (not skipped, not stale).

### Likely files touched

| File | Change |
|---|---|
| `src/components/share-card-dialog.tsx` | **New** — dialog + canvas pipeline extracted from share-score-button |
| `src/components/share-score-button.tsx` | Slimmed to trigger + `dynamic()` dialog |
| `src/components/topic-app.tsx` | `BossPanel` becomes a `next/dynamic` import |
| `tests/bundle-budget.test.mjs` | **New** — bundle budget + marker policy test |

No changes to `boss-panel.tsx`, `duel-app.tsx`, `duel/page.tsx`, `share-card-canvas.ts`, the three call-site apps, or `next.config.ts`.

### Proposed function/component names and TypeScript signatures

```tsx
// src/components/share-card-dialog.tsx
"use client";
export function ShareCardDialog(props: {
  data: ShareCardData;              // from "@/lib/share-card-logic"
  surface: "stats" | "practice" | "review";
  onClose: () => void;
}): React.JSX.Element;

// src/components/share-score-button.tsx (module scope)
const ShareCardDialog = dynamic(
  () => import("./share-card-dialog").then((m) => m.ShareCardDialog),
  { loading: () => <DialogFallback /> },
);
function DialogFallback(): React.JSX.Element;  // backdrop + "Building your card…" shell

// src/components/topic-app.tsx (module scope)
const BossPanel = dynamic(
  () => import("./topic/boss-panel").then((m) => m.BossPanel),
  { loading: () => <BossLoading /> },
);
```

```js
// tests/bundle-budget.test.mjs (plain .mjs, mirrors sw-policy.test.mjs style)
const MARKERS = {
  bossPanel: "call the tones",                       // boss-panel.tsx only
  shareCanvas: "mandarin-score-card.png",            // share-card-canvas.ts only
  shareDialog: "nothing is uploaded unless you share it", // share-card-dialog.tsx only
  duel: "Player 1",                                  // duel-app.tsx only
};
function initialChunkPaths(htmlFile) { /* regex /_next\/(static\/chunks\/[^"]+\.js)/g, deduped */ }
function chunkText(relPath) { /* readFileSync from .next/<relPath> */ }
function totalBytes(paths) { /* sum statSync sizes */ }
// Budgets: measured post-change + 10%, as integer byte constants with the
// measured value recorded in a comment beside each.
```

### UI copy / microcopy

- Boss panel chunk loading: **"Loading the boss round…"** (quiet slate-400 line, `role="status"` — matches `LoadingScreen`'s tone in `loading-screen.tsx`).
- Share dialog chunk loading: reuse the existing **"Building your card…"** inside the same backdrop/card shell (share-score-button.tsx:248 copy), so users see one continuous message from click → chunk fetch → canvas render. No other copy changes; the pinyin-on-Chinese rendering inside the card is untouched.

### Test plan

`tests/bundle-budget.test.mjs` (auto-picked-up by `node --test`; skips with a "run `npm run build` first" note when `.next/server/app` is missing):

1. **Topic page excludes boss code** — no initial chunk of a discovered `server/app/topics/*.html` contains `MARKERS.bossPanel`.
2. **Stats/practice/review exclude share-card code** — no initial chunk of `stats.html`, `practice.html`, `review.html` contains `MARKERS.shareCanvas` or `MARKERS.shareDialog`.
3. **Lazy chunks actually exist** — `bossPanel`, `shareCanvas`, and `shareDialog` markers each appear in at least one file under `.next/static/chunks/` (guards against the exclusion tests passing because a marker string was reworded — with an assertion message pointing at the source file to re-sync).
4. **Duel stays route-isolated** — `MARKERS.duel` appears in no initial chunk of `index.html`, the topic page, `stats.html`, `practice.html`, or `review.html` (it may appear on `duel.html`).
5. **Byte budgets** — topic-page and stats initial-JS totals stay under their budget constants; every `<script>`-referenced chunk file exists on disk (guards the regex against future HTML-shape changes).
6. Existing suites (`share-card-logic`, `boss-logic`, `duel-logic`, `sw-policy`, etc.) must stay green untouched — the refactor moves JSX/handlers, not logic.

### Manual QA checklist

- [ ] `npm run dev`, open a topic → Words renders; DevTools Network shows no boss-panel chunk yet; click **Boss** → chunk fetches once, "Loading the boss round…" flashes at most briefly, intro renders.
- [ ] Play a full boss round: all four stages work, score records, a 4/4 run crowns the topic (👑 in tab + hero), crown persists after reload (localStorage).
- [ ] Switch Boss → Words → Boss: no re-fetch, no state errors.
- [ ] `/stats`: click "Share progress 📸" → "Building your card…" → preview appears; Share / Copy image / Copy text / Save PNG all work; Escape and Tab-trap still work; focus returns to the trigger on close.
- [ ] `/practice` and `/review`: finish a run, share card still opens and renders correct numbers.
- [ ] `/duel`: full pass-and-play duel unaffected.
- [ ] Production check: `npm run build && npm run start`, repeat the topic-page Boss click; confirm in Network that boss/share chunks are absent from initial load.
- [ ] Reduced-motion / keyboard-only pass on the dialog unchanged.

### Acceptance criteria

- `"call the tones"` absent from all topic-page initial chunks; `"mandarin-score-card.png"` and the dialog privacy line absent from stats/practice/review initial chunks; all three present in on-demand chunks.
- Topic-page initial JS measurably below the 1,096 KB baseline, and byte budgets enforced by the new test.
- Boss round, share card (all four actions), and duel behave exactly as before; no visual change except the two loading lines.
- Full gate green: `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build` — plus `npm run test` re-run **after** the build with zero skipped budget tests.

### Risk and rollback notes

- **Offline gap (new, small):** lazy chunks are cached by `sw.js` stale-while-revalidate only after first fetch. A learner who goes offline having never opened Boss/share sees the loading line fail (nearest `error.tsx` boundary on chunk-load rejection). Core offline promise (words, cards, quiz, progress) is untouched; acceptable and documented. Precaching lazy chunks is deliberately out of scope (hashed names would couple `sw.js` to build output).
- **Marker fragility:** rewording "call the tones" or the privacy line breaks the test — mitigated by assertion messages naming the source file, and by test comments stating the pairing.
- **Budget flakiness:** sizes shift with Next/Tailwind upgrades; 10% headroom plus explicit constants make bumps a deliberate, reviewed act.
- **Dialog refactor regression risk:** focus trap and Safari's pending-ClipboardItem quirk (share-card-canvas.ts `copyImage`) move files — behavior must move verbatim; the `makeBlob`-not-pre-awaited pattern must be preserved.
- **Rollback:** revert the three source files to static imports and delete the test file — no data, schema, or SW changes; a single-commit revert is safe.

### Non-goals / deferrals

- No `dynamic()` wrapper around `DuelApp` (proven no-op from a Server Component; the test guards isolation instead).
- No lazy-loading of quiz/match/cloze/scramble/typing panels (small; diminishing returns) and no prefetch-on-tab-hover.
- No gzip/Brotli-aware budgets, Lighthouse CI, or bundle analyzer tooling.
- No SW precaching of lazy chunks; no `next.config.ts` changes.

### Ready-to-run Opus implementation prompt for Sprint 23

```
You are implementing Sprint 23 of the "Learn 10 Mandarin Words" app (Next.js 16.2.9,
React 19, Tailwind 4, App Router, Turbopack builds, static/local-first, no backend).
Read AGENTS.md first; consult node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md
before writing dynamic imports.

TASK: Defer rarely-used interactive code via next/dynamic and add a bundle-budget test.

1. Create src/components/share-card-dialog.tsx ("use client"): move the entire share
   dialog out of src/components/share-score-button.tsx — the FOCUSABLE_SELECTOR constant,
   SITE_HOST derivation, every import from "@/lib/share-card-canvas", buildShareText,
   the render/copy/share/save handlers, focus-trap + Escape effects, dialog JSX, and Toast.
   Props: { data: ShareCardData; surface: "stats" | "practice" | "review"; onClose: () => void }.
   Focus moves into the dialog on mount; onClose is called on Escape/Done. Preserve the
   Safari pattern exactly: makeBlob passes a PENDING promise to copyImage/ClipboardItem.
2. Slim share-score-button.tsx to: hasSomethingToShare gate, trigger button, open state,
   previously-focused capture/restore, and a module-level
   const ShareCardDialog = dynamic(() => import("./share-card-dialog").then(m => m.ShareCardDialog),
   { loading: () => <DialogFallback /> }) rendered only while open. DialogFallback reproduces
   the backdrop + max-w-md card shell showing the existing copy "Building your card…".
   Call sites in stats-app.tsx, practice-app.tsx, review-app.tsx must not change.
3. In src/components/topic-app.tsx replace the static BossPanel import (line ~30) with
   const BossPanel = dynamic(() => import("./topic/boss-panel").then(m => m.BossPanel),
   { loading: () => <p className="mt-8 text-sm text-slate-400" role="status">Loading the boss round…</p> }).
   Keep the BOSS_STAGE_COUNT import and the BossPanel JSX/props unchanged. Do NOT add ssr: false.
4. Do NOT wrap DuelApp in dynamic() — src/app/duel/page.tsx is a Server Component and
   dynamic-importing a Client Component there does not code-split (see the lazy-loading doc).
   Duel isolation is enforced by the test instead.
5. Run npm run build, then create tests/bundle-budget.test.mjs (node:test + assert/strict,
   style of tests/sw-policy.test.mjs). Helpers: initialChunkPaths(htmlFile) extracts deduped
   /_next/(static/chunks/[^"]+\.js) matches from a prerendered page under .next/server/app;
   chunkText/totalBytes read from .next/. Markers (string literals survive minification;
   identifiers do not — never use function names): bossPanel "call the tones" (boss-panel.tsx),
   shareCanvas "mandarin-score-card.png" (share-card-canvas.ts), shareDialog
   "nothing is uploaded unless you share it" (share-card-dialog.tsx), duel "Player 1" (duel-app.tsx).
   Tests: (a) no topic-page initial chunk (discover any server/app/topics/*.html) contains
   bossPanel; (b) no stats/practice/review initial chunk contains shareCanvas or shareDialog;
   (c) each of those three markers exists in at least one file under .next/static/chunks
   (assertion message: re-sync marker with its source file if reworded); (d) duel marker is
   absent from index/topic/stats/practice/review initial chunks; (e) every referenced chunk
   file exists on disk; (f) topic-page and stats initial-JS byte totals are under budget
   constants set to your MEASURED post-change totals + 10%, with the measured bytes recorded
   in comments (pre-change baselines: topic ≈ 1,096 KB, stats ≈ 688 KB — you must land below
   the topic baseline). All tests skip with message "run `npm run build` first" when
   .next/server/app is missing, so a build-less npm run test stays green.
6. Behavior must be pixel/flow-identical apart from the two loading lines. No new
   dependencies, no next.config.ts or sw.js changes, no invented content.

VALIDATION GATE (all must pass):
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build
Then re-run npm run test after the build and confirm the bundle-budget tests EXECUTED
(0 skipped) and passed. Also verify manually: grep confirms "call the tones" is absent
from every chunk referenced by .next/server/app/topics/<any>.html.
```

---

One honest deviation from the backlog line to flag: the duel third of the sprint ships as a **test-enforced guarantee rather than a code change** — the build measurements show `duel-app.tsx` is already confined to a 26 KB `/duel`-only chunk by App Router route splitting, and Next's own docs say a `dynamic()` wrapper in its Server Component page would not code-split at all. The real payload wins are the boss panel (in all 100 topic pages' initial 1,096 KB today) and the share dialog (30 KB chunk on stats/practice/review).

---

Research complete — everything below is grounded in files I read. One critical current-state finding shaped the whole plan: **sentence-stripping already shipped in an earlier sprint** (`toTopicSummary` in `src/lib/data-logic.ts`), so this sprint's real remaining payload is the 1,020 items' pinyin/english shipped solely for the home search. The plan slims home to a hanzi-only topic index and lazy-loads a word-search index on search intent.

## Sprint 24 — Slim the home page payload: ship a lightweight topic index instead of the full 1,020-word dataset

### Goal and user value

The home route currently serializes ~118KB of vocab data into its RSC/flight payload even though the visitor may never search. This sprint splits that in two: the page ships a ~75KB **topic index** (everything the hero, category grid, topic cards, and progress UI need), and the ~67KB **word-search index** (pinyin/english for all 1,020 words) loads lazily — only when the learner actually focuses the search box. First contentful render on slow connections gets a ~43KB-raw (~10–15KB gzipped) lighter document, and searchers still get the exact same diacritic-tolerant word search, online and offline.

### Current-state findings (grounded in actual files)

- `src/lib/data.ts:12-21` — `homeData()` already builds a slimmed `HomeData` at module scope via `toTopicSummary`, and `src/app/page.tsx:17` passes it to the `"use client"` `HomeApp`. So the data cost is the RSC/flight payload, not the client JS chunk.
- `src/lib/data-logic.ts:18-27` — `toTopicSummary` drops per-item `sentences` but **keeps `hanzi`/`pinyin`/`english` for all 1,020 items**. Measured with the real dataset: full topics 345,965 B → current `HomeData` 118,127 B. The backlog rationale ("not every sentence") describes work that already landed; the remaining fat is pinyin/english.
- Measured candidate shapes (node, real `src/data/topics.json`, 102 topics / 1,020 items): hanzi-only topic index = **75,451 B**; lazy word index (slug + hanzi/pinyin/english per topic) = **67,469 B**.
- Why hanzi can't be dropped from the index: `src/components/topic-card.tsx` needs all 10 hanzi per topic — `wordKey(topic, item)` drives the studied count (line 35-37), `topicWordStatuses` drives mastery dots (line 42), plus the watermark `items[0].hanzi` (line 116) and the 5 hanzi chips (line 148).
- Why pinyin/english are only search-time: `src/components/home-app.tsx:31-49` — the library filter haystack and `searchWords` (from `src/lib/search-logic.ts`, which takes `TopicSummary[]` and is otherwise shape-agnostic) are the only consumers; `topic-card.tsx:49-54` uses them only for the matched-word rows shown *while searching*.
- `src/app/duel/page.tsx:13` also uses `homeData()` — the duel genuinely needs pinyin/english for questions (`duel-app.tsx` consumes `VocabItemSummary`), so `/duel` must keep the current payload. Untouched this sprint.
- `datasetSummary` (`data-logic.ts:65`) only reads `items.length`; `nextRecommendedTopic` is generic over `Pick<Topic, "slug">`; `onboarding.tsx` (per its line-8 comment) only reads title/slug fields — all compatible with a hanzi-only index after one signature widening.
- Offline: `public/sw.js` — `isStaticAsset` (line 70) does **not** match `.json`, and `PRECACHE_URLS` (line 38) precaches `/`. A lazily fetched `/search-index.json` would fail offline without SW changes. `tests/sw-policy.test.mjs:171` hardcodes cache names `learn10-v2`… in the activate-cleanup test, so a `CACHE_VERSION` bump must update that test.
- Next 16 local docs (`node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md:51-70`) confirm: GET route handlers are not cached by default; `export const dynamic = 'force-static'` prerenders them at build — the right delivery mechanism for a static, never-drifting index (it derives from the same `topics.json` at build time).
- Guardrail tests already exist in `tests/home-data.test.mjs` (payload-size assertion at line 76-85, parity tests) — the new shapes extend this file's pattern.

### Exact implementation steps in sequence

1. **Types** (`src/lib/types.ts`): add `VocabItemIndex`, `TopicIndexEntry`, `HomeIndexData`, `WordIndexEntry` (see signatures below), next to the existing `TopicSummary` block and with a comment explaining the index/word-index split. Keep `TopicSummary`/`HomeData` (duel still uses them).
2. **Pure logic** (`src/lib/data-logic.ts`): add `toTopicIndexEntry`, `toWordIndex`, and `mergeWordIndex` (pads `pinyin`/`english` with `""` when the word index is `null` or a slug is missing, so the UI can never crash on drift). Widen `datasetSummary`'s parameter to `{ items: VocabItemIndex[] }[]` — `TopicSummary` remains structurally assignable.
3. **Data bindings** (`src/lib/data.ts`): build `const homeIndex: HomeIndexData` and `const words: WordIndexEntry[]` once at module scope; export `homeIndexData()` and `wordIndex()`. Update the module comment; keep `homeData()` for `/duel`.
4. **Static endpoint**: new `src/app/search-index.json/route.ts` — `export const dynamic = "force-static"` and a `GET` returning `Response.json(wordIndex())`. (If the dotted folder name trips the Next 16 build, fall back to `/search-index` and add an explicit pathname check in `sw.js` — but the dotted route is the primary plan since `isStaticAsset` then needs only a `json` regex addition.)
5. **Home page** (`src/app/page.tsx`): pass `homeIndexData()` to `HomeApp`. Metadata/JSON-LD keep using full `data.topics` server-side — no change.
6. **HomeApp** (`src/components/home-app.tsx`): prop becomes `HomeIndexData`. Add `words`/`wordsState` state and `ensureWordIndex()` that fetches `/search-index.json` once (triggered on search-input `onFocus` — prefetch before the first keystroke — and defensively on first `onChange`; on error, set `"error"` and allow retry on next focus). Derive `const topics = useMemo(() => mergeWordIndex(data.topics, words), …)` and point `filtered`, `wordResults`, `datasetSummary`, and the `TopicCard` grid at the merged `TopicSummary[]` — everything downstream keeps its current shape. Add the loading/offline hint under the search input (copy below).
7. **TopicCard** (`src/components/topic-card.tsx`): one cosmetic guard — in the matched-word rows, render the pinyin/english spans only when non-empty, so pre-merge (padded `""`) matches show hanzi cleanly. No prop changes.
8. **Service worker** (`public/sw.js`): add `json` to the `isStaticAsset` extension regex (line 70) so the index is stale-while-revalidate cached; add `"/search-index.json"` to `PRECACHE_URLS` so cold-offline search works; bump `CACHE_VERSION` to `"v3"` per the file's documented invalidation policy.
9. **Tests**: extend `tests/home-data.test.mjs` (index/merge/size assertions below); update the activate-cleanup expectations in `tests/sw-policy.test.mjs` for `learn10-v3` and add a behavioral case asserting a same-origin `.json` GET is handled (respondWith defined) plus `/search-index.json` present in `precacheUrls(sw)`.
10. Run the full validation gate.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/types.ts` | new index types |
| `src/lib/data-logic.ts` | `toTopicIndexEntry`, `toWordIndex`, `mergeWordIndex`; widen `datasetSummary` |
| `src/lib/data.ts` | `homeIndexData()`, `wordIndex()` bindings |
| `src/app/search-index.json/route.ts` | **new** force-static route handler |
| `src/app/page.tsx` | pass `homeIndexData()` |
| `src/components/home-app.tsx` | lazy word-index fetch + merge + hint copy |
| `src/components/topic-card.tsx` | skip empty pinyin/english spans in matched rows |
| `public/sw.js` | precache + `.json` static-asset handling + `v3` |
| `tests/home-data.test.mjs`, `tests/sw-policy.test.mjs` | new/updated guardrails |

### Proposed names and signatures

```ts
// types.ts
export type VocabItemIndex = Pick<VocabItem, "hanzi">;
export type TopicIndexEntry = Omit<Topic, "items"> & { items: VocabItemIndex[] };
export type HomeIndexData = { categories: Category[]; topics: TopicIndexEntry[] };
export type WordIndexEntry = { slug: string; items: VocabItemSummary[] };

// data-logic.ts (pure, dataset-parameterized, unit-testable like toTopicSummary)
export function toTopicIndexEntry(topic: Topic): TopicIndexEntry;
export function toWordIndex(topics: Topic[]): WordIndexEntry[];
export function mergeWordIndex(
  indexTopics: TopicIndexEntry[],
  words: WordIndexEntry[] | null,
): TopicSummary[]; // pads pinyin/english with "" when words are absent
export function datasetSummary(topics: { items: VocabItemIndex[] }[]): …; // widened

// data.ts
export function homeIndexData(): HomeIndexData;
export function wordIndex(): WordIndexEntry[];

// app/search-index.json/route.ts
export const dynamic = "force-static";
export function GET(): Response; // Response.json(wordIndex())

// home-app.tsx internals
const [words, setWords] = useState<WordIndexEntry[] | null>(null);
const [wordsState, setWordsState] = useState<"idle" | "loading" | "ready" | "error">("idle");
const ensureWordIndex: () => void; // idempotent; fetch("/search-index.json")
```

### UI copy / microcopy

- While `wordsState === "loading"` and the query is non-empty (small text under the search input): **“Loading full word search…”**
- When `wordsState === "error"` and the query is non-empty: **“Full word search couldn’t load — searching titles and characters only.”** (retries on next focus)
- Everything else unchanged: placeholder stays “Search words, pinyin, English”; empty state stays “No topics found”.

### Test plan (`npm run test`, node --test)

In `tests/home-data.test.mjs`:
- `toTopicIndexEntry` keeps every topic-level field (mirror the existing `toTopicSummary` test) and reduces items to `{ hanzi }` only.
- `mergeWordIndex(index, toWordIndex(topics))` deep-equals `topics.map(toTopicSummary)` — lossless round-trip across all 102 topics.
- `mergeWordIndex(index, null)` pads every item with `pinyin: ""`, `english: ""` and preserves hanzi order.
- `wordKey`, `datasetSummary`, `nextRecommendedTopic`, and `hasPlayableVideo` parity on index entries vs full topics.
- Size guardrails: serialized `HomeIndexData` < 90,000 B and smaller than the serialized `HomeData`; serialized word index < 80,000 B (measured: 75,451 / 118,127 / 67,469).
- `searchWords` on padded (words-not-loaded) summaries returns hanzi matches and no pinyin/english false-positives.

In `tests/sw-policy.test.mjs`: `/search-index.json` in `precacheUrls(sw)`; same-origin `.json` GET gets a `respondWith`; activate-cleanup expectations updated for `learn10-v3` (v2 now deleted). Existing media-policy tests must pass unchanged.

### Manual QA checklist

- [ ] `npm run dev` → `/` renders hero, snapshot metrics (102 lessons / 1,020 words), category grid, library grid identically to before.
- [ ] Network tab: no `/search-index.json` request until the search input is focused; exactly one request after focus.
- [ ] Type immediately after focus on a throttled connection: topic grid filters by title/hanzi at once; word panel and pinyin/english matches appear when the index lands; “Loading full word search…” shows in between.
- [ ] Search “ni”, “nǐ”, hanzi, and English terms — results and highlights identical to pre-sprint; matched-word rows show hanzi + pinyin + english; favorite toggle in results still works.
- [ ] `npm run build && npm run start`, view-source `/`: flight payload no longer contains pinyin/english strings (spot-check a known word); `/search-index.json` serves prerendered JSON.
- [ ] Offline (DevTools, after one online visit + SW active): `/` loads, focusing search + querying still returns full word results from the precached index.
- [ ] `/duel`, `/topics/[slug]`, `/categories/[slug]`, `/path` unaffected (they don't use the index).

### Acceptance criteria

1. Home RSC payload carries the topic index only — measured serialized `HomeIndexData` ≈ 75KB vs ≈ 118KB before (raw), with a test guarding < 90KB.
2. Word search behavior (ranking, highlighting, matched rows, favorites, category scoping) is byte-for-byte equivalent once the index loads; titles/hanzi search works before it loads and offline-cold.
3. `/search-index.json` is statically prerendered at build (no runtime compute, no backend) and served offline via the SW after install.
4. All five validation commands pass; no changes to `/duel`, topic, category, or path routes' behavior.

### Risk and rollback notes

- **Brief degraded search window** between first keystroke and index arrival — mitigated by prefetch-on-focus and the loading hint; worst case is title/hanzi-only results for a moment.
- **Dotted route folder** (`search-index.json/route.ts`) is the one Next-16-specific bet; verified against the local route-handlers doc, with `/search-index` + explicit SW pathname check as the documented fallback.
- **SW cache bump** invalidates the app shell (`learn10-v2` → `v3`); saved lesson videos live in the separate `learn10-videos-v1` cache and survive (activate cleanup preserves it — guarded by existing tests).
- **Rollback** is one commit revert: `homeData()`/`TopicSummary` remain intact and `/duel` still exercises them, so reverting `page.tsx` + `home-app.tsx` restores the old path even if the new files stay.

### Non-goals / deferrals

- Slimming the `/duel` payload (needs pinyin/english for questions) — candidate for a later perf sprint.
- Trimming topic-level `videoPath`/`video` from the index (~4-5KB; would require changing `hasPlayableVideo`/`TopicCard` shared with category pages).
- Compressing index items to plain hanzi-string arrays (breaks `Topic` → index structural assignability for ~12KB raw that gzip mostly recovers anyway).
- Any search-ranking, UI, or dataset changes; any new dependencies, backend, or analytics.

### Ready-to-run Opus implementation prompt for Sprint 24

```text
You are implementing Sprint 24 of the "Learn 10 Mandarin Words" app (Next.js 16.2.9, React 19, Tailwind 4, static/local-first, no backend). Read AGENTS.md first — this Next version has breaking changes; consult node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md before writing the route handler.

GOAL: The home route currently ships ~118KB of vocab data (all 1,020 items' hanzi/pinyin/english via homeData()/toTopicSummary). Slim it to a hanzi-only topic index (~75KB) and lazy-load a word-search index (~67KB) only when the user focuses the home search box. Search behavior must be identical once loaded. Do NOT touch /duel (it keeps homeData()), topic/category/path pages, or the dataset.

IMPLEMENT, in order:
1. src/lib/types.ts — add, next to the existing TopicSummary block:
   export type VocabItemIndex = Pick<VocabItem, "hanzi">;
   export type TopicIndexEntry = Omit<Topic, "items"> & { items: VocabItemIndex[] };
   export type HomeIndexData = { categories: Category[]; topics: TopicIndexEntry[] };
   export type WordIndexEntry = { slug: string; items: VocabItemSummary[] };
   Keep TopicSummary/HomeData (duel uses them). Document the index/word-index split in the same comment style.
2. src/lib/data-logic.ts — add pure helpers (same dataset-parameterized style as toTopicSummary):
   toTopicIndexEntry(topic: Topic): TopicIndexEntry — keep every topic-level field (slug, titleCn, titleEn, category, categorySlug, videoPath, video), items reduced to { hanzi }.
   toWordIndex(topics: Topic[]): WordIndexEntry[] — [{ slug, items: [{hanzi,pinyin,english}] }].
   mergeWordIndex(indexTopics: TopicIndexEntry[], words: WordIndexEntry[] | null): TopicSummary[] — join by slug; when words is null or a slug is missing, pad pinyin/english with "" (never crash on drift).
   Widen datasetSummary's param to { items: VocabItemIndex[] }[] (TopicSummary stays assignable).
3. src/lib/data.ts — build const homeIndex and const words once at module scope; export homeIndexData(): HomeIndexData and wordIndex(): WordIndexEntry[]. Keep homeData() untouched. Update the module comments.
4. NEW src/app/search-index.json/route.ts — export const dynamic = "force-static"; export function GET() { return Response.json(wordIndex()); }. If the dotted folder breaks the build (verify with npm run build), use src/app/search-index/route.ts instead and add an explicit url.pathname === "/search-index" branch to sw.js caching.
5. src/app/page.tsx — pass homeIndexData() to HomeApp; leave metadata/JSON-LD (full data.topics, server-side) alone.
6. src/components/home-app.tsx — prop becomes { data: HomeIndexData }. Add:
   const [words, setWords] = useState<WordIndexEntry[] | null>(null);
   const [wordsState, setWordsState] = useState<"idle"|"loading"|"ready"|"error">("idle");
   ensureWordIndex(): idempotent fetch("/search-index.json") → setWords/setWordsState; wire to the search input's onFocus (prefetch) and first onChange; on "error", allow retry on next focus.
   const topics = useMemo(() => mergeWordIndex(data.topics, words), [data.topics, words]);
   Point the existing `filtered`, `wordResults` (searchWords), datasetSummary, and the TopicCard grid at `topics` — downstream code keeps its TopicSummary shape unchanged.
   Microcopy under the search input, small muted text, only while query is non-empty: loading → "Loading full word search…"; error → "Full word search couldn't load — searching titles and characters only."
7. src/components/topic-card.tsx — in the matched-word rows (Row 5), render the pinyin and english <span>s only when the string is non-empty. No prop changes.
8. public/sw.js — (a) add json to the isStaticAsset extension regex; (b) add "/search-index.json" to PRECACHE_URLS; (c) bump CACHE_VERSION to "v3" (documented invalidation policy in the file header). NEVER touch media/video policy.
9. Tests:
   tests/home-data.test.mjs — add: toTopicIndexEntry preserves topic-level fields and strips items to hanzi-only; mergeWordIndex(index, toWordIndex(topics)) deep-equals topics.map(toTopicSummary) for all 102 topics; mergeWordIndex(index, null) pads "" and preserves hanzi order; hasPlayableVideo/datasetSummary/nextRecommendedTopic/wordKey parity on index entries; serialized HomeIndexData < 90_000 bytes AND < serialized HomeData; serialized word index < 80_000 bytes.
   tests/sw-policy.test.mjs — update the activate-cleanup test for CACHE "learn10-v3" (v2 must now be deleted); assert "/search-index.json" ∈ precacheUrls(sw); add a behavioral test that a same-origin GET for /search-index.json gets respondWith (not ignored). All existing media-policy tests must pass unchanged.

CONSTRAINTS: no new dependencies, no backend/external APIs, no invented vocabulary or data edits, pinyin stays on Chinese lines, keep the existing comment style/density. /duel must still receive full homeData().

VALIDATION GATE — all must pass before you finish:
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build

Then manually verify with npm run build && npm run start: view-source of / contains no pinyin/english item strings; /search-index.json serves prerendered JSON; searching "ni" on / shows identical results to the pre-change app.
```

---

All the reconnaissance is done — this sprint is mostly wiring together infrastructure that already exists. Here's the plan.

---

## Sprint 25 — Offline-saved badges on library topic cards plus bulk save-category-offline action

### Goal and user value

A learner packing for a flight currently has to open every lesson page one at a time to find the **⬇ Save for offline** button, and nothing in the library tells them which lessons are already downloaded. This sprint adds (1) a quiet "✓ Offline" chip on library topic cards (home grid + category pages) for topics whose video is in the offline cache, and (2) a one-tap **Save all videos offline** action on each category page that sequentially downloads every unsaved MP4 in the category with live progress, cancel, and honest failure reporting. Everything is browser-side (Cache Storage + the existing service worker); no backend, no new deps.

### Current-state findings grounded in actual files/components/helpers

- **The saved-state hook already exists but has zero consumers.** `src/components/use-saved-lessons.ts` exports `useSavedLessons()` (a `ReadonlySet<string>` of saved MP4 URLs), `notifySavedLessonsChanged()`, and `SAVED_LESSONS_EVENT` — its header comment even claims the library cards use it, but a grep shows **nothing imports it**. It was built ahead of need; this sprint is its first real consumer.
- **`notifySavedLessonsChanged()` is never called.** `src/components/save-offline-button.tsx` performs saves/removes (lines 62–88) without broadcasting, and `src/components/saved-lessons-panel.tsx` removes without broadcasting (`onRemove`, line 79). Wiring badges in without fixing this would leave cards stale after a save.
- **Offline primitives are complete and DI-testable.** `src/lib/offline.ts` has `saveLessonOffline(source, {pageUrl})` (CORS fetch, opaque/quota error handling, best-effort page-shell co-caching), `listSavedLessons()`, `isLessonSaved()`, `supportsCacheStorage()`, all injectable via `OfflineDeps` — mirrored by fakes in `tests/offline.test.mjs`.
- **URL matching is already proven exact.** `saved-lessons-panel.tsx:23–36` maps cache keys back to topics via `downloadableMp4Url(topic) === url`, so comparing the saved set against `downloadableMp4Url()` (from `src/lib/video.ts:59`) is the established pattern. Sources are absolute GitHub-Releases URLs (e.g. `https://github.com/aliceagent/.../ten-types-of-pets.mp4`), so Cache-key normalization is a non-issue.
- **`TopicCard` is presentational and caller-fed.** `src/components/topic-card.tsx` receives progress flags (`learned`, `favorite`, `crowned`) as props; badges live in Row 1 (lines 63–98) with an explicit style rule: at most one loud filled badge (Learned), everything else is a quiet neutral chip. `TopicSummary` (`src/lib/types.ts:62`) keeps `videoPath` + `video`, so `downloadableMp4Url()` works for home cards too.
- **Card callers:** `src/components/home-app.tsx:340` (library grid) and `src/components/category-app.tsx:53` (both client components with hooks already). `path-app.tsx:97` also renders cards — deferred (see non-goals).
- **Category page structure:** `src/app/categories/[slug]/page.tsx` (static, `generateStaticParams` over 14 categories) renders `CategoryApp`, whose header (lines 24–37) has a natural slot under the mastery chip for the bulk button. Data check: 100 of 102 topics have `provider: "mp4"` videos; per-category counts range 1–16 (`travel-and-tourism`: 16); `useful-phrases` has **0** MP4s, so the button must hide there.
- **House conventions:** hydration-safe support detection via mount effect (`save-offline-button.tsx:37–58`); `useOnlineStatus()` exists in `src/components/use-online-status.ts`; analytics is a typed union in `src/lib/analytics.ts:15–39` (already has `lesson_saved_offline`); tests are `node --test` `.mjs` files importing `.ts` sources directly with injected fakes; the service worker never auto-caches videos (policy enforced by `tests/sw-policy.test.mjs`) — bulk save stays page-context and user-initiated, so the policy is untouched.

### Exact implementation steps in sequence

1. **Broadcast saves/removes.** In `save-offline-button.tsx`, import `notifySavedLessonsChanged` and call it after a successful save (`onSave`) and remove (`onRemove`). In `saved-lessons-panel.tsx`, call it after `removeLessonOffline(url)` in `onRemove`.
2. **New pure module `src/lib/bulk-offline.ts`.** Two exports: `categoryOfflinePlan(topics, saved)` — filters to topics with a `downloadableMp4Url`, drops already-saved URLs, returns `{url, slug, pageUrl: "/topics/" + slug}` items; and `saveLessonsOffline(items, options)` — a **sequential** runner over `saveLessonOffline` that reports progress, supports cancel, collects per-item failures, and **stops early after 2 consecutive failures** (both quota-full and lost-connection make every remaining download futile, and each failed attempt still downloads a full MP4 — error-message introspection is too brittle, consecutive-failure cutoff handles both). All deps injectable, mirroring `OfflineDeps` style.
3. **Unit tests `tests/bulk-offline.test.mjs`.** Fake `saveLessonOffline` via injected deps (reuse the fake-caches/fetch pattern from `tests/offline.test.mjs`). Cover: plan skips YouTube/placeholder topics and already-saved URLs; plan builds correct `pageUrl`; runner saves sequentially and reports `onProgress`; one failure is recorded and the run continues; 2 consecutive failures stop the run with remaining items counted as skipped; `shouldCancel` stops between items with `cancelled: true`.
4. **Badge on `TopicCard`.** Add optional `savedOffline?: boolean` prop; render a quiet chip in the Row-1 badge cluster (next to `▶ Video`, same neutral chip styling as `★ Saved`), only when true.
5. **Wire badge into callers.** In `home-app.tsx` and `category-app.tsx`: call `useSavedLessons()`, pass `savedOffline={savedSet.has(downloadableMp4Url(topic) ?? "")}` to each `TopicCard`. Empty set during SSR/first paint means no hydration mismatch (badge pops in, matching the app's existing browser-only patterns).
6. **New component `src/components/save-category-offline-button.tsx`.** Client component; hides when the category plan is empty *and* nothing is saved (e.g. `useful-phrases`), or when `supportsCacheStorage()` fails (mount-effect detection per house style). Uses `useSavedLessons()` for current state, `useOnlineStatus()` to disable while offline, runs `saveLessonsOffline` on click, calls `notifySavedLessonsChanged()` after each successful item (via `onProgress`) so card badges light up live, and `track("category_saved_offline", {category, saved, failed, cancelled})` at the end. States: idle (with remaining count) / saving (n of total + Cancel) / all-saved chip / error line.
7. **Render it in `category-app.tsx`** header, below the mastery-summary chip (after line 36).
8. **Analytics union.** Add `"category_saved_offline"` to `AnalyticsEvent` in `src/lib/analytics.ts`.
9. **Run the full validation gate** (below).

### Likely files touched

| File | Change |
|---|---|
| `src/lib/bulk-offline.ts` | **new** — plan + sequential runner |
| `tests/bulk-offline.test.mjs` | **new** — unit tests |
| `src/components/save-category-offline-button.tsx` | **new** — bulk UI |
| `src/components/topic-card.tsx` | `savedOffline` prop + chip |
| `src/components/home-app.tsx` | `useSavedLessons` + prop |
| `src/components/category-app.tsx` | `useSavedLessons` + prop + bulk button |
| `src/components/save-offline-button.tsx` | call `notifySavedLessonsChanged()` |
| `src/components/saved-lessons-panel.tsx` | call `notifySavedLessonsChanged()` |
| `src/lib/analytics.ts` | one new event name |

### Proposed function/component names and TypeScript signatures

```ts
// src/lib/bulk-offline.ts
export type BulkSaveItem = { url: string; slug: string; pageUrl: string };

/** Topics in a category that still need downloading: has a downloadable MP4,
 *  not already in the saved set. Accepts Topic or TopicSummary shapes. */
export function categoryOfflinePlan(
  topics: Pick<Topic, "slug" | "videoPath" | "video">[],
  saved: ReadonlySet<string>,
): BulkSaveItem[];

export type BulkSaveProgress = { done: number; total: number; current: BulkSaveItem };
export type BulkSaveResult = {
  saved: number;
  failed: { item: BulkSaveItem; message: string }[];
  skipped: number;          // remaining items after early stop
  cancelled: boolean;
};

export async function saveLessonsOffline(
  items: BulkSaveItem[],
  options: SaveOptions & {
    onProgress?: (p: BulkSaveProgress) => void;
    shouldCancel?: () => boolean;
  } = {},
): Promise<BulkSaveResult>;
```

```tsx
// src/components/save-category-offline-button.tsx
export function SaveCategoryOfflineButton({
  categorySlug,
  categoryName,
  topics,
}: { categorySlug: string; categoryName: string; topics: Topic[] });

// src/components/topic-card.tsx — added prop
savedOffline?: boolean;
```

### UI copy / microcopy

- Card chip: `✓ Offline` — `title="Video saved — plays without internet"`
- Bulk idle: `⬇ Save {n} video{s} offline` with sub-line `Videos download now and play without internet later.`
- Partially saved idle: same label with the *remaining* count.
- Saving: `Saving {done + 1} of {total}…` + `Cancel` button (`aria-label="Cancel saving videos"`).
- All saved: chip `✓ All {total} videos saved offline`.
- Failure line (role=alert): `{failed} video{s} didn't save. Check your connection and storage, then try again.`
- Offline-disabled helper: `You're offline — reconnect to download videos.`

### Test plan

- **New `tests/bulk-offline.test.mjs`** (see step 3): plan filtering (YouTube/placeholder/`useful-phrases`-style topics excluded, saved URLs excluded, `pageUrl` shape), sequential ordering, progress callbacks, continue-after-one-failure, stop-after-2-consecutive-failures with `skipped`, cancel semantics. All with injected fakes — no DOM.
- **Existing suites must stay green untouched:** `tests/offline.test.mjs` (helpers unchanged), `tests/sw-policy.test.mjs` (SW untouched — bulk saving is page-context, preserving the never-auto-cache policy), `tests/video.test.mjs`, `tests/home-data.test.mjs`.
- Gate: `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build` (build must keep all routes static/SSG, including the 14 `/categories/[slug]` pages).

### Manual QA checklist

1. Online, open a lesson, tap **⬇ Save for offline** → return to home library and the category page: card now shows `✓ Offline` **without a reload** (event wiring).
2. Open a small category (e.g. Sports & Activities, 3 videos) → button reads `⬇ Save 3 videos offline` → tap → progress counts up, badges on the grid light up one by one → ends as `✓ All 3 videos saved offline`.
3. `/offline` page → saved-lessons panel lists all three with sizes; **Remove** one → back on the category page the badge is gone and the button reads `⬇ Save 1 video offline`.
4. Start a bulk save in a large category → tap **Cancel** mid-run → completed items keep badges, button shows remaining count.
5. DevTools → Network → Offline mid-run → run stops after 2 consecutive failures, error line appears, nothing crashes; button disabled with offline helper text while `navigator.onLine` is false.
6. `useful-phrases` category → no bulk button rendered.
7. Firefox private mode / non-secure context (no Cache Storage) → no button, no badges, no console errors.
8. Hard-refresh home page → no hydration warning (badges appear post-mount).

### Acceptance criteria

- Topic cards on `/` and `/categories/[slug]` show a `✓ Offline` chip exactly for topics whose MP4 URL is in `learn10-videos-v1`, updating live on save/remove from any surface.
- Each category page with ≥1 downloadable MP4 offers a bulk save with visible progress, cancel, and per-run failure reporting; already-saved videos are never re-downloaded.
- Downloads remain strictly user-initiated (SW policy tests untouched and green).
- New logic module has unit tests; full validation gate passes; all routes remain static.

### Risk and rollback notes

- **Storage quota**: `travel-and-tourism` is 16 MP4s — bulk save can hit `QuotaExceededError` partway. Mitigated by per-item error capture plus the 2-consecutive-failure early stop; already-saved items are never lost. Sizes are unknown pre-download (no HEAD probing this sprint — see deferrals), so copy says "sizes vary" implicitly via honest failure text.
- **Metered connections**: the count in the button label makes the download volume explicit before tapping; nothing downloads without a tap.
- **Rollback**: purely additive — revert the commit and no stored data is orphaned (the video cache format is unchanged; saved videos keep working with the old UI).

### Non-goals / deferrals

- No badge on `path-app.tsx` cards (path page omits `quizStats` and is a guided flow, not a library surface) — trivial follow-up if wanted.
- No pre-download size estimate (HEAD requests) or storage-quota meter (`navigator.storage.estimate()`) — good candidate for a later offline sprint.
- No "remove whole category" bulk action; per-lesson removal on `/offline` already covers it.
- No service-worker changes, no background/auto downloading, no parallel downloads.
- `SavedLessonsPanel` doesn't subscribe to `SAVED_LESSONS_EVENT` (it's a different page; it loads fresh on mount).

### Ready-to-run Opus implementation prompt for Sprint 25

```text
You are implementing Sprint 25 of the "Learn 10 Mandarin Words" app (Next.js 16 / React 19 / Tailwind 4, static, local-first, no backend). Read AGENTS.md first — this Next.js version may differ from your training data; consult node_modules/next/dist/docs/ if framework questions arise.

GOAL: (A) show a quiet "✓ Offline" chip on library topic cards (home grid + category pages) for topics whose lesson MP4 is saved in the offline video cache; (B) add a bulk "Save all videos offline" action to each category page with sequential downloads, live progress, cancel, and failure reporting.

EXISTING INFRASTRUCTURE (do not rebuild):
- src/lib/offline.ts — saveLessonOffline(source, {pageUrl}), listSavedLessons(), supportsCacheStorage(), formatBytes(); all DI-injectable via OfflineDeps.
- src/components/use-saved-lessons.ts — useSavedLessons() hook returning ReadonlySet<string> of saved MP4 URLs + notifySavedLessonsChanged(). Currently has ZERO consumers; this sprint wires it in.
- src/lib/video.ts — downloadableMp4Url(topic) returns the MP4 URL or null; works on TopicSummary too.
- src/components/use-online-status.ts — useOnlineStatus().
- src/components/topic-card.tsx — presentational card; Row-1 badge cluster (quiet neutral chips; only "Learned" is loud/filled).
- Card callers: src/components/home-app.tsx (~line 340) and src/components/category-app.tsx (~line 53). Do NOT touch path-app.tsx.

TASKS in order:
1. save-offline-button.tsx: call notifySavedLessonsChanged() after successful save and remove. saved-lessons-panel.tsx: call it after removeLessonOffline in onRemove.
2. NEW src/lib/bulk-offline.ts:
   - categoryOfflinePlan(topics, saved): items {url, slug, pageUrl: `/topics/${slug}`} for topics with a downloadableMp4Url not in `saved`.
   - saveLessonsOffline(items, options): SEQUENTIAL runner over saveLessonOffline; options extend SaveOptions with onProgress({done,total,current}) and shouldCancel(); collect per-item failures {item, message}; STOP EARLY after 2 consecutive failures (quota-full / lost connection make the rest futile), counting the rest as `skipped`; return {saved, failed, skipped, cancelled}. Keep deps injectable in the style of offline.ts.
3. NEW tests/bulk-offline.test.mjs (node --test, import ../src/lib/bulk-offline.ts, fakes modeled on tests/offline.test.mjs): plan filters non-mp4 + already-saved + builds pageUrl; runner is sequential, reports progress, continues after one failure, stops after 2 consecutive failures with skipped count, honors shouldCancel between items.
4. topic-card.tsx: optional savedOffline?: boolean prop → quiet chip `✓ Offline` (title "Video saved — plays without internet") in the Row-1 badge cluster, styled like the existing "★ Saved" chip.
5. home-app.tsx + category-app.tsx: const saved = useSavedLessons(); pass savedOffline={saved.has(downloadableMp4Url(topic) ?? "")} to TopicCard.
6. NEW src/components/save-category-offline-button.tsx ("use client"): props {categorySlug, categoryName, topics}. Hidden when Cache Storage unsupported (mount-effect detection like save-offline-button.tsx) or the category has no downloadable MP4s (e.g. useful-phrases). Uses useSavedLessons() to compute the remaining plan and useOnlineStatus() to disable while offline. States/copy:
   - idle: "⬇ Save {n} video{s} offline" + sub-line "Videos download now and play without internet later."
   - saving: "Saving {done+1} of {total}…" + Cancel button
   - all saved: chip "✓ All {total} videos saved offline"
   - failure (role="alert"): "{failed} video{s} didn't save. Check your connection and storage, then try again."
   - offline: disabled + "You're offline — reconnect to download videos."
   Call notifySavedLessonsChanged() after each successful item so card badges update live; track("category_saved_offline", {category, saved, failed, cancelled}) when a run ends.
7. category-app.tsx: render the button in the header below the mastery-summary chip.
8. src/lib/analytics.ts: add "category_saved_offline" to the AnalyticsEvent union.

CONSTRAINTS: downloads must stay strictly user-initiated (do NOT modify public/sw.js — tests/sw-policy.test.mjs must stay green). No new dependencies. No backend/external services. Match existing code style, comment density, and hydration-safe browser-detection patterns. Keep all routes static.

VALIDATION GATE (all must pass):
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build
```

---

Research done — the plan below is grounded in the actual SW, registration component, toast conventions, and test harness. One load-bearing finding up front: `public/sw.js` currently calls `self.skipWaiting()` unconditionally on install, so today there is *never* a waiting worker — creating one (and asking the user before activating it) is the heart of this sprint.

## Sprint 26 — Service worker update toast: notify when a new version is waiting and offer one-tap refresh

### Goal and user value

Installed-PWA learners keep the app open (or re-open it from the home screen) for days; today a new deploy silently `skipWaiting()`s and claims clients, so half-loaded pages can run old JS against a new worker, and users never learn a refresh would give them the new version. This sprint switches the service worker to the standard "wait until told" lifecycle and adds a small, dismissible toast — "Update available → Refresh" — that activates the waiting worker and reloads in one tap. Even if dismissed, the update still applies automatically on the next full app restart (a waiting worker activates once all tabs close), so nobody is worse off.

### Current-state findings grounded in actual files/components/helpers

- **`public/sw.js`** — hand-written offline shell, no build step. `install` precaches shell pages and then chains `.then(() => self.skipWaiting())` (`public/sw.js:46`); `activate` deletes stale caches and calls `self.clients.claim()` (`public/sw.js:50-63`). `CACHE_VERSION = "v2"`. There is **no `message` listener** and no update-consent mechanism. Because of `skipWaiting()`, `registration.waiting` is never populated today.
- **`src/components/pwa-register.tsx`** — client component mounted globally in `src/app/layout.tsx:72`. Registers `/sw.js` in production only (`process.env.NODE_ENV !== "production"` guard at line 18), discards the returned registration, and separately renders the custom install banner (fixed, `bottom-20 z-40`, `rounded-2xl border-white/10 bg-slate-900/95`, emerald pill CTA). This is the natural home for the update flow — it already owns registration and the banner design language.
- **`src/components/toast.tsx`** — existing `Toast` is a 2-second auto-dismissing status chip with no action button, so it is *not* reusable for a persistent action toast; a new small component is needed, but its styling (`fixed bottom-20 z-50 rounded-full border-white/15 bg-slate-900/95`, `role="status"`) and the install banner's button styling should be copied for consistency.
- **`next.config.ts`** — already serves `/sw.js` with `Cache-Control: no-cache, no-store, must-revalidate`, so the browser's ~24h SW update check plus explicit `registration.update()` calls will always see fresh bytes. No config change needed.
- **`tests/sw-policy.test.mjs`** — loads the real `sw.js` source into a `new Function("self","caches","fetch", …)` sandbox, captures handlers via `addEventListener`, and already stubs `selfObj.skipWaiting` (line 74). This harness extends cleanly to assert the new lifecycle (install must *not* skip-wait; a `message` handler must). Note its `activate` test hardcodes `learn10-v2` as the preserved cache — a reason **not** to bump `CACHE_VERSION` this sprint (any byte change to `sw.js` already triggers the update flow; no strategy change means no bump needed).
- **`src/lib/offline.ts` + `tests/offline.test.mjs`** — establish the repo's testability convention: page-context helpers with injectable structural types (`CacheLike`, `OfflineDeps`) imported directly as `.ts` into `node --test` (Node v24 type stripping). The new update helpers should follow this exactly.
- **`src/lib/analytics.ts`** — typed no-op event union already includes `install_prompt_shown` / `install_accepted`; adding `sw_update_shown` / `sw_update_applied` follows the pattern.
- **`src/components/use-online-status.ts`** — the naming/shape convention for small client hooks, if a hook is preferred over inline effects.
- **Pre-existing bug found while researching (out of scope, flag only):** `APP_CACHE = "learn10-v1"` in `src/lib/offline.ts:24` no longer matches `CACHE = "learn10-v2"` in `sw.js:30`, so the best-effort page-shell co-caching from `saveLessonOffline` writes into a cache that `activate` cleanup deletes. Worth its own tiny fix, not bundled here.

### Exact implementation steps in sequence

1. **`public/sw.js` — lifecycle change.** Remove `.then(() => self.skipWaiting())` from the `install` handler. Add a `message` listener at top level: on `event.data?.type === "SKIP_WAITING"`, call `self.skipWaiting()`. Keep `clients.claim()` in `activate` (needed so the refreshed page is controlled immediately). Update the header comment block to document the new consent-based update flow. Do **not** bump `CACHE_VERSION`.
2. **`src/lib/sw-update.ts` (new)** — pure, dependency-injected page-context helpers mirroring `offline.ts` style: minimal structural types for registration/worker/container, `watchForWaitingWorker(...)` (handles both "already waiting on load" and `updatefound → statechange:"installed"` with an existing active worker so first installs never notify), `activateWaitingWorker(...)` (posts `SKIP_WAITING`, listens `controllerchange` *only from this point* — this ordering is the reload-loop guard — and reloads once via an internal flag).
3. **`src/components/update-toast.tsx` (new)** — small presentational client component: fixed toast above the bottom nav, `role="status" aria-live="polite"`, message + "Refresh" primary button (emerald pill, `min-h-[44px]`, matching the install banner) + ✕ dismiss button. No timers; it stays until acted on.
4. **`src/components/pwa-register.tsx`** — keep the returned `ServiceWorkerRegistration` in state; after registration, wire `watchForWaitingWorker(reg, setWaitingWorker)`; add a `visibilitychange` listener that calls `reg.update().catch(() => {})` when the tab becomes visible (this is what actually surfaces updates for long-lived installed PWAs); render `<UpdateToast>` when `waitingWorker` is set and not dismissed (session-state dismissal via `useState`, like the install banner's `dismissed`). Refresh handler calls `activateWaitingWorker(...)` and tracks `sw_update_applied`; track `sw_update_shown` when the toast first appears. If both banners would show, render only the update toast (an update is more urgent than an install nudge).
5. **`src/lib/analytics.ts`** — add `"sw_update_shown" | "sw_update_applied"` to `AnalyticsEvent`.
6. **`tests/sw-policy.test.mjs`** — add lifecycle invariants using the existing `loadSw` sandbox: (a) running the captured `install` handler to completion never calls `skipWaiting` (spy on `selfObj.skipWaiting`); (b) a captured `message` handler exists and calling it with `{data: {type: "SKIP_WAITING"}}` calls `skipWaiting`, while `{data: {type: "OTHER"}}` / `{data: null}` do not. (`loadSw`'s `Function` factory needs no changes — handlers are already captured generically.)
7. **`tests/sw-update.test.mjs` (new)** — unit tests for `sw-update.ts` with fake event-emitter registrations/workers (same fake-object style as `tests/offline.test.mjs`); cases listed in the test plan below.
8. Run the full validation gate.

### Likely files touched

| File | Change |
|---|---|
| `public/sw.js` | Remove install-time `skipWaiting`; add `SKIP_WAITING` message handler; update policy comment |
| `src/lib/sw-update.ts` | **New** — testable update-flow helpers |
| `src/components/update-toast.tsx` | **New** — persistent action toast UI |
| `src/components/pwa-register.tsx` | Hold registration, watch for waiting worker, visibility-driven `update()`, render toast |
| `src/lib/analytics.ts` | Two new event names |
| `tests/sw-policy.test.mjs` | New lifecycle invariants |
| `tests/sw-update.test.mjs` | **New** — helper unit tests |

### Proposed function/component names and TypeScript signatures

```ts
// src/lib/sw-update.ts
export const SKIP_WAITING_MESSAGE = { type: "SKIP_WAITING" } as const; // string literal mirrored in sw.js (no build step there)

export type WorkerLike = {
  state: string;
  postMessage(data: unknown): void;
  addEventListener(type: "statechange", fn: () => void): void;
  removeEventListener(type: "statechange", fn: () => void): void;
};

export type RegistrationLike = {
  waiting: WorkerLike | null;
  installing: WorkerLike | null;
  active: WorkerLike | null;
  addEventListener(type: "updatefound", fn: () => void): void;
  removeEventListener(type: "updatefound", fn: () => void): void;
};

export type ContainerLike = {
  addEventListener(type: "controllerchange", fn: () => void): void;
  removeEventListener(type: "controllerchange", fn: () => void): void;
};

/** Invoke onWaiting for an already-waiting worker or when a NEW version finishes
 *  installing behind an active one (first installs never notify). Returns unsubscribe. */
export function watchForWaitingWorker(
  reg: RegistrationLike,
  onWaiting: (worker: WorkerLike) => void
): () => void;

/** Tell the waiting worker to take over, then reload exactly once on controllerchange.
 *  The listener attaches only here, so first-install clients.claim() can't reload anyone. */
export function activateWaitingWorker(
  worker: WorkerLike,
  container: ContainerLike,
  reload: () => void
): void;
```

```tsx
// src/components/update-toast.tsx
export function UpdateToast(props: { onRefresh: () => void; onDismiss: () => void }): React.JSX.Element;
```

In `pwa-register.tsx`: `const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);` plus `updateDismissed` state.

### UI copy/microcopy

- Title: **“Update available”**
- Body: **“A new version of Learn 10 is ready.”**
- Primary button: **“Refresh”**
- Dismiss button `aria-label`: **“Dismiss update notice”** (visual ✕, `aria-hidden` glyph — same pattern as the install banner)

No Chinese text is involved, so no pinyin obligations. Tone matches existing copy ("Add to your home screen for offline study.").

### Test plan

`tests/sw-update.test.mjs` (new, `node --test`, direct `.ts` import like `offline.test.mjs`):
1. `watchForWaitingWorker` fires immediately when `reg.waiting` is already set (page loaded after the update installed).
2. Fires after `updatefound` → installing worker reaches `"installed"` **with** `reg.active` present.
3. Does **not** fire on first install (`updatefound` + `"installed"` but `reg.active === null`).
4. Unsubscribe removes both `updatefound` and pending `statechange` listeners (no callback after cleanup).
5. `activateWaitingWorker` posts `{type: "SKIP_WAITING"}` to the worker.
6. Reloads exactly once even if `controllerchange` fires twice, and removes its listener.
7. Does not reload before `controllerchange` fires.

`tests/sw-policy.test.mjs` (extend existing sandbox):
8. Install handler completes without calling `self.skipWaiting` (spy).
9. `message` handler calls `skipWaiting` for `{type:"SKIP_WAITING"}` and ignores other/absent payloads.
10. Existing 20+ policy tests still pass unchanged (no `PRECACHE_URLS`/cache-name changes).

### Manual QA checklist

Dev mode never registers the SW (`pwa-register.tsx:18`), so QA uses `npm run build && npm start`:

- [ ] First visit (clean profile / cleared storage): SW installs and activates; **no** update toast appears.
- [ ] Edit any byte in `public/sw.js` (e.g. a comment), rebuild, restart server, focus the existing tab: toast appears with "Update available".
- [ ] Tap **Refresh**: page reloads once, DevTools → Application → Service Workers shows the new worker active, toast gone; no reload loop.
- [ ] Tap **✕** instead: toast disappears for the session; close all tabs, reopen — new version is active without any toast (waiting worker auto-activated on restart).
- [ ] Background the tab, deploy a change, foreground it: `visibilitychange` triggers `update()` and the toast appears without a manual reload.
- [ ] With both an available install prompt and a waiting update, only the update toast renders.
- [ ] Offline flows regress-check: airplane mode → app shell pages load, a previously saved lesson video still plays with seeking.
- [ ] Screen reader (VoiceOver/NVDA quick pass): toast is announced politely; both buttons reachable and ≥44px targets.

### Acceptance criteria

1. A deploy that changes `sw.js` (or its precached shell) surfaces a dismissible "Update available" toast in installed/controlled clients, at latest when the tab next becomes visible.
2. Tapping **Refresh** activates the new worker and reloads the page exactly once; the user lands on the new version.
3. First-time visitors never see the toast; dismissing it never blocks the update from applying on next full restart.
4. The service worker no longer self-activates over a running client without consent (no install-time `skipWaiting`), verified by test.
5. All video/precache policy invariants in `tests/sw-policy.test.mjs` remain intact, and the full gate passes: `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build`.

### Risk and rollback notes

- **Slower background updates (intended tradeoff):** removing install-time `skipWaiting()` means users who ignore the toast get the new version only after closing all tabs, instead of mid-session. This is the point — mid-session takeover is exactly the version-skew hazard — but note it in the commit message.
- **Reload-loop hazard:** `clients.claim()` fires `controllerchange` on first install; a naïvely global listener would reload every new visitor. Mitigated by attaching the listener only inside `activateWaitingWorker` (user-initiated) and a fire-once flag — both unit-tested.
- **Transition deploy:** users currently on the v2 worker (which skip-waits) will have the *old* worker auto-activate this new SW one last time; the toast behavior begins with the following deploy. Harmless, worth knowing during QA.
- **iOS Safari:** supports `waiting`/`controllerchange`; `visibilitychange`-driven `update()` is the reliable trigger there. No `beforeinstallprompt` dependence.
- **Rollback:** single revert restores install-time `skipWaiting`; no data/storage migrations, cache names unchanged, localStorage untouched.

### Non-goals / deferrals

- No `CACHE_VERSION` bump, no changes to caching strategies, precache list, or the video-cache policy.
- No persistent (localStorage) dismissal memory — session-only, matching the install banner.
- No periodic `setInterval` update polling — visibility-driven checks suffice for this app's usage pattern.
- No release notes / changelog in the toast; no generalization of `toast.tsx` into a toast system.
- The `APP_CACHE` (`learn10-v1`) vs `CACHE` (`learn10-v2`) drift in `src/lib/offline.ts:24` is a separate pre-existing bug — file it for a future sprint rather than widening this one.

### Ready-to-run Opus implementation prompt for Sprint 26

```text
You are implementing Sprint 26 of the "Learn 10 Mandarin Words" app (Next.js 16, React 19, Tailwind 4, static/local-first, no backend). Read AGENTS.md first and consult node_modules/next/dist/docs/ if framework details matter. Work only in this repo; install nothing.

GOAL: When a new service worker version is waiting, show a dismissible "Update available" toast with a one-tap Refresh that activates it and reloads once. The SW must stop self-activating without consent.

CONTEXT (verified):
- public/sw.js is a hand-written no-build offline shell. Its install handler currently chains `.then(() => self.skipWaiting())` (line ~46) — so `registration.waiting` never exists today. activate keeps `clients.claim()`. Do NOT bump CACHE_VERSION and do NOT touch caching strategy, PRECACHE_URLS, or the video-cache policy (tests/sw-policy.test.mjs guards these).
- src/components/pwa-register.tsx registers /sw.js (production only) from src/app/layout.tsx and renders the custom install banner (fixed bottom-20, rounded-2xl, bg-slate-900/95, emerald pill CTA, 44px targets). It currently discards the registration.
- src/lib/offline.ts + tests/offline.test.mjs define the convention: injectable structural types (CacheLike-style), pure page-context helpers, imported directly as .ts into node --test .mjs files.
- src/components/toast.tsx is a 2s auto-dismiss status chip — NOT reusable for an action toast; copy its styling/a11y (role="status", aria-live="polite") into a new component instead.
- src/lib/analytics.ts has a typed AnalyticsEvent union (see install_prompt_shown).
- next.config.ts already serves /sw.js with no-store — no config changes needed.

IMPLEMENT, in order:
1. public/sw.js: remove install-time skipWaiting; add a top-level "message" listener that calls self.skipWaiting() when event.data?.type === "SKIP_WAITING"; keep clients.claim(); update the header comment to describe the consent-based update flow.
2. New src/lib/sw-update.ts with injectable structural types (WorkerLike, RegistrationLike, ContainerLike) and:
   - SKIP_WAITING_MESSAGE = { type: "SKIP_WAITING" } as const
   - watchForWaitingWorker(reg, onWaiting): () => void — fires for an already-waiting worker, or on updatefound → statechange "installed" ONLY when reg.active exists (first installs must not notify); returns an unsubscribe that removes all listeners.
   - activateWaitingWorker(worker, container, reload): void — posts SKIP_WAITING_MESSAGE, then listens for controllerchange (attach ONLY here — this prevents first-install reload loops) and calls reload() exactly once, removing the listener.
3. New src/components/update-toast.tsx: persistent fixed toast above the bottom nav (bottom-20, z-50), role="status" aria-live="polite"; title "Update available", body "A new version of Learn 10 is ready.", emerald "Refresh" button, ✕ dismiss with aria-label "Dismiss update notice"; min-h-[44px] targets; styling consistent with the install banner in pwa-register.tsx.
4. src/components/pwa-register.tsx: keep the registration in state; wire watchForWaitingWorker → setWaitingWorker; add a visibilitychange listener calling reg.update().catch(() => {}) when the document becomes visible (clean up on unmount); render UpdateToast when a worker is waiting and not session-dismissed; when the update toast is visible, suppress the install banner. Refresh → activateWaitingWorker(waitingWorker, navigator.serviceWorker, () => window.location.reload()) + track("sw_update_applied"); track("sw_update_shown") once when the toast appears.
5. src/lib/analytics.ts: add "sw_update_shown" and "sw_update_applied" to AnalyticsEvent.
6. Tests:
   - Extend tests/sw-policy.test.mjs using its existing loadSw sandbox: (a) the install handler completes without calling self.skipWaiting (spy); (b) a "message" handler exists, calls skipWaiting for {data:{type:"SKIP_WAITING"}}, and ignores {data:{type:"OTHER"}} and {data:null}. Keep every existing test passing unchanged.
   - New tests/sw-update.test.mjs (node --test, import ../src/lib/sw-update.ts directly, fake event-emitter registration/worker/container objects in the style of tests/offline.test.mjs): already-waiting fires; updatefound+installed with active fires; first install (active=null) does not fire; unsubscribe removes listeners; activateWaitingWorker posts the message; reloads exactly once across duplicate controllerchange events; never reloads before controllerchange.

CONSTRAINTS: no new dependencies; no backend/analytics providers/external services; clean sleek dark UI consistent with existing components; do not modify caching behavior or cache names; do not persist dismissal to localStorage (session state only); leave src/lib/offline.ts untouched (its APP_CACHE drift is a known separate issue).

VALIDATION GATE (all must pass before you finish):
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build
```

---

All findings are in. Here is the grounded plan.

---

## Sprint 27 — Offline-aware audio handling: disable listening modes gracefully with clear messaging when TTS voices are unavailable

### Goal and user value

Today the app already hides listening features when a device *permanently* lacks a Chinese voice (`unsupported` / `no-chinese-voice` in `src/lib/speech.ts`). What it does **not** handle is the offline case: on browsers whose only Chinese voices are network-backed (e.g. desktop Chrome's "Google 普通话" voice, `localService: false`), `classifySupport()` reports `"ready"`, every listening mode appears, and a tap on ▶ produces silence. This sprint makes audio availability *connectivity-aware*: when the learner is offline and every Chinese voice on the device needs the network, listening controls become visibly disabled with an honest one-line explanation, and in-progress listening drills steer the learner to a visual mode instead of stalling silently. Devices with a local Chinese voice keep full listening offline — nothing is disabled that would actually work.

### Current-state findings (grounded in actual files)

- **`src/lib/speech.ts`** — pure, node-testable voice logic. `SpeechVoiceLike` already carries `localService?: boolean`; `rankChineseVoice()` already prefers local voices as a tie-breaker (line 72, "offline-capable" comment), but nothing *classifies* connectivity. `SpeechSupport` = `loading | unsupported | no-chinese-voice | ready`; `canAttemptSpeech()` gates the UI.
- **`src/components/use-speech.ts`** — the single hardened hook every speak control uses. Its mount effect (`refresh()` at lines 80–94) already re-reads `synth.getVoices()` on `voiceschanged`; the natural spot to also compute "are all Chinese voices network-only". It does not know online status.
- **`src/components/use-online-status.ts`** — a ready-made, hydration-safe `useOnlineStatus(): boolean` hook (returns `true` for SSR/first render, then tracks `navigator.onLine` + events). **It currently has zero consumers** — this sprint is its first real use.
- **`src/components/speak-button.tsx`** — already renders a disabled state (`unavailable` = `unsupported | no-chinese-voice`, line 23) with title copy. Offline-with-network-voice falls through to "enabled but silent".
- **`src/components/topic-app.tsx`** — computes `speechAvailable = canAttemptSpeech(speechStatus)` (line 80) and threads it to `WordsPanel` (396), `QuizPanel` (436), `BossPanel` (471), and the tone-practice Read/Listen chips (499, 512). The Listen chip is *hidden* (not disabled) when unavailable, and `toneMode === "listen"` silently falls back to `TonePractice`.
- **`src/components/topic/quiz-panel.tsx`** — the listening quiz mode chip appears only when `speechAvailable` (line 166); the pre-answer play screen has the "No sound?" microcopy (lines 240–244), duplicated nearly verbatim in `tone-listen-trainer.tsx` (232–234) and `listen-all-bar.tsx` (63).
- **`src/components/topic/words-panel.tsx` + `topic/listen-all-bar.tsx`** — the "Play all" drill bar renders only when `speechAvailable` (words-panel line 58); `WordsPanel` is consumed only by `topic-app.tsx`.
- **`src/components/tone-listen-trainer.tsx`** — audio-first drill; `next()` autoplays the next word (line 125). If connectivity drops mid-run it keeps offering silent rounds.
- **`src/components/duel-app.tsx`** — hides the listening mode option without a voice (line 278) and already has a silent fallback `effectiveMode: QuizMode = mode === "listening" && !speechAvailable ? "hanzi-english" : mode` (line 88). Swapping its gate to the new availability value gets offline handling nearly free.
- **`src/components/use-listen-all.ts`** — already skips words on genuine speech errors rather than stalling; needs no change (gating happens above it).
- **Tests** — `tests/speech.test.mjs` runs under `node --test`, imports `../src/lib/speech.ts` directly, and uses tiny voice fixtures (`const v = (lang, extra) => ...`) — the exact pattern to extend.
- **`src/lib/offline.ts`** is video-cache-only (Cache Storage); speech connectivity logic does **not** belong there — it belongs in `speech.ts` beside the existing voice classification.

### Exact implementation steps in sequence

1. **Extend `src/lib/speech.ts`** (pure, DOM-free):
   - Add `AudioAvailability` type: `"ready" | "offline-voices" | "unavailable"`.
   - Add `hasOnlyNetworkChineseVoices(voices)`: `true` iff at least one Chinese voice exists **and** every Chinese voice has `localService === false` *explicitly*. `localService: undefined` counts as unknown → optimistic `false` (never disable on uncertainty — same philosophy as the existing empty-list rule in `classifySupport`).
   - Add `classifyAudioAvailability(support, onlyNetworkChineseVoices, online)`: `unsupported`/`no-chinese-voice` → `"unavailable"`; otherwise offline + `onlyNetworkChineseVoices` → `"offline-voices"`; otherwise `"ready"` (this keeps the optimistic `loading` behavior of `canAttemptSpeech`).
   - Add `listeningHint(support, availability)` returning the shared microcopy string (centralizes the three duplicated "No sound?" strings).
2. **Extend `tests/speech.test.mjs`** with fixture-based tests for both new classifiers and the hint copy (see Test plan).
3. **Update `src/components/use-speech.ts`**: in the existing `refresh()`, also `setNetworkOnlyVoices(hasOnlyNetworkChineseVoices(synth.getVoices()))`; call `useOnlineStatus()` inside the hook; expose `availability: AudioAvailability` on `UseSpeechResult` via `classifyAudioAvailability(status, networkOnlyVoices, online)`. No change to `speak`/`stop` internals. Hydration stays safe: initial `status: "loading"` + initial `online: true` → `"ready"`, matching today's optimistic first render.
4. **Update `src/components/speak-button.tsx`**: treat `availability !== "ready"` as the disabled condition; add the offline-specific title copy. This fixes every scattered pronounce button (words grid, sentences, daily, practice, boss reveal) in one place.
5. **Update `src/components/topic-app.tsx`**: derive `audio = useSpeech().availability`; `speechAvailable = audio === "ready"`. In the tone-practice chips (line 496–511): when `audio === "offline-voices"`, render the "Listen 🔊" chip **disabled** (`disabled` + `aria-disabled`, muted styling) instead of removing it, with the offline note below; keep the existing *hide* behavior for `"unavailable"` (deliberate prior decision — no dead control on permanently voiceless devices). Pass `audio` down to `WordsPanel` and `QuizPanel` as a new `audioAvailability` prop.
6. **Update `src/components/topic/quiz-panel.tsx`**: accept `audioAvailability`; show the listening chip when `ready`, show it disabled with the offline note when `offline-voices`, hide when `unavailable` (as today). If the learner is *already in* listening mode when availability flips to `offline-voices` mid-quiz, replace the play-button block (lines 216–245) with an offline notice plus a "Switch to Hanzi → English" button wired to the existing `onChangeQuizMode("hanzi-english")`. Replace the duplicated microcopy with `listeningHint(...)`.
7. **Update `src/components/topic/words-panel.tsx` + `listen-all-bar.tsx`**: pass `audioAvailability` through; when `offline-voices`, keep the bar visible but render the Play pill disabled with the offline message in the status slot (when `unavailable`, keep hiding the bar as today). Use `listeningHint(...)` for the footer line.
8. **Update `src/components/tone-listen-trainer.tsx`**: it already has `status` from `useSpeech()`; also read `availability`. When `offline-voices` mid-run, replace the play/replay zone with the offline notice and surface the existing `onPracticeReading` steer ("Practice reading tones"). Swap its microcopy (lines 231–235) to `listeningHint(...)`.
9. **Update `src/components/duel-app.tsx`**: change line 55 to `const speechAvailable = availability === "ready"` (from the hook's new field). The existing `effectiveMode` fallback (line 88) then handles offline automatically; richer duel messaging is deferred.
10. Run the full gate: `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build`.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/speech.ts` | new type + 3 pure helpers |
| `tests/speech.test.mjs` | new test blocks |
| `src/components/use-speech.ts` | track network-only voices, compose `useOnlineStatus`, expose `availability` |
| `src/components/speak-button.tsx` | offline-disabled state + title |
| `src/components/topic-app.tsx` | availability plumbing, disabled Listen chip + note |
| `src/components/topic/quiz-panel.tsx` | disabled chip, mid-run offline banner + mode switch |
| `src/components/topic/words-panel.tsx` | prop plumbing |
| `src/components/topic/listen-all-bar.tsx` | disabled Play-all state + message |
| `src/components/tone-listen-trainer.tsx` | mid-run offline banner + steer, shared hint |
| `src/components/duel-app.tsx` | one-line gate swap |

### Proposed names and TypeScript signatures

```ts
// src/lib/speech.ts
export type AudioAvailability = "ready" | "offline-voices" | "unavailable";

/** True iff Chinese voices exist and every one is explicitly network-backed
 *  (localService === false). Undefined localService = unknown → false. */
export function hasOnlyNetworkChineseVoices(voices: readonly SpeechVoiceLike[]): boolean;

export function classifyAudioAvailability(
  support: SpeechSupport,
  onlyNetworkChineseVoices: boolean,
  online: boolean,
): AudioAvailability;

/** Shared listening-mode microcopy for the current state. */
export function listeningHint(support: SpeechSupport, availability: AudioAvailability): string;

// src/components/use-speech.ts
export interface UseSpeechResult {
  status: SpeechSupport;
  availability: AudioAvailability;   // NEW
  speaking: boolean;
  failed: boolean;
  speak: (text: string, opts?: { lang?: string; rate?: number }) => void;
  stop: () => void;
}

// prop added to WordsPanel / QuizPanel / ListenAllBar
audioAvailability?: AudioAvailability; // default "unavailable" keeps other callers' behavior
```

### UI copy / microcopy

- **`listeningHint` — offline-voices:** "You're offline and this device's Chinese voices need the internet. Visual practice modes all work offline."
- **`listeningHint` — no-chinese-voice:** (unchanged) "Your device has no Chinese voice installed, so listening mode may be silent."
- **`listeningHint` — default:** (unchanged) "No sound? Your device may lack a Chinese voice."
- **Disabled Listen chip note (tone practice + quiz):** "Listening is paused while you're offline — this device's voices are online-only."
- **Mid-run banner (quiz listening / tone trainer):** "🔇 You're offline, and this device's Chinese voice needs the internet. Keep practicing with a visual mode — everything else works offline." Buttons: "Switch to Hanzi → English" (quiz) / "Practice reading tones" (tone trainer).
- **Play-all bar, disabled state status line:** "Offline — listening needs a connection on this device. The words, pinyin, and meanings below all work offline."
- **SpeakButton title (offline-voices):** "Audio needs a connection — this device's Chinese voice is online-only"

### Test plan

All in `tests/speech.test.mjs`, `node --test`, fixture style matching the existing `v(lang, extra)` helper:

- `hasOnlyNetworkChineseVoices`: empty list → false; no Chinese voices (local `en-US`) → false; mixed local+network zh → false; all zh `localService: false` (plus a *local* `en-US`, which must not rescue it) → true; zh with `localService` undefined → false (optimistic).
- `classifyAudioAvailability`: `unsupported`/`no-chinese-voice` → `"unavailable"` regardless of online; `ready` + online → `"ready"`; `ready` + offline + networkOnly → `"offline-voices"`; `ready` + offline + local voice present → `"ready"`; `loading` + offline + empty-list (networkOnly false) → `"ready"` (Android-Chrome empty-list lie stays optimistic).
- `listeningHint`: returns the offline string for `"offline-voices"`, the no-voice string for `no-chinese-voice`, the generic string otherwise.

Hook/JSX behavior is covered by manual QA (repo has no component test harness — all existing tests are pure-logic, and this sprint keeps that split).

### Manual QA checklist

Desktop Chrome (has only network zh voices unless an OS voice is installed) — `npm run dev`:

1. Online, open a topic: Words "Play all", quiz "Listen 🔊", tone "Listen 🔊" all work as before.
2. DevTools → Network → Offline (this flips `navigator.onLine`): Play-all pill disables with the offline message; quiz + tone Listen chips render disabled with the note; every speaker icon dims with the offline title.
3. Start a listening quiz online, then go offline mid-run: the play screen swaps to the banner; "Switch to Hanzi → English" continues the quiz.
4. Same for the tone trainer: banner + "Practice reading tones" works.
5. Toggle back online: everything re-enables live (no reload) via the `online` event.
6. macOS Safari or a device with a local zh voice (e.g. Tingting): go offline — listening stays fully enabled.
7. Firefox (OS voices, `localService` semantics differ): offline must NOT disable listening unless voices are explicitly network-only.
8. Duel setup while offline: listening mode option absent; a duel started in listening mode falls back to Hanzi → English.
9. No hydration warnings in console on first load (SSR renders the optimistic "ready" state).

### Acceptance criteria

- Offline with only network-backed Chinese voices: no listening control anywhere silently no-ops — each is disabled with visible explanation, and in-progress listening drills offer a one-tap visual-mode escape.
- Offline with a local Chinese voice, or `localService` unknown: behavior identical to today (nothing disabled).
- Reconnecting re-enables listening without a page reload.
- All copy on Chinese lines keeps pinyin conventions (no new hanzi-only strings introduced).
- No new storage keys, no schema changes, no network calls. Full validation gate passes.

### Risk and rollback notes

- **False positives are the main risk** (disabling audio that would work). Mitigated by the explicit-`false`-only rule for `localService` and by never disabling in the `loading`/empty-list states. Firefox/Android quirks land on the optimistic side by construction.
- `navigator.onLine` can report `true` on a captive-portal network — the utterance then fails and `useSpeech`'s existing `failed` flag ("Couldn't play audio — tap to try again") still catches it, unchanged.
- Rollback is a single revert: all lib changes are additive exports; `audioAvailability` props are optional with a safe default; no persisted data touched.

### Non-goals / deferrals

- No pre-caching or bundling of audio (no recorded MP3s, no offline TTS engine).
- No richer duel offline messaging (gate swap only).
- No changes to `use-listen-all.ts` sequencing or the service worker (`public/sw.js`).
- No global "you're offline" app banner — scoped strictly to audio surfaces.
- No re-litigating the hide-vs-disable choice for *permanently* voiceless devices.

### Ready-to-run Opus implementation prompt for Sprint 27

```
You are implementing Sprint 27 of "Learn 10 Mandarin Words" (Next.js 16 / React 19 / Tailwind 4,
static, local-first, no backend). Read AGENTS.md first — this Next.js version has breaking
changes; consult node_modules/next/dist/docs/ if framework details matter.

GOAL: Offline-aware audio. When the browser is offline AND every Chinese TTS voice on the device
is network-backed (localService === false explicitly), listening controls must be visibly
disabled with honest messaging and learners steered to visual modes — instead of silent broken
play buttons. Devices with a local Chinese voice (or unknown localService) keep listening
enabled offline. Never disable on uncertainty.

READ THESE FILES FIRST:
- src/lib/speech.ts (pure voice logic; SpeechVoiceLike already has localService)
- src/components/use-speech.ts (single hardened speech hook; refresh() reads getVoices())
- src/components/use-online-status.ts (existing hydration-safe useOnlineStatus hook — use it, don't rewrite it)
- src/components/speak-button.tsx, src/components/topic-app.tsx (lines ~74–80, 487–522),
  src/components/topic/quiz-panel.tsx, src/components/topic/words-panel.tsx,
  src/components/topic/listen-all-bar.tsx, src/components/tone-listen-trainer.tsx,
  src/components/duel-app.tsx (lines ~54–55, 88, 278)
- tests/speech.test.mjs (fixture style to extend)

IMPLEMENT:
1. src/lib/speech.ts — add:
   export type AudioAvailability = "ready" | "offline-voices" | "unavailable";
   hasOnlyNetworkChineseVoices(voices): true iff ≥1 Chinese voice exists and ALL Chinese voices
     have localService === false explicitly (undefined → false/optimistic; non-Chinese voices ignored).
   classifyAudioAvailability(support, onlyNetworkChineseVoices, online):
     unsupported|no-chinese-voice → "unavailable"; else offline && onlyNetwork → "offline-voices";
     else "ready" (loading stays optimistic, matching canAttemptSpeech).
   listeningHint(support, availability): centralize the microcopy currently duplicated in
     quiz-panel.tsx:240-244, tone-listen-trainer.tsx:231-235, listen-all-bar.tsx:63.
     offline-voices → "You're offline and this device's Chinese voices need the internet. Visual
     practice modes all work offline."; no-chinese-voice → existing "Your device has no Chinese
     voice installed, so listening mode may be silent."; else existing "No sound? Your device may
     lack a Chinese voice."
2. tests/speech.test.mjs — cover both classifiers and the hint (empty list, no-zh, mixed
   local+network zh, all-network zh with a LOCAL en-US present, undefined localService,
   the full support×online matrix, loading+offline+empty-list → "ready").
3. use-speech.ts — in refresh(), also set a networkOnlyVoices state from
   hasOnlyNetworkChineseVoices(synth.getVoices()); call useOnlineStatus() in the hook; add
   `availability: AudioAvailability` to UseSpeechResult via classifyAudioAvailability.
   Do NOT change speak/stop internals. Keep hydration-safe (initial loading+online=true → "ready").
4. speak-button.tsx — disable when availability !== "ready"; offline title:
   "Audio needs a connection — this device's Chinese voice is online-only".
5. topic-app.tsx — use availability; speechAvailable = availability === "ready". Tone-practice
   chips: when "offline-voices" show the Listen 🔊 chip DISABLED (disabled + aria-disabled,
   muted styling) with note "Listening is paused while you're offline — this device's voices are
   online-only."; keep HIDING it for "unavailable" (existing deliberate behavior). Pass
   audioAvailability to WordsPanel and QuizPanel.
6. quiz-panel.tsx — listening chip: ready → shown, offline-voices → disabled + note,
   unavailable → hidden. If quizMode === "listening" and availability flips to offline-voices,
   replace the play-button block with: "🔇 You're offline, and this device's Chinese voice needs
   the internet. Keep practicing with a visual mode — everything else works offline." plus a
   "Switch to Hanzi → English" button calling onChangeQuizMode("hanzi-english"). Use listeningHint.
7. words-panel.tsx + listen-all-bar.tsx — thread audioAvailability (optional prop, default
   "unavailable" so other callers keep today's hidden-bar behavior); offline-voices → bar visible,
   Play pill disabled, status line "Offline — listening needs a connection on this device. The
   words, pinyin, and meanings below all work offline."; unavailable → bar hidden as today.
8. tone-listen-trainer.tsx — when offline-voices mid-run, replace the play/replay zone with the
   same banner and surface the existing onPracticeReading steer ("Practice reading tones").
   Use listeningHint for the footer microcopy.
9. duel-app.tsx — speechAvailable = availability === "ready" (the existing effectiveMode
   fallback at line 88 then covers offline automatically). Nothing else in duel.

CONSTRAINTS: no new storage keys, no network calls, no service-worker changes, no new deps.
Match existing comment density/idiom. Keep pure logic in src/lib (node-testable), browser glue
in components — same split the repo uses everywhere.

VALIDATION GATE (all must pass):
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build
```

---

All findings are in — the plan below is grounded in the actual validator, lint module, and a dry run of the proposed rule against the shipped dataset (zero findings, so it ships green).

## Sprint 28 — Validator rule: pinyin syllable count must match hanzi character count, reported as warnings

### Goal and user value

Every pinyin syllable corresponds to exactly one hanzi character, so a count mismatch in `src/data/topics.json` (a dropped syllable, a duplicated one, pinyin pasted onto the wrong word) is almost certainly a transcription error a learner would memorize. This sprint adds an automatic check across all 1,020 entries: each item's pinyin syllable count is compared to its hanzi character count, and disagreements are reported as warnings by `npm run validate:data` and escalated to failures by `npm run validate:quality` — the same warn-locally / gate-in-CI split every other content rule uses.

### Current-state findings grounded in actual files/components/helpers

- **`scripts/validate-data.mjs`** is the validator entry point (`validate:data`, `validate:quality`, and `prebuild` all run it). It already does per-item pinyin checks — shape regex and tone-mark presence at `scripts/validate-data.mjs:154-161` — but never compares pinyin length to hanzi length. It prints two warning buckets: structural warnings and "content-quality warning(s)" sourced from `collectQualityWarnings(topics)` (`scripts/validate-data.mjs:207`, `220-224`). `--strict-quality` makes only the quality bucket blocking (`scripts/validate-data.mjs:242-248`).
- **`scripts/quality-lint.mjs`** is the established home for pure, unit-testable content detectors (articles, truncation, punctuation mismatch, duplicate labels), all rolled up by `collectQualityWarnings(topics)` (`scripts/quality-lint.mjs:192-242`). Its stated contract: "the shipped dataset must produce zero findings." A rule added here needs **zero changes to `validate-data.mjs`** — it flows into the existing report and strict gate automatically.
- **`src/lib/pinyin.ts` already knows how to count syllables.** `tonesOf()` (`src/lib/pinyin.ts:61-80`) counts maximal vowel clusters — one per syllable, whether the pinyin is space-separated (`duì bu qǐ`), hyphen/apostrophe-separated, or concatenated (`tùzi`, `jīnyú`) — and its header comment explicitly claims "one tone per syllable / per hanzi character." Syllable count is simply `tonesOf(pinyin).length`.
- **Repo precedent is to mirror, not import, across the `scripts/` ↔ `src/` boundary**: `validate-data.mjs:26` keeps its own `TONE_MARKS` regex with a comment noting it mirrors `pinyin.ts`, and `quality-lint.mjs` currently has zero imports. Meanwhile `tests/*.test.mjs` *do* import `.ts` directly (e.g. `tests/pinyin.test.mjs` imports `../src/lib/pinyin.ts`; Node here is v24.17.0 with native type stripping) — so a **test** can cheaply enforce parity between a mirrored counter and `tonesOf`.
- **Dry run against the real dataset: 0 mismatches** across all 102 topics / 1,020 items using vowel-cluster counting vs. Han-character counting. Also verified: every `hanzi` field is 100% CJK characters (no latin, digits, or punctuation), and there are **no erhua words** (nothing ends in 儿) — so the erhua allowance below is future-proofing, not a dataset requirement.
- Data shape (verified): items carry `hanzi`, `pinyin`, `english`, `sentences[{cn,en}]`. Sentences have no pinyin, and topics have `titleCn` but no topic-level pinyin — so items are the only place this rule applies.
- **`README.md:69-79`** ("Data validation") enumerates the rule list and should mention the new rule.

### Exact implementation steps in sequence

1. In `scripts/quality-lint.mjs`, add a new section `// ── Pinyin ↔ hanzi syllable alignment ──` with three pure exported functions:
   - `hanziCharCount(text)` — counts Han-script characters only, via `Array.from(text).filter((c) => /\p{Script=Han}/u.test(c)).length` (code-point iteration; ignores any punctuation or latin that might appear in future data).
   - `pinyinSyllableCount(pinyin)` — counts maximal vowel clusters using the same `VOWEL` character class as `src/lib/pinyin.ts:28` (tone-marked vowels, `ü`, `v`, `ê`). Include a comment stating it mirrors `tonesOf()` in `src/lib/pinyin.ts` and that a parity test enforces agreement (matches the mirroring precedent in `validate-data.mjs:26`).
   - `syllableCountMismatch(hanzi, pinyin)` — returns a message string on mismatch, else `null`. Rules: skip (return `null`) when either input is empty/non-string or `hanziCharCount` is 0 (structural checks in `validate-data.mjs` already flag empty fields — don't double-report). **Erhua allowance:** when the hanzi ends in `儿` and the tone-stripped pinyin ends in `r` but not a full `er` syllable (e.g. `yìdiǎnr` for 一点儿), accept `syllables === hanziChars - 1`.
2. Wire it into `collectQualityWarnings` (`scripts/quality-lint.mjs:221` area), inside the existing `(topic?.items ?? []).forEach((item, i) => { ... })` loop:
   ```js
   const mismatch = syllableCountMismatch(item?.hanzi, item?.pinyin);
   if (mismatch) at(`item[${i}]`, mismatch);
   ```
   No changes to `validate-data.mjs` are needed — reporting, `--strict-quality`, and exit codes come for free.
3. Add tests to `tests/quality-lint.test.mjs` (see Test plan), including the dataset-parity test against `tonesOf` from `../src/lib/pinyin.ts`.
4. Update the rule list in `README.md` (~line 76) with one clause: "pinyin syllable count matches hanzi character count (warning; blocking under `validate:quality`)".
5. Run the full gate (`npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build`) and confirm zero new findings on the shipped dataset.

### Likely files touched

| File | Change |
|---|---|
| `scripts/quality-lint.mjs` | Add 3 pure functions + one wiring block in `collectQualityWarnings` |
| `tests/quality-lint.test.mjs` | New unit tests + dataset parity test |
| `README.md` | One clause in the "Data validation" rule list |

`scripts/validate-data.mjs` is intentionally **not** touched.

### Proposed function/component names and TypeScript signatures

Plain `.mjs` with JSDoc (matching the module's existing style); TS-equivalent signatures:

```ts
/** Number of Han-script characters in a string (code-point aware). */
export function hanziCharCount(text: string): number;

/** Number of pinyin syllables = maximal vowel clusters. Mirrors tonesOf() in src/lib/pinyin.ts. */
export function pinyinSyllableCount(pinyin: string): number;

/**
 * Message when pinyin syllable count disagrees with hanzi character count,
 * else null. Skips empty inputs; allows the erhua contraction (…儿 / …r).
 */
export function syllableCountMismatch(hanzi: string, pinyin: string): string | null;
```

### UI copy/microcopy to use

This is a CLI validator; the "UI" is the warning text. Match the existing lowercase, quoted-value style, emitted through `at()` so it renders as:

```
topic "animals" item[0]: pinyin "gǒu" splits into 1 syllable but hanzi "狗们" has 2 characters
```

Message template from `syllableCountMismatch`:
`pinyin "<pinyin>" splits into <n> syllable(s) but hanzi "<hanzi>" has <m> character(s)`
(use correct singular/plural, e.g. `1 syllable`, `2 characters`). No new copy in `validate-data.mjs` — findings appear under its existing `⚠ N content-quality warning(s):` header.

### Test plan

Extend `tests/quality-lint.test.mjs` (runner: `node --test`, `node:assert/strict`, dataset imported via `with { type: "json" }` — all already in place):

- `hanziCharCount`: `"狗"`→1, `"对不起"`→3, `"一点儿"`→3, ignores non-Han (`"T恤"`→1, `"你好！"`→2), empty →0.
- `pinyinSyllableCount`: `"gǒu"`→1; space-separated `"duì bu qǐ"`→3; concatenated `"tùzi"`→2, `"péngyou"`→2; apostrophe `"xī'ān"`→2; ü words `"nǚ'ér"`→2; erhua `"yìdiǎnr"`→2.
- `syllableCountMismatch`: match → `null` (`"狗"`/`"gǒu"`, `"朋友"`/`"péngyou"`); mismatch → message mentioning both counts (`"我们"`/`"wǒ"`); erhua exemption → `null` (`"一点儿"`/`"yìdiǎnr"`); genuine erhua mismatch still flagged (`"一点儿"`/`"yì"`); empty/missing inputs → `null`.
- **Parity test (drift guard):** for every item in `rawData.topics`, assert `pinyinSyllableCount(item.pinyin) === tonesOf(item.pinyin).length`, importing `tonesOf` from `../src/lib/pinyin.ts` (same pattern as `tests/pinyin.test.mjs`).
- **Roll-up:** a fabricated topic with one bad item produces exactly one warning through `collectQualityWarnings` with the `topic "slug" item[i]:` prefix; the existing zero-findings-on-shipped-dataset assertion now also covers this rule automatically.

### Manual QA checklist

1. `npm run validate:data` → output identical to before the sprint (same warning counts; "No blocking errors" / "All checks passed").
2. `npm run validate:quality` → exit 0.
3. Temporarily edit one item in `src/data/topics.json` (e.g. change `"gǒu"` to `"gǒu de"`): `validate:data` shows the new content-quality warning and still exits 0; `validate:quality` exits 1. Revert the edit.
4. Temporarily drop a syllable from a multi-character word (e.g. `"péngyou"` → `"péng"`) and confirm the same. Revert.
5. `npm run build` → prebuild validation runs clean and the build succeeds.
6. `git status` → `topics.json` unchanged (validator never mutates data).

### Acceptance criteria

- `syllableCountMismatch` is a pure exported function in `scripts/quality-lint.mjs`, wired into `collectQualityWarnings`, covering all 1,020 items.
- A mismatched item produces a **warning** (not error) in `npm run validate:data` (exit 0) and a failure in `npm run validate:quality` (exit 1).
- The shipped dataset produces **zero** new findings (verified by dry run) — all five gate commands pass unchanged.
- Erhua words (`…儿` with contracted `…r` pinyin) are not falsely flagged; empty fields are not double-reported.
- The mirrored syllable counter is provably in sync with `tonesOf` via the dataset parity test.
- README's validation rule list mentions the new rule.

### Risk and rollback notes

- **False positives on future data** (erhua, non-Han characters in `hanzi`): mitigated by the erhua allowance, Han-only character counting, and the conservative-detector convention of this module. Today's dataset triggers zero findings.
- **Counter drift vs. `src/lib/pinyin.ts`:** the two implementations could diverge if `tonesOf` changes; the whole-dataset parity test turns any divergence into a test failure rather than silent disagreement.
- **CI breakage risk is bounded:** the rule only hard-fails `validate:quality`; `validate:data` (and therefore `prebuild`/`next build`) treat it as a warning, so a surprise finding can never block a build.
- **Rollback:** revert the single commit; or hot-disable by deleting the 3-line wiring block in `collectQualityWarnings` (the pure functions are inert on their own).

### Non-goals / deferrals

- No auto-fixing or mutation of `topics.json` (the validator's contract is read-only).
- No per-sentence pinyin validation — sentences carry only `cn`/`en`, no pinyin field.
- No topic-title check — topics have `titleCn` but no pinyin field.
- No validation that each syllable is a *legal* Mandarin syllable (finals/initials table) — count alignment only; a legality table is a separate, much larger rule.
- No in-app UI surface; this is build-time content tooling only.
- No new npm scripts, dependencies, or changes to `validate-data.mjs`.

### Ready-to-run Opus implementation prompt for Sprint 28

```
Implement Sprint 28 of the "Learn 10 Mandarin Words" app (Next.js 16 / React 19 / Tailwind 4, static + localStorage; repo root is the CWD). Read AGENTS.md first and follow it.

TASK — Validator rule: pinyin syllable count must match hanzi character count, reported as warnings.

Touch ONLY these files: scripts/quality-lint.mjs, tests/quality-lint.test.mjs, README.md. Do NOT modify scripts/validate-data.mjs or src/data/topics.json.

1. In scripts/quality-lint.mjs, add a new section "── Pinyin ↔ hanzi syllable alignment ──" with three pure exported functions, documented in the module's existing JSDoc/comment style:
   - hanziCharCount(text): number of Han-script characters, via Array.from(text) filtered by /\p{Script=Han}/u. Non-strings/empty → 0.
   - pinyinSyllableCount(pinyin): number of maximal vowel clusters. Use the same vowel class as src/lib/pinyin.ts line 28 (/[aeiouüvêāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i): scan characters, increment on entering a vowel run, reset on non-vowel. Add a comment noting this mirrors tonesOf() in src/lib/pinyin.ts and that a parity test in tests/quality-lint.test.mjs enforces agreement (same mirroring precedent as TONE_MARKS in scripts/validate-data.mjs).
   - syllableCountMismatch(hanzi, pinyin): returns a message string or null. Return null when either input is empty/non-string or hanziCharCount is 0 (structural checks elsewhere already flag empties). Erhua allowance: if hanzi ends with "儿" and the pinyin's final syllable is a contracted r (word ends in "r" but that r is not its own vowel-bearing "er" syllable, e.g. "yìdiǎnr"), accept syllables === hanziChars - 1. Message format (with correct singular/plural): pinyin "<pinyin>" splits into <n> syllable(s) but hanzi "<hanzi>" has <m> character(s)
2. Wire into collectQualityWarnings inside the existing (topic?.items ?? []).forEach((item, i) => {...}) loop:
   const mismatch = syllableCountMismatch(item?.hanzi, item?.pinyin);
   if (mismatch) at(`item[${i}]`, mismatch);
   This makes findings flow automatically into validate-data.mjs's content-quality warning bucket and the --strict-quality gate — that file needs no changes.
3. In tests/quality-lint.test.mjs (node:test + node:assert/strict, matching existing style), add:
   - hanziCharCount: "狗"→1, "对不起"→3, "一点儿"→3, "T恤"→1, "你好！"→2, ""→0.
   - pinyinSyllableCount: "gǒu"→1, "duì bu qǐ"→3, "tùzi"→2, "péngyou"→2, "xī'ān"→2, "nǚ'ér"→2, "yìdiǎnr"→2.
   - syllableCountMismatch: null for ("狗","gǒu") and ("朋友","péngyou"); a message containing both counts for ("我们","wǒ"); null for erhua ("一点儿","yìdiǎnr"); a message for ("一点儿","yì"); null for empty/missing inputs.
   - Parity test: import { tonesOf } from "../src/lib/pinyin.ts" and assert, for every item of every topic in rawData (already imported at the top of the file), pinyinSyllableCount(item.pinyin) === tonesOf(item.pinyin).length.
   - Roll-up test: a fabricated topic array with one mismatched item yields exactly one warning via collectQualityWarnings, prefixed topic "<slug>" item[<i>]:.
   - The shipped dataset must yield zero findings from this rule (the existing zero-warnings dataset assertion should keep passing).
4. README.md: in the "Data validation" section (~line 76), add one clause to the rule list: pinyin syllable count matches hanzi character count (warning; blocking under validate:quality).

VALIDATION GATE — all must pass, with zero new findings on the shipped dataset:
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build

Also manually verify (then revert): temporarily change one pinyin in src/data/topics.json to have a wrong syllable count — validate:data warns but exits 0, validate:quality exits 1. Confirm git status shows topics.json clean before finishing.
```

Two design choices worth flagging: the rule lives in `scripts/quality-lint.mjs` rather than `validate-data.mjs`, because the roll-up wiring there gives reporting, `--strict-quality` gating, and the existing dataset-cleanliness test for free with zero validator changes; and the syllable counter mirrors `tonesOf()` (the repo's established scripts/src pattern) instead of importing the `.ts` file, with a whole-dataset parity test making drift impossible. I verified by dry run that the rule produces zero findings on the current 1,020 entries, so it ships green through all five gate commands.

---

I have everything I need — the plan below is grounded in the actual code and a scan of the shipped dataset.

---

## Sprint 29 — Quiz distractor QA: never offer a distractor whose English gloss matches the correct answer's gloss

### Goal and user value

A learner should never face a quiz card where two choices are both defensibly correct. Today the quiz builder dedupes distractors only by **exact string equality** on the answer field, so words whose English glosses match after normalization — or overlap on a slash-separated sense — can appear together. Concretely shipped today (same-topic, so learners actually hit these):

- `ten-types-of-breakfast-foods`: 包子 "steamed bun" vs 馒头 "steamed bun (plain)" — a hanzi→English card for 包子 can offer "steamed bun (plain)" as a tempting near-identical distractor, and an English→hanzi card prompting "steamed bun" can offer 馒头 as a choice that is arguably correct.
- `ten-ways-to-apologize`: 对不起 "sorry" vs 不好意思 "excuse me / sorry", and 不好意思 vs 打扰一下 "excuse me / sorry to bother you" — overlapping senses make multiple choices right.

This sprint makes the distractor pipeline gloss-collision-aware in one central place, fixing every quiz surface at once with zero data edits and zero UI changes.

### Current-state findings grounded in actual files/components/helpers

1. **All quiz-shaped features funnel through one builder.** `buildQuizCard`/`rankedDistractors` in `src/lib/quiz-logic.ts` are the only distractor factories, consumed by:
   - `src/components/topic-app.tsx:103` (topic quiz, via `buildQuiz`)
   - `src/lib/practice-logic.ts:70` (review/practice), `src/lib/lightning-logic.ts:154` (lightning round)
   - `src/lib/daily-logic.ts:156` (daily challenge), `src/lib/duel-logic.ts:67` (pass-and-play duel)
   - `src/lib/boss-logic.ts:41` (boss round quiz stage), and `src/lib/cloze-logic.ts:81` calls `rankedDistractors(item, pool, "english-hanzi", …)` directly for cloze hanzi choices.
   A fix inside `rankedDistractors` therefore covers every surface.
2. **The only dedupe today is exact-string.** `dedupeByField` (`src/lib/quiz-logic.ts:166-180`) seeds a `Set` with the answer's raw field value and drops exact repeats. It cannot catch "steamed bun" vs "steamed bun (plain)" or "sorry" vs "excuse me / sorry".
3. **Distractor pools are always same-topic.** `practice-logic.ts:54`, `lightning-logic.ts:107`, `daily-logic.ts:156` (`pair.topic.items`), `duel-logic.ts` ("Pool is the whole topic"), and `topic-app.tsx` all draw from the owning topic's items. So the 18 *cross-topic* exact-gloss twins in the data (e.g. "chicken" 鸡/鸡肉, "duck", "knife", "square" — confirmed by scanning `src/data/topics.json`, 102 topics / 1020 words) are currently unreachable, but the same-topic collisions above are live bugs. Fixing at the core also future-proofs any later cross-topic pool.
4. **Quality lint requires zero findings on shipped data.** `scripts/quality-lint.mjs` (header comment: "the shipped dataset must produce zero findings") already has `duplicateEnglishLabels` for exact same-topic dupes. A *strict* lint rule for near-collisions would fail `validate:quality` on the three legitimate near-synonym pairs above — so the runtime filter, not a data lint, is the correct fix. The regression net belongs in tests instead.
5. **Test infrastructure**: `node --test` runs `tests/*.test.mjs`, which already import TS directly (`tests/quiz-logic.test.mjs` imports `../src/lib/quiz-logic.ts`), and `quiz-logic.ts` imports `./pinyin.ts` with an explicit `.ts` extension for exactly this reason — follow that precedent.

### Exact implementation steps in sequence

1. **Create `src/lib/gloss.ts`** — pure gloss-normalization helpers (no DOM, no storage, mirroring the style of `pinyin.ts`):
   - `normalizeGloss`: lowercase → strip parenthetical qualifiers `(...)` → strip non-alphanumeric punctuation (keep spaces/hyphens) → collapse whitespace.
   - `glossSegments`: split the raw gloss on `/`, `;`, `,`, normalize each part, drop empties. `"excuse me / sorry"` → `["excuse me", "sorry"]`.
   - `glossesCollide(a, b)`: true when the segment sets intersect (whole-segment equality only — "hot" must NOT collide with "hot dog").
2. **Wire the filter into `rankedDistractors` in `src/lib/quiz-logic.ts`** (import from `./gloss.ts` with the explicit extension): before the existing shuffle+dedupe, filter the pool to candidates where `!glossesCollide(candidate.english, item.english)`. Apply in **all modes** — in `hanzi-english`/`listening` a colliding gloss is a second correct answer; in `english-hanzi` a colliding candidate's *hanzi* is a second correct answer to the English prompt; in `hanzi-pinyin` it costs at most a couple of candidates from a 10-word pool and keeps the rule uniform. Update the surrounding doc comments (`dedupeByField`'s comment currently claims it alone "stops two words with the same English label" — revise).
3. **Add `tests/gloss.test.mjs`** — unit tests for the three helpers (case, parentheticals, slash segments, punctuation, and non-collision cases).
4. **Extend `tests/quiz-logic.test.mjs`** — fixture-based tests using the existing `identity` shuffle pattern, with a fixture modeled on the real apologize/breakfast collisions; assert colliding candidates never appear as choices in any of the four modes, and that non-colliding pools still yield full 4-choice cards.
5. **Add `tests/quiz-gloss-fairness.test.mjs`** — a data-driven regression net: load `src/data/topics.json`, and for every topic × every mode, build cards with a deterministic shuffle and assert no non-answer choice maps back to a pool item whose gloss collides with the quizzed item's gloss. This is what keeps the guarantee true as content grows, without touching `validate:quality`.
6. Run the full gate (`npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build`).

### Likely files touched

- `src/lib/gloss.ts` — **new**, ~50 lines of pure helpers
- `src/lib/quiz-logic.ts` — one filter line in `rankedDistractors` + comment updates
- `tests/gloss.test.mjs` — **new**
- `tests/quiz-logic.test.mjs` — extended
- `tests/quiz-gloss-fairness.test.mjs` — **new**, data-driven

Nothing else: no components, no data, no scripts, no Next.js routing/APIs (so the AGENTS.md "read the Next.js 16 docs first" concern is moot for this sprint — it's pure TypeScript library code).

### Proposed function/component names and TypeScript signatures

```ts
// src/lib/gloss.ts
/** Lowercased gloss with parentheticals, punctuation, and extra whitespace removed. */
export function normalizeGloss(gloss: string): string;

/** Normalized sense segments of a gloss, split on "/", ";", ",". */
export function glossSegments(gloss: string): string[];

/** True when two glosses share any normalized sense segment (or normalize equal). */
export function glossesCollide(a: string, b: string): boolean;
```

```ts
// src/lib/quiz-logic.ts — inside rankedDistractors, before shuffle/dedupe
const fairPool = pool.filter((c) => !glossesCollide(c.english, item.english));
const candidates = shuffle(dedupeByField(fairPool, field, answer));
```

No signature changes to `rankedDistractors`, `buildQuizCard`, or `buildQuiz` — every existing caller compiles as-is (`QuizWord` already includes `english` in all modes).

### UI copy/microcopy to use

None. This sprint is intentionally invisible: no new UI, no settings, no messaging. The only user-observable change is that near-synonym choices stop appearing together.

### Test plan

- **`tests/gloss.test.mjs`**: `normalizeGloss("Steamed Bun (plain)") === "steamed bun"`; `glossSegments("excuse me / sorry")` → both segments; collisions: "steamed bun" ↔ "steamed bun (plain)", "sorry" ↔ "excuse me / sorry"; non-collisions: "hot" vs "hot dog", "sorry" vs "excuse me / sorry to bother you", "dog" vs "cat"; empty/whitespace inputs never collide with everything.
- **`tests/quiz-logic.test.mjs`**: with a fixture containing 包子/馒头-style pairs and identity shuffle, assert for all four modes that no choice belongs to a colliding pool item; assert a clean 5-word pool still yields 4 unique choices (no regression to existing tests, which must all keep passing unchanged).
- **`tests/quiz-gloss-fairness.test.mjs`**: sweep the real dataset — every topic, every mode, deterministic shuffle — zero cards where a distractor's owning item collides with the answer's gloss. Also assert every card in every 10-word topic still gets the full 4 choices (proves the filter never starves a real pool).

### Manual QA checklist

- [ ] `/topic/ten-ways-to-apologize` quiz (all four mode toggles): the 对不起 and 不好意思 cards never show each other's answer as a choice; every card still shows 4 choices.
- [ ] `/topic/ten-types-of-breakfast-foods`: 包子 and 馒头 cards never co-offer "steamed bun" and "steamed bun (plain)" (hanzi→English) nor each other's hanzi (English→hanzi).
- [ ] Cloze tab on the apologize topic: the blank for 包子-style colliding pairs doesn't offer the twin hanzi.
- [ ] Boss round and duel on the apologize topic behave the same way.
- [ ] Spot-check an unaffected topic (e.g. pets): quiz looks identical to before, pinyin still shown on Chinese prompts, retry-missed flow still works.
- [ ] Quiz choices remain visually clean (no layout change expected).

### Acceptance criteria

1. For every quiz surface (topic quiz, practice, lightning, daily, duel, boss, cloze), no card ever offers a distractor whose English gloss collides — by normalization or shared sense segment — with the correct answer's gloss.
2. All 10-word topics still produce 4-choice cards in every mode (verified by the dataset sweep test).
3. No data files, UI components, or validation scripts change; `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, and `npm run build` all pass.
4. Existing tests in `tests/quiz-logic.test.mjs` pass without modification to their assertions.

### Risk and rollback notes

- **Over-filtering risk**: aggressive normalization could merge genuinely distinct glosses and shrink tiny pools (e.g. a hypothetical 2-word duel topic → 0 distractors). Mitigated by whole-segment matching only, and by the dataset sweep asserting full choice counts; all shipped topics have 10 items, so losing ≤2 candidates is harmless.
- **Behavioral drift**: distractor *ranking* is untouched; only candidacy changes, so cards on unaffected topics are byte-identical under a fixed shuffle.
- **Rollback**: revert the single filter line in `rankedDistractors` (and optionally delete `gloss.ts` + new tests). No data or storage migrations; localStorage progress is untouched.

### Non-goals / deferrals

- No data/gloss rewording (near-synonyms are legitimate content; the quiz must handle them).
- No new `quality-lint.mjs` rule — a strict rule would fail `validate:quality` on shipped near-synonym pairs by design of that script's zero-findings contract. Could be added later as a non-strict warning.
- No *mutual* gloss-distinctness between distractors themselves (two wrong choices sharing a sense is confusing but not unfair) — natural follow-up.
- No "to "-prefix verb normalization ("to buy" vs "buy") — no such collision exists in the data today.
- No changes to the match game (`match-logic.ts`) — exact same-topic duplicates are already lint-enforced to zero, and near-dupes are visually distinguishable when matching.

### Ready-to-run Opus implementation prompt for Sprint 29

```
Implement Sprint 29 of the Learn 10 Mandarin Words app (Next.js 16 / React 19 / Tailwind 4,
static, local-first): quiz distractor QA — never offer a distractor whose English gloss
matches the correct answer's gloss.

Context (verified):
- All quiz surfaces funnel through buildQuizCard/rankedDistractors in src/lib/quiz-logic.ts
  (consumers: topic-app.tsx, practice-logic.ts, lightning-logic.ts, daily-logic.ts,
  duel-logic.ts, boss-logic.ts, and cloze-logic.ts which calls rankedDistractors directly).
- dedupeByField in quiz-logic.ts only dedupes exact strings. Live collisions in
  src/data/topics.json: ten-types-of-breakfast-foods 包子 "steamed bun" vs 馒头
  "steamed bun (plain)"; ten-ways-to-apologize 对不起 "sorry" vs 不好意思
  "excuse me / sorry" vs 打扰一下 "excuse me / sorry to bother you".
- Tests are tests/*.test.mjs run by `node --test` and import TS sources directly with
  explicit .ts extensions (see tests/quiz-logic.test.mjs and quiz-logic.ts's
  `import ... from "./pinyin.ts"` precedent).

Tasks:
1. Create src/lib/gloss.ts with pure helpers:
   - normalizeGloss(gloss: string): string — lowercase, strip parentheticals "(...)",
     strip punctuation (keep spaces/hyphens), collapse whitespace.
   - glossSegments(gloss: string): string[] — split raw gloss on "/", ";", ",",
     normalize each segment, drop empties.
   - glossesCollide(a: string, b: string): boolean — true iff segment sets intersect
     (whole-segment equality; "hot" must NOT collide with "hot dog"). Empty glosses
     never collide.
2. In src/lib/quiz-logic.ts, import { glossesCollide } from "./gloss.ts" (explicit .ts
   extension) and, inside rankedDistractors, filter the pool to candidates where
   !glossesCollide(candidate.english, item.english) BEFORE the existing shuffle +
   dedupeByField. Apply in all four modes. Do not change any exported signatures.
   Update the now-stale comment on dedupeByField.
3. Add tests/gloss.test.mjs covering normalization, segmentation, collisions
   (including the real dataset pairs above), and non-collisions ("hot" vs "hot dog",
   "sorry" vs "excuse me / sorry to bother you").
4. Extend tests/quiz-logic.test.mjs: with a fixture containing gloss-colliding items
   and the existing identity-shuffle pattern, assert colliding items never appear as
   choices in any mode, and that clean pools still yield 4 unique choices. Do not
   weaken existing assertions.
5. Add tests/quiz-gloss-fairness.test.mjs: load src/data/topics.json; for every topic
   and every mode ("hanzi-english", "english-hanzi", "hanzi-pinyin", "listening"),
   build cards with a deterministic shuffle and assert (a) no non-answer choice maps
   back to a pool item whose gloss collides with the quizzed item's gloss, and
   (b) every card in a 10-item topic has 4 choices.

Constraints: no data edits, no UI/component changes, no new lint rules in
scripts/quality-lint.mjs (a strict rule would fail validate:quality on legitimate
near-synonyms), no new dependencies, no backend/localStorage changes. Pure TS library
code only. This repo's Next.js 16 has breaking changes per AGENTS.md — you are not
touching framework APIs, so no framework code changes are expected; read
node_modules/next/dist/docs/ only if something framework-adjacent surprises you.

Validation gate (all must pass):
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build
```

---

I have everything I need. Key discoveries: the quality-lint infrastructure already exists (`scripts/quality-lint.mjs` with an exact-match `duplicateEnglishLabels` check), so this sprint is a targeted *extension* — near-duplicate gloss normalization plus mixed-script punctuation checks — and I've verified against the shipped dataset which normalizations are safe (parentheticals must be preserved: "steamed bun" vs "steamed bun (plain)" is intentional).

## Sprint 30 — Quality-lint extensions: flag duplicate English glosses within a topic and inconsistent sentence punctuation

### Goal and user value

Extend the existing content-quality lint (`npm run validate:quality`) with two new families of checks so the dataset stays consistent as content is edited over time:

1. **Near-duplicate English glosses within a topic** — the current lint only catches *exact* (case-insensitive) duplicate labels. It misses pairs like `"run"` / `"to run"` or `"dog"` / `"the dog"`, which read as duplicates to a learner flipping flashcards. A normalized comparison catches these.
2. **Inconsistent sentence punctuation (script drift)** — the current lint checks CN/EN question/exclamation *agreement* and CN terminal *presence*, but silently accepts half-width Latin punctuation in Chinese sentences (`quality-lint.mjs:164` explicitly allows `.!?` as a CN terminal) and never checks for CJK punctuation leaking into English sentences. Both are classic copy-paste/generation artifacts.

Learners never see the linter, but they see its absence: duplicate quiz answers (two identical English options for different hanzi) and typographically mixed sentences. This sprint keeps the 1,020-word / 2,040-sentence dataset clean by construction.

### Current-state findings grounded in actual files/components/helpers

- **`scripts/quality-lint.mjs`** — the home for all detectors, all pure functions with a stated invariant (lines 8–10): *the shipped dataset must produce zero findings*. Existing exports: `expectedArticle`, `suspiciousArticles`, `hasTerminalPunctuation`, `looksTruncated`, `punctuationMismatch`, `duplicateEnglishLabels`, `collectQualityWarnings`.
- **`duplicateEnglishLabels(items)`** (`quality-lint.mjs:174-183`) — exact match after `trim().toLowerCase()` only. Verified: **0 exact duplicates** in shipped data.
- **`punctuationMismatch(cn, en)`** (`quality-lint.mjs:142-169`) — line 164's terminal check has the fallback `!/[.!?]$/.test(c)`, i.e. a CN sentence ending in a Latin period currently passes. It also checks nothing about punctuation *inside* sentences.
- **`collectQualityWarnings(topics)`** (`quality-lint.mjs:192-242`) — the roll-up that formats findings as `topic "<slug>" <where>: <message>`. New checks wire in here.
- **`scripts/validate-data.mjs:207,220-224,240-248`** — already calls `collectQualityWarnings` and handles `--strict-quality` / `--strict` escalation. **No changes needed** — new findings flow through automatically.
- **`tests/quality-lint.test.mjs`** — unit tests per detector, plus the critical regression gate at line 100: `collectQualityWarnings` must be `[]` on the shipped `src/data/topics.json`.
- **`package.json`** — `"validate:quality": "node scripts/validate-data.mjs --strict-quality"`, `"test": "node --test"`. No new scripts needed.
- **README.md:60-79** — documents `validate:data` but the scripts table (line 66) **does not mention `validate:quality` at all**; the "Data validation" section doesn't describe the quality lint. Worth a small doc touch-up in-scope.

**Dataset census I ran (grounds every threshold below):**

| Probe | Result |
|---|---|
| Exact duplicate glosses per topic | 0 |
| Near-duplicates after stripping leading `to/a/an/the`, trailing punctuation, collapsing whitespace (parentheticals **kept**) | **0** — safe to ship strict |
| Near-duplicates if parentheticals are *also* stripped | **1 false positive**: `"steamed bun"` vs `"steamed bun (plain)"` in topic `ten-types-of-breakfast-foods` — parentheticals are deliberate disambiguators and must be preserved |
| Glosses starting with `to/a/an/the` | 5 (so the normalization is not a no-op) |
| Half-width `, ; : ? ! .` anywhere in CN sentences | 0 (all 2,040 CN sentences use full-width/CJK punctuation, all end in `。！？…`) |
| CJK punctuation (`。，！？、；：“”‘’（）《》`) in EN sentences | 0 |

So both new checks can be strict and still satisfy the zero-findings invariant.

### Exact implementation steps in sequence

1. **Add `normalizeGloss(text)`** to `scripts/quality-lint.mjs` (exported, so it's unit-testable): lowercase → strip a single leading `to `, `a `, `an `, or `the ` → strip trailing `. , ! ? ; :` → collapse internal whitespace → trim. Explicitly do **not** touch parenthetical qualifiers, with a comment citing the `"steamed bun (plain)"` case.
2. **Add `nearDuplicateGlosses(items)`**: group items by `normalizeGloss(item.english)`; report groups with 2+ members **whose raw labels are not already exact duplicates** (exact dupes stay the job of `duplicateEnglishLabels` — no double-reporting). Return `[{ normalized, labels, indices }]`.
3. **Add `halfWidthPunctuationInCn(text)`**: return a message if a CN sentence contains any of `, ; : ? ! .`, **except** when the character sits between digits (`8:30`, `3.5` — future-proofing against legitimate numeric usage; zero occurrences today). Message names the offending character.
4. **Add `cjkPunctuationInEn(text)`**: return a message if an EN sentence contains any CJK punctuation from the set `。，！？、；：“”‘’（）《》【】…`. Note: `…` appears in `looksTruncated`'s ellipsis check for EN already — exclude `…` here to avoid double-reporting the same character (the truncation check owns it).
5. **Wire all three into `collectQualityWarnings`** in the per-topic loop: near-duplicate groups at topic level (same pattern as `duplicateEnglishLabels`, lines 214–219); the two punctuation checks inside the per-sentence loop (lines 225–237), locus `item[i].sentences[k].cn` / `.en`.
6. **Extend `tests/quality-lint.test.mjs`**: unit tests for each new export (positive + negative cases, including the parenthetical non-flag and the `8:30` exemption); extend the "bad data" roll-up test with a near-dup gloss and a mixed-punctuation sentence; the existing "clean on shipped dataset" test at line 100 is the regression gate and must stay green unchanged.
7. **Update `README.md`**: add a `npm run validate:quality` row to the scripts table (~line 66) and a short paragraph in "Data validation" (~line 79) listing the quality-lint rule families including the two new ones.
8. **Run the full gate** (`npm run test`, `validate:data`, `validate:quality`, `lint`, `build`) and confirm zero findings on shipped data.

### Likely files touched

- `scripts/quality-lint.mjs` — three new exported detectors + roll-up wiring (only substantive code change)
- `tests/quality-lint.test.mjs` — new unit tests, extended roll-up test
- `README.md` — scripts table row + Data validation paragraph

Explicitly untouched: `scripts/validate-data.mjs`, `package.json`, `src/**` (no UI, no data edits).

### Proposed function/component names and signatures

Scripts are plain `.mjs` (no TS), matching the existing file's JSDoc-comment style:

```js
// Canonical comparison form of an English gloss: lowercased, leading
// "to/a/an/the" and trailing punctuation stripped, whitespace collapsed.
// Parenthetical qualifiers are KEPT — "(plain)" etc. are deliberate
// disambiguators (see "steamed bun (plain)" in ten-types-of-breakfast-foods).
export function normalizeGloss(text) /* : string */

// Groups of glosses that collide after normalization but are NOT exact
// (case-insensitive) duplicates — those are duplicateEnglishLabels' job.
// Returns [{ normalized, labels, indices }].
export function nearDuplicateGlosses(items) /* : Array<{normalized, labels, indices}> */

// Message if a CN sentence uses half-width punctuation (, ; : ? ! .),
// ignoring digit-adjacent uses like "8:30". Else null.
export function halfWidthPunctuationInCn(text) /* : string | null */

// Message if an EN sentence contains CJK punctuation (。，！？、 etc.,
// excluding "…" which looksTruncated already owns). Else null.
export function cjkPunctuationInEn(text) /* : string | null */
```

### UI copy / microcopy

No UI in this sprint — the "copy" is the lint messages, matching the existing voice (lowercase, specific, actionable):

- `near-duplicate English glosses "run" / "to run" (both normalize to "run")`
- `CN sentence uses half-width punctuation "," (expected full-width "，")`
- `EN sentence contains CJK punctuation "。"`

All surfaced through the existing `topic "<slug>" <where>: <message>` frame from `collectQualityWarnings`.

### Test plan

Unit tests in `tests/quality-lint.test.mjs` (runner: `node --test`):

- `normalizeGloss`: `"To Run"` → `"run"`; `"the dog"` → `"dog"`; `"steamed bun (plain)"` keeps its parenthetical; trailing-punctuation strip; idempotence on already-normal input.
- `nearDuplicateGlosses`: flags `[{english:"run"},{english:"to run"}]`; does **not** flag `["steamed bun","steamed bun (plain)"]`; does **not** re-report exact dupes `["dog","Dog"]`; empty on unique lists.
- `halfWidthPunctuationInCn`: flags `"你好,再见。"` and `"这是一只狗."`; null for `"你好，再见。"`; null for digit-adjacent `"现在是8:30。"`.
- `cjkPunctuationInEn`: flags `"Hello。"` and `"Yes，please."`; null for clean EN; null for EN with `…` only (owned by `looksTruncated`).
- Roll-up: extend the existing bad-data fixture (test at line 104) so warnings include `/near-duplicate/`, `/half-width/`, `/CJK punctuation/`, each prefixed `topic "bad-topic"`.
- Regression gate: existing test `collectQualityWarnings is clean on the shipped dataset` (line 100) must pass unmodified.

### Manual QA checklist

1. `npm run validate:data` → exits 0, `✓ All checks passed.`, zero content-quality warnings.
2. `npm run validate:quality` → exits 0.
3. Temporarily edit one gloss in `src/data/topics.json` (e.g. change an item to `"to dog"` in `ten-types-of-pets`) → `validate:data` prints a located near-duplicate warning but exits 0; `validate:quality` exits 1. Revert.
4. Temporarily replace a `，` with `,` in one CN sentence → warning names the topic, item/sentence locus, and the offending character; `validate:quality` exits 1. Revert.
5. `git diff src/data/topics.json` is empty at the end (lint never mutates data).
6. `npm run build` succeeds (prebuild runs `validate-data.mjs` in non-strict mode — new warnings must not break builds even if content drifts later; only `validate:quality` blocks).

### Acceptance criteria

- `nearDuplicateGlosses`, `halfWidthPunctuationInCn`, `cjkPunctuationInEn`, `normalizeGloss` exported from `scripts/quality-lint.mjs` as pure functions and wired into `collectQualityWarnings`.
- Shipped dataset yields **zero** findings (invariant at `quality-lint.mjs:8-10` preserved); `"steamed bun (plain)"` is not flagged.
- Injected defects (near-dup gloss, half-width CN comma, CJK EN period) each produce one located, actionable warning and fail `--strict-quality` only.
- `validate-data.mjs` and `package.json` unchanged; README documents `validate:quality`.
- Full gate green: `npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build`.

### Risk and rollback notes

- **False positives are the main risk** (a finding blocks `validate:quality`). Mitigated by the dataset census above: every rule was verified to produce zero findings on shipped data, and the two known traps (parentheticals, digit-adjacent `:`/`.`) are explicitly exempted.
- **Double-reporting**: exact dupes excluded from `nearDuplicateGlosses`; `…` excluded from `cjkPunctuationInEn`. Latin-terminal CN sentences will get one message from the new half-width check while `punctuationMismatch:164` still passes them — intentional, single clear message, no change to existing behavior.
- **Rollback** is trivial and safe: the sprint touches only the lint script, its tests, and README — no data, no UI, no build config. Reverting the commit restores the previous lint exactly; `prebuild` uses non-strict mode so even a bad rule can't break `npm run build`.

### Non-goals / deferrals

- No auto-fixing of data (lint reports, never mutates — per `validate-data.mjs:6`).
- No cross-topic duplicate detection (glosses legitimately repeat across topics, e.g. common verbs).
- No semantic near-duplicate detection ("large"/"big") — normalization is orthographic only.
- No pinyin punctuation/diacritic linting (covered separately by `validate-data.mjs:154-161`).
- No CI workflow changes, no new npm scripts, no UI surface for lint results.

### Ready-to-run Opus implementation prompt for Sprint 30

```
Implement Sprint 30 of the Learn 10 Mandarin Words app (Next.js 16 / React 19 /
Tailwind 4, static + localStorage): extend the content-quality lint to flag
(a) near-duplicate English glosses within a topic and (b) mixed-script
punctuation in example sentences. Read AGENTS.md first. This sprint touches
ONLY scripts/quality-lint.mjs, tests/quality-lint.test.mjs, and README.md —
do NOT modify src/data/topics.json, scripts/validate-data.mjs, package.json,
or any src/ file.

Context — read these before coding:
- scripts/quality-lint.mjs: all detectors live here as pure exported
  functions. Invariant (top-of-file comment): the shipped dataset must
  produce ZERO findings. duplicateEnglishLabels (line ~174) already catches
  exact case-insensitive duplicate labels; collectQualityWarnings (~192) is
  the roll-up formatting findings as `topic "<slug>" <where>: <message>`.
- scripts/validate-data.mjs already consumes collectQualityWarnings and
  handles --strict-quality; new findings flow through with no changes there.
- tests/quality-lint.test.mjs: per-detector unit tests + a regression test
  asserting collectQualityWarnings(rawData.topics) is [] on shipped data.

Add to scripts/quality-lint.mjs (pure functions, exported, JSDoc-style
comments matching the file's voice):
1. normalizeGloss(text): lowercase; strip ONE leading "to ", "a ", "an ",
   or "the "; strip trailing [.,!?;:]; collapse whitespace; trim. KEEP
   parenthetical qualifiers — "steamed bun" vs "steamed bun (plain)" in
   topic ten-types-of-breakfast-foods is deliberate disambiguation and must
   NOT collide (add a comment saying exactly this).
2. nearDuplicateGlosses(items): group by normalizeGloss(item.english);
   return [{ normalized, labels, indices }] for groups of 2+ — but EXCLUDE
   groups whose raw labels are already exact case-insensitive duplicates
   (those remain duplicateEnglishLabels' job; no double-reporting).
3. halfWidthPunctuationInCn(text): message|null if a CN sentence contains
   any half-width , ; : ? ! . — EXCEPT between digits (e.g. "8:30", "3.5").
   Message format: `CN sentence uses half-width punctuation "," (expected
   full-width "，")` with the correct full-width counterpart per character
   (，；：？！。).
4. cjkPunctuationInEn(text): message|null if an EN sentence contains CJK
   punctuation from 。，！？、；：“”‘’（）《》【】 (exclude "…" — the existing
   looksTruncated ellipsis rule owns it).
Wire all three into collectQualityWarnings: near-duplicate groups at topic
level (mirror the duplicateEnglishLabels block, loci like items[i,j]);
punctuation checks inside the per-sentence loop with loci
item[i].sentences[k].cn / .en.

Tests (extend tests/quality-lint.test.mjs, node:test + assert/strict style):
- normalizeGloss: "To Run"→"run", "the dog"→"dog", parentheticals kept,
  trailing punctuation stripped.
- nearDuplicateGlosses: flags ["run","to run"]; does NOT flag
  ["steamed bun","steamed bun (plain)"]; does NOT re-report ["dog","Dog"];
  [] on unique lists.
- halfWidthPunctuationInCn: flags "你好,再见。" and "这是一只狗."; null for
  "你好，再见。" and "现在是8:30。".
- cjkPunctuationInEn: flags "Hello。" and "Yes，please."; null for clean EN.
- Extend the existing bad-data roll-up test so warnings match
  /near-duplicate/, /half-width/, /CJK punctuation/ and all start with
  `topic "bad-topic"`. The existing "clean on the shipped dataset" test must
  pass UNMODIFIED — if it fails, fix your detectors, never the data.

README.md: add a `npm run validate:quality` row to the scripts table and a
short paragraph under "Data validation" naming the quality-lint rule
families (articles, truncation, CN/EN punctuation agreement, duplicate +
near-duplicate glosses, mixed-script punctuation) and that --strict-quality
makes them blocking.

Validation gate — all must pass before you're done:
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build

Keep the diff minimal and the detectors conservative: zero findings on the
shipped dataset is a hard requirement, verified by the regression test.
```
