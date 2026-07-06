// Page-context helpers for the service-worker update flow (Sprint 26).
//
// These run in the browser (not the service worker). They detect when a new
// worker is waiting to take over and, on the learner's consent, hand control to
// it and reload the page exactly once. See public/sw.js for the worker side and
// src/components/pwa-register.tsx for the UI that wires these together.
//
// Design notes (mirroring src/lib/offline.ts):
//   - The registration/worker/container are accepted via minimal structural
//     types so the logic is unit-testable with fakes (see tests/sw-update.test.mjs)
//     without pulling in the full DOM lib surface.
//   - The controllerchange → reload listener is attached ONLY inside
//     activateWaitingWorker (a user-initiated action). activate's clients.claim()
//     fires controllerchange for every first-time visitor too; attaching the
//     listener globally would reload them in a loop. Keeping it local, plus a
//     fire-once flag, is the reload-loop guard.

/** Message the page posts to a waiting worker to make it take over. The string
 *  literal is mirrored in public/sw.js (which has no build step / no imports). */
export const SKIP_WAITING_MESSAGE = { type: "SKIP_WAITING" } as const;

export type WorkerLike = {
  state: string;
  postMessage(data: unknown): void;
  addEventListener(type: "statechange", fn: () => void): void;
  removeEventListener(type: "statechange", fn: () => void): void;
};

export type RegistrationLike = {
  waiting: WorkerLike | null;
  installing: WorkerLike | null;
  active: WorkerLike | null;
  addEventListener(type: "updatefound", fn: () => void): void;
  removeEventListener(type: "updatefound", fn: () => void): void;
};

export type ContainerLike = {
  addEventListener(type: "controllerchange", fn: () => void): void;
  removeEventListener(type: "controllerchange", fn: () => void): void;
};

/**
 * Invoke `onWaiting` for a worker that is ready to take over: either one that is
 * already `waiting` when the page loads (the update installed in a previous
 * session), or a NEW worker that finishes installing behind an existing active
 * one. A first install (no prior `active` worker) never notifies — there's
 * nothing to update from. Returns an unsubscribe that removes every listener.
 */
export function watchForWaitingWorker(
  reg: RegistrationLike,
  onWaiting: (worker: WorkerLike) => void,
): () => void {
  // Already waiting on load — the update installed while we weren't looking.
  if (reg.waiting) onWaiting(reg.waiting);

  let installing: WorkerLike | null = null;
  let onStateChange: (() => void) | null = null;

  const detachStateChange = () => {
    if (installing && onStateChange) installing.removeEventListener("statechange", onStateChange);
    installing = null;
    onStateChange = null;
  };

  const onUpdateFound = () => {
    const worker = reg.installing;
    if (!worker) return;
    // No existing active worker → this is a first install, not an update. Ignore.
    if (!reg.active) return;
    detachStateChange(); // in case a prior updatefound is still pending
    installing = worker;
    onStateChange = () => {
      if (worker.state === "installed") {
        detachStateChange();
        onWaiting(worker);
      }
    };
    worker.addEventListener("statechange", onStateChange);
  };

  reg.addEventListener("updatefound", onUpdateFound);

  return () => {
    reg.removeEventListener("updatefound", onUpdateFound);
    detachStateChange();
  };
}

/**
 * Tell the waiting worker to take over, then reload the page exactly once when it
 * does (`controllerchange`). The listener is attached HERE, not globally, so the
 * first-install `clients.claim()` can never trigger a reload for a fresh visitor.
 * A fire-once flag guards against browsers that emit `controllerchange` twice.
 */
export function activateWaitingWorker(
  worker: WorkerLike,
  container: ContainerLike,
  reload: () => void,
): void {
  let reloaded = false;
  const onControllerChange = () => {
    if (reloaded) return;
    reloaded = true;
    container.removeEventListener("controllerchange", onControllerChange);
    reload();
  };
  container.addEventListener("controllerchange", onControllerChange);
  worker.postMessage(SKIP_WAITING_MESSAGE);
}
