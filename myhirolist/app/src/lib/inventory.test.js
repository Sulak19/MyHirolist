import { test } from "node:test";
import assert from "node:assert/strict";

import { moveInventoryItem } from "./inventory.js";

test("choosing a location moves an item out of Recent shop", () => {
  const recent = { id: "recent-1", name: "Milk", location: "Recent shop", lowStock: false };
  const pantry = { id: "pantry-1", name: "Rice", location: "Pantry", lowStock: false };

  const result = moveInventoryItem([recent, pantry], recent.id, "Fridge");

  assert.deepEqual(result, [
    { ...recent, location: "Fridge" },
    pantry,
  ]);
  assert.equal(result.some((item) => item.location === "Recent shop"), false);
  assert.equal(result.length, 2, "moving an item must not duplicate inventory");
});

test("moving one item does not mutate the saved inventory", () => {
  const items = [{ id: "recent-1", name: "Milk", location: "Recent shop", lowStock: false }];
  const before = JSON.stringify(items);

  moveInventoryItem(items, "recent-1", "Freezer");

  assert.equal(JSON.stringify(items), before);
});
