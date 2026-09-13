// Shared by the browser and HA server. Stock is opening grams minus the
// active daily records, so history and stock cannot merge independently.
export function localFoodDate(now = new Date()) {
  return [now.getFullYear(), String(now.getMonth()+1).padStart(2,"0"), String(now.getDate()).padStart(2,"0")].join("-");
}
const num = v => Number.isFinite(Number(v)) ? Number(v) : NaN;
export function migrateDogFood(source = {}) {
  if (source.foodVersion === 2) return source;
  return { ...source, foodMigrationPending: true };
}
export function renameDogs(source, namesById = {}) {
  const dogs = (source.dogs || []).map(dog => ({
    ...dog,
    name: String(namesById[dog.id] ?? dog.name ?? "").trim(),
  }));
  if (dogs.some(dog => !dog.name)) throw Error("Enter a name for every dog.");
  const unique = new Set(dogs.map(dog => dog.name.toLocaleLowerCase()));
  if (unique.size !== dogs.length) throw Error("Each dog needs a different name.");
  return { ...source, dogs };
}
export function migrationSuggestions(source) {
  const dogs = source.dogs || [];
  return dogs.filter(d => d.brand?.trim() || Number(d.packsOnHand)>0).map(d => ({
    id: "food:" + d.id, name: d.brand?.trim() || `Food for ${d.name}`, type: d.foodType || "Raw",
    stockG: Math.max(0, num(d.packSizeG) * num(d.packsOnHand) || 0),
    packSizeG: num(d.packSizeG) || 1000,
    servings: Object.fromEntries(dogs.map(other => [other.id, num(other.packSizeG) * num(other.packsPerDay) || 0]))
  }));
}
export function activateFoods(source, foods) {
  if (source.foodVersion === 2) return source;
  const result = { ...source, foodVersion: 2, foodMigrationPending: false,
    legacyFoodBackup: JSON.parse(JSON.stringify(source)), foods, feedingHistory: [] };
  validateDogFood(result);
  return result;
}
export function remainingG(source, foodId) {
  const food = source.foods?.find(f => f.id === foodId);
  if (!food) return 0;
  return num(food.stockG) - (source.feedingHistory || []).reduce((sum, record) =>
    sum + record.entries.filter(e => e.foodId === foodId).reduce((s,e) => s + num(e.amountG), 0), 0);
}
export function remainingPackets(source, foodId) {
  const food = source.foods?.find(f => f.id === foodId);
  const size = num(food?.packSizeG);
  return size > 0 ? remainingG(source, foodId) / size : null;
}
export function openingGramsForPackets(packetCount, packetSizeG, alreadyUsedG = 0) {
  const packets = num(packetCount);
  const size = num(packetSizeG);
  const used = num(alreadyUsedG);
  if (packets < 0 || !(size > 0) || used < 0) throw Error("Enter a valid packet count and packet size.");
  return packets * size + used;
}
export function validateDogFood(source) {
  if (source?.foodVersion !== 2) return;
  const ids = new Set();
  for (const food of source.foods || []) {
    if (!food.id || ids.has(food.id) || !food.name?.trim() || !Number.isFinite(num(food.stockG)) || num(food.stockG)<0)
      throw Error("Enter a food name and valid non-negative stock.");
    ids.add(food.id);
  }
  const dates = new Set();
  for (const record of source.feedingHistory || []) {
    const parsed = new Date(record.date+'T12:00:00');
    if (Number.isNaN(parsed.getTime()) || localFoodDate(parsed)!==record.date || !record.entries?.length)
      throw Error("Enter a valid date and at least one feeding.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.date) || record.id !== "feed:"+record.date || dates.has(record.date))
      throw Error("Only one daily feeding record is allowed per date.");
    dates.add(record.date);
    const dogs = new Set();
    for (const e of record.entries) {
      if (!ids.has(e.foodId) || !e.dogId || dogs.has(e.dogId) || !Number.isFinite(num(e.amountG)) || num(e.amountG)<=0)
        throw Error("Choose a food and a positive amount for every dog.");
      dogs.add(e.dogId);
    }
  }
  for (const food of source.foods || []) if (remainingG(source,food.id)<0)
    throw Error("Not enough "+food.name+" in stock. Correct the amount or stock, then retry.");
}
export function feedDogs(source, selection, date = localFoodDate(), editing = false) {
  if (source.foodVersion !== 2) throw Error("Review shared stock in Dog Food first.");
  if (date > localFoodDate()) throw Error("Feeding cannot be recorded in the future.");
  const existing = source.feedingHistory?.find(r=>r.date===date);
  if (existing && !editing) throw Error("Feeding is already recorded for this date. Use Edit.");
  const entries = (source.dogs || []).map(dog => {
    const choice = selection[dog.id];
    const food = source.foods.find(f=>f.id===choice?.foodId);
    return { dogId:dog.id, dogName:dog.name, foodId:food?.id, foodName:food?.name, amountG:num(choice?.amountG) };
  });
  if (!entries.length) throw Error("Add a dog first.");
  const result = { ...source, feedingHistory: [...(source.feedingHistory||[]).filter(r=>r.date!==date), {id:"feed:"+date,date,entries}] };
  validateDogFood(result);
  return result;
}
export function undoFeed(source,date) {
  return { ...source, feedingHistory: (source.feedingHistory||[]).filter(r=>r.date!==date) };
}
export function foodCoverage(source,food) {
  const amounts=(source.dogs||[]).map(d=>num(food.servings?.[d.id]));
  return amounts.length && amounts.every(n=>n>0) ? remainingG(source,food.id)/amounts.reduce((a,b)=>a+b,0) : null;
}
export function foodSupply(source) {
  if (source?.foodVersion !== 2) return {days:null,incomplete:true};
  let total=0,incomplete=false;
  for (const food of source.foods||[]) {
    if (remainingG(source,food.id)<=0) continue;
    const days=foodCoverage(source,food);
    if (days===null) incomplete=true; else total+=days;
  }
  return {days:Math.floor(total),incomplete};
}
