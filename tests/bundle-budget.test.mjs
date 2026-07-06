import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Bundle-budget guardrail for Sprint 23. The boss round (topic pages) and the
// share-card dialog + canvas renderer (stats/practice/review) are lazy-loaded via
// next/dynamic so they stay OUT of each route's initial JavaScript. Duel already
// rides App Router route-splitting and must stay confined to /duel. These tests
// read the real Turbopack build output — the prerendered HTML under
// .next/server/app names exactly a page's initial chunks — and fail CI if that
// heavy code creeps back into first paint or the payload regresses past budget.
//
// Markers are SOURCE STRING LITERALS: minification drops identifier names
// (function names never survive) but preserves string literals, so every marker
// is a copy string verified unique to its source file. Reword a marker's source
// copy and its test breaks — the assertion messages say which file to re-sync.

const nextDir = fileURLToPath(new URL("../.next/", import.meta.url));
const appDir = `${nextDir}server/app`;
const chunksDir = `${nextDir}static/chunks`;

// A build-less `npm run test` stays green: skip (don't fail) when no build exists.
const skip = existsSync(appDir) ? false : "run `npm run build` first";

const MARKERS = {
  bossPanel: "call the tones", // src/components/topic/boss-panel.tsx
  shareCanvas: "mandarin-score-card.png", // src/lib/share-card-canvas.ts
  shareDialog: "nothing is uploaded unless you share it", // src/components/share-card-dialog.tsx
  duel: "Player 1", // src/components/duel-app.tsx
};

// Byte budgets = measured post-change initial JS + 10% headroom, so a real
// regression trips CI while ordinary Next/Tailwind drift has room. Measured on a
// Next 16.2.9 Turbopack `next build` after this sprint's dynamic() splits:
//   topic (/topics/[slug]) : 1_147_552 B   (pre-sprint baseline ~1,132 KB)
//   stats  (/stats)        :   708_378 B   (pre-sprint baseline ~701 KB)
// NOTE: the roadmap's 1,096 KB topic figure predates sprints 19–22 (print sheet,
// shortcuts overlay, SR announcements, hanzi sizing), which grew topic-app; the
// honest win here is 1,132 KB → 1,121 KB against the current tree.
const TOPIC_BUDGET = 1_262_307; // 1_147_552 + 10%
const STATS_BUDGET = 779_216; // 708_378 + 10%

