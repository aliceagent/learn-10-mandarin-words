"use client";

import { Fragment } from "react";
import Link from "next/link";
import type { CharConnectionGroup } from "@/lib/connections-logic";
import { track } from "@/lib/analytics";
import { HANZI_LANG, PINYIN_LANG } from "@/lib/lang";
import { TonePinyin } from "../tone-pinyin";

// The "Character connections" block on a word card (Sprint 3): for each CJK
// character the word shares with other dataset words, a small group listing those
// words with the shared character emphasized. Purely presentational — the groups
// are precomputed server-side (see connections-logic.ts / the topic page) and
// arrive already deduped, ordered, and capped. Renders nothing when there are no
// groups, so word cards without any shared characters look exactly as before.
//
// Visually rhymes with word-search-results.tsx: the "in {topicTitle}" link uses
// the same quiet slate→emerald hover treatment, and every Chinese line carries a
// `lang` attribute plus TonePinyin so the tone-colors setting is respected.

/** The word's hanzi with every occurrence of `char` emphasized in emerald. */
function EmphasizedHanzi({ hanzi, char }: { hanzi: string; char: string }) {
  return (
    <>
      {[...hanzi].map((ch, i) =>
        ch === char ? (
          <span key={i} className="text-emerald-300">
            {ch}
          </span>
        ) : (
          <Fragment key={i}>{ch}</Fragment>
        ),
      )}
    </>
  );
}

export function CharConnections({
  groups,
  hanzi,
  topicSlug,
}: {
  groups: CharConnectionGroup[];
  /** The hanzi of the word this block belongs to — used for the aria-label and
   *  the analytics payload. */
  hanzi: string;
  topicSlug: string;
}) {
  if (groups.length === 0) return null;

  return (
    <section
      className="mt-5 border-t border-white/10 pt-4"
      aria-label={`Words sharing characters with ${hanzi}`}
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Character connections
      </h3>
      <div className="mt-3 space-y-3">
        {groups.map((group) => {
          const overflow = group.totalCount - group.words.length;
          return (
            <div key={group.char}>
              <p className="text-xs text-slate-400">
                <span lang={HANZI_LANG} className="font-hanzi text-sm text-emerald-300">
                  {group.char}
                </span>{" "}
                also appears in
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {group.words.map((word) => (
                  <li key={`${word.topicSlug}:${word.hanzi}`} className="text-sm leading-6">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span lang={HANZI_LANG} className="font-hanzi text-base text-white">
                        <EmphasizedHanzi hanzi={word.hanzi} char={group.char} />
                      </span>
                      <span lang={PINYIN_LANG} className="font-hanzi text-emerald-300/90">
                        <TonePinyin pinyin={word.pinyin} />
                      </span>
                      <span className="text-slate-300">{word.english}</span>
                      <Link
                        href={`/topics/${word.topicSlug}`}
                        onClick={() =>
                          track("connection_opened", { topic: topicSlug, char: group.char, to: word.topicSlug })
                        }
                        className="text-xs text-slate-500 transition hover:text-emerald-300"
                      >
                        in {word.topicTitle}
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
              {overflow > 0 ? (
                <p className="mt-1 text-xs text-slate-500">+{overflow} more</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
