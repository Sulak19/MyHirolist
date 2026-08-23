import { test } from "node:test";
import assert from "node:assert/strict";

import { computeSummary, isDue, sensorsFrom } from "../summary.js";

const NOW = Date.parse("2026-08-23T12:00:00Z");
const DAY = 86400000;

test("a never-done task is due", () => {
  assert.equal(isDue({ freq: "Weekly", lastDone: null }, NOW), true);
});

test("an as-needed task is never due", () => {
  assert.equal(isDue({ freq: "As needed", lastDone: null }, NOW), false);
});

test("a weekly task is due after seven days, not before", () => {
  const sixDaysAgo = new Date(NOW - 6 * DAY).toISOString();
  const eightDaysAgo = new Date(NOW - 8 * DAY).toISOString();

  assert.equal(isDue({ freq: "Weekly", lastDone: sixDaysAgo }, NOW), false);
  assert.equal(isDue({ freq: "Weekly", lastDone: eightDaysAgo }, NOW), true);
});

test("an unknown frequency falls back to weekly rather than throwing", () => {
  const eightDaysAgo = new Date(NOW - 8 * DAY).toISOString();
  assert.equal(isDue({ freq: "Whenever", lastDone: eightDaysAgo }, NOW), true);
});

test("only unchecked shopping items are counted", () => {
  const summary = computeSummary(
    { shopping: [{ checked: false }, { checked: true }, { checked: false }] },
    NOW
  );
  assert.equal(summary.shoppingCount, 2);
});

test("dog food days left takes the hungriest dog", () => {
  const summary = computeSummary(
    {
      dogFood: {
        dogs: [
          { packsOnHand: 10, packsPerDay: 1, reorderAtPacks: 5 },
          { packsOnHand: 10, packsPerDay: 4, reorderAtPacks: 5 },
        ],
        extras: [],
      },
    },
    NOW
  );
  assert.equal(summary.dogFoodDaysLeft, 2);
});

test("a dog that eats nothing does not produce a days-left of zero", () => {
  const summary = computeSummary(
    { dogFood: { dogs: [{ packsOnHand: 10, packsPerDay: 0, reorderAtPacks: 5 }], extras: [] } },
    NOW
  );
  assert.equal(summary.dogFoodDaysLeft, null);
});

test("low stock is flagged from dogs or from extras", () => {
  const fromDog = computeSummary(
    { dogFood: { dogs: [{ packsOnHand: 3, packsPerDay: 1, reorderAtPacks: 5 }], extras: [] } },
    NOW
  );
  const fromExtra = computeSummary(
    { dogFood: { dogs: [], extras: [{ lowStock: true }] } },
    NOW
  );

  assert.equal(fromDog.dogFoodLow, true);
  assert.equal(fromExtra.dogFoodLow, true);
});

test("items expiring within three days are surfaced, later ones are not", () => {
  const summary = computeSummary(
    {
      inventory: [
        { name: "Milk", expiry: new Date(NOW + 2 * DAY).toISOString() },
        { name: "Rice", expiry: null },
        { name: "Yoghurt", expiry: new Date(NOW + 10 * DAY).toISOString() },
      ],
    },
    NOW
  );

  assert.equal(summary.expiringSoonCount, 1);
  assert.deepEqual(summary.expiringSoonNames, ["Milk"]);
});

test("an empty or malformed blob produces zeroes rather than throwing", () => {
  for (const input of [null, undefined, {}, { shopping: "nope", cleaning: 5 }]) {
    const summary = computeSummary(input, NOW);
    assert.equal(summary.shoppingCount, 0);
    assert.equal(summary.cleaningDue, 0);
    assert.equal(summary.dogFoodDaysLeft, null);
  }
});

test("sensors carry the due task names as an attribute", () => {
  const summary = computeSummary(
    { cleaning: [{ name: "Toilet", freq: "Weekly", lastDone: null }] },
    NOW
  );
  const cleaning = sensorsFrom(summary).find((s) => s.objectId === "cleaning_due");

  assert.equal(cleaning.state, 1);
  assert.deepEqual(cleaning.attributes.tasks, ["Toilet"]);
});

test("unknown dog food days left publishes as unknown, not as zero", () => {
  const summary = computeSummary({ dogFood: { dogs: [], extras: [] } }, NOW);
  const sensor = sensorsFrom(summary).find((s) => s.objectId === "dog_food_days_left");

  assert.equal(sensor.state, "unknown");
});
