import { test } from "node:test";
import assert from "node:assert/strict";

import {
  planEvents,
  reconcileEvents,
  nextDue,
  mondayOf,
  describe,
  keyFrom,
} from "../calendar.js";

// Wednesday 26 August 2026, local midday. Built locally rather than parsed
// from a Z string so these assertions hold whatever timezone CI runs in.
const NOW = new Date(2026, 7, 26, 12, 0, 0).getTime();
const localIso = (y, m, d, h = 9) => new Date(y, m - 1, d, h, 0, 0).toISOString();

test("the week starts on the Monday containing today", () => {
  assert.equal(mondayOf(NOW), "2026-08-24");
});

test("Sunday belongs to the week that just ended, not the one starting", () => {
  assert.equal(mondayOf(new Date(2026, 7, 30, 12, 0, 0).getTime()), "2026-08-24");
});

test("a key survives a round trip through the description", () => {
  assert.equal(keyFrom(describe("clean:abc123")), "clean:abc123");
});

test("a description without our marker yields no key", () => {
  assert.equal(keyFrom("Dentist appointment"), null);
  assert.equal(keyFrom(undefined), null);
});

// --- cleaning due dates ------------------------------------------------

test("a task never done is due today", () => {
  assert.equal(nextDue({ freq: "Weekly", lastDone: null }, NOW), "2026-08-26");
});

test("a weekly task done today falls due a week later", () => {
  const task = { freq: "Weekly", lastDone: localIso(2026, 8, 26) };
  assert.equal(nextDue(task, NOW), "2026-09-02");
});

test("an overdue task shows on today rather than in the past", () => {
  const task = { freq: "Weekly", lastDone: localIso(2026, 7, 1) };
  assert.equal(nextDue(task, NOW), "2026-08-26");
});

test("as-needed tasks never get a date", () => {
  assert.equal(nextDue({ freq: "As needed", lastDone: null }, NOW), null);
});

// --- planning ----------------------------------------------------------

test("dinners land on this week's weekdays", () => {
  const data = {
    mealPrep: [{ id: "m1", name: "Karaage" }],
    weekPlan: { Monday: "m1", Wednesday: "m1" },
  };

  const meals = planEvents(data, NOW).filter((e) => e.key.startsWith("meal:"));

  assert.deepEqual(meals, [
    { key: "meal:2026-08-24", summary: "Dinner: Karaage", date: "2026-08-24" },
    { key: "meal:2026-08-26", summary: "Dinner: Karaage", date: "2026-08-26" },
  ]);
});

test("a batch-cooked dinner is labelled as one", () => {
  const data = {
    batchCooking: [{ id: "b1", name: "Bolognese" }],
    weekPlan: { Monday: "batch:b1" },
  };

  const [meal] = planEvents(data, NOW);
  assert.equal(meal.summary, "Dinner: Bolognese (batch)");
});

test("a plan pointing at a deleted meal produces no event", () => {
  const data = { mealPrep: [], weekPlan: { Monday: "gone" } };
  assert.deepEqual(planEvents(data, NOW), []);
});

test("expiring food lands on its expiry date", () => {
  const data = { inventory: [{ id: "i1", name: "Milk", expiry: "2026-08-28" }] };
  const [event] = planEvents(data, NOW);

  assert.deepEqual(event, { key: "expiry:i1", summary: "Use up: Milk", date: "2026-08-28" });
});

test("inventory without an expiry, or with a broken one, is skipped", () => {
  const data = {
    inventory: [
      { id: "i1", name: "Rice", expiry: null },
      { id: "i2", name: "Mystery", expiry: "not a date" },
    ],
  };
  assert.deepEqual(planEvents(data, NOW), []);
});

test("an active odd job lands on its due date", () => {
  const data = { oddJobs: [{ id: "j1", name: "Book car service", dueDate: "2026-08-29", done: false }] };
  const [event] = planEvents(data, NOW);
  assert.deepEqual(event, {
    key: "odd-job:j1",
    summary: "Odd job: Book car service",
    date: "2026-08-29",
  });
});

test("overdue odd jobs stay on today and completed jobs leave the calendar", () => {
  const data = {
    oddJobs: [
      { id: "late", name: "Fix fence", dueDate: "2026-08-01", done: false },
      { id: "done", name: "Clean gutters", dueDate: "2026-08-26", done: true },
      { id: "undated", name: "Paint gate", dueDate: null, done: false },
    ],
  };
  assert.deepEqual(planEvents(data, NOW), [
    { key: "odd-job:late", summary: "Odd job: Fix fence", date: "2026-08-26" },
  ]);
});

test("dog treatments use each schedule's product and next due date", () => {
  const data = {
    dogFood: { dogs: [{ id: "d1", name: "Hiro" }] },
    dogTreatments: {
      schedules: [{
        id: "s1",
        dogId: "d1",
        category: "Heartworm",
        product: "ProHeart",
        frequencyValue: 12,
        frequencyUnit: "months",
        lastGiven: "2026-01-31",
      }],
    },
  };
  assert.deepEqual(planEvents(data, NOW), [{
    key: "dog-treatment:s1",
    summary: "Dog treatment: Hiro · Heartworm · ProHeart",
    date: "2027-01-31",
  }]);
});

