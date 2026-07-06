"use client";

// Persistent "Update available" toast (Sprint 26). Unlike src/components/toast.tsx
// (a 2s auto-dismiss status chip), this stays put until the learner acts on it:
// it offers a one-tap Refresh that activates the waiting service worker and
// reloads, or a ✕ dismiss. Styling/a11y mirror the install banner in
// pwa-register.tsx (fixed above the bottom nav, emerald pill CTA, 44px targets).
export function UpdateToast({
  onRefresh,
  onDismiss,
}: {
  onRefresh: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-20 z-50 mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-white/10 bg-surface/95 px-4 py-3 shadow-2xl backdrop-blur md:bottom-6"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">Update available</p>
        <p className="truncate text-xs text-slate-400">A new version of Learn 10 is ready.</p>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        className="inline-flex min-h-[44px] shrink-0 items-center rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cta"
      >
        Refresh
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss update notice"
        className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full border border-white/10 px-2.5 py-2 text-sm text-slate-400 transition hover:text-white"
      >
        <span aria-hidden="true">✕</span>
      </button>
    </div>
  );
}
