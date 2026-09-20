import assert from "node:assert/strict";
import test from "node:test";
import { DOG_RECIPES } from "./dogRecipes.js";

test("dog recipe collection contains every recipe grouped by its creator", () => {
  assert.equal(DOG_RECIPES.length, 31);

  const countFor = (source) => DOG_RECIPES.filter((recipe) => recipe.source === source).length;
  assert.equal(countFor("Balanced Canine"), 9);
  assert.equal(countFor("Dr. Judy Morgan, Naturally Healthy Pets"), 1);
  assert.equal(countFor("The Forever Dog Life"), 21);
});

test("every dog recipe has the card fields needed by the phone view", () => {
  DOG_RECIPES.forEach((recipe) => {
    assert.ok(recipe.title);
    assert.ok(recipe.profile);
    assert.ok(recipe.yield);
    assert.ok(recipe.energy);
    assert.ok(recipe.ingredients.length > 0);
    assert.ok(recipe.preparation.length > 0);
    recipe.ingredients.forEach((ingredient) => assert.equal(ingredient.length, 2));
    recipe.supplements.forEach((supplement) => assert.equal(supplement.length, 2));
  });
});
