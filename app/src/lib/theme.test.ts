import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { themeInit } from "../components/theme";

function initialize(stored: string | null, darkDevice = false, blocked = false) {
  const root = { dataset: {} as { theme?: string }, style: {} as { colorScheme?: string } };
  runInNewContext(themeInit, {
    localStorage: { getItem: () => { if (blocked) throw new Error("Storage unavailable"); return stored; } },
    document: { documentElement: root },
    matchMedia: () => ({ matches: darkDevice }),
  });
  return root;
}
test("first paint defaults to light even on a dark device; invalid or blocked storage is safe", () => {
  for (const stored of [null, "invalid"]) assert.equal(initialize(stored, true).dataset.theme, "light");
  assert.equal(initialize("dark", true, true).style.colorScheme, "light");
});
test("explicit preferences apply before rendering regardless of system appearance", () => {
  assert.equal(initialize("dark", false).dataset.theme, "dark");
  assert.equal(initialize("light", true).dataset.theme, "light");
});
test("system preference resolves both light and dark device appearances", () => {
  assert.equal(initialize("system", false).dataset.theme, "light");
  assert.equal(initialize("system", true).dataset.theme, "dark");
});
