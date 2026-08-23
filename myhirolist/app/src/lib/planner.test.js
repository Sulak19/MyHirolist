import { test } from "node:test";
import assert from "node:assert/strict";

import {
  categoryOf,
  clearAutoDays,
  replan,
  committedIngredients,
  availableStock,
  daysSinceCooked,
  planWeek,
  shoppingNeeds,
  reconcileShopping,
  prepTasks,
  splitPrepNote,
  reconcilePrep,
} from "./planner.js";

const NOW = new Date(2026, 7, 26, 12).getTime();
const daysAgo = (n) => {
  const d = new Date(NOW - n * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const MEALS = [
  { id: "karaage", name: "Karaage", tags: ["Chicken"], ingredients: ["chicken thigh", "soy sauce", "ginger"] },
  { id: "adobo", name: "Adobo", tags: ["Chicken", "Pork"], ingredients: ["chicken", "soy sauce", "potato", "garlic"] },
  { id: "hamburg", name: "Hamburg", tags: ["Beef"], ingredients: ["beef mince", "onions"] },
  { id: "bibimbap", name: "Bibimbap", tags: ["Beef"], ingredients: ["beef mince", "spinach", "carrot"] },
  { id: "pancakes", name: "Korean pancakes", tags: ["Misc"], ingredients: ["chives", "onions", "carrots"] },
];
const BATCHES = [{ id: "b1", name: "Bolognese", portions: 2 }];

// --- categories --------------------------------------------------------

test("ingredients land in sensible supermarket aisles", () => {
  assert.equal(categoryOf("chicken thigh"), "Meat & fish");
  assert.equal(categoryOf("onions"), "Produce");
  assert.equal(categoryOf("milk"), "Dairy");
  assert.equal(categoryOf("soy sauce"), "Pantry");
  assert.equal(categoryOf("frozen peas"), "Frozen");
  assert.equal(categoryOf("serviettes"), "Other");
});

// --- committed stock ---------------------------------------------------

test("ingredients of planned meals count as committed", () => {
  const committed = committedIngredients([{ Monday: "hamburg" }], MEALS, BATCHES);
  assert.ok(committed.has("beef mince"));
  assert.ok(committed.has("onions"));
  assert.ok(!committed.has("spinach"));
});

test("stock committed to this week is not available for next week", () => {
  const inventory = [{ name: "Onions", lowStock: false }, { name: "Rice", lowStock: false }];
  const committed = committedIngredients([{ Monday: "hamburg" }], MEALS, BATCHES);
  const available = availableStock(inventory, committed);

  assert.ok(!available.has("onions"), "this week's meal has spoken for the onions");
  assert.ok(available.has("rice"));
});

test("low stock never counts as available", () => {
  const available = availableStock([{ name: "Rice", lowStock: true }], new Set());
  assert.equal(available.size, 0);
});

// --- variety -----------------------------------------------------------

test("history reports how long ago each meal was cooked, keeping the most recent", () => {
  const since = daysSinceCooked(
    [
      { date: daysAgo(30), mealId: "karaage" },
      { date: daysAgo(5), mealId: "karaage" },
      { date: daysAgo(40), mealId: "adobo" },
    ],
    NOW
  );
  assert.equal(since.get("karaage"), 5);
  assert.equal(since.get("adobo"), 40);
});

test("a meal cooked last week loses to one not cooked in months", () => {
  const plan = planWeek({
    meals: [MEALS[0], MEALS[1]],
    batches: [],
    inventory: [],
    mealHistory: [{ date: daysAgo(3), mealId: "karaage" }, { date: daysAgo(90), mealId: "adobo" }],
    otherWeekPlan: {},
    existingPlan: {},
    nowMs: NOW,
  });
  assert.equal(plan.Monday, "adobo");
});

test("nothing repeats across the fortnight", () => {
  const plan = planWeek({
    meals: MEALS,
    batches: [],
    inventory: [],
    mealHistory: [],
    otherWeekPlan: { Monday: "karaage", Tuesday: "adobo" },
    existingPlan: {},
    nowMs: NOW,
  });

  const chosen = Object.values(plan).filter(Boolean);
  assert.ok(!chosen.includes("karaage"), "already on the other week");
  assert.ok(!chosen.includes("adobo"), "already on the other week");
  assert.equal(new Set(chosen).size, chosen.length, "and no repeats within the week either");
});

test("proteins are spread rather than stacked", () => {
  // Two chicken, two beef, one misc available for five days.
  const plan = planWeek({
    meals: MEALS,
    batches: [],
    inventory: [],
    mealHistory: [],
    otherWeekPlan: {},
    existingPlan: {},
    nowMs: NOW,
  });

  const tagsUsed = Object.values(plan)
    .filter(Boolean)
    .map((id) => MEALS.find((m) => m.id === id))
    .filter(Boolean)
    .flatMap((m) => m.tags);

  const chicken = tagsUsed.filter((t) => t === "Chicken").length;
  assert.ok(chicken <= 2, `expected chicken spread, got ${chicken}`);
});

test("batch portions are spent before fresh meals are chosen", () => {
  const plan = planWeek({
    meals: MEALS,
    batches: [{ id: "b1", name: "Bolognese", portions: 2 }],
    inventory: [],
    mealHistory: [],
    otherWeekPlan: {},
    existingPlan: {},
    nowMs: NOW,
  });

  assert.equal(plan.Monday, "batch:b1");
  assert.equal(plan.Tuesday, "batch:b1");
  assert.ok(!String(plan.Wednesday).startsWith("batch:"), "only two portions existed");
});

test("days already chosen are never overwritten", () => {
  const plan = planWeek({
    meals: MEALS,
    batches: [],
    inventory: [],
    mealHistory: [],
    otherWeekPlan: {},
    existingPlan: { Wednesday: "pancakes" },
    nowMs: NOW,
  });
  assert.equal(plan.Wednesday, "pancakes");
});

test("planning twice in a row gives the same answer", () => {
  const args = {
    meals: MEALS,
    batches: [],
    inventory: [],
    mealHistory: [{ date: daysAgo(10), mealId: "hamburg" }],
    otherWeekPlan: {},
    existingPlan: {},
    nowMs: NOW,
  };
  assert.deepEqual(planWeek(args), planWeek(args));
});

test("running out of unused meals leaves days empty rather than repeating", () => {
  const plan = planWeek({
    meals: [MEALS[0]],
    batches: [],
    inventory: [],
    mealHistory: [],
    otherWeekPlan: {},
    existingPlan: {},
    nowMs: NOW,
  });
  const chosen = Object.values(plan).filter(Boolean);
  assert.equal(chosen.length, 1);
});

// --- shopping ----------------------------------------------------------

test("shopping lists what the plan needs and skips what is stocked", () => {
  const needs = shoppingNeeds(
    [{ Monday: "hamburg" }],
    MEALS,
    BATCHES,
    [{ name: "Onions", lowStock: false }]
  );

  assert.deepEqual(needs.map((n) => n.name), ["beef mince"]);
  assert.equal(needs[0].category, "Meat & fish");
  assert.deepEqual(needs[0].forMeals, ["Hamburg"]);
});

test("an ingredient wanted by two meals is listed once, citing both", () => {
  const needs = shoppingNeeds([{ plan: { Monday: "hamburg", Tuesday: "bibimbap" }, week: "this" }], MEALS, BATCHES, []);
  const mince = needs.find((n) => n.name === "beef mince");
  assert.deepEqual(mince.forMeals, ["Hamburg", "Bibimbap"]);
});

test("needs come back in aisle order", () => {
  const needs = shoppingNeeds([{ plan: { Monday: "adobo" }, week: "this" }], MEALS, BATCHES, []);
  const categories = needs.map((n) => n.category);
  assert.deepEqual(categories, [...categories].sort(
    (a, b) => ["Produce", "Meat & fish", "Dairy", "Pantry", "Frozen", "Other"].indexOf(a)
      - ["Produce", "Meat & fish", "Dairy", "Pantry", "Frozen", "Other"].indexOf(b)
  ));
});

test("plan items are added, hand-added items are never touched", () => {
  const existing = [{ id: "x", name: "Batteries", checked: false }];
  const { items } = reconcileShopping(existing, shoppingNeeds([{ plan: { Monday: "hamburg" }, week: "this" }], MEALS, BATCHES, []), []);

  assert.ok(items.some((i) => i.name === "Batteries" && !i.source), "the household's own item survives");
  assert.ok(items.some((i) => i.name === "beef mince" && i.source === "plan"));
});

test("an ingredient the plan no longer needs is dropped", () => {
  const existing = [{ id: "a", name: "beef mince", checked: false, source: "plan" }];
  const { items } = reconcileShopping(existing, [], []);
  assert.equal(items.length, 0);
});

test("something already bought stays even when the plan changes", () => {
  const existing = [{ id: "a", name: "beef mince", checked: true, source: "plan" }];
  const { items } = reconcileShopping(existing, [], []);
  assert.equal(items.length, 1, "you have already bought it - it should not vanish");
});

test("a dismissed ingredient does not come back", () => {
  const needs = shoppingNeeds([{ plan: { Monday: "hamburg" }, week: "this" }], MEALS, BATCHES, []);
  const { items } = reconcileShopping([], needs, ["beef mince"]);
  assert.ok(!items.some((i) => i.name === "beef mince"));
});

test("a dismissal is forgotten once the plan stops wanting the thing", () => {
  const { dismissed } = reconcileShopping([], [], ["beef mince"]);
  assert.deepEqual(dismissed, [], "so it can return honestly if planned again later");
});

test("reconciling twice in a row changes nothing", () => {
  const needs = shoppingNeeds([{ plan: { Monday: "hamburg" }, week: "this" }], MEALS, BATCHES, []);
  const first = reconcileShopping([], needs, []);
  const second = reconcileShopping(first.items, needs, first.dismissed);

  assert.equal(second.items.length, first.items.length);
  assert.deepEqual(second.items.map((i) => i.name).sort(), first.items.map((i) => i.name).sort());
});

// --- prep --------------------------------------------------------------

test("prep groups the same ingredient across meals into one job", () => {
  const tasks = prepTasks({ Monday: "hamburg", Tuesday: "pancakes" }, {}, MEALS, BATCHES);
  const onions = tasks.find((t) => t.label.includes("onions"));

  assert.ok(onions, "expected an onions task");
  assert.match(onions.meal, /Hamburg/);
  assert.match(onions.meal, /Korean pancakes/);
  assert.equal(tasks.filter((t) => t.label.includes("onions")).length, 1, "one chopping job, not two");
});

test("protein prep is listed before vegetables", () => {
  const tasks = prepTasks({ Monday: "hamburg" }, {}, MEALS, BATCHES);
  assert.match(tasks[0].label, /Marinate & portion/);
});

test("a meal with its own prep notes keeps them verbatim", () => {
  const meals = [{ id: "m", name: "Adobo", ingredients: ["chicken"], prepNotes: "Marinate overnight in soy and vinegar." }];
  const tasks = prepTasks({ Monday: "m" }, {}, meals, []);

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].label, "Marinate overnight in soy and vinegar.");
});

