import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy | Learn 10 Mandarin Words",
  description: "How Learn 10 Mandarin Words handles your data: everything stays on your device.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 pb-24 pt-10 md:px-10 md:pb-12">
      <Link href="/" className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">← Library</Link>

      <h1 className="mt-8 text-4xl font-semibold tracking-tight text-white md:text-5xl">Privacy</h1>
      <p className="mt-4 text-lg text-slate-300">
        Learn 10 Mandarin Words is built to be private by default. Your learning is yours.
      </p>

      <div className="mt-8 space-y-6 text-slate-300">
        <Section title="What we store">
          Your progress — learned lists, favorites, flashcard schedule, streak dates, and your
          onboarding daily-goal preference — is saved only in your browser&apos;s{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">localStorage</code>. It never
          leaves your device unless you explicitly export it.
        </Section>

        <Section title="No accounts, no tracking">
          There is no login, no cookie-based tracking, and no third-party advertising or analytics
          SDK. We do not collect your name, email, IP address, or location.
        </Section>

        <Section title="Analytics">
          The app ships with a privacy-first analytics layer that is{" "}
          <strong className="text-white">disabled by default</strong>. When a developer turns it on
          for local debugging, it only logs anonymous event names (like &ldquo;quiz completed&rdquo;)
          to the browser console or to an anonymous local counter. No payloads, identifiers, or
          personal data are recorded, and nothing is ever sent over the network.
        </Section>

        <Section title="Your control">
          Use <strong className="text-white">Export progress</strong> on the home page to download a
          JSON backup, and <strong className="text-white">Import progress</strong> to restore it.
          Clearing your browser storage erases everything the app knows about you.
        </Section>

        <Section title="Media">
          Video lessons, when connected, may be served by third parties (for example YouTube). Those
          providers have their own privacy policies. The offline cache never stores video or audio.
        </Section>
      </div>

      <p className="mt-10 text-sm text-slate-500">
        Questions? This is an open, local-first learning app — review the source to see exactly what
        it does.
      </p>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mt-2 leading-7">{children}</p>
    </section>
  );
}
