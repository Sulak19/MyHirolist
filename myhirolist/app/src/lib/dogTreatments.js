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
    stockOnHand: 0,
    reorderAt: 1,
  };
}

function syncTreatmentShopping(list, schedule, idFactory) {
  const current = list || [];
  const openIndex = current.findIndex(
    (item) => item.source === "dog-treatment" && item.scheduleId === schedule.id && !item.checked
  );
  const product = schedule.product?.trim();
  const low = product && Number(schedule.stockOnHand || 0) <= Number(schedule.reorderAt || 0);

  if (!low) return openIndex < 0 ? current : current.filter((_, index) => index !== openIndex);

  const item = {
    id: openIndex >= 0 ? current[openIndex].id : idFactory(),
    name: product,
    checked: false,
    source: "dog-treatment",
    scheduleId: schedule.id,
    reason: `${schedule.category} · low stock`,
  };
  if (openIndex < 0) return [item, ...current];
  return current.map((existing, index) => (index === openIndex ? { ...existing, ...item } : existing));
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
    dogShoppingList: syncTreatmentShopping(data.dogShoppingList, updated, idFactory),
  };
}

export function recordDogTreatment(data, scheduleId, givenDate = treatmentDateKey(), idFactory) {
  const treatments = data.dogTreatments || { schedules: [], history: [] };
  const schedule = (treatments.schedules || []).find((item) => item.id === scheduleId);
  if (!schedule?.product?.trim() || !parseDateKey(givenDate)) return data;

  const updated = {
    ...schedule,
    lastGiven: givenDate,
    stockOnHand: Math.max(0, Number(schedule.stockOnHand || 0) - 1),
  };
  const historyEntry = {
    id: idFactory(),
    scheduleId,
    dogId: schedule.dogId,
    category: schedule.category,
    product: schedule.product.trim(),
    givenAt: givenDate,
  };

  return {
    ...data,
    dogTreatments: {
      ...treatments,
      schedules: treatments.schedules.map((item) => (item.id === scheduleId ? updated : item)),
      history: [historyEntry, ...(treatments.history || [])],
    },
    dogShoppingList: syncTreatmentShopping(data.dogShoppingList, updated, idFactory),
  };
}
