// Fortnight meal planning: variety, committed stock, shopping and prep.
//
// All pure. The app hands it the current data and gets back a proposed week,
// a shopping reconciliation, or a prep list - no state, no side effects, so
// the rules can be tested without a browser.
//
// One thing shapes every decision here: the kitchen inventory has no
// quantities, only a "low stock" flag. So stock is never decremented. Instead
// an ingredient used by an already-planned meal is treated as COMMITTED - not
// available to assume for a later meal. That needs no extra data entry and is
// close enough for a household.

import { dedupeShoppingItems, itemKey } from "./inventory.js";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const norm = (value) => String(value ?? "").trim().toLowerCase();
const asArray = (value) => (Array.isArray(value) ? value : []);

// --- ingredient categories --------------------------------------------

const MEAT = ["chicken", "beef", "pork", "lamb", "steak", "mince", "fish", "shrimp", "prawn", "sausage", "kabana", "bacon", "chorizo", "tofu", "spec"];
const PRODUCE = ["onion", "carrot", "cabbage", "spinach", "potato", "garlic", "ginger", "chive", "capsicum", "tomato", "cucumber", "zucchini", "daikon", "sprout", "leek", "wombok", "enoki", "basil", "coriander", "chilli", "lemon", "lime", "mushroom", "bean", "corn", "veg", "salad", "herb"];
const DAIRY = ["milk", "cheese", "butter", "cream", "yoghurt", "yogurt", "egg"];
const FROZEN = ["frozen", "ice"];
const PANTRY = ["rice", "noodle", "pasta", "spaghetti", "sauce", "oil", "vinegar", "sugar", "flour", "starch", "soy", "mirin", "sake", "paste", "stock", "dashi", "gochujang", "gochugaru", "bay leaves", "salt", "pepper", "taco", "chips", "koji", "curry", "spice"];

// These staples are made or prepared at home. Running low means there is
// kitchen work to do, not something to buy.
const PREP_ONLY_LOW_STOCK = new Map([
  ["frozen rice", "Cook & freeze rice"],
  ["bread", "Bake bread"],
  ["garlic koji", "Make garlic koji"],
  ["ginger", "Prep ginger"],
]);

function prepOnlyLowStock(inventory) {
  const items = new Map();
  for (const item of asArray(inventory)) {
    const key = norm(item?.name);
    const label = PREP_ONLY_LOW_STOCK.get(key);
    if (!item?.lowStock || !label || items.has(key)) continue;
    items.set(key, { key, label });
  }
  return items;
}

export function isPrepOnlyLowStock(name, inventory) {
  return prepOnlyLowStock(inventory).has(norm(name));
}

// Entries created by the older Meals-tab helper had no source marker, so the
// normal shopping reconciliation treats them as hand-added and preserves
// them. The household rule is stronger here: while one of these homemade
// staples is low, it belongs in Prep and nowhere in Shopping.
export function removePrepOnlyShoppingItems(shopping, inventory) {
  return asArray(shopping).filter((item) => !isPrepOnlyLowStock(item?.name, inventory));
}

// Shopping order, roughly how a supermarket is laid out.
export const CATEGORY_ORDER = ["Produce", "Meat & fish", "Dairy", "Pantry", "Frozen", "Other"];

export function categoryOf(ingredient) {
  const lower = norm(ingredient);
  const has = (list) => list.some((word) => lower.includes(word));

  // Pantry is tested before produce on purpose: "black bean paste" is a jar,
  // not a vegetable, and the word "bean" would otherwise claim it.
  if (has(FROZEN)) return "Frozen";
  if (has(MEAT)) return "Meat & fish";
  if (has(DAIRY)) return "Dairy";
  if (has(PANTRY)) return "Pantry";
  if (has(PRODUCE)) return "Produce";
  return "Other";
}

export function isProtein(ingredient) {
  return categoryOf(ingredient) === "Meat & fish";
}

// --- resolving plans to meals -----------------------------------------

