import type { Metadata } from "next";
import { ReviewApp } from "@/components/review-app";
import { data } from "@/lib/data";

export const metadata: Metadata = {
  title: "Daily Review | Learn 10 Mandarin Words",
  description: "Review your spaced-repetition flashcard queue for today.",
};

export default function ReviewPage() {
  return <ReviewApp data={data} />;
}
