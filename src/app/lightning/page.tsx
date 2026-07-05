import type { Metadata } from "next";
import { LightningApp } from "@/components/lightning-app";
import { data } from "@/lib/data";

export const metadata: Metadata = {
  title: "Lightning Round",
  description:
    "A 60-second timed quiz over your due and trickiest Mandarin words, with a combo multiplier and a personal best to beat. Runs entirely on your device, no account required.",
  alternates: { canonical: "/lightning" },
};

export default function LightningPage() {
  return <LightningApp data={data} />;
}
