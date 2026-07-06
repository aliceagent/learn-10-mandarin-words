"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import {
  PLAYBACK_RATES,
  RATE_STORAGE_KEY,
  normalizeRate,
  rateLabel,
  type PlaybackRate,
} from "@/lib/video-controls";
import { describeSpeechSupport, validateProgressFile } from "@/lib/settings-logic";
import { useProgress } from "./use-progress";
import { useSpeech } from "./use-speech";
import { SpeakButton } from "./speak-button";
import { TonePinyin } from "./tone-pinyin";
import { ToneColorsToggle } from "./tone-colors-toggle";
import { ThemeToggle } from "./theme-toggle";
import { GoalEditor } from "./goal-editor";
import { Toast } from "./toast";

// The /settings page: one place for every device-local preference. Nothing here
// introduces a new store or key — each section reuses the exact hook/helper that
// already backs the preference where it is otherwise edited, so a change made on
// this page is the same change made anywhere else (shared useSyncExternalStore
// stores for tone colors + theme, the same localStorage keys for progress and
// video speed). Local-first: no account, no network.
export function SettingsApp() {
  const { progress, loaded, setDailyGoal } = useProgress();

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-8 md:px-10 md:pb-12">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">← Library</Link>
        <Link href="/stats" className="text-sm font-semibold text-slate-400 transition hover:text-emerald-300">Your stats</Link>
      </div>

      <div className="mt-8">
        <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">Settings</h1>
        <p className="mt-3 text-lg text-slate-300">
          Preferences are saved on this device — no account, no cloud.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-4">
        {/* ── Appearance ── */}
        <SettingsSection
          title="Appearance"
          description="Tune how words and the interface look. Both settings sync across every page."
        >
          <SettingRow
            title="Tone colors"
            detail="Color each pinyin syllable by its tone."
          >
            <ToneColorsToggle />
          </SettingRow>
          <SettingRow
            title="Theme"
            detail="Learn 10 is dark by default; switch to a lighter look any time."
          >
            <ThemeToggle showHelper />
          </SettingRow>
        </SettingsSection>

        {/* ── Audio ── */}
        <SettingsSection
          title="Audio"
          description="Mandarin pronunciations use your device's built-in voices."
        >
          <VoiceStatusRow />
          <SettingRow title="Test audio" detail="Play a sample pronunciation.">
            <div className="flex items-center gap-3">
              <span className="text-right">
                <span className="font-hanzi block text-xl text-white">你好</span>
                <span className="font-hanzi block text-sm text-emerald-300">
                  <TonePinyin pinyin="nǐ hǎo" />
                </span>
              </span>
              <SpeakButton text="你好" label="Test audio: 你好" />
            </div>
          </SettingRow>
          <PlaybackRateSetting />
        </SettingsSection>

        {/* ── Daily goal ── */}
        <SettingsSection
          title="Daily goal"
          description="Distinct words practiced per day. Your streak and home-page ring follow this."
        >
          <div className="min-h-[44px]">
            {loaded ? (
              <GoalEditor current={progress.onboarding.dailyGoal} onChange={setDailyGoal} />
            ) : (
              <p className="text-sm text-slate-500">Loading your goal…</p>
            )}
          </div>
        </SettingsSection>

        {/* ── Data ── */}
        <DataSection />
      </div>
    </main>
  );
}

// ── Section + row primitives ─────────────────────────────────────────────────
// Flat Level-1 card matching the home "Today's snapshot" card, with a header and
// a stack of rows. Rows put a label/detail on the left and the control on the
// right, wrapping on narrow screens.
function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-surface p-5 md:p-6">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
      <div className="mt-4 flex flex-col divide-y divide-white/5">{children}</div>
    </section>
  );
}

function SettingRow({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="font-semibold text-white">{title}</p>
        {detail ? <p className="mt-0.5 text-sm text-slate-400">{detail}</p> : null}
      </div>
      <div className="ml-auto">{children}</div>
    </div>
  );
}

