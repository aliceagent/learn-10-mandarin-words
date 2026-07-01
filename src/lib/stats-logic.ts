// App-facing entry point for the /stats dashboard. The pure derivation lives in
// progress-logic.ts (next to computeStreak) so it can be unit-tested without
// React or localStorage; this thin module just re-exports it under a
// stats-focused name, mirroring the data.ts / data-logic.ts split.
export { computeStats } from "./progress-logic";
export type { ProgressStats } from "./progress-logic";
