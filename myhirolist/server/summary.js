// Turns the household blob into the handful of numbers Home Assistant cares
// about. Pure, so it can be tested without a store or a running HA.
//
// The rules here mirror App.jsx deliberately -- isDue() and the dog food
// maths are duplicated rather than shared, because the app runs in a browser
// and this runs in the container. If you change one, change the other.

const FREQ_DAYS = { Daily: 1, "Twice weekly": 3, Weekly: 7, Fortnightly: 14, Monthly: 30 };
const DAY_MS = 86400000;

export function isDue(task, nowMs) {
  if (task.freq === "As needed") return false;
  if (!task.lastDone) return true;
  const days = FREQ_DAYS[task.freq] ?? 7;
  return (nowMs - new Date(task.lastDone).getTime()) / DAY_MS >= days;
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

  return {
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

// The sensors published to Home Assistant, derived from the summary above.
export function sensorsFrom(summary) {
  return [
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
