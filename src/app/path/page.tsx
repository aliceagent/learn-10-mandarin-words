import type { Metadata } from "next";
import { PathApp } from "@/components/path-app";
import { pathSections } from "@/lib/data";

export const metadata: Metadata = {
  title: "Learning Path",
  description:
    "Follow a guided, recommended order through every Mandarin topic — from starter essentials to useful phrases — with local progress tracking and no account required.",
  alternates: { canonical: "/path" },
};

export default function PathPage() {
  return <PathApp sections={pathSections()} />;
}
