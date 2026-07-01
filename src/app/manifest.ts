import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest. Static (no request-time APIs) so it is cached.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Learn 10 Mandarin Words",
    short_name: "Learn 10",
    description:
      "Learn Mandarin vocabulary ten words at a time with video lessons, flashcards, quizzes, and spaced-repetition review. Works offline, stores progress locally.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#020617",
    theme_color: "#020617",
    categories: ["education", "productivity"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