test("the same meal on both weeks is prepped once", () => {
  const tasks = prepTasks({ Monday: "hamburg" }, { Monday: "hamburg" }, MEALS, BATCHES);
  assert.equal(tasks.filter((t) => t.label.includes("beef mince")).length, 1);
});

test("a jar is pantry even when its name contains a vegetable", () => {
  assert.equal(categoryOf("black bean paste"), "Pantry");
  assert.equal(categoryOf("tomato sauce"), "Pantry");
  // ...but the vegetables themselves still land in produce.
  assert.equal(categoryOf("bean sprouts"), "Produce");
  assert.equal(categoryOf("tomato"), "Produce");
});

// --- low stock feeds the list -----------------------------------------

test("anything running low is on the list, meal or no meal", () => {
  const needs = shoppingNeeds([], MEALS, BATCHES, [
    { name: "Rice", location: "Pantry", lowStock: true },
    { name: "Sugar", location: "Pantry", lowStock: false },
  ]);
  assert.deepEqual(needs.map((n) => n.name), ["Rice"]);
  assert.deepEqual(needs[0].reasons, ["low"]);
});

test("a low staple a meal also wants is listed once, for both reasons", () => {
  const needs = shoppingNeeds(
    [{ plan: { Monday: "hamburg" }, week: "this" }],
    MEALS,
    BATCHES,
    [{ name: "onions", location: "Pantry", lowStock: true }]
  );
  const onions = needs.find((n) => n.name.toLowerCase() === "onions");
  assert.equal(needs.filter((n) => n.name.toLowerCase() === "onions").length, 1);
  assert.deepEqual(onions.reasons.sort(), ["low", "meal"]);
});

