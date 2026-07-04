"use client";

import { ERROR_COPY, ERROR_WORD } from "@/lib/error-copy";

/**
 * Last-resort fallback for a crash in the root layout itself. It REPLACES the
 * root layout, so none of the app shell is available: no `next/font` variables,
 * no Tailwind-processed classes, no BottomNav. Everything here is therefore
 * hand-rolled with inline styles and a hardcoded CJK font stack, and it renders
 * its own <html>/<body>. `metadata` isn't supported in a client component, so
 * the tab title uses React's <title> element.
 *
 * Kept deliberately minimal — see the Sprint 8 risk note on styling drift.
 */
const CJK_STACK =
  '"Noto Sans SC", "Noto Sans CJK SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
const SANS_STACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}): React.JSX.Element {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "4rem 1.5rem",
          textAlign: "center",
          background: "#020617",
          color: "#f8fafc",
          fontFamily: SANS_STACK,
        }}
      >
        <title>Something went wrong | Learn 10 Mandarin Words</title>

        <p style={{ margin: 0, fontFamily: CJK_STACK, fontSize: "3.5rem", fontWeight: 600, color: "#fb7185", lineHeight: 1 }}>
          {ERROR_WORD.hanzi}
        </p>
        <p style={{ margin: 0, fontFamily: CJK_STACK, fontSize: "1.125rem", color: "#cbd5e1" }}>
          {ERROR_WORD.pinyin} · <span style={{ fontStyle: "italic" }}>&ldquo;{ERROR_WORD.english}&rdquo;</span>
        </p>

        <h1 style={{ margin: "0.5rem 0 0", fontSize: "1.875rem", fontWeight: 600 }}>
          {ERROR_COPY.title}
        </h1>
        <p style={{ margin: 0, maxWidth: "28rem", color: "#cbd5e1" }}>{ERROR_COPY.body}</p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", justifyContent: "center", marginTop: "0.5rem" }}>
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              minHeight: "44px",
              padding: "0.75rem 1.5rem",
              borderRadius: "9999px",
              border: "none",
              background: "#34d399",
              color: "#020617",
              fontWeight: 600,
              fontSize: "1rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {/* Plain anchor, not next/link: global-error replaces the root layout,
              so the router/app shell may be broken — a full document load is the
              only reliable way back home. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            style={{
              minHeight: "44px",
              display: "inline-flex",
              alignItems: "center",
              padding: "0.75rem 1.5rem",
              borderRadius: "9999px",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "#f8fafc",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Back to library
          </a>
        </div>
      </body>
    </html>
  );
}
