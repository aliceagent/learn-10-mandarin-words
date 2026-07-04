import type { MetadataRoute } from "next";
import { data } from "@/lib/data";
import { sitemapEntries } from "@/lib/seo";

// No `lastModified` is emitted so the output is byte-stable build-to-build; the
// entry set (home + guides + utilities + all categories + all topics, minus
// /offline) is derived from the dataset in sitemapEntries, which is unit-tested.
export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries(data).map((entry) => ({
    url: entry.url,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));
}
