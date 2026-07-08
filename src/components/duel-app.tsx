"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { HomeData, TopicSummary, VocabItemSummary } from "@/lib/types";
import { defaultShuffle, type QuizMode } from "@/lib/quiz-logic";
import {
  QUESTIONS_PER_PLAYER,
  advanceTurn,
  answerCurrent,
  beginQuestion,
  buildDuelTurns,
  currentTurn,
  duelResult,
  headToHeadFor,
  startDuel,
  type DuelPlayerIndex,
  type DuelState,
  type HeadToHead,
} from "@/lib/duel-logic";
import { HANZI_LANG, PINYIN_LANG, quizChoiceLang, quizPromptLang } from "@/lib/lang";
import { DUEL_NAME_MAX_LENGTH } from "@/lib/duel-logic";
import { track } from "@/lib/analytics";
import { vibrateFeedback } from "./use-haptics";
import { useDuelHistory } from "./use-duel-history";
import { useSpeech } from "./use-speech";
import { usePracticeShortcuts } from "./use-practice-shortcuts";
import { LoadingScreen } from "./loading-screen";
import { SpeakButton } from "./speak-button";
import { TonePinyin } from "./tone-pinyin";

// Pass-and-play duel: two learners share one device and alternate answering
// multiple-choice questions from one topic. All turn/score/phase rules live in
// the pure src/lib/duel-logic.ts state machine; this component only renders the
// four screens (setup → handoff → question → results) and dispatches transitions.
//
// It deliberately does NOT import useProgress/recordQuizAnswer/gradeWord — a duel
// is two people, so it must never touch the owner's quizStats, flashcardStats,
// streak, or daily-goal ring. Names + past results persist under their own key
// via useDuelHistory.

const MODE_OPTIONS = [
  { key: "hanzi-english", label: "Hanzi → English" },
  { key: "english-hanzi", label: "English → Hanzi" },
  { key: "hanzi-pinyin", label: "Hanzi → Pinyin" },
] as const;

// wordKey for a duel card: `topic.slug:hanzi` (same shape as the rest of the app,
// though duel keys are only used in-memory to collect missed words).
function keyForItem(topic: TopicSummary): (item: VocabItemSummary) => string {
  return (item) => `${topic.slug}:${item.hanzi}`;
}

