const BUILT_IN_STAPLES = new Set([
  "rice", "spaghetti", "sugar", "olive oil", "sesame oil", "soy sauce", "sake", "mirin",
  "gochugaru", "coffee beans", "garlic koji", "gochujang", "ginger", "dashi", "bread",
  "frozen rice", "fish oil", "krill oil", "magnesium", "l-theanine", "creatine",
]);

const norm = (value) => String(value ?? "").trim().toLowerCase();

/** Adds the staple flag to data saved before the distinction existed. */
export function withInventoryStaples(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
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
  return items.map((item) =>
    item.id === id
      ? { ...item, location, ...(typeof staple === "boolean" ? { staple } : {}) }
      : item
  );
}