export function resolvePlanned(plan, meals, batches) {
  const resolved = [];
  for (const weekday of WEEKDAYS) {
    const value = plan?.[weekday];
    if (!value) continue;

    if (String(value).startsWith("batch:")) {
      const batch = asArray(batches).find((b) => b.id === String(value).slice(6));
      if (batch) resolved.push({ weekday, batch, meal: null });
      continue;
    }
    const meal = asArray(meals).find((m) => m.id === value);
    if (meal) resolved.push({ weekday, meal, batch: null });
  }
  return resolved;
}

// Ingredients spoken for by meals already planned. Not "used up" - there are
// no quantities - but not available to assume for anything else either.
export function committedIngredients(plans, meals, batches) {
  const committed = new Set();
  for (const plan of asArray(plans)) {
    for (const { meal } of resolvePlanned(plan, meals, batches)) {
      for (const ingredient of asArray(meal?.ingredients)) {
        // Keep the original normalized spelling for callers that display or
        // inspect the set, plus the shared identity key used for matching.
        committed.add(norm(ingredient));
        committed.add(itemKey(ingredient));
      }
    }
  }
  return committed;
}

// What can still be assumed to be in the kitchen: stocked, not flagged low,
// and not already spoken for.
export function availableStock(inventory, committed = new Set()) {
  const available = new Set();
  for (const item of asArray(inventory)) {
    const key = itemKey(item?.name);
    if (!key || item.lowStock || committed.has(key)) continue;
    available.add(key);
  }
  return available;
}

// --- variety ------------------------------------------------------------

const DAY_MS = 86400000;

// How many days ago each meal was last cooked, from the archived history.
export function daysSinceCooked(mealHistory, nowMs) {
  const seen = new Map();
  for (const entry of asArray(mealHistory)) {
    const when = Date.parse(`${entry?.date}T12:00:00`);
    if (!entry?.mealId || Number.isNaN(when)) continue;
    const days = Math.floor((nowMs - when) / DAY_MS);
    const existing = seen.get(entry.mealId);
    if (existing === undefined || days < existing) seen.set(entry.mealId, days);
  }
  return seen;
}

const RECENT_DAYS = 14; // inside a fortnight, treat as just eaten
const FAMILIAR_DAYS = 35;

/**
 * Scores a meal for a slot. Higher is better; null means "do not use".
 */
export function scoreMeal(meal, context) {
  const { sinceCooked, alreadyThisFortnight, proteinCounts, available } = context;
  if (!meal) return null;
  if (alreadyThisFortnight.has(meal.id)) return null; // never twice in a fortnight

  let score = 100;

  const days = sinceCooked.get(meal.id);
  if (days !== undefined) {
    if (days <= RECENT_DAYS) score -= 60;
    else if (days <= FAMILIAR_DAYS) score -= 20;
    else score += 10; // a while back - nice to see it again
  } else {
    score += 15; // never cooked, or long enough ago to have fallen off history
  }

  // Prefer meals whose protein is already in the kitchen, and spread proteins
  // across the week so it is not chicken five nights running.
  const proteins = asArray(meal.ingredients).filter(isProtein);
  const tags = asArray(meal.tags);

  if (proteins.some((p) => available.has(norm(p)))) score += 25;

  for (const tag of tags) {
    const used = proteinCounts.get(tag) ?? 0;
    score -= used * 18;
  }

  return score;
}

/**
 * Proposes a week's dinners.
 *
 * Batch portions come first - they are already cooked and will otherwise sit
 * in the freezer - then meals by score. Deterministic: ties break on the
 * meal's position in the list, never at random, so tests and repeated presses
 * agree.
 */
