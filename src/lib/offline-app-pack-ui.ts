import type { OfflineAppPackStatus } from "./offline-app-pack.ts";

export type OfflineAppPackTone = "amber" | "sky" | "emerald";

export type OfflineAppPackCopy = {
  tone: OfflineAppPackTone;
  title: string;
  status: string;
  body: string;
};

export type OfflineAppPackProgress = { done: number; total: number; current: string };

export function offlineAppPackCopy(
  state: OfflineAppPackStatus["state"],
  status: Pick<OfflineAppPackStatus, "cached" | "total" | "missing">,
): OfflineAppPackCopy {
  if (state === "ready") {
    return {
      tone: "emerald",
      title: "Ready for offline study",
      status: `${status.cached} app pages ready offline`,
      body: "The app shell and study screens are cached on this device. Saved videos are managed separately below.",
    };
  }

  if (state === "partial") {
    const missing = status.missing.length;
    return {
      tone: "sky",
      title: "Partially ready offline",
      status: `${status.cached} of ${status.total} app pages cached`,
      body: `${missing} item${missing === 1 ? "" : "s"} still ${missing === 1 ? "needs" : "need"} to download before this is fully flight-ready. Try Prepare app for offline again while connected.`,
    };
  }

  return {
    tone: "amber",
    title: "Prepare app for offline",
    status: "Not ready for airplane mode yet",
    body: "Download the app pages, vocabulary, flashcards, quizzes, review, and saved-list screens. Videos are separate — save those from lessons or categories.",
  };
}

export function offlineAppPackButtonLabel(state: OfflineAppPackStatus["state"], preparing: boolean): string {
  if (preparing) return "Preparing…";
  if (state === "ready") return "Refresh offline app pack";
  if (state === "partial") return "Finish offline setup";
  return "Prepare app for offline";
}

export function offlineAppPackProgressLabel(progress: OfflineAppPackProgress | null): string | null {
  if (!progress) return null;
  return `Caching ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`;
}
