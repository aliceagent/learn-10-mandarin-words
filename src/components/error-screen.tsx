import type { ErrorWord } from "@/lib/error-copy";

/**
 * Shared branded failure screen used by the 404 and error boundaries.
 *
 * Deliberately a plain presentational component with no hooks and no
 * `"use client"` directive, so it can render inside both server files
 * (`not-found.tsx`) and client files (`error.tsx`). Visually rhymes with
 * `src/app/offline/page.tsx`: a centered `min-h-[80dvh]` column with `pb-24`
 * clearance for the fixed BottomNav, and emerald pill / outlined actions
 * passed in as `children`.
 *
 * Every Chinese line carries pinyin (the app's pinyin-on-Chinese-lines rule).
 * `tone` picks the accent for the featured word: emerald for a 404, rose
 * (`--color-danger`) for a runtime crash — rose being the reserved error
 * semantic in the design system.
 */
export function ErrorScreen({
  word,
  title,
  body,
  tone = "accent",
  children,
}: {
  word: ErrorWord;
  title: string;
  body: string;
  tone?: "accent" | "danger";
  children?: React.ReactNode;
}): React.JSX.Element {
  const hanziColor = tone === "danger" ? "text-danger" : "text-emerald-300";

  return (
    <main className="mx-auto flex min-h-[80dvh] max-w-2xl flex-col items-center justify-center px-6 pb-24 pt-16 text-center">
      {/* Featured real-dataset word — the failure screen teaches you a word. */}
      <p className={`font-hanzi text-6xl font-semibold leading-none md:text-7xl ${hanziColor}`}>
        {word.hanzi}
      </p>
      <p className="font-hanzi mt-3 text-lg text-slate-300">
        {word.pinyin} · <span className="italic">&ldquo;{word.english}&rdquo;</span>
      </p>

      <h1 className="mt-8 text-3xl font-semibold tracking-tight text-white md:text-4xl">
        {title}
      </h1>
      <p className="mt-4 max-w-md text-slate-300">{body}</p>

      {children}
    </main>
  );
}
