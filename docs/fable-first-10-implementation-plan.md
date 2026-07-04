# Fable First 10 Implementation Plan

Detailed read-only Fable plans for the first 10 website improvement sprints. Opus should implement exactly one sprint at a time, keep diffs focused, and leave changes uncommitted for Hermes verification.

## Dependency / order note

Run in the listed order. Sprints 1–2 strengthen language/TTS foundations; Sprint 3 and 4 improve discovery/performance; Sprint 5 builds on practice surfaces; Sprint 6 uses existing PWA/offline pieces; Sprints 7–8 are route/metadata polish; Sprints 9–10 build richer learning modes on top of the earlier language/TTS groundwork.

## Shared validation gate

```bash
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build
```

I've completed the repo survey — the codebase has a clean, consistent convention (`font-hanzi` class marks every Chinese/pinyin render site) that makes this sprint very tractable. Here is the plan.

---

## Sprint 1 — Add lang attributes to Chinese + pinyin text

### Goal and user value

Every piece of Chinese text and every pinyin string in the app should carry a correct BCP-47 `lang` attribute (`zh-Hans` for hanzi, `zh-Latn-pinyin` for pinyin), while the document root stays `lang="en"`. Value:

- **Screen readers** switch to a Chinese voice for hanzi instead of spelling out Unicode gibberish, and stop mangling pinyin with English pronunciation rules — a real win for a language-learning app.
- **Correct glyph selection**: browsers use `lang` to choose Han glyph variants (zh vs ja vs ko forms). Today the `.font-hanzi` font stack mostly covers this, but `lang` makes it robust when Noto Sans SC hasn't loaded (it's `preload: false` with system fallbacks in `src/app/layout.tsx:17-22`).
- **Better translation/spellcheck behavior**: browser translators and spellcheckers stop treating hanzi/pinyin as misspelled English.
- Zero visual change — pure semantics, fitting the sleek-UI constraint.

### Current-state findings (grounded in actual files)

