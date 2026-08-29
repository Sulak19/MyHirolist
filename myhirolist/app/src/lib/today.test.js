import { test } from "node:test";
import assert from "node:assert/strict";

import { shouldShowMealPrepToday } from "./today.js";

const atNoon = (year, month, day) => new Date(year, month - 1, day, 12);

test("meal prep appears on Friday, Saturday and Sunday when work remains", () => {
  const prep = [{ id: "prep", label: "Chop onions", checked: false }];

  assert.equal(shouldShowMealPrepToday(prep, atNoon(2026, 8, 28)), true); // Friday
  assert.equal(shouldShowMealPrepToday(prep, atNoon(2026, 8, 29)), true); // Saturday
  assert.equal(shouldShowMealPrepToday(prep, atNoon(2026, 8, 30)), true); // Sunday
});

test("meal prep stays off Today from Monday to Thursday", () => {
  const prep = [{ id: "prep", label: "Chop onions", checked: false }];
  for (const day of [24, 25, 26, 27]) {
    assert.equal(shouldShowMealPrepToday(prep, atNoon(2026, 8, day)), false);
  }
});

test("meal prep disappears when every task is completed", () => {
  const prep = [{ id: "prep", label: "Chop onions", checked: true }];
  assert.equal(shouldShowMealPrepToday(prep, atNoon(2026, 8, 29)), false);
  assert.equal(shouldShowMealPrepToday([], atNoon(2026, 8, 29)), false);
});
