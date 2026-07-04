import type { Metadata } from "next";
import { PracticeApp } from "@/components/practice-app";
import { data } from "@/lib/data";

export const metadata: Metadata = {
  title: "Practice",
  description:
    "A focused practice deck built from your trickiest words across every topic — weakest first. Computed on your device, no account required.",
  alternates: { canonical: "/practice" },
};

export default function PracticePage() {
  return <PracticeApp data={data} />;
}
