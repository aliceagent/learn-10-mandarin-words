import { wordIndex } from "@/lib/data";

// Static word-search index (Sprint 24). The home page ships a hanzi-only topic
// index; the pinyin/english for all 1,020 words load lazily from here only when
// the learner focuses the search box. `force-static` prerenders this GET at build
// time (see node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md)
// — it derives purely from topics.json, so it never drifts and needs no runtime
// compute or backend. The service worker precaches it so cold-offline search works.
export const dynamic = "force-static";

export function GET() {
  return Response.json(wordIndex());
}
