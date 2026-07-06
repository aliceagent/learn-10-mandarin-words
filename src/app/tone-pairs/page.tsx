import type { Metadata } from "next";
import { TonePairsApp } from "@/components/tone-pairs-app";
import { data } from "@/lib/data";

export const metadata: Metadata = {
  title: "Tone Twins",
  description:
    "A quick minimal-pair listening drill: hear a real Mandarin word and pick which of two same-sounding words — differing only by tone — you heard. Runs entirely on your device, no account required.",
  alternates: { canonical: "/tone-pairs" },
};

export default function TonePairsPage() {
  return <TonePairsApp data={data} />;
}
