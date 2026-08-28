import { test } from "node:test";
import assert from "node:assert/strict";

import { moveInventoryItem, withInventoryStaples } from "./inventory.js";

test("built-in kitchen items migrate as staples and other saved items do not", () => {
  const customStaple = { id: "custom", name: "Oats", staple: true };
  const result = withInventoryStaples([
    { id: "rice", name: "Rice" },
    { id: "milk", name: "Milk" },
    customStaple,
  ]);

  assert.equal(result[0].staple, true);
  assert.equal(result[1].staple, false);
  assert.equal(result[2], customStaple, "an explicit household choice is preserved");
});

test("a Recent shop item remains unclassified until it is put away", () => {
  const [recent] = withInventoryStaples([{ id: "milk", name: "Milk", location: "Recent shop" }]);
  assert.equal(recent.staple, null);
});

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

test("putting away a recent-shop item stores its staple choice", () => {
  const recent = { id: "recent-1", name: "Milk", location: "Recent shop", staple: null };
  const [moved] = moveInventoryItem([recent], recent.id, "Fridge", true);

  assert.equal(moved.location, "Fridge");
  assert.equal(moved.staple, true);
});
