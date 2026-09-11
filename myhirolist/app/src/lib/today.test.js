import { test } from "node:test";
import assert from "node:assert/strict";

import { completeOddJob, oddJobsDueToday, shouldShowMealPrepToday } from "./today.js";

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
