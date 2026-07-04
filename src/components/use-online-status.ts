"use client";

import { useEffect, useState } from "react";

/** Tracks the browser's connectivity. Returns `true` during SSR and the first
 *  client render (so the markup matches and there's no hydration flash), then
 *  switches to the real `navigator.onLine` value and follows the `online`/
 *  `offline` events. */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update(); // sync to the real value once mounted
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
}