test("where a low item lives beats guessing from its name", () => {
  const needs = shoppingNeeds([], [], [], [{ name: "Tomato passata", location: "Pantry", lowStock: true }]);
  assert.equal(needs[0].category, "Pantry");
});

test("items say which week they are for", () => {
  const needs = shoppingNeeds(
    [
      { plan: { Monday: "hamburg" }, week: "this" },
      { plan: { Monday: "bibimbap" }, week: "next" },
    ],
    MEALS,
    BATCHES,
    []
  );
  const mince = needs.find((n) => n.name === "beef mince");
  assert.deepEqual(mince.weeks.sort(), ["next", "this"], "both weeks want mince");

  const spinach = needs.find((n) => n.name === "spinach");
  assert.deepEqual(spinach.weeks, ["next"]);
});

// --- replanning --------------------------------------------------------

test("replanning keeps hand-picked days and redoes the rest", () => {
  const plan = { Monday: "karaage", Tuesday: "adobo", Wednesday: "hamburg" };
  const auto = { Monday: false, Tuesday: true, Wednesday: true };

  const { plan: out } = replan({
    plan,
    auto,
    fromWeekday: null,
    meals: MEALS,
    batches: [],
    inventory: [],
    mealHistory: [],
    otherWeekPlan: {},
    nowMs: NOW,
  });

  assert.equal(out.Monday, "karaage", "hand-picked days are pinned");
  assert.ok(out.Tuesday, "the rest get refilled");
});

