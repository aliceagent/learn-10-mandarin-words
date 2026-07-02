import type { WordStatus } from "@/lib/progress-logic";

// Presentational row of per-word status dots (Sprint 10). One dot per word,
// colored by status. Color is never the only channel: the container is a single
// labelled image (`role="img"` + count `aria-label`) so a screen reader hears
// "4 mastered, 3 learning, 1 tricky, 2 new" instead of ten anonymous dots, which
// stay `aria-hidden`. No animation — nothing to guard under reduced motion.

const DOT_CLASS: Record<WordStatus, string> = {
  mastered: "bg-emerald-400",
  learning: "bg-emerald-400/40",
  tricky: "bg-rose-400",
  new: "border border-white/15",
};

// Human-readable count summary for the container aria-label, in the same
// precedence order the dots are described. Omits zero buckets so the label stays
// short (e.g. "4 mastered, 6 new"); an all-empty set reads "10 new".
export function masteryCountsLabel(statuses: WordStatus[]): string {
  const counts: Record<WordStatus, number> = { mastered: 0, learning: 0, tricky: 0, new: 0 };
  for (const status of statuses) counts[status] += 1;
  const order: WordStatus[] = ["mastered", "learning", "tricky", "new"];
  const parts = order.filter((s) => counts[s] > 0).map((s) => `${counts[s]} ${s}`);
  return parts.length > 0 ? parts.join(", ") : "no words";
}

export function MasteryDots({
  statuses,
  size = "sm",
  label,
}: {
  statuses: WordStatus[];
  size?: "sm" | "md";
  label: string;
}) {
  const dim = size === "md" ? "h-3 w-3" : "h-2 w-2";
  return (
    <div className="flex flex-wrap items-center gap-1" role="img" aria-label={label}>
      {statuses.map((status, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`${dim} rounded-full ${DOT_CLASS[status]}`}
        />
      ))}
    </div>
  );
}
