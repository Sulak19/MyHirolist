import { test } from "node:test";
import assert from "node:assert/strict";

import { cleaningTaskStatus, sortCleaningTasks } from "./cleaning.js";

const NOW = new Date("2026-08-29T12:00:00+10:00");

test("cleaning tasks are ordered overdue first and by due date", () => {
  const tasks = [
    { id: "later", name: "Later", freq: "Weekly", lastDone: "2026-08-25T12:00:00+10:00" },
    { id: "due-yesterday", name: "Due yesterday", freq: "Weekly", lastDone: "2026-08-21T12:00:00+10:00" },
    { id: "due-earlier", name: "Due earlier", freq: "Weekly", lastDone: "2026-08-19T12:00:00+10:00" },
  ];

  assert.deepEqual(sortCleaningTasks(tasks, NOW).map((task) => task.id), ["due-earlier", "due-yesterday", "later"]);
});

test("completed tasks move below unfinished as-needed tasks", () => {
  const tasks = [
    { id: "completed", name: "Completed", freq: "Weekly", lastDone: "2026-08-28T12:00:00+10:00" },
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
  const overdue = cleaningTaskStatus(
    { name: "Bathroom", freq: "Weekly", lastDone: "2026-08-20T12:00:00+10:00" },
    NOW
  );
  const dueToday = cleaningTaskStatus(
    { name: "Sheets", freq: "Weekly", lastDone: "2026-08-22T12:00:00+10:00" },
    NOW
  );

  assert.equal(overdue.overdue, true);
  assert.equal(overdue.overdueBy, 2);
  assert.equal(dueToday.due, true);
  assert.equal(dueToday.overdue, false, "due today remains amber rather than red");
});

test("every newly added recurring task starts due with the red overdue state", () => {
  for (const freq of ["Daily", "Twice weekly", "Weekly", "Fortnightly", "Monthly"]) {
    const status = cleaningTaskStatus({ name: "New task", freq, lastDone: null }, NOW);
    assert.equal(status.overdue, true, `${freq} task should receive the red state`);
    assert.equal(status.neverDone, true);
  }
  assert.equal(cleaningTaskStatus({ name: "Flexible", freq: "As needed", lastDone: null }, NOW).overdue, false);
});
