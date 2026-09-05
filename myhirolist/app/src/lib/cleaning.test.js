import { test } from "node:test";
import assert from "node:assert/strict";

import { cleaningTaskStatus, nextWeeklyFriday, sortCleaningTasks } from "./cleaning.js";

const localDate = (year, month, day, hour = 12) => new Date(year, month - 1, day, hour);
const localIso = (year, month, day, hour = 12) => localDate(year, month, day, hour).toISOString();
const localKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const NOW = localDate(2026, 8, 29);

test("cleaning tasks are ordered overdue first and by due date", () => {
  const tasks = [
    { id: "later", name: "Later", freq: "Weekly", lastDone: localIso(2026, 8, 25) },
    { id: "due-yesterday", name: "Due yesterday", freq: "Weekly", lastDone: localIso(2026, 8, 21) },
    { id: "due-earlier", name: "Due earlier", freq: "Weekly", lastDone: localIso(2026, 8, 19) },
  ];

  assert.deepEqual(sortCleaningTasks(tasks, NOW).map((task) => task.id), ["due-earlier", "due-yesterday", "later"]);
});

test("completed tasks move below unfinished as-needed tasks", () => {
  const tasks = [
    { id: "completed", name: "Completed", freq: "Weekly", lastDone: localIso(2026, 8, 28) },
    { id: "as-needed", name: "As needed", freq: "As needed", lastDone: null },
    { id: "never", name: "Never done", freq: "Weekly", lastDone: null },
  ];

  assert.deepEqual(sortCleaningTasks(tasks, NOW).map((task) => task.id), ["never", "as-needed", "completed"]);
});

test("sorting does not mutate the saved cleaning list", () => {
  const tasks = [
    { id: "b", name: "B", freq: "As needed", lastDone: null },
    { id: "a", name: "A", freq: "As needed", lastDone: null },
  ];
  const before = JSON.stringify(tasks);
  sortCleaningTasks(tasks, NOW);
  assert.equal(JSON.stringify(tasks), before);
});

test("overdue recurring tasks receive the overdue state", () => {
  const friday = localDate(2026, 8, 28);
  const overdue = cleaningTaskStatus(
    { name: "Bathroom", freq: "Weekly", lastDone: localIso(2026, 8, 20) },
    friday
  );
  const dueToday = cleaningTaskStatus(
    { name: "Sheets", freq: "Weekly", lastDone: localIso(2026, 8, 22) },
    friday
  );

  assert.equal(overdue.overdue, true);
  assert.equal(overdue.overdueBy, 7);
  assert.equal(dueToday.due, true);
  assert.equal(dueToday.overdue, false, "due today remains amber rather than red");
});

test("weekly cleaning always becomes due on Friday", () => {
  assert.equal(localKey(nextWeeklyFriday(localIso(2026, 8, 23))), "2026-08-28");
  assert.equal(localKey(nextWeeklyFriday(localIso(2026, 8, 28))), "2026-09-04");

  const task = { name: "Toilet", freq: "Weekly", lastDone: localIso(2026, 8, 23) };
  assert.equal(cleaningTaskStatus(task, localDate(2026, 8, 27)).due, false);
  assert.equal(cleaningTaskStatus(task, localDate(2026, 8, 28, 0)).due, true);
});

test("every newly added recurring task starts due with the red overdue state", () => {
  for (const freq of ["Daily", "Twice weekly", "Weekly", "Fortnightly", "Monthly"]) {
    const status = cleaningTaskStatus({ name: "New task", freq, lastDone: null }, NOW);
    assert.equal(status.overdue, true, `${freq} task should receive the red state`);
    assert.equal(status.neverDone, true);
  }
  assert.equal(cleaningTaskStatus({ name: "Flexible", freq: "As needed", lastDone: null }, NOW).overdue, false);
});
