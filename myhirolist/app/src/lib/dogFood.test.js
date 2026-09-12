import test from "node:test";
import assert from "node:assert/strict";
import { migrateDogFood, feedDogs, sharedDaysRemaining } from "./dogFood.js";

test("feeding both dogs deducts the combined amount from one rotating food", () => {
  const data = { dogs: [{ id: "a", name: "A" }, { id: "b", name: "B" }], foods: [{ id: "f", name: "Homemade", stockG: 1000, servingsG: 250 }] };
  const result = feedDogs(data, { foodId: "f", foodName: "Homemade", amountG: 250 }, "2026-09-12");
  assert.equal(result.foods[0].stockG, 500);
  assert.equal(result.feedingHistory[0].entries.length, 2);
});

test("shared supply estimates sum food rotation coverage", () => {
  assert.equal(sharedDaysRemaining({ foods: [{ stockG: 500, servingsG: 250 }, { stockG: 1000, servingsG: 250 }] }), 6);
});

test("migration is repeat-safe and does not merge separate dog counts", () => {
  const data = { dogs: [{ id: "a", brand: "5 Hounds", packSizeG: 1000, packsOnHand: 2 }, { id: "b", brand: "5 Hounds", packSizeG: 1000, packsOnHand: 3 }] };
  const migrated = migrateDogFood(data);
  assert.equal(migrated.foods.length, 4);
  assert.deepEqual(migrateDogFood(migrated).foods, migrated.foods);
});
