import { test } from "node:test";
import assert from "node:assert/strict";
import { clearPrepItems, visiblePrepItems } from "./prepCompletion.js";
import { prepTasks, reconcilePrep, addSelectedMealsToPrep } from "./planner.js";
import { rolloverWeeks } from "./weeks.js";
import { shouldShowMealPrepToday } from "./today.js";

const meals = [{ id: "meal", name: "Dinner", ingredients: ["onion"] }];
const tasks = prepTasks({ Monday: "meal" }, {}, meals, []);
const completed = reconcilePrep([], tasks).map((task) => ({ ...task, id: "prep", checked: true }));

test("clear completed retains a hidden completion through reload and reconciliation", () => {
  const cleared = clearPrepItems(completed);
  const reloaded = JSON.parse(JSON.stringify(cleared));
  const rebuilt = reconcilePrep(reloaded, tasks);
  assert.equal(rebuilt.length, 1);
  assert.equal(rebuilt[0].checked, true);
  assert.deepEqual(visiblePrepItems(rebuilt), []);
  assert.equal(shouldShowMealPrepToday(rebuilt, new Date(2026, 8, 11, 12)), false);
});

test("deleting an individual completed generated row also remembers it", () => {
  const cleared = clearPrepItems(completed, (task) => task.id === "prep");
  assert.deepEqual(visiblePrepItems(reconcilePrep(cleared, tasks)), []);
});

test("manual completed prep is deleted and unfinished prep remains", () => {
  const open = { id: "open", checked: false };
  assert.deepEqual(clearPrepItems([{ id: "manual", checked: true }, open]), [open]);
});

test("re-adding selected meals and removing then restoring a plan preserve cleared completion", () => {
  const cleared = clearPrepItems(completed);
  assert.deepEqual(visiblePrepItems(addSelectedMealsToPrep(cleared, meals).items), []);
  assert.deepEqual(visiblePrepItems(reconcilePrep(reconcilePrep(cleared, []), tasks)), []);
});

test("Thursday rollover resets generated completion but retains manual prep", () => {
  const manual = { id: "manual", checked: true };
  const data = {
    planWeekOf: "2026-09-07", weekPlan: { Monday: "meal" },
    nextWeekPlan: { Monday: "meal" }, weekendPrep: [...clearPrepItems(completed), manual],
  };
  assert.equal(rolloverWeeks(data, new Date(2026, 8, 10, 18, 59)), data);
  const rolled = rolloverWeeks(data, new Date(2026, 8, 10, 19));
  assert.deepEqual(rolled.weekendPrep, [manual]);
  const rebuilt = reconcilePrep(rolled.weekendPrep, tasks);
  assert.equal(rebuilt.find((task) => task.source === "plan").checked, false);
});

test("stock completion resets after replenishment so a new low cycle can create prep", () => {
  const stockTasks = prepTasks({}, {}, [], [], [{ name: "Bread", lowStock: true }]);
  const done = reconcilePrep([], stockTasks).map((task) => ({ ...task, checked: true }));
  assert.deepEqual(reconcilePrep(clearPrepItems(done), []), []);
  assert.equal(reconcilePrep([], stockTasks)[0].checked, false);
});
