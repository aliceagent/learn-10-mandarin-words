import type { Metadata } from "next";
import { ComebackApp } from "@/components/comeback-app";
import { data } from "@/lib/data";

export const metadata: Metadata = {
  title: "Welcome back",
  description: "Ease back in after time away with a gentle warm-up of words you already know.",
  alternates: { canonical: "/comeback" },
};

export default function ComebackPage() {
  return <ComebackApp data={data} />;
}
