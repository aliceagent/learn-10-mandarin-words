import test from "node:test";
import assert from "node:assert/strict";

import rawData from "../src/data/topics.json" with { type: "json" };
import {
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
  categoryMetaDescription,
  categoryBreadcrumbJsonLd,
  serializeJsonLd,
  siteDescription,
  sitemapEntries,
  topicBreadcrumbJsonLd,
  topicMetaDescription,
  topicWordListJsonLd,
  webApplicationJsonLd,
  websiteJsonLd,
} from "../src/lib/seo.ts";
import { getCategory, getTopic, topicsForCategory } from "../src/lib/data-logic.ts";
import robots from "../src/app/robots.ts";

const topics = rawData.topics;
const categories = rawData.categories;

test("SITE_URL has no trailing slash", () => {
  assert.equal(SITE_URL.endsWith("/"), false);
  assert.match(SITE_URL, /^https?:\/\//);
});

test("absoluteUrl joins with or without a leading slash and never double-slashes the path", () => {
  assert.equal(absoluteUrl("/topics/x"), `${SITE_URL}/topics/x`);
  assert.equal(absoluteUrl("topics/x"), `${SITE_URL}/topics/x`);
  // The origin's own "//" (after the scheme) is the only allowed double slash.
  assert.equal(absoluteUrl("/path").slice(SITE_URL.length), "/path");
  assert.ok(!absoluteUrl("/path").slice("https://".length).includes("//"));
});

test("sitemapEntries covers exactly 7 + categories + topics routes, all absolute and unique", () => {
  const entries = sitemapEntries(rawData);
  assert.equal(entries.length, 7 + categories.length + topics.length);

  const urls = entries.map((e) => e.url);
  assert.equal(new Set(urls).size, urls.length, "urls must be unique");
  for (const url of urls) {
    assert.ok(url.startsWith(`${SITE_URL}/`) || url === SITE_URL, `absolute: ${url}`);
  }

  // /offline is excluded; home has priority 1.
  assert.ok(!urls.some((u) => u.endsWith("/offline")));
  assert.equal(entries.find((e) => e.url === absoluteUrl("/"))?.priority, 1);

  // Every topic and category is present.
  for (const topic of topics) assert.ok(urls.includes(absoluteUrl(`/topics/${topic.slug}`)));
  for (const category of categories) assert.ok(urls.includes(absoluteUrl(`/categories/${category.slug}`)));
});

test("robots() allows all, disallows /offline, and points at the sitemap", () => {
  const result = robots();
  assert.equal(result.rules.userAgent, "*");
  assert.equal(result.rules.allow, "/");
  assert.equal(result.rules.disallow, "/offline");
  assert.equal(result.sitemap, `${SITE_URL}/sitemap.xml`);
});

test("siteDescription uses derived counts, not hardcoded numbers", () => {
  const desc = siteDescription(topics);
  assert.ok(desc.includes(String(topics.length)));
  const wordCount = topics.reduce((sum, t) => sum + t.items.length, 0);
  assert.ok(desc.includes(new Intl.NumberFormat("en-US").format(wordCount)));
});

test("topicMetaDescription includes titleEn, titleCn, and pinyin, staying reasonably short", () => {
  const topic = getTopic(topics, "ten-types-of-pets");
  assert.ok(topic, "fixture topic exists");
  const desc = topicMetaDescription(topic);
  assert.ok(desc.includes(topic.titleEn));
  assert.ok(desc.includes(topic.titleCn));
  assert.ok(desc.includes(topic.items[0].pinyin), "pinyin accompanies hanzi");
  assert.ok(desc.includes(topic.items[0].hanzi));
  assert.ok(desc.length < 220, `length ${desc.length}`);
});

test("categoryMetaDescription includes the category name and its topic count", () => {
  const category = categories[0];
  const catTopics = topicsForCategory(topics, category.slug);
  const desc = categoryMetaDescription(category, catTopics);
  assert.ok(desc.includes(category.name));
  assert.ok(desc.includes(String(catTopics.length)));
});

test("serializeJsonLd escapes '<' so data cannot break out of a <script> tag", () => {
  const json = serializeJsonLd({ evil: "</script><script>alert(1)" });
  assert.ok(!json.includes("</script>"));
  assert.ok(json.includes("\\u003c/script>"));
});

test("topicWordListJsonLd lists every item with hanzi, pinyin, and english", () => {
  const topic = getTopic(topics, "ten-types-of-pets");
  const ld = topicWordListJsonLd(topic);
  assert.equal(ld["@type"], "ItemList");
  assert.equal(ld.numberOfItems, topic.items.length);
  assert.equal(ld.itemListElement.length, topic.items.length);
  const first = ld.itemListElement[0];
  assert.equal(first.position, 1);
  assert.ok(first.name.includes(topic.items[0].hanzi));
  assert.ok(first.name.includes(topic.items[0].pinyin));
  assert.ok(first.name.includes(topic.items[0].english));
});

test("breadcrumb builders produce ordered ListItems ending at the current page", () => {
  const topic = getTopic(topics, "ten-types-of-pets");
  const crumb = topicBreadcrumbJsonLd(topic);
  assert.equal(crumb["@type"], "BreadcrumbList");
  assert.equal(crumb.itemListElement.length, 3);
  assert.deepEqual(
    crumb.itemListElement.map((el) => el.position),
    [1, 2, 3],
  );
  assert.equal(crumb.itemListElement[2].item, absoluteUrl(`/topics/${topic.slug}`));

  const category = getCategory(categories, topic.categorySlug);
  const catCrumb = categoryBreadcrumbJsonLd(category);
  assert.equal(catCrumb.itemListElement.length, 2);
  assert.equal(catCrumb.itemListElement[1].item, absoluteUrl(`/categories/${category.slug}`));
});

test("website and web-application JSON-LD carry the site identity and free-offer facts", () => {
  const site = websiteJsonLd();
  assert.equal(site["@type"], "WebSite");
  assert.equal(site.name, SITE_NAME);
  assert.equal(site.url, absoluteUrl("/"));

  const app = webApplicationJsonLd(topics);
  assert.equal(app["@type"], "WebApplication");
  assert.equal(app.applicationCategory, "EducationalApplication");
  assert.equal(app.offers.price, "0");
});
