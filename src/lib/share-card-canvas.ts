// Client-only canvas layer for the shareable score card (Sprint 6). This is the
// DOM half of the feature: it renders a ShareCardData onto an offscreen <canvas>
// and owns the Web Share → clipboard → download delivery ladder. All the pure
// text/layout math lives in share-card-logic.ts (unit-tested); nothing here runs
// on the server. Imports use runtime-friendly extensions to match the repo.
import {
  SHARE_CARD_COLORS,
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
  shareTitle,
  wrapText,
  type ShareCardData,
  type ShareCardWord,
} from "./share-card-logic.ts";
import { pinyinSegments } from "./pinyin.ts";
import { SITE_NAME, SITE_URL } from "./seo.ts";

export type ShareMethod = "web-share" | "clipboard" | "download";

const DOWNLOAD_FILENAME = "mandarin-score-card.png";

// A CJK sample so document.fonts.load actually pulls the Noto Sans SC glyphs
// (which are `preload: false` in layout.tsx) before we draw — otherwise the
// first-ever card renders tofu.
const HANZI_SAMPLE = "汉字样本你好世界";

// Resolve the live font-family strings from the CSS variables next/font sets on
// <html>, with system fallbacks. Canvas can't read Tailwind classes, so we mirror
// the variables (`--font-geist-sans`, `--font-noto-sc`) and the `.font-hanzi`
// fallback stack directly.
function resolveFonts(): { sans: string; hanzi: string } {
  const fallbackSans = "system-ui, -apple-system, Segoe UI, sans-serif";
  const fallbackHanzi =
    '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Heiti SC", sans-serif';
  if (typeof getComputedStyle === "undefined" || typeof document === "undefined") {
    return { sans: fallbackSans, hanzi: fallbackHanzi };
  }
  const root = getComputedStyle(document.documentElement);
  const sansVar = root.getPropertyValue("--font-geist-sans").trim();
  const hanziVar = root.getPropertyValue("--font-noto-sc").trim();
  return {
    sans: sansVar ? `${sansVar}, ${fallbackSans}` : fallbackSans,
    hanzi: hanziVar ? `${hanziVar}, ${fallbackHanzi}` : fallbackHanzi,
  };
}

// Best-effort: wait for the fonts we're about to draw with. Never throws — a
// font-load failure just means the fallback stack paints instead.
async function ensureFonts(fonts: { sans: string; hanzi: string }): Promise<void> {
  const docFonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!docFonts) return;
  try {
    await Promise.all([
      docFonts.load(`700 96px ${fonts.sans}`),
      docFonts.load(`500 44px ${fonts.sans}`),
      docFonts.load(`700 120px ${fonts.hanzi}`, HANZI_SAMPLE),
      docFonts.load(`500 40px ${fonts.hanzi}`, HANZI_SAMPLE),
    ]);
    await docFonts.ready;
  } catch {
    // Fonts unavailable — proceed with fallbacks rather than blocking the share.
  }
}

// roundRect isn't in every engine's typings; use it when present, else trace it.
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// Draw a pinyin line centered at `centerX`. When tone colors are on, each
// syllable is painted in its tone color (segments measured first so the whole
// line stays centered); otherwise the line is a single soft-emerald string. The
// tone marks in the text remain either way, so color is only ever an extra
// channel — never the sole one.
function drawPinyin(
  ctx: CanvasRenderingContext2D,
  pinyin: string,
  centerX: number,
  y: number,
  font: string,
  toneColors: boolean,
): void {
  ctx.font = font;
  if (!toneColors) {
    ctx.textAlign = "center";
    ctx.fillStyle = SHARE_CARD_COLORS.accentSoft;
    ctx.fillText(pinyin, centerX, y);
    return;
  }
  const segments = pinyinSegments(pinyin);
  const widths = segments.map((s) => ctx.measureText(s.text).width);
  const totalWidth = widths.reduce((sum, w) => sum + w, 0);
  ctx.textAlign = "left";
  let x = centerX - totalWidth / 2;
  segments.forEach((segment, i) => {
    ctx.fillStyle =
      segment.tone === null ? SHARE_CARD_COLORS.accentSoft : SHARE_CARD_COLORS.tone[segment.tone - 1];
    ctx.fillText(segment.text, x, y);
    x += widths[i];
  });
  ctx.textAlign = "center";
}

// The big numeral shown under the headline, plus its caption, per variant.
function bigNumeral(data: ShareCardData): { value: string; caption: string } {
  if (data.kind === "practice") {
    return { value: `${data.score}/${data.total}`, caption: "tricky words nailed" };
  }
  if (data.kind === "review") {
    return {
      value: `${data.total}`,
      caption: `card${data.total !== 1 ? "s" : ""} reviewed`,
    };
  }
  if (data.streak > 0) return { value: `${data.streak}`, caption: "day streak 🔥" };
  return { value: `${data.reviewedWords}`, caption: "words reviewed" };
}

// The featured words for the variant (practice → missed, review → toughest,
// stats → none), capped at three.
function featuredWords(data: ShareCardData): ShareCardWord[] {
  if (data.kind === "practice") return data.missed.slice(0, 3);
  if (data.kind === "review") return data.toughest.slice(0, 3);
  return [];
}

