import type { Metadata } from "next";
import { DailyApp } from "@/components/daily-app";
import { data } from "@/lib/data";

export const metadata: Metadata = {
  title: "Daily Challenge",
  description:
    "One tap-worthy quiz a day: ten questions mixing three quiz modes, drawn from the topics you've studied and the same for everyone with the same topics. Computed on your device, no account required.",
  alternates: { canonical: "/daily" },
};

export default function DailyPage() {
  return <DailyApp data={data} />;
}
