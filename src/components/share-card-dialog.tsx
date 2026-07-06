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

type Surface = "stats" | "practice" | "review" | "weekly";

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

// The score-card preview dialog: renders the card on-device (canvas) and offers
// Share / Copy image / Copy text / Save PNG. Lazy-loaded by ShareScoreButton so
// the canvas pipeline stays out of the initial bundle — it only exists while the
// dialog is open, so it renders the card on mount and calls onClose to dismiss.
export function ShareCardDialog({
  data,
  surface,
  onClose,
}: {
  data: ShareCardData;
  surface: Surface;
  onClose: () => void;
}) {
  const { enabled: toneColors } = useToneColors();

  const [rendering, setRendering] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

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

  // Render the card once, on mount (the dialog only exists while open — so the
  // initial rendering=true / failed=false state already covers the first paint).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const canvas = await renderShareCard(data, { toneColors });
        if (cancelled) return;
        canvasRef.current = canvas;
        const blob = await canvasToBlob(canvas);
        if (cancelled) return;
        setPreviewUrl(URL.createObjectURL(blob));
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data, toneColors]);

  // Revoke the outstanding object URL when the dialog unmounts (on close).
  useEffect(() => () => revokePreview(), [revokePreview]);

  // Move focus into the dialog once it has mounted.
  useEffect(() => {
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    focusables?.[0]?.focus();
  }, []);

  // Escape closes; Tab / Shift+Tab are trapped within the dialog.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
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
  }, [onClose]);

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

  const ready = !!previewUrl && !rendering && !failed;
  const actionClass =
    "min-h-[44px] inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 p-4 backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-card-title"
      aria-describedby="share-card-privacy"
      ref={dialogRef}
    >
      <div className="animate-celebrate w-full max-w-md rounded-3xl border border-white/10 bg-surface p-6 shadow-2xl">
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
              className={`${actionClass} bg-emerald-400 text-slate-950 hover:bg-cta disabled:opacity-40`}
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
            onClick={onClose}
            className={`${actionClass} border border-white/15 text-slate-300 hover:border-white/30`}
          >
            Done
          </button>
        </div>
      </div>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