export function planWeek({
  meals,
  batches,
  inventory,
  mealHistory,
  otherWeekPlan,
  existingPlan,
  nowMs = Date.now(),
  fillAll = true,
}) {
  const mealList = asArray(meals);
  const plan = { ...(existingPlan ?? {}) };

  const sinceCooked = daysSinceCooked(mealHistory, nowMs);

  // Anything on the other week of the fortnight, or already chosen for this
  // one, is off the table - that is what makes the fortnight varied.
  const alreadyThisFortnight = new Set();
  for (const source of [otherWeekPlan, existingPlan]) {
    for (const weekday of WEEKDAYS) {
      const value = source?.[weekday];
      if (value && !String(value).startsWith("batch:")) alreadyThisFortnight.add(value);
    }
  }

  const proteinCounts = new Map();
  const countProteins = (mealId) => {
    const meal = mealList.find((m) => m.id === mealId);
    for (const tag of asArray(meal?.tags)) proteinCounts.set(tag, (proteinCounts.get(tag) ?? 0) + 1);
  };
  for (const weekday of WEEKDAYS) {
    const value = plan[weekday];
    if (value && !String(value).startsWith("batch:")) countProteins(value);
  }

  // Batch portions available to spend, most portions first.
  const spendableBatches = asArray(batches)
    .filter((b) => (b.portions ?? 0) > 0)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.portions - a.portions);

  const committed = committedIngredients([otherWeekPlan, plan], mealList, batches);
  const available = availableStock(inventory, committed);

  for (const weekday of WEEKDAYS) {
    if (plan[weekday]) continue; // already chosen; never overwrite
    if (!fillAll) continue;

    const batch = spendableBatches.find((b) => b.portions > 0);
    if (batch) {
      batch.portions -= 1;
      plan[weekday] = `batch:${batch.id}`;
      continue;
    }

    let best = null;
    let bestScore = -Infinity;
    mealList.forEach((meal) => {
      const score = scoreMeal(meal, { sinceCooked, alreadyThisFortnight, proteinCounts, available });
      if (score === null || score <= bestScore) return;
      best = meal;
      bestScore = score;
    });

    if (!best) continue; // ran out of meals that have not been used
    plan[weekday] = best.id;
    alreadyThisFortnight.add(best.id);
    countProteins(best.id);
  }

  return plan;
}

// --- shopping -----------------------------------------------------------

/**
 * What the planned meals need that is not already in the kitchen.
 * Returns [{ name, category, forMeals: [mealName] }], deduplicated.
 */
/**
 * What to buy: everything the fortnight's meals need that is not in the
 * kitchen, plus anything already flagged as running low.
 *
 * @param weeks [{ plan, week: "this" | "next" }]
 * @returns [{ name, category, forMeals, weeks, reasons }]
 */
export function shoppingNeeds(weeks, meals, batches, inventory) {
  const stocked = availableStock(inventory);
  const prepOnly = prepOnlyLowStock(inventory);
  const needs = new Map();

  const add = (rawName, { category, meal, week, reason }) => {
    const key = itemKey(rawName);
    if (!key) return;

    let need = needs.get(key);
    if (!need) {
      need = {
        name: String(rawName).trim(),
        category: category ?? categoryOf(rawName),
        forMeals: [],
        weeks: [],
        reasons: [],
      };
      needs.set(key, need);
    }

    if (meal && !need.forMeals.includes(meal)) need.forMeals.push(meal);
    if (week && !need.weeks.includes(week)) need.weeks.push(week);
    if (reason && !need.reasons.includes(reason)) need.reasons.push(reason);
  };

  // Running low is reason enough to buy something, whether or not a meal
  // calls for it. Staples run out between meal plans. Homemade staples are
  // handled by prepTasks instead.
  for (const item of asArray(inventory)) {
    if (!item?.lowStock || !item.name) continue;
    if (prepOnly.has(norm(item.name))) continue;
    add(item.name, {
      // Where it lives is a better hint than its name: a "Pantry" item is a
      // pantry item even if it is called "tomato".
      category: locationCategory(item.location) ?? categoryOf(item.name),
      reason: "low",
    });
  }

  // Then whatever the planned meals need and the kitchen does not have.
  for (const entry of asArray(weeks)) {
    const plan = entry?.plan ?? entry;
    const week = entry?.week ?? null;

    for (const { meal } of resolvePlanned(plan, meals, batches)) {
      for (const ingredient of asArray(meal?.ingredients)) {
        if (stocked.has(itemKey(ingredient))) continue;
        if (prepOnly.has(norm(ingredient))) continue;
        add(ingredient, { meal: meal.name, week, reason: "meal" });
      }
    }
  }

  return [...needs.values()].sort((a, b) => {
    const byCategory = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    return byCategory !== 0 ? byCategory : a.name.localeCompare(b.name);
  });
}

