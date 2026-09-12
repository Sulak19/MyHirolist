const clean = (value) => String(value ?? "").trim();

export const DEFAULT_FOODS = [
  { id: "food:pmd", name: "PMD BARF roll", type: "Raw", stockG: 0, packSizeG: 1000 },
  { id: "food:5hounds", name: "5 Hounds", type: "Raw", stockG: 0, packSizeG: 1000 },
  { id: "food:homemade", name: "Homemade", type: "Cooked", stockG: 0, packSizeG: 1000 },
];

export function migrateDogFood(dogFood) {
  const source = dogFood || {};
  if (Array.isArray(source.foods)) return { ...source, foods: source.foods, feedingHistory: source.feedingHistory || [] };
  const dogs = Array.isArray(source.dogs) ? source.dogs : [];
  // Keep the old per-dog records intact and offer a neutral shared-food model
  // for new entries. Existing stock is not silently added together.
  const foods = dogs.filter(d => d.brand).map((d, index) => ({
    id: `migrated:${d.id || index}`, name: clean(d.brand), type: d.foodType || "Raw",
    stockG: Number(d.packSizeG || 0) * Number(d.packsOnHand || 0), packSizeG: Number(d.packSizeG || 1000),
    servingsG: dogs.length === 2 && d.packsPerDay != null ? Number(d.packSizeG || 0) * Number(d.packsPerDay || 0) : 0,
    migrationSource: d.id,
  }));
  const available = [...foods, ...DEFAULT_FOODS.filter(defaultFood => !foods.some(food => clean(food.name).toLowerCase() === defaultFood.name.toLowerCase()))];
  return { ...source, foods: available, feedingHistory: [], foodMigrationPending: foods.length > 0 };
}

export function addFood(dogFood, food) {
  return { ...dogFood, foods: [...(dogFood.foods || []), { id: food.id || `food:${Date.now()}`, name: clean(food.name), type: food.type || "Raw", stockG: Math.max(0, Number(food.stockG) || 0), packSizeG: Math.max(1, Number(food.packSizeG) || 1000), servingsG: Math.max(0, Number(food.servingsG) || 0) }] };
}

export function feedDogs(dogFood, selection, date = new Date().toISOString().slice(0, 10)) {
  const dogs = dogFood.dogs || [];
  const entries = dogs.map((dog) => ({ dogId: dog.id, dogName: dog.name, foodId: selection[dog.id]?.foodId || selection.foodId, foodName: selection[dog.id]?.foodName || selection.foodName, amountG: Math.max(0, Number(selection[dog.id]?.amountG ?? selection.amountG) || 0) }));
  const totals = new Map();
  for (const entry of entries) totals.set(entry.foodId, (totals.get(entry.foodId) || 0) + entry.amountG);
  const foods = (dogFood.foods || []).map(food => totals.has(food.id) ? { ...food, stockG: Math.max(0, Number(food.stockG || 0) - totals.get(food.id)) } : food);
  return { ...dogFood, foods, feedingHistory: [...(dogFood.feedingHistory || []), { id: `feed:${Date.now()}`, date, entries }] };
}

export function sharedDaysRemaining(dogFood) {
  return (dogFood.foods || []).reduce((total, food) => total + (Number(food.servingsG) > 0 ? Number(food.stockG || 0) / Number(food.servingsG) : 0), 0);
}
