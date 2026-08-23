import { test } from "node:test";
import assert from "node:assert/strict";

import { mergeWithDefaults } from "./merge.js";

test("stored values win over defaults", () => {
  const merged = mergeWithDefaults({ a: 1, b: 2 }, { b: 99 });
  assert.deepEqual(merged, { a: 1, b: 99 });
});

test("a field added inside a nested object reaches existing households", () => {
  // The case the old shallow merge got wrong: dogFood gains a new key in a
  // release, but the household already has a stored dogFood without it.
  const defaults = { dogFood: { dogs: [], extras: [], vetReminderDays: 30 } };
  const stored = { dogFood: { dogs: [{ name: "Rex" }], extras: [] } };

  const merged = mergeWithDefaults(defaults, stored);

  assert.equal(merged.dogFood.vetReminderDays, 30);
  assert.deepEqual(merged.dogFood.dogs, [{ name: "Rex" }]);
});

test("nesting is merged to any depth", () => {
  const merged = mergeWithDefaults(
    { a: { b: { c: 1, d: 2 } } },
    { a: { b: { c: 9 } } }
  );
  assert.deepEqual(merged.a.b, { c: 9, d: 2 });
});

test("arrays are replaced, never merged", () => {
  // Otherwise deleting a default meal or chore would bring it straight back.
  const merged = mergeWithDefaults(
    { meals: [{ name: "Karaage" }, { name: "Adobo" }] },
    { meals: [{ name: "Karaage" }] }
  );
  assert.deepEqual(merged.meals, [{ name: "Karaage" }]);
});

test("an emptied list stays empty", () => {
  const merged = mergeWithDefaults({ shopping: [{ name: "Milk" }] }, { shopping: [] });
  assert.deepEqual(merged.shopping, []);
});

test("null or missing stored data falls back to the defaults", () => {
  const defaults = { a: 1 };
  assert.equal(mergeWithDefaults(defaults, null), defaults);
  assert.equal(mergeWithDefaults(defaults, undefined), defaults);
});

test("an explicit null in stored data is respected, not overwritten", () => {
  // lastDone: null means "never done" and must survive the merge.
  const merged = mergeWithDefaults({ task: { lastDone: "2026-01-01" } }, { task: { lastDone: null } });
  assert.equal(merged.task.lastDone, null);
});

test("a stored scalar replaces a default object rather than throwing", () => {
  const merged = mergeWithDefaults({ a: { b: 1 } }, { a: "text" });
  assert.equal(merged.a, "text");
});

test("keys the defaults do not know about are kept", () => {
  // A field added by a newer version must not be dropped when an older
  // version loads the same data.
  const merged = mergeWithDefaults({ a: 1 }, { a: 1, experimental: true });
  assert.equal(merged.experimental, true);
});

test("the defaults object is not mutated", () => {
  const defaults = { nested: { a: 1 } };
  mergeWithDefaults(defaults, { nested: { a: 2 } });
  assert.equal(defaults.nested.a, 1);
});
