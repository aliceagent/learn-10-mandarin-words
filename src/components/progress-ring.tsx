import type { ReactNode } from "react";

// Reusable SVG progress ring (shared with Sprint 10's mastery ring). An emerald
// arc sweeps a faint white track from 12 o'clock, driven by value/max. The whole
// ring is a single labelled image (`role="img"` + `aria-label`) so the visual is
// announced as one unit; `children` render centered (e.g. "7/10"). The arc's
// stroke-dashoffset transition is guarded under prefers-reduced-motion in
// globals.css, so it renders at its final position instantly when motion is off.
export function ProgressRing({
  value,
  max,
  size = 64,
  strokeWidth = 6,
  label,
  children,
}: {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  label: string;
  children?: ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const dashOffset = circumference * (1 - fraction);
  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={label}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#34d399"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="progress-ring-arc"
        />
      </svg>
      {children != null ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
          {children}
        </div>
      ) : null}
    </div>
  );
}
