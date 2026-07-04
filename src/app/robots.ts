import type { MetadataRoute } from "next";
// Relative import (not "@/") so this route file is directly importable under
// `node --test` — the type-only "next" import is stripped at load time.
import { SITE_URL } from "../lib/seo.ts";

export default function robots(): MetadataRoute.Robots {
  return {
    // Allow everything except the offline SW-fallback shell.
    rules: { userAgent: "*", allow: "/", disallow: "/offline" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
