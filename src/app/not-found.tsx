import Link from "next/link";
import type { Metadata } from "next";
import { ErrorScreen } from "@/components/error-screen";
import { ERROR_WORD, NOT_FOUND_COPY } from "@/lib/error-copy";
import { recommendedPath } from "@/lib/data";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound(): React.JSX.Element {
  // First three curated starter topics, drawn only from the real dataset.
  const suggestions = recommendedPath().slice(0, 3);

  return (
    <ErrorScreen word={ERROR_WORD} title={NOT_FOUND_COPY.title} body={NOT_FOUND_COPY.body}>
      <Link
        href={`/topics/${ERROR_WORD.topicSlug}`}
        className="mt-6 inline-flex min-h-[44px] items-center text-sm font-medium text-emerald-300 hover:text-emerald-200"
      >
        Learn {ERROR_WORD.hanzi} and nine more ways to apologize →
      </Link>

      <section className="mt-10 w-full max-w-md rounded-3xl border border-white/10 bg-surface p-6 text-left">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Keep learning instead
        </h2>
        <ul className="mt-4 space-y-2">
          {suggestions.map((topic) => (
            <li key={topic.slug}>
              <Link
                href={`/topics/${topic.slug}`}
                className="flex min-h-[44px] items-center justify-between gap-3 rounded-xl px-3 py-2 text-slate-200 transition hover:bg-surface-hover"
              >
                <span className="font-medium">{topic.titleEn}</span>
                <span className="font-hanzi text-slate-400">{topic.titleCn}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cta"
        >
          Back to library
        </Link>
        <Link
          href="/path"
          className="inline-flex min-h-[44px] items-center rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-emerald-300"
        >
          Learning path
        </Link>
      </div>
    </ErrorScreen>
  );
}
