import type { FlashcardStat, Topic } from "@/lib/types";
import { wordKey } from "@/lib/data";
import { SpeakButton } from "../speak-button";

// The "Words" tab of a topic: the full vocabulary list with example sentences,
// per-word save toggles, and a review-count line once a word has been graded.
// Presentational — favorites flow in via props and the toggle is handled by the
// parent (which also fires the favorite_saved analytics event), mirroring
// PhrasebookPanel so both word surfaces stay in lockstep. Extracted verbatim
// from topic-app's `mode === "words"` section.
export function WordsPanel({
  topic,
  favoriteWords,
  flashcardStats,
  onToggleFavorite,
}: {
  topic: Topic;
  favoriteWords: string[];
  flashcardStats: Record<string, FlashcardStat>;
  onToggleFavorite: (key: string) => void;
}) {
  return (
    <section className="mt-6 grid gap-4 md:grid-cols-2" aria-label="Vocabulary words">
      {topic.items.map((item) => {
        const key = wordKey(topic, item);
        const favorite = favoriteWords.includes(key);
        const stat = flashcardStats[key];
        return (
          <article key={item.hanzi} className="rounded-3xl border border-white/10 bg-white/[0.045] p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="min-w-0">
                  <h2 className="font-hanzi text-4xl font-semibold text-white">{item.hanzi}</h2>
                  <p className="font-hanzi mt-2 text-xl text-emerald-300">{item.pinyin}</p>
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
                      <span className="font-hanzi text-white">{sentence.cn}</span>
                      <br />{sentence.en}
                    </p>
                  </div>
                  <SpeakButton text={sentence.cn} label={`Pronounce: ${sentence.cn}`} />
                </div>
              ))}
            </div>
          </article>
        );
      })}
    </section>
  );
}
