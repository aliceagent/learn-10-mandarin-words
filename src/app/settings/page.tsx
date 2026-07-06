import type { Metadata } from "next";
import { SettingsApp } from "@/components/settings-app";

export const metadata: Metadata = {
  title: "Settings",
  description:
    "Adjust your Learn 10 Mandarin Words preferences — tone colors, theme, audio, daily goal, and progress export/import. Everything is saved on your device, no account required.",
  alternates: { canonical: "/settings" },
};

export default function SettingsPage() {
  return <SettingsApp />;
}
