import Link from "next/link";
import { ErrorScreen } from "@/components/error-screen";
import { CATEGORY_NOT_FOUND_COPY, ERROR_WORD } from "@/lib/error-copy";

/**
 * Rendered by the `notFound()` call in `categories/[slug]/page.tsx` when a slug
 * isn't a real category. Sits inside the root layout, so the BottomNav persists.
 */
export default function CategoryNotFound(): React.JSX.Element {
  return (
    <ErrorScreen
      word={ERROR_WORD}
      title={CATEGORY_NOT_FOUND_COPY.title}
      body={CATEGORY_NOT_FOUND_COPY.body}
    >
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
