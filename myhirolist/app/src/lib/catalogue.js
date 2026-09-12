import { itemKey, dedupeInventoryItems, dedupeShoppingItems } from "./inventory.js";

export function findIngredient(catalogue, name) {
  const key = itemKey(name);
  return (catalogue || []).find((entry) => [entry.name, ...(entry.aliases || [])].some((alias) => itemKey(alias) === key));
}

export function catalogueError(catalogue, draft) {
  if (!draft.name?.trim()) return "Enter an ingredient name.";
  const keys = [draft.name, ...(draft.aliases || [])].map(itemKey);
  if (catalogue.some((entry) => entry.id !== draft.id && [entry.name, ...(entry.aliases || [])].some((name) => keys.includes(itemKey(name))))) {
    return "That name or alias already belongs to another ingredient.";
  }
  return "";
}

// Seed from household data, then link all three consumers by stable identity.
// Similar meat cuts remain distinct; only explicit aliases are unified here.
export function applyCatalogue(data) {
  if (!data) return data;
  const catalogue = [...(data.ingredientCatalogue || [])];
  const names = [
    ...(data.inventory || []), ...(data.shopping || []),
    ...(data.mealPrep || []).flatMap((meal) => (meal.ingredients || []).map((name) => ({ name }))),
  ];
  for (const item of names) {
    if (!itemKey(item.name) || findIngredient(catalogue, item.name) || catalogue.some((e) => e.id === item.ingredientId)) continue;
    catalogue.push({
      id: `ingredient:${itemKey(item.name)}`, name: item.name.trim(), aliases: [],
      location: ["Fridge", "Freezer", "Pantry", "Supplements"].includes(item.location) ? item.location : "Pantry",
      staple: item.staple === true,
    });
  }
  const link = (item) => {
    const entry = catalogue.find((e) => e.id === item.ingredientId) || findIngredient(catalogue, item.name);
    return entry ? { ...item, ingredientId: entry.id, name: entry.name } : item;
  };
  return {
    ...data, ingredientCatalogue: catalogue,
    inventory: dedupeInventoryItems((data.inventory || []).map(link)),
    shopping: dedupeShoppingItems((data.shopping || []).map(link)),
    mealPrep: (data.mealPrep || []).map((meal) => ({ ...meal, ingredients: [...new Set((meal.ingredients || []).map((name) => findIngredient(catalogue, name)?.name || name))] })),
  };
}

export function saveIngredient(data, draft) {
  const duplicate = data.ingredientCatalogue.find((e) => e.id === draft.mergeId && e.id !== draft.id);
  const remaining = data.ingredientCatalogue.filter((e) => e.id !== duplicate?.id);
  const error = catalogueError(remaining, draft);
  if (error) throw new Error(error);
  const previous = data.ingredientCatalogue.find((e) => e.id === draft.id);
  const { mergeId, ...fields } = draft;
  const entry = { ...fields, name: draft.name.trim(), aliases: [...new Set([...(draft.aliases || []), ...(previous && previous.name !== draft.name ? [previous.name] : []), ...(duplicate ? [duplicate.name, ...(duplicate.aliases || [])] : [])].map((a) => a.trim()).filter(Boolean))] };
  const relink = (items) => (items || []).map((item) => duplicate && item.ingredientId === duplicate.id ? { ...item, ingredientId: entry.id } : item);
  return applyCatalogue({ ...data, inventory: relink(data.inventory), shopping: relink(data.shopping), ingredientCatalogue: remaining.map((e) => e.id === entry.id ? entry : e) });
}
