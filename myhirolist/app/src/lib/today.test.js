import { test } from "node:test";
import assert from "node:assert/strict";

import { completeOddJob, daysUntilExpiry, inventoryUseUpToday, oddJobsDueToday, shouldShowMealPrepToday, sortKitchenItems } from "./today.js";

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

test("Today includes dated unfinished odd jobs that are due or overdue", () => {
  const jobs = [
    { id: "overdue", name: "Fix fence", dueDate: "2026-08-27", done: false },
    { id: "today", name: "Book service", dueDate: "2026-08-28", done: false },
    { id: "future", name: "Clean gutters", dueDate: "2026-08-29", done: false },
    { id: "done", name: "Change light", dueDate: "2026-08-28", done: true },
    { id: "undated", name: "Paint shelf", dueDate: null, done: false },
  ];

  assert.deepEqual(oddJobsDueToday(jobs, atNoon(2026, 8, 28)).map((job) => job.id), ["overdue", "today"]);
});

test("ticking an odd job on Today completes the underlying job", () => {
  const jobs = [
    { id: "target", name: "Fix fence", dueDate: "2026-08-28", done: false },
    { id: "other", name: "Book service", dueDate: "2026-08-28", done: false },
  ];
  const result = completeOddJob(jobs, "target");

  assert.equal(result[0].done, true);
  assert.equal(result[1], jobs[1]);
  assert.equal(jobs[0].done, false, "saved input is not mutated");
});

test("Today marks inventory expiring within seven days as Use up", () => {
  const items = [
    { id: "boundary", expiry: "2026-09-04" },
    { id: "overdue", expiry: "2026-08-27" },
    { id: "today", expiry: "2026-08-28" },
    { id: "later", expiry: "2026-09-05" },
    { id: "invalid", expiry: "2026-02-30" },
    { id: "undated", expiry: null },
  ];

  assert.deepEqual(
    inventoryUseUpToday(items, atNoon(2026, 8, 28)).map((item) => item.id),
    ["overdue", "today", "boundary"]
  );
});

test("expiry days use calendar dates and reject invalid dates", () => {
  assert.equal(daysUntilExpiry("2026-08-28", atNoon(2026, 8, 28)), 0);
  assert.equal(daysUntilExpiry("2026-09-04", atNoon(2026, 8, 28)), 7);
  assert.equal(daysUntilExpiry("2026-08-27", atNoon(2026, 8, 28)), -1);
  assert.equal(daysUntilExpiry("2026-02-30", atNoon(2026, 8, 28)), null);
});

test("Kitchen sections show use-up items, then staples, then the rest", () => {
  const items = [
    { id: "ordinary-one", staple: false },
    { id: "staple-one", staple: true },
    { id: "soon", staple: false, expiry: "2026-09-03" },
    { id: "overdue", staple: true, expiry: "2026-08-27" },
    { id: "staple-two", staple: true },
    { id: "ordinary-two", staple: null },
  ];

  assert.deepEqual(
    sortKitchenItems(items, atNoon(2026, 8, 28)).map((item) => item.id),
    ["overdue", "soon", "staple-one", "staple-two", "ordinary-one", "ordinary-two"]
  );
  assert.deepEqual(items.map((item) => item.id), ["ordinary-one", "staple-one", "soon", "overdue", "staple-two", "ordinary-two"]);
});