test("replanning leaves days before today alone", () => {
  const plan = { Monday: "karaage", Tuesday: "adobo", Wednesday: null };
  const auto = { Monday: true, Tuesday: true };

  const cleared = clearAutoDays(plan, auto, "Wednesday");
  assert.equal(cleared.Monday, "karaage", "already cooked - do not churn it");
  assert.equal(cleared.Tuesday, "adobo");
});

test("a day the planner filled is marked as the app's, a manual one is not", () => {
  const { auto } = replan({
    plan: { Monday: "karaage" },
    auto: { Monday: false },
    fromWeekday: null,
    meals: MEALS,
    batches: [],
    inventory: [],
    mealHistory: [],
    otherWeekPlan: {},
    nowMs: NOW,
  });
  assert.equal(auto.Monday, false, "the household chose Monday");
  assert.equal(auto.Tuesday, true, "the app chose Tuesday");
});

test("next week is only prepped when the meal actually freezes", () => {
  const meals = [
    { id: "freezes", name: "Hamburg", ingredients: ["beef mince"], prepNotes: "Form patties and freeze flat on a tray." },
    { id: "fresh", name: "Salad", ingredients: ["cucumber"], prepNotes: "Chop on the day, it wilts." },
  ];
  const tasks = prepTasks({}, { Monday: "freezes", Tuesday: "fresh" }, meals, []);

  assert.equal(tasks.length, 1);
  assert.match(tasks[0].label, /freeze flat/);
  assert.equal(tasks[0].week, "next");
});

test("this week's prep is not labelled as cook-ahead", () => {
  const meals = [{ id: "m", name: "Hamburg", ingredients: ["beef mince"], prepNotes: "Form patties and freeze." }];
  const tasks = prepTasks({ Monday: "m" }, {}, meals, []);
  assert.equal(tasks[0].week, "this");
});

// --- prep notes and reconciliation -------------------------------------

test("day-of instructions are separated from weekend work", () => {
  const { prep, dayOf } = splitPrepNote("Cut chicken and marinate in soy; Day-of: coat in starch and fry.");
  assert.equal(prep, "Cut chicken and marinate in soy");
  assert.equal(dayOf, "coat in starch and fry.");
});

test("a note with no day-of half is left whole", () => {
  const { prep, dayOf } = splitPrepNote("Form patties and freeze flat.");
  assert.equal(prep, "Form patties and freeze flat.");
  assert.equal(dayOf, null);
});

test("prep tasks carry a stable key so ticks survive a replan", () => {
  const meals = [{ id: "m", name: "Adobo", ingredients: ["chicken"], prepNotes: "Marinate. Day-of: simmer." }];
  const first = prepTasks({ Monday: "m" }, {}, meals, []);
  const second = prepTasks({ Tuesday: "m" }, {}, meals, []);
  assert.equal(first[0].key, second[0].key, "same meal, same job, same key");
});

test("prep reconciles: adds new, keeps hand-added, drops what left the plan", () => {
  const meals = [{ id: "m", name: "Adobo", ingredients: ["chicken"], prepNotes: "Marinate." }];
  const tasks = prepTasks({ Monday: "m" }, {}, meals, []);

  const withManual = reconcilePrep([{ id: "x", label: "Sharpen knives", checked: false }], tasks);
  assert.ok(withManual.some((t) => t.label === "Sharpen knives"), "hand-added survives");
  assert.ok(withManual.some((t) => t.source === "plan"), "plan task added");

  const emptied = reconcilePrep(withManual, []);
  assert.ok(emptied.some((t) => t.label === "Sharpen knives"));
  assert.ok(!emptied.some((t) => t.source === "plan" && !t.checked), "plan task gone with the meal");
});

test("a prep task already ticked is not removed when the plan moves on", () => {
  const done = [{ key: "this::Adobo::Marinate.", label: "Marinate.", checked: true, source: "plan" }];
  const out = reconcilePrep(done, []);
  assert.equal(out.length, 1);
});