- **Root document**: `src/app/layout.tsx:54` renders `<html lang="en" ...>` — correct as the page chrome is English; keep it.
- **The marker convention already exists**: `src/app/globals.css:92-100` defines `.font-hanzi` with the comment *"Apply className=\"font-hanzi\" to any element rendering hanzi or pinyin"*. There are **57 `font-hanzi` usages across 17 `.tsx` files**, and I verified each site. **No element in `src/` currently has a `lang` attribute** except the `<html>` root.
- **Data shape** (`src/lib/types.ts`): Chinese text reaches the UI via `VocabItem.hanzi`, `VocabItem.pinyin`, `Sentence.cn`, and `Topic.titleCn`. Content is Simplified Chinese (Noto Sans SC font, `zh-CN` TTS).
- **Speech already tagged**: `src/components/speak-button.tsx:12` defaults `lang = "zh-CN"` for `SpeechSynthesisUtterance` — leave as-is (speech-voice matching prefers region tags).
- **Video captions already tagged**: `src/components/video-player.tsx:101-102` renders `<track srcLang={c.lang}>` from `Caption.lang` (documented as BCP-47 in `src/lib/types.ts:20`) — no change needed.
- **Mode-dependent sites** (can't just hardcode a tag):
  - `src/components/topic/quiz-panel.tsx:208` — prompt is **English** in `english-hanzi` mode, hanzi otherwise (`src/lib/quiz-logic.ts:215`).
  - `src/components/topic/quiz-panel.tsx:240` — choices are hanzi in `english-hanzi`, pinyin in `hanzi-pinyin`, English in `hanzi-english`/`listening` (per `ANSWER_FIELD` in `src/lib/quiz-logic.ts`).
  - `src/components/topic/match-panel.tsx:246` — tile face is hanzi only when `tile.side === "hanzi"` (`src/lib/match-logic.ts:12`).
  - `src/components/tone-practice.tsx:110` — row label is a pinyin syllable, falling back to English `"Syllable N"` when syllable/tone counts mismatch.
- **Practice app is fixed-mode**: `src/components/practice-app.tsx:45` always builds `"hanzi-english"` quizzes, so its prompt (`:213`) is always hanzi and its choices are always English.
- **Mixed-language elements**: `src/components/review-app.tsx:260-263` nests a pinyin `<span>` inside a hanzi `<p>`; `src/components/phrasebook-panel.tsx:38-43` nests an English index (`"1."`) inside the hanzi `<p>`; `src/components/topic/typing-panel.tsx:190-200` interleaves English copy with pinyin `<span>`s — all handled by putting `lang` on the innermost correct element.
- **One pinyin site without `font-hanzi`**: `src/components/topic-card.tsx:156` renders matched-item pinyin in a plain `<span className="text-slate-400">` — it still needs `lang`.
- **Non-rendered Chinese**: `src/components/home-app.tsx:32` only builds a search index string (never rendered) — no `lang` needed. `SpeakButton`/favorite-toggle `aria-label`s mix English + hanzi (e.g. `words-panel.tsx:42`) — deferred (see Non-goals).
- **Test infra**: `node --test` with `.mjs` tests in `tests/`; they import `.ts` sources directly via Node 24 type-stripping (see `tests/pinyin.test.mjs:5`). JSX/`.tsx` **cannot** be imported in tests, so component render-tests are off the table; a pure helper module + a source-scan guard test is the testable design.

### Exact implementation steps in sequence

1. **Skim Next.js 16 local docs** per `AGENTS.md` (`node_modules/next/dist/docs/`) only to confirm nothing framework-specific applies to plain JSX attributes (none expected; this sprint is attribute-only).
2. **Create `src/lib/lang.ts`** with the two BCP-47 constants and two pure helpers for the quiz-mode-dependent cases (signatures below). Import `QuizMode` as a type-only import from `@/lib/quiz-logic`.
3. **Mechanical pass — unconditional hanzi sites** (add `lang={HANZI_LANG}`; keep existing classes/markup untouched):
   - `topic/words-panel.tsx:33` (h2 hanzi), `:59` (sentence.cn span)
   - `phrasebook-panel.tsx:38` (hanzi p), `:67` (sentence.cn p)
   - `topic/flashcards-panel.tsx:173, :179` (card faces)
   - `review-app.tsx:260` (tough-list p), `:361, :367` (card faces)
   - `topic/quiz-panel.tsx:86` (recap hanzi), `:197` (listening reveal)
   - `topic/typing-panel.tsx:123` (prompt h3)
   - `topic/match-panel.tsx:164` (recap hanzi)
   - `topic/cloze-panel.tsx:129` (blanked sentence p), `:179` (choice span — cloze choices are always hanzi), `:192` (reveal hanzi), `:197` (sentenceCn)
   - `practice-app.tsx:165` (recap hanzi), `:213` (prompt h2 — fixed `hanzi-english` mode)
   - `tone-practice.tsx:94` (prompt h3)
   - `stats-app.tsx:217`, `favorites-app.tsx:84, :110`
   - `topic-card.tsx:95` (titleCn), `:102` (watermark hanzi — decorative but still benefits glyph selection), `:140` (word chips), `:153` (matched hanzi)
   - `topic-app.tsx:187, :199`, `path-app.tsx:63`, `next-step-panel.tsx:45`, `onboarding.tsx:123, :174` (all `titleCn`)
4. **Mechanical pass — unconditional pinyin sites** (add `lang={PINYIN_LANG}`):
   - `topic/words-panel.tsx:34`, `phrasebook-panel.tsx:44`, `topic/flashcards-panel.tsx:180`, `review-app.tsx:262` (nested span) and `:368`, `topic/quiz-panel.tsx:87, :201, :216` (promptPinyin), `topic/match-panel.tsx:165`, `topic/cloze-panel.tsx:193`, `practice-app.tsx:166`, `stats-app.tsx:218`, `favorites-app.tsx:111`, `topic-card.tsx:156` (the no-`font-hanzi` pinyin span), `tone-practice.tsx:97` (both branches are pinyin), `typing-panel.tsx:190, :194-195, :199-200` (`marked`/`numbered` spans), and `typing-panel.tsx:145` (`lang={PINYIN_LANG}` on the pinyin `<input>` — it already sets `spellCheck={false}`/`autoCorrect="off"`).
5. **Conditional sites**:
   - `quiz-panel.tsx:208` → `lang={quizPromptLang(quizMode)}`
   - `quiz-panel.tsx:240` → `lang={quizChoiceLang(quizMode)}` on the choice `<span>`
   - `match-panel.tsx` tile button (~`:250-260`) → `lang={tile.side === "hanzi" ? HANZI_LANG : undefined}`
   - `tone-practice.tsx:110` → `lang={syllables.length === answer.length ? PINYIN_LANG : undefined}`
6. **Update the convention comment** in `src/app/globals.css:93` to: *"Apply className=\"font-hanzi\" AND a lang attribute (zh-Hans / zh-Latn-pinyin — see src/lib/lang.ts) to any element rendering hanzi or pinyin."*
7. **Add `tests/lang.test.mjs`** — unit tests for the constants and both helpers across all four `QuizMode`s.
8. **Add `tests/lang-attributes.test.mjs`** — source-scan guard: walk `src/**/*.tsx`, and for every JSX opening tag whose literal `className` contains `font-hanzi`, assert the same opening tag also contains `lang=`. Maintain a tiny explicit allowlist for sites where the class is composed in a variable away from the element (`match-panel.tsx`'s `face` string) and document the heuristic's limits in a test comment.
9. **Run the full gate** (`npm run test`, `validate:data`, `validate:quality`, `lint`, `build`) and do the manual QA pass below.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/lang.ts` | **new** — constants + 2 helpers |
| `src/components/topic/words-panel.tsx`, `topic/flashcards-panel.tsx`, `topic/quiz-panel.tsx`, `topic/typing-panel.tsx`, `topic/match-panel.tsx`, `topic/cloze-panel.tsx` | lang attrs |
| `src/components/topic-app.tsx`, `topic-card.tsx`, `phrasebook-panel.tsx`, `review-app.tsx`, `practice-app.tsx`, `tone-practice.tsx`, `stats-app.tsx`, `favorites-app.tsx`, `path-app.tsx`, `next-step-panel.tsx`, `onboarding.tsx` | lang attrs |
| `src/app/globals.css` | comment update only |
| `tests/lang.test.mjs`, `tests/lang-attributes.test.mjs` | **new** tests |

Not touched: `layout.tsx` (root stays `en`), `speak-button.tsx` (TTS `zh-CN` correct), `video-player.tsx` (already uses `srcLang`), `home-app.tsx` (no rendered Chinese), any data or scripts.

### Proposed names and TypeScript signatures

```ts
// src/lib/lang.ts
import type { QuizMode } from "@/lib/quiz-logic";

/** BCP-47 tag for rendered Simplified Chinese (hanzi). */
export const HANZI_LANG = "zh-Hans";

/** BCP-47 tag for Hanyu Pinyin (IANA-registered `pinyin` variant of zh-Latn). */
export const PINYIN_LANG = "zh-Latn-pinyin";

/** lang for a quiz prompt: hanzi except in english-hanzi mode (English prompt → inherit). */
export function quizPromptLang(mode: QuizMode): string | undefined;

/** lang for a quiz choice: hanzi in english-hanzi, pinyin in hanzi-pinyin, else inherit. */
export function quizChoiceLang(mode: QuizMode): string | undefined;
```

Returning `undefined` (not `"en"`) lets English content inherit the root `lang="en"` — React omits the attribute entirely.

### UI copy / microcopy

None. This sprint is invisible: no visible text, aria-labels, or placeholders change. The only new strings are attribute values `zh-Hans` and `zh-Latn-pinyin`.

### Test plan

- `tests/lang.test.mjs`: assert `HANZI_LANG === "zh-Hans"` and `PINYIN_LANG === "zh-Latn-pinyin"`; `quizPromptLang` returns `zh-Hans` for `hanzi-english`/`hanzi-pinyin`/`listening` and `undefined` for `english-hanzi`; `quizChoiceLang` returns `zh-Hans` for `english-hanzi`, `zh-Latn-pinyin` for `hanzi-pinyin`, `undefined` for `hanzi-english`/`listening`.
- `tests/lang-attributes.test.mjs`: regression guard scanning `.tsx` sources so future hanzi/pinyin UI can't silently ship without `lang` (heuristic: literal `font-hanzi` in an opening tag ⇒ `lang=` in that tag; explicit allowlist for variable-composed classes).
- Full existing suite (`npm run test` — 18 existing test files) must stay green; no logic modules are modified so no updates expected.

### Manual QA checklist

- [ ] `npm run dev`; on `/` inspect a topic card: `titleCn` `<p>` has `lang="zh-Hans"`, matched-search pinyin span has `lang="zh-Latn-pinyin"`.
- [ ] On a topic page (`/topics/[slug]`): Words tab hanzi/pinyin/sentences tagged; flashcard front and back tagged; typing input has `lang="zh-Latn-pinyin"`.
- [ ] Quiz tab: cycle all four modes — in `english-hanzi` the English prompt has **no** `lang` and choices have `zh-Hans`; in `hanzi-pinyin` choices have `zh-Latn-pinyin`; in `listening` the reveal hanzi has `zh-Hans`.
- [ ] Match tab: hanzi tiles tagged, English tiles not.
- [ ] `/practice`, `/review`, `/stats`, `/favorites`, `/path`, onboarding modal: spot-check one hanzi + one pinyin element each.
- [ ] View source of the SSR HTML for `/topics/[slug]` and confirm `lang="zh-Hans"` appears (attributes present in server-rendered output, not just after hydration).
- [ ] No visual diffs anywhere (fonts, spacing, colors identical); Chinese still renders in Noto Sans SC.
- [ ] Optional but valuable: VoiceOver/NVDA pass over the Words tab — hanzi read with a Chinese voice, English UI unaffected.

### Acceptance criteria

1. Every rendered hanzi string (`hanzi`, `titleCn`, `sentence.cn`, cloze/quiz/match hanzi content) sits inside an element with `lang="zh-Hans"` (directly or via nearest ancestor).
2. Every rendered pinyin string carries `lang="zh-Latn-pinyin"`, including the typing input and the untagged `topic-card.tsx` pinyin span.
3. English content never carries a Chinese tag — verified in `english-hanzi` quiz mode, English match tiles, and the `"Syllable N"` fallback.
4. `<html lang="en">` unchanged; zero visual regressions.
5. Both new test files pass and the full gate passes: `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build`.

### Risk and rollback notes

- **Risk: screen-reader voice switching mid-sentence** can feel choppy (e.g. review list "hanzi + pinyin" line). This is correct behavior per WAI guidance; accept it.
- **Risk: font/glyph shifts** — `lang` participates in font matching, but `.font-hanzi` already pins the family, so visual change is effectively nil; the watermark/chips were verified to keep the same class.
- **Risk: guard-test brittleness** — the regex scan is heuristic (multi-line tags, class-in-variable). Mitigated by the allowlist and a comment; worst case it's a test-only fix, never a runtime issue.
- **Risk: wrong-mode tagging in quiz** — mitigated by centralizing the mode→lang mapping in two unit-tested helpers instead of inline ternaries at each call site.
- **Rollback**: single revert of one commit; the change is additive attributes + two new files with no data, storage, or logic impact. `ProgressState`/localStorage untouched.

### Non-goals / deferrals

- Mixed-language `aria-label`s (`SpeakButton` "Pronounce 你好 (nǐ hǎo)") — element-level `lang` doesn't apply per-word inside a label; would need label restructuring. Defer.
- Adding `lang="en"` to the English index span inside `phrasebook-panel.tsx:38` or the cloze blank's `aria-label="blank"` — numerals/short tokens are effectively language-neutral; defer.
- Migrating `.font-hanzi` styling to a `:lang(zh)` CSS selector — tempting cleanup, but out of scope; keep class + attribute side by side this sprint.
- Any change to TTS tags (`zh-CN`), caption `srcLang`, data files, HSK metadata, or new vocabulary.
- Traditional-script support (`zh-Hant`) — dataset is Simplified-only.

### Ready-to-run Opus implementation prompt for Sprint 1

```text
You are implementing Sprint 1 of the "Learn 10 Mandarin Words" app (Next.js 16 /
React 19 / Tailwind 4, static local-first, repo root = current directory).
Read AGENTS.md first; if any Next.js specifics come up, consult
node_modules/next/dist/docs/ rather than memory. This sprint is attribute-only —
no visual, data, or logic changes.

GOAL
Add BCP-47 lang attributes to all rendered Chinese and pinyin text:
zh-Hans for hanzi, zh-Latn-pinyin for pinyin. <html lang="en"> in
src/app/layout.tsx stays unchanged. Do NOT touch speak-button.tsx (TTS zh-CN is
correct), video-player.tsx (srcLang already handled), home-app.tsx (search index
string is never rendered), or any data/scripts.

STEP 1 — Create src/lib/lang.ts:
  import type { QuizMode } from "@/lib/quiz-logic";
  export const HANZI_LANG = "zh-Hans";
  export const PINYIN_LANG = "zh-Latn-pinyin";
  export function quizPromptLang(mode: QuizMode): string | undefined
    // zh-Hans unless mode === "english-hanzi" (English prompt) → undefined
  export function quizChoiceLang(mode: QuizMode): string | undefined
    // "english-hanzi" → HANZI_LANG; "hanzi-pinyin" → PINYIN_LANG; else undefined
Return undefined (never "en") so English inherits the root lang.

STEP 2 — Add lang={HANZI_LANG} to these hanzi elements (line numbers are
pre-change references; keep all existing classes/markup identical):
  topic/words-panel.tsx:33 (h2), :59 (sentence.cn span)
  phrasebook-panel.tsx:38 (hanzi p), :67 (sentence.cn p)
  topic/flashcards-panel.tsx:173, :179
  review-app.tsx:260 (p), :361, :367
  topic/quiz-panel.tsx:86, :197
  topic/typing-panel.tsx:123
  topic/match-panel.tsx:164
  topic/cloze-panel.tsx:129 (blanked-sentence p), :179 (choice span), :192, :197
  practice-app.tsx:165, :213
  tone-practice.tsx:94
  stats-app.tsx:217   favorites-app.tsx:84, :110
  topic-card.tsx:95, :102 (watermark), :140 (chips), :153
  topic-app.tsx:187, :199   path-app.tsx:63   next-step-panel.tsx:45
  onboarding.tsx:123, :174

STEP 3 — Add lang={PINYIN_LANG} to these pinyin elements:
  topic/words-panel.tsx:34   phrasebook-panel.tsx:44
  topic/flashcards-panel.tsx:180   review-app.tsx:262 (nested span), :368
  topic/quiz-panel.tsx:87, :201, :216 (promptPinyin)
  topic/match-panel.tsx:165   topic/cloze-panel.tsx:193
  practice-app.tsx:166   stats-app.tsx:218   favorites-app.tsx:111
  topic-card.tsx:~156 (matched-item pinyin span WITHOUT font-hanzi — tag it too)
  tone-practice.tsx:97 (both branches are pinyin)
  topic/typing-panel.tsx:145 (the <input>), :190, :194, :195, :199, :200

STEP 4 — Conditional sites:
  topic/quiz-panel.tsx:208  → lang={quizPromptLang(quizMode)}
  topic/quiz-panel.tsx:240  → lang={quizChoiceLang(quizMode)} on the choice span
  topic/match-panel.tsx tile <button> (renders tile.label, ~:250-260)
    → lang={tile.side === "hanzi" ? HANZI_LANG : undefined}
  tone-practice.tsx:110
    → lang={syllables.length === answer.length ? PINYIN_LANG : undefined}
    (fallback label "Syllable N" is English)

STEP 5 — Update the comment block at src/app/globals.css:92-94 to say elements
rendering hanzi/pinyin need BOTH className="font-hanzi" AND a lang attribute
(zh-Hans / zh-Latn-pinyin, constants in src/lib/lang.ts).

STEP 6 — Tests (node --test, .mjs files in tests/, may import .ts but NOT .tsx;
match the style of tests/pinyin.test.mjs):
  tests/lang.test.mjs — constants' exact values; quizPromptLang and
    quizChoiceLang across all four modes ("hanzi-english", "english-hanzi",
    "hanzi-pinyin", "listening").
  tests/lang-attributes.test.mjs — recursively read src/**/*.tsx; for every JSX
    opening tag whose literal className contains "font-hanzi", assert the same
    opening tag also contains "lang=". Use a small explicit allowlist for
    match-panel.tsx (class composed in the `face` variable) and comment the
    heuristic's limits.

VALIDATION GATE (all must pass; fix regressions before finishing):
  npm run test
  npm run validate:data
  npm run validate:quality
  npm run lint
  npm run build

CONSTRAINTS: no new dependencies, no refactors beyond the listed edits, no
visual changes, no changes to localStorage/progress logic, no backend. If a
listed line number has drifted, locate the site by the quoted content
(font-hanzi + the bound variable) rather than skipping it.
```

---

I have a complete picture of the TTS surface. Here's the sprint plan.

## Sprint 2 — Improve TTS reliability

### Goal and user value

Every pronunciation feature in the app rides on the browser's Web Speech synthesis API, and it currently fails silently in the exact situations learners hit most: Chrome hasn't loaded its voice list yet, the device has no Chinese voice installed, Chrome's engine is stuck in its notorious paused state, or a rapid `cancel()`→`speak()` sequence drops the utterance. The learner taps 🔊 and hears nothing, with no explanation. This sprint centralizes speech into one hardened helper + hook, picks an actual Chinese voice instead of hoping `lang: "zh-CN"` resolves, adds speaking/unavailable feedback states, and makes the listening-quiz gate honest (it currently shows the mode on devices that can never speak Mandarin). Value: audio that works far more often, and honest UI when it can't.

### Current-state findings (grounded in actual files)

- **`src/components/speak-button.tsx`** is the shared TTS control used at 12+ call sites (`words-panel.tsx:42,63`, `flashcards-panel.tsx:174`, `cloze-panel.tsx:198`, `quiz-panel.tsx:198,212,259`, `typing-panel.tsx:124`, `tone-practice.tsx:95`, `phrasebook-panel.tsx:48,71`, `review-app.tsx:362`, `practice-app.tsx:214`, `favorites-app.tsx:117`). Its `speak()` (lines 15–23):
  - Never selects a voice — sets only `utt.lang = "zh-CN"`. Browsers with voices loaded but no zh voice either fall back to a default (English) voice that mangles hanzi or stay silent.
  - Calls `window.speechSynthesis.cancel()` then `speak()` synchronously — a documented Chrome/Android race that intermittently swallows the new utterance.
  - Has no `onstart`/`onend`/`onerror` wiring: no speaking indicator, no error surface, and `utteranceRef` is set but the speaking lifecycle is never observed.
  - Never calls `resume()`, so Chrome's stuck-paused state (common after tab backgrounding) makes all subsequent taps silent until reload.
  - **Hydration hazard at line 25**: `if (typeof window !== "undefined" && !("speechSynthesis" in window)) return null;` — the server renders the button (the `typeof window` check is false server-side), but a client without `speechSynthesis` returns `null` on first client render → hydration mismatch on unsupported browsers. `docs/ui-practice-micro-sprints-implementation-plan.md:227` already flags this pattern as fragile.
- **`src/components/topic/quiz-panel.tsx:14–21`** duplicates the whole speak routine as a local `speakWord()` for listening mode, with the same cancel-then-speak race, no voice selection, no ref retention (utterance can be GC'd mid-speech in Chrome), no error handling. Line 190 already ships the microcopy "No sound? Your device may lack a Chinese voice." unconditionally.
- **`src/components/topic-app.tsx:54–66`** gates the listening-mode chip on `"speechSynthesis" in window` only. Firefox on Linux (and some WebViews) exposes the API with zero voices — the chip renders, the play button does nothing. The detection never inspects `getVoices()` or listens to `voiceschanged` (which is required on Chrome, where `getVoices()` returns `[]` until that event fires).
- **No shared speech module exists.** `src/lib/` holds pure, DOM-free logic tested via `node --test` with direct `.ts` imports (see `tests/quiz-logic.test.mjs:9` importing `../src/lib/quiz-logic.ts`; Node here is v24, native type-stripping). React hooks that need browser APIs live in `src/components/` (precedent: `src/components/use-card-drag.ts` paired with pure `src/lib/gesture-logic.ts`).
- **Sentence-length speech exists** (`cloze-panel.tsx:198`, `phrasebook-panel.tsx:71`, `words-panel.tsx:63` speak full `sentenceCn`/`sentence.cn`), so Chrome desktop's ~15s pause bug is in scope via a `resume()` keep-alive; actual chunking is not needed at these lengths.
- **Feature-detection house style**: `save-offline-button.tsx` detects support in a mount effect with state defaulting to unsupported — the pattern to follow for hydration-safe detection.
- Constraint check: `docs/ui-practice-micro-sprints-implementation-plan.md:973` — `speechSynthesis` only, no recorded audio, no TTS APIs. This sprint stays inside that.

### Exact implementation steps in sequence

1. **Create `src/lib/speech.ts`** — pure, DOM-free helpers (testable under `node --test`):
   - `normalizeLang()` (lowercase, `_`→`-`), `isChineseVoice()` (lang starts with `zh` or `cmn`; exclude `yue` Cantonese tags), `rankChineseVoice()` ranking `zh-cn` > `zh-hans*` > `cmn` > generic `zh` > `zh-tw` > `zh-hk`, with `localService: true` as tiebreak (local voices are more reliable and work offline).
   - `pickChineseVoice(voices)` returning the best-ranked voice or `null`.
   - `classifySupport(hasApi, voices, voicesSettled)` → `SpeechSupport`. Rules: no API → `"unsupported"`; API + zh voice found → `"ready"`; API + **non-empty** voice list with no zh voice → `"no-chinese-voice"`; API + empty list → `"loading"` until settled, then `"ready"` (optimistic — Android Chrome legitimately reports `[]` yet speaks fine; only a *populated* list proves absence).
   - `canAttemptSpeech(status)` and `SPEECH_RATE = 0.85`, `VOICES_SETTLE_MS = 1500`, `KEEPALIVE_MS = 10000` constants.
2. **Create `src/components/use-speech.ts`** — the `useSpeech()` hook (client-only, browser APIs):
   - Mount effect: read `getVoices()`, subscribe to `voiceschanged`, start a `VOICES_SETTLE_MS` timer; derive `status` via `classifySupport`; clean up listener/timer. Default state `"loading"` so SSR and first client render agree.
   - `speak(text, opts?)`: no-op unless API present. Sequence: `synth.resume()` (clear stuck pause) → `synth.cancel()` → build utterance (`lang`, `rate`, picked zh voice if any) → retain it in a ref (Chrome GC bug) → if the synth was speaking/pending, defer the `speak()` call ~60 ms via `setTimeout` (cancel-race workaround), else speak immediately → `onstart` sets `speaking: true` and starts a `KEEPALIVE_MS` interval calling `synth.resume()` → `onend`/`onerror` clear speaking, ref, and interval; `onerror` with `error` not in `{"canceled","interrupted"}` sets a transient `failed` flag.
   - `stop()`: `synth.cancel()` + clear state. Unmount cleanup cancels timers (not global speech — another button may own it).
3. **Rewrite `src/components/speak-button.tsx` internals, keeping the props API identical** (`text`, `lang?`, `label?`, `className?` — zero changes at the 12 call sites):
   - Delete the line-25 inline `typeof window` guard (hydration fix). Always render the button; drive availability from `useSpeech().status` post-mount.
   - `status === "unsupported"` or `"no-chinese-voice"` → keep rendering but disabled-styled (`opacity`, `cursor-not-allowed`, `aria-disabled`) with the unavailable `title` below. No layout shift, no hydration mismatch.
   - While `speaking`: swap to an active style (emerald ink + existing pulse idiom) and make a second tap call `stop()`; `aria-pressed={speaking}`.
   - On `failed`: briefly show the retry `title`/`aria-label` copy below.
4. **Replace `speakWord()` in `src/components/topic/quiz-panel.tsx`** with `useSpeech()` inside `QuizPanel` (delete lines 10–21). Use `speak(currentQuiz.prompt)` for the big play button and Replay. Make the line-190 helper note conditional: show the stronger no-voice copy only when `status === "no-chinese-voice"`, keep the soft copy otherwise.
5. **Fix the listening-mode gate in `src/components/topic-app.tsx:54–66`**: replace the hand-rolled effect with `useSpeech()` and pass `speechAvailable={canAttemptSpeech(status)}` — chip hidden when the API is missing **or** a populated voice list confirms no Chinese voice; still shown in the ambiguous empty-list case. `QuizPanel`'s existing `speechAvailable: boolean` prop is unchanged.
6. **Add `tests/speech.test.mjs`** covering the pure lib (see Test plan).
7. Run the full validation gate; fix lint/type fallout (there should be none outside the five files).

### Likely files touched

| File | Change |
|---|---|
| `src/lib/speech.ts` | new — pure voice-selection/support logic |
| `src/components/use-speech.ts` | new — `useSpeech()` hook |
| `src/components/speak-button.tsx` | rewrite internals; same props |
| `src/components/topic/quiz-panel.tsx` | drop local `speakWord`, use hook, conditional microcopy |
| `src/components/topic-app.tsx` | replace detection effect with hook-derived gate |
| `tests/speech.test.mjs` | new — unit tests for the lib |

### Proposed names and TypeScript signatures

```ts
// src/lib/speech.ts
export type SpeechVoiceLike = {
  lang: string;
  name?: string;
  localService?: boolean;
};
export type SpeechSupport = "loading" | "unsupported" | "no-chinese-voice" | "ready";

export const SPEECH_RATE = 0.85;
export const VOICES_SETTLE_MS = 1500;
export const KEEPALIVE_MS = 10_000;

export function normalizeLang(tag: string): string;
export function isChineseVoice(voice: SpeechVoiceLike): boolean;
export function rankChineseVoice(voice: SpeechVoiceLike): number; // lower = better; Infinity = not Chinese
export function pickChineseVoice<V extends SpeechVoiceLike>(voices: readonly V[]): V | null;
export function classifySupport(
  hasApi: boolean,
  voices: readonly SpeechVoiceLike[],
  voicesSettled: boolean,
): SpeechSupport;
export function canAttemptSpeech(status: SpeechSupport): boolean;
```

```ts
// src/components/use-speech.ts
export interface UseSpeechResult {
  status: SpeechSupport;
  speaking: boolean;
  /** True briefly after a non-cancel utterance error; auto-clears. */
  failed: boolean;
  speak: (text: string, opts?: { lang?: string; rate?: number }) => void;
  stop: () => void;
}
export function useSpeech(): UseSpeechResult;
```

### UI copy / microcopy

- Speak button, unavailable `title`/`aria-label` suffix: **"Audio unavailable — no Chinese voice on this device"**
- Speak button while speaking, `aria-label`: **"Stop audio"**
- Speak button after a failed utterance, `title`: **"Couldn't play audio — tap to try again"**
- Listening mode, confirmed no zh voice (replaces line 190 note): **"Your device has no Chinese voice installed, so listening mode may be silent."**
- Listening mode, ambiguous/default (keep existing): **"No sound? Your device may lack a Chinese voice."**

### Test plan

New `tests/speech.test.mjs` (imports `../src/lib/speech.ts`, matching repo convention):

- `normalizeLang`: `"zh_CN"` → `"zh-cn"`, `"ZH-Hans-CN"` → `"zh-hans-cn"`.
- `isChineseVoice`: true for `zh-CN`, `zh_TW`, `zh-Hans-CN`, `cmn-Hans-CN`; false for `en-US`, `yue-HK`, `ja-JP`.
- `pickChineseVoice`: prefers `zh-CN` over `zh-TW`; prefers `zh-Hans` over generic `zh`; `localService: true` wins a same-rank tie; returns `null` for an all-English list and for `[]`.
- `classifySupport`: `(false, …)` → `"unsupported"`; `(true, [zh-CN], …)` → `"ready"`; `(true, [en-US], true)` → `"no-chinese-voice"`; `(true, [], false)` → `"loading"`; `(true, [], true)` → `"ready"` (optimistic empty-list rule).
- `canAttemptSpeech`: true for `"ready"`/`"loading"`, false for `"unsupported"`/`"no-chinese-voice"`.

The hook itself is browser-bound and not unit-testable under `node --test` (repo has no DOM test rig) — mirrored by the existing `use-card-drag.ts` / `gesture-logic.ts` split, so the reliability sequencing is covered by the manual QA below. Full gate: `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build`.

### Manual QA checklist

- [ ] Chrome desktop: tap 🔊 on a topic word immediately after page load (before voices settle) — audio plays.
- [ ] Rapid-fire: tap the same speak button 5× fast, then two different buttons back-to-back — last tap always wins, no silent drops.
- [ ] Tap while speaking stops playback (button shows active style until then).
- [ ] Background the tab mid-utterance, return, tap again — speech works (stuck-pause cleared).
- [ ] Phrasebook + cloze post-answer: full sentence plays to the end.
- [ ] Listening quiz: play + Replay work; answer reveal's SpeakButton works.
- [ ] DevTools override `delete window.speechSynthesis` (or use a browser without it): no hydration warning in console; buttons render disabled with the unavailable title; listening chip absent.
- [ ] Simulate no-zh voices (stub `getVoices` to English-only): buttons disabled-styled, listening chip hidden, stronger microcopy shown in listening panel if reached via stale state.
- [ ] iOS Safari / Android Chrome if available: first tap after load speaks (user-gesture requirement satisfied — no autoplay anywhere).
- [ ] Keyboard + screen reader: button announces pronounce/stop/unavailable states correctly.

### Acceptance criteria

1. All speech flows go through `useSpeech()`/`src/lib/speech.ts`; no direct `speechSynthesis` calls remain in `speak-button.tsx` internals-as-before, `quiz-panel.tsx`, or `topic-app.tsx` detection.
2. A Chinese voice is explicitly selected when one exists; `utt.lang` fallback otherwise.
3. No hydration mismatch from `SpeakButton` on browsers without `speechSynthesis`.
4. Listening-mode chip hidden when a populated voice list contains no Chinese voice; still shown in the ambiguous empty-list case.
5. Speaking state is visible; utterance errors surface the retry copy instead of failing silently.
6. `SpeakButton` public props unchanged; all 12 call sites compile untouched.
7. Full validation gate passes.

### Risk and rollback notes

- **Browser-quirk whack-a-mole**: the cancel-race delay and `resume()` keep-alive are workarounds for engine bugs; they're conditional (delay only when already speaking/pending) so the common path stays instant. Worst regression is added ~60 ms latency on interrupting taps.
- **Optimistic empty-voice-list rule** may leave buttons enabled on a truly voiceless Firefox/Linux setup — accepted trade-off to avoid breaking Android Chrome (which lies with `[]`); the `failed`/no-sound microcopy covers it.
- **Behavior gate change** in `topic-app.tsx` can *hide* the listening chip on devices where it previously showed-but-was-silent — that's the intent; verify it still shows on mainstream desktop Chrome.
- **Rollback** is cheap and local: revert `speak-button.tsx`, `quiz-panel.tsx`, `topic-app.tsx` and delete `src/lib/speech.ts`, `src/components/use-speech.ts`, `tests/speech.test.mjs`. No data, schema, storage, or route changes; no dependency changes.

### Non-goals / deferrals

- No recorded/native audio files, no cloud TTS APIs, no backend (per `docs/ui-practice-micro-sprints-implementation-plan.md:973`).
- No speech *recognition*, no autoplay, no voice-picker UI for the user.
- No utterance chunking (sentences in the dataset are short; keep-alive suffices).
- No per-browser UA sniffing — feature/state detection only.
- No changes to quiz logic, progress storage, or the `QuizPanel` prop contract beyond copy.

### Ready-to-run Opus implementation prompt for Sprint 2

> Implement Sprint 2 ("Improve TTS reliability") for Learn 10 Mandarin Words. Read `AGENTS.md` first and consult `node_modules/next/dist/docs/` if any Next.js 16 detail matters (this sprint is client-component-only). Do not add dependencies, backends, or recorded audio — `speechSynthesis` only.
>
> 1. Create pure module `src/lib/speech.ts` exporting `SpeechVoiceLike`, `SpeechSupport` (`"loading" | "unsupported" | "no-chinese-voice" | "ready"`), `SPEECH_RATE = 0.85`, `VOICES_SETTLE_MS = 1500`, `KEEPALIVE_MS = 10000`, `normalizeLang` (lowercase, underscores→hyphens), `isChineseVoice` (zh/cmn prefixes, exclude yue), `rankChineseVoice` (zh-cn > zh-hans* > cmn > generic zh > zh-tw > zh-hk; `localService` tiebreak), `pickChineseVoice`, `classifySupport` (no API → unsupported; zh voice → ready; populated non-zh list → no-chinese-voice; empty list → loading until settled, then ready), and `canAttemptSpeech` (false only for unsupported/no-chinese-voice). No DOM access; use `.ts`-extension relative imports like `src/lib/quiz-logic.ts` does.
> 2. Create hook `src/components/use-speech.ts` (`useSpeech(): { status, speaking, failed, speak(text, opts?), stop() }`): mount-effect voice detection via `getVoices()` + `voiceschanged` + settle timer (hydration-safe, initial `"loading"`); `speak()` does `resume()` → `cancel()` → utterance with lang/rate/picked zh voice, retained in a ref → deferred ~60ms `speak()` only if the synth was already speaking/pending → `onstart` starts a `KEEPALIVE_MS` `resume()` interval → `onend`/`onerror` clean up; non-cancel/interrupted errors set a transient `failed`. Second-tap `stop()` cancels.
> 3. Rewrite `src/components/speak-button.tsx` internals on `useSpeech()` with an UNCHANGED props API (`text`, `lang?`, `label?`, `className?`). Remove the inline `typeof window` null-return (hydration bug); always render, disabled-styled with title "Audio unavailable — no Chinese voice on this device" when status is unsupported/no-chinese-voice, active style + `aria-pressed` + "Stop audio" label while speaking, "Couldn't play audio — tap to try again" title after `failed`.
> 4. In `src/components/topic/quiz-panel.tsx` delete the local `speakWord` (lines 10–21) and use `useSpeech()`; show "Your device has no Chinese voice installed, so listening mode may be silent." when status is no-chinese-voice, else keep the existing "No sound?" note.
> 5. In `src/components/topic-app.tsx` replace the `speechAvailable` detection effect (lines 54–66) with `useSpeech()` + `canAttemptSpeech(status)`; keep the `speechAvailable: boolean` prop to `QuizPanel` unchanged.
> 6. Add `tests/speech.test.mjs` (node:test, import `../src/lib/speech.ts`) covering normalizeLang, isChineseVoice incl. yue exclusion, pickChineseVoice ranking + localService tiebreak + null cases, all classifySupport branches, and canAttemptSpeech.
>
> Keep pinyin rendering (`font-hanzi`) and existing styling idioms; no schema/data/storage changes; do not commit, push, or deploy. Finish with `npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build` and report results.

---

I have a full picture of the current search implementation now. Writing the sprint plan.

## Sprint 3 — Add word-level search results

### Goal and user value

Today, searching on the home page only returns **topics**: the library grid filters to topic cards, with up to 4 matched words previewed inside each card. A learner who types "gǒu" or "dog" still has to scan cards and open a lesson to get to the word itself. This sprint adds a **word-level results section**: when a query is active, a flat, ranked list of every matching word (hanzi + pinyin + English, query highlighted) appears above the topic grid, each row linking to its lesson and offering the same Save-to-favorites and pronunciation actions available elsewhere. The learner's mental model becomes "search finds words," not "search finds lists that contain words."

### Current-state findings (grounded in actual files)

- **Home search lives in `src/components/home-app.tsx`** (`HomeApp`, lines 18–36): `query` + `category` state, and a `filtered` memo that matches topics via a normalized haystack of `titleEn`, `titleCn`, `category`, and every item's `hanzi`/`pinyin`/`english`. There is no word-level output — only `TopicCard` grids.
- **`src/components/topic-card.tsx`** already computes `matchedItems` (up to 4 matched words per card, lines 46–51) and renders them highlighted (rows 149–165). This is the only word-ish search surface today, and it's per-card, capped, and unranked.
- **`src/lib/highlight.ts`** provides the pure, dependency-free `normalizePinyin` (diacritic-stripping, lowercase) and `splitHighlight`; `src/components/highlighted-text.tsx` renders `<mark>` segments safely. Search and highlighting are deliberately kept "in lockstep" via `normalizePinyin` (comment at `home-app.tsx:13-15`). Any new matcher must reuse it.
- **`src/lib/data-logic.ts`** has `allWords(topics)` (line 41) annotating each word with `topicSlug`, `topicTitle`, `category` — but **not** `categorySlug` (needed for the category filter) or the `wordKey`. `wordKey(topic, item)` = `` `${topic.slug}:${item.hanzi}` `` (line 25) is the canonical key for `favoriteWords`/`flashcardStats`.
- **Favorites plumbing exists**: `useProgress()` in `src/components/use-progress.ts` exposes `toggleFavoriteWord(key)` (line 99); `src/components/favorites-app.tsx` and `src/components/topic/words-panel.tsx` both render word rows with a Save toggle and `SpeakButton` (`src/components/speak-button.tsx`) — good styling precedent for result rows.
- **`src/lib/analytics.ts`** is a typed no-op/local event choke point with a closed `AnalyticsEvent` union (lines 15–30); new events must be added to the union.
- **Testing convention**: pure logic lives in dataset-parameterized `src/lib/*-logic.ts` files imported by `tests/*.test.mjs` with explicit `.ts` extensions under `node --test` (see `tests/highlight.test.mjs:4`, `tests/data.test.mjs`). Dataset facts from tests: 102 topics, 1,020 words, 14 categories — small enough to search synchronously in a memo.
- **No deep-link infra**: `grep` for `useSearchParams`/hash/`scrollIntoView` finds nothing; `src/components/topic-app.tsx` opens non-phrase topics on the Words tab by default (line 34), so linking to `/topics/[slug]` already lands the learner on the full word list.
- **Category pages intentionally have no search** (`src/components/category-app.tsx:11`), so this sprint touches the home page only.
- **Invariant worth preserving**: the topic haystack includes all item text, so any word match implies its topic also matches — the word section can never show results while the "No topics found" empty state (home-app.tsx:274–287) is visible.

### Exact implementation steps in sequence

1. **Read the Next.js 16 docs** in `node_modules/next/dist/docs/` per `AGENTS.md` (client components / `Link` are the only framework surfaces used; no new routes are added).
2. **Create `src/lib/search-logic.ts`** — pure, dataset-parameterized, importing only `normalizePinyin` from `./highlight` and types from `./types`. Implements `searchWords` with ranking (spec below), category filtering, and `wordKey`-format keys. No React, no data import — mirrors `data-logic.ts` conventions so it's testable from Node.
3. **Create `tests/search-logic.test.mjs`** covering the cases in the test plan below (import via `../src/lib/search-logic.ts`).
4. **Create `src/components/word-search-results.tsx`** — presentational client component rendering the results panel: heading with count, capped row list with a "Show all" expander, per-row hanzi/pinyin/English through `HighlightedText`, topic link, `SpeakButton`, and Save toggle. Favorites state and toggle come in via props (same pattern as `WordsPanel`).
5. **Wire into `src/components/home-app.tsx`**: add a `wordResults` memo calling `searchWords(data.topics, query, { categorySlug: category === "all" ? undefined : category })`; render `<WordSearchResults …>` inside the `#library` section, between the search controls and the topic grid, only when `query.trim()` is non-empty and results exist. Pass `progress.favoriteWords`, `toggleFavoriteWord` (firing `track("favorite_saved", …)` like `topic-app` does), and fire `search_result_opened` on row click. Update the library section subheading copy (see microcopy).
6. **Extend `src/lib/analytics.ts`**: add `"search_result_opened"` to the `AnalyticsEvent` union (props: `{ topic: string, rank: number }` — no query text, keeping the privacy posture of the module).
7. **Run the validation gate** and fix anything it surfaces: `npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build`. Confirm the build output still lists all existing static routes unchanged (no new routes expected).

### Likely files touched

| File | Change |
|---|---|
| `src/lib/search-logic.ts` | **new** — pure word search + ranking |
| `src/components/word-search-results.tsx` | **new** — results panel UI |
| `tests/search-logic.test.mjs` | **new** — unit tests |
| `src/components/home-app.tsx` | wire memo + render panel + copy tweak |
| `src/lib/analytics.ts` | add `search_result_opened` event |

Not touched: `topic-card.tsx` (its 4-item preview stays — it serves the grid), `category-app.tsx`, any route files, `topics.json`, progress schema.

### Proposed names and TypeScript signatures

```ts
// src/lib/search-logic.ts
import type { Topic } from "./types";

export type WordSearchResult = {
  hanzi: string;
  pinyin: string;
  english: string;
  /** Canonical wordKey: `${topicSlug}:${hanzi}` — matches data-logic's wordKey. */
  key: string;
  topicSlug: string;
  topicTitle: string;
  category: string;
  categorySlug: string;
  /** Lower = better. 0 exact hanzi, 1 hanzi contains, 2 pinyin prefix, 3 pinyin contains, 4 english contains. */
  rank: number;
};

/**
 * Diacritic-tolerant word search across all topics. Empty/whitespace query → [].
 * Results sorted by rank, then stable dataset order. Matching uses the same
 * normalizePinyin as the home topic filter and the highlighter.
 */
export function searchWords(
  topics: Topic[],
  query: string,
  opts?: { categorySlug?: string },
): WordSearchResult[];
```

```tsx
// src/components/word-search-results.tsx
export function WordSearchResults({
  results,
  query,
  favoriteWords,
  onToggleFavorite, // parent fires track("favorite_saved") — same split as WordsPanel
  onOpenResult,     // parent fires track("search_result_opened", { topic, rank })
}: {
  results: WordSearchResult[];
  query: string;
  favoriteWords: string[];
  onToggleFavorite: (key: string) => void;
  onOpenResult: (result: WordSearchResult) => void;
}): React.JSX.Element | null;
```

Internal constant `INITIAL_VISIBLE = 12` with a `useState` expander. Row: `font-hanzi` hanzi (pinyin beside it — pinyin always accompanies Chinese text, matching `words-panel.tsx`), English, quiet topic chip linking to `/topics/${topicSlug}` via `next/link`, `SpeakButton`, Save toggle with `aria-pressed`. Styling: `rounded-2xl border border-white/10 bg-surface` rows to match the existing flat-surface system.

### UI copy / microcopy

- Section heading: **"Matching words"**
- Count line: `{n} word{n !== 1 ? "s" : ""} match your search` (avoid echoing the raw query twice; the existing topic empty state already quotes it)
- Topic chip on each row: `in {topicTitle}` (links to the lesson)
- Expander button: `Show all {n} words` / after expanding: `Show fewer`
- Save toggle: `Save` / `Saved` (identical to `words-panel.tsx`)
- Save aria-labels: `Save {english} to favorites` / `Remove {english} from favorites`
- Updated library subheading in `home-app.tsx` (currently line 252): **"Filter by category, search any word — results show both matching words and topics."**
- No new empty state: zero word matches simply hides the section (topics matched by title still show below; a full miss keeps the existing "No topics found" card).

### Test plan (`tests/search-logic.test.mjs`, run via `npm run test`)

Use the real dataset (`import topicsData from "../src/data/topics.json" …` pattern from `tests/data.test.mjs`) plus small synthetic fixtures:

1. Empty and whitespace-only queries return `[]`.
2. Diacritic tolerance: a toneless pinyin query (e.g. `"gou"`) returns words whose pinyin contains `gǒu`/`gòu`; assert via `normalizePinyin` rather than hard-coding vocab.
3. Hanzi query returns words containing that character; exact hanzi match ranks before contains (synthetic fixture with two known words).
4. English substring matches, ranked after pinyin matches (synthetic fixture).
5. `categorySlug` option filters results to that category only (real dataset: pick `topics[0].categorySlug`).
6. Every result's `key` equals `` `${topicSlug}:${hanzi}` `` and its `topicSlug` exists in the dataset.
7. No duplicate keys in results; sort is stable within a rank (fixture ordering preserved).
8. Lockstep invariant: for any query with ≥1 word result, the source topic passes the exact home-app haystack predicate (re-implemented locally in the test), proving the word section can never appear alongside the "No topics found" state.

Existing suites (`highlight.test.mjs`, `data.test.mjs`, etc.) must stay green untouched.

### Manual QA checklist

- [ ] `npm run dev`, home page: type `ni hao` → "Matching words" section appears with highlighted pinyin (tone marks preserved in display); typing `nǐ` gives the same rows.
- [ ] Type a hanzi character present in the data → word rows appear with the character highlighted.
- [ ] Type an English word (e.g. one visible in a card chip) → matches rank below any pinyin/hanzi matches for the same query.
- [ ] Select a category in the dropdown while searching → word results and topic grid both restrict to that category.
- [ ] More than 12 matches → "Show all N words" reveals the rest; "Show fewer" collapses.
- [ ] Click a row's topic link → lands on `/topics/[slug]` with the Words tab active.
- [ ] Save toggle on a result row → chip flips to "Saved", word appears on `/favorites`, and the same word shows "Saved" state inside its topic's Words tab (shared `wordKey`).
- [ ] Clear the query → section disappears; grid returns to full library. "Clear filters" in the empty state also clears it.
- [ ] Gibberish query → only the existing "No topics found" card, never an empty "Matching words" shell.
- [ ] Mobile width (~360px): rows wrap without horizontal scroll; Save button keeps a ≥44px hit target; bottom nav unobstructed.
- [ ] Keyboard: tab order reaches link, speak, and save controls; `aria-pressed` announces correctly.
- [ ] No hydration warnings in the console; localStorage progress from before the change loads unchanged.

### Acceptance criteria

1. A non-empty query renders a ranked, highlighted word-level results list above the topic grid; empty query renders nothing new.
2. Matching is diacritic-tolerant and byte-for-byte consistent with the existing topic filter and highlighter (`normalizePinyin` is the single normalizer).
3. Results respect the category filter, cap at 12 with an expander, dedupe by `wordKey`, and rank exact-hanzi > hanzi > pinyin-prefix > pinyin > English.
4. Rows offer topic link, pronunciation, and favorites toggle persisted to the existing `favoriteWords` localStorage key — no schema change, no migration.
5. All five gate commands pass; `next build` route output is unchanged (no new routes, all pages still static).
6. No network calls, no new dependencies, no invented vocabulary or metadata — everything is derived from `src/data/topics.json`.

### Risk and rollback notes

- **Perf**: 1,020 words scanned per keystroke inside a `useMemo` — trivially fast at this scale; no debounce needed. If the dataset ever grows 10×, memoize the normalized word list once per `data.topics` reference (note this in a comment, don't build it now).
- **Search/highlight drift**: the historical risk in this codebase (called out in `home-app.tsx:13`). Mitigated by reusing `normalizePinyin` and by test #8's lockstep invariant.
- **Layout regression risk** is contained: the panel is a new sibling block inside `#library`; `TopicCard` and every other page are untouched.
- **Rollback**: single revert of the sprint commit restores prior behavior — no persisted-data changes, so localStorage needs no migration in either direction. The added `AnalyticsEvent` member is additive and inert.

### Non-goals / deferrals

- No dedicated `/search` route or URL query-param persistence (`?q=`) — search stays ephemeral home-page state.
- No deep link that scrolls/highlights the specific word inside the topic page (no `useSearchParams`/anchor infra exists; a `?word=` param is a clean future sprint).
- No fuzzy/typo matching, tone-number input (`ni3`), or sentence-text search — item `hanzi`/`pinyin`/`english` fields only.
- No search on category pages (explicitly out of scope per `category-app.tsx:11`).
- No combobox/listbox keyboard semantics beyond native tab order.
- No changes to `TopicCard`'s existing 4-item matched preview.

### Ready-to-run Opus implementation prompt for Sprint 3

> Implement Sprint 3 ("Add word-level search results") in `/home/nvidia/learn-10-mandarin-words`. Read `AGENTS.md` first and consult `node_modules/next/dist/docs/` before using any framework API — this is Next.js 16. Do not commit, push, deploy, or install packages. Work only from existing data in `src/data/topics.json`; invent no vocabulary or metadata.
>
> 1. Create pure, dataset-parameterized `src/lib/search-logic.ts` exporting `WordSearchResult` and `searchWords(topics, query, opts?: { categorySlug?: string })`. Reuse `normalizePinyin` from `src/lib/highlight.ts` for diacritic-tolerant matching (never write a second normalizer). Empty/whitespace query → `[]`. Each result carries `hanzi`, `pinyin`, `english`, `topicSlug`, `topicTitle`, `category`, `categorySlug`, `key` (exactly `` `${topicSlug}:${hanzi}` ``, matching `wordKey` in `src/lib/data-logic.ts`), and `rank` (0 exact hanzi, 1 hanzi contains, 2 pinyin prefix, 3 pinyin contains, 4 english contains). Sort by rank then stable dataset order; dedupe by key; filter by `categorySlug` when provided. No React or `@/` imports — follow `data-logic.ts` conventions.
> 2. Create presentational client component `src/components/word-search-results.tsx` (`WordSearchResults` with props `{ results, query, favoriteWords, onToggleFavorite, onOpenResult }`), modeled on the row styling of `src/components/topic/words-panel.tsx` and `favorites-app.tsx`: `font-hanzi` hanzi with pinyin beside it (pinyin always accompanies Chinese text), English, an `in {topicTitle}` chip linking to `/topics/${topicSlug}` via `next/link`, `SpeakButton`, and a Save/Saved toggle with `aria-pressed` and a ≥44px hit target. Highlight all three text fields with `HighlightedText`. Heading "Matching words", count line `{n} word(s) match your search`, show 12 rows with `Show all {n} words` / `Show fewer` expander. Render `null` when `results` is empty. Flat surfaces (`border-white/10 bg-surface`), no shadows, matching the existing design system.
> 3. In `src/components/home-app.tsx`, add a `wordResults` memo calling `searchWords(data.topics, query, { categorySlug: category === "all" ? undefined : category })` and render the panel inside the `#library` section between the search controls and the topic grid, only while `query.trim()` is non-empty. Wire `progress.favoriteWords` and `toggleFavoriteWord` from the existing `useProgress()` (fire `track("favorite_saved", …)` on save like `topic-app.tsx` does), and fire the new `track("search_result_opened", { topic, rank })` on row open. Update the library subheading to "Filter by category, search any word — results show both matching words and topics." Do not modify `TopicCard`.
> 4. Add `"search_result_opened"` to the `AnalyticsEvent` union in `src/lib/analytics.ts` (never include query text in props).
> 5. Add `tests/search-logic.test.mjs` (node:test, importing `../src/lib/search-logic.ts` with the explicit extension, real dataset plus small fixtures) covering: empty query, diacritic-tolerant pinyin, hanzi ranking above English, category filter, key format/dedupe/stable order, and the invariant that any word result's topic also passes home-app's topic haystack predicate.
>
> No schema, route, or bottom-nav changes; all pages must remain static. Finish with `npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build` — all must pass; confirm the build's static route list is unchanged — and report results.

---

All findings are in. Here is the grounded sprint plan.

---

## Sprint 4 — Slim the home page payload

### Goal and user value

The home route currently ships the entire 102-topic dataset **twice**: once serialized into the server-rendered Flight/RSC payload (`.next/server/app/index.html` is **707,398 bytes**; `index.rsc` is 356,498 bytes), and once inside a client JS chunk (`.next/static/chunks/1r3gxdxp6laq8.js`, **350,664 bytes** — a verbatim copy of `topics.json`, confirmed by grepping it for `ten-types-of-pets`). The word `sentences` appears 1,020 times in the home HTML even though the home page never renders or searches example sentences.

Goal: cut the home route's data cost from ~700KB to ~118KB (measured: the dataset minus `sentences` serializes to 118,127 bytes vs 349,776 full) by (a) passing a slimmed dataset as the client prop and (b) removing the accidental `topics.json` import from the home page's client bundle. Users on slow/mobile connections get a dramatically faster first load of the app's front door, with zero visible change in behavior — search, cards, onboarding, streaks, and localStorage progress all work identically.

### Current-state findings (grounded in files)

1. **`src/app/page.tsx:5`** — server component renders `<HomeApp data={data} />` with the full `MandarinData` (all 102 topics × 10 items × 2 sentences each, 2,040 sentences total). Everything passed across a `"use client"` boundary is serialized into the RSC payload embedded in the HTML.
2. **`src/components/home-app.tsx:6`** — `import { datasetSummary, nextRecommendedTopic } from "@/lib/data"`. `src/lib/data.ts:1` does `import rawData from "@/data/topics.json"`, so this client component statically bundles the whole JSON. Same problem via **`src/components/topic-card.tsx:3`** (`import { wordKey } from "@/lib/data"`), which is in the home client graph. This is the source of the 350KB client chunk.
3. **What home actually uses per topic** (audited `home-app.tsx` + `topic-card.tsx` + `onboarding.tsx`):
   - Search haystack (`home-app.tsx:31-33`): `titleEn`, `titleCn`, `category`, and per-item `hanzi`/`pinyin`/`english`. **Sentences are never searched.**
   - `TopicCard`: `slug`, titles, `category`, first-5 `hanzi` chips, matched-item `hanzi/pinyin/english`, `wordKey` (needs `topic.slug` + `item.hanzi`), `topicWordStatuses`, and `hasPlayableVideo(topic)` (needs only `videoPath`/`video` — `src/lib/video.ts:53` already takes `Pick<Topic, "videoPath" | "video">`).
   - `OnboardingModal` / `ContinueLearningCard` (`onboarding.tsx`): only `slug`, `titleEn`, `titleCn`.
   - Metric cards: `data.categories.length`, `data.topics.length`, `datasetSummary` counts.
4. **Pure-logic split already exists**: `src/lib/data-logic.ts` holds all helpers parameterized by `topics` and does **not** import `topics.json`; `src/lib/data.ts` is the thin binding layer. `src/lib/progress-logic.ts:5` already imports `wordKey` from `./data-logic.ts` — the correct pattern. Several client components import from `@/lib/data` instead (found via grep): `topic-card.tsx`, `favorites-app.tsx`, `stats-app.tsx`, `phrasebook-panel.tsx`, `topic/match-panel.tsx`, `topic/cloze-panel.tsx`, `topic/words-panel.tsx`, `topic/typing-panel.tsx` (all just for `wordKey`), plus `topic-app.tsx` and `path-app.tsx` (bound helpers — see deferrals).
5. **`TopicCard` is shared** by `home-app.tsx:291`, `category-app.tsx:53`, and `path-app.tsx:97`, which receive full `Topic[]` from their server pages. The slim type must therefore be chosen so full `Topic` remains structurally assignable (see step 1) — then category/path pages need **no changes**.
6. Type widening targets: `wordKey` (`data-logic.ts:25`) takes full `Topic`/`VocabItem`; `datasetSummary` (`data-logic.ts:47`), `recommendedPath`/`nextRecommendedTopic`/`nextTopicAfter` (`data-logic.ts:72-112`), `topicWordStatuses` (`progress-logic.ts:574`) take full `Topic`. All only use `slug` and/or `items` lengths/hanzi.
7. Tests live in `tests/*.test.mjs` under `node --test`, importing pure logic as `../src/lib/data-logic.ts` with explicit `.ts` extension (see `tests/data.test.mjs:19` and the comment at `progress-logic.ts:2-4`).
8. Dataset facts (measured): 14 categories, 102 topics, 1,020 items, 2,040 sentences; 100 topics have `video` metadata, 102 have `videoPath`.

### Exact implementation steps in sequence

1. **`src/lib/types.ts` — add summary types** (full `Topic` stays assignable to `TopicSummary`, so category/path callers keep compiling unchanged):
   ```ts
   export type VocabItemSummary = Pick<VocabItem, "hanzi" | "pinyin" | "english">;
   export type TopicSummary = Omit<Topic, "items"> & { items: VocabItemSummary[] };
   export type HomeData = { categories: Category[]; topics: TopicSummary[] };
   ```
2. **`src/lib/data-logic.ts` — add a pure summarizer + widen helper signatures** (keep behavior identical; TypeScript-only changes except the new function):
   - `toTopicSummary(topic: Topic): TopicSummary` — copies all topic fields, maps `items` to `{ hanzi, pinyin, english }`. Explicitly drop `sentences`; keep `videoPath`/`video` (only +~35KB total, and it lets `hasPlayableVideo` keep working untouched).
   - Widen: `wordKey(topic: Pick<Topic, "slug">, item: Pick<VocabItem, "hanzi">)`; `datasetSummary(topics: Pick<TopicSummary, "items">[])`; make `getTopic`, `recommendedPath`, `nextRecommendedTopic`, `nextTopicAfter` generic: `<T extends Pick<Topic, "slug">>(topics: T[], …): T`.
3. **`src/lib/data.ts` — add the server-side binding**: module-scope `const home: HomeData = { categories: data.categories, topics: data.topics.map(toTopicSummary) }` and `export function homeData(): HomeData`. Mirror the existing doc-comment style.
4. **`src/lib/progress-logic.ts:574` — widen** `topicWordStatuses` (and `masterySummary` at line 587) to accept `Pick<TopicSummary, "slug" | "items">` instead of `Topic`.
5. **`src/app/page.tsx`** — `import { homeData } from "@/lib/data"` and render `<HomeApp data={homeData()} />`.
6. **`src/components/home-app.tsx`** — change prop to `{ data: HomeData }`; change line 6 to `import { datasetSummary, nextRecommendedTopic } from "@/lib/data-logic"` and call `nextRecommendedTopic(data.topics, progress.learnedTopics)` inside the existing `useMemo` (add `data.topics` to deps). No JSX changes.
7. **`src/components/topic-card.tsx`** — prop `topic: TopicSummary`; change line 3 to import `wordKey` from `@/lib/data-logic`. `hasPlayableVideo`, `topicWordStatuses`, and all rendering stay as-is.
8. **`src/components/onboarding.tsx`** — widen `firstTopic`/`nextTopic` props to a local `type TopicCta = Pick<Topic, "slug" | "titleEn" | "titleCn">`.
9. **Mechanical import hygiene** (same one-line fix, stops `topics.json` leaking into other routes' client bundles): switch `import { wordKey } from "@/lib/data"` → `"@/lib/data-logic"` in `favorites-app.tsx`, `stats-app.tsx`, `phrasebook-panel.tsx`, `topic/match-panel.tsx`, `topic/cloze-panel.tsx`, `topic/words-panel.tsx`, `topic/typing-panel.tsx`. (Leave `topic-app.tsx` and `path-app.tsx` alone — they use *bound* helpers; see deferrals.)
10. **Tests** — new `tests/home-data.test.mjs` (see test plan), following the import style of `tests/data.test.mjs`.
11. **Verify** — run the shared gate, then measure: `du -b .next/server/app/index.html .next/server/app/index.rsc`; `grep -c '"sentences"' .next/server/app/index.html` must be 0; grep home-referenced static chunks for a sentinel sentence string from `topics.json` to confirm the dataset chunk is gone from the home graph.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/types.ts` | add `VocabItemSummary`, `TopicSummary`, `HomeData` |
| `src/lib/data-logic.ts` | add `toTopicSummary`; widen 6 signatures |
| `src/lib/data.ts` | add `homeData()` |
| `src/lib/progress-logic.ts` | widen `topicWordStatuses`, `masterySummary` |
| `src/app/page.tsx` | pass `homeData()` |
| `src/components/home-app.tsx` | prop type + import source |
| `src/components/topic-card.tsx` | prop type + import source |
| `src/components/onboarding.tsx` | widen two prop types |
| 7 client components (step 9) | `wordKey` import source only |
| `tests/home-data.test.mjs` | new |

### Proposed names and signatures

```ts
// data-logic.ts
export function toTopicSummary(topic: Topic): TopicSummary;
export function wordKey(topic: Pick<Topic, "slug">, item: Pick<VocabItem, "hanzi">): string;
export function datasetSummary(topics: Pick<TopicSummary, "items">[]): { listCount: number; wordCount: number; formattedListCount: string; formattedWordCount: string };
export function nextRecommendedTopic<T extends Pick<Topic, "slug">>(topics: T[], learnedTopics: string[]): T;
// data.ts
export function homeData(): HomeData;
// progress-logic.ts
export function topicWordStatuses(topic: Pick<TopicSummary, "slug" | "items">, flashcardStats: Record<string, FlashcardStat>, quizStats: Record<string, QuizStat>): WordStatus[];
```

### UI copy / microcopy

None — this sprint is behavior-preserving. All existing copy (hero counts, snapshot metrics, search placeholder, empty state) renders from the same values via `datasetSummary` and the summaries.

### Test plan (`tests/home-data.test.mjs`)

- `toTopicSummary` strips sentences: `assert.ok(!("sentences" in summary.items[0]))`; items keep `hanzi/pinyin/english` equal to the source.
- Field preservation: `slug`, `titleCn`, `titleEn`, `category`, `categorySlug`, `videoPath`, `video` survive; `hasPlayableVideo(toTopicSummary(t)) === hasPlayableVideo(t)` for all 102 topics.
- Coverage: 102 summaries, 1,020 summary items; `datasetSummary(summaries)` deep-equals `datasetSummary(topics)`.
- Parity: `nextRecommendedTopic(summaries, [])` returns the same `slug` as on full topics; same with a partially-learned list; `wordKey(summary, summary.items[0])` equals `wordKey(topic, topic.items[0])`.
- **Payload regression guard**: `Buffer.byteLength(JSON.stringify({categories, topics: topics.map(toTopicSummary)}))` is `< 160_000` and less than half the full dataset's serialized size (measured today: 118,127 vs 349,776).

### Manual QA checklist

- [ ] Fresh profile (clear localStorage): onboarding modal appears, "Start here" shows *Ten Types of Pets* titles in English + hanzi, both complete/skip paths work.
- [ ] Search `ni hao` and a hanzi string: diacritic-tolerant matching still works; matched-word rows show highlighted hanzi + pinyin + English.
- [ ] Category dropdown filters; "Clear filters" empty state works.
- [ ] "▶ Video" badge appears on the same cards as before (spot-check 2–3 topics against `videoPath` in `topics.json`).
- [ ] Snapshot metrics (14 categories, 102 lessons, studied/learned counts), streak chip, daily-goal ring, and Export/Import progress all behave as before.
- [ ] `/categories/animals-and-living-things` and `/path` render identical cards (they still pass full `Topic`s — must compile and render unchanged).
- [ ] DevTools Network on `/`: document size dramatically smaller; no chunk containing example sentences loads.

### Acceptance criteria

1. `.next/server/app/index.html` contains zero `"sentences"` occurrences and drops from ~707KB to ≤ ~320KB; `index.rsc` drops from ~356KB to ≤ ~160KB.
2. No static chunk referenced by the home page contains the dataset (sentinel-grep passes).
3. All five gate commands pass: `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build`.
4. Home search results, card contents, badges, onboarding, and metrics are pixel/behavior-identical.
5. `/categories/[slug]`, `/path`, and all topic pages compile and render with no changes to their data flow.

### Risk and rollback

- **Type-widening ripple**: widened signatures are strictly more permissive; `tsc` during `next build` catches any miss. The `Omit<Topic,"items">`-based `TopicSummary` keeps full `Topic` assignable, so shared consumers can't break silently.
- **Behavior drift in video badges**: avoided by keeping `videoPath`/`video` in the summary and `hasPlayableVideo` untouched.
- **No persisted-data risk**: `wordKey` output format (`slug:hanzi`) is unchanged, so localStorage `flashcardStats`/`quizStats` keys are unaffected. No schema version bump.
- **Rollback**: single revert of the sprint commit restores everything; no data migration, no service-worker or storage changes.

### Non-goals / deferrals

- `topic-app.tsx` and `path-app.tsx` still import *bound* helpers (`nextTopicAfter`, `nextRecommendedTopic`) from `@/lib/data`, so topic/path routes keep bundling the dataset — fixing that needs server-computed "next topic" props (its own sprint).
- `review`/`stats`/`practice`/`favorites` pages intentionally pass full `data` (they need sentences); `saved-lessons-panel.tsx` (offline page) imports full `data` client-side. Out of scope.
- No pagination/virtualization of the 102-card grid, no search-index precomputation, no changes to `topics.json` itself or the validators.

### Ready-to-run Opus implementation prompt

> Implement Sprint 4 ("Slim the home page payload") in `/home/nvidia/learn-10-mandarin-words`. Read `AGENTS.md` first and consult `node_modules/next/dist/docs/` before touching framework-facing code — this is Next.js 16 and conventions may differ from your training data. Do not commit, push, or deploy.
>
> Problem: `src/app/page.tsx` passes the full `data` (all of `src/data/topics.json`, including 2,040 example sentences) into the `"use client"` `HomeApp`, embedding ~350KB in the RSC payload; additionally `home-app.tsx:6` and `topic-card.tsx:3` import from `@/lib/data` (which statically imports `topics.json`), duplicating the dataset in the home client JS chunk.
>
> Changes: (1) In `src/lib/types.ts` add `VocabItemSummary = Pick<VocabItem,"hanzi"|"pinyin"|"english">`, `TopicSummary = Omit<Topic,"items"> & { items: VocabItemSummary[] }` (keeps full `Topic` structurally assignable), and `HomeData = { categories: Category[]; topics: TopicSummary[] }`. (2) In `src/lib/data-logic.ts` add pure `toTopicSummary(topic: Topic): TopicSummary` (drops `sentences`, keeps `videoPath`/`video`), widen `wordKey` to `(Pick<Topic,"slug">, Pick<VocabItem,"hanzi">)`, widen `datasetSummary` to `Pick<TopicSummary,"items">[]`, and make `getTopic`/`recommendedPath`/`nextRecommendedTopic`/`nextTopicAfter` generic over `<T extends Pick<Topic,"slug">>`. (3) In `src/lib/data.ts` add `homeData(): HomeData` built once at module scope via `toTopicSummary`. (4) Widen `topicWordStatuses` and `masterySummary` in `src/lib/progress-logic.ts` to `Pick<TopicSummary,"slug"|"items">`. (5) `src/app/page.tsx`: render `<HomeApp data={homeData()} />`. (6) `home-app.tsx`: prop type `HomeData`; import `datasetSummary, nextRecommendedTopic` from `@/lib/data-logic`; call `nextRecommendedTopic(data.topics, progress.learnedTopics)` (update `useMemo` deps). (7) `topic-card.tsx`: `topic: TopicSummary`; import `wordKey` from `@/lib/data-logic`; keep `hasPlayableVideo` usage. (8) `onboarding.tsx`: widen `firstTopic`/`nextTopic` to `Pick<Topic,"slug"|"titleEn"|"titleCn">`. (9) Switch `wordKey` imports from `@/lib/data` to `@/lib/data-logic` in `favorites-app.tsx`, `stats-app.tsx`, `phrasebook-panel.tsx`, and `topic/{match,cloze,words,typing}-panel.tsx`. Do NOT touch `topic-app.tsx`, `path-app.tsx`, `category-app.tsx`, or the review/stats/practice/favorites pages' data flow. No UI/JSX or copy changes anywhere.
>
> Add `tests/home-data.test.mjs` (follow the import style of `tests/data.test.mjs`, i.e. `../src/lib/data-logic.ts` with explicit extension): assert summaries strip `sentences` but preserve `hanzi/pinyin/english` and all topic fields; `hasPlayableVideo` parity across all 102 topics; `datasetSummary` and `nextRecommendedTopic` parity between full and slim; serialized slim home payload `< 160_000` bytes and less than half the full dataset's size.
>
> Finish with `npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build`, then verify and report: `du -b .next/server/app/index.html .next/server/app/index.rsc` (expect ≤ ~320KB / ≤ ~160KB, down from 707,398 / 356,498), `grep -c '"sentences"' .next/server/app/index.html` returns 0, and no home-referenced static chunk contains a sentence string from `topics.json`.

---

I've inspected the practice surfaces, existing keyboard handling, hook and pure-logic conventions, and test style. The repo has essentially **no keyboard shortcuts today** (only the onboarding modal's Escape/Tab trap), and a prior sprint doc explicitly deferred keyboard grading — so this sprint is greenfield but has strong local patterns to follow. Here is the plan.

---

## Sprint 5 — Keyboard shortcuts for practice

### Goal and user value

Desktop learners on `/practice` currently must mouse every interaction: click a choice, click "Next word", click the speaker icon. This sprint adds a small, discoverable shortcut set to the practice deck — **1–4** to answer, **Enter / →** to advance, **P** to pronounce, **R** to practice again — so a 10-word run can be completed hands-on-keyboard. Shortcuts are additive (every existing button keeps working), invisible on touch devices, and built on a pure, unit-tested key-mapping layer that review/quiz surfaces can adopt in later sprints.

### Current-state findings (grounded in actual files)

- **`src/components/practice-app.tsx`** is the whole `/practice` experience (`src/app/practice/page.tsx` just renders it with `data`). Relevant structure:
  - Session snapshot + run state at `practice-app.tsx:34-39` (`session`, `index`, `score`, `picked`, `missedKeys`, `done`).
  - `handleAnswer(choice)` at `:108-118` — already guards re-answer with `if (picked !== null) return`, records via `recordQuizAnswer`, tracks misses.
  - `handleNext()` at `:120-128` — advances or sets `done` and fires `track("practice_session_completed")`.
  - **Two early returns sit above the card UI**: loading at `:70-72` and the `< MIN_DECK` empty state at `:78-103`. `deck`/`current`/`handleAnswer`/`handleNext` are all derived/declared *after* these returns — any hook must be called above them, so a small reorder is required (React hooks must be unconditional).
  - Choices render as `role="option"` buttons in a `role="listbox"` grid at `:219-241`; the conditional "Next word / See results" button is at `:243-254`; completion screen with "Practice again" at `:142-189`.
- **Only existing keyboard handling in the app**: the onboarding modal's Escape + focus trap, `src/components/onboarding.tsx:48-75`, using `document.addEventListener("keydown", ...)` in a `useEffect` — the pattern to mirror.
- **Pure-logic convention**: `src/lib/gesture-logic.ts` is a DOM-free helper module with `tests/gesture-logic.test.mjs` importing it via explicit `.ts` extension under `node --test` (see also the extension note in `src/lib/quiz-logic.ts:2-6`). The new key-mapping logic should follow this exactly.
- **Hook convention**: client hooks live beside components (`src/components/use-swipe.ts`, `use-card-drag.ts`, `use-reduced-motion.ts`).
- **Speech**: `SpeakButton` (`src/components/speak-button.tsx`) owns its own `speak()`; `src/components/topic/quiz-panel.tsx:14-21` duplicates it as a module-level `speakWord()` (cancel → `zh-CN` → rate 0.85). The P shortcut needs a callable function, not a component — a small shared helper dedupes this.
- **Styling hooks**: `globals.css` has the quiet `.swipe-hint` text style at `:276` (low-ink, tiny, pointer-transparent) — the right register for shortcut hints. There is no `kbd`/keycap style yet.
- **Analytics**: `src/lib/analytics.ts:15-30` has a closed `AnalyticsEvent` union; `practice_session_completed` already exists. No new event needed.
- **Tests/validation**: `package.json` — `test: node --test`, `validate:data` / `validate:quality` via `scripts/validate-data.mjs`, `lint: eslint`, `prebuild` runs data validation. Nothing about this sprint touches vocabulary data, so the validators should pass untouched.
- **Next.js 16 note (AGENTS.md)**: this sprint is purely client-component-level (event listeners, JSX, CSS); no Next.js routing/data APIs are touched, so no framework-behavior risk — but the implementer should still skim `node_modules/next/dist/docs/` per AGENTS.md before coding.

### Exact implementation steps in sequence

1. **Create `src/lib/shortcut-logic.ts`** — pure, DOM-free key mapping (mirrors `gesture-logic.ts`):
   - `PracticePhase = "question" | "answered" | "done"`.
   - `resolvePracticeShortcut(key, ctx)` returns an intent or `null`, applying all guards (below) so the hook stays a thin adapter.
   - Guards, in order: `null` when `ctx.hasModifier` (Ctrl/Meta/Alt — never shadow browser shortcuts), when `ctx.repeat` (held-key auto-repeat must not machine-gun answers), or when `ctx.targetIsEditable` (future-proofing for reuse near text inputs, e.g. typing-panel).
   - Mapping: digits `"1"…"9"` → `{ type: "choose", index: d-1 }` only when `phase === "question"` **and** `d <= choiceCount`; `"Enter"` → `{ type: "next" }` only when `phase === "answered"` **and** `!ctx.targetIsButton` (a focused button's native Enter click would double-fire); `"ArrowRight"` → `next` when answered (safe on focused buttons, no native action); `"p"`/`"P"` → `{ type: "speak" }` when phase is `question` or `answered`; `"r"`/`"R"` → `{ type: "again" }` only when `phase === "done"`. Everything else → `null`.
2. **Create `tests/shortcut-logic.test.mjs`** covering the full matrix (see Test plan).
3. **Create `src/lib/speech.ts`** with `speakMandarin(text)`: SSR/support-guarded no-op, `speechSynthesis.cancel()`, `lang: "zh-CN"`, `rate: 0.85` — byte-for-byte the behavior of `quiz-panel.tsx`'s `speakWord`. Point `quiz-panel.tsx` at it (delete the local copy). Leave `speak-button.tsx` untouched.
4. **Create `src/components/use-practice-shortcuts.ts`** — client hook: stores the handlers object in a ref refreshed each render, attaches one `document.addEventListener("keydown")` in a mount `useEffect` (the `onboarding.tsx:73` pattern), classifies the event target (`isEditableTarget` / `isActivationTarget` DOM helpers live here, not in the pure lib), calls `resolvePracticeShortcut`, and on a match `preventDefault()`s and dispatches. A no-op when `enabled: false`.
5. **Wire into `practice-app.tsx`**:
   - Move the derivations (`entries`, `deck`, `total`, `current`, `currentEntry`) and `handleAnswer`/`handleNext` above the loading/empty early returns, null-guarding `session` inside them (mechanical reorder; no behavior change).
   - Call `usePracticeShortcuts` above the early returns with `enabled: loaded && !!session && entries.length >= MIN_DECK`, `phase` derived as `done ? "done" : picked !== null ? "answered" : "question"`, `choiceCount: current?.choices.length ?? 0`, and handlers `onChoose` (index → `handleAnswer(current.choices[i])`), `onNext: handleNext`, `onSpeak: () => speakMandarin(current.prompt)`, `onAgain: practiceAgain`.
6. **Discoverability UI** (desktop only, `hidden md:flex` / `hidden md:inline-flex` so touch users never see it):
   - Add a `.kbd` keycap style to `globals.css` (tiny mono text in a 1px `border-white/10` rounded box, low-ink — same register as `.swipe-hint`).
   - Number keycap on each choice button (leading `<kbd>` with the 1-based index).
   - One quiet hint row under the choices (copy below), swapping with phase; an `R` hint line on the completion screen.
   - Add `aria-keyshortcuts` to the real controls: `"1"`…`"4"` on choices, `"Enter"` on Next, `"r"` on Practice again.
7. Run the full gate: `npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build`.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/shortcut-logic.ts` | **new** — pure key→intent mapping |
| `tests/shortcut-logic.test.mjs` | **new** — unit tests |
| `src/components/use-practice-shortcuts.ts` | **new** — document keydown hook |
| `src/lib/speech.ts` | **new** — shared `speakMandarin` |
| `src/components/practice-app.tsx` | wire hook, reorder derivations, keycaps + hints + `aria-keyshortcuts` |
| `src/components/topic/quiz-panel.tsx` | replace local `speakWord` with `speakMandarin` import |
| `src/app/globals.css` | `.kbd` keycap style (+ optional `.key-hint` row style) |

### Proposed names and TypeScript signatures

```ts
// src/lib/shortcut-logic.ts  (pure, DOM-free — unit-testable under node --test)
export type PracticePhase = "question" | "answered" | "done";

export type PracticeShortcut =
  | { type: "choose"; index: number }   // 0-based choice index
  | { type: "next" }
  | { type: "speak" }
  | { type: "again" };

export type ShortcutContext = {
  phase: PracticePhase;
  choiceCount: number;       // digits above this are ignored
  hasModifier: boolean;      // ctrlKey || metaKey || altKey
  repeat: boolean;           // KeyboardEvent.repeat
  targetIsEditable: boolean; // input/textarea/select/contenteditable
  targetIsButton: boolean;   // button/a — blocks Enter to avoid double-fire
};

export function resolvePracticeShortcut(
  key: string,
  ctx: ShortcutContext,
): PracticeShortcut | null;
```

```ts
// src/components/use-practice-shortcuts.ts  ("use client")
export type PracticeShortcutHandlers = {
  enabled: boolean;
  phase: PracticePhase;
  choiceCount: number;
  onChoose: (index: number) => void;
  onNext: () => void;
  onSpeak: () => void;
  onAgain: () => void;
};
export function usePracticeShortcuts(handlers: PracticeShortcutHandlers): void;

// module-private DOM classifiers, exported only if needed elsewhere later:
function isEditableTarget(el: EventTarget | null): boolean;
function isActivationTarget(el: EventTarget | null): boolean; // button | a
```

```ts
// src/lib/speech.ts
/** Speak Mandarin text (zh-CN, rate 0.85); no-op without speechSynthesis. */
export function speakMandarin(text: string): void;
```

### UI copy / microcopy

- Hint row while answering (question phase): `1–4 choose · P pronounce`
- Hint row after answering: `Enter next · P pronounce`
- Completion screen hint: `Press R to practice again`
- Keycaps: literal `1` `2` `3` `4`, `Enter`, `P`, `R` in `<kbd>` elements; hint rows marked `aria-hidden="true"` (screen-reader users get `aria-keyshortcuts` on the real buttons instead).

### Test plan

All in `tests/shortcut-logic.test.mjs` (node:test + `assert/strict`, importing `../src/lib/shortcut-logic.ts`), with a `baseCtx` helper and overrides:

1. Digits map to 0-based `choose` in question phase: `"1"` → index 0, `"4"` → index 3.
2. Digits beyond `choiceCount` return null (`"4"` with `choiceCount: 3`; `"9"` with 4).
3. Digits return null in `answered` and `done` phases.
4. `"Enter"` and `"ArrowRight"` → `next` only in `answered`; null in `question`/`done`.
5. `"Enter"` with `targetIsButton: true` → null; `"ArrowRight"` with `targetIsButton: true` → still `next`.
6. `"p"` and `"P"` → `speak` in `question` and `answered`; null in `done`.
7. `"r"` and `"R"` → `again` only in `done`.
8. Universal guards: any bound key with `hasModifier`, `repeat`, or `targetIsEditable` → null.
9. Unbound keys (`"a"`, `"0"`, `"Escape"`, `" "`) → null in every phase.

Existing suites (`practice-logic`, `quiz-logic`, etc.) must stay green — this sprint doesn't touch their inputs.

### Manual QA checklist

- [ ] Desktop `/practice` with quiz history: press `2` → second choice locks in with correct/wrong animation; further digits do nothing.
- [ ] `Enter` advances; on the last card it shows results; pressing `Enter` again on the summary does **nothing** (no accidental restart); `R` starts a new run.
- [ ] `→` also advances after answering.
- [ ] `P` pronounces the current hanzi (device with a Chinese voice); silently no-ops without one.
- [ ] Tab focus onto a choice button, press `Enter` → answers **once** (native click only, no double-fire); Tab onto "Next word", `Enter` → advances once.
- [ ] Ctrl/Cmd+1…9 (browser tab switching) and Cmd+R still work — never intercepted.
- [ ] Holding `1` down does not answer-and-advance through cards (repeat guard).
- [ ] Keycaps and hint rows invisible below `md`; visible and quiet (low-ink) on desktop.
- [ ] Loading and "Not enough quiz history" states: keys do nothing, no console errors.
- [ ] Quiz tab on a topic page: listening-mode audio still plays (quiz-panel refactor regression check).
- [ ] `prefers-reduced-motion`: keyboard answering shows the same non-animated feedback as clicking.

### Acceptance criteria

1. On `/practice`, a full session is completable with keyboard only: digits answer, Enter/→ advance, R restarts; every prior mouse/touch path is unchanged.
2. No double-activation exists for any focus position, and no modifier-key browser shortcut is shadowed.
3. Shortcut hints render on `md+` only, styled consistently with the app's low-ink hint language; choice buttons expose `aria-keyshortcuts`.
4. `resolvePracticeShortcut` is fully covered by the new unit tests; the whole gate passes: `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build`.
5. No localStorage schema, vocabulary data, or analytics changes.

### Risk and rollback notes

- **Double-fire on Enter** is the main correctness risk (native button click + global handler). Mitigated by the `targetIsButton` guard, unit-tested, and explicitly in QA. 
- **Hook-order reorder** in `practice-app.tsx` (moving derivations above early returns) is the only edit to existing behavior-bearing code — it's mechanical, but review the diff carefully; the session-snapshot pattern at `:53-55` must stay untouched.
- **quiz-panel refactor** is a pure dedupe; if anything smells off, ship the sprint without it (keep `speakWord` local) — it's independent.
- **Rollback**: the feature is additive with no persisted state — reverting the single sprint commit restores today's behavior exactly; user progress in localStorage is unaffected either way.

### Non-goals / deferrals

- Keyboard grading on `/review` (Space to reveal, 1–4 for Again/Hard/Good/Easy on the `review-app.tsx:379-414` grade bar) — the shortcut lib is designed for this, but it's a separate sprint.
- Shortcuts for the topic-page Quiz/Flashcards/Match/Typing tabs.
- A "?"-triggered shortcut help overlay, customizable bindings, Space as an advance key (page-scroll conflict), and any new analytics event.
- Refactoring `speak-button.tsx` onto `speech.ts`.

### Ready-to-run Opus implementation prompt for Sprint 5

> Implement Sprint 5 ("Keyboard shortcuts for practice") in `/home/nvidia/learn-10-mandarin-words`. Read `AGENTS.md` first — this is Next.js 16; consult `node_modules/next/dist/docs/` if any framework question arises (none is expected: this sprint is client-component-only).
>
> 1. Add `src/lib/shortcut-logic.ts` (pure, DOM-free, modeled on `src/lib/gesture-logic.ts`): export `PracticePhase = "question" | "answered" | "done"`; `PracticeShortcut` union `{type:"choose";index:number} | {type:"next"} | {type:"speak"} | {type:"again"}`; `ShortcutContext` `{phase, choiceCount, hasModifier, repeat, targetIsEditable, targetIsButton}`; and `resolvePracticeShortcut(key, ctx)`. Guards first: return null on `hasModifier`, `repeat`, or `targetIsEditable`. Mapping: digits "1"–"9" → choose (0-based) only in phase "question" and only when the digit ≤ choiceCount; "Enter" → next only in "answered" and only when `!targetIsButton`; "ArrowRight" → next in "answered" (allowed on buttons); "p"/"P" → speak in "question"/"answered"; "r"/"R" → again only in "done"; anything else null.
> 2. Add `tests/shortcut-logic.test.mjs` (node:test + assert/strict, import `../src/lib/shortcut-logic.ts` with the explicit `.ts` extension like `tests/gesture-logic.test.mjs`) covering: digit→index mapping, choiceCount bound, phase gating for every intent, Enter-on-button null vs ArrowRight-on-button next, p/P and r/R case-insensitivity, modifier/repeat/editable guards, and unbound keys ("a", "0", "Escape", " ").
> 3. Add `src/lib/speech.ts` exporting `speakMandarin(text: string): void` — guard `typeof window === "undefined" || !("speechSynthesis" in window)`, then cancel + speak a `zh-CN` utterance at rate 0.85 (identical to `speakWord` in `src/components/topic/quiz-panel.tsx:14-21`). Replace quiz-panel's local `speakWord` with this import; do NOT touch `src/components/speak-button.tsx`.
> 4. Add `src/components/use-practice-shortcuts.ts` ("use client"): `usePracticeShortcuts(handlers)` where handlers = `{enabled, phase, choiceCount, onChoose, onNext, onSpeak, onAgain}`. Keep the latest handlers in a ref updated each render; attach ONE `document.addEventListener("keydown", ...)` in a mount-time `useEffect` with cleanup (pattern: `src/components/onboarding.tsx:48-75`). In the listener: bail if `!ref.current.enabled`; build `ShortcutContext` from the event (`hasModifier = ctrlKey||metaKey||altKey`, `repeat`, plus module-private `isEditableTarget` — input/textarea/select/isContentEditable — and `isActivationTarget` — button/a — checked against `e.target`); call `resolvePracticeShortcut(e.key, ctx)`; on a match `e.preventDefault()` and dispatch to the matching handler.
> 5. Wire into `src/components/practice-app.tsx`: move the `entries/deck/total/current/currentEntry` derivations and `handleAnswer`/`handleNext` above the loading (`:70-72`) and empty-state (`:78-103`) early returns, null-guarding `session` inside them — do NOT alter the session-snapshot seeding at `:53-55` or any answer/scoring semantics. Call `usePracticeShortcuts` above the early returns with `enabled: loaded && !!session && entries.length >= MIN_DECK`, `phase: done ? "done" : picked !== null ? "answered" : "question"`, `choiceCount: current?.choices.length ?? 0`, `onChoose: i => { const c = current?.choices[i]; if (c) handleAnswer(c); }`, `onNext: handleNext`, `onSpeak: () => current && speakMandarin(current.prompt)`, `onAgain: practiceAgain`.
> 6. Discoverability (desktop-only, hidden below `md`): add a low-ink `.kbd` keycap style to `src/app/globals.css` (tiny text, 1px white/10 border, rounded, in the same quiet register as `.swipe-hint` at `:276`); render a `hidden md:inline-flex` `<kbd>` with the 1-based number inside each choice button; add one `hidden md:flex` `aria-hidden="true"` hint row under the choices — `1–4 choose · P pronounce` before answering, `Enter next · P pronounce` after; on the completion screen add a quiet `Press R to practice again` hint. Add `aria-keyshortcuts` ("1"–"4" on choices, "Enter" on the Next button, "r" on Practice again).
> 7. Constraints: no new dependencies, no localStorage schema changes, no vocabulary/data edits, no new analytics events, no shortcuts on `/review` or topic tabs. Do not commit, push, or deploy.
> 8. Finish with `npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build`, report the results, and flag the manual QA items that need a real browser: Enter double-fire check with focus on a choice/Next button, Ctrl/Cmd+digit tab switching untouched, held-key repeat guard, P audio, and hint visibility across breakpoints.

---

I have the full picture now. Here's the grounded plan.

---

## Sprint 6 — Make saved-offline lessons fully work offline

### Goal and user value

A learner who taps **⬇ Save for offline** on a lesson today gets the MP4 cached — but the *lesson experience* around it isn't guaranteed to work without a connection. The saved-lessons list on `/offline` doesn't link back to lessons, the lesson page's JS/CSS is only cached opportunistically, in-app (client-side) navigation to a lesson can fail offline because Next's RSC payload fetches bypass the service worker's caches, and nothing in the library tells you which lessons are playable offline. This sprint closes the loop: **save a lesson → later, fully offline, find it, open it, watch it (with seeking), and practice its words** — with clear UI signals about what's available. This matters for the app's core promise (local-first study, e.g., learning on a flight or subway) with no backend and no new services.

### Current-state findings (grounded in actual files)

**What already works:**

- `src/lib/offline.ts` — complete save/remove/list/size API over Cache Storage. `saveLessonOffline()` fetches the MP4 with `mode: "cors"`, rejects opaque/non-OK responses, stores it in the dedicated `learn10-videos-v1` cache (`VIDEO_CACHE`, line 20), and best-effort co-caches the lesson page HTML into the app-shell cache `learn10-v1` via `cachePageShell()` (lines 150–165). Dependency-injectable (`OfflineDeps`) for unit tests.
- `public/sw.js` — conservative shell SW: precaches `/`, `/review`, `/favorites`, `/privacy`, `/offline`, `/icon.svg` (line 32); navigations are network-first with cached-page → `/offline` fallback (lines 159–172); `/_next/static` + font/css/js/svg assets are stale-while-revalidate (lines 175–190); media is served from `VIDEO_CACHE` with full HTTP Range support (`parseRange`/`buildRangeResponse`, lines 76–126) and otherwise passes through — the SW never writes to the video cache. Activate cleanup preserves `VIDEO_CACHE` across cache-version bumps (lines 44–57).
- `src/components/save-offline-button.tsx` — save/remove UI on the lesson page, rendered from `topic-app.tsx:302` with `pageUrl={`/topics/${topic.slug}`}`; hidden when Cache Storage is unsupported; friendly error copy already exists.
- `src/components/saved-lessons-panel.tsx` — lists saved lessons on `/offline` with sizes and Remove; maps MP4 URLs back to topic titles via `downloadableMp4Url()` from `src/lib/video.ts:59`.
- `src/components/pwa-register.tsx` — registers `/sw.js` **in production only** (line 18).
- Tests: `tests/offline.test.mjs` (12 tests over the page-side helpers with fake caches/fetch) and `tests/sw-policy.test.mjs` (12 tests that read the real `sw.js` source, execute it in a stubbed SW scope, and enforce the "never auto-cache the 100 GitHub-Release MP4s" policy).
- Data reality: 102 topics, **100 with `video.provider === "mp4"`** hosted cross-origin on GitHub Releases; **zero posters, zero captions** in `src/data/topics.json` — so poster/caption caching is a non-issue this sprint.

**The gaps (why saved lessons don't "fully" work offline):**

1. **No path back to a saved lesson.** `saved-lessons-panel.tsx` computes `slug` in `describeUrl()` (lines 23–36) but renders only a title and a Remove button — there is no "Open lesson" link. Offline, the one page that lists your saved lessons is a dead end.
2. **Client-side navigation breaks offline.** All lesson links (`topic-card.tsx:54`, bottom nav, footer) are `next/link`. In the App Router, a `<Link>` navigation fetches an RSC payload (same-origin GET with the `_rsc` search param / `RSC: 1` header). In `sw.js` that request is neither a navigation, a static asset, nor media — so the SW never caches or serves it, and offline the fetch fails. Next falls back to a hard navigation on a failed RSC fetch, but that behavior is an internal detail and the current SW leaves the RSC layer entirely to chance. (Per `AGENTS.md`, this must be verified against `node_modules/next/dist/docs/` — the local PWA guide is `01-app/02-guides/progressive-web-apps.md`, which confirms the plain `public/sw.js` approach used here.)
3. **The lesson page shell is only half-cached at save time.** `cachePageShell()` stores just the HTML document. The `/_next/static` chunks needed to hydrate `TopicApp` are cached only via stale-while-revalidate *if* the SW controlled the page when they loaded — not true on the visit during which the SW first installs (registration happens on `load`, `pwa-register.tsx:20–24`), and not guaranteed to cover deferred chunks. A saved lesson can therefore render as dead HTML offline.
4. **No offline visibility in the library.** `topic-card.tsx` shows a "▶ Video" chip but nothing indicates a lesson is saved offline; there's no online/offline indicator anywhere; `/offline` is reachable only when a navigation fails (no in-app link), so saved-lesson management is effectively hidden.

### Exact implementation steps in sequence

1. **Read the local Next 16 guides first** (per `AGENTS.md`): `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`, plus the `next/link`/routing docs to confirm prefetch (`_rsc`) request shape and the router's behavior when an RSC fetch rejects. Adjust step 3's details only if the docs contradict them.

2. **`src/lib/offline.ts` — cache the full page shell at save time.**
   - Add pure helper `extractShellAssetUrls(html)` that pulls same-origin asset URLs out of the page HTML: `src`/`href` values matching `/_next/static/...` (and `.css`) from `<script>`/`<link>` tags. Regex-based, no DOM, so it's unit-testable in `node --test`.
   - Extend `cachePageShell()` to, after caching the HTML: parse it with `extractShellAssetUrls()`, fetch each asset (skip ones already in `APP_CACHE` via `cache.match`), and `put()` successful `res.ok && res.type === "basic"` responses into `APP_CACHE`. Every asset failure is non-fatal (same best-effort contract as today; `saveLessonOffline` still never rejects because of shell caching).
   - Keep `saveLessonOffline`'s public signature unchanged.

3. **`public/sw.js` — handle RSC payload requests.**
   - Add `isRscRequest(request, url)`: same-origin GET with `url.searchParams.has("_rsc")` or an `RSC` request header.
   - In the fetch handler (before the static-asset branch): network-first, `put()` successful responses into `CACHE`, fall back to `caches.match(request.url)` (match ignoring search via `{ ignoreSearch: false }` — key by full URL; cache misses **reject** rather than returning a synthetic error response, so the Next router's hard-navigation fallback kicks in and the cached HTML from the navigation handler serves the page).
   - Do not touch the media policy, precache list, or cache names. No `CACHE_VERSION` bump needed (no stale-format entries).
   - Update the strategy comment block at the top of `sw.js` to document the new RSC rule.

4. **`src/components/use-saved-lessons.ts` (new) — shared saved-state hook.**
   - `useSavedLessons()` returns the set of saved MP4 URLs, loading once on mount via `listSavedLessons()` (browser-only, same effect pattern as `save-offline-button.tsx:37–58`), and re-loading when a module-level custom event fires.
   - Export `notifySavedLessonsChanged()` that dispatches `new CustomEvent("learn10:saved-lessons-changed")` on `window`; call it from `SaveOfflineButton.onSave/onRemove` and `SavedLessonsPanel.onRemove` so every surface stays in sync.

5. **`src/components/use-online-status.ts` (new).** `useOnlineStatus()` — `true` during SSR/first render (avoids hydration mismatch), then tracks `navigator.onLine` with `online`/`offline` listeners.

6. **`src/components/saved-lessons-panel.tsx` — make rows openable.** When `lesson.slug` is non-null, render the title as a plain `<a href={`/topics/${slug}`}>` (deliberately **not** `next/link`: a hard navigation is guaranteed to hit the SW's navigation handler and cached HTML offline — leave a comment saying so) with an "Open lesson →" affordance. Fire `notifySavedLessonsChanged()` after removal.

7. **`src/components/topic-card.tsx` — saved-offline chip.** Add optional `savedOffline?: boolean` prop; when true render a quiet chip alongside "▶ Video" (same neutral styling as the existing chips, `topic-card.tsx:66–86`): `⬇ Offline` with `title="Saved for offline playback"`.

8. **Wire the chip + offline banner into the grids.**
   - `home-app.tsx`: call `useSavedLessons()` + `useOnlineStatus()`; pass `savedOffline={saved.has(downloadableMp4Url(topic) ?? "")}` to each `TopicCard` (home-app.tsx:291); when offline, show a slim dismissible-free banner above the grid (copy below). Add an "Offline" link to the footer link row (home-app.tsx:310–315) pointing at `/offline`.
   - `category-app.tsx:53` and `path-app.tsx:97`: pass the same `savedOffline` prop (both already render `TopicCard`).

9. **`src/app/offline/page.tsx` — from dead-end to hub.** Since it's now linked from the footer (and reachable online), soften the static copy: heading becomes "Offline & saved lessons", and add a small client `<OnlineStatusNotice />` (new, in the same file's component dir) that renders the "You're offline" state only when actually offline. Keep the existing "What works offline" honesty section and `SavedLessonsPanel`.

10. **`src/lib/analytics.ts`**: add `"saved_lesson_opened_offline"` to `AnalyticsEvent` only if a natural tracking point exists (the panel link is an `<a>`, so skip if it would need extra plumbing — existing `lesson_saved_offline`/`lesson_removed_offline` events already cover the funnel; note that these two need adding to the union if not present).

11. **Tests** (see Test plan), then run the full validation gate.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/offline.ts` | `extractShellAssetUrls`, asset co-caching in `cachePageShell` |
| `public/sw.js` | RSC payload handling + doc comment |
| `src/components/saved-lessons-panel.tsx` | Open-lesson links, change notification |
| `src/components/save-offline-button.tsx` | fire `notifySavedLessonsChanged()` |
| `src/components/use-saved-lessons.ts` | new hook |
| `src/components/use-online-status.ts` | new hook |
| `src/components/topic-card.tsx` | `savedOffline` chip |
| `src/components/home-app.tsx` | wire hooks, offline banner, footer link |
| `src/components/category-app.tsx`, `src/components/path-app.tsx` | pass `savedOffline` |
| `src/app/offline/page.tsx` (+ small client notice component) | hub copy, `OnlineStatusNotice` |
| `tests/offline.test.mjs`, `tests/sw-policy.test.mjs` | new coverage |

### Proposed names and signatures

```ts
// src/lib/offline.ts
export function extractShellAssetUrls(html: string): string[];
// cachePageShell stays private; saveLessonOffline(source, options) unchanged.

// src/components/use-saved-lessons.ts
export const SAVED_LESSONS_EVENT = "learn10:saved-lessons-changed";
export function notifySavedLessonsChanged(): void;
export function useSavedLessons(): ReadonlySet<string>; // saved MP4 URLs

// src/components/use-online-status.ts
export function useOnlineStatus(): boolean; // true during SSR

// src/components/topic-card.tsx
savedOffline?: boolean; // added to TopicCard props

// src/app/offline/ (client)
export function OnlineStatusNotice(): React.ReactNode;
```

```js
// public/sw.js
function isRscRequest(request, url) { /* same-origin GET + _rsc param or RSC header */ }
async function serveRsc(request) { /* network-first → CACHE fallback → reject */ }
```

### UI copy / microcopy

- Topic-card chip: `⬇ Offline` (title tooltip: “Saved for offline playback”).
- Home offline banner: **“You’re offline.”** “Lessons marked ⬇ Offline are ready to watch, and your words and progress always work without a connection.”
- Saved-lessons panel row link: “Open lesson →”; panel heading stays “Saved for offline · {size}”.
- `/offline` heading (online state): “Offline & saved lessons”; offline notice: “You’re offline right now — everything below works without a connection.”
- Footer link: “Offline”.
- Existing save-button copy (“⬇ Save for offline”, “✓ Saved offline · 12 MB”, error strings in `offline.ts`) is good — don’t change it.

### Test plan

All via `node --test` (no DOM), consistent with the existing suites:

- `tests/offline.test.mjs`:
  - `extractShellAssetUrls` pulls `/_next/static` script/link URLs from sample HTML, ignores cross-origin/`data:`/inline, dedupes.
  - Saving with `pageUrl` caches the HTML **and** its referenced assets into `APP_CACHE` (fake fetch returns HTML referencing two assets; assert both `put` into the fake cache).
  - Asset fetch failure doesn’t reject the save; already-cached assets aren’t re-fetched.
- `tests/sw-policy.test.mjs` (executes real `sw.js` in the stubbed scope):
  - An `_rsc` request is served network-first and cached into `CACHE` on success.
  - Offline (fetch rejects), a previously cached `_rsc` response is served; with no cache entry, `respondWith` rejects (no synthetic 200).
  - RSC handling never touches `VIDEO_CACHE`; existing media-policy tests still pass unchanged (media URLs with `_rsc`-like params still route to `serveMedia`).
- Existing 24 tests must pass untouched.

### Manual QA checklist

Production build required (`pwa-register.tsx` registers the SW only in production): `npm run build && npm start`.

1. Load `/`, open a lesson with a video, reload once (lets the SW take control), tap “⬇ Save for offline”, confirm “✓ Saved offline · {size}”.
2. DevTools → Application → Cache Storage: `learn10-videos-v1` has the MP4; `learn10-v1` has `/topics/{slug}` and its `/_next/static` assets.
3. DevTools → Network → Offline: hard-reload the lesson page — it renders and the video **plays**, and seeking works (Range 206s in the SW).
4. Still offline: navigate Home → tap the saved lesson’s card (client nav) — the lesson opens (hard-nav fallback acceptable); tapping an unsaved lesson lands on the offline fallback rather than a broken screen.
5. Still offline: home shows the offline banner; the saved lesson’s card shows `⬇ Offline`; `/offline` (via footer link) lists the lesson with a working “Open lesson →”.
6. Back online: banner disappears; Remove on `/offline` clears the entry, chip disappears from the card without a reload (custom event), and Cache Storage no longer contains the MP4.
7. Check flashcards/quiz/tone practice on the saved lesson while offline (localStorage progress must keep working) and confirm no console errors.
8. Sanity-check on a Chromium mobile viewport + Safari if available (Range behavior differs most on Safari).

### Acceptance criteria

- A lesson saved while online is fully usable offline: page renders, video plays with seeking, practice modes work, progress records.
- Saved lessons are discoverable offline: library chip, offline banner, footer-linked `/offline` hub with open links.
- The SW still never auto-caches media (all `sw-policy` invariants hold); saving remains strictly user-initiated.
- Save/remove state stays consistent across button, cards, and panel without reloads.
- `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build` all pass.

### Risk and rollback notes

- **RSC internals**: the `_rsc` param is a Next implementation detail and could change across versions — the handler is written defensively (network-first; rejection on miss preserves Next’s own fallback), and the AGENTS.md doc-check is step 1. Worst case offline client-nav degrades to today’s behavior, never worse.
- **Cache growth**: shell-asset co-caching adds tens of small files per saved lesson into `learn10-v1`; bounded and evicted on any future `CACHE_VERSION` bump (which deliberately preserves `learn10-videos-v1`).
- **Range slicing memory**: `buildRangeResponse` buffers the whole MP4 (`sw.js:106`) — pre-existing, acceptable for short lessons; note only.
- **Rollback**: single revert of the sprint commit. No storage format changes, so no migration; optionally bump `CACHE_VERSION` to purge co-cached shell assets. Saved videos remain valid or removable via existing UI either way.

### Non-goals / deferrals

- No bulk “save all” / precaching of the 100 GitHub-Release MP4s (explicitly guarded against by `sw-policy` tests).
- No background sync, persistent-storage permission prompts, or storage-quota dashboards beyond the existing per-lesson sizes.
- No poster/caption caching (dataset has none) and no YouTube offline (impossible; all 100 videos are MP4 anyway).
- No Serwist/Workbox migration — the hand-rolled `sw.js` stays (matches the local Next PWA guide).
- No changes to vocabulary data, video URLs, or progress schema.

### Ready-to-run Opus implementation prompt for Sprint 6

```text
You are implementing Sprint 6 of the "Learn 10 Mandarin Words" app (Next.js 16 / React 19 / Tailwind 4, static, local-first, no backend): make saved-offline lessons FULLY work offline.

FIRST: read AGENTS.md, then node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md and the routing/next-link guide — this Next 16 may differ from your training data. Also read, before editing: src/lib/offline.ts, public/sw.js, src/components/save-offline-button.tsx, src/components/saved-lessons-panel.tsx, src/components/topic-card.tsx, src/components/home-app.tsx, src/app/offline/page.tsx, tests/offline.test.mjs, tests/sw-policy.test.mjs.

Context: users can already save a lesson MP4 (100 topics, GitHub-Releases-hosted, cross-origin) into the dedicated Cache Storage bucket learn10-videos-v1, and public/sw.js serves it with Range support. Gaps: (1) the saved-lessons panel on /offline lists lessons but has no link to open them; (2) Next App Router client navigations fetch RSC payloads (_rsc param) the SW neither caches nor handles, so offline in-app navigation fails; (3) saveLessonOffline co-caches only the page HTML, not its /_next/static assets, so a saved lesson page may not hydrate offline; (4) no UI shows which lessons are saved offline or that you're offline.

Implement, in this order:
1. src/lib/offline.ts: add pure `extractShellAssetUrls(html: string): string[]` (regex over script src / link href, same-origin /_next/static + .css only, deduped). Extend the private cachePageShell to also fetch and cache those assets into APP_CACHE (skip already-cached; only res.ok && type === "basic"; every failure non-fatal). Do NOT change saveLessonOffline's public signature or its video-cache behavior.
2. public/sw.js: add RSC payload handling — same-origin GET with an `_rsc` search param (or RSC header): network-first, cache successful responses into CACHE keyed by full URL, fall back to cache offline, and REJECT (not synthesize a response) on total miss so Next's hard-navigation fallback takes over. Do not touch the media policy, PRECACHE_URLS, cache names, or Range logic. Update the top-of-file strategy comment.
3. New src/components/use-saved-lessons.ts: `SAVED_LESSONS_EVENT = "learn10:saved-lessons-changed"`, `notifySavedLessonsChanged(): void`, `useSavedLessons(): ReadonlySet<string>` (loads via listSavedLessons() in a mount effect — follow the feature-detection effect pattern in save-offline-button.tsx — and reloads on the event). New src/components/use-online-status.ts: `useOnlineStatus(): boolean`, true during SSR, then navigator.onLine + online/offline listeners.
4. save-offline-button.tsx and saved-lessons-panel.tsx: call notifySavedLessonsChanged() after successful save/remove.
5. saved-lessons-panel.tsx: when a row has a slug, make the title a plain <a href={`/topics/${slug}`}> with "Open lesson →" (plain anchor on purpose — hard navigation guarantees the SW's cached-HTML path offline; leave a comment). Keep Remove.
6. topic-card.tsx: optional `savedOffline?: boolean` prop → quiet neutral chip `⬇ Offline` (title "Saved for offline playback") next to the ▶ Video chip, matching existing chip styling.
7. home-app.tsx: wire both hooks; compute savedOffline per card via downloadableMp4Url(topic); when offline show a slim banner above the grid: heading "You're offline." body "Lessons marked ⬇ Offline are ready to watch, and your words and progress always work without a connection."; add an "Offline" link to the footer link row (→ /offline). Pass savedOffline through category-app.tsx and path-app.tsx TopicCard call sites too.
8. src/app/offline/page.tsx: retitle to "Offline & saved lessons" (it's now footer-linked and reachable online); add a small client OnlineStatusNotice component that shows "You're offline right now — everything below works without a connection." only when offline. Keep the existing honesty list and SavedLessonsPanel.
9. Tests: extend tests/offline.test.mjs (extractShellAssetUrls extraction/dedup/cross-origin cases; save co-caches HTML + assets; asset failure never rejects the save) and tests/sw-policy.test.mjs (RSC request network-first + cached; offline cache fallback; rejection on miss; VIDEO_CACHE untouched; all existing invariants unchanged).

Constraints: no new packages, no backend/login/analytics providers, keep saving strictly user-initiated (the SW must never write to learn10-videos-v1), keep pinyin/Mandarin content untouched, keep the sleek dark UI conventions (rounded-full chips, emerald accents, min-h-[44px] targets), match surrounding comment style. Note the SW only registers in production builds — verify manually with `npm run build && npm start` + DevTools offline mode (save a lesson, go offline, reload, play + seek the video, navigate from home, check the ⬇ Offline chip, banner, and /offline links).

Validation gate — ALL must pass before you're done:
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build
```

---

# Sprint 7 — SEO pack

## Goal and user value

Make Learn 10 Mandarin Words discoverable and shareable: every one of the 100+ statically generated pages gets a canonical URL, rich per-page metadata, Open Graph/Twitter cards with a generated share image, a sitemap, robots rules, and JSON-LD structured data — all derived from `src/data/topics.json`, with zero backend, zero new dependencies, and zero invented content. Learners searching "ten types of pets in Mandarin" can land directly on the right topic page, and shared links render a proper preview card instead of a bare URL.

## Current-state findings (grounded in actual files)

- **Root metadata is minimal.** `src/app/layout.tsx:24-41` exports `metadata` with `title` (plain string, no template), `description`, `applicationName`, `manifest`, `appleWebApp`, and `icons`. There is **no `metadataBase`, no `openGraph`, no `twitter`, no canonical/`alternates`** anywhere in the app. Without `metadataBase`, any relative OG URL would be a build error per `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md:428`.
- **No robots or sitemap exists.** Nothing in `src/app/` (no `robots.ts`/`sitemap.ts`) and nothing in `public/` (checked: only svgs, `sw.js`, icons). Next 16 still supports the `app/robots.ts` and `app/sitemap.ts` conventions returning `MetadataRoute.Robots` / `MetadataRoute.Sitemap` (confirmed in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/robots.md` and `sitemap.md` — both are cached/static unless they use request-time APIs).
- **No OG image asset exists.** `public/` has only `icon.svg`, `icon-maskable.svg`, and stock svgs; SVG is not a valid OG image format. Next 16 supports `opengraph-image.tsx` with `ImageResponse` from `next/og` (`.../01-metadata/opengraph-image.md`). Note: the bundled default font is Latin-only, so OG image text must be English/pinyin, not hanzi.
- **Routes and their metadata today:**
  - `/` — `src/app/page.tsx` exports **no metadata**, inherits layout defaults.
  - `/topics/[slug]` (102 pages) — `src/app/topics/[slug]/page.tsx:9-17` has `generateMetadata` returning title + a description built from `topic.titleCn` **with no pinyin and no English gloss**, and no OG/canonical.
  - `/categories/[slug]` (14 pages) — `src/app/categories/[slug]/page.tsx:9-17`, same shape.
  - `/path`, `/practice`, `/review`, `/stats`, `/favorites`, `/privacy`, `/offline` — each exports static `metadata` that **hardcodes the `"X | Learn 10 Mandarin Words"` suffix** (e.g. `src/app/stats/page.tsx:5-9`), duplicating what a layout title template should do.
  - `/offline` (`src/app/offline/page.tsx`) is a SW fallback shell — it should be `noindex` and excluded from the sitemap.
- **Data helpers ready to reuse.** `src/lib/data.ts` exposes `data`, `getTopic`, `getCategory`, `topicsForCategory`, and `datasetSummary` (`src/lib/data-logic.ts:47-57`, returns `listCount`, `wordCount`, formatted variants) — descriptions and JSON-LD can be fully derived, no invented numbers. `Topic` carries `slug/titleCn/titleEn/category/categorySlug/items[{hanzi,pinyin,english}]` (`src/lib/types.ts:37-47`).
- **Canonical domain is not recorded anywhere.** `.vercel/project.json` gives only `projectName: "learn-10-mandarin-words"`; `README.md` references only localhost. The site URL must come from `NEXT_PUBLIC_SITE_URL` with a fallback of `https://learn-10-mandarin-words.vercel.app` (derived from the Vercel project name — flagged below as needing confirmation).
- **Manifest is already solid.** `src/app/manifest.ts` serves `/manifest.webmanifest` with name/icons/theme; no SEO work needed there.
- **Test harness runs TS directly.** Tests are `node --test` `.mjs` files importing `../src/lib/*.ts` via Node 24 type stripping (e.g. `tests/data.test.mjs:19`), so new pure SEO helpers in `src/lib/seo.ts` — and even `src/app/sitemap.ts`/`robots.ts` — are directly unit-testable.
- **Service worker is unaffected.** `public/sw.js` precaches only app-shell pages; crawlers don't run the SW, so `robots.txt`/`sitemap.xml` need no cache policy changes.

## Exact implementation steps in sequence

1. **Create `src/lib/seo.ts`** — single source of truth for site identity and pure metadata builders (signatures below). `SITE_URL` reads `process.env.NEXT_PUBLIC_SITE_URL`, strips any trailing slash, falls back to `https://learn-10-mandarin-words.vercel.app`. All description builders derive text from `Topic`/`Category` data only. Include a `jsonLdScriptProps` serializer that escapes `<` as `\u003c` to prevent script injection through data.
2. **Write `tests/seo.test.mjs` first** (project convention is tests-first per `docs/ui-practice-micro-sprints-implementation-plan.md`): absolute-URL joining, description content (pinyin present alongside hanzi), JSON-LD shape and escaping, sitemap completeness (see Test plan).
3. **Upgrade `src/app/layout.tsx` metadata**: add `metadataBase: new URL(SITE_URL)`, convert `title` to `{ default: "Learn 10 Mandarin Words", template: "%s | Learn 10 Mandarin Words" }`, add `openGraph` (siteName, `type: "website"`, `locale: "en_US"`, url `/`) and `twitter: { card: "summary_large_image" }`, keep existing icons/manifest/appleWebApp untouched.
4. **De-duplicate static page titles**: in `path`, `practice`, `review`, `stats`, `favorites`, `privacy`, `offline` pages, drop the hardcoded `" | Learn 10 Mandarin Words"` suffix (the template now appends it) and add `alternates: { canonical: "/<route>" }`. Add `robots: { index: false, follow: false }` to `/offline` only.
5. **Add home page metadata**: `src/app/page.tsx` gets a `metadata` export with canonical `/` and a description using `datasetSummary()` counts (e.g. "102 topics, 1,020+ words" — computed, not hardcoded).
6. **Enrich `generateMetadata` in `src/app/topics/[slug]/page.tsx`**: use `topicMetaDescription(topic)` (includes `titleCn` plus a sample like "狗 gǒu (dog), 猫 māo (cat)" — hanzi always paired with pinyin), canonical `/topics/${slug}`, and `openGraph: { title, description, url }`. Same pattern for `src/app/categories/[slug]/page.tsx` with `categoryMetaDescription(category, topics)` (topic count + example topic titles).
7. **Create `src/app/robots.ts`**: allow all user agents on `/`, disallow `/offline`, and point at `${SITE_URL}/sitemap.xml`.
8. **Create `src/app/sitemap.ts`**: return home (priority 1), `/path` `/practice` (0.8), all 14 `/categories/[slug]` (0.8), all 102 `/topics/[slug]` (0.7), `/review` `/stats` `/favorites` `/privacy` (0.3). **Omit `lastModified`** so output is deterministic build-to-build (no `new Date()`); exclude `/offline`.
9. **Create `src/app/opengraph-image.tsx`** (root-level, inherited by all routes via `metadataBase`): 1200×630 `ImageResponse` from `next/og` matching the app's look — `#020617` slate background, emerald accent, app name, tagline "Ten words at a time." All text Latin/pinyin only (default OG font has no CJK glyphs). Export `alt`, `size`, `contentType` per the local docs.
10. **Create `src/components/json-ld.tsx`** (server component) and mount JSON-LD: `WebSite` + `WebApplication` on `/` (name, url, description, `applicationCategory: "EducationalApplication"`, `offers.price: "0"` — all facts we already state on `/privacy`); `BreadcrumbList` (Library → Category → Topic) plus an `ItemList` of the topic's ten words (hanzi + pinyin + english from `topic.items`) on topic pages; `BreadcrumbList` on category pages.
11. **Run the full gate** (`npm run test`, `validate:data`, `validate:quality`, `lint`, `build`) and spot-check the built output (`.next` route table shows `/robots.txt`, `/sitemap.xml`, `/opengraph-image`; `curl` a few pages in `next start` for tags).

## Likely files touched

| File | Change |
|---|---|
| `src/lib/seo.ts` | **new** — site constants, URL/description/JSON-LD builders |
| `tests/seo.test.mjs` | **new** — unit tests |
| `src/app/robots.ts` | **new** |
| `src/app/sitemap.ts` | **new** |
| `src/app/opengraph-image.tsx` | **new** — generated share card |
| `src/components/json-ld.tsx` | **new** — `<script type="application/ld+json">` renderer |
| `src/app/layout.tsx` | metadataBase, title template, OG/Twitter defaults |
| `src/app/page.tsx` | add metadata + JSON-LD |
| `src/app/topics/[slug]/page.tsx` | richer `generateMetadata`, canonical, OG, JSON-LD |
| `src/app/categories/[slug]/page.tsx` | same |
| `src/app/{path,practice,review,stats,favorites,privacy,offline}/page.tsx` | title de-suffix, canonical; `/offline` noindex |

## Proposed function/component names and TypeScript signatures

```ts
// src/lib/seo.ts
export const SITE_NAME = "Learn 10 Mandarin Words";
export const SITE_TAGLINE = "Learn Mandarin ten words at a time";
/** NEXT_PUBLIC_SITE_URL (trailing slash stripped) or the Vercel default. */
export const SITE_URL: string;

export function absoluteUrl(path: string): string;            // "/topics/x" -> `${SITE_URL}/topics/x`
export function siteDescription(topics?: Topic[]): string;    // uses datasetSummary counts
export function topicMetaDescription(topic: Topic): string;   // hanzi always paired with pinyin
export function categoryMetaDescription(category: Category, topics: Topic[]): string;

export type SitemapEntry = { url: string; priority: number; changeFrequency?: "weekly" | "monthly" };
export function sitemapEntries(data: MandarinData): SitemapEntry[]; // pure; app/sitemap.ts maps over it

export function websiteJsonLd(): Record<string, unknown>;
export function webApplicationJsonLd(topics: Topic[]): Record<string, unknown>;
export function topicBreadcrumbJsonLd(topic: Topic): Record<string, unknown>;
export function categoryBreadcrumbJsonLd(category: Category): Record<string, unknown>;
export function topicWordListJsonLd(topic: Topic): Record<string, unknown>; // ItemList of the 10 items
export function serializeJsonLd(value: Record<string, unknown>): string;    // escapes "<" as \u003c
```

```tsx
// src/components/json-ld.tsx (server component)
export function JsonLd({ data }: { data: Record<string, unknown> }): React.JSX.Element;
```

```ts
// src/app/sitemap.ts
export default function sitemap(): MetadataRoute.Sitemap;
// src/app/robots.ts
export default function robots(): MetadataRoute.Robots;
```

## UI copy / microcopy

No visible UI changes; all copy is metadata (real data only, no invented facts):

- Home description: `"Learn Mandarin ten words at a time — {formattedListCount} topics and {formattedWordCount} words with video lessons, pinyin, flashcards, quizzes, and spaced-repetition review. Free, no account, progress stays on your device."`
- Topic description template: `"Learn the Mandarin words for {titleEn} ({titleCn}) — {hanzi₁} {pinyin₁} ({english₁}), {hanzi₂} {pinyin₂} ({english₂}), and more, with example sentences, flashcards, and quizzes."` (first 2–3 items; pinyin always accompanies hanzi, honoring the project rule)
- Category description template: `"{count} Mandarin topics in {category.name}, including {titleEn₁} and {titleEn₂} — ten words each, with pinyin, flashcards, and quizzes."`
- OG image text: `SITE_NAME` + `"Ten words at a time · pinyin · flashcards · quizzes"`; `alt` = `"Learn 10 Mandarin Words — learn Mandarin ten words at a time"` (Latin-only for font-safety).
- `/offline` keeps its existing copy; only gains `robots: { index: false }`.

## Test plan

New `tests/seo.test.mjs` (node --test, imports `../src/lib/seo.ts` and `../src/app/sitemap.ts`/`robots.ts` directly, per existing convention):

1. `absoluteUrl` joins with and without leading slash, never double-slashes, and `SITE_URL` has no trailing slash.
2. `sitemapEntries(rawData)` contains exactly `7 + categories.length + topics.length` entries (123 today, derived not hardcoded), every URL is absolute and unique, `/offline` is absent, home has priority 1.
3. `sitemap()` (the route file) returns the same URL set; `robots()` disallows `/offline` and points at `${SITE_URL}/sitemap.xml`.
4. `topicMetaDescription` for a real topic (e.g. `getTopic("ten-types-of-pets")`) contains `titleEn`, `titleCn`, and at least one `pinyin` string from `topic.items`; stays under ~200 chars.
5. `serializeJsonLd` escapes `<` (feed it a value containing `"</script>"`); `topicWordListJsonLd` lists all 10 items with hanzi/pinyin/english; breadcrumb builders produce 3 `itemListElement`s ending at the topic URL.
6. Existing suites (`data`, `sw-policy`, etc.) must stay green — this sprint touches no logic they cover.

Gate: `npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build`.

## Manual QA checklist

- [ ] `npm run build` route table shows `/robots.txt`, `/sitemap.xml`, `/opengraph-image` and 102 + 14 static params unchanged.
- [ ] `npm run start`, then `curl -s localhost:3000/robots.txt` and `/sitemap.xml` — valid, `/offline` excluded, URLs use the configured domain.
- [ ] View source on `/`, `/topics/ten-types-of-pets`, `/categories/food-and-drink`: `<title>` uses the template once (no `"| Learn 10 ... | Learn 10 ..."` doubling), `og:image` is absolute, `link rel=canonical` correct, one `application/ld+json` block per page that parses in a JSON validator.
- [ ] `curl -sI localhost:3000/opengraph-image` returns `image/png`, and opening it shows the dark card with readable Latin text (no tofu boxes).
- [ ] `/offline` page source contains `noindex`.
- [ ] Browser tab titles unchanged in substance on all nav destinations (`Library`… etc. still readable); app UI pixel-identical (this sprint renders nothing visible).
- [ ] PWA still installs; `/manifest.webmanifest` unchanged; SW offline flow (`DevTools → offline → reload`) still lands on cached pages.

## Acceptance criteria

1. All five gate commands pass.
2. Every indexable route (1 home + 2 guides + 4 utility + 14 categories + 102 topics = 123) appears in `/sitemap.xml` with an absolute URL on the configured domain; `/offline` is noindexed and excluded.
3. Every page emits canonical, OG (title/description/url/image), and Twitter card tags; title suffix comes from the layout template exactly once.
4. Topic and category descriptions are generated from `topics.json` and always pair hanzi with pinyin.
5. JSON-LD on home/topic/category pages passes schema.org validation shape checks (tested for structure locally) and contains only facts derived from repo data.
6. No new dependencies, no visual/UI changes, no backend, no analytics.

## Risk and rollback notes

- **Domain correctness (main risk):** the fallback `https://learn-10-mandarin-words.vercel.app` is inferred from `.vercel/project.json`'s project name and is unverified. Wrong canonical/OG URLs are worse than none — the implementer should confirm the production domain and set `NEXT_PUBLIC_SITE_URL` in Vercel env; the code reads it at build time so no code change is needed when the domain changes.
- **CJK glyphs in `ImageResponse`:** the bundled OG font is Latin-only; hanzi would render as tofu. Mitigated by a hard rule: OG image text is English/pinyin only (enforced by review, and the image is a single root-level file).
- **Title template regression:** forgetting to strip a hardcoded suffix yields `"Stats | Learn 10 Mandarin Words | Learn 10 Mandarin Words"`. Covered by the manual QA view-source check; grep for `"| Learn 10"` in `src/app/**/page.tsx` should return zero after step 4.
- **Sitemap drift:** deriving entries from `data.topics`/`data.categories` (not a hand-list) means new topics auto-appear; the count test locks the formula, not a magic number.
- **Rollback:** the sprint is additive — reverting is deleting 5 new files and restoring the small metadata diffs in 10 pages; no data, schema (`ProgressState` untouched), or SW changes, so a single `git revert` is safe.

## Non-goals / deferrals

- Per-topic generated OG images (102 × `opengraph-image.tsx` under `topics/[slug]`) — deferred; needs a CJK font file checked into the repo to render hanzi, and inflates build time. Root image ships first.
- `hreflang`/i18n alternates, blog/content pages, RSS — out of scope.
- Search Console / IndexNow submission, analytics of any kind — no external services, per project constraints.
- Video structured data (`VideoObject`) for GitHub-Releases MP4s — deferred until poster/duration metadata exists in `VideoMeta`.
- No changes to `manifest.ts`, `sw.js` precache list, or `next.config.ts` headers.

## Ready-to-run Opus implementation prompt for Sprint 7

> Implement Sprint 7 ("SEO pack") for the Learn 10 Mandarin Words app (Next.js 16 App Router, React 19, Tailwind 4). **Read `AGENTS.md` first**, then skim `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/{robots,sitemap,opengraph-image}.md` and `.../04-functions/generate-metadata.md` — this Next version may differ from your training data. Constraints: no new dependencies, no backend/analytics/external services, no invented vocabulary or facts, no visible UI changes, do not touch `ProgressState`, `src/app/manifest.ts`, `public/sw.js`, or `next.config.ts`.
>
> 1. Create `src/lib/seo.ts`: `SITE_NAME = "Learn 10 Mandarin Words"`, `SITE_URL` from `process.env.NEXT_PUBLIC_SITE_URL` (strip trailing slash) with fallback `"https://learn-10-mandarin-words.vercel.app"`, plus pure builders `absoluteUrl(path)`, `siteDescription()` (uses `datasetSummary` from `src/lib/data.ts` — never hardcode counts), `topicMetaDescription(topic)` (must include `titleEn`, `titleCn`, and 2–3 sample items formatted "hanzi pinyin (english)" — hanzi must always be paired with pinyin), `categoryMetaDescription(category, topics)`, `sitemapEntries(data)`, JSON-LD builders `websiteJsonLd`, `webApplicationJsonLd`, `topicBreadcrumbJsonLd`, `categoryBreadcrumbJsonLd`, `topicWordListJsonLd`, and `serializeJsonLd` (escape `<` as `\u003c`).
> 2. Write `tests/seo.test.mjs` **first** (node --test style like `tests/data.test.mjs`, importing the real `topics.json` and `.ts` sources): URL joining; sitemap entry count equals `7 + categories.length + topics.length` with unique absolute URLs and no `/offline`; robots disallows `/offline` and references `${SITE_URL}/sitemap.xml`; topic descriptions contain pinyin from `topic.items`; `serializeJsonLd` escaping; word-list JSON-LD covers all 10 items.
> 3. `src/app/layout.tsx`: add `metadataBase: new URL(SITE_URL)`, convert title to `{ default: SITE_NAME, template: `%s | ${SITE_NAME}` }`, add `openGraph` (siteName, type "website", locale "en_US", url "/") and `twitter: { card: "summary_large_image" }`; keep existing icons/manifest/appleWebApp.
> 4. Remove the hardcoded `" | Learn 10 Mandarin Words"` suffix from the `metadata` titles in `src/app/{path,practice,review,stats,favorites,privacy,offline}/page.tsx` and add `alternates: { canonical: "/<route>" }` to each; add `robots: { index: false, follow: false }` to `/offline` only. Add metadata (canonical "/", description from `siteDescription()`) to `src/app/page.tsx`.
> 5. Enrich `generateMetadata` in `src/app/topics/[slug]/page.tsx` and `src/app/categories/[slug]/page.tsx` with the new description builders, canonical paths, and matching `openGraph` title/description/url.
> 6. Create `src/app/robots.ts` and `src/app/sitemap.ts` using `MetadataRoute` types; sitemap maps over `sitemapEntries(data)` — home priority 1, `/path` `/practice` and categories 0.8, topics 0.7, `/review` `/stats` `/favorites` `/privacy` 0.3; **no `lastModified`** (keep output deterministic); exclude `/offline`.
> 7. Create root `src/app/opengraph-image.tsx` (1200×630, `ImageResponse` from `next/og`, exports `alt`/`size`/`contentType`): dark `#020617` background with emerald accent matching the app; **text in English/pinyin only — no hanzi** (the default OG font has no CJK glyphs).
> 8. Create server component `src/components/json-ld.tsx` rendering `<script type="application/ld+json">` via `serializeJsonLd`; mount `WebSite` + `WebApplication` JSON-LD on `/`, `BreadcrumbList` + word `ItemList` on topic pages, `BreadcrumbList` on category pages.
> 9. Do not commit/push/deploy. Finish with `npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build`, then verify in the build output that `/robots.txt`, `/sitemap.xml`, and `/opengraph-image` routes exist, grep `src/app` to confirm no page title still hardcodes `"| Learn 10"`, and report results.

One open item to confirm with you before (or during) implementation: the production domain. Everything is wired to `NEXT_PUBLIC_SITE_URL` so the fallback (`learn-10-mandarin-words.vercel.app`, inferred from `.vercel/project.json`) can be overridden in Vercel env without a code change — but canonical/OG URLs will be wrong until the real domain is set if that inference is off.

---

I have everything I need. Here's the grounded plan for Sprint 8.

## Sprint 8 — Branded 404/error pages

### Goal and user value

Today a mistyped URL, a dead topic slug, or a runtime crash drops the learner into Next.js's unstyled default 404/error screens — a jarring white break in an otherwise carefully branded dark app. This sprint ships branded `not-found`, `error`, and `global-error` pages that match the app's design system (slate-950 ground, emerald accent, quiet-ink text ladder), stay on-brand by teaching a real dataset word (对不起 · duì bu qǐ · "sorry") on the failure screen, reassure the learner that their localStorage progress is safe, and route them back into learning with real destinations.

### Current-state findings (grounded in actual files)

- **No error/404 files exist anywhere.** `src/app/` contains only `layout.tsx`, `page.tsx`, `globals.css`, `manifest.ts`, `favicon.ico`, and route folders (`categories/[slug]`, `topics/[slug]`, `favorites`, `offline`, `path`, `practice`, `privacy`, `review`, `stats`). There is no `not-found.tsx`, `error.tsx`, or `global-error.tsx` — unmatched URLs and thrown errors get Next.js defaults.
- **`notFound()` is already called in two places**: `src/app/topics/[slug]/page.tsx:22` and `src/app/categories/[slug]/page.tsx:22`, both after a failed `getTopic`/`getCategory` lookup (`src/lib/data.ts:9-21`). Both use `generateStaticParams` without `dynamicParams = false`, so unknown slugs render at request time and hit `notFound()` — currently landing on the default screen.
- **Single root layout** (`src/app/layout.tsx`) renders `<BottomNav />` and `<PwaRegister />` around children on a `bg-slate-950 text-white` body. A root `not-found.tsx`/`error.tsx` will render *inside* this layout, so the bottom nav and brand chrome persist for free. Per the local Next.js 16 docs (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md:131`), root `app/not-found.js` also catches **all unmatched URLs app-wide** — the experimental `global-not-found.js` (needs a config flag) is only for multi-root-layout apps and is not needed here.
- **Next 16.2.9** (`package.json:17`). The local `error.md` doc (version history line 329) confirms `unstable_retry` landed in v16.2.0 and is the recommended recovery prop over `reset` ("In most cases, you should use `unstable_retry()` instead", `error.md:119-121`). `global-error.tsx` must render its own `<html>`/`<body>` and cannot export `metadata` (client component).
- **Design system tokens live in `src/app/globals.css`**: surface ladder (`--color-surface: #0d1220`), border tokens, ink ladder (`--color-ink-mid/low`), single emerald accent `#34d399` with rose `--color-danger: #fb7185` reserved for errors, and a `.font-hanzi` class (line 95) for CJK text. The Noto Sans SC font variable comes from `layout.tsx:17-22`.
- **`src/app/offline/page.tsx` is the established template for a branded full-screen utility page**: centered `min-h-[80dvh]` main, big glyph, `text-3xl md:text-4xl` heading, `text-slate-300` body, emerald pill primary button ("Back to library") + outlined secondary. The 404 page should visually rhyme with it.
- **The dataset really contains 对不起** (`src/data/topics.json`, topic slug `ten-ways-to-apologize`: hanzi 对不起, pinyin `duì bu qǐ`, english "sorry") — perfect on-brand copy for a failure screen with zero invented vocabulary. `recommendedPath()` (`src/lib/data.ts:41`, backed by `src/lib/data-logic.ts:72`) returns curated real starter topics for "keep learning" suggestions.
- **Pinyin helpers exist for validation**: `tonesOf()` in `src/lib/pinyin.ts:61` counts syllables per vowel cluster — usable in a test to prove the error-screen pinyin aligns 1:1 with its hanzi.
- **Tests are pure-logic `node --test` files** that import `.ts` modules directly (e.g. `tests/data.test.mjs:19` imports `../src/lib/data-logic.ts`). No component-render test infra exists, so testable logic must live in a lib module, not in the page components.
- **Service worker** (`public/sw.js`): navigations are network-first falling back to cache then `/offline` (line 158-169), and `isCacheable()` (line 70) already refuses to cache non-OK responses, so 404 responses will never be cached and no SW change is needed. Offline navigation to an unknown URL correctly shows `/offline`, not the 404 — that division of labor stays.
- **`src/lib/analytics.ts`** has a closed `AnalyticsEvent` union with no error event; expanding it is out of scope.

### Exact implementation steps in sequence

1. **Create `src/lib/error-copy.ts`** — a pure, dependency-free module holding the shared copy for all failure screens: the branded word (hanzi 对不起, pinyin `duì bu qǐ`, english "sorry", source topic slug `ten-ways-to-apologize`) and the headline/body strings for the 404 and error variants. Keeping copy here makes it importable by both server (`not-found.tsx`) and client (`error.tsx`, `global-error.tsx`) files and testable under `node --test`.
2. **Create `src/components/error-screen.tsx`** — a shared presentational component (no hooks, no `"use client"`, so it works in both server and client files). Renders: oversized hanzi in `.font-hanzi` with the pinyin line directly beneath it and the English gloss (pinyin-on-Chinese-lines rule), a heading, body text, a slot for action buttons, and an optional "learn this word" link to `/topics/ten-ways-to-apologize`. Styled to rhyme with `offline/page.tsx`: centered `min-h-[80dvh]` main, `pb-24` clearance for the fixed bottom nav, emerald pill primary + `border-white/15` outlined secondary buttons, `min-h-[44px]` tap targets.
3. **Create `src/app/not-found.tsx`** (server component). Exports `metadata` (`title: "Page not found | Learn 10 Mandarin Words"`). Renders `ErrorScreen` with the 404 copy plus a compact "Keep learning" row of the first 3 topics from `recommendedPath()` (real dataset links, mirroring how `offline/page.tsx` offers onward paths). Actions: "Back to library" (`/`, primary) and "Learning path" (`/path`, secondary).
4. **Create `src/app/topics/[slug]/not-found.tsx`** and **`src/app/categories/[slug]/not-found.tsx`** — thin wrappers over `ErrorScreen` with contextual headings ("Lesson not found" / "Category not found") so the existing `notFound()` calls in those segments get copy that names what's missing. Same suggestions row from `recommendedPath()` in the topic variant.
5. **Create `src/app/error.tsx`** (client component, `"use client"`). Props `{ error, unstable_retry }` per the local Next 16.2 docs; `useEffect` logs `error` via `console.error` (dev debugging only — no network, honoring the local-first rule). Renders `ErrorScreen` with error copy and a rose-tinted (semantic `--color-danger`) detail line style rather than emerald. Actions: "Try again" button calling `unstable_retry()` (primary) and "Back to library" link (secondary). Body copy explicitly reassures that progress lives in the browser and is untouched.
6. **Create `src/app/global-error.tsx`** (client component). Must render its own `<html>`/`<body>`; keep it dependency-free — inline styles only (background `#020617`, system font stack with the `.font-hanzi` CJK fallback chain hardcoded, since `next/font` variables from the replaced root layout won't exist). Same copy from `error-copy.ts`, a "Try again" button via `unstable_retry()`, and a plain `<a href="/">` home link (no `next/link`, since the app shell may be broken). Include React's `<title>` element ("Something went wrong | Learn 10 Mandarin Words") since `metadata` isn't supported here.
7. **Create `tests/error-copy.test.mjs`** — validates the copy module against real helpers and data (details in Test plan).
8. **Run the full validation gate** and fix anything it surfaces.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/error-copy.ts` | new — shared copy constants |
| `src/components/error-screen.tsx` | new — shared branded screen |
| `src/app/not-found.tsx` | new — root 404 |
| `src/app/topics/[slug]/not-found.tsx` | new — lesson 404 |
| `src/app/categories/[slug]/not-found.tsx` | new — category 404 |
| `src/app/error.tsx` | new — root error boundary |
| `src/app/global-error.tsx` | new — root-layout crash fallback |
| `tests/error-copy.test.mjs` | new — copy validation |

No changes needed to `public/sw.js`, `next.config.ts`, `src/app/layout.tsx`, or the two `[slug]/page.tsx` files (their `notFound()` calls already do the right thing).

### Proposed names and TypeScript signatures

```ts
// src/lib/error-copy.ts
export type ErrorWord = {
  hanzi: string;      // "对不起"
  pinyin: string;     // "duì bu qǐ"
  english: string;    // "sorry"
  topicSlug: string;  // "ten-ways-to-apologize" — real topic in src/data/topics.json
};
export const ERROR_WORD: ErrorWord;
export const NOT_FOUND_COPY: { title: string; body: string };
export const LESSON_NOT_FOUND_COPY: { title: string; body: string };
export const CATEGORY_NOT_FOUND_COPY: { title: string; body: string };
export const ERROR_COPY: { title: string; body: string };
```

```tsx
// src/components/error-screen.tsx  (server-compatible, no hooks)
export function ErrorScreen(props: {
  word: ErrorWord;
  title: string;
  body: string;
  tone?: "accent" | "danger";      // emerald for 404, rose for crashes
  children?: React.ReactNode;      // action buttons / suggestion rows
}): React.JSX.Element;
```

```tsx
// src/app/not-found.tsx
export const metadata: Metadata;
export default function NotFound(): React.JSX.Element;

// src/app/error.tsx
"use client";
export default function ErrorPage({ error, unstable_retry }: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}): React.JSX.Element;

// src/app/global-error.tsx
"use client";
export default function GlobalError({ error, unstable_retry }: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}): React.JSX.Element;
```

### UI copy / microcopy

All Chinese lines carry pinyin, and the featured word is real dataset vocabulary — the failure screen literally teaches you a word.

**Branded word block (all screens):**
> 对不起
> duì bu qǐ · "sorry"

**Root 404 (`not-found.tsx`):**
- Title: **Page not found**
- Body: "This page doesn't exist — but your saved progress does. Everything you've learned is safe on your device."
- Word link: "Learn 对不起 and nine more ways to apologize →" (links to `/topics/ten-ways-to-apologize`)
- Suggestions label: "Keep learning instead"
- Buttons: **Back to library** (primary) · **Learning path** (secondary)

**Lesson 404 (`topics/[slug]/not-found.tsx`):**
- Title: **Lesson not found**
- Body: "That lesson isn't in the library. Pick a starter topic below, or head back to browse all 102 lists." *(derive the count from `datasetSummary()` rather than hardcoding, matching the hero-counts convention from commit 36741a7)*

**Category 404 (`categories/[slug]/not-found.tsx`):**
- Title: **Category not found**
- Body: "That category isn't in the library. All topics are waiting back at the home screen."

**Error page (`error.tsx` / `global-error.tsx`):**
- Title: **Something went wrong**
- Body: "An unexpected error interrupted this page. Your progress is stored in your browser and hasn't been touched."
- Buttons: **Try again** (primary, calls `unstable_retry()`) · **Back to library** (secondary)

### Test plan

New `tests/error-copy.test.mjs` (runs under existing `npm run test` = `node --test`, importing `.ts` directly like `tests/data.test.mjs:19` does):

1. **The branded word is real dataset vocabulary** — import `topics.json` and assert a topic with slug `ERROR_WORD.topicSlug` exists and contains an item whose `hanzi === ERROR_WORD.hanzi`, `pinyin === ERROR_WORD.pinyin`, and `english === ERROR_WORD.english`. This makes the copy break loudly if the dataset entry is ever renamed.
2. **Pinyin aligns with hanzi** — using `tonesOf` from `src/lib/pinyin.ts`, assert `tonesOf(ERROR_WORD.pinyin).length === [...ERROR_WORD.hanzi].length` (3 syllables, 3 characters), mirroring the one-tone-per-hanzi invariant documented in `pinyin.ts`.
3. **Copy completeness** — every exported copy object has non-empty `title` and `body`; the 404 body mentions progress safety (guards the reassurance from being edited away silently).

Existing suites (`data.test.mjs`, `sw-policy.test.mjs`, etc.) must stay green — this sprint touches no existing modules, so failures there would indicate an accidental change.

### Manual QA checklist

- [ ] `npm run dev`, visit `/this-does-not-exist` → branded 404 inside the app shell, bottom nav visible on mobile width, no white flash.
- [ ] Visit `/topics/not-a-real-slug` → "Lesson not found" variant; `/categories/not-a-real-slug` → "Category not found" variant.
- [ ] All three 404 variants: hanzi renders in the CJK font (`.font-hanzi`), pinyin line sits directly under it, suggestion links go to real topics that load.
- [ ] `curl -sI localhost:3000/this-does-not-exist | head -1` returns **404** (non-streamed responses get a real 404 status per the local not-found doc).
- [ ] Browser tab title reads "Page not found | Learn 10 Mandarin Words".
- [ ] Temporarily throw inside a page component (dev-only edit, then revert) → branded error screen appears; **Try again** re-renders; **Back to library** navigates home.
- [ ] React DevTools → toggle the root error boundary to preview `error.tsx` without code edits; also verify `global-error.tsx` renders as a complete dark document (Next 15.2+ shows it in dev).
- [ ] Keyboard-tab through both screens: emerald `:focus-visible` ring appears on every link/button; buttons meet the 44px tap-target convention.
- [ ] Enable "Emulate prefers-reduced-motion" — no animation surprises (screens are static; nothing to disable).
- [ ] `npm run build && npm run start` → repeat the 404 checks against the production build.
- [ ] Offline check: with the SW active and network disabled, navigating to an uncached URL still lands on `/offline` (not the 404) — confirming the SW fallback split is intact.

### Acceptance criteria

1. Unknown URLs at any depth render the branded root 404 with a real 404 HTTP status; unknown topic/category slugs render their contextual variants via the existing `notFound()` calls.
2. All failure screens match the design system: `#020617` ground, opaque surfaces, emerald accent (rose reserved for the error screens' semantic tint), quiet-ink text, `font-hanzi` for Chinese with pinyin on every Chinese line.
3. Runtime errors show `error.tsx` with a working `unstable_retry()`; a root-layout crash shows a self-contained `global-error.tsx`.
4. The featured word 对不起 is verifiably drawn from `src/data/topics.json` (enforced by test), with no invented vocabulary, HSK metadata, or external content anywhere.
5. No network calls, analytics providers, or backend additions; progress reassurance copy is present on 404 and error screens.
6. Full gate passes: `npm run test`, `npm run validate:data`, `npm run validate:quality`, `npm run lint`, `npm run build`.

### Risk and rollback notes

- **All files are additive.** Rollback is deleting the eight new files — no existing file changes, no data migration, no SW cache-version bump needed.
- **`unstable_` prefix risk:** `unstable_retry` is new in 16.2 and could be renamed in a future Next version. Mitigation: it's confined to two small client files; if a future upgrade breaks it, swap to the stable `reset` prop (same call sites). Do not spread it further.
- **`global-error.tsx` styling drift:** it can't use `next/font` or Tailwind-reliant markup safely (it replaces the root layout), so its inline-styled look may drift from the design system over time. Accepted: it's a last-resort screen; keep it deliberately minimal.
- **Segment 404s render inside `[slug]` segments** — they still sit within the root layout, so nav persists; no layout risk.
- **SEO/status nuance:** streamed responses can return 200 for not-found (per local docs). This app's pages are static/small so non-streamed 404s are expected; the `curl` QA step verifies it.

### Non-goals / deferrals

- No `global-not-found.js` (experimental, requires a `next.config.ts` flag; unnecessary with a single root layout).
- No `loading.tsx` files, no offline-page redesign, no SW changes (404s are already never cached by `isCacheable`).
- No new `AnalyticsEvent` for errors, no error-reporting service (local-first, no network).
- No fuzzy slug matching / "did you mean" search on 404 — `recommendedPath()` suggestions are enough for this sprint.
- No per-segment `error.tsx` boundaries below root (e.g. inside `topics/[slug]`) — defer until a real need appears.

### Ready-to-run Opus implementation prompt for Sprint 8

```text
You are implementing Sprint 8 (Branded 404/error pages) in the repo at
/home/nvidia/learn-10-mandarin-words — a Next.js 16.2.9 / React 19 / Tailwind 4
static, local-first Mandarin learning app. Read AGENTS.md first: this Next.js
version has breaking changes; consult node_modules/next/dist/docs/01-app/
03-api-reference/03-file-conventions/{not-found.md,error.md} before writing the
special files, and follow them over your training data.

Context you must reuse (read these files before coding):
- src/app/layout.tsx — single root layout; renders BottomNav; body is
  bg-slate-950 text-white; Noto Sans SC loaded as --font-noto-sc.
- src/app/globals.css — design tokens: --color-surface #0d1220, border tokens,
  ink ladder, accent #34d399 (emerald = brand), --color-danger #fb7185 (rose =
  error semantic), and the .font-hanzi class for Chinese text.
- src/app/offline/page.tsx — the visual template for full-screen utility pages
  (centered min-h-[80dvh] main, emerald pill primary button "Back to library",
  outlined secondary, min-h-[44px] tap targets). Match its look and tone.
- src/app/topics/[slug]/page.tsx and src/app/categories/[slug]/page.tsx —
  existing notFound() call sites; do NOT modify them.
- src/lib/data.ts (recommendedPath, datasetSummary), src/lib/pinyin.ts (tonesOf),
  tests/data.test.mjs (test style: node --test, imports .ts directly).

Build exactly these 8 new files (change nothing else):
1. src/lib/error-copy.ts — pure module exporting:
   ERROR_WORD = { hanzi: "对不起", pinyin: "duì bu qǐ", english: "sorry",
   topicSlug: "ten-ways-to-apologize" } (this exact entry exists in
   src/data/topics.json — verify, don't invent), plus NOT_FOUND_COPY,
   LESSON_NOT_FOUND_COPY, CATEGORY_NOT_FOUND_COPY, ERROR_COPY objects
   ({ title, body }). 404 title "Page not found", body reassuring that saved
   progress is safe on the device. Error title "Something went wrong", body
   "An unexpected error interrupted this page. Your progress is stored in your
   browser and hasn't been touched."
2. src/components/error-screen.tsx — shared presentational ErrorScreen
   component (NO "use client", no hooks, so server files can use it). Props:
   { word, title, body, tone?: "accent" | "danger", children }. Renders the
   hanzi large in .font-hanzi with its pinyin line directly beneath plus the
   English gloss (pinyin must accompany every Chinese line), then title, body,
   then children (actions). Emerald tint for tone="accent", rose
   (--color-danger) heading tint for "danger". Match offline/page.tsx layout
   conventions incl. pb-24 clearance for the fixed BottomNav.
3. src/app/not-found.tsx — server component; export metadata title
   "Page not found | Learn 10 Mandarin Words"; ErrorScreen + a "Keep learning
   instead" row linking the first 3 topics from recommendedPath() (real data,
   /topics/<slug>), a link to /topics/ten-ways-to-apologize ("Learn 对不起 and
   nine more ways to apologize"), and buttons: Back to library (/, primary
   emerald pill) + Learning path (/path, outlined).
4. src/app/topics/[slug]/not-found.tsx — "Lesson not found" variant; derive
   any list count from datasetSummary(), never hardcode; include the same
   starter-topic suggestions.
5. src/app/categories/[slug]/not-found.tsx — "Category not found" variant;
   button back to /.
6. src/app/error.tsx — "use client"; props { error, unstable_retry } per the
   local error.md (Next 16.2 provides unstable_retry; prefer it over reset);
   useEffect(() => console.error(error), [error]); ErrorScreen tone="danger";
   buttons: Try again (calls unstable_retry()) + Back to library link. No
   analytics, no network.
7. src/app/global-error.tsx — "use client"; must render its own <html>/<body>;
   inline styles ONLY (background #020617, near-white text, emerald button;
   hardcode a CJK fallback font stack for the hanzi — next/font vars and
   Tailwind classes from the replaced root layout are unavailable); include
   React <title>Something went wrong | Learn 10 Mandarin Words</title>
   (metadata export is unsupported here); Try again via unstable_retry() and a
   plain <a href="/"> home link.
8. tests/error-copy.test.mjs — node --test style matching tests/data.test.mjs:
   (a) topics.json contains a topic with slug ERROR_WORD.topicSlug whose items
   include an entry exactly matching ERROR_WORD's hanzi/pinyin/english;
   (b) tonesOf(ERROR_WORD.pinyin).length === [...ERROR_WORD.hanzi].length;
   (c) all exported copy objects have non-empty title and body, and the 404
   body mentions progress being safe.

Hard constraints: no backend/DB/login/paid services; no invented vocabulary,
HSK metadata, video URLs, or analytics providers; localStorage-only progress
untouched; do not modify public/sw.js, next.config.ts, src/app/layout.tsx, or
any existing file; pinyin on every Chinese line; keyboard focus relies on the
global :focus-visible ring — don't override it.

Validation gate (all must pass before you're done):
npm run test
npm run validate:data
npm run validate:quality
npm run lint
npm run build

After the gate passes, manually spot-check with npm run dev: /nope-404 shows
the branded 404 (curl -sI should report HTTP 404), /topics/not-real shows
"Lesson not found", and a temporarily thrown error in a page (revert after)
shows the branded error screen with a working Try again.
```

---

I've grounded the plan in the actual code — the listening quiz mode, `SpeakButton`, `WordsPanel`, and the speech-detection pattern in `topic-app.tsx` are all live and reusable. Here is the sprint plan.

---

## Sprint 9 — Play all listening drill

### Goal and user value

Add a hands-free **"Play all"** listening drill to the Words tab of every topic page: one tap speaks all ten words in sequence (Mandarin, `zh-CN`, slightly slowed), highlighting each word card as it plays, with a visible progress counter and a Stop control. Learners can put the phone down and train their ear on a whole topic — today audio is strictly one-tap-per-word (`SpeakButton`) or hidden inside the listening *quiz*, which demands interaction on every card. This is pure Web Speech API, fully local, no new dependencies, no backend.

### Current-state findings (grounded in actual files)

- **Speech is already established, one word at a time.** `src/components/speak-button.tsx` speaks a single string (`zh-CN`, `rate 0.85`, `cancel()` before speak). The same params are duplicated in a module-level `speakWord()` helper in `src/components/topic/quiz-panel.tsx:14-21` for the listening quiz mode. There is **no sequential/chained playback anywhere** — nothing uses `utterance.onend`.
- **Speech availability detection already exists in the right place.** `topic-app.tsx:54-66` sets `speechAvailable` in a post-hydration effect (microtask pattern, avoids hydration mismatch) and currently passes it only to `QuizPanel` (`topic-app.tsx:389`). `WordsPanel` does not receive it.
- **`WordsPanel`** (`src/components/topic/words-panel.tsx`) is presentational: renders `topic.items` as a 2-column card grid with per-word `SpeakButton`s. It has no header row — a natural slot for a "Play all" bar above the grid at line 23.
- **Pure-logic-module + node-test convention is strong.** `src/lib/video-controls.ts` + `tests/video-controls.test.mjs` is the exact template: DOM-free constants/helpers, imported by a client component via ref/hook. 18 test files exist under `tests/`, run by `node --test` (imports `.ts` directly).
- **Analytics** is a typed union in `src/lib/analytics.ts:15-30`; adding an event means one union member (e.g. after `"tone_practice_completed"`).
- **Reduced motion** is handled via `useReducedMotion()` (`src/components/use-reduced-motion.ts`) — needed if the drill auto-scrolls the active card into view.
- **Word identity**: `wordKey(topic, item)` from `src/lib/data.ts` is the canonical per-word key (already used inside `WordsPanel`).
- **Pinyin-on-Chinese-lines** is already satisfied by the word cards themselves (hanzi + pinyin + English are always visible in the Words tab), so the drill only adds audio + highlight — no new text surfaces to annotate.
- **`AGENTS.md`** warns this Next.js 16 diverges from training data; this sprint is entirely client-component work (no routing/data-fetching APIs), so exposure is minimal, but the implementer should still skim `node_modules/next/dist/docs/` if touching anything framework-level.
- **Known Web Speech pitfalls to design around** (why the hook needs care): `utterance.onend` can silently never fire on some Chrome/Android builds, and `speechSynthesis.cancel()` can surface as an `error` event (`"canceled"`/`"interrupted"`) on the in-flight utterance. So chaining needs a per-run generation guard and a length-scaled timeout fallback.

### Exact implementation steps in sequence

1. **Create `src/lib/listen-logic.ts`** (pure, DOM-free, mirroring `video-controls.ts`):
   - `WORD_GAP_MS = 900` (pause between words), `MIN_STEP_TIMEOUT_MS = 4000`, `PER_CHAR_TIMEOUT_MS = 500`.
   - `buildListenSteps(topic, keyFor)` → ordered steps `{ key, text, pinyin, english, index }` where `text = item.hanzi` (skip items with empty hanzi defensively).
   - `nextStepIndex(current, total)` → `current + 1` or `null` when finished.
   - `stepTimeoutMs(text)` → `MIN_STEP_TIMEOUT_MS + text.length * PER_CHAR_TIMEOUT_MS` — the onend-never-fires safety fallback.
   - `listenProgressLabel(index, total)` → `"Playing 3 of 10"`.
2. **Create `src/components/use-listen-all.ts`** (client hook):
   - State: `status: "idle" | "playing" | "done"`, `activeIndex: number | null`.
   - `playAll()`: bump a generation ref, `speechSynthesis.cancel()`, speak step 0; on each utterance `end`/`error`, if the generation still matches, wait `WORD_GAP_MS` then speak the next step; a `setTimeout(stepTimeoutMs(text))` races `onend` so a dead `onend` never stalls the run. External `error` events (`"canceled"`/`"interrupted"` from another `SpeakButton`) with a stale generation are ignored; with a live generation they stop the drill cleanly.
   - `stop()`: bump generation, clear timers, `cancel()`, back to `"idle"`.
   - Cleanup on unmount (tab switch / navigation) does the same — no orphaned audio.
3. **Create `src/components/topic/listen-all-bar.tsx`**: Play/Stop pill button (≥44px, emerald fill matching the listening quiz's play button style in `quiz-panel.tsx:174`), progress counter, helper text, and a `role="status"` polite live region announcing the current word ("Playing 3 of 10: 狗 gǒu — dog"). Renders `null` shell when speech is unavailable (parent also gates it).
4. **Wire into `WordsPanel`**: add optional props `speechAvailable?: boolean`; render `ListenAllBar` above the grid; pass `activeKey` down so the matching `<article>` gets an emerald ring (`ring-2 ring-emerald-400/60`) + `aria-current="true"`; on step change, `scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" })` via `useReducedMotion()`.
5. **`topic-app.tsx`**: pass the existing `speechAvailable` state into `WordsPanel` (one-line prop addition at line ~348).
6. **`src/lib/analytics.ts`**: add `"listen_all_completed"` to `AnalyticsEvent`; fire from the hook's completion path with `{ topic: topic.slug, words: steps.length }`.
7. **Add `tests/listen-logic.test.mjs`** (see Test plan).
8. Run the full validation gate.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/listen-logic.ts` | **new** — pure sequencing/timeout/label helpers |
| `src/components/use-listen-all.ts` | **new** — speech-chaining hook |
| `src/components/topic/listen-all-bar.tsx` | **new** — Play all UI |
| `src/components/topic/words-panel.tsx` | listen bar, active-card highlight, new props |
| `src/components/topic-app.tsx` | pass `speechAvailable` (+ `topic`-scoped steps memo if built there) |
| `src/lib/analytics.ts` | one union member |
| `tests/listen-logic.test.mjs` | **new** |

### Proposed names and TypeScript signatures

```ts
// src/lib/listen-logic.ts
export const WORD_GAP_MS = 900;
export const MIN_STEP_TIMEOUT_MS = 4000;
export const PER_CHAR_TIMEOUT_MS = 500;
export type ListenStep = { key: string; text: string; pinyin: string; english: string; index: number };
export function buildListenSteps(topic: Topic, keyFor: (item: VocabItem) => string): ListenStep[];
export function nextStepIndex(current: number, total: number): number | null;
export function stepTimeoutMs(text: string): number;
export function listenProgressLabel(index: number, total: number): string;

// src/components/use-listen-all.ts
export type ListenStatus = "idle" | "playing" | "done";
export function useListenAll(steps: ListenStep[], onComplete?: () => void): {
  status: ListenStatus;
  activeIndex: number | null;
  playAll: () => void;
  stop: () => void;
};

// src/components/topic/listen-all-bar.tsx
export function ListenAllBar(props: {
  status: ListenStatus;
  activeIndex: number | null;
  activeStep: ListenStep | null;
  total: number;
  onPlayAll: () => void;
  onStop: () => void;
}): React.ReactElement;
```

`WordsPanel` gains `speechAvailable?: boolean` (optional, defaulting to false, so `favorites-app`/other callers compile unchanged — the same optional-prop convention the repo already documents for `TopicCard`).

### UI copy / microcopy

- Button idle: **"▶ Play all"** · playing: **"■ Stop"** · aria-labels: `"Play all ten words"` / `"Stop playback"`.
- Helper (idle): *"Listen straight through — each word plays once."*
- Progress (playing): *"Playing 3 of 10"*; live region: *"Playing 3 of 10: 狗 gǒu — dog"*.
- Done: *"Played all 10 ✓ — play again?"* (button reverts to "▶ Play all").
- No-voice hint (reuse existing line from `quiz-panel.tsx:190`): *"No sound? Your device may lack a Chinese voice."*

### Test plan (`tests/listen-logic.test.mjs`, node --test style per `video-controls.test.mjs`)

- `buildListenSteps` returns one step per item, in topic order, `text === hanzi`, `key === keyFor(item)`, indices 0..n-1; skips an item with empty hanzi without breaking index continuity.
- `nextStepIndex(0, 10) === 1`, `nextStepIndex(9, 10) === null`, `nextStepIndex(0, 1) === null`, `nextStepIndex(0, 0) === null`.
- `stepTimeoutMs("狗") === 4500`; grows with length; never below `MIN_STEP_TIMEOUT_MS`.
- `listenProgressLabel(2, 10) === "Playing 3 of 10"`.
- Constants: `WORD_GAP_MS === 900` (documents the contract, mirrors `PLAYBACK_RATES` test).

No DOM/hook tests — repo has no component-test infra; the hook stays thin over the tested pure logic.

### Manual QA checklist

- [ ] Topic page → Words tab shows "▶ Play all"; all ten words speak in order with a natural gap; the active card highlights and scrolls into view.
- [ ] Stop mid-run silences immediately; Play all restarts from word 1.
- [ ] Tapping an individual `SpeakButton` mid-run doesn't leave a zombie drill (drill stops or run ends cleanly — no double audio).
- [ ] Switching to another tab (Cards/Quiz) or navigating away mid-run stops audio.
- [ ] Completion shows "Played all 10 ✓" and `listen_all_completed` logs in dev console (`NEXT_PUBLIC_ANALYTICS=console` default in dev).
- [ ] With DevTools emulating no `speechSynthesis` (or Firefox private profile without voices), no Play all bar appears and the page is otherwise unchanged.
- [ ] `prefers-reduced-motion: reduce` → active-card scroll is instant, no smooth animation.
- [ ] Keyboard: Play/Stop reachable and operable; screen reader announces progress via the `role="status"` region; 360px viewport shows no layout overflow.
- [ ] Useful Phrases topic → Words tab works too (phrasebook tab untouched).

### Acceptance criteria

- One tap plays all ten words of a topic sequentially with per-word visual highlight and progress counter; Stop and re-Play work reliably.
- Gated on speech support using the existing hydration-safe detection; zero UI on unsupported devices.
- No autoplay — playback only ever starts from a user tap.
- Additive only: Words tab cards, quiz, flashcards, phrasebook, tone practice all behave exactly as before.
- `npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build` all pass; no new dependencies; no `topics.json`/schema change.

### Risk and rollback notes

- **`onend` unreliability** (Chrome/Android sometimes never fires it): mitigated by the `stepTimeoutMs` race — worst case a word's slot lasts a few extra seconds, the run never stalls.
- **Cross-feature cancel**: any `SpeakButton` calls `speechSynthesis.cancel()`, which surfaces as an `error` on the drill's in-flight utterance. The generation guard treats a live-generation interruption as a clean stop. This is the subtlest code path — review it explicitly.
- **Voice quality varies by device**; some desktops have no zh-CN voice yet still expose `speechSynthesis`. Existing "No sound?" hint covers this; same exposure as the shipped listening quiz.
- **Rollback** is trivial: the feature is three new files plus two small prop additions — revert the commit and nothing else in the app is affected. No persisted-state or data-schema changes, so no migration risk.

### Non-goals / deferrals

- No recorded/native audio files, no speech recognition, no autoplay, no loop/repeat or shuffle mode, no speed control for TTS, no English TTS interleaving, no sentence playback (words only), no Play all on `/review`, `/practice`, favorites, or the phrasebook tab, no per-word listening stats, no persistence of drill state.

### Ready-to-run Opus implementation prompt for Sprint 9

> Implement Sprint 9 ("Play all listening drill") for Learn 10 Mandarin Words. Read `AGENTS.md` first — this is Next.js 16; consult `node_modules/next/dist/docs/` before using any framework API. All work is client-side and additive; no new dependencies, no backend, no changes to `src/data/topics.json`.
>
> 1. Create `src/lib/listen-logic.ts` (pure, DOM-free, modeled on `src/lib/video-controls.ts`): `WORD_GAP_MS = 900`, `MIN_STEP_TIMEOUT_MS = 4000`, `PER_CHAR_TIMEOUT_MS = 500`, `buildListenSteps(topic, keyFor)` → `{ key, text: item.hanzi, pinyin, english, index }[]` in topic order (skip empty-hanzi items), `nextStepIndex(current, total)` → next index or `null`, `stepTimeoutMs(text)` = `MIN_STEP_TIMEOUT_MS + text.length * PER_CHAR_TIMEOUT_MS`, `listenProgressLabel(index, total)` → `"Playing 3 of 10"`.
> 2. Create `src/components/use-listen-all.ts`: a hook `useListenAll(steps, onComplete?)` returning `{ status: "idle"|"playing"|"done", activeIndex, playAll, stop }`. Speak each step with the same params as `SpeakButton` (`zh-CN`, rate 0.85, `speechSynthesis.cancel()` before speaking). Chain via utterance `end`/`error` raced against a `setTimeout(stepTimeoutMs(text))` fallback (onend is unreliable on some Chrome builds), with `WORD_GAP_MS` between words. Use a generation-counter ref so stale callbacks after `stop()`/restart are no-ops; an interruption from an external `speechSynthesis.cancel()` (e.g. a `SpeakButton` tap) must stop the drill cleanly. Clean up timers and cancel speech on unmount.
> 3. Create `src/components/topic/listen-all-bar.tsx`: Play/Stop pill (≥44px, emerald style matching the listening play button in `src/components/topic/quiz-panel.tsx`), progress counter, `role="status"` live region ("Playing 3 of 10: 狗 gǒu — dog"), idle helper "Listen straight through — each word plays once.", done copy "Played all 10 ✓ — play again?", and the existing hint "No sound? Your device may lack a Chinese voice."
> 4. Wire into `src/components/topic/words-panel.tsx` behind a new optional `speechAvailable?: boolean` prop (default false so other callers compile unchanged); highlight the active card (`ring-2 ring-emerald-400/60`, `aria-current="true"`) and `scrollIntoView({ block: "nearest" })` with smooth behavior only when `useReducedMotion()` is false. Pass the existing `speechAvailable` state from `src/components/topic-app.tsx` into `WordsPanel`. No autoplay anywhere.
> 5. Add `"listen_all_completed"` to the `AnalyticsEvent` union in `src/lib/analytics.ts` and `track` it on full-run completion with `{ topic, words }`.
> 6. Add `tests/listen-logic.test.mjs` (node --test style like `tests/video-controls.test.mjs`) covering: step order/keys/text, empty-hanzi skip, `nextStepIndex` boundaries (`(9,10)→null`, `(0,0)→null`), `stepTimeoutMs` floor and growth, progress label, and the `WORD_GAP_MS` constant.
>
> Do not modify the quiz, flashcards, phrasebook, or tone-practice features. Do not commit, push, or deploy. Finish with `npm run test && npm run validate:data && npm run validate:quality && npm run lint && npm run build` and report the results, flagging that speech chaining needs on-device manual QA (Chrome Android + iOS Safari).

---

I've inspected the repo end to end — pinyin helpers, every pinyin render site, the persistence conventions, theme tokens, and test style. The repo's own `docs/claude-next-10-sprints.md` "Sprint 10" is an unrelated offline-polish sprint; this plan is for the requested tone-colored-pinyin sprint and grounds every step in current files. Here is the plan.

---

## Sprint 10 — Optional tone-colored pinyin

### Goal and user value

Add an **opt-in "Tone colors" setting** that renders every pinyin syllable in a color keyed to its tone (the widely used convention: tone 1 red, tone 2 green, tone 3 blue, tone 4 purple, neutral gray). Tone is the hardest part of Mandarin for beginners; color gives a second, glanceable channel on top of the diacritic marks everywhere pinyin already appears — word lists, flashcard backs, review cards, favorites, and tricky-word stats. The setting is off by default, persists in `localStorage` on this device, and never removes the tone marks, so color is always additive and never the only signal.

### Current-state findings (grounded in actual files)

- **Tone derivation already exists and is well-tested.** `src/lib/pinyin.ts` exports `stripToneMarks`, `toneOfSyllable`, and `tonesOf` (`Tone = 1|2|3|4|5`, neutral = 5), deriving tones from tone-marked pinyin via vowel-cluster segmentation — no per-word tone tables. `tests/pinyin.test.mjs` covers space-separated, concatenated, ü, and neutral cases, and already imports `src/data/topics.json` for dataset-wide assertions.
- **Syllable segmentation of the raw string already exists — but privately.** `src/lib/typing-logic.ts` has a private `segmentChunk` (`typing-logic.ts:51`) that splits a separator-free chunk into per-vowel-cluster substrings aligned 1:1 with `tonesOf`, with onset consonants attaching forward and trailing consonants backward. Sprint 10 needs the same segmentation over the *original tone-marked string with separators preserved* — a new pure helper in `pinyin.ts`, not a reuse of the bare-letter path.
- **A segments-based render pattern already exists to mirror.** `src/lib/highlight.ts` returns `HighlightSegment[]` with a strict "joining segments reproduces the input" invariant, rendered by `src/components/highlighted-text.tsx` as plain React nodes. `TonePinyin` should follow exactly this shape.
- **Pinyin render sites are consistent and easy to swap.** Every primary pinyin line is a `font-hanzi … text-emerald-300` element interpolating `{item.pinyin}`:
  - `src/components/topic/words-panel.tsx:34`
  - `src/components/phrasebook-panel.tsx:44`
  - `src/components/topic/flashcards-panel.tsx:180` (card back)
  - `src/components/review-app.tsx:368` (card back; also a due-list line at `:262`)
  - `src/components/favorites-app.tsx:111`
  - `src/components/stats-app.tsx:218` (tricky words)
  - `src/components/practice-app.tsx:166` (session summary)
  - `src/components/tone-practice.tsx:98` shows *tone-stripped* syllables before checking and the full pinyin after — only the post-check reveal may be colored (pre-check coloring would leak the answer).
  - `src/components/topic-card.tsx:157` renders pinyin through `HighlightedText` with a search query — conflicting concern, defer.
- **Device-local UI preferences have a precedent outside ProgressState.** `src/components/video-player.tsx:20` persists playback rate under `"learn-10-mandarin-video-rate"` with a pure normalizer in `src/lib/video-controls.ts` (`normalizeRate`). Tone colors should follow this pattern — **not** a `ProgressState` schema bump (v4 in `src/lib/progress-logic.ts:18`), since it's a device preference, not learning progress, and must not churn export/import in `use-progress.ts`.
- **Theme tokens live in `@theme inline`** in `src/app/globals.css:8-50` (Tailwind 4), which documents a "quiet ink, one accent" policy (emerald accent; amber/rose semantic-only). New `--color-tone-*` tokens belong there with a comment scoping them as a pedagogical channel, generating `text-tone-1`…`text-tone-5` utilities.
- **Analytics is a typed union** in `src/lib/analytics.ts:15` (`AnalyticsEvent`); feature completions/toggles add a union member and call `track()`.
- **Tests are pure-logic `node --test` `.mjs` files** importing from `src/lib/*.ts` with explicit `.ts` extensions (`allowImportingTsExtensions` in tsconfig). No React component testing exists — so all colorable logic must live in `src/lib/`.
- **Toggle placement candidates:** `topic-app.tsx` renders mode tabs at `:317` with panels below — a quiet, right-aligned control row fits directly under the tabs; `review-app.tsx` has a session header area before the card scene. `topic-app.tsx:54-66` (`speechAvailable`) shows the established pattern for hydration-safe client-only state.

### Exact implementation steps in sequence

1. **`src/lib/pinyin.ts` — add `PinyinSegment` + `pinyinSegments()`.** Scan the original tone-marked string; emit alternating segments: syllable segments carrying their tone (one per vowel cluster, onset consonants attach to the following cluster, trailing consonants to the preceding one — mirroring `segmentChunk` in `typing-logic.ts`) and separator/punctuation segments with `tone: null`. Hard invariant (documented + tested): `segments.map(s => s.text).join("") === pinyin`, and the non-null tones deep-equal `tonesOf(pinyin)`.
2. **`tests/pinyin.test.mjs` — extend.** Unit cases (spaces, concatenated, hyphen/apostrophe separators, ü, neutral, empty string) plus a dataset sweep over every `item.pinyin` in `topics.json` asserting the round-trip and tones-alignment invariants (the file already imports `rawData`).
3. **`src/lib/tone-colors.ts` — new pure module.** Storage key constant, `normalizeToneColorsSetting(value: unknown): boolean` (only `"on"` → true; default off), `serializeToneColorsSetting(enabled)`, and `TONE_TEXT_CLASS: Record<Tone, string>` mapping tones to the `text-tone-*` utilities. DOM-free, mirroring `video-controls.ts`.
4. **`tests/tone-colors.test.mjs` — new.** Normalizer coercion cases (`"on"`, `"off"`, `null`, garbage, numbers), serialize/normalize round-trip, and `TONE_TEXT_CLASS` covering all five tones.
5. **`src/app/globals.css` — add tone tokens** to the `@theme inline` block: `--color-tone-1` #f87171, `--color-tone-2` #4ade80, `--color-tone-3` #60a5fa, `--color-tone-4` #c084fc, `--color-tone-5` #94a3b8, with a comment noting these are a pedagogical color channel (exempt from "one accent"), conventional red/green/blue/purple/gray, all ≥4.5:1 on `#020617`.
6. **`src/components/use-tone-colors.ts` — new hook.** Module-level store (current boolean + listener `Set`) synced to `localStorage` via `useSyncExternalStore`; server snapshot returns `false` so SSR/first paint never mismatch (colors appear after hydration, like `speechAvailable` in `topic-app.tsx`). Subscribe to the `storage` event for cross-tab sync. All storage access try/catch-wrapped (private-mode safety, matching `analytics.ts`).
7. **`src/components/tone-pinyin.tsx` — new leaf component.** Reads the hook internally so render sites change by one line and every instance stays in sync with the toggle with zero prop threading. Off → renders the raw string; on → maps `pinyinSegments` to `<span>`s with `TONE_TEXT_CLASS`, null-tone segments unwrapped. Plain React nodes, no `dangerouslySetInnerHTML` (mirrors `highlighted-text.tsx`).
8. **`src/components/tone-colors-toggle.tsx` — new chip.** A quiet Level-2 chip (`aria-pressed`, ≥44px tap target, styling borrowed from the tone-practice chips at `tone-practice.tsx:128-133`) plus, when enabled, a compact inline legend `mā má mǎ mà · ma` with each syllable in its tone color. Fires `track("tone_colors_toggled", { enabled })`.
9. **`src/lib/analytics.ts`** — add `"tone_colors_toggled"` to the `AnalyticsEvent` union.
10. **Wire the toggle** into `topic-app.tsx` (right-aligned row directly under the mode-tabs nav at `:332`) and `review-app.tsx` (in the session header above the card scene). No toggle on favorites/stats — they follow the global setting.
11. **Swap render sites** listed in findings (words-panel, phrasebook-panel, flashcards-panel back, review-app back + due list, favorites-app, stats-app, practice-app summary, and tone-practice's `checked` branch only) from `{…pinyin}` to `<TonePinyin pinyin={…} />`. Leave `topic-card.tsx` (search highlight) and the quiz/match/cloze/typing game surfaces untouched.
12. **Run the validation gate** (all five commands) and fix anything surfaced.

### Likely files touched

| File | Change |
|---|---|
| `src/lib/pinyin.ts` | add `PinyinSegment`, `pinyinSegments` |
| `src/lib/tone-colors.ts` | **new** — key, normalizer, class map |
| `src/lib/analytics.ts` | union member |
| `src/app/globals.css` | five `--color-tone-*` tokens |
| `src/components/use-tone-colors.ts` | **new** hook |
| `src/components/tone-pinyin.tsx` | **new** leaf |
| `src/components/tone-colors-toggle.tsx` | **new** chip |
| `src/components/topic-app.tsx`, `review-app.tsx` | mount toggle; swap pinyin lines |
| `src/components/topic/words-panel.tsx`, `phrasebook-panel.tsx`, `topic/flashcards-panel.tsx`, `favorites-app.tsx`, `stats-app.tsx`, `practice-app.tsx`, `tone-practice.tsx` | one-line pinyin swaps |
| `tests/pinyin.test.mjs`, `tests/tone-colors.test.mjs` | tests |

### Proposed names and signatures

```ts
// src/lib/pinyin.ts
export type PinyinSegment = { text: string; tone: Tone | null };
export function pinyinSegments(pinyin: string): PinyinSegment[];

// src/lib/tone-colors.ts
export const TONE_COLORS_STORAGE_KEY = "learn-10-mandarin-tone-colors";
export function normalizeToneColorsSetting(value: unknown): boolean; // only "on" → true
export function serializeToneColorsSetting(enabled: boolean): "on" | "off";
export const TONE_TEXT_CLASS: Record<Tone, string>; // 1→"text-tone-1" … 5→"text-tone-5"

// src/components/use-tone-colors.ts
export function useToneColors(): { enabled: boolean; toggle: () => void };

// src/components/tone-pinyin.tsx
export function TonePinyin({ pinyin }: { pinyin: string }): React.ReactNode;

// src/components/tone-colors-toggle.tsx
export function ToneColorsToggle(): React.ReactNode;
```

### UI copy / microcopy

- Chip label: **"Tone colors"** (aria-label: `"Turn tone colors on"` / `"Turn tone colors off"`, `aria-pressed` reflects state).
- Legend (shown only while enabled), each syllable in its color: **`mā  má  mǎ  mà  ·  ma`** with trailing quiet text **"neutral"**.
- One-line helper next to the toggle (ink-low, xs): **"Color each pinyin syllable by its tone. Saved on this device."**

### Test plan (`npm run test`)

- `pinyinSegments`: round-trip join invariant and `tonesOf` alignment for — single syllable, space-separated (`duì bu qǐ`), concatenated (`tùzi`, `péngyou`), hyphen/apostrophe separators, ü words (`lǜ`, `nǚ`), neutral-only, empty string → `[]`, punctuation-bearing phrase pinyin.
- Dataset sweep: both invariants over every `item.pinyin` in `topics.json` (guarantees no visible pinyin string can render wrong).
- `normalizeToneColorsSetting`: `"on"`→true; `"off"`/`null`/`undefined`/`"1"`/`true`(non-string)/garbage→false; round-trip with serializer.
- Existing suites unchanged — no behavior change when the setting is off.

### Manual QA checklist

- [ ] Fresh profile: colors off everywhere; toggle chip visible on a topic page under the mode tabs and on /review.
- [ ] Toggle on → words list, phrasebook (a Useful Phrases topic), flashcard back, review card back, favorites, stats tricky words, practice summary all show per-syllable colors; tone marks still visible.
- [ ] Multi-syllable words (`péngyou`, `duì bu qǐ`) color each syllable independently; separators/spacing unchanged.
- [ ] Tone practice: pre-check pinyin stays uncolored/stripped (no answer leak); post-check reveal is colored.
- [ ] Toggle state survives reload; second tab follows via `storage` event; private mode (storage blocked) doesn't crash and behaves as off.
- [ ] No hydration warning in dev console with the setting on (SSR renders plain, colors apply post-hydration).
- [ ] Search results on the home page still show emerald match highlighting (untouched).
- [ ] Progress export file contains no tone-colors field; import of an old file unaffected.
- [ ] Keyboard: chip focusable with visible emerald focus ring; screen reader announces pressed state.

### Acceptance criteria

1. Off by default; zero visual change until enabled.
2. One tap enables/disables globally; persists per device in `localStorage` under its own key (no `ProgressState` schema bump).
3. Colors derive solely from existing tone-marked pinyin via `pinyinSegments`; no per-word color data added to `topics.json`.
4. Joining segments always reproduces the source string (dataset-verified); tone marks are never removed, so color is never the only channel.
5. All five gate commands pass.

### Risk and rollback notes

- **Segmentation drift vs. `tonesOf`** would color the wrong syllable — mitigated by the dataset-sweep test asserting alignment on every real word.
- **Hydration mismatch** if the stored value were read during render — mitigated by `useSyncExternalStore` with a `false` server snapshot.
- **Palette collision:** tone-1 red sits near the app's rose "danger" and tone-2 green near the emerald accent; tokens are scoped/commented as a separate pedagogical channel and only ever applied to pinyin glyphs, never controls.
- **Rollback is trivial:** the feature is additive and off by default — revert the commit, or as a hotfix stop rendering `ToneColorsToggle` (every `TonePinyin` then stays plain unless previously enabled; full revert removes the leaf swaps). No data migration to undo.

### Non-goals / deferrals

- No tone-colored **hanzi** characters (only pinyin lines).
- No coloring inside search-highlighted text (`topic-card.tsx` + `HighlightedText`), quiz answer options, match tiles, cloze, or typing-feedback strings.
- No per-surface or per-tone-scheme customization (single conventional palette).
- No sync of the preference into progress export/import or future cloud sync.
- No changes to `topics.json`, validators, or video pipeline.

### Ready-to-run Opus implementation prompt for Sprint 10

```text
You are implementing Sprint 10 ("Optional tone-colored pinyin") in the learn-10-mandarin-words
repo (Next.js 16 / React 19 / Tailwind 4, static + localStorage-only). Follow AGENTS.md: this
Next.js version has breaking changes — consult node_modules/next/dist/docs/ before touching any
framework-level API (you should not need new routes; all work is client components + pure libs).

Build an opt-in, device-local "Tone colors" setting that colors each pinyin syllable by tone
(1 red, 2 green, 3 blue, 4 purple, 5/neutral gray). Default OFF. Never strip tone marks.

1) src/lib/pinyin.ts: add
   export type PinyinSegment = { text: string; tone: Tone | null };
   export function pinyinSegments(pinyin: string): PinyinSegment[];
   Segment the ORIGINAL tone-marked string: one segment per vowel-cluster syllable (onset
   consonants attach to the following cluster, trailing consonants to the preceding syllable —
   mirror segmentChunk in src/lib/typing-logic.ts), separators/punctuation become tone:null
   segments. Invariants: segments' text joins back to the exact input, and the non-null tones
   deep-equal tonesOf(pinyin).

2) src/lib/tone-colors.ts (new, DOM-free, mirroring src/lib/video-controls.ts):
   TONE_COLORS_STORAGE_KEY = "learn-10-mandarin-tone-colors";
   normalizeToneColorsSetting(value: unknown): boolean  // only "on" → true
   serializeToneColorsSetting(enabled: boolean): "on" | "off";
   TONE_TEXT_CLASS: Record<Tone, string> → "text-tone-1" … "text-tone-5".

3) src/app/globals.css @theme inline: add --color-tone-1 #f87171, --color-tone-2 #4ade80,
   --color-tone-3 #60a5fa, --color-tone-4 #c084fc, --color-tone-5 #94a3b8, commented as a
   pedagogical color channel (documented exemption from the "one accent" rule).

4) src/components/use-tone-colors.ts (new): useToneColors(): { enabled, toggle } via
   useSyncExternalStore over a module-level store persisted to localStorage (try/catch all
   storage access; subscribe to the "storage" event for cross-tab sync; SERVER SNAPSHOT = false
   so there is no hydration mismatch). Do NOT touch ProgressState / progress schema / export-import.

5) src/components/tone-pinyin.tsx (new): TonePinyin({ pinyin }) reads useToneColors internally;
   off → raw string; on → spans per pinyinSegments using TONE_TEXT_CLASS (plain React nodes,
   pattern of highlighted-text.tsx). Inherit font/size from the parent element.

6) src/components/tone-colors-toggle.tsx (new): quiet chip (aria-pressed, min 44px, style like
   the tone-practice chips), label "Tone colors", helper text "Color each pinyin syllable by its
   tone. Saved on this device.", and — only while enabled — an inline legend "mā má mǎ mà · ma"
   each syllable in its tone color with quiet "neutral" after the last. On toggle call
   track("tone_colors_toggled", { enabled }); add that member to AnalyticsEvent in src/lib/analytics.ts.

7) Mount ToneColorsToggle in src/components/topic-app.tsx (right-aligned row directly under the
   mode-tabs nav) and src/components/review-app.tsx (session header above the card). Swap these
   pinyin render sites to <TonePinyin pinyin={…} /> keeping surrounding classes intact:
   topic/words-panel.tsx:34, phrasebook-panel.tsx:44, topic/flashcards-panel.tsx:180,
   review-app.tsx:368 and the due-list line at :262, favorites-app.tsx:111, stats-app.tsx:218,
   practice-app.tsx:166, and tone-practice.tsx:98 ONLY in its `checked` (post-reveal) branch —
   the pre-check stripped-syllable prompt must stay uncolored (answer leak). Do NOT touch
   topic-card.tsx search highlighting or the quiz/match/cloze/typing surfaces.

8) Tests (node --test style, import from ../src/lib/*.ts with explicit extensions):
   extend tests/pinyin.test.mjs with pinyinSegments unit cases (spaces, concatenated, hyphens,
   apostrophes, ü, neutral, empty, punctuation) PLUS a sweep over every item.pinyin in
   src/data/topics.json asserting both invariants; new tests/tone-colors.test.mjs for the
   normalizer/serializer and TONE_TEXT_CLASS completeness.

Constraints: no new dependencies, no backend, no invented vocabulary or data changes, sleek
quiet-ink UI conventions preserved (emerald stays the sole UI accent), color must never be the
only channel (tone marks remain).

Validation gate — all must pass before you finish:
  npm run test
  npm run validate:data
  npm run validate:quality
  npm run lint
  npm run build
```
