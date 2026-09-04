const BUILT_IN_STAPLES = new Set([
  "rice", "spaghetti", "sugar", "olive oil", "sesame oil", "soy sauce", "sake", "mirin",
  "gochugaru", "coffee beans", "garlic koji", "gochujang", "ginger", "dashi", "bread",
  "frozen rice", "fish oil", "krill oil", "magnesium", "l-theanine", "creatine",
]);

const norm = (value) => String(value ?? "").trim().toLowerCase();

// Shopping and inventory are fed from several places (manual entry, meals,
// low-stock reminders, receipts and Recent shop). Use one conservative key
// everywhere so harmless differences do not create another row.
export function itemKey(value) {
  const cleaned = norm(value)
    .normalize("NFKC")
    .replace(/[’']/g, "")
    .replace(/&/g, " and ")
    .replace(/^\d+(?:[.,]\d+)?\s*(?:x|×|g|kg|ml|l|packs?|bunch(?:es)?|tins?|cans?|bottles?)\s+/i, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned
    .split(" ")
    .map((word) => {
      if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
      if (word.length > 4 && word.endsWith("oes")) return word.slice(0, -2);
      if (word.length > 3 && word.endsWith("s") && !/(ss|us|is)$/.test(word)) return word.slice(0, -1);
      return word;
    })
    .join(" ");
}

const union = (left, right) => [...new Set([...(Array.isArray(left) ? left : []), ...(Array.isArray(right) ? right : [])])];

export function dedupeShoppingItems(items) {
  if (!Array.isArray(items)) return [];
  const merged = new Map();

  for (const item of items) {
    const key = itemKey(item?.name);
    if (!key) continue;
    const current = merged.get(key);
    if (!current) {
      merged.set(key, item);
      continue;
    }

    const sameSource = current.source === item.source;
    const source = sameSource
      ? current.source
      : current.source == null || item.source == null
        ? undefined
        : current.source === "selected-meals" || item.source === "selected-meals"
          ? "selected-meals"
          : current.source;
    const category = current.category && current.category !== "Other"
      ? current.category
      : item.category ?? current.category;

    merged.set(key, {
      ...item,
      ...current,
      name: current.name || item.name,
      checked: Boolean(current.checked && item.checked),
      ...(source ? { source } : { source: undefined }),
      category,
      forMeals: union(current.forMeals, item.forMeals),
      weeks: union(current.weeks, item.weeks),
      reasons: union(current.reasons, item.reasons),
    });
  }

  return [...merged.values()];
}

function mergeInventoryPair(current, incoming) {
  const currentRecent = current.location === "Recent shop";
  const incomingRecent = incoming.location === "Recent shop";
  const location = currentRecent && !incomingRecent ? incoming.location : current.location;
  const expiries = [current.expiry, incoming.expiry].filter(Boolean).sort();

  return {
    ...incoming,
    ...current,
    name: current.name || incoming.name,
    location,
    expiry: expiries[0] ?? null,
    lowStock: Boolean(current.lowStock && incoming.lowStock),
    staple: typeof current.staple === "boolean" ? current.staple : incoming.staple,
  };
}

export function dedupeInventoryItems(items) {
  if (!Array.isArray(items)) return [];
  const result = [];

  for (const item of items) {
    const key = itemKey(item?.name);
    if (!key) continue;
    const matchIndex = result.findIndex((current) =>
      itemKey(current.name) === key &&
      (current.location === item.location || current.location === "Recent shop" || item.location === "Recent shop")
    );
    if (matchIndex < 0) result.push(item);
    else result[matchIndex] = mergeInventoryPair(result[matchIndex], item);
  }

  return result;
}

/** Adds the staple flag to data saved before the distinction existed. */
export function withInventoryStaples(items) {
  if (!Array.isArray(items)) return [];
  return dedupeInventoryItems(items).map((item) => {
    if (typeof item?.staple === "boolean") return item;
    // Recent Shop deliberately uses null until the household chooses. Do not
    // let migration silently turn that pending choice into non-staple.
    if (item?.staple === null || item?.location === "Recent shop") {
      return item?.staple === null ? item : { ...item, staple: null };
    }
    return { ...item, staple: BUILT_IN_STAPLES.has(norm(item?.name)) };
  });
}

export function moveInventoryItem(items, id, location, staple) {
  return dedupeInventoryItems(items.map((item) =>
    item.id === id
      ? { ...item, location, ...(typeof staple === "boolean" ? { staple } : {}) }
      : item
  ));
}

/** Completing a generated low-stock prep job means that homemade staple has
 * been replenished. Unticking the task is deliberately not the same as
 * declaring the kitchen stock low again. */
export function clearLowStockForPrep(items, task) {
  const legacyStockNames = new Map([
    [itemKey("Cook & freeze rice"), "frozen rice"],
    [itemKey("Bake bread"), "bread"],
    [itemKey("Make garlic koji"), "garlic koji"],
    [itemKey("Prep ginger"), "ginger"],
  ]);
  const stockKey = itemKey(task?.stockName || legacyStockNames.get(itemKey(task?.label)));
  if (task?.kind !== "stock" || !stockKey || !Array.isArray(items)) return items;

  let changed = false;
  const next = items.map((item) => {
    if (itemKey(item?.name) !== stockKey || !item?.lowStock) return item;
    changed = true;
    return { ...item, lowStock: false };
  });
  return changed ? next : items;
}

/** Presents household staples first without changing the saved inventory
 * order. Items keep their relative order within each group. */
export function staplesFirst(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const byStaple = Number(right.item?.staple === true) - Number(left.item?.staple === true);
      return byStaple || left.index - right.index;
    })
    .map(({ item }) => item);
}
