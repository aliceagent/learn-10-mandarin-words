"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildShareText, type ShareCardData } from "@/lib/share-card-logic";
import {
  canCopyImage,
  canCopyText,
  canShareImage,
  canvasToBlob,
  copyImage,
  deliverShareCard,
  downloadImage,
  renderShareCard,
  type ShareMethod,
} from "@/lib/share-card-canvas";
import { SITE_URL } from "@/lib/seo";
import { track } from "@/lib/analytics";
import { useToneColors } from "./use-tone-colors";
import { Toast } from "./toast";

type Surface = "stats" | "practice" | "review";

// Elements that can receive keyboard focus inside the dialog (mirrors onboarding.tsx).
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// The site host, derived once from SITE_URL for the text snippet's last line.
const SITE_HOST = (() => {
  try {
    return new URL(SITE_URL).host;
  } catch {
    return SITE_URL;
  }
})();

// True when the card has anything worth sharing. A stats card with zero activity
// is hidden entirely (nothing to brag about); practice/review need a real run.
function hasSomethingToShare(data: ShareCardData): boolean {
  if (data.kind === "stats") {
    return data.streak > 0 || data.reviewedWords > 0 || data.learnedTopics > 0 || data.daysStudied > 0;
  }
  return data.total > 0;
}

// A shareable score card: a trigger button that opens a preview dialog with
// Share / Copy image / Copy text / Save PNG actions. The card image is generated
// entirely on-device (canvas) — nothing is uploaded unless the user shares it.
export function ShareScoreButton({
  data,
  surface,
  className,
}: {
  data: ShareCardData;
  surface: Surface;
  className?: string;
}) {
  const { enabled: toneColors } = useToneColors();

  const [open, setOpen] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const label = surface === "stats" ? "Share progress 📸" : "Share score card 📸";
  const text = buildShareText(data, SITE_HOST);

  // Fresh blob per call — copy/share on Safari must receive a pending payload
  // rather than a pre-awaited one (see share-card-canvas.copyImage).
  const makeBlob = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return Promise.reject(new Error("Card not rendered"));
    return canvasToBlob(canvas);
  }, []);

  const revokePreview = useCallback(() => {
    setPreviewUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
  }, []);

  const openDialog = useCallback(async () => {
    previouslyFocused.current = (document.activeElement as HTMLElement | null) ?? null;
    setOpen(true);
    setRendering(true);
    setFailed(false);
    try {
      const canvas = await renderShareCard(data, { toneColors });
      canvasRef.current = canvas;
      const blob = await canvasToBlob(canvas);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch {
      setFailed(true);
    } finally {
      setRendering(false);
    }
  }, [data, toneColors]);

  const closeDialog = useCallback(() => {
    revokePreview();
    canvasRef.current = null;
    setOpen(false);
    // Restore focus to the trigger (it may have unmounted after navigation).
    previouslyFocused.current?.focus?.();
  }, [revokePreview]);

  // Revoke any outstanding object URL if the component unmounts while open.
  useEffect(() => () => revokePreview(), [revokePreview]);

  // Move focus into the dialog once it has opened.
  useEffect(() => {
    if (!open) return;
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    focusables?.[0]?.focus();
  }, [open]);

  // Escape closes; Tab / Shift+Tab are trapped within the dialog.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeDialog();
        return;
      }
      if (e.key !== "Tab") return;
      const node = dialogRef.current;
      if (!node) return;
      const focusables = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !node.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !node.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, closeDialog]);

  const onShared = useCallback(
    (method: ShareMethod | "text") => {
      track("score_card_shared", { surface, method });
    },
    [surface],
  );

  const handleShare = useCallback(async () => {
    try {
      const method = await deliverShareCard(makeBlob, text);
      if (method === "cancelled") return;
      onShared(method);
      if (method === "clipboard") setToast("Score card copied 📋");
      else if (method === "download") setToast("Saved as PNG");
    } catch {
      setToast("Couldn't share — try Copy or Save instead");
    }
  }, [makeBlob, text, onShared]);

  const handleCopyImage = useCallback(async () => {
    const ok = await copyImage(makeBlob);
    if (ok) {
      onShared("clipboard");
      setToast("Score card copied 📋");
    } else {
      setToast("Couldn't share — try Copy or Save instead");
    }
  }, [makeBlob, onShared]);

  const handleCopyText = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      onShared("text");
      setToast("Text copied 📋");
    } catch {
      setToast("Couldn't share — try Copy or Save instead");
    }
  }, [text, onShared]);

  const handleSave = useCallback(async () => {
    try {
      downloadImage(await makeBlob());
      onShared("download");
      setToast("Saved as PNG");
    } catch {
      setToast("Couldn't share — try Copy or Save instead");
    }
  }, [makeBlob, onShared]);

  if (!hasSomethingToShare(data)) return null;

  const ready = !!previewUrl && !rendering && !failed;
  const actionClass =
    "min-h-[44px] inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition";

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className={
          className ??
          "min-h-[44px] inline-flex items-center rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-emerald-300"
        }
      >
        {label}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur"
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-card-title"
          aria-describedby="share-card-privacy"
          ref={dialogRef}
        >
          <div className="animate-celebrate w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h2 id="share-card-title" className="text-2xl font-semibold tracking-tight text-white">
              Your score card
            </h2>

            {/* Preview: fixed 4:5 well so the layout doesn't jump while rendering. */}
            <div className="mt-4 aspect-[4/5] overflow-hidden rounded-2xl border border-white/10 bg-surface">
              {ready ? (
                // eslint-disable-next-line @next/next/no-img-element -- a client-side object URL, not a static asset for next/image
                <img
                  src={previewUrl}
                  alt="Your Mandarin score card"
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-center text-sm text-slate-400">
                  {failed ? "Couldn't build the card. Try again." : "Building your card…"}
                </div>
              )}
            </div>

            <p id="share-card-privacy" className="mt-3 text-xs text-slate-500">
              Made on your device — nothing is uploaded unless you share it.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {canShareImage() ? (
                <button
                  type="button"
                  onClick={handleShare}
                  disabled={!ready}
                  className={`${actionClass} bg-emerald-400 text-slate-950 hover:bg-emerald-300 disabled:opacity-40`}
                >
                  Share image
                </button>
              ) : null}
              {canCopyImage() ? (
                <button
                  type="button"
                  onClick={handleCopyImage}
                  disabled={!ready}
                  className={`${actionClass} border border-white/15 text-white hover:border-emerald-300 disabled:opacity-40`}
                >
                  Copy image
                </button>
              ) : null}
              {canCopyText() ? (
                <button
                  type="button"
                  onClick={handleCopyText}
                  className={`${actionClass} border border-white/15 text-white hover:border-emerald-300`}
                >
                  Copy text
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleSave}
                disabled={!ready}
                className={`${actionClass} border border-white/15 text-white hover:border-emerald-300 disabled:opacity-40`}
              >
                Save PNG
              </button>
              <button
                type="button"
                onClick={closeDialog}
                className={`${actionClass} border border-white/15 text-slate-300 hover:border-white/30`}
              >
                Done
              </button>
            </div>
          </div>

          <Toast message={toast} onDone={() => setToast(null)} />
        </div>
      ) : null}
    </>
  );
}
