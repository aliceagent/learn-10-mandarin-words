import { Fragment } from "react";
import { splitHighlight } from "@/lib/highlight";

// Renders `text`, wrapping any diacritic-insensitive occurrences of `query` in
// a styled <mark>. Everything is emitted as plain React text nodes — there is
// no dangerouslySetInnerHTML, so arbitrary content stays inert. When `query`
// is empty the text is returned unchanged.
export function HighlightedText({ text, query }: { text: string; query?: string }) {
  if (!query || !query.trim()) return <>{text}</>;
  const segments = splitHighlight(text, query);
  return (
    <>
      {segments.map((seg, i) =>
        seg.match ? (
          <mark key={i} className="rounded bg-emerald-300/30 px-0.5 text-emerald-100">
            {seg.text}
          </mark>
        ) : (
          <Fragment key={i}>{seg.text}</Fragment>
        ),
      )}
    </>
  );
}
