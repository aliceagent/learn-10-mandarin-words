import type { Metadata } from "next";
import { StatsApp } from "@/components/stats-app";
import { data } from "@/lib/data";

export const metadata: Metadata = {
  title: "Your Stats | Learn 10 Mandarin Words",
  description:
    "A local snapshot of your Mandarin progress — learned topics, favorite words, due reviews, and study streak. Computed on your device, no account required.",
};

export default function StatsPage() {
  const totalTopics = data.topics.length;
  const totalWords = data.topics.reduce((sum, topic) => sum + topic.items.length, 0);
  return <StatsApp totalTopics={totalTopics} totalWords={totalWords} />;
}