/**
 * Adds ingredients from meals explicitly selected on the Meals tab.
 *
 * These entries are intentionally not source: "plan": selected meals can be
 * shopping ideas without being assigned to a week, so the normal plan
 * reconciliation must not remove them. They still receive the same aisle and
 * meal metadata as planned ingredients.
 */
export function addSelectedMealsToShopping(shopping, meals, inventory, createId = () => undefined) {
  const existing = [...dedupeShoppingItems(shopping)];
  const added = [];
  const byName = new Map();
  let changed = false;

  for (const item of existing) {
    const key = itemKey(item?.name);
    if (key && !byName.has(key)) byName.set(key, item);
  }

  const replaceItem = (current, updated) => {
    const existingIndex = existing.indexOf(current);
    if (existingIndex >= 0) existing[existingIndex] = updated;
    else {
      const addedIndex = added.indexOf(current);
      if (addedIndex >= 0) added[addedIndex] = updated;
    }
  };

  const stocked = availableStock(inventory);
  const prepOnly = prepOnlyLowStock(inventory);

  for (const meal of asArray(meals)) {
    const mealName = String(meal?.name ?? "").trim();
    if (!mealName) continue;

    for (const ingredient of asArray(meal?.ingredients)) {
      const key = itemKey(ingredient);
      if (!key || stocked.has(key) || prepOnly.has(key)) continue;

      const current = byName.get(key);
      if (current) {
        const category = !current.category || current.category === "Other" ? categoryOf(ingredient) : current.category;
        const forMeals = [...new Set([...asArray(current.forMeals), mealName])];
        const reasons = [...new Set([...asArray(current.reasons), "meal"])];
        const metadataChanged =
          category !== current.category ||
          forMeals.length !== asArray(current.forMeals).length ||
          reasons.length !== asArray(current.reasons).length;

        if (metadataChanged) {
          const updated = { ...current, category, forMeals, reasons };
          replaceItem(current, updated);
          byName.set(key, updated);
          changed = true;
        }
        continue;
      }

      const item = {
        id: createId(),
        name: String(ingredient).trim(),
        checked: false,
        source: "selected-meals",
        category: categoryOf(ingredient),
        forMeals: [mealName],
        weeks: [],
        reasons: ["meal"],
      };
      added.push(item);
      byName.set(key, item);
      changed = true;
    }
  }

  return {
    items: changed ? [...added, ...existing] : asArray(shopping),
    addedCount: added.length,
    changed,
  };
}

// Kitchen locations map onto shopping aisles well enough to be worth using.
export function locationCategory(location) {
  switch (location) {
    case "Pantry":
      return "Pantry";
    case "Fridge":
      return "Dairy";
    case "Freezer":
      return "Frozen";
    case "Supplements":
      return "Other";
    default:
      return null;
  }
}

/**
 * Brings the shopping list in step with the plan.
 *
 * Items the app added carry source: "plan". Everything else is the
 * household's own and is never touched. Removing an app-added item is
 * remembered in `dismissed` so it does not reappear next pass - and the
 * memory is pruned once the plan no longer wants it, so it can come back
 * legitimately later.
 */
