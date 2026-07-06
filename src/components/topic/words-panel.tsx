"use client";

import { useEffect, useMemo, useRef } from "react";
import type { FlashcardStat, Topic } from "@/lib/types";
import type { CharConnectionGroup } from "@/lib/connections-logic";
import { wordKey } from "@/lib/data-logic";
import { track } from "@/lib/analytics";
import { HANZI_LANG, PINYIN_LANG } from "@/lib/lang";
import { buildListenSteps } from "@/lib/listen-logic";
import { SpeakButton } from "../speak-button";
import { TonePinyin } from "../tone-pinyin";
import { useListenAll } from "../use-listen-all";
import { useReducedMotion } from "../use-reduced-motion";
import { ListenAllBar } from "./listen-all-bar";
import { CharConnections } from "./char-connections";

// The "Words" tab of a topic: the full vocabulary list with example sentences,
// per-word save toggles, and a review-count line once a word has been graded.
// Presentational — favorites flow in via props and the toggle is handled by the
// parent (which also fires the favorite_saved analytics event), mirroring
// PhrasebookPanel so both word surfaces stay in lockstep. Extracted verbatim
// from topic-app's `mode === "words"` section.
//
// When `speechAvailable`, a "Play all" listening drill (Sprint 9) sits above the
// grid: one tap speaks every word in sequence, highlighting each card as it plays
// and scrolling it into view. `speechAvailable` is optional (default false) so
// other callers — e.g. favorites — compile unchanged with the drill simply off.
//
// `connections` (Sprint 3) is the precomputed `wordKey → shared-character groups`
// map from the server page. It is optional (default absent) so other callers
// compile unchanged and simply render no connections section.
export function WordsPanel({
  topic,
  favoriteWords,
  flashcardStats,
  speechAvailable = false,
  connections,
  onToggleFavorite,
}: {
  topic: Topic;
  favoriteWords: string[];
  flashcardStats: Record<string, FlashcardStat>;
  speechAvailable?: boolean;
  connections?: Record<string, CharConnectionGroup[]>;
  onToggleFavorite: (key: string) => void;
}) {
  const reducedMotion = useReducedMotion();
  const steps = useMemo(() => buildListenSteps(topic, (item) => wordKey(topic, item)), [topic]);
  const { status, activeIndex, playAll, stop } = useListenAll(steps, () => {
    track("listen_all_completed", { topic: topic.slug, words: steps.length });
  });
  const activeStep = activeIndex !== null ? steps[activeIndex] ?? null : null;
  const activeKey = activeStep?.key ?? null;

  // Scroll the currently-playing card into view. Smooth unless the learner asked
  // for reduced motion, in which case the jump is instant.
  const gridRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!activeKey || !gridRef.current) return;
    const el = gridRef.current.querySelector<HTMLElement>(`[data-word-key="${CSS.escape(activeKey)}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
  }, [activeKey, reducedMotion]);

  return (
    <div className="mt-6">
      {speechAvailable ? (
        <ListenAllBar
          status={status}
          activeIndex={activeIndex}
          activeStep={activeStep}
          total={steps.length}
          onPlayAll={playAll}
          onStop={stop}
        />
      ) : null}
      <section ref={gridRef} className="grid gap-4 md:grid-cols-2" aria-label="Vocabulary words">
        {topic.items.map((item) => {
          const key = wordKey(topic, item);
          const favorite = favoriteWords.includes(key);
          const stat = flashcardStats[key];
          const active = key === activeKey;
          const wordConnections = connections?.[key];
          return (
            <article
              key={item.hanzi}
              data-word-key={key}
              aria-current={active ? "true" : undefined}
              className={`rounded-3xl border bg-surface p-5 transition ${active ? "border-emerald-400/60 ring-2 ring-emerald-400/60" : "border-white/10"}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="min-w-0">
                    <h2 lang={HANZI_LANG} className="font-hanzi text-4xl font-semibold text-white">{item.hanzi}</h2>
                    <p lang={PINYIN_LANG} className="font-hanzi mt-2 text-xl text-emerald-300"><TonePinyin pinyin={item.pinyin} /></p>
                    <p className="mt-1 text-lg font-semibold text-slate-200">{item.english}</p>
                    {stat && stat.reviewCount > 0 ? (
                      <p className="mt-1 text-xs text-slate-500">
                        {stat.reviewCount} review{stat.reviewCount !== 1 ? "s" : ""} · interval {stat.intervalDays}d
                      </p>
                    ) : null}
                  </div>
                  <SpeakButton text={item.hanzi} label={`Pronounce ${item.hanzi} (${item.pinyin})`} />
                </div>
                <button
                  type="button"
                  onClick={() => onToggleFavorite(key)}
                  className="min-h-[44px] shrink-0 rounded-full border border-white/10 px-3.5 py-2 text-sm font-semibold text-slate-200 transition hover:border-amber-300"
                  aria-pressed={favorite}
                  aria-label={favorite ? `Remove ${item.english} from favorites` : `Save ${item.english} to favorites`}
                >
                  {favorite ? "Saved" : "Save"}
                </button>
              </div>
              <div className="mt-5 space-y-3 border-t border-white/10 pt-4">
                {item.sentences.map((sentence) => (
                  <div key={sentence.cn} className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-6 text-slate-300">
                        <span lang={HANZI_LANG} className="font-hanzi text-white">{sentence.cn}</span>
                        <br />{sentence.en}
                      </p>
                    </div>
                    <SpeakButton text={sentence.cn} label={`Pronounce: ${sentence.cn}`} />
                  </div>
                ))}
              </div>
              {wordConnections && wordConnections.length > 0 ? (
                <CharConnections groups={wordConnections} hanzi={item.hanzi} topicSlug={topic.slug} />
              ) : null}
            </article>
          );
        })}
      </section>
    </div>
  );
}
