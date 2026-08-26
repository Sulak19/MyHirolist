import test from "node:test";
import assert from "node:assert/strict";
import {
  addTreatmentInterval,
  dueDogTreatments,
  nextTreatmentDue,
  recordDogTreatment,
  updateDogTreatmentSchedule,
} from "./dogTreatments.js";

let counter = 0;
const id = () => `id-${++counter}`;

test("custom treatment intervals calculate the next due date", () => {
  assert.equal(addTreatmentInterval("2026-01-31", 1, "months"), "2026-02-28");
  assert.equal(addTreatmentInterval("2026-02-01", 6, "weeks"), "2026-03-15");
  assert.equal(addTreatmentInterval("2024-02-29", 1, "years"), "2025-02-28");
});

test("due treatments stay separate by dog and category", () => {
  const schedules = [
    { id: "heart", dogId: "dog-1", category: "Heartworm", product: "Product A", lastGiven: "2025-08-26", frequencyValue: 1, frequencyUnit: "years" },
    { id: "flea", dogId: "dog-1", category: "Flea & tick", product: "Product B", lastGiven: "2026-06-26", frequencyValue: 3, frequencyUnit: "months" },
    { id: "worms", dogId: "dog-2", category: "Intestinal worms", product: "Product C", lastGiven: "2026-05-20", frequencyValue: 3, frequencyUnit: "months" },
  ];
  const due = dueDogTreatments({ schedules }, [{ id: "dog-1", name: "Milo" }, { id: "dog-2", name: "Teddy" }], "2026-08-26");
  assert.deepEqual(due.map((item) => [item.dogName, item.category]), [["Teddy", "Intestinal worms"], ["Milo", "Heartworm"]]);
});

test("recording from Today updates schedule, history, stock and shopping", () => {
  let data = {
    dogTreatments: { schedules: [], history: [] },
    dogShoppingList: [],
  };
  data = updateDogTreatmentSchedule(
    data,
    "dog-1",
    "Heartworm",
    { product: "Heartguard", frequencyValue: 1, frequencyUnit: "years", stockOnHand: 2, reorderAt: 1 },
    id
  );
  const schedule = data.dogTreatments.schedules[0];
  data = recordDogTreatment(data, schedule.id, "2026-08-26", id);

  assert.equal(data.dogTreatments.schedules[0].lastGiven, "2026-08-26");
  assert.equal(nextTreatmentDue(data.dogTreatments.schedules[0]), "2027-08-26");
  assert.equal(data.dogTreatments.schedules[0].stockOnHand, 1);
  assert.deepEqual(data.dogTreatments.history[0], {
    id: data.dogTreatments.history[0].id,
    scheduleId: schedule.id,
    dogId: "dog-1",
    category: "Heartworm",
    product: "Heartguard",
    givenAt: "2026-08-26",
  });
  assert.equal(data.dogShoppingList.length, 1);
  assert.equal(data.dogShoppingList[0].name, "Heartguard");
  assert.equal(data.dogShoppingList[0].reason, "Heartworm · low stock");
});

test("low-stock treatment shopping entries do not duplicate and clear after restocking", () => {
  let data = {
    dogTreatments: { schedules: [], history: [] },
    dogShoppingList: [],
  };
  data = updateDogTreatmentSchedule(data, "dog-1", "Flea & tick", { product: "Bravecto", stockOnHand: 1, reorderAt: 1 }, id);
  data = updateDogTreatmentSchedule(data, "dog-1", "Flea & tick", { stockOnHand: 1 }, id);
  assert.equal(data.dogShoppingList.length, 1);

  data = updateDogTreatmentSchedule(data, "dog-1", "Flea & tick", { stockOnHand: 4 }, id);
  assert.equal(data.dogShoppingList.length, 0);
});

test("vet-administered treatments can skip stock and shopping", () => {
  let data = {
    dogTreatments: { schedules: [], history: [] },
    dogShoppingList: [],
  };
  data = updateDogTreatmentSchedule(
    data,
    "dog-1",
    "Heartworm",
    { product: "Annual injection", frequencyValue: 1, frequencyUnit: "years", trackStock: false },
    id
  );
  const schedule = data.dogTreatments.schedules[0];
  data = recordDogTreatment(data, schedule.id, "2026-08-26", id);

  assert.equal(data.dogTreatments.schedules[0].lastGiven, "2026-08-26");
  assert.equal(data.dogShoppingList.length, 0);
});
