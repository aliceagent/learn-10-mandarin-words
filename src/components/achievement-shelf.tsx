import type { Achievement } from "@/lib/achievements-logic";

// The Achievement shelf: a grid of badge cards derived (by the caller) purely
// from the learner's local progress. Unlocked badges read in full color with
// their "earned" line; locked badges are dimmed with a hint and — once there's
// partial progress — a bar and a "current/target" caption pulling toward the
// next milestone. Presentational only: no state, no effects, no new keyframes
// (it reuses the existing card + progress-bar idioms from the stats page).
export function AchievementShelf({ achievements }: { achievements: Achievement[] }) {
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <section className="mt-10" aria-label="Achievement shelf">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-white">Achievement shelf</h2>
        <span className="rounded-full border border-white/10 bg-surface px-3 py-1 text-xs font-semibold text-slate-300">
          {unlockedCount} of {achievements.length} unlocked
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-400">
        Earned automatically from your local progress — no account, nothing leaves this device.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {achievements.map((badge) => (
          <BadgeCard key={badge.id} badge={badge} />
        ))}
      </div>
    </section>
  );
}

function BadgeCard({ badge }: { badge: Achievement }) {
  const { current, target } = badge.progress;
  // Show the pull-toward-unlock bar only for locked badges with real progress.
  const showBar = !badge.unlocked && current > 0 && target > 0;
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const ariaLabel = badge.unlocked
    ? `${badge.title}: unlocked`
    : `${badge.title}: locked${current > 0 ? `, ${current} of ${target}` : ""}`;

  return (
    <div
      aria-label={ariaLabel}
      className={`rounded-2xl border bg-surface p-5 transition ${
        badge.unlocked
          ? "border-emerald-300/50"
          : "border-white/10"
      }`}
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className={`text-4xl leading-none ${badge.unlocked ? "" : "opacity-40 grayscale"}`}
        >
          {badge.emoji}
        </span>
        <div className="min-w-0">
          <p className={`font-semibold ${badge.unlocked ? "text-white" : "text-slate-300"}`}>
            {badge.title}
          </p>
          <p className={`mt-1 text-sm ${badge.unlocked ? "text-emerald-300" : "text-slate-500"}`}>
            {badge.unlocked ? badge.earned : badge.hint}
          </p>
        </div>
      </div>
      {showBar ? (
        <div className="mt-3">
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-right text-xs text-slate-500">
            {current}/{target}
          </p>
        </div>
      ) : null}
    </div>
  );
}
