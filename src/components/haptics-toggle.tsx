"use client";

import { useHaptics } from "./use-haptics";

// Quiet Level-2 chip that flips the device-local "Vibration" setting, styled
// identically to ToneColorsToggle. Renders nothing on devices without
// navigator.vibrate support (notably iOS Safari and most desktops), so no dead
// UI ever appears. Mounted on topic pages under the mode tabs; the setting is
// global, and the answer handlers on /practice, /daily, /lightning, and /duel
// read the same shared store even though the chip isn't shown there.
export function HapticsToggle() {
  const { enabled, supported, toggle } = useHaptics();
  if (!supported) return null;
  return (
    <div className="flex flex-col items-end gap-1.5 text-right">
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={toggle}
          aria-pressed={enabled}
          aria-label={enabled ? "Turn vibration off" : "Turn vibration on"}
          className={`inline-flex min-h-[44px] items-center rounded-xl border px-4 py-2 text-sm font-semibold transition ${
            enabled
              ? "border-emerald-300 bg-emerald-400/10 text-white"
              : "border-white/10 bg-white/[0.04] text-slate-200 hover:border-white/25"
          }`}
        >
          Vibration
        </button>
        <p className="text-xs text-ink-low">
          Buzz on quiz answers. Saved on this device.
        </p>
      </div>
    </div>
  );
}
