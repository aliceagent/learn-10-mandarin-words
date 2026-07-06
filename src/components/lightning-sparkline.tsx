"use client";

import { sparklinePoints, type LightningRunRecord } from "@/lib/lightning-logic";

// The sparkline's fixed drawing box. A fixed viewBox with
// preserveAspectRatio="none" lets the SVG stretch to whatever width the layout
// gives it while the geometry stays computed in these stable units.
const VIEW_W = 160;
const VIEW_H = 40;

// A small presentational SVG sparkline of recent Lightning Round scores (Sprint
// 12). Pattern mirrors progress-ring.tsx: a single labelled image (`role="img"` +
// a real `aria-label`) so the whole trend is announced as one unit. The geometry
// lives in the pure `sparklinePoints` helper; this component only draws.
//
// `history` arrives newest-first (as stored), so it's reversed to oldest→newest
// for a left-to-right trend. Renders nothing until there are at least two runs to
// connect — a single point isn't a trend. An emerald polyline uses the same accent
// token as the rest of /lightning; the latest run gets a brighter dot, and an
// optional dashed reference line marks the personal best.
export function LightningSparkline({
  history,
  bestScore,
  className,
}: {
  history: LightningRunRecord[]; // newest-first, as stored
  bestScore?: number;
  className?: string;
}): React.JSX.Element | null {
  if (history.length < 2) return null;

  // Oldest→newest for a left-to-right reading; scores drive the geometry.
  const chronological = [...history].reverse();
  const scores = chronological.map((r) => r.score);
  const points = sparklinePoints(scores, VIEW_W, VIEW_H);
  if (!points) return null;

  // The latest run is the final coordinate pair — highlight it with a dot.
  const coords = points.split(" ");
  const [lastX, lastY] = coords[coords.length - 1].split(",").map(Number);

  const latest = scores[scores.length - 1];
  const best = bestScore ?? Math.max(...scores);
  const max = Math.max(...scores);

  // A dashed reference line at the best score, only when it's above the plotted
  // range (otherwise it'd overlap the polyline's own peak). Uses the same PAD/scale
  // as sparklinePoints so it lines up with the geometry.
  const PAD = 4;
  const showBestLine = typeof bestScore === "number" && bestScore > 0 && bestScore >= max;
  const bestY = PAD; // best ≥ max, so the line sits at the top of the box

  const label = `Score trend for your last ${scores.length} runs. Latest ${latest.toLocaleString()}, best ${best.toLocaleString()}.`;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      className={className}
    >
      {showBestLine ? (
        <line
          x1={PAD}
          y1={bestY}
          x2={VIEW_W - PAD}
          y2={bestY}
          stroke="var(--color-accent)"
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.4}
        />
      ) : null}
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r={3} fill="var(--color-accent)" />
    </svg>
  );
}
