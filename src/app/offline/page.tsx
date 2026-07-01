import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline | Learn 10 Mandarin Words",
  description: "You are offline. Recently visited lessons are still available.",
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
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="min-h-[44px] inline-flex items-center rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
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
