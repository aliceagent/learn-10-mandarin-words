"use client";

import Link from "next/link";
import { useState } from "react";
import type { WordSearchResult } from "@/lib/search-logic";
import { HANZI_LANG, PINYIN_LANG } from "@/lib/lang";
import { HighlightedText } from "./highlighted-text";
import { SpeakButton } from "./speak-button";

// Flat word-level results panel shown above the topic grid while the home search
// is active. Presentational: the parent owns progress state and analytics, so
// favorites flow in via `favoriteWords` + `onToggleFavorite` (the parent fires
// the favorite_saved event), and row opens flow out via `onOpenResult` — the
// same split WordsPanel/topic-app use. Renders nothing when there are no matches,
// so a full miss leaves only the existing "No topics found" card.
const INITIAL_VISIBLE = 12;

export function WordSearchResults({
  results,
  query,
  favoriteWords,
  onToggleFavorite,
  onOpenResult,
}: {
  results: WordSearchResult[];
  query: string;
  favoriteWords: string[];
  onToggleFavorite: (key: string) => void;
  onOpenResult: (result: WordSearchResult) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (results.length === 0) return null;

  const total = results.length;
  const visible = expanded ? results : results.slice(0, INITIAL_VISIBLE);

  return (
    <section className="mb-8" aria-label="Matching words">
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-white">Matching words</h3>
        <p className="mt-1 text-sm text-slate-400">
          {total} word{total !== 1 ? "s" : ""} match your search
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {visible.map((result) => {
          const favorite = favoriteWords.includes(result.key);
          return (
            <li
              key={result.key}
              className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-surface p-4"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span lang={HANZI_LANG} className="font-hanzi text-2xl font-semibold text-white">
                      <HighlightedText text={result.hanzi} query={query} />
                    </span>
                    <span lang={PINYIN_LANG} className="font-hanzi text-base text-emerald-300">
                      <HighlightedText text={result.pinyin} query={query} />
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-200">
                    <HighlightedText text={result.english} query={query} />
                  </p>
                  <Link
                    href={`/topics/${result.topicSlug}`}
                    onClick={() => onOpenResult(result)}
                    className="mt-1 inline-block text-xs text-slate-500 transition hover:text-emerald-300"
                  >
                    in {result.topicTitle}
                  </Link>
                </div>
                <SpeakButton text={result.hanzi} label={`Pronounce ${result.hanzi} (${result.pinyin})`} />
              </div>
              <button
                type="button"
                onClick={() => onToggleFavorite(result.key)}
                className="min-h-[44px] shrink-0 rounded-full border border-white/10 px-3.5 py-2 text-sm font-semibold text-slate-200 transition hover:border-amber-300"
                aria-pressed={favorite}
                aria-label={
                  favorite
                    ? `Remove ${result.english} from favorites`
                    : `Save ${result.english} to favorites`
                }
              >
                {favorite ? "Saved" : "Save"}
              </button>
            </li>
          );
        })}
      </ul>
      {total > INITIAL_VISIBLE ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-4 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-emerald-300 hover:text-white"
          aria-expanded={expanded}
        >
          {expanded ? "Show fewer" : `Show all ${total} words`}
        </button>
      ) : null}
    </section>
  );
}
