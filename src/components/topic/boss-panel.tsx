"use client";

import { useState } from "react";
import type { Topic, VocabItem, BossStat } from "@/lib/types";
import type { Tone } from "@/lib/pinyin";
import { wordKey } from "@/lib/data-logic";
import { defaultShuffle } from "@/lib/quiz-logic";
import type { QuizCard } from "@/lib/quiz-logic";
import { CLOZE_BLANK } from "@/lib/cloze-logic";
import type { ClozeCard } from "@/lib/cloze-logic";
import { gradeTypedPinyin, parseTypedPinyin, toneNumberForm, type TypedGrade } from "@/lib/typing-logic";
import { BOSS_STAGE_COUNT, buildBossRound, type BossRound, type BossStage } from "@/lib/boss-logic";
import { resolveBossShortcut } from "@/lib/panel-shortcut-logic";
import { usePanelShortcuts } from "../use-panel-shortcuts";
import { track } from "@/lib/analytics";
import { HANZI_LANG, PINYIN_LANG } from "@/lib/lang";
import { SpeakButton } from "../speak-button";

// The "Boss" tab: a four-question capstone gauntlet — one question per skill
// (meaning quiz, sentence cloze, tone check, typed pinyin), each on a DIFFERENT
// word from the topic. All round/question logic lives in src/lib/boss-logic.ts
// (which composes the existing pure builders); this panel only holds the run
// state and renders each stage in the existing visual language. Every stage
// records once through the same recordQuizAnswer path as its standalone drill,
// so boss answers feed Trickiest words, /practice, streaks, and the daily goal.
// A flawless run crowns the topic (persisted via onComplete → recordBossResult).

const TONE_LABELS: Record<Tone, string> = {
  1: "1 ˉ",
  2: "2 ˊ",
  3: "3 ˇ",
  4: "4 ˋ",
  5: "5 ·",
};

// Fixed tracker label + kicker verb per stage kind. Order is fixed
// quiz → cloze → tone → typing (a defensively-substituted quiz keeps its slot).
const STAGE_META: Record<BossStage["kind"], { label: string; verb: string }> = {
  quiz: { label: "Meaning", verb: "pick the meaning" },
  cloze: { label: "Sentence", verb: "fill the blank" },
  tone: { label: "Tones", verb: "call the tones" },
  typing: { label: "Pinyin", verb: "type the pinyin" },
};

type Phase = "intro" | "running" | "result";

