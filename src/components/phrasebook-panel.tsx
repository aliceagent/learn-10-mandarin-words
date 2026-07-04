"use client";

import type { Topic } from "@/lib/types";
import { wordKey } from "@/lib/data";
import { HANZI_LANG, PINYIN_LANG } from "@/lib/lang";
import { SpeakButton } from "./speak-button";
import { CopyButton } from "./copy-button";

interface PhrasebookPanelProps {
  topic: Topic;
  favoriteWords: string[];
  onToggleFavorite: (key: string) => void;
}

/**
 * Compact, phrasebook-style layout used only for Useful Phrases topics. Unlike
 * the vocabulary grid, each phrase reads as a practical card: big hanzi, pinyin,
 * meaning, and its example sentences inline, with speak + copy actions so a
 * learner can hear or grab the phrase quickly. Purely presentational over the
 * existing topic data — no new content is invented.
 */
export function PhrasebookPanel({ topic, favoriteWords, onToggleFavorite }: PhrasebookPanelProps) {
  return (
    <section className="mt-6" aria-label="Phrasebook">
      <p className="text-sm leading-6 text-slate-400">
        Ready-to-say phrases. Tap ▶ to hear one, or copy it to use elsewhere.
      </p>
      <ol className="mt-4 space-y-3">
        {topic.items.map((item, index) => {
          const key = wordKey(topic, item);
          const favorite = favoriteWords.includes(key);
          return (
            <li
              key={item.hanzi}
              className="rounded-2xl border border-white/10 bg-surface p-4 md:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p lang={HANZI_LANG} className="font-hanzi text-2xl font-semibold leading-snug text-white md:text-3xl">
                    <span className="mr-2 align-middle text-sm font-normal text-slate-500">
                      {index + 1}.
                    </span>
                    {item.hanzi}
                  </p>
                  <p lang={PINYIN_LANG} className="font-hanzi mt-1 text-base text-emerald-300 md:text-lg">{item.pinyin}</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-200 md:text-base">{item.english}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <SpeakButton text={item.hanzi} label={`Pronounce ${item.hanzi} (${item.pinyin})`} />
                  <CopyButton text={item.hanzi} label={`Copy ${item.hanzi}`} />
                  <button
                    type="button"
                    onClick={() => onToggleFavorite(key)}
                    className="inline-flex min-h-[36px] items-center rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-amber-300"
                    aria-pressed={favorite}
                    aria-label={favorite ? `Remove ${item.english} from favorites` : `Save ${item.english} to favorites`}
                  >
                    {favorite ? "Saved ★" : "Save"}
                  </button>
                </div>
              </div>

              {item.sentences.length > 0 ? (
                <ul className="mt-3 space-y-2 border-t border-white/10 pt-3">
                  {item.sentences.map((sentence) => (
                    <li key={sentence.cn} className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p lang={HANZI_LANG} className="font-hanzi text-sm leading-6 text-slate-100">{sentence.cn}</p>
                        <p className="text-sm leading-6 text-slate-400">{sentence.en}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <SpeakButton text={sentence.cn} label={`Pronounce: ${sentence.cn}`} />
                        <CopyButton text={sentence.cn} label={`Copy: ${sentence.cn}`} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
