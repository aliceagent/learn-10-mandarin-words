import Link from "next/link";
import { ErrorScreen } from "@/components/error-screen";
import { ERROR_WORD, LESSON_NOT_FOUND_COPY } from "@/lib/error-copy";
import { datasetSummary, recommendedPath } from "@/lib/data";

/**
 * Rendered by the `notFound()` call in `topics/[slug]/page.tsx` when a slug
 * isn't a real topic. Sits inside the root layout, so the BottomNav persists.
 */
export default function LessonNotFound(): React.JSX.Element {
  const suggestions = recommendedPath().slice(0, 3);
  // Count comes from the real dataset, never hardcoded (hero-counts convention).
  const { formattedListCount } = datasetSummary();

  return (
    <ErrorScreen
      word={ERROR_WORD}
      title={LESSON_NOT_FOUND_COPY.title}
      body={LESSON_NOT_FOUND_COPY.body}
    >
      <section className="mt-10 w-full max-w-md rounded-3xl border border-white/10 bg-surface p-6 text-left">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Starter topics
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
          className="inline-flex min-h-[44px] items-center rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
        >
          Browse all {formattedListCount} lists
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
