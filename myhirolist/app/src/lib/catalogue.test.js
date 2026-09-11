import { test } from "node:test";
import assert from "node:assert/strict";
import { applyCatalogue, saveIngredient, findIngredient, catalogueError } from "./catalogue.js";
import { shoppingNeeds } from "./planner.js";

test("catalogue seeds existing data once and preserves storage, ticks and separate meat cuts", () => {
  const data = applyCatalogue({ inventory: [{ id: "i", name: "Pork belly", location: "Freezer", staple: true }], shopping: [{ id: "s", name: "Pork mince", checked: true }], mealPrep: [{ id: "m", ingredients: ["pork belly"] }] });
  assert.equal(data.ingredientCatalogue.length, 2);
  assert.equal(data.shopping[0].checked, true);
  assert.equal(findIngredient(data.ingredientCatalogue, "pork belly").location, "Freezer");
  assert.deepEqual(applyCatalogue(data), data);
});

test("combining aliases links Meals, Kitchen and Shopping to the same ingredient", () => {
  const data = applyCatalogue({ inventory: [{ id: "i", name: "Capsicum", lowStock: false }], shopping: [{ id: "s", name: "Bell pepper", checked: false }], mealPrep: [{ id: "m", name: "Stir fry", ingredients: ["Bell pepper"] }] });
  const entry = findIngredient(data.ingredientCatalogue, "Capsicum");
  const duplicate = findIngredient(data.ingredientCatalogue, "Bell pepper");
  const result = saveIngredient(data, { ...entry, mergeId: duplicate.id });
  assert.equal(result.ingredientCatalogue.length, 1);
  assert.equal(result.shopping[0].ingredientId, entry.id);
  assert.deepEqual(result.mealPrep[0].ingredients, ["Capsicum"]);
  assert.deepEqual(shoppingNeeds([{ Monday: "m" }], result.mealPrep, [], result.inventory), []);
});

test("rename keeps old name as alias and prevents ambiguous aliases", () => {
  const data = applyCatalogue({ inventory: [{ id: "i", name: "Chicken thigh" }, { id: "j", name: "Chicken mince" }], mealPrep: [{ id: "m", ingredients: ["Chicken thigh"] }] });
  const entry = data.ingredientCatalogue[0];
  const result = saveIngredient(data, { ...entry, name: "Chicken thighs" });
  assert.equal(findIngredient(result.ingredientCatalogue, "Chicken thigh").id, entry.id);
  assert.ok(catalogueError(result.ingredientCatalogue, { ...entry, aliases: ["Chicken mince"] }));
});