// ── Audio: Mandarin voice status ─────────────────────────────────────────────
// Reads the same hardened useSpeech() status every SpeakButton uses, so this row
// reflects exactly what the pronunciation buttons can do. Hydration-safe: the
// hook starts "loading" and detects voices in a mount effect.
function VoiceStatusRow() {
  const { status } = useSpeech();
  const { label, detail, tone } = describeSpeechSupport(status);
  const dotClass =
    tone === "ok" ? "bg-emerald-400" : tone === "warn" ? "bg-amber-400" : "bg-slate-500";
  return (
    <SettingRow title="Mandarin voice" detail={detail}>
      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-sm font-semibold text-slate-200">
        <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} aria-hidden="true" />
        {label}
      </span>
    </SettingRow>
  );
}

// ── Audio: default lesson video speed ────────────────────────────────────────
// Persists to the SAME RATE_STORAGE_KEY the in-video pills use, so a default set
// here is the default a freshly opened video starts at. Hydration-safe (render
// the default on the server, read localStorage in a mount effect) and try/catch
// wrapped for private-mode browsers (mirrors use-tone-colors.ts).
function PlaybackRateSetting() {
  const [rate, setRate] = useState<PlaybackRate>(normalizeRate(undefined));

  useEffect(() => {
    let active = true;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(RATE_STORAGE_KEY);
    } catch {
      // Storage blocked — keep the in-memory default.
    }
    if (stored !== null) {
      // Deferred so the effect body never calls setState synchronously (avoids a
      // cascading render — same queueMicrotask idiom as use-speech.ts).
      const next = normalizeRate(stored);
      queueMicrotask(() => {
        if (active) setRate(next);
      });
    }
    return () => {
      active = false;
    };
  }, []);

  function choose(next: PlaybackRate) {
    setRate(next);
    try {
      window.localStorage.setItem(RATE_STORAGE_KEY, String(next));
    } catch {
      // Storage blocked — the in-memory value still drives this tab.
    }
  }

  return (
    <SettingRow
      title="Lesson video speed"
      detail="Default speed for lesson videos. You can still change it on any video."
    >
      <div className="flex flex-wrap gap-2" role="group" aria-label="Default lesson video speed">
        {PLAYBACK_RATES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => choose(option)}
            aria-pressed={rate === option}
            className={`min-h-[44px] rounded-2xl border px-3 py-2 text-sm font-semibold tabular-nums transition ${
              rate === option
                ? "border-emerald-300 bg-emerald-300/10 text-white"
                : "border-white/10 text-slate-300 hover:border-emerald-300/60"
            }`}
          >
            {rateLabel(option)}
          </button>
        ))}
      </div>
    </SettingRow>
  );
}

// ── Data: export / import ────────────────────────────────────────────────────
// Reuses exportProgress/importProgress from useProgress (unchanged JSON shape).
// Import is guarded by validateProgressFile so an unreadable file becomes an
// error toast instead of a thrown exception — replacing the old alert().
function DataSection() {
  const { exportProgress, importProgress } = useProgress();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<string | null>(null);

  function handleExport() {
    exportProgress();
    track("progress_exported");
    setToast("Progress downloaded");
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = validateProgressFile(String(ev.target?.result ?? ""));
      if (!result.ok) {
        setToast("Could not import: that file isn't a valid progress export.");
        return;
      }
      // Validated above, so importProgress can't throw here.
      importProgress(String(ev.target?.result ?? ""));
      track("progress_imported");
      setToast("Progress imported ✓");
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-surface p-5 md:p-6">
      <h2 className="text-xl font-semibold text-white">Data</h2>
      <p className="mt-1 text-sm text-slate-400">
        Your progress lives on this device. Back it up or move it to another device.
      </p>
      <div className="mt-4 flex flex-col divide-y divide-white/5">
        <SettingRow
          title="Export progress"
          detail="Download everything as a JSON file — a good backup before switching devices."
        >
          <button
            type="button"
            onClick={handleExport}
            className="min-h-[44px] rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-300 hover:text-white"
          >
            Export
          </button>
        </SettingRow>
        <SettingRow
          title="Import progress"
          detail="Replaces the progress on this device with the file's contents."
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[44px] rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-300 hover:text-white"
          >
            Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImport}
            className="sr-only"
            aria-hidden="true"
          />
        </SettingRow>
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Tone colors, theme, and video speed stay on this device and aren&apos;t included in the export. See our{" "}
        <Link href="/privacy" className="font-semibold text-emerald-300 transition hover:text-emerald-200">
          Privacy
        </Link>{" "}
        page.
      </p>
      <Toast message={toast} onDone={() => setToast(null)} />
    </section>
  );
}
