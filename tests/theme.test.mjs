import test from "node:test";
import assert from "node:assert/strict";

import {
  THEME_STORAGE_KEY,
  THEME_COLOR,
  THEME_INIT_SCRIPT,
  normalizeThemeSetting,
  serializeThemeSetting,
} from "../src/lib/theme.ts";

test("normalizeThemeSetting: only exact 'light' yields light", () => {
  assert.equal(normalizeThemeSetting("light"), "light");
});

test("normalizeThemeSetting: everything else defaults to dark", () => {
  // Garbage-tolerant default, mirroring the tone-colors setting's strictness.
  for (const value of ["dark", null, undefined, "on", "Light", "LIGHT", "", 42, {}, [], true]) {
    assert.equal(normalizeThemeSetting(value), "dark");
  }
});

test("serialize/normalize round-trips for both themes", () => {
  for (const theme of ["dark", "light"]) {
    assert.equal(normalizeThemeSetting(serializeThemeSetting(theme)), theme);
  }
});

test("THEME_COLOR has exactly dark/light keys, both #rrggbb", () => {
  assert.deepEqual(Object.keys(THEME_COLOR).sort(), ["dark", "light"]);
  for (const value of Object.values(THEME_COLOR)) {
    assert.match(value, /^#[0-9a-f]{6}$/);
  }
});

test("THEME_INIT_SCRIPT references the storage key (guards against drift)", () => {
  assert.ok(THEME_INIT_SCRIPT.includes(THEME_STORAGE_KEY));
});

// Execute the real pre-paint script body against stubbed globals to prove it
// behaves exactly as the store and CSS contract expect.
function runInitScript({ stored, throwOnGet = false }) {
  const dataset = {};
  const localStorage = {
    getItem(key) {
      if (throwOnGet) throw new Error("storage disabled");
      return key === THEME_STORAGE_KEY ? stored : null;
    },
  };
  const document = { documentElement: { dataset } };
  // `new Function` gives the script its own scope with our stubs as params.
  const fn = new Function("localStorage", "document", THEME_INIT_SCRIPT);
  fn(localStorage, document);
  return dataset;
}

test("THEME_INIT_SCRIPT: stored 'light' sets dataset.theme = 'light'", () => {
  assert.equal(runInitScript({ stored: "light" }).theme, "light");
});

test("THEME_INIT_SCRIPT: stored 'dark' leaves dataset untouched", () => {
  assert.equal(runInitScript({ stored: "dark" }).theme, undefined);
});

test("THEME_INIT_SCRIPT: nothing stored leaves dataset untouched", () => {
  assert.equal(runInitScript({ stored: null }).theme, undefined);
});

test("THEME_INIT_SCRIPT: throwing localStorage does not crash (try/catch holds)", () => {
  assert.doesNotThrow(() => runInitScript({ stored: "light", throwOnGet: true }));
  assert.equal(runInitScript({ stored: "light", throwOnGet: true }).theme, undefined);
});
