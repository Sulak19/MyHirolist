// Turns the household blob into the handful of numbers Home Assistant cares
// about. Pure, so it can be tested without a store or a running HA.
//
// The rules here mirror App.jsx deliberately -- isDue() and the dog food
// maths are duplicated rather than shared, because the app runs in a browser
// and this runs in the container. If you change one, change the other.

const FREQ_DAYS = { Daily: 1, "Twice weekly": 3, Weekly: 7, Fortnightly: 14, Monthly: 30 };
const DAY_MS = 86400000;

function localDayNumber(value) {
  const date = new Date(value);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}

function nextWeeklyFriday(lastDone) {
  const date = new Date(lastDone);
  if (Number.isNaN(date.getTime())) return null;
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysUntilFriday = (5 - result.getDay() + 7) % 7 || 7;
  result.setDate(result.getDate() + daysUntilFriday);
  return result;
}

export function isDue(task, nowMs) {
  if (task.freq === "As needed") return false;
  if (!task.lastDone) return true;
  if (task.freq === "Weekly") {
    const friday = nextWeeklyFriday(task.lastDone);
    return friday ? localDayNumber(nowMs) >= localDayNumber(friday) : false;
  }
  const days = FREQ_DAYS[task.freq] ?? 7;
  return (nowMs - new Date(task.lastDone).getTime()) / DAY_MS >= days;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// The plan is keyed by weekday name and only covers Monday to Friday.
function mondayKey(date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = copy.getDay();
  copy.setDate(copy.getDate() + (weekday === 0 ? -6 : 1 - weekday));
  return copy.getTime();
}

export function dinnerFor(data, dayOffset, nowMs) {
  const today = new Date(nowMs);
  const date = new Date(nowMs);
  date.setDate(date.getDate() + dayOffset);
  const weekday = WEEKDAYS[date.getDay()];

  // Tomorrow can fall in next week (on a Sunday), so pick the plan whose
  // Monday matches the target date's week.
  const sameWeek = mondayKey(date) === mondayKey(today);
  const source = sameWeek ? data?.weekPlan : data?.nextWeekPlan;
  const plan = source && typeof source === "object" ? source : {};
  const value = plan[weekday];
  if (!value) return null;

  if (String(value).startsWith("batch:")) {
    const id = String(value).slice("batch:".length);
    const batch = (Array.isArray(data.batchCooking) ? data.batchCooking : []).find((b) => b.id === id);
    return batch ? `${batch.name} (batch)` : null;
  }

  const meal = (Array.isArray(data.mealPrep) ? data.mealPrep : []).find((m) => m.id === value);
  return meal ? meal.name : null;
}

export function computeSummary(data, nowMs = Date.now()) {
  const shopping = Array.isArray(data?.shopping) ? data.shopping : [];
  const cleaning = Array.isArray(data?.cleaning) ? data.cleaning : [];
  const inventory = Array.isArray(data?.inventory) ? data.inventory : [];
  const dogs = Array.isArray(data?.dogFood?.dogs) ? data.dogFood.dogs : [];
  const extras = Array.isArray(data?.dogFood?.extras) ? data.dogFood.extras : [];

  const dueTasks = cleaning.filter((task) => isDue(task, nowMs));

  const daysLeftPerDog = dogs
    .map((dog) => (dog.packsPerDay > 0 ? Math.floor(dog.packsOnHand / dog.packsPerDay) : null))
    .filter((value) => value !== null);

  const dogFoodDaysLeft = daysLeftPerDog.length ? Math.min(...daysLeftPerDog) : null;

  const dogFoodLow =
    dogs.some((dog) => dog.packsOnHand <= dog.reorderAtPacks) ||
    extras.some((extra) => extra.lowStock);

  const expiringSoon = inventory.filter((item) => {
    if (!item.expiry) return false;
    return (new Date(item.expiry).getTime() - nowMs) / DAY_MS <= 3;
  });

  const lowStock = inventory.filter((item) => item.lowStock);

  const dinnerTonight = dinnerFor(data, 0, nowMs);
  const dinnerTomorrow = dinnerFor(data, 1, nowMs);

  return {
    dinnerTonight,
    dinnerTomorrow,
    shoppingCount: shopping.filter((item) => !item.checked).length,
    cleaningDue: dueTasks.length,
    cleaningDueNames: dueTasks.map((task) => task.name),
    dogFoodDaysLeft,
    dogFoodLow,
    expiringSoonCount: expiringSoon.length,
    expiringSoonNames: expiringSoon.map((item) => item.name),
    lowStockCount: lowStock.length,
    lowStockNames: lowStock.map((item) => item.name),
  };
}

// One readable sentence for a morning notification or an Assist answer.
export function describeToday(summary) {
  const parts = [];

  if (summary.dinnerTonight) parts.push(`Dinner is ${summary.dinnerTonight}.`);
  else parts.push("Nothing is planned for dinner.");

  if (summary.cleaningDue === 1) parts.push(`One chore is due: ${summary.cleaningDueNames[0]}.`);
  else if (summary.cleaningDue > 1) parts.push(`${summary.cleaningDue} chores are due: ${summary.cleaningDueNames.join(", ")}.`);

  if (summary.shoppingCount === 1) parts.push("One thing on the shopping list.");
  else if (summary.shoppingCount > 1) parts.push(`${summary.shoppingCount} things on the shopping list.`);

  if (summary.expiringSoonCount > 0) parts.push(`Use up soon: ${summary.expiringSoonNames.join(", ")}.`);

  if (summary.dogFoodLow) parts.push("Dog food is running low.");

  return parts.join(" ");
}

// The sensors published to Home Assistant, derived from the summary above.
export function sensorsFrom(summary) {
  return [
    {
      objectId: "dinner_tonight",
      state: summary.dinnerTonight ?? "Nothing planned",
      attributes: { friendly_name: "Dinner tonight", icon: "mdi:silverware-fork-knife" },
    },
    {
      objectId: "dinner_tomorrow",
      state: summary.dinnerTomorrow ?? "Nothing planned",
      attributes: { friendly_name: "Dinner tomorrow", icon: "mdi:silverware-fork-knife" },
    },
    {
      objectId: "today",
      state: describeToday(summary).slice(0, 255), // HA state values are capped at 255 chars
      attributes: { friendly_name: "Household today", icon: "mdi:home-heart", full_text: describeToday(summary) },
    },
    {
      objectId: "shopping_list",
      state: summary.shoppingCount,
      attributes: { friendly_name: "Shopping list items", unit_of_measurement: "items", icon: "mdi:cart" },
    },
    {
      objectId: "cleaning_due",
      state: summary.cleaningDue,
      attributes: {
        friendly_name: "Cleaning tasks due",
        unit_of_measurement: "tasks",
        icon: "mdi:broom",
        tasks: summary.cleaningDueNames,
      },
    },
    {
      objectId: "dog_food_days_left",
      state: summary.dogFoodDaysLeft ?? "unknown",
      attributes: {
        friendly_name: "Dog food days left",
        unit_of_measurement: "days",
        icon: "mdi:dog-side",
        low_stock: summary.dogFoodLow,
      },
    },
    {
      objectId: "expiring_soon",
      state: summary.expiringSoonCount,
      attributes: {
        friendly_name: "Items expiring soon",
        unit_of_measurement: "items",
        icon: "mdi:calendar-alert",
        items: summary.expiringSoonNames,
      },
    },
    {
      objectId: "low_stock",
      state: summary.lowStockCount,
      attributes: {
        friendly_name: "Low stock items",
        unit_of_measurement: "items",
        icon: "mdi:package-variant",
        items: summary.lowStockNames,
      },
    },
  ];
}
