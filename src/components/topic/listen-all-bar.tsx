import { HANZI_LANG, PINYIN_LANG } from "@/lib/lang";
import { listenProgressLabel, type ListenStep } from "@/lib/listen-logic";
import type { ListenStatus } from "../use-listen-all";

// The "Play all" bar above the Words grid: one emerald pill that toggles between
// starting the hands-free listening drill and stopping it, a live progress
// readout, and the shared no-voice hint. Presentational — the parent (WordsPanel)
// owns the useListenAll hook and gates this bar on speech availability, so this
// component just renders status and reports Play/Stop intents.
export function ListenAllBar({
  status,
  activeIndex,
  activeStep,
  total,
  onPlayAll,
  onStop,
}: {
  status: ListenStatus;
  activeIndex: number | null;
  activeStep: ListenStep | null;
  total: number;
  onPlayAll: () => void;
  onStop: () => void;
}): React.ReactElement {
  const playing = status === "playing";

  return (
    <div className="mb-6 rounded-3xl border border-white/10 bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={playing ? onStop : onPlayAll}
          aria-label={playing ? "Stop playback" : "Play all ten words"}
          aria-pressed={playing}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-cta"
        >
          {playing ? "■ Stop" : "▶ Play all"}
        </button>

        {/* Progress / status readout. role="status" so the current word is
            announced politely to screen readers as the drill advances. */}
        <div role="status" aria-live="polite" className="min-w-0 flex-1 text-sm">
          {playing && activeStep ? (
            <p className="text-slate-300">
              <span className="font-semibold text-emerald-300">
                {listenProgressLabel(activeIndex ?? 0, total)}
              </span>
              <span className="mx-2 text-slate-600" aria-hidden="true">·</span>
              <span lang={HANZI_LANG} className="font-hanzi text-white">{activeStep.text}</span>
              {activeStep.pinyin ? (
                <span lang={PINYIN_LANG} className="font-hanzi ml-2 text-emerald-300">{activeStep.pinyin}</span>
              ) : null}
              <span className="text-slate-400"> — {activeStep.english}</span>
            </p>
          ) : status === "done" ? (
            <p className="font-semibold text-emerald-300">Played all {total} ✓ — play again?</p>
          ) : (
            <p className="text-slate-400">Listen straight through — each word plays once.</p>
          )}
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-600">No sound? Your device may lack a Chinese voice.</p>
    </div>
  );
}