// Extract the deduped initial /_next/static/chunks/*.js paths a prerendered page
// pulls in (the HTML is the reliable index — Turbopack chunk names are hashed).
function initialChunkPaths(htmlFile) {
  const html = readFileSync(htmlFile, "utf8");
  const re = /_next\/(static\/chunks\/[^"]+?\.js)/g;
  const set = new Set();
  let m;
  while ((m = re.exec(html))) set.add(m[1]);
  return [...set];
}

function chunkText(relPath) {
  return readFileSync(`${nextDir}${relPath}`, "utf8");
}

function totalBytes(paths) {
  return paths.reduce((n, p) => n + statSync(`${nextDir}${p}`).size, 0);
}

function anyChunkContains(paths, marker) {
  return paths.some((p) => chunkText(p).includes(marker));
}

function topicHtmlFiles() {
  const dir = `${appDir}/topics`;
  return readdirSync(dir)
    .filter((f) => f.endsWith(".html"))
    .map((f) => `${dir}/${f}`);
}

// Union of initial chunks across every prerendered topic page (all share the one
// /topics/[slug] client bundle, but union guards against per-page divergence).
function uniqueTopicChunkPaths() {
  const set = new Set();
  for (const f of topicHtmlFiles()) for (const p of initialChunkPaths(f)) set.add(p);
  return [...set];
}

// 1. Topic pages must not ship the boss round in initial JS.
test("topic-page initial chunks exclude the boss-round code", { skip }, () => {
  const htmls = topicHtmlFiles();
  assert.ok(htmls.length >= 100, `expected 100 prerendered topic pages, found ${htmls.length}`);
  assert.ok(
    !anyChunkContains(uniqueTopicChunkPaths(), MARKERS.bossPanel),
    `"${MARKERS.bossPanel}" (boss-panel.tsx) leaked into a topic-page initial chunk — the boss round must stay behind next/dynamic`,
  );
});

// 2. Stats / practice / review must not ship the share-card dialog or canvas.
for (const route of ["stats", "practice", "review"]) {
  test(`${route} initial chunks exclude the share-card canvas + dialog`, { skip }, () => {
    const paths = initialChunkPaths(`${appDir}/${route}.html`);
    assert.ok(
      !anyChunkContains(paths, MARKERS.shareCanvas),
      `"${MARKERS.shareCanvas}" (share-card-canvas.ts) leaked into ${route} initial JS — the canvas pipeline must stay lazy`,
    );
    assert.ok(
      !anyChunkContains(paths, MARKERS.shareDialog),
      `"${MARKERS.shareDialog}" (share-card-dialog.tsx) leaked into ${route} initial JS — the dialog must stay lazy`,
    );
  });
}

// 3. The deferred code must exist SOMEWHERE — otherwise the exclusions above pass
//    vacuously (e.g. the marker string was reworded and no chunk carries it).
test("boss + share-card code is present in on-demand chunks", { skip }, () => {
  const files = readdirSync(chunksDir)
    .filter((f) => f.endsWith(".js"))
    .map((f) => `static/chunks/${f}`);
  for (const key of ["bossPanel", "shareCanvas", "shareDialog"]) {
    const marker = MARKERS[key];
    assert.ok(
      files.some((p) => chunkText(p).includes(marker)),
      `marker "${marker}" (${key}) not found in any chunk — if the source copy was reworded, re-sync MARKERS.${key} with its source file`,
    );
  }
});

// 4. Duel stays route-isolated: its marker appears only on /duel.
test("duel code stays isolated to the /duel route", { skip }, () => {
  for (const route of ["index", "topics/ten-types-of-tea", "stats", "practice", "review"]) {
    const paths = initialChunkPaths(`${appDir}/${route}.html`);
    assert.ok(
      !anyChunkContains(paths, MARKERS.duel),
      `"${MARKERS.duel}" (duel-app.tsx) leaked into ${route} initial JS — duel must stay confined to /duel`,
    );
  }
  // Sanity: /duel really does carry the marker, so the absences above mean something.
  assert.ok(
    anyChunkContains(initialChunkPaths(`${appDir}/duel.html`), MARKERS.duel),
    `"${MARKERS.duel}" missing from /duel initial JS — re-sync MARKERS.duel with duel-app.tsx`,
  );
});

// 5. Byte budgets hold, and every chunk the HTML references exists on disk (this
//    also guards the initialChunkPaths regex against future HTML-shape changes).
test("initial-JS byte budgets hold and every referenced chunk exists", { skip }, () => {
  const topicPaths = initialChunkPaths(topicHtmlFiles()[0]);
  const statsPaths = initialChunkPaths(`${appDir}/stats.html`);

  for (const p of [...topicPaths, ...statsPaths]) {
    assert.ok(existsSync(`${nextDir}${p}`), `referenced chunk missing on disk: ${p}`);
  }

  const topicBytes = totalBytes(topicPaths);
  const statsBytes = totalBytes(statsPaths);
  assert.ok(
    topicBytes <= TOPIC_BUDGET,
    `topic-page initial JS ${topicBytes} B exceeds budget ${TOPIC_BUDGET} B — a heavy module likely regressed into first paint`,
  );
  assert.ok(
    statsBytes <= STATS_BUDGET,
    `stats initial JS ${statsBytes} B exceeds budget ${STATS_BUDGET} B — a heavy module likely regressed into first paint`,
  );
});