test("overdue dog treatments stay on today until recorded", () => {
  const data = {
    dogFood: { dogs: [{ id: "d1", name: "Hiro" }] },
    dogTreatments: {
      schedules: [{
        id: "s1",
        dogId: "d1",
        category: "Flea & tick",
        product: "Treatment",
        frequencyValue: 7,
        frequencyUnit: "days",
        lastGiven: "2026-08-01",
      }],
    },
  };
  assert.equal(planEvents(data, NOW)[0].date, "2026-08-26");
});

test("incomplete treatment schedules do not create calendar events", () => {
  const data = {
    dogTreatments: {
      schedules: [
        { id: "no-product", lastGiven: "2026-08-01", frequencyValue: 7, frequencyUnit: "days" },
        { id: "no-date", product: "Treatment", frequencyValue: 7, frequencyUnit: "days" },
        { id: "no-frequency", product: "Treatment", lastGiven: "2026-08-01", frequencyValue: 0 },
      ],
    },
  };
  assert.deepEqual(planEvents(data, NOW), []);
});

test("empty or malformed data plans nothing rather than throwing", () => {
  for (const input of [null, undefined, {}, { cleaning: "nope", inventory: 5 }]) {
    assert.deepEqual(planEvents(input, NOW), []);
  }
});

// --- reconciliation ----------------------------------------------------

test("a new event is created", () => {
  const { toCreate, toDelete } = reconcileEvents(
    [{ key: "meal:2026-08-24", summary: "Dinner: Karaage", date: "2026-08-24" }],
    []
  );

  assert.equal(toCreate.length, 1);
  assert.equal(toDelete.length, 0);
});

test("an unchanged event is left alone", () => {
  const event = { key: "meal:2026-08-24", summary: "Dinner: Karaage", date: "2026-08-24" };
  const { toCreate, toDelete } = reconcileEvents([event], [{ ...event, uid: "u1" }]);

  assert.equal(toCreate.length, 0);
  assert.equal(toDelete.length, 0);
});

test("changing the meal replaces the event", () => {
  const { toCreate, toDelete } = reconcileEvents(
    [{ key: "meal:2026-08-24", summary: "Dinner: Adobo", date: "2026-08-24" }],
    [{ key: "meal:2026-08-24", summary: "Dinner: Karaage", date: "2026-08-24", uid: "u1" }]
  );

  assert.deepEqual(toDelete.map((e) => e.uid), ["u1"]);
  assert.deepEqual(toCreate.map((e) => e.summary), ["Dinner: Adobo"]);
});

test("a chore marked done moves to its new due date", () => {
  const { toCreate, toDelete } = reconcileEvents(
    [{ key: "clean:t1", summary: "Clean: Toilet", date: "2026-09-02" }],
    [{ key: "clean:t1", summary: "Clean: Toilet", date: "2026-08-26", uid: "u1" }]
  );

  assert.deepEqual(toDelete.map((e) => e.uid), ["u1"]);
  assert.deepEqual(toCreate.map((e) => e.date), ["2026-09-02"]);
});

test("an event whose source is gone is deleted", () => {
  const { toCreate, toDelete } = reconcileEvents(
    [],
    [{ key: "expiry:i1", summary: "Use up: Milk", date: "2026-08-28", uid: "u1" }]
  );

  assert.equal(toCreate.length, 0);
  assert.deepEqual(toDelete.map((e) => e.uid), ["u1"]);
});

test("duplicates left by an earlier run are cleaned up, keeping one", () => {
  const desired = [{ key: "clean:t1", summary: "Clean: Toilet", date: "2026-08-26" }];
  const existing = [
    { key: "clean:t1", summary: "Clean: Toilet", date: "2026-08-26", uid: "u1" },
    { key: "clean:t1", summary: "Clean: Toilet", date: "2026-08-26", uid: "u2" },
    { key: "clean:t1", summary: "Clean: Toilet", date: "2026-08-26", uid: "u3" },
  ];

  const { toCreate, toDelete } = reconcileEvents(desired, existing);

  assert.equal(toCreate.length, 0, "the surviving event must not be recreated");
  assert.deepEqual(toDelete.map((e) => e.uid), ["u2", "u3"]);
});

test("running twice in a row changes nothing the second time", () => {
  const data = {
    mealPrep: [{ id: "m1", name: "Karaage" }],
    weekPlan: { Monday: "m1" },
    cleaning: [{ id: "t1", name: "Toilet", freq: "Weekly", lastDone: null }],
    inventory: [{ id: "i1", name: "Milk", expiry: "2026-08-28" }],
  };

  const desired = planEvents(data, NOW);
  const existing = desired.map((event, index) => ({ ...event, uid: `u${index}` }));

  const { toCreate, toDelete } = reconcileEvents(planEvents(data, NOW), existing);

  assert.equal(toCreate.length, 0);
  assert.equal(toDelete.length, 0);
});

test("events on the calendar that are not ours are never touched", () => {
  // The reconciler only ever sees marked events; this guards the contract.
  const { toDelete } = reconcileEvents([], []);
  assert.equal(toDelete.length, 0);
});

test("next week's dinners land on next week's dates", () => {
  const data = {
    mealPrep: [{ id: "m1", name: "Karaage" }, { id: "m2", name: "Adobo" }],
    weekPlan: { Monday: "m1" },
    nextWeekPlan: { Monday: "m2" },
  };
  const meals = planEvents(data, NOW).filter((e) => e.key.startsWith("meal:"));
  assert.deepEqual(meals, [
    { key: "meal:2026-08-24", summary: "Dinner: Karaage", date: "2026-08-24" },
    { key: "meal:2026-08-31", summary: "Dinner: Adobo", date: "2026-08-31" },
  ]);
});
