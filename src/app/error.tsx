"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ErrorScreen } from "@/components/error-screen";
import { ERROR_COPY, ERROR_WORD } from "@/lib/error-copy";

/**
 * Root runtime error boundary. Catches thrown errors below the root layout and
 * shows a branded, on-brand fallback (rose semantic tint) instead of Next.js's
 * default screen. `unstable_retry` (Next 16.2) re-fetches and re-renders the
 * boundary's children — preferred over `reset` per the local error.md docs.
 */
export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}): React.JSX.Element {
  useEffect(() => {
    // Dev-only debugging aid. Local-first app: no error-reporting network call.
    console.error(error);
  }, [error]);

  return (
    <ErrorScreen word={ERROR_WORD} title={ERROR_COPY.title} body={ERROR_COPY.body} tone="danger">
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="inline-flex min-h-[44px] items-center rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-emerald-300"
        >
          Back to library
        </Link>
      </div>
    </ErrorScreen>
  );
}
