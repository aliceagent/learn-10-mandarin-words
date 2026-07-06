import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TopicApp } from "@/components/topic-app";
import { JsonLd } from "@/components/json-ld";
import { charConnectionsForTopic, data, getTopic } from "@/lib/data";
import { pageOpenGraph, topicBreadcrumbJsonLd, topicMetaDescription, topicWordListJsonLd } from "@/lib/seo";

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
      <TopicApp topic={topic} connections={connections} />
    </>
  );
}
