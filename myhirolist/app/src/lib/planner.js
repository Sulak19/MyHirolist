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

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const norm = (value) => String(value ?? "").trim().toLowerCase();
const asArray = (value) => (Array.isArray(value) ? value : []);

// --- ingredient categories --------------------------------------------

const MEAT = ["chicken", "beef", "pork", "lamb", "steak", "mince", "fish", "shrimp", "prawn", "sausage", "kabana", "bacon", "chorizo", "tofu", "spec"];
const PRODUCE = ["onion", "carrot", "cabbage", "spinach", "potato", "garlic", "ginger", "chive", "capsicum", "tomato", "cucumber", "zucchini", "daikon", "sprout", "leek", "wombok", "enoki", "basil", "coriander", "chilli", "lemon", "lime", "mushroom", "bean", "corn", "veg", "salad", "herb"];
const DAIRY = ["milk", "cheese", "butter", "cream", "yoghurt", "yogurt", "egg"];
const FROZEN = ["frozen", "ice"];
const PANTRY = ["rice", "noodle", "pasta", "spaghetti", "sauce", "oil", "vinegar", "sugar", "flour", "starch", "soy", "mirin", "sake", "paste", "stock", "dashi", "gochujang", "gochugaru", "bay leaves", "salt", "pepper", "taco", "chips", "koji", "curry", "spice"];

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
      for (const ingredient of asArray(meal?.ingredients)) committed.add(norm(ingredient));
    }
  }
  return committed;
}

// What can still be assumed to be in the kitchen: stocked, not flagged low,
// and not already spoken for.
export function availableStock(inventory, committed = new Set()) {
  const available = new Set();
  for (const item of asArray(inventory)) {
    const key = norm(item?.name);
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
  const needs = new Map();

  const add = (rawName, { category, meal, week, reason }) => {
    const key = norm(rawName);
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
  // calls for it. Staples run out between meal plans.
  for (const item of asArray(inventory)) {
    if (!item?.lowStock || !item.name) continue;
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
        if (stocked.has(norm(ingredient))) continue;
        add(ingredient, { meal: meal.name, week, reason: "meal" });
      }
    }
  }

  return [...needs.values()].sort((a, b) => {
    const byCategory = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    return byCategory !== 0 ? byCategory : a.name.localeCompare(b.name);
  });
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
  const list = asArray(shopping);
  const needed = new Map(needs.map((need) => [norm(need.name), need]));
  const dismissedSet = new Set(asArray(dismissed).map(norm));

  const kept = [];
  const seen = new Set();

  for (const item of list) {
    const key = norm(item?.name);
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
 * Prep notes usually carry two different things: what to do at the weekend,
 * and what to do on the night ("Day-of: coat in starch and fry"). Only the
 * first belongs on a weekend list, so they are split apart - the day-of half
 * travels with the task but is not what you read while prepping.
 *
 * Returns [{ key, label, dayOf, meal, week, kind }]; `key` is stable so the
 * list can be reconciled without losing which tasks are already ticked.
 */
export function prepTasks(thisWeekPlan, nextWeekPlan, meals, batches) {
  const tasks = [];
  const seen = new Set();

  const collect = (plan, week) => {
    const bespoke = [];
    const byIngredient = new Map();

    for (const { meal } of resolvePlanned(plan, meals, batches)) {
      if (!meal || seen.has(meal.id)) continue;

      // Next week is only worth touching this weekend if it actually keeps.
      // Chopping salad a week early helps nobody.
      if (week === "next" && !freezesWell(meal)) continue;
      seen.add(meal.id);

      if (meal.prepNotes) {
        const { prep, dayOf } = splitPrepNote(meal.prepNotes);
        bespoke.push({ label: prep, dayOf, meal: meal.name, kind: "meal", week });
        continue;
      }

      for (const ingredient of asArray(meal.ingredients)) {
        const key = norm(ingredient);
        if (!key) continue;
        const action = isProtein(ingredient) ? "Marinate & portion" : "Wash & chop";
        const groupKey = `${action}::${key}`;

        const existing = byIngredient.get(groupKey);
        if (existing) {
          if (!existing.meals.includes(meal.name)) existing.meals.push(meal.name);
        } else {
          byIngredient.set(groupKey, { action, ingredient: String(ingredient).trim(), meals: [meal.name] });
        }
      }
    }

    const grouped = [...byIngredient.values()]
      .sort((a, b) => {
        const byAction = a.action === b.action ? 0 : a.action === "Marinate & portion" ? -1 : 1;
        return byAction !== 0 ? byAction : a.ingredient.localeCompare(b.ingredient);
      })
      .map((task) => ({
        label: `${task.action} ${task.ingredient}`,
        dayOf: null,
        meal: task.meals.join(", "),
        kind: "ingredient",
        week,
      }));

    tasks.push(...grouped, ...bespoke);
  };

  collect(thisWeekPlan, "this");
  collect(nextWeekPlan, "next");

  return tasks.map((task) => ({ ...task, key: `${task.week}::${task.meal}::${task.label}` }));
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
    if (item?.source !== "plan") {
      kept.push(item); // added by hand
      continue;
    }
    if (!item.key) continue; // from an older version; let it be replaced

    if (wanted.has(item.key)) {
      const task = wanted.get(item.key);
      kept.push({ ...item, label: task.label, dayOf: task.dayOf, meal: task.meal, week: task.week });
      seenKeys.add(item.key);
    } else if (item.checked) {
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
      dayOf: task.dayOf,
      meal: task.meal,
      week: task.week,
      checked: false,
      source: "plan",
    });
  }

  return [...added, ...kept];
}

// Whether a meal is worth preparing a week early. The household's own prep
// notes are the best signal available - most of the freezable ones say so.
export function freezesWell(meal) {
  const notes = norm(meal?.prepNotes);
  return notes.includes("freez") || notes.includes("frozen");
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