export function reconcileShopping(shopping, needs, dismissed = []) {
  const list = dedupeShoppingItems(shopping);
  const needed = new Map(needs.map((need) => [itemKey(need.name), need]));
  const dismissedSet = new Set(asArray(dismissed).map(itemKey));

  const kept = [];
  const seen = new Set();

  for (const item of list) {
    const key = itemKey(item?.name);
    const fromPlan = item?.source === "plan";

    if (!fromPlan) {
      kept.push(item); // the household's own item
      seen.add(key);
      continue;
    }

    // Bought already? Leave it alone even if the plan moved on.
    if (item.checked) {
      kept.push(item);
      seen.add(key);
      continue;
    }

    if (needed.has(key) && !dismissedSet.has(key)) {
      const need = needed.get(key);
      kept.push({
        ...item,
        name: need.name,
        category: need.category,
        forMeals: need.forMeals,
        weeks: need.weeks,
        reasons: need.reasons,
      });
      seen.add(key);
    }
    // else: dropped, because the plan no longer needs it
  }

  const added = [];
  for (const [key, need] of needed) {
    if (seen.has(key) || dismissedSet.has(key)) continue;
    added.push({
      name: need.name,
      checked: false,
      source: "plan",
      category: need.category,
      forMeals: need.forMeals,
      weeks: need.weeks,
      reasons: need.reasons,
    });
  }

  // A dismissal only lasts while the plan still wants the thing. Once it
  // drops out of the plan, forget it, so it can return honestly later.
  const prunedDismissed = [...dismissedSet].filter((key) => needed.has(key));

  return { items: [...added, ...kept], dismissed: prunedDismissed };
}

// --- prep ---------------------------------------------------------------

/**
 * Weekend prep, grouped by the work rather than by the meal.
 *
 * Three meals needing onions is one chopping job, not three. Meals that carry
 * their own prepNotes keep them verbatim - those are specific instructions,
 * not something to merge.
 */
/**
 * The weekend's jobs, grouped by the work rather than by the meal.
 *
 * Prep notes usually carry two different things: what to prepare beforehand
 * and what to cook on the day. Only non-cooking work for the current week
 * belongs here.
 *
 * Returns [{ key, label, dayOf, meal, week, kind }]; `key` is stable so the
 * list can be reconciled without losing which tasks are already ticked.
 */
function prepActionForIngredient(ingredient) {
  const category = categoryOf(ingredient);
  if (category === "Meat & fish") return "Marinate & portion";
  if (category === "Produce") return "Wash & chop";
  return null;
}

function mergePrepTask(tasks, task) {
  const current = tasks.get(task.key);
  if (!current) {
    tasks.set(task.key, task);
    return;
  }

  const meals = [...new Set([...String(current.meal ?? "").split(", "), ...String(task.meal ?? "").split(", ")].filter(Boolean))];
  tasks.set(task.key, {
    ...current,
    meal: meals.join(", "),
    week: current.week === "this" || task.week === "this" ? "this" : "next",
  });
}

function collectMealPrep(tasks, meal, week) {
  if (meal.prepNotes) {
    const { prep, dayOf } = nonCookingPrepNote(meal.prepNotes);
    if (prep) {
      mergePrepTask(tasks, {
        key: `meal::${meal.id}::${norm(prep)}`,
        label: prep,
        dayOf,
        meal: meal.name,
        kind: "meal",
        week,
      });
      return;
    }
    // A note that only described cooking should not leave an empty meal.
    // Fall back to safe ingredient preparation below.
  }

  for (const ingredient of asArray(meal.ingredients)) {
    const ingredientKey = norm(ingredient);
    const action = prepActionForIngredient(ingredient);
    if (!ingredientKey || !action) continue;
    mergePrepTask(tasks, {
      key: `ingredient::${norm(action)}::${ingredientKey}`,
      label: `${action} ${String(ingredient).trim()}`,
      dayOf: null,
      meal: meal.name,
      kind: "ingredient",
      week,
    });
  }
}

export function prepTasks(thisWeekPlan, _nextWeekPlan, meals, batches, inventory = []) {
  const tasks = new Map();
  for (const { key: stockName, label } of prepOnlyLowStock(inventory).values()) {
    mergePrepTask(tasks, {
      key: `stock::${norm(label)}`,
      label,
      stockName,
      dayOf: null,
      meal: "Low stock",
      kind: "stock",
      week: "this",
    });
  }

  const seenMeals = new Set();
  for (const { meal } of resolvePlanned(thisWeekPlan, meals, batches)) {
    if (!meal || seenMeals.has(meal.id)) continue;
    seenMeals.add(meal.id);
    collectMealPrep(tasks, meal, "this");
  }

  return [...tasks.values()].sort((a, b) => {
    const rank = (task) => task.kind === "stock" ? 0 : task.label.startsWith("Marinate & portion") ? 1 : task.label.startsWith("Wash & chop") ? 2 : 3;
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    return a.kind === "stock" && b.kind === "stock" ? 0 : a.label.localeCompare(b.label);
  });
}

