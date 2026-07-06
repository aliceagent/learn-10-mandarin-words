import test from "node:test";
import assert from "node:assert/strict";

import {
  SKIP_WAITING_MESSAGE,
  activateWaitingWorker,
  watchForWaitingWorker,
} from "../src/lib/sw-update.ts";

// ── Fake event-emitter worker / registration / container ─────────────────────
// Tiny stand-ins in the style of tests/offline.test.mjs so the page-context
// update helpers can be exercised without a real service worker.

function makeWorker(state = "installing") {
  const listeners = new Map(); // type -> Set(fn)
  return {
    state,
    posted: [],
    postMessage(data) {
      this.posted.push(data);
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    // test helper: fire an event
    emit(type) {
      for (const fn of listeners.get(type) ?? []) fn();
    },
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

function makeRegistration({ waiting = null, installing = null, active = null } = {}) {
  const listeners = new Map();
  return {
    waiting,
    installing,
    active,
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    emit(type) {
      for (const fn of listeners.get(type) ?? []) fn();
    },
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

function makeContainer() {
  const listeners = new Map();
  return {
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    emit(type) {
      for (const fn of listeners.get(type) ?? []) fn();
    },
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

// ── watchForWaitingWorker ────────────────────────────────────────────────────

test("fires immediately when a worker is already waiting on load", () => {
  const waiting = makeWorker("installed");
  const reg = makeRegistration({ waiting });
  const seen = [];
  watchForWaitingWorker(reg, (w) => seen.push(w));
  assert.deepEqual(seen, [waiting]);
});

test("fires after updatefound → installed with an existing active worker", () => {
  const active = makeWorker("activated");
  const installing = makeWorker("installing");
  const reg = makeRegistration({ active, installing });
  const seen = [];
  watchForWaitingWorker(reg, (w) => seen.push(w));

  assert.deepEqual(seen, [], "nothing yet — still installing");
  reg.emit("updatefound");
  installing.state = "installed";
  installing.emit("statechange");
  assert.deepEqual(seen, [installing]);
});

test("does NOT fire on first install (no prior active worker)", () => {
  const installing = makeWorker("installing");
  const reg = makeRegistration({ active: null, installing });
  const seen = [];
  watchForWaitingWorker(reg, (w) => seen.push(w));

  reg.emit("updatefound");
  installing.state = "installed";
  installing.emit("statechange");
  assert.deepEqual(seen, [], "a first install must never notify");
});

test("unsubscribe removes the updatefound and pending statechange listeners", () => {
  const active = makeWorker("activated");
  const installing = makeWorker("installing");
  const reg = makeRegistration({ active, installing });
  const seen = [];
  const unwatch = watchForWaitingWorker(reg, (w) => seen.push(w));

  reg.emit("updatefound"); // attaches a statechange listener on `installing`
  assert.equal(reg.listenerCount("updatefound"), 1);
  assert.equal(installing.listenerCount("statechange"), 1);

  unwatch();
  assert.equal(reg.listenerCount("updatefound"), 0);
  assert.equal(installing.listenerCount("statechange"), 0);

  // No callback fires after cleanup.
  installing.state = "installed";
  installing.emit("statechange");
  reg.emit("updatefound");
  assert.deepEqual(seen, []);
});

// ── activateWaitingWorker ────────────────────────────────────────────────────

test("posts SKIP_WAITING_MESSAGE to the waiting worker", () => {
  const worker = makeWorker("installed");
  const container = makeContainer();
  activateWaitingWorker(worker, container, () => {});
  assert.deepEqual(worker.posted, [SKIP_WAITING_MESSAGE]);
  assert.deepEqual(SKIP_WAITING_MESSAGE, { type: "SKIP_WAITING" });
});

test("reloads exactly once even if controllerchange fires twice, then detaches", () => {
  const worker = makeWorker("installed");
  const container = makeContainer();
  let reloads = 0;
  activateWaitingWorker(worker, container, () => reloads++);

  container.emit("controllerchange");
  container.emit("controllerchange");
  assert.equal(reloads, 1, "reload must be fire-once");
  assert.equal(container.listenerCount("controllerchange"), 0, "listener must be removed");
});

test("does not reload before controllerchange fires", () => {
  const worker = makeWorker("installed");
  const container = makeContainer();
  let reloads = 0;
  activateWaitingWorker(worker, container, () => reloads++);
  assert.equal(reloads, 0);
});