export function BossPanel({
  topic,
  bossStat,
  speechAvailable,
  shortcutsEnabled = true,
  onRecord,
  onComplete,
}: {
  topic: Topic;
  bossStat: BossStat | undefined;
  speechAvailable: boolean;
  // When false (help overlay open), keyboard shortcuts are inert. Default true.
  shortcutsEnabled?: boolean;
  onRecord: (key: string, correct: boolean) => void;
  onComplete: (score: number) => void;
}): React.JSX.Element | null {
  const keyFor = (item: VocabItem) => wordKey(topic, item);

  // The round is built once per mount/restart so answering never reshuffles it.
  const [round, setRound] = useState<BossRound>(() =>
    buildBossRound(topic.items, topic.items, keyFor, defaultShuffle),
  );
  const [phase, setPhase] = useState<Phase>("intro");
  const [stageIndex, setStageIndex] = useState(0);
  // One boolean per resolved stage (true = passed), in stage order.
  const [results, setResults] = useState<boolean[]>([]);

  // Keyboard layer for the panel-level phases (Sprint 20): Enter starts from the
  // intro, Enter/R restarts from the result. The per-stage running phases own
  // their own hooks (mounted only while running), so these stay mutually exclusive.
  usePanelShortcuts({
    enabled: shortcutsEnabled && (phase === "intro" || phase === "result"),
    resolve: (key, target) =>
      resolveBossShortcut(key, { ...target, phase: phase === "intro" ? "intro" : "result" }),
    onIntent: (intent) => {
      if (intent.type === "start") setPhase("running");
      else if (intent.type === "again") restart();
    },
  });

  // Defensive: a topic with no words can't run a boss (the dataset guarantees
  // ≥4, so this never triggers on real data).
  if (round.stages.length === 0) return null;

  const total = round.stages.length;
  const score = results.filter(Boolean).length;

  function restart() {
    setRound(buildBossRound(topic.items, topic.items, keyFor, defaultShuffle));
    setStageIndex(0);
    setResults([]);
    setPhase("running");
  }

  // Called by the active stage once the learner advances past it. Accumulates the
  // pass/fail, then either moves to the next stage or ends the run — persisting
  // the outcome exactly once and firing the (local, no-network) analytics event.
  function resolveStage(passed: boolean) {
    const nextResults = [...results, passed];
    if (stageIndex + 1 >= total) {
      const finalScore = nextResults.filter(Boolean).length;
      setResults(nextResults);
      setPhase("result");
      onComplete(finalScore);
      track("boss_round_completed", {
        topic: topic.slug,
        score: finalScore,
        total,
        crowned: finalScore === total,
      });
      return;
    }
    setResults(nextResults);
    setStageIndex((i) => i + 1);
  }

  // ── Intro ──
  if (phase === "intro") {
    return (
      <section
        className="mt-6 rounded-3xl border border-white/10 bg-surface p-8 text-center"
        aria-label="Topic boss round"
      >
        <p className="text-6xl">👑</p>
        <h2 className="mt-4 text-2xl font-semibold text-white">Topic Boss Round</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-300">
          Four questions, four skills — meaning, sentence, tones, and typed pinyin — each on a
          different word. Answer all four correctly to crown this topic.
        </p>
        {bossStat ? (
          <p className="mt-4 text-sm font-semibold text-emerald-300">
            {bossStat.crownedAt ? "👑 Crowned · " : ""}
            Best so far: {bossStat.bestScore}/{BOSS_STAGE_COUNT} · {bossStat.attempts}{" "}
            {bossStat.attempts === 1 ? "attempt" : "attempts"}
          </p>
        ) : null}
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setPhase("running")}
            className="min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cta"
          >
            Start the boss round
          </button>
        </div>
      </section>
    );
  }

  // ── Result ──
  if (phase === "result") {
    const crowned = score === total;
    const nearMiss = score === total - 1;
    return (
      <section
        className="mt-6 rounded-3xl border border-white/10 bg-surface p-8 text-center"
        aria-label="Boss round result"
      >
        <p className={`text-6xl ${crowned ? "animate-celebrate" : ""}`}>{crowned ? "👑" : nearMiss ? "💪" : "🎯"}</p>
        <p className="mt-4 text-2xl font-semibold text-white" role="status">
          {crowned ? "Topic crowned!" : nearMiss ? "The boss survives — barely." : `${score}/${total}`}
        </p>
        <p className="mt-3 text-5xl font-bold text-emerald-300">
          {score}
          <span className="text-2xl text-slate-400">/{total}</span>
        </p>
        <p className="mx-auto mt-3 max-w-md text-slate-400">
          {crowned
            ? `All four skills, one clean run. ${topic.titleEn} is yours.`
            : nearMiss
              ? `${score}/${total} — one skill away from the crown.`
              : `${score}/${total} — warm up in the practice tabs, then come back for the crown.`}
        </p>
        <div className="mt-6">
          <button
            type="button"
            onClick={restart}
            className="min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cta"
          >
            {crowned ? "Defend the crown" : "Challenge again"}
          </button>
        </div>
      </section>
    );
  }

  // ── Running: one stage at a time ──
  const stage = round.stages[stageIndex];
  return (
    <section
      className="mt-6 rounded-3xl border border-white/10 bg-surface p-6"
      aria-label="Topic boss round"
    >
      {/* Stage tracker: one chip per stage, showing pending / ✓ / ✗. */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-400">
          Boss {stageIndex + 1} of {total} — {STAGE_META[stage.kind].verb}
        </p>
        <p className="text-sm font-semibold text-emerald-300">
          {score}/{total}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2" aria-label="Boss progress">
        {round.stages.map((s, i) => {
          const resolved = i < results.length;
          const passed = resolved && results[i];
          const isCurrent = i === stageIndex;
          return (
            <span
              key={i}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition
                ${resolved && passed ? "border-emerald-300/50 bg-emerald-300/10 text-emerald-200" : ""}
                ${resolved && !passed ? "border-rose-400/50 bg-rose-400/10 text-rose-200" : ""}
                ${!resolved && isCurrent ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-200" : ""}
                ${!resolved && !isCurrent ? "border-white/10 text-slate-500" : ""}
              `}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span aria-hidden="true">{resolved ? (passed ? "✓" : "✗") : "•"}</span>
              {STAGE_META[s.kind].label}
            </span>
          );
        })}
      </div>

      {/* Each stage owns its own answer state; a per-index key resets it between
          stages. It records once via onRecord, then calls resolveStage on Next. */}
      <BossStageView
        key={stageIndex}
        stage={stage}
        isLast={stageIndex + 1 >= total}
        speechAvailable={speechAvailable}
        onRecord={onRecord}
        onResolve={resolveStage}
      />
    </section>
  );
}

// ── One stage's UI, dispatched by kind ──────────────────────────────────────────

function BossStageView({
  stage,
  isLast,
  speechAvailable,
  onRecord,
  onResolve,
}: {
  stage: BossStage;
  isLast: boolean;
  speechAvailable: boolean;
  onRecord: (key: string, correct: boolean) => void;
  onResolve: (passed: boolean) => void;
}) {
  switch (stage.kind) {
    case "quiz":
      return <QuizStage card={stage.card} isLast={isLast} speechAvailable={speechAvailable} onRecord={onRecord} onResolve={onResolve} />;
    case "cloze":
      return <ClozeStage card={stage.card} isLast={isLast} onRecord={onRecord} onResolve={onResolve} />;
    case "tone":
      return <ToneStage item={stage.item} keyName={stage.key} tones={stage.tones} syllables={stage.syllables} isLast={isLast} onRecord={onRecord} onResolve={onResolve} />;
    case "typing":
      return <TypingStage item={stage.item} keyName={stage.key} isLast={isLast} onRecord={onRecord} onResolve={onResolve} />;
  }
}

// A "Next" / "See result" button, shared by every stage once it's been graded.
function NextButton({ isLast, passed, onResolve }: { isLast: boolean; passed: boolean; onResolve: (passed: boolean) => void }) {
  return (
    <div className="mt-6 text-center">
      <button
        type="button"
        onClick={() => onResolve(passed)}
        className="min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cta"
      >
        {isLast ? "See result" : "Next question"}
      </button>
    </div>
  );
}

// ── Stage 1: meaning (multiple choice) ──
function QuizStage({
  card,
  isLast,
  speechAvailable,
  onRecord,
  onResolve,
}: {
  card: QuizCard;
  isLast: boolean;
  speechAvailable: boolean;
  onRecord: (key: string, correct: boolean) => void;
  onResolve: (passed: boolean) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const answered = picked !== null;
  const passed = picked === card.answer;

  function answer(choice: string) {
    if (picked !== null) return;
    const correct = choice === card.answer;
    onRecord(card.key, correct); // fires once — same as the Quiz tab
    setPicked(choice);
  }

  return (
    <>
      <div className="mt-6 text-center">
        <div className="flex items-center justify-center gap-3">
          <h3 lang={HANZI_LANG} className="font-hanzi text-6xl font-semibold text-white">{card.prompt}</h3>
          {answered && speechAvailable ? (
            <SpeakButton text={card.prompt} label={`Pronounce ${card.prompt}`} />
          ) : null}
        </div>
        {/* Pinyin revealed only after answering, so the prompt can't leak the tone. */}
        {answered && card.promptPinyin ? (
          <p lang={PINYIN_LANG} className="font-hanzi mt-2 text-xl text-emerald-300">{card.promptPinyin}</p>
        ) : null}
      </div>

      <div className="mt-8 grid gap-3 md:grid-cols-2" role="listbox" aria-label="Answer choices">
        {card.choices.map((choice) => {
          const right = answered && choice === card.answer;
          const wrong = picked === choice && choice !== card.answer;
          return (
            <button
              key={choice}
              type="button"
              onClick={() => answer(choice)}
              role="option"
              aria-selected={picked === choice}
              aria-disabled={answered && picked !== choice}
              className={`min-h-[52px] rounded-2xl border px-5 py-4 text-center transition
                ${right ? "animate-quiz-correct border-emerald-300 bg-cta text-slate-950" : ""}
                ${wrong ? "animate-quiz-wrong border-rose-400 bg-rose-400/20 text-rose-200" : ""}
                ${!right && !wrong ? "border-white/10 bg-surface-2 text-white hover:border-emerald-300" : ""}
              `}
            >
              {choice}
            </button>
          );
        })}
      </div>

      {answered ? (
        <>
          <p
            className={`mt-6 text-center text-sm font-semibold ${passed ? "text-emerald-300" : "text-rose-300"}`}
            role="status"
          >
            {passed ? "Correct — meaning nailed." : `Not quite — it means “${card.answer}”.`}
          </p>
          <NextButton isLast={isLast} passed={passed} onResolve={onResolve} />
        </>
      ) : null}
    </>
  );
}

// ── Stage 2: sentence (cloze) ──
function ClozeStage({
  card,
  isLast,
  onRecord,
  onResolve,
}: {
  card: ClozeCard;
  isLast: boolean;
  onRecord: (key: string, correct: boolean) => void;
  onResolve: (passed: boolean) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(true);
  const answered = picked !== null;
  const passed = picked === card.hanzi;
  const [before, after] = card.prompt.split(CLOZE_BLANK);

  function answer(choice: string) {
    if (picked !== null) return;
    onRecord(card.key, choice === card.hanzi); // fires once — same as the Sentences tab
    setPicked(choice);
  }

  return (
    <>
      <p lang={HANZI_LANG} className="font-hanzi mt-8 text-center text-3xl leading-relaxed text-white">
        {before}
        {answered ? (
          <span className="text-emerald-300">{card.hanzi}</span>
        ) : (
          <span role="img" aria-label="blank" className="mx-0.5 border-b-2 border-emerald-300 px-1">
            {CLOZE_BLANK}
          </span>
        )}
        {after}
      </p>

      <div className="mt-4 text-center">
        {showHint ? <p className="text-sm text-slate-400">{card.sentenceEn}</p> : null}
        <button
          type="button"
          onClick={() => setShowHint((v) => !v)}
          className="mt-1 min-h-[36px] text-xs font-semibold text-emerald-300 transition hover:text-emerald-200"
          aria-pressed={showHint}
        >
          {showHint ? "Hide English hint" : "Show English hint"}
        </button>
      </div>

      <div className="mt-8 grid gap-3 md:grid-cols-2" role="listbox" aria-label="Answer choices">
        {card.choices.map((choice) => {
          const right = answered && choice === card.hanzi;
          const wrong = picked === choice && choice !== card.hanzi;
          return (
            <button
              key={choice}
              type="button"
              onClick={() => answer(choice)}
              role="option"
              aria-selected={picked === choice}
              aria-disabled={answered && picked !== choice}
              className={`min-h-[52px] rounded-2xl border px-5 py-4 text-center transition
                ${right ? "animate-quiz-correct border-emerald-300 bg-cta text-slate-950" : ""}
                ${wrong ? "animate-quiz-wrong border-rose-400 bg-rose-400/20 text-rose-200" : ""}
                ${!right && !wrong ? "border-white/10 bg-surface-2 text-white hover:border-emerald-300" : ""}
              `}
            >
              <span lang={HANZI_LANG} className="font-hanzi text-2xl">{choice}</span>
            </button>
          );
        })}
      </div>

      {answered ? (
        <div role="status" className="mt-6 rounded-2xl border border-white/10 bg-surface-2 p-5">
          <div className="flex flex-wrap items-baseline justify-center gap-3 text-center">
            <span lang={HANZI_LANG} className="font-hanzi text-2xl text-white">{card.hanzi}</span>
            <span lang={PINYIN_LANG} className="font-hanzi text-lg text-emerald-300">{card.pinyin}</span>
            <span className="text-sm text-slate-400">{card.english}</span>
          </div>
          <div className="mt-3 flex items-center justify-center gap-3">
            <p lang={HANZI_LANG} className="font-hanzi text-base text-slate-300">{card.sentenceCn}</p>
            <SpeakButton text={card.sentenceCn} label="Hear the full sentence" />
          </div>
          <NextButton isLast={isLast} passed={passed} onResolve={onResolve} />
        </div>
      ) : null}
    </>
  );
}

// ── Stage 3: tones (per-syllable 1–5 chips) ──
function ToneStage({
  item,
  keyName,
  tones,
  syllables,
  isLast,
  onRecord,
  onResolve,
}: {
  item: VocabItem;
  keyName: string;
  tones: Tone[];
  syllables: string[];
  isLast: boolean;
  onRecord: (key: string, correct: boolean) => void;
  onResolve: (passed: boolean) => void;
}) {
  const [picks, setPicks] = useState<(Tone | null)[]>([]);
  const [checked, setChecked] = useState(false);
  const complete = picks.length === tones.length && picks.every((p) => p !== null);
  const passed = checked && picks.every((p, i) => p === tones[i]);

  function pick(sIdx: number, tone: Tone) {
    if (checked) return;
    setPicks((prev) => {
      const next = [...prev];
      while (next.length < tones.length) next.push(null);
      next[sIdx] = tone;
      return next;
    });
  }

  function check() {
    if (!complete || checked) return;
    const allCorrect = picks.every((p, i) => p === tones[i]);
    onRecord(keyName, allCorrect); // fires once — like the Tone check
    setChecked(true);
  }

  return (
    <>
      <div className="mt-6 text-center">
        <div className="flex items-center justify-center gap-3">
          <h3 lang={HANZI_LANG} className="font-hanzi text-6xl font-semibold text-white">{item.hanzi}</h3>
          <SpeakButton text={item.hanzi} label={`Pronounce ${item.hanzi}`} />
        </div>
        {/* Bare (tone-stripped) syllables before check; full tone-marked pinyin after. */}
        <p lang={PINYIN_LANG} className="font-hanzi mt-2 text-2xl text-slate-400">
          {checked ? item.pinyin : syllables.join(" ")}
        </p>
        <p className="mt-1 text-sm text-slate-500">{item.english}</p>
      </div>

      <div className="mt-6 space-y-3">
        {tones.map((correctTone, sIdx) => {
          const picked = picks[sIdx] ?? null;
          const label = syllables.length === tones.length ? syllables[sIdx] : `Syllable ${sIdx + 1}`;
          return (
            <div key={sIdx} className="flex flex-wrap items-center gap-2">
              <span lang={PINYIN_LANG} className="font-hanzi w-20 shrink-0 text-sm text-slate-300">{label}</span>
              <div className="flex flex-wrap gap-2" role="group" aria-label={`Tone for ${label}`}>
                {([1, 2, 3, 4, 5] as Tone[]).map((tone) => {
                  const isPicked = picked === tone;
                  const showRight = checked && tone === correctTone;
                  const showWrong = checked && isPicked && tone !== correctTone;
                  return (
                    <button
                      key={tone}
                      type="button"
                      onClick={() => pick(sIdx, tone)}
                      aria-pressed={isPicked}
                      aria-label={`Tone ${tone === 5 ? "neutral" : tone} for ${label}`}
                      disabled={checked}
                      className={`min-h-[44px] min-w-[44px] rounded-xl border px-3 py-2 text-sm font-semibold transition
                        ${showRight ? "border-emerald-300 bg-cta text-slate-950" : ""}
                        ${showWrong ? "border-rose-400 bg-rose-400/20 text-rose-200" : ""}
                        ${!showRight && !showWrong && isPicked ? "border-emerald-300 bg-emerald-400/10 text-white" : ""}
                        ${!showRight && !showWrong && !isPicked ? "border-white/10 bg-white/[0.04] text-slate-200 hover:border-white/25" : ""}
                      `}
                    >
                      {TONE_LABELS[tone]}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {!checked ? (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={check}
            disabled={!complete}
            className="min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cta disabled:cursor-not-allowed disabled:opacity-40"
          >
            Check tones
          </button>
          <p className="mt-4 text-xs text-slate-600">Pick the tone for each syllable (1–4, or 5 for neutral).</p>
        </div>
      ) : (
        <>
          <p className={`mt-6 text-center text-sm font-semibold ${passed ? "text-emerald-300" : "text-rose-300"}`} role="status">
            {passed ? "Correct — nice ear!" : "Not quite — the correct tones are shown."}
          </p>
          <NextButton isLast={isLast} passed={passed} onResolve={onResolve} />
        </>
      )}
    </>
  );
}

// ── Stage 4: typed pinyin ──
function TypingStage({
  item,
  keyName,
  isLast,
  onRecord,
  onResolve,
}: {
  item: VocabItem;
  keyName: string;
  isLast: boolean;
  onRecord: (key: string, correct: boolean) => void;
  onResolve: (passed: boolean) => void;
}) {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<TypedGrade | null>(null);
  // Only a perfect answer passes; "tones-off" fails, matching the Type tab.
  const passed = result === "correct";
  const canCheck = result === null && parseTypedPinyin(input).length > 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (result !== null) return;
    if (parseTypedPinyin(input).length === 0) return;
    const grade = gradeTypedPinyin(input, item.pinyin);
    onRecord(keyName, grade === "correct"); // fires once — like the Type tab
    setResult(grade);
  }

  const marked = item.pinyin;
  const numbered = toneNumberForm(item.pinyin);

  return (
    <>
      <div className="mt-6 text-center">
        <div className="flex items-center justify-center gap-3">
          <h3 lang={HANZI_LANG} className="font-hanzi text-7xl font-semibold text-white">{item.hanzi}</h3>
          <SpeakButton text={item.hanzi} label={`Pronounce ${item.hanzi}`} />
        </div>
        <p className="mt-2 text-sm text-slate-500">{item.english}</p>
      </div>

      <form onSubmit={submit} className="mt-6">
        <label htmlFor="boss-typing-input" className="sr-only">
          Type the pinyin for {item.hanzi}
        </label>
        <input
          id="boss-typing-input"
          type="text"
          lang={PINYIN_LANG}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          disabled={result !== null}
          placeholder="e.g. gǒu, gou3, or gou"
          className="font-hanzi w-full rounded-2xl border border-white/10 bg-surface-2 px-5 py-3 text-center text-base text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-300 disabled:opacity-60"
        />
        {result === null ? (
          <div className="mt-4 text-center">
            <button
              type="submit"
              disabled={!canCheck}
              className="min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cta disabled:cursor-not-allowed disabled:opacity-40"
            >
              Check
            </button>
          </div>
        ) : null}
      </form>

      {result !== null ? (
        <>
          <div
            role="status"
            className={`mt-5 rounded-2xl border px-5 py-4 text-center text-sm font-semibold
              ${result === "correct" ? "border-emerald-300/50 bg-emerald-300/10 text-emerald-200" : ""}
              ${result === "tones-off" ? "border-amber-400/50 bg-amber-400/10 text-amber-200" : ""}
              ${result === "incorrect" ? "border-rose-400/50 bg-rose-400/10 text-rose-200" : ""}
            `}
          >
            {result === "correct" ? (
              <>Correct — <span lang={PINYIN_LANG} className="font-hanzi">{marked}</span>.</>
            ) : result === "tones-off" ? (
              <>
                Letters right, tones off — it&apos;s <span lang={PINYIN_LANG} className="font-hanzi">{marked}</span> (
                <span lang={PINYIN_LANG} className="font-hanzi">{numbered}</span>).
              </>
            ) : (
              <>
                It&apos;s <span lang={PINYIN_LANG} className="font-hanzi">{marked}</span> (
                <span lang={PINYIN_LANG} className="font-hanzi">{numbered}</span>).
              </>
            )}
          </div>
          <NextButton isLast={isLast} passed={passed} onResolve={onResolve} />
        </>
      ) : null}
    </>
  );
}