// Render the card to an offscreen canvas at SHARE_CARD_WIDTH × SHARE_CARD_HEIGHT.
// Awaits the required fonts (with a CJK sample) before drawing so hanzi never
// renders as tofu. Client-only; the caller guards for a browser context.
export async function renderShareCard(
  data: ShareCardData,
  opts: { toneColors: boolean },
): Promise<HTMLCanvasElement> {
  const fonts = resolveFonts();
  await ensureFonts(fonts);

  const canvas = document.createElement("canvas");
  canvas.width = SHARE_CARD_WIDTH;
  canvas.height = SHARE_CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  const C = SHARE_CARD_COLORS;
  const W = SHARE_CARD_WIDTH;
  const H = SHARE_CARD_HEIGHT;
  const centerX = W / 2;

  // Background + inset surface panel.
  ctx.fillStyle = C.background;
  ctx.fillRect(0, 0, W, H);
  const margin = 56;
  roundRectPath(ctx, margin, margin, W - margin * 2, H - margin * 2, 48);
  ctx.fillStyle = C.surface;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = C.border;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Brand eyebrow.
  ctx.font = `600 34px ${fonts.sans}`;
  ctx.fillStyle = C.accent;
  ctx.fillText("🀄  " + SITE_NAME.toUpperCase(), centerX, 200);

  // Headline (tiered / streak-led).
  ctx.font = `700 72px ${fonts.sans}`;
  ctx.fillStyle = C.inkHigh;
  ctx.fillText(shareTitle(data), centerX, 320);

  // Big numeral + caption.
  const { value, caption } = bigNumeral(data);
  ctx.font = `800 200px ${fonts.sans}`;
  ctx.fillStyle = C.accent;
  ctx.fillText(value, centerX, 560);
  ctx.font = `500 40px ${fonts.sans}`;
  ctx.fillStyle = C.inkMid;
  ctx.fillText(caption, centerX, 630);

  // Featured words (each: hanzi, pinyin under it, English gloss). English wraps
  // so a long gloss never overflows the panel.
  const words = featuredWords(data);
  if (words.length > 0) {
    ctx.font = `600 30px ${fonts.sans}`;
    ctx.fillStyle = C.inkLow;
    ctx.fillText(
      data.kind === "practice" ? "KEEP PRACTICING" : "TOUGHEST THIS SESSION",
      centerX,
      730,
    );

    let y = 810;
    const maxGloss = W - margin * 2 - 120;
    for (const word of words) {
      ctx.font = `700 80px ${fonts.hanzi}`;
      ctx.fillStyle = C.inkHigh;
      ctx.fillText(word.hanzi, centerX, y);

      drawPinyin(ctx, word.pinyin, centerX, y + 52, `500 40px ${fonts.hanzi}`, opts.toneColors);

      ctx.font = `400 38px ${fonts.sans}`;
      ctx.fillStyle = C.inkMid;
      const glossLines = wrapText(word.english, maxGloss, (s) => ctx.measureText(s).width);
      let gy = y + 104;
      for (const gl of glossLines) {
        ctx.fillText(gl, centerX, gy);
        gy += 46;
      }
      y = gy + 40;
    }
  }

  // Footer: brand · host, pinned near the bottom of the panel.
  let host = SITE_URL;
  try {
    host = new URL(SITE_URL).host;
  } catch {
    // Non-URL override — fall back to the raw string.
  }
  ctx.font = `500 34px ${fonts.sans}`;
  ctx.fillStyle = C.inkMid;
  ctx.fillText(`${SITE_NAME} · ${host}`, centerX, H - 110);

  return canvas;
}

// Promisified toBlob("image/png"); rejects when the browser hands back null.
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas produced no image data"));
    }, "image/png");
  });
}

// ─── Capability probes (for showing only actionable buttons) ──────────────────

/** True when this browser can share a PNG file via the Web Share API. */
export function canShareImage(): boolean {
  if (typeof navigator === "undefined" || typeof File === "undefined") return false;
  if (typeof navigator.canShare !== "function" || typeof navigator.share !== "function") return false;
  try {
    const probe = new File([new Blob()], DOWNLOAD_FILENAME, { type: "image/png" });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/** True when this browser can write an image blob to the clipboard. */
export function canCopyImage(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.clipboard &&
    typeof navigator.clipboard.write === "function" &&
    typeof ClipboardItem !== "undefined"
  );
}

/** True when this browser can copy text to the clipboard. */
export function canCopyText(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  );
}

// ─── Delivery actions ─────────────────────────────────────────────────────────

// Copy the rendered PNG to the clipboard. The ClipboardItem is constructed
// SYNCHRONOUSLY around the `makeBlob()` promise (Safari requires the write to
// start inside the user gesture with a pending payload) — so `makeBlob` is a
// thunk, never a pre-awaited blob. Returns true on success.
export async function copyImage(makeBlob: () => Promise<Blob>): Promise<boolean> {
  if (!canCopyImage()) return false;
  try {
    const item = new ClipboardItem({ "image/png": makeBlob() });
    await navigator.clipboard.write([item]);
    return true;
  } catch {
    return false;
  }
}

// Save the PNG via an object-URL download, mirroring exportProgress in
// use-progress.ts. Always available where the DOM is.
export function downloadImage(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = DOWNLOAD_FILENAME;
  a.click();
  URL.revokeObjectURL(url);
}

// The full capability ladder for the primary "Share" action: Web Share (files)
// first, then clipboard image, then a PNG download. Returns which method ran, or
// "cancelled" when the user dismisses the native share sheet (AbortError). Never
// throws to the caller.
export async function deliverShareCard(
  makeBlob: () => Promise<Blob>,
  text: string,
): Promise<ShareMethod | "cancelled"> {
  // 1) Web Share with the image file attached.
  if (canShareImage()) {
    try {
      const file = new File([await makeBlob()], DOWNLOAD_FILENAME, { type: "image/png" });
      await navigator.share({ files: [file], text });
      return "web-share";
    } catch (err) {
      if (err && (err as { name?: string }).name === "AbortError") return "cancelled";
      // Otherwise fall through to the next rung.
    }
  }

  // 2) Clipboard image.
  if (await copyImage(makeBlob)) return "clipboard";

  // 3) Download.
  downloadImage(await makeBlob());
  return "download";
}
