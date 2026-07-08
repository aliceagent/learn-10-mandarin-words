import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { TopicApp } from "@/components/topic-app";
import { TopicCheatSheet } from "@/components/topic/topic-cheat-sheet";
import { JsonLd } from "@/components/json-ld";
import { charConnectionsForTopic, data, getTopic } from "@/lib/data";
import { pageOpenGraph, topicBreadcrumbJsonLd, topicMetaDescription, topicWordListJsonLd } from "@/lib/seo";

// Lightweight placeholder shown in the brief window before the client-rendered
// TopicApp (below its useSearchParams Suspense boundary) hydrates.
function TopicAppFallback() {
  return (
    <main className="mobile-bottom-safe mx-auto max-w-7xl px-6 pt-10 md:px-10" aria-busy="true">
      <p className="text-sm text-slate-400" role="status">
        Loading the lesson…
      </p>
    </main>
  );
}

export function generateStaticParams() {
  return data.topics.map((topic) => ({ slug: topic.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const topic = getTopic(slug);
  if (!topic) return {};
  const description = topicMetaDescription(topic);
  return {
    title: topic.titleEn,
    description,
    alternates: { canonical: `/topics/${slug}` },
    openGraph: pageOpenGraph({ title: topic.titleEn, description, path: `/topics/${slug}` }),
  };
}

export default async function TopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const topic = getTopic(slug);
  if (!topic) notFound();
  // Precompute shared-character connections here, on the server, so the full
  // dataset never gets bundled into the topic-page client chunk (see
  // charConnectionsForTopic / the toTopicSummary comments in lib/types.ts).
  const connections = charConnectionsForTopic(topic);
  return (
    <>
      <JsonLd data={topicBreadcrumbJsonLd(topic)} />
      <JsonLd data={topicWordListJsonLd(topic)} />
      {/* TopicApp reads the practice mode from the URL query via useSearchParams,
          which requires a Suspense boundary so this statically-generated page can
          still be prerendered (the SEO-critical metadata + JSON-LD above stay
          server-rendered outside the boundary). */}
      <Suspense fallback={<TopicAppFallback />}>
        <TopicApp topic={topic} connections={connections} />
      </Suspense>
      <TopicCheatSheet topic={topic} />
    </>
  );
}
