import { test } from "node:test";
import assert from "node:assert/strict";

import { clearLowStockForPrep, dedupeInventoryItems, dedupeShoppingItems, itemKey, moveInventoryItem, staplesFirst, withInventoryStaples } from "./inventory.js";

test("item matching ignores case, spacing, punctuation and simple plurals", () => {
  assert.equal(itemKey("  Spring-Onions "), itemKey("spring onion"));
  assert.equal(itemKey("2 x Tomatoes"), itemKey("tomato"));
});

test("duplicate shopping rows merge without losing meal metadata", () => {
  const result = dedupeShoppingItems([
    { id: "manual", name: "Onion", checked: false },
    { id: "plan", name: "onions", checked: false, source: "plan", category: "Produce", forMeals: ["Curry"], reasons: ["meal"] },
    { id: "second-plan", name: "ONIONS", checked: true, source: "plan", forMeals: ["Hamburg"], weeks: ["this"] },
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].id, "manual");
  assert.equal(result[0].checked, false, "an active duplicate must remain unticked");
  assert.equal(result[0].source, undefined, "a manually added item remains household-owned");
  assert.equal(result[0].category, "Produce");
  assert.deepEqual(result[0].forMeals, ["Curry", "Hamburg"]);
  assert.deepEqual(result[0].reasons, ["meal"]);
});

test("stock duplicates in the same place and Recent shop are consolidated", () => {
  const result = dedupeInventoryItems([
    { id: "milk", name: "Milk", location: "Fridge", expiry: "2026-09-03", lowStock: true, staple: false },
    { id: "recent", name: "milk", location: "Recent shop", expiry: null, lowStock: false, staple: null },
    { id: "milk-two", name: "MILK", location: "Fridge", expiry: "2026-09-05", lowStock: false, staple: false },
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].id, "milk");
  assert.equal(result[0].location, "Fridge");
  assert.equal(result[0].expiry, "2026-09-03", "the earliest expiry remains useful");
  assert.equal(result[0].lowStock, false, "a purchased copy replenishes the item");
});

test("the same stock item may intentionally live in two real locations", () => {
  const result = dedupeInventoryItems([
    { id: "fridge", name: "Chicken", location: "Fridge" },
    { id: "freezer", name: "chicken", location: "Freezer" },
  ]);
  assert.equal(result.length, 2);
});

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

test("completing bread or frozen-rice prep clears its kitchen low marker", () => {
  const items = [
    { id: "bread", name: "Bread", location: "Freezer", lowStock: true },
    { id: "rice", name: "Frozen rice", location: "Freezer", lowStock: true },
    { id: "milk", name: "Milk", location: "Fridge", lowStock: true },
  ];

  const afterBread = clearLowStockForPrep(items, { kind: "stock", stockName: "bread" });
  const afterRice = clearLowStockForPrep(afterBread, { kind: "stock", stockName: "frozen rice" });

  assert.equal(afterRice.find((item) => item.id === "bread").lowStock, false);
  assert.equal(afterRice.find((item) => item.id === "rice").lowStock, false);
  assert.equal(afterRice.find((item) => item.id === "milk").lowStock, true);
});

test("non-stock prep never changes kitchen stock", () => {
  const items = [{ id: "bread", name: "Bread", lowStock: true }];
  const result = clearLowStockForPrep(items, { kind: "meal", stockName: "bread" });
  assert.equal(result, items);
});

test("saved prep tasks from before stock names existed still clear low stock", () => {
  const items = [{ id: "bread", name: "Bread", lowStock: true }];
  const result = clearLowStockForPrep(items, { kind: "stock", label: "Bake bread" });
  assert.equal(result[0].lowStock, false);
});

test("staples display first while each group's saved order is preserved", () => {
  const items = [
    { id: "milk", name: "Milk", staple: false },
    { id: "rice", name: "Rice", staple: true },
    { id: "cheese", name: "Cheese", staple: false },
    { id: "oil", name: "Oil", staple: true },
    { id: "pending", name: "Pending", staple: null },
  ];

  assert.deepEqual(staplesFirst(items).map((item) => item.id), ["rice", "oil", "milk", "cheese", "pending"]);
  assert.deepEqual(items.map((item) => item.id), ["milk", "rice", "cheese", "oil", "pending"], "display sorting must not rewrite saved stock");
});