/** Adds prep for meals explicitly selected on the Meals tab. */
export function addSelectedMealsToPrep(existing, meals, createId = () => undefined) {
  const generated = new Map();
  for (const meal of asArray(meals)) {
    if (meal?.name) collectMealPrep(generated, meal, "this");
  }

  // Old versions created unlabelled, meal-owned rows. Replace unfinished
  // copies with the new grouped tasks, while retaining anything completed.
  const items = asArray(existing).filter((item) => item?.source || !item?.meal || item.checked);
  const byKey = new Map(items.filter((item) => item?.key).map((item) => [item.key, item]));
  let changed = items.length !== asArray(existing).length;
  let addedCount = 0;

  for (const [key, task] of generated) {
    const current = byKey.get(key);
    if (current) {
      const mealsForTask = [...new Set([...String(current.meal ?? "").split(", "), ...String(task.meal ?? "").split(", ")].filter(Boolean))].join(", ");
      if (mealsForTask !== current.meal) {
        const index = items.indexOf(current);
        items[index] = { ...current, meal: mealsForTask };
        byKey.set(key, items[index]);
        changed = true;
      }
      continue;
    }
    const added = { ...task, id: createId(), checked: false, source: "selected-meals" };
    items.push(added);
    byKey.set(key, added);
    addedCount += 1;
    changed = true;
  }

  return { items, addedCount, changed };
}

/**
 * Separates weekend work from what happens on the night.
 * "Cut chicken and marinate. Day-of: coat in starch and fry."
 *   -> prep: "Cut chicken and marinate."   dayOf: "coat in starch and fry."
 */
export function splitPrepNote(notes) {
  const text = String(notes ?? "").trim();
  const match = /\bday[- ]?of\s*:\s*/i.exec(text);
  if (!match) return { prep: text, dayOf: null };

  return {
    prep: text.slice(0, match.index).trim().replace(/[;,]\s*$/, ""),
    dayOf: text.slice(match.index + match[0].length).trim(),
  };
}

const COOKING_INSTRUCTION = /\b(?:bake|blanch|boil|braise|brown|cook|fry|grill|par[- ]?cook|poach|pressure[- ]?cook|reheat|roast|saut[eé]|sear|simmer|steam|stir[- ]?fry)\b|\bmake\b[^;.]{0,40}\b(?:sauce|cooked base)\b/i;

/** Removes cook-ahead instructions while retaining chopping, marinating and
 * other preparation. The original Day-of text is kept as metadata, but the
 * Prep screen deliberately does not display cooking instructions. */
export function nonCookingPrepNote(notes) {
  const { prep, dayOf } = splitPrepNote(notes);
  if (!COOKING_INSTRUCTION.test(prep)) return { prep, dayOf };

  let removedCooking = false;
  const clauses = prep
    .split(/\s*(?:;|\.(?=\s|$))\s*/)
    .map((clause) => clause.trim())
    .filter(Boolean)
    .map((clause) => {
      const match = COOKING_INSTRUCTION.exec(clause);
      if (!match) return clause;
      removedCooking = true;
      return clause
        .slice(0, match.index)
        .replace(/(?:[-—]\s*)?(?:you can even|then)?\s*$/i, "")
        .replace(/(?:\band\b|\bthen\b|[\s,/—-])+$/i, "")
        .trim();
    })
    .filter(Boolean);

  const onlyStorage = clauses.length > 0 && clauses.every((clause) =>
    /^(?:store|freeze|fridge|refrigerate|portion)\b/i.test(clause)
  );

  return {
    prep: removedCooking && onlyStorage ? "" : clauses.join("; "),
    dayOf,
  };
}

/**
 * Keeps the prep list in step with the plan, the same way shopping works:
 * tasks the app derived carry source "plan" and are added and removed as the
 * plan changes, while anything added by hand is left alone. Ticked tasks
 * survive so a finished job does not reappear.
 */
