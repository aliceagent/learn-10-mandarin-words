import Link from "next/link";
import type { Metadata } from "next";
import { SavedLessonsPanel } from "@/components/saved-lessons-panel";

export const metadata: Metadata = {
  title: "Offline",
  description: "You are offline. Recently visited lessons are still available.",
  alternates: { canonical: "/offline" },
  // SW fallback shell — keep it out of search results.
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-[80dvh] max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-6xl">📡</p>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-white md:text-4xl">You&apos;re offline</h1>
      <p className="mt-4 max-w-md text-slate-300">
        This page hasn&apos;t been cached yet. Lessons you&apos;ve already opened, plus your saved
        progress, still work without a connection — everything is stored on your device.
      </p>

      {/* Honest offline help: vocabulary data is local, but the walkthrough
          videos stream from GitHub Releases and need a connection. */}
      <section className="mt-10 w-full max-w-md rounded-3xl border border-white/10 bg-surface p-6 text-left">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          What works offline
        </h2>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
          <li className="flex gap-3">
            <span aria-hidden="true">✅</span>
            <span>
              <strong className="font-semibold text-white">Vocabulary &amp; the app itself.</strong>{" "}
              Words, pinyin, flashcards, quizzes, and your saved progress live on your device, so any
              lesson you&apos;ve already opened keeps working with no connection.
            </span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true">📶</span>
            <span>
              <strong className="font-semibold text-white">Videos work offline only after you save them.</strong>{" "}
              Walkthrough videos stream from GitHub Releases and aren&apos;t bundled with the app. To
              watch one without a connection, open its lesson while online and tap{" "}
              <span className="font-semibold text-emerald-300">Save for offline</span>. Any lesson you
              haven&apos;t saved needs internet to play.
            </span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true">💬</span>
            <span>
              <strong className="font-semibold text-white">Useful Phrases videos are coming soon.</strong>{" "}
              Those two lists are fully ready to study now — the walkthrough videos just aren&apos;t
              recorded yet.
            </span>
          </li>
        </ul>
      </section>

      {/* Lessons the learner explicitly saved for offline playback (client-only). */}
      <SavedLessonsPanel />

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="min-h-[44px] inline-flex items-center rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cta"
        >
          Back to library
        </Link>
        <Link
          href="/favorites"
          className="min-h-[44px] inline-flex items-center rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-emerald-300"
        >
          My favorites
        </Link>
      </div>
    </main>
  );
}
