import { notFound } from "next/navigation";
import { TopicApp } from "@/components/topic-app";
import { data, getTopic } from "@/lib/data";

export function generateStaticParams() {
  return data.topics.map((topic) => ({ slug: topic.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const topic = getTopic(slug);
  if (!topic) return {};
  return {
    title: `${topic.titleEn} | Learn 10 Mandarin Words`,
    description: `Practice ${topic.titleCn} with Mandarin flashcards, matching quizzes, and local progress tracking.`,
  };
}

export default async function TopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const topic = getTopic(slug);
  if (!topic) notFound();
  return <TopicApp topic={topic} />;
}