export function reconcilePrep(existing, tasks) {
  const list = asArray(existing);
  const wanted = new Map(tasks.map((task) => [task.key, task]));

  const kept = [];
  const seenKeys = new Set();

  for (const item of list) {
    // Older releases may have saved generated cook-ahead work for week two.
    // It is no longer part of Prep, even when it was already ticked.
    if (item?.week === "next" && item?.source) continue;
    if (item?.source && item?.kind !== "stock" && COOKING_INSTRUCTION.test(String(item?.label ?? ""))) continue;
    if (item?.source === "selected-meals") {
      if (item.key && wanted.has(item.key)) {
        const task = wanted.get(item.key);
        const meals = [...new Set([...String(item.meal ?? "").split(", "), ...String(task.meal ?? "").split(", ")].filter(Boolean))].join(", ");
        kept.push({ ...item, label: task.label, stockName: task.stockName, dayOf: task.dayOf, meal: meals, week: task.week, kind: task.kind });
        seenKeys.add(item.key);
      } else {
        kept.push(item);
      }
      continue;
    }
    if (item?.source !== "plan") {
      // True manual rows have no meal. Older selected-meal rows did, and are
      // safely replaced once by the grouped planner output.
      if (!item?.meal || item.checked) kept.push(item);
      continue;
    }
    if (!item.key) continue; // from an older version; let it be replaced

    if (wanted.has(item.key)) {
      const task = wanted.get(item.key);
      kept.push({ ...item, label: task.label, stockName: task.stockName, dayOf: task.dayOf, meal: task.meal, week: task.week, kind: task.kind });
      seenKeys.add(item.key);
    } else if (item.checked && item.kind !== "stock") {
      kept.push(item); // already done - dropping it would feel like a bug
      seenKeys.add(item.key);
    }
  }

  const added = [];
  for (const [key, task] of wanted) {
    if (seenKeys.has(key)) continue;
    added.push({
      key,
      label: task.label,
      stockName: task.stockName,
      dayOf: task.dayOf,
      meal: task.meal,
      week: task.week,
      kind: task.kind,
      checked: false,
      source: "plan",
    });
  }

  return [...added, ...kept];
}

const WEEKDAY_INDEX = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4 };

/**
 * Clears the days the planner chose itself, so they can be filled again.
 *
 * Days the household picked by hand are pinned and survive. Days already
 * past are left alone too - re-shuffling Monday's dinner on Thursday helps
 * nobody, and it may already have been cooked.
 *
 * @param auto  { Monday: true, ... } - which days the planner filled
 * @param fromWeekday  only clear this weekday onward (null = all)
 */
export function clearAutoDays(plan, auto, fromWeekday = null) {
  const cleared = { ...(plan ?? {}) };
  const floor = fromWeekday === null ? -1 : WEEKDAY_INDEX[fromWeekday] ?? -1;

  for (const weekday of WEEKDAYS) {
    if (!auto?.[weekday]) continue;
    if (WEEKDAY_INDEX[weekday] < floor) continue;
    cleared[weekday] = null;
  }
  return cleared;
}

/**
 * Replans after a manual override: keeps pinned days, throws the rest of the
 * planner's own choices away, and fills again.
 *
 * Returns { plan, auto } so the caller knows which days remain the app's.
 */
export function replan({ plan, auto, fromWeekday, ...context }) {
  const kept = clearAutoDays(plan, auto, fromWeekday);
  const filled = planWeek({ ...context, existingPlan: kept });

  const nextAuto = {};
  for (const weekday of WEEKDAYS) {
    // A day is the app's if the app just filled it and the household had not
    // pinned it.
    nextAuto[weekday] = Boolean(filled[weekday]) && !kept[weekday] ? true : Boolean(auto?.[weekday]) && !kept[weekday];
  }
  // Pinned days are never the app's.
  for (const weekday of WEEKDAYS) {
    if (plan?.[weekday] && !auto?.[weekday]) nextAuto[weekday] = false;
  }

  return { plan: filled, auto: nextAuto };
}