export function DuelApp({ data }: { data: HomeData }) {
  const { history, loaded, setNames, recordResult } = useDuelHistory();
  const { availability, speak } = useSpeech();
  // Connectivity-aware gate (Sprint 27): "ready" only. When offline with an
  // online-only voice the listening mode option disappears and the existing
  // `effectiveMode` fallback below routes any in-flight listening duel to
  // Hanzi → English, so a started duel never stalls on silent audio.
  const speechAvailable = availability === "ready";

  // Setup fields.
  const [nameA, setNameA] = useState("");
  const [nameB, setNameB] = useState("");
  const [topicSlug, setTopicSlug] = useState<string>(data.topics[0]?.slug ?? "");
  const [mode, setMode] = useState<QuizMode>("hanzi-english");

  // The live duel, or null while on the setup screen.
  const [state, setState] = useState<DuelState | null>(null);
  // Guards the once-only "duel_completed" record/track on reaching the done phase.
  const recordedRef = useRef(false);

  // Seed the name inputs from remembered names exactly once after storage loads
  // (adjust-state-during-render, like practice-app's session snapshot). A plain
  // effect would fight the user's typing; this fires a single time.
  const [seeded, setSeeded] = useState(false);
  if (loaded && !seeded) {
    setSeeded(true);
    if (history.names[0]) setNameA(history.names[0]);
    if (history.names[1]) setNameB(history.names[1]);
  }

  const displayNames: [string, string] = [
    nameA.trim() || "Player 1",
    nameB.trim() || "Player 2",
  ];

  const topic = data.topics.find((t) => t.slug === topicSlug) ?? data.topics[0];
  const canDuel = Boolean(topic && topic.items.length >= 2);

  // If the chosen mode is Listen but this device has no voice, fall back so the
  // duel never starts in a dead mode.
  const effectiveMode: QuizMode = mode === "listening" && !speechAvailable ? "hanzi-english" : mode;

  function startNewDuel(firstPlayer: DuelPlayerIndex = 0) {
    if (!topic || topic.items.length < 2) return;
    const turns = buildDuelTurns(
      topic.items,
      effectiveMode,
      keyForItem(topic),
      QUESTIONS_PER_PLAYER,
      defaultShuffle,
    );
    // For a rematch the loser starts: flip the player indices so turn 0 belongs
    // to them (alternation and equal counts are preserved).
    const arranged =
      firstPlayer === 0
        ? turns
        : turns.map((t) => ({ ...t, player: (t.player === 0 ? 1 : 0) as DuelPlayerIndex }));
    recordedRef.current = false;
    setNames(displayNames);
    setState(startDuel(arranged));
  }

  // Record the finished duel once, when it first reaches the done phase.
  useEffect(() => {
    if (state?.phase !== "done" || recordedRef.current) return;
    if (state.turns.length === 0) return; // guarded start never produces this
    recordedRef.current = true;
    const { scores } = duelResult(state);
    recordResult({
      at: new Date().toISOString(),
      topicSlug,
      mode: effectiveMode,
      scores,
      names: displayNames,
    });
    track("duel_completed", {
      topic: topicSlug,
      mode: effectiveMode,
      scoreA: scores[0],
      scoreB: scores[1],
    });
    // topicSlug/effectiveMode are stable for a given duel; keying on phase is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phase]);

  // ── Transition dispatchers (all pure state-machine calls) ──
  const current = state ? currentTurn(state) : null;
  const card = current?.card ?? null;

  function handleAnswer(choice: string) {
    // answerCurrent is a pure dispatch, so compute correctness here (guarded on
    // the current card and the question phase) purely to drive the vibration.
    if (card && state?.phase === "question") {
      vibrateFeedback(choice === card.answer ? "correct" : "incorrect");
    }
    setState((s) => (s ? answerCurrent(s, choice) : s));
  }
  function handleAdvance() {
    setState((s) => (s ? advanceTurn(s) : s));
  }
  function handleBegin() {
    setState((s) => (s ? beginQuestion(s) : s));
  }

  // Keyboard shortcuts — reused from /practice. Disabled during setup and the
  // handoff interstitial (so a key can't leak past the "pass the phone" screen);
  // name inputs are editable targets and already guarded inside the hook.
  const inGame = !!state && (state.phase === "question" || state.phase === "answered" || state.phase === "done");
  usePracticeShortcuts({
    enabled: inGame,
    phase: state?.phase === "done" ? "done" : state?.phase === "answered" ? "answered" : "question",
    choiceCount: card?.choices.length ?? 0,
    onChoose: (i) => {
      const c = card?.choices[i];
      if (c && state?.phase === "question") handleAnswer(c);
    },
    onNext: handleAdvance,
    onSpeak: () => {
      if (card && effectiveMode !== "english-hanzi") speak(card.prompt);
    },
    onAgain: () => {
      if (state?.phase === "done") {
        const { winner } = duelResult(state);
        startNewDuel(winner === "tie" ? 0 : winner === 0 ? 1 : 0);
      }
    },
  });

  // Live head-to-head record for the current pair. Recomputed on every render so
  // it updates as names are typed on setup, and — because recordResult runs in the
  // done-phase effect first — already includes the just-finished duel on results.
  const tally = headToHeadFor(history, displayNames);

  if (!loaded) {
    return <LoadingScreen message="Setting up the duel…" />;
  }

  return (
    <main className="mobile-bottom-safe mx-auto max-w-3xl px-4 pt-5 md:px-10 md:pt-8">
      <Link href="/" className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">
        ← Home
      </Link>

      <div className="mt-5 md:mt-6">
        <h1 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">Pass &amp; Play Duel</h1>
        <p className="mt-2 text-base text-slate-300 md:mt-3 md:text-lg">
          Two learners, one device. Take turns — most correct answers wins.
        </p>
      </div>

      {/* ── Setup ── */}
      {state === null ? (
        <SetupScreen
          data={data}
          nameA={nameA}
          nameB={nameB}
          topicSlug={topic?.slug ?? topicSlug}
          mode={mode}
          speechAvailable={speechAvailable}
          canDuel={canDuel}
          recentCount={history.results.length}
          tally={tally}
          names={displayNames}
          onNameA={setNameA}
          onNameB={setNameB}
          onTopic={setTopicSlug}
          onMode={setMode}
          onSurprise={() => {
            const pool = data.topics;
            if (pool.length === 0) return;
            const pick = pool[Math.floor(Math.random() * pool.length)];
            setTopicSlug(pick.slug);
          }}
          onStart={() => startNewDuel(0)}
        />
      ) : state.phase === "handoff" ? (
        <HandoffScreen
          state={state}
          names={displayNames}
          onReady={handleBegin}
        />
      ) : state.phase === "done" ? (
        <ResultsScreen
          state={state}
          names={displayNames}
          tally={tally}
          topic={topic}
          onRematch={() => {
            const { winner } = duelResult(state);
            startNewDuel(winner === "tie" ? 0 : winner === 0 ? 1 : 0);
          }}
          onNewDuel={() => {
            recordedRef.current = false;
            setState(null);
          }}
        />
      ) : (
        <QuestionScreen
          state={state}
          names={displayNames}
          mode={effectiveMode}
          speechAvailable={speechAvailable}
          speak={speak}
          onAnswer={handleAnswer}
          onAdvance={handleAdvance}
        />
      )}
    </main>
  );
}

// ── Setup ────────────────────────────────────────────────────────────────────

function SetupScreen({
  data,
  nameA,
  nameB,
  topicSlug,
  mode,
  speechAvailable,
  canDuel,
  recentCount,
  tally,
  names,
  onNameA,
  onNameB,
  onTopic,
  onMode,
  onSurprise,
  onStart,
}: {
  data: HomeData;
  nameA: string;
  nameB: string;
  topicSlug: string;
  mode: QuizMode;
  speechAvailable: boolean;
  canDuel: boolean;
  recentCount: number;
  tally: HeadToHead;
  names: [string, string];
  onNameA: (v: string) => void;
  onNameB: (v: string) => void;
  onTopic: (v: string) => void;
  onMode: (v: QuizMode) => void;
  onSurprise: () => void;
  onStart: () => void;
}) {
  const modes = speechAvailable
    ? [...MODE_OPTIONS, { key: "listening", label: "Listen 🔊" } as const]
    : MODE_OPTIONS;

  return (
    <div className="mt-8 space-y-6">
      {/* Player names */}
      <section className="rounded-3xl border border-white/10 bg-surface p-6">
        <h2 className="text-sm font-semibold text-slate-300">Players</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-slate-400">Player 1</span>
            <input
              value={nameA}
              onChange={(e) => onNameA(e.target.value)}
              placeholder="Player 1"
              maxLength={DUEL_NAME_MAX_LENGTH}
              aria-label="Player 1 name"
              className="mt-1.5 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-300"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-400">Player 2</span>
            <input
              value={nameB}
              onChange={(e) => onNameB(e.target.value)}
              placeholder="Player 2"
              maxLength={DUEL_NAME_MAX_LENGTH}
              aria-label="Player 2 name"
              className="mt-1.5 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-300"
            />
          </label>
        </div>
        {tally.total > 0 ? (
          <div className="mt-4">
            <RivalryTally tally={tally} names={names} />
          </div>
        ) : null}
      </section>

      {/* Topic picker */}
      <section className="rounded-3xl border border-white/10 bg-surface p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-300">Pick a topic</h2>
          <button
            type="button"
            onClick={onSurprise}
            className="min-h-[44px] rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white transition hover:border-emerald-300"
          >
            🎲 Surprise us
          </button>
        </div>
        <select
          value={topicSlug}
          onChange={(e) => onTopic(e.target.value)}
          aria-label="Duel topic"
          className="mt-4 w-full rounded-2xl border border-white/10 bg-surface-2 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
        >
          {data.categories.map((cat) => (
            <optgroup key={cat.slug} label={cat.name}>
              {data.topics
                .filter((t) => t.categorySlug === cat.slug)
                .map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.titleEn}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </section>

      {/* Mode selector */}
      <section className="rounded-3xl border border-white/10 bg-surface p-6">
        <h2 className="text-sm font-semibold text-slate-300">Quiz mode</h2>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Quiz mode">
          {modes.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => onMode(m.key)}
              aria-pressed={mode === m.key}
              className={`min-h-[44px] rounded-full border px-4 py-2 text-xs font-semibold transition ${
                mode === m.key
                  ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-200"
                  : "border-white/10 text-slate-400 hover:border-white/25 hover:text-white"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </section>

      <div className="flex flex-col items-start gap-3">
        <button
          type="button"
          onClick={onStart}
          disabled={!canDuel}
          className="min-h-[44px] rounded-full bg-emerald-400 px-8 py-3 text-lg font-semibold text-slate-950 transition hover:bg-cta disabled:cursor-not-allowed disabled:opacity-40"
        >
          Start duel ⚔️
        </button>
        {!canDuel ? (
          <p className="text-sm text-slate-400">This topic doesn&apos;t have enough words for a duel.</p>
        ) : (
          <p className="text-sm text-slate-500">
            {QUESTIONS_PER_PLAYER} questions each. Nothing here touches your streak or stats.
          </p>
        )}
        {recentCount > 0 ? (
          <p className="text-xs text-slate-600">
            {recentCount} past duel{recentCount !== 1 ? "s" : ""} remembered on this device.
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ── Handoff interstitial ───────────────────────────────────────────────────────

function HandoffScreen({
  state,
  names,
  onReady,
}: {
  state: DuelState;
  names: [string, string];
  onReady: () => void;
}) {
  const turn = currentTurn(state);
  const player = turn?.player ?? 0;
  const other: DuelPlayerIndex = player === 0 ? 1 : 0;

  return (
    <div className="mt-10 rounded-3xl border border-white/10 bg-surface p-10 text-center">
      <p className="text-5xl">🤝</p>
      <p className="mt-4 text-2xl font-semibold text-white">Pass to {names[player]}</p>
      <p className="mt-2 text-slate-400">No peeking, {names[other]}!</p>

      <div className="mt-6 flex items-center justify-center gap-3 text-sm">
        <ScoreChip name={names[0]} score={state.scores[0]} active={player === 0} />
        <ScoreChip name={names[1]} score={state.scores[1]} active={player === 1} />
      </div>

      <button
        type="button"
        onClick={onReady}
        className="mt-8 min-h-[44px] rounded-full bg-emerald-400 px-8 py-3 text-lg font-semibold text-slate-950 transition hover:bg-cta"
      >
        I&apos;m ready
      </button>
    </div>
  );
}

// ── Active question ────────────────────────────────────────────────────────────

function QuestionScreen({
  state,
  names,
  mode,
  speechAvailable,
  speak,
  onAnswer,
  onAdvance,
}: {
  state: DuelState;
  names: [string, string];
  mode: QuizMode;
  speechAvailable: boolean;
  speak: (text: string) => void;
  onAnswer: (choice: string) => void;
  onAdvance: () => void;
}) {
  const turn = currentTurn(state);
  if (!turn) return null;
  const card = turn.card;
  const player = turn.player;
  const picked = state.picked;
  const answered = state.phase === "answered";
  const isLastTurn = state.position + 1 >= state.turns.length;

  // How many of this player's questions have been asked so far (1-based).
  let asked = 0;
  for (let i = 0; i <= state.position; i++) {
    if (state.turns[i].player === player) asked += 1;
  }
  const isHanziPrompt = mode !== "english-hanzi";
  const isListening = mode === "listening";
  const [otherName, playerName] = [names[player === 0 ? 1 : 0], names[player]];

  return (
    <section className="mt-5 rounded-3xl border border-white/10 bg-surface p-4 md:mt-8 md:p-6" aria-label="Duel question">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-slate-400 md:text-sm">
          {playerName} · Question {asked} of {QUESTIONS_PER_PLAYER}
        </p>
        <div className="flex items-center gap-1.5 text-xs md:gap-2">
          <ScoreChip name={names[0]} score={state.scores[0]} active={player === 0} />
          <ScoreChip name={names[1]} score={state.scores[1]} active={player === 1} />
        </div>
      </div>

      {/* Progress through this player's five questions. */}
      <div className="progress-bar-track mt-3">
        <div
          className="progress-bar-fill"
          style={{ width: `${((asked - 1) / QUESTIONS_PER_PLAYER) * 100}%` }}
        />
      </div>

      {/* Prompt */}
      {isListening && !answered ? (
        // Listening, pre-answer: audio only — revealing hanzi would leak the answer.
        <div className="mt-5 flex flex-col items-center text-center md:mt-8">
          <button
            type="button"
            onClick={() => speak(card.prompt)}
            aria-label="Play the word"
            className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-cta"
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
          <p className="mt-4 text-sm text-slate-400">Listen, then pick the meaning</p>
        </div>
      ) : (
        <div className="mt-5 text-center md:mt-8">
          <div className="flex items-center justify-center gap-3">
            <h2
              lang={quizPromptLang(mode)}
              className={`font-hanzi text-6xl font-semibold text-white md:text-7xl ${mode === "english-hanzi" ? "font-sans text-3xl md:text-4xl" : ""}`}
            >
              {card.prompt}
            </h2>
            {isHanziPrompt && speechAvailable ? (
              <SpeakButton text={card.prompt} label={`Pronounce: ${card.prompt}`} />
            ) : null}
          </div>
          {card.promptPinyin ? (
            <p lang={PINYIN_LANG} className="font-hanzi mt-1 text-xl text-emerald-300 md:mt-2 md:text-2xl">
              <TonePinyin pinyin={card.promptPinyin} />
            </p>
          ) : null}
        </div>
      )}

      {/* Choices */}
      <div className="mt-5 grid gap-2 md:mt-8 md:grid-cols-2 md:gap-3" role="listbox" aria-label="Answer choices">
        {card.choices.map((choice, i) => {
          const right = picked !== null && choice === card.answer;
          const wrong = picked === choice && choice !== card.answer;
          return (
            <button
              key={`${state.position}:${choice}`}
              type="button"
              onClick={() => onAnswer(choice)}
              role="option"
              aria-selected={picked === choice}
              aria-disabled={picked !== null && picked !== choice}
              aria-keyshortcuts={i < 9 ? `${i + 1}` : undefined}
              className={`flex min-h-[48px] items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition md:min-h-[52px] md:px-5 md:py-4 md:text-base
                ${right ? "animate-quiz-correct border-emerald-300 bg-cta text-slate-950" : ""}
                ${wrong ? "animate-quiz-wrong border-rose-400 bg-rose-400/20 text-rose-200" : ""}
                ${!right && !wrong ? "border-white/10 bg-surface-2 text-white hover:border-emerald-300" : ""}
              `}
            >
              {i < 9 ? (
                <kbd className="kbd hidden md:inline-flex" aria-hidden="true">{i + 1}</kbd>
              ) : null}
              <span lang={quizChoiceLang(mode)} className={mode === "english-hanzi" || mode === "hanzi-pinyin" ? "font-hanzi" : ""}>
                {choice}
              </span>
            </button>
          );
        })}
      </div>

      {/* Desktop-only shortcut hint. */}
      <p className="mt-4 hidden text-xs font-medium text-slate-500 md:block" aria-hidden="true">
        {answered ? "Enter next · P pronounce" : "1–4 choose · P pronounce"}
      </p>

      {/* Feedback + advance */}
      {answered ? (
        <div className="mt-5 md:mt-6" role="status">
          {picked === card.answer ? (
            <p className="text-lg font-semibold text-emerald-300">+1 for {playerName}!</p>
          ) : (
            <p className="text-lg font-semibold text-rose-300">
              It was <span lang={quizChoiceLang(mode)} className={mode === "english-hanzi" || mode === "hanzi-pinyin" ? "font-hanzi" : ""}>{card.answer}</span>.
            </p>
          )}
          {/* In listening mode, reveal the ground-truth hanzi + pinyin now. */}
          {isListening ? (
            <p className="mt-2 flex items-baseline justify-center gap-2">
              <span lang={HANZI_LANG} className="font-hanzi text-2xl text-white">{card.prompt}</span>
              {card.promptPinyin ? (
                <span lang={PINYIN_LANG} className="font-hanzi text-base text-emerald-300">
                  <TonePinyin pinyin={card.promptPinyin} />
                </span>
              ) : null}
            </p>
          ) : null}
          <button
            type="button"
            onClick={onAdvance}
            className="mt-4 min-h-[44px] w-full rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cta sm:w-auto md:mt-5"
            aria-label={isLastTurn ? "See results" : `Pass to ${otherName}`}
            aria-keyshortcuts="Enter"
          >
            {isLastTurn ? "See results" : `Pass to ${otherName}`}
          </button>
        </div>
      ) : null}
    </section>
  );
}

// ── Results ────────────────────────────────────────────────────────────────────

function ResultsScreen({
  state,
  names,
  tally,
  topic,
  onRematch,
  onNewDuel,
}: {
  state: DuelState;
  names: [string, string];
  tally: HeadToHead;
  topic: TopicSummary | undefined;
  onRematch: () => void;
  onNewDuel: () => void;
}) {
  const { winner, scores } = duelResult(state);
  const [a, b] = scores;

  // Merge both players' missed keys and resolve them back to the topic's items.
  const missedKeys = Array.from(new Set([...state.missedKeys[0], ...state.missedKeys[1]]));
  const byKey = new Map<string, VocabItemSummary>();
  if (topic) {
    for (const item of topic.items) byKey.set(`${topic.slug}:${item.hanzi}`, item);
  }
  const missedItems = missedKeys
    .map((k) => byKey.get(k))
    .filter((it): it is VocabItemSummary => Boolean(it));

  return (
    <div className="animate-celebrate mt-10 rounded-3xl border border-white/10 bg-surface p-8 text-center">
      <p className="text-6xl">{winner === "tie" ? "🤝" : "🏆"}</p>
      <p className="mt-4 text-2xl font-semibold text-white">
        {winner === "tie"
          ? `It's a tie, ${a}–${b}!`
          : `${names[winner]} wins ${winner === 0 ? a : b}–${winner === 0 ? b : a}!`}
      </p>

      <div className="mt-5 flex items-center justify-center gap-3 text-sm">
        <ScoreChip name={names[0]} score={a} active={winner === 0} />
        <ScoreChip name={names[1]} score={b} active={winner === 1} />
      </div>

      <div className="mt-4 flex justify-center">
        <RivalryTally tally={tally} names={names} justFinished />
      </div>

      {missedItems.length > 0 ? (
        <div className="mx-auto mt-6 max-w-md rounded-2xl border border-white/10 bg-surface-2 p-5 text-left">
          <p className="text-sm font-semibold text-slate-300">Words to review together</p>
          <ul className="mt-3 space-y-2">
            {missedItems.map((item) => (
              <li key={item.hanzi} className="flex items-baseline gap-3">
                <span lang={HANZI_LANG} className="font-hanzi text-xl text-white">{item.hanzi}</span>
                <span lang={PINYIN_LANG} className="font-hanzi text-sm text-emerald-300">
                  <TonePinyin pinyin={item.pinyin} />
                </span>
                <span className="text-sm text-slate-400">{item.english}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-slate-400">Every word answered correctly by someone — nicely done.</p>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={onRematch}
          className="min-h-[44px] rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cta"
          aria-keyshortcuts="r"
        >
          Rematch
        </button>
        <button
          type="button"
          onClick={onNewDuel}
          className="min-h-[44px] rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-emerald-300"
        >
          New duel
        </button>
        {topic ? (
          <Link
            href={`/topics/${topic.slug}`}
            className="min-h-[44px] inline-flex items-center rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-emerald-300"
          >
            Study this topic →
          </Link>
        ) : null}
      </div>

      <p className="mt-6 hidden text-xs font-medium text-slate-500 md:block" aria-hidden="true">
        Press R for a rematch
      </p>
    </div>
  );
}

// ── Shared score chip ──────────────────────────────────────────────────────────

// ── Head-to-head rivalry line ───────────────────────────────────────────────────

// Compact running win tally for the current pair, styled like ScoreChip. On the
// setup screen it live-updates as names are typed; on results it already counts the
// just-finished duel (recordResult runs first in the done-phase effect). The tally
// reflects the last DUEL_HISTORY_LIMIT duels only — a recent record by design.
function RivalryTally({
  tally,
  names,
  justFinished,
}: {
  tally: HeadToHead;
  names: [string, string];
  justFinished?: boolean;
}): React.JSX.Element | null {
  if (tally.total === 0) return null;

  // First-ever duel between this pair, shown only on the results screen.
  if (justFinished && tally.total === 1) {
    return (
      <p className="text-sm text-slate-400">
        First duel between {names[0]} and {names[1]} — the rivalry begins!
      </p>
    );
  }

  const tieSuffix = tally.ties > 0 ? ` · ${tally.ties} tie${tally.ties !== 1 ? "s" : ""}` : "";
  const record = (
    <>
      <span className="max-w-[7rem] truncate">{names[0]}</span>
      <span className="tabular-nums text-emerald-200">
        {tally.wins[0]} – {tally.wins[1]}
      </span>
      <span className="max-w-[7rem] truncate">{names[1]}</span>
    </>
  );

  if (justFinished) {
    return (
      <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-sm font-semibold text-slate-300">
        <span className="text-slate-400">Head-to-head:</span>
        {record}
        {tieSuffix ? <span className="text-slate-500">{tieSuffix}</span> : null}
      </p>
    );
  }

  return (
    <div>
      <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-sm font-semibold text-slate-300">
        <span aria-hidden="true">⚔️</span>
        {record}
        {tieSuffix ? <span className="text-slate-500">{tieSuffix}</span> : null}
      </p>
      <p className="mt-1.5 text-xs text-slate-500">Head-to-head on this device</p>
    </div>
  );
}

function ScoreChip({ name, score, active }: { name: string; score: number; active: boolean }) {
  return (
    <span
      className={`max-w-[9rem] truncate rounded-full border px-3 py-1.5 font-semibold ${
        active
          ? "border-emerald-300/50 bg-emerald-400/15 text-emerald-200"
          : "border-white/10 text-slate-400"
      }`}
    >
      {name} {score}
    </span>
  );
}
