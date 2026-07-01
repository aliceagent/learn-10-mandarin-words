import type { Metadata } from "next";
import { FavoritesApp } from "@/components/favorites-app";
import { data } from "@/lib/data";

export const metadata: Metadata = {
  title: "Favorites | Learn 10 Mandarin Words",
  description: "Your saved Mandarin words and topic lists.",
};

export default function FavoritesPage() {
  return <FavoritesApp data={data} />;
}
