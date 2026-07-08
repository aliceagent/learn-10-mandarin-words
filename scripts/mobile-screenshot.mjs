#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

function arg(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const url = arg("url", "https://learn-10-mandarin-words.vercel.app");
const out = resolve(arg("out", "mobile-audit.png"));
const width = Number(arg("width", "390"));
const height = Number(arg("height", "844"));
const timeout = Number(arg("timeout", "45000"));

mkdirSync(dirname(out), { recursive: true });

const candidates = ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"];
let bin = null;
for (const candidate of candidates) {
  const check = spawnSync("bash", ["-lc", `command -v ${candidate}`], { encoding: "utf8" });
  if (check.status === 0 && check.stdout.trim()) {
    bin = check.stdout.trim().split("\n")[0];
    break;
  }
}

if (!bin) {
  console.error("No Chromium/Chrome binary found");
  process.exit(1);
}

const result = spawnSync(
  bin,
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--hide-scrollbars=false",
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=5000",
    `--window-size=${width},${height}`,
    `--screenshot=${out}`,
    url,
  ],
  { encoding: "utf8", timeout },
);

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout || "Chromium screenshot failed\n");
  process.exit(result.status ?? 1);
}

console.log(out);
