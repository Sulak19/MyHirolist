import { test } from "node:test";
import assert from "node:assert/strict";

import { rolloverWeeks, mondayOf, EMPTY_WEEK } from "./weeks.js";

// All dates built locally so the weekday is unambiguous in any timezone.
const WED_24_AUG = new Date(2026, 7, 26, 12); // Wednesday; its Monday is 24 Aug
const THIS_MONDAY = "2026-08-24";
const LAST_MONDAY = "2026-08-17";
const TWO_MONDAYS_AGO = "2026-08-10";

const week = (monday, tuesday) => ({ ...EMPTY_WEEK, Monday: monday ?? null, Tuesday: tuesday ?? null });

test("mondayOf finds the Monday of the current week, Sunday included", () => {
  assert.equal(mondayOf(WED_24_AUG), THIS_MONDAY);
  assert.equal(mondayOf(new Date(2026, 7, 30, 12)), THIS_MONDAY); // Sunday 30th
  assert.equal(mondayOf(new Date(2026, 7, 31, 12)), "2026-08-31"); // Monday 31st
});

test("legacy data with no stamp is stamped as current and otherwise untouched", () => {
  const data = { weekPlan: week("m1"), other: "kept" };
  const out = rolloverWeeks(data, WED_24_AUG);

  assert.equal(out.planWeekOf, THIS_MONDAY);
  assert.deepEqual(out.weekPlan, week("m1"), "the existing plan must not roll on first sight");
  assert.equal(out.other, "kept");
});

test("data already stamped for this week is returned by identity", () => {
  const data = { weekPlan: week("m1"), nextWeekPlan: week("m2"), planWeekOf: THIS_MONDAY };
  assert.equal(rolloverWeeks(data, WED_24_AUG), data);
});

test("one week on, next week becomes this week and next week empties", () => {
  const data = { weekPlan: week("old"), nextWeekPlan: week("m2", "m3"), planWeekOf: LAST_MONDAY };
  const out = rolloverWeeks(data, WED_24_AUG);

  assert.deepEqual(out.weekPlan, week("m2", "m3"));
  assert.deepEqual(out.nextWeekPlan, EMPTY_WEEK);
  assert.equal(out.planWeekOf, THIS_MONDAY);
});

test("two or more weeks on, both weeks reset - the old next week is stale too", () => {
  const data = { weekPlan: week("old"), nextWeekPlan: week("stale"), planWeekOf: TWO_MONDAYS_AGO };
  const out = rolloverWeeks(data, WED_24_AUG);

  assert.deepEqual(out.weekPlan, EMPTY_WEEK);
  assert.deepEqual(out.nextWeekPlan, EMPTY_WEEK);
  assert.equal(out.planWeekOf, THIS_MONDAY);
});

test("a missing nextWeekPlan rolls into an empty week rather than undefined", () => {
  const data = { weekPlan: week("old"), planWeekOf: LAST_MONDAY };
  const out = rolloverWeeks(data, WED_24_AUG);
  assert.deepEqual(out.weekPlan, EMPTY_WEEK);
});

test("running it twice is a no-op the second time", () => {
  const data = { weekPlan: week("old"), nextWeekPlan: week("m2"), planWeekOf: LAST_MONDAY };
  const once = rolloverWeeks(data, WED_24_AUG);
  const twice = rolloverWeeks(once, WED_24_AUG);
  assert.equal(twice, once);
});

test("the input is never mutated", () => {
  const data = { weekPlan: week("old"), nextWeekPlan: week("m2"), planWeekOf: LAST_MONDAY };
  const frozen = JSON.stringify(data);
  rolloverWeeks(data, WED_24_AUG);
  assert.equal(JSON.stringify(data), frozen);
});

test("garbage in does not throw", () => {
  for (const bad of [null, undefined, "x", 42]) {
    assert.equal(rolloverWeeks(bad, WED_24_AUG), bad);
  }
});

test("the outgoing week is archived into meal history with real dates", () => {
  const data = {
    weekPlan: { ...EMPTY_WEEK, Monday: "karaage", Wednesday: "adobo" },
    nextWeekPlan: EMPTY_WEEK,
    planWeekOf: LAST_MONDAY,
  };
  const out = rolloverWeeks(data, WED_24_AUG);

  assert.deepEqual(out.mealHistory, [
    { date: "2026-08-17", mealId: "karaage" },
    { date: "2026-08-19", mealId: "adobo" },
  ]);
});

test("batch portions are not archived as meals cooked", () => {
  const data = {
    weekPlan: { ...EMPTY_WEEK, Monday: "batch:b1", Tuesday: "karaage" },
    planWeekOf: LAST_MONDAY,
  };
  const out = rolloverWeeks(data, WED_24_AUG);
  assert.deepEqual(out.mealHistory.map((h) => h.mealId), ["karaage"]);
});

test("existing history is kept, not replaced", () => {
  const data = {
    weekPlan: { ...EMPTY_WEEK, Monday: "adobo" },
    planWeekOf: LAST_MONDAY,
    mealHistory: [{ date: "2026-07-01", mealId: "hamburg" }],
  };
  const out = rolloverWeeks(data, WED_24_AUG);
  assert.deepEqual(out.mealHistory.map((h) => h.mealId), ["hamburg", "adobo"]);
});
