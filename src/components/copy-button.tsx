"use client";

import { useCallback, useState } from "react";

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
}

/**
 * Copies `text` to the clipboard using the async Clipboard API. Renders nothing
 * where that API is unavailable (older browsers / insecure contexts), so it
 * never shows a button that can't work. Client-side only; no network.
 */
export function CopyButton({ text, label, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      },
      () => {},
    );
  }, [text]);

  if (typeof navigator !== "undefined" && !navigator.clipboard) return null;

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label ?? `Copy: ${text}`}
      title={label ?? `Copy: ${text}`}
      className={
        className ??
        "inline-flex items-center justify-center rounded-full border border-white/10 p-2 text-slate-400 transition hover:border-emerald-300 hover:text-emerald-300"
      }
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z" />
        </svg>
      )}
    </button>
  );
}
