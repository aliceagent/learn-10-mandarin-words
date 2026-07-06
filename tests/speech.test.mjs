import test from "node:test";
import assert from "node:assert/strict";

import {
  canAttemptSpeech,
  classifyAudioAvailability,
  classifySupport,
  hasOnlyNetworkChineseVoices,
  isChineseVoice,
  listeningHint,
  normalizeLang,
  pickChineseVoice,
  rankChineseVoice,
  speechRateFor,
  SLOW_SPEECH_RATE,
  SPEECH_RATE,
} from "../src/lib/speech.ts";

// Minimal voice fixtures — only the fields the helpers read.
const v = (lang, extra = {}) => ({ lang, name: lang, ...extra });

test("normalizeLang lowercases and turns underscores into hyphens", () => {
  assert.equal(normalizeLang("zh_CN"), "zh-cn");
  assert.equal(normalizeLang("ZH-Hans-CN"), "zh-hans-cn");
  assert.equal(normalizeLang("en-US"), "en-us");
});

test("isChineseVoice: true for zh/cmn, false for English/Cantonese/Japanese", () => {
  assert.equal(isChineseVoice(v("zh-CN")), true);
  assert.equal(isChineseVoice(v("zh_TW")), true);
  assert.equal(isChineseVoice(v("zh-Hans-CN")), true);
  assert.equal(isChineseVoice(v("cmn-Hans-CN")), true);
  assert.equal(isChineseVoice(v("en-US")), false);
  assert.equal(isChineseVoice(v("yue-HK")), false); // Cantonese excluded
  assert.equal(isChineseVoice(v("ja-JP")), false);
});

test("rankChineseVoice orders zh-cn > zh-hans > cmn > generic zh > zh-tw > zh-hk", () => {
  const ranked = (lang) => rankChineseVoice(v(lang));
  assert.ok(ranked("zh-CN") < ranked("zh-Hans-XX"));
  assert.ok(ranked("zh-Hans-XX") < ranked("cmn"));
  assert.ok(ranked("cmn") < ranked("zh")); // generic zh
  assert.ok(ranked("zh") < ranked("zh-TW"));
  assert.ok(ranked("zh-TW") < ranked("zh-HK"));
  assert.equal(rankChineseVoice(v("en-US")), Infinity);
});

test("rankChineseVoice: localService breaks a same-base tie", () => {
  const local = rankChineseVoice(v("zh-CN", { localService: true }));
  const network = rankChineseVoice(v("zh-CN", { localService: false }));
  assert.ok(local < network);
  // But a better base rank still beats a local worse-base voice.
  assert.ok(rankChineseVoice(v("zh-CN", { localService: false })) < rankChineseVoice(v("zh-TW", { localService: true })));
});

test("pickChineseVoice prefers zh-CN over zh-TW", () => {
  const picked = pickChineseVoice([v("zh-TW"), v("zh-CN"), v("en-US")]);
  assert.equal(picked.lang, "zh-CN");
});

test("pickChineseVoice prefers zh-Hans over generic zh", () => {
  const picked = pickChineseVoice([v("zh"), v("zh-Hans-CN")]);
  assert.equal(picked.lang, "zh-Hans-CN");
});

test("pickChineseVoice: localService wins a same-rank tie", () => {
  const network = v("zh-CN", { localService: false, name: "network" });
  const local = v("zh-CN", { localService: true, name: "local" });
  assert.equal(pickChineseVoice([network, local]).name, "local");
});

test("pickChineseVoice returns null for all-English list and for empty list", () => {
  assert.equal(pickChineseVoice([v("en-US"), v("fr-FR")]), null);
  assert.equal(pickChineseVoice([]), null);
});

test("classifySupport covers every branch", () => {
  assert.equal(classifySupport(false, [], false), "unsupported");
  assert.equal(classifySupport(false, [v("zh-CN")], true), "unsupported");
  assert.equal(classifySupport(true, [v("zh-CN")], false), "ready");
  assert.equal(classifySupport(true, [v("en-US")], true), "no-chinese-voice");
  assert.equal(classifySupport(true, [], false), "loading");
  assert.equal(classifySupport(true, [], true), "ready"); // optimistic empty-list rule
});

test("SLOW_SPEECH_RATE is slower than normal but above the ~0.5 glitch floor", () => {
  assert.ok(SLOW_SPEECH_RATE < SPEECH_RATE);
  assert.ok(SLOW_SPEECH_RATE > 0.5 && SLOW_SPEECH_RATE < 1);
});

test("speechRateFor maps pace to the matching rate", () => {
  assert.equal(speechRateFor("normal"), SPEECH_RATE);
  assert.equal(speechRateFor("slow"), SLOW_SPEECH_RATE);
});

test("canAttemptSpeech: true for ready/loading, false otherwise", () => {
  assert.equal(canAttemptSpeech("ready"), true);
  assert.equal(canAttemptSpeech("loading"), true);
  assert.equal(canAttemptSpeech("unsupported"), false);
  assert.equal(canAttemptSpeech("no-chinese-voice"), false);
});

test("hasOnlyNetworkChineseVoices: only when zh voices exist and all are explicitly network", () => {
  // No Chinese voice at all → false (nothing to be offline about).
  assert.equal(hasOnlyNetworkChineseVoices([]), false);
  assert.equal(hasOnlyNetworkChineseVoices([v("en-US", { localService: false })]), false);
  // A local zh voice present → false (listening still works offline).
  assert.equal(
    hasOnlyNetworkChineseVoices([v("zh-CN", { localService: false }), v("zh-TW", { localService: true })]),
    false,
  );
  // Every zh voice explicitly network-backed → true. A LOCAL en-US must not rescue it.
  assert.equal(
    hasOnlyNetworkChineseVoices([v("en-US", { localService: true }), v("zh-CN", { localService: false })]),
    true,
  );
  // Undefined localService on a zh voice is unknown, not network-only → stay optimistic (false).
  assert.equal(hasOnlyNetworkChineseVoices([v("zh-CN")]), false);
  assert.equal(
    hasOnlyNetworkChineseVoices([v("zh-CN", { localService: false }), v("zh-Hans-CN")]),
    false,
  );
});

test("classifyAudioAvailability: permanent no-voice cases are always unavailable", () => {
  for (const online of [true, false]) {
    for (const networkOnly of [true, false]) {
      assert.equal(classifyAudioAvailability("unsupported", networkOnly, online), "unavailable");
      assert.equal(classifyAudioAvailability("no-chinese-voice", networkOnly, online), "unavailable");
    }
  }
});

test("classifyAudioAvailability: offline-voices only when offline AND all-network", () => {
  assert.equal(classifyAudioAvailability("ready", true, true), "ready"); // online: fine
  assert.equal(classifyAudioAvailability("ready", true, false), "offline-voices"); // offline + network-only
  assert.equal(classifyAudioAvailability("ready", false, false), "ready"); // offline + a local voice
  // Loading stays optimistic even offline with an empty voice list (Android-Chrome lie).
  assert.equal(classifyAudioAvailability("loading", false, false), "ready");
});

test("listeningHint: offline copy, no-voice copy, generic fallback", () => {
  assert.match(listeningHint("ready", "offline-voices"), /offline/i);
  assert.equal(
    listeningHint("no-chinese-voice", "unavailable"),
    "Your device has no Chinese voice installed, so listening mode may be silent.",
  );
  assert.equal(
    listeningHint("ready", "ready"),
    "No sound? Your device may lack a Chinese voice.",
  );
});
