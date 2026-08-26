export const DOG_TREATMENT_CATEGORIES = ["Heartworm", "Intestinal worms", "Flea & tick"];

export function treatmentDateKey(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return null;
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function parseDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : { date, year, month: month - 1, day };
}

function formatUtcDate(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function addTreatmentInterval(dateKey, value, unit) {
  const parsed = parseDateKey(dateKey);
  const amount = Math.max(0, Math.round(Number(value) || 0));
  if (!parsed || amount <= 0) return null;

  if (unit === "days" || unit === "weeks") {
    const result = new Date(parsed.date);
    result.setUTCDate(result.getUTCDate() + amount * (unit === "weeks" ? 7 : 1));
    return formatUtcDate(result);
  }

  const monthsToAdd = unit === "years" ? amount * 12 : amount;
  const rawMonth = parsed.month + monthsToAdd;
  const targetYear = parsed.year + Math.floor(rawMonth / 12);
  const targetMonth = ((rawMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return formatUtcDate(new Date(Date.UTC(targetYear, targetMonth, Math.min(parsed.day, lastDay))));
}

export function nextTreatmentDue(schedule) {
  return addTreatmentInterval(schedule?.lastGiven, schedule?.frequencyValue, schedule?.frequencyUnit);
}

export function dueDogTreatments(dogTreatments, dogs, today = treatmentDateKey()) {
  const dogNames = new Map((dogs || []).map((dog) => [dog.id, dog.name]));
  return (dogTreatments?.schedules || [])
    .map((schedule) => ({ ...schedule, nextDue: nextTreatmentDue(schedule), dogName: dogNames.get(schedule.dogId) || "Dog" }))
    .filter((schedule) => schedule.product?.trim() && schedule.nextDue && schedule.nextDue <= today)
    .map((schedule) => ({
      ...schedule,
      overdueDays: Math.max(0, Math.floor((new Date(`${today}T00:00:00Z`) - new Date(`${schedule.nextDue}T00:00:00Z`)) / 86400000)),
    }))
    .sort((a, b) => a.nextDue.localeCompare(b.nextDue) || a.dogName.localeCompare(b.dogName));
}

function defaultSchedule(dogId, category, idFactory) {
  return {
    id: idFactory(),
    dogId,
    category,
    product: "",
    frequencyValue: 0,
    frequencyUnit: "months",
    lastGiven: null,
    trackStock: true,
    stockOnHand: 0,
    reorderAt: 1,
  };
}

function productKey(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function syncTreatmentShopping(list, schedules, idFactory) {
  const current = list || [];
  const openTreatmentItems = current.filter((item) => item.source === "dog-treatment" && !item.checked);
  const preserved = current.filter((item) => item.source !== "dog-treatment" || item.checked);
  const existingByProduct = new Map();
  for (const item of openTreatmentItems) {
    const key = productKey(item.name);
    if (key && !existingByProduct.has(key)) existingByProduct.set(key, item);
  }

  const lowByProduct = new Map();
  for (const schedule of schedules || []) {
    const product = schedule?.product?.trim();
    const low =
      schedule?.trackStock !== false &&
      product &&
      Number(schedule.stockOnHand || 0) <= Number(schedule.reorderAt || 0);
    if (!low) continue;

    const key = productKey(product);
    const group = lowByProduct.get(key) || { name: product, schedules: [] };
    group.schedules.push(schedule);
    lowByProduct.set(key, group);
  }

  const generated = [];
  for (const [key, group] of lowByProduct) {
    const existing = existingByProduct.get(key);
    const categories = [...new Set(group.schedules.map((schedule) => schedule.category).filter(Boolean))];
    generated.push({
      id: existing?.id || idFactory(),
      name: group.name,
      quantity: group.schedules.length,
      checked: false,
      source: "dog-treatment",
      scheduleId: group.schedules[0].id,
      scheduleIds: group.schedules.map((schedule) => schedule.id),
      reason: `${categories.join(" + ") || "Treatment"} · low stock`,
    });
  }

  return [...generated, ...preserved];
}

export function updateDogTreatmentSchedule(data, dogId, category, patch, idFactory) {
  const treatments = data.dogTreatments || { schedules: [], history: [] };
  const schedules = treatments.schedules || [];
  const index = schedules.findIndex((schedule) => schedule.dogId === dogId && schedule.category === category);
  const base = index >= 0 ? schedules[index] : defaultSchedule(dogId, category, idFactory);
  const updated = { ...base, ...patch };
  const nextSchedules =
    index >= 0
      ? schedules.map((schedule, scheduleIndex) => (scheduleIndex === index ? updated : schedule))
      : [...schedules, updated];

  return {
    ...data,
    dogTreatments: { ...treatments, schedules: nextSchedules },
    dogShoppingList: syncTreatmentShopping(data.dogShoppingList, nextSchedules, idFactory),
  };
}

export function recordDogTreatment(data, scheduleId, givenDate = treatmentDateKey(), idFactory) {
  const treatments = data.dogTreatments || { schedules: [], history: [] };
  const schedule = (treatments.schedules || []).find((item) => item.id === scheduleId);
  if (!schedule?.product?.trim() || !parseDateKey(givenDate)) return data;

  const key = productKey(schedule.product);
  const matching = treatments.schedules.filter(
    (item) => item.category === schedule.category && productKey(item.product) === key
  );
  const matchingIds = new Set(matching.map((item) => item.id));
  const nextSchedules = treatments.schedules.map((item) =>
    matchingIds.has(item.id)
      ? {
          ...item,
          lastGiven: givenDate,
          stockOnHand:
            item.trackStock === false
              ? Number(item.stockOnHand || 0)
              : Math.max(0, Number(item.stockOnHand || 0) - 1),
        }
      : item
  );
  const historyEntries = matching.map((item) => ({
    id: idFactory(),
    scheduleId: item.id,
    dogId: item.dogId,
    category: item.category,
    product: item.product.trim(),
    givenAt: givenDate,
  }));

  return {
    ...data,
    dogTreatments: {
      ...treatments,
      schedules: nextSchedules,
      history: [...historyEntries, ...(treatments.history || [])],
    },
    dogShoppingList: syncTreatmentShopping(data.dogShoppingList, nextSchedules, idFactory),
  };
}
