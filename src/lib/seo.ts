import type { Category, MandarinData, Topic } from "./types";
import { datasetSummary } from "./data-logic.ts";

// Single source of truth for the site's SEO identity and pure metadata builders.
// Everything here is DOM-free and derives text only from `topics.json` data, so
// it can be unit-tested directly under `node --test` (see tests/seo.test.mjs) and
// reused by the App Router metadata/route-file conventions.

export const SITE_NAME = "Learn 10 Mandarin Words";
export const SITE_TAGLINE = "Learn Mandarin ten words at a time";

/**
 * The canonical production origin. Read from `NEXT_PUBLIC_SITE_URL` (any trailing
 * slash stripped) so the domain can change via Vercel env with no code change;
 * falls back to the Vercel project default. Never has a trailing slash, so
 * `absoluteUrl` can join paths without doubling separators.
 */
export const SITE_URL: string = (() => {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const base = configured && configured.length > 0 ? configured : "https://learn-10-mandarin-words.vercel.app";
  return base.replace(/\/+$/, "");
})();

/** Join a site-relative path to `SITE_URL`, tolerating a missing leading slash. */
export function absoluteUrl(path: string): string {
  if (!path || path === "/") return path ? `${SITE_URL}/` : SITE_URL;
  return path.startsWith("/") ? `${SITE_URL}${path}` : `${SITE_URL}/${path}`;
}

/** Home/site description, with topic + word counts derived from the dataset. */
export function siteDescription(topics: Pick<Topic, "items">[]): string {
  const { formattedListCount, formattedWordCount } = datasetSummary(topics);
  return (
    `${SITE_TAGLINE} — ${formattedListCount} topics and ${formattedWordCount} words with video ` +
    `lessons, pinyin, flashcards, quizzes, and spaced-repetition review. Free, no account, ` +
    `progress stays on your device.`
  );
}

/**
 * Per-topic description. Always pairs each sample hanzi with its pinyin (project
 * rule) and includes the English title + Chinese title. Kept short (2 samples)
 * so the whole string stays comfortably under ~200 characters.
 */
export function topicMetaDescription(topic: Topic): string {
  const samples = topic.items
    .slice(0, 2)
    .map((item) => `${item.hanzi} ${item.pinyin} (${item.english})`)
    .join(", ");
  return (
    `Learn the Mandarin words for ${topic.titleEn} (${topic.titleCn}) — ${samples}, and more, ` +
    `with example sentences, flashcards, and quizzes.`
  );
}

/** Per-category description: topic count plus a couple of example topic titles. */
export function categoryMetaDescription(category: Category, topics: Topic[]): string {
  const examples = topics.slice(0, 2).map((topic) => topic.titleEn);
  const including =
    examples.length >= 2 ? `, including ${examples[0]} and ${examples[1]}` : examples.length === 1 ? `, including ${examples[0]}` : "";
  return (
    `${topics.length} Mandarin topics in ${category.name}${including} — ten words each, ` +
    `with pinyin, flashcards, and quizzes.`
  );
}

// --- Open Graph -----------------------------------------------------------

/**
 * A complete `openGraph` object for a page. App Router *replaces* (never merges)
 * a child segment's `openGraph`, so pages that set their own must re-declare the
 * shared identity fields (siteName/type/locale) — this keeps that DRY.
 */
export function pageOpenGraph(opts: { title: string; description: string; path: string }) {
  return {
    title: opts.title,
    description: opts.description,
    url: opts.path,
    siteName: SITE_NAME,
    type: "website" as const,
    locale: "en_US",
  };
}

// --- Sitemap --------------------------------------------------------------

export type SitemapEntry = {
  url: string;
  priority: number;
  changeFrequency?: "weekly" | "monthly";
};

/**
 * Every indexable route as absolute-URL sitemap entries, derived from the
 * dataset so new topics/categories appear automatically. `/offline` is a SW
 * fallback shell and is deliberately excluded. No `lastModified` is emitted so
 * the output is deterministic build-to-build.
 */
export function sitemapEntries(data: MandarinData): SitemapEntry[] {
  const entries: SitemapEntry[] = [
    { url: absoluteUrl("/"), priority: 1, changeFrequency: "weekly" },
    { url: absoluteUrl("/path"), priority: 0.8, changeFrequency: "monthly" },
    { url: absoluteUrl("/practice"), priority: 0.8, changeFrequency: "monthly" },
    { url: absoluteUrl("/lightning"), priority: 0.8, changeFrequency: "monthly" },
    { url: absoluteUrl("/daily"), priority: 0.8, changeFrequency: "weekly" },
  ];

  for (const category of data.categories) {
    entries.push({ url: absoluteUrl(`/categories/${category.slug}`), priority: 0.8, changeFrequency: "monthly" });
  }
  for (const topic of data.topics) {
    entries.push({ url: absoluteUrl(`/topics/${topic.slug}`), priority: 0.7, changeFrequency: "monthly" });
  }
  for (const route of ["/review", "/stats", "/favorites", "/privacy"]) {
    entries.push({ url: absoluteUrl(route), priority: 0.3, changeFrequency: "monthly" });
  }

  return entries;
}

// --- JSON-LD structured data ---------------------------------------------

function breadcrumbList(items: { name: string; url: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function websiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    description: SITE_TAGLINE,
  };
}

export function webApplicationJsonLd(topics: Topic[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    description: siteDescription(topics),
    applicationCategory: "EducationalApplication",
    operatingSystem: "Any",
    // Free, no account — the same facts stated on /privacy.
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
}

export function topicBreadcrumbJsonLd(topic: Topic): Record<string, unknown> {
  return breadcrumbList([
    { name: "Library", url: absoluteUrl("/") },
    { name: topic.category, url: absoluteUrl(`/categories/${topic.categorySlug}`) },
    { name: topic.titleEn, url: absoluteUrl(`/topics/${topic.slug}`) },
  ]);
}

export function categoryBreadcrumbJsonLd(category: Category): Record<string, unknown> {
  return breadcrumbList([
    { name: "Library", url: absoluteUrl("/") },
    { name: category.name, url: absoluteUrl(`/categories/${category.slug}`) },
  ]);
}

export function topicWordListJsonLd(topic: Topic): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${topic.titleEn} — Mandarin vocabulary`,
    numberOfItems: topic.items.length,
    itemListElement: topic.items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: `${item.hanzi} ${item.pinyin} (${item.english})`,
    })),
  };
}

/**
 * Serialize JSON-LD for embedding in a `<script>` tag. Escapes `<` as `<`
 * so no data value can break out of the script element (XSS hardening).
 */
export function serializeJsonLd(value: Record<string, unknown>): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
