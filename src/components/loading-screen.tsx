// Shared "loading progress" screen used while useProgress hydrates from
// localStorage on the review, stats, and favorites pages. The default copy
// ("Loading progress…") matches review/stats; favorites passes its own message.
// Layout is identical to the callers' original inline markup, so nothing about
// the loading frame changes visually.
export function LoadingScreen({ message = "Loading progress…" }: { message?: string }) {
  return (
    <main className="mx-auto max-w-7xl px-6 py-8 md:px-10">
      <p className="text-slate-400">{message}</p>
    </main>
  );
}
