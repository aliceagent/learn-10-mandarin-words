"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";

// `beforeinstallprompt` is not in the standard DOM lib types.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaRegister() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Register the service worker (production only, and only if supported).
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Registration failure is non-fatal — the app works without offline support.
      });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, []);

  // Capture the install prompt so we can offer a custom, unobtrusive button.
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      track("install_prompt_shown");
    };
    const onInstalled = () => {
      setInstallEvent(null);
      track("install_accepted");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!installEvent || dismissed) return null;

  return (
    <div className="fixed inset-x-0 bottom-20 z-40 mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-white/10 bg-surface/95 px-4 py-3 shadow-2xl backdrop-blur md:bottom-6">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">Install this app</p>
        <p className="truncate text-xs text-slate-400">Add to your home screen for offline study.</p>
      </div>
      <button
        type="button"
        onClick={async () => {
          await installEvent.prompt();
          const choice = await installEvent.userChoice;
          if (choice.outcome === "accepted") track("install_accepted");
          setInstallEvent(null);
        }}
        className="inline-flex min-h-[44px] shrink-0 items-center rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cta"
      >
        Install
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss install prompt"
        className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full border border-white/10 px-2.5 py-2 text-sm text-slate-400 transition hover:text-white"
      >
        <span aria-hidden="true">✕</span>
      </button>
    </div>
  );
}
