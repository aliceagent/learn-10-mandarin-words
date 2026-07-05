import type { Metadata } from "next";
import { DuelApp } from "@/components/duel-app";
import { homeData } from "@/lib/data";

export const metadata: Metadata = {
  title: "Pass & Play Duel",
  description:
    "A pass-and-play Mandarin vocabulary duel for two learners on one device — take turns, tally the score, no account or network needed.",
  alternates: { canonical: "/duel" },
};

export default function DuelPage() {
  return <DuelApp data={homeData()} />;
}
