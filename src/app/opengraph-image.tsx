import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/seo";

// Root-level share card, inherited by every route via metadataBase. 1200×630 is
// the standard Open Graph / Twitter summary_large_image size.
//
// Text is English/pinyin only on purpose: the default `next/og` font is
// Latin-only, so hanzi would render as tofu boxes. No CJK font is bundled.

export const alt = "Learn 10 Mandarin Words — learn Mandarin ten words at a time";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          // Match the app chrome: deep slate background, emerald accent.
          background: "#020617",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 34, color: "#34d399", fontWeight: 600, letterSpacing: 4 }}>
          LEARN MANDARIN · FREE
        </div>
        <div style={{ marginTop: 28, fontSize: 96, fontWeight: 700, lineHeight: 1.05 }}>{SITE_NAME}</div>
        <div style={{ marginTop: 36, fontSize: 40, color: "#94a3b8" }}>
          Ten words at a time · pinyin · flashcards · quizzes
        </div>
        <div
          style={{
            marginTop: 56,
            width: 180,
            height: 8,
            borderRadius: 999,
            background: "#34d399",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
