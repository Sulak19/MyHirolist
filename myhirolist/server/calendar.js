// Projects the household's dated things onto a Home Assistant calendar.
//
// One way, on purpose: the app owns the data and the calendar mirrors it.
// Change a meal and the event moves; tick a chore off and its event jumps to
// the next due date. Editing an event in the calendar itself gets overwritten
// on the next pass, which is why the app writes to a calendar it owns rather
// than to one of the household's own.
//
// Everything here is pure. The reconciliation is where duplicate-event bugs
// would live, so it is testable without Home Assistant or a network.

const DAY_MS = 86400000;
const FREQ_DAYS = { Daily: 1, "Twice weekly": 3, Weekly: 7, Fortnightly: 14, Monthly: 30 };
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

// Stamped into each event's description so our events can be told apart from
// anything else on the calendar, and matched back to what produced them.
const MARKER = "myhirolist-key:";

// Dates here are LOCAL dates, not UTC ones. A household in Australia sits
// ten hours ahead of UTC, so at 9am local the UTC date is still yesterday --
// using UTC would put dinners and chores on the wrong day for most of the
// morning. The Supervisor passes the system timezone to add-ons, so local
// time here is the household's time.
export function toDateKey(ms) {
  const date = new Date(ms);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function addDays(dateKey, days) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return toDateKey(new Date(year, month - 1, day + days).getTime());
}

// Monday of the week containing `ms`, as a date key.
export function mondayOf(ms) {
  const date = new Date(ms);
  const weekday = date.getDay(); // 0 = Sunday
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return addDays(toDateKey(ms), offset);
}

export function describe(key) {
  return `Added by MyHiroList. Edit it in the app, not here.\n${MARKER} ${key}`;
}

export function keyFrom(description) {
  const match = new RegExp(`${MARKER}\\s*(\\S+)`).exec(description ?? "");
  return match ? match[1] : null;
}

const asArray = (value) => (Array.isArray(value) ? value : []);

function mealNameFor(data, value) {
  if (!value) return null;

  if (String(value).startsWith("batch:")) {
    const id = String(value).slice("batch:".length);
    const batch = asArray(data.batchCooking).find((item) => item.id === id);
    return batch ? `${batch.name} (batch)` : null;
  }

  const meal = asArray(data.mealPrep).find((item) => item.id === value);
  return meal ? meal.name : null;
}

// The date a cleaning task is next due, or null if it has no schedule.
export function nextDue(task, nowMs) {
  if (!task || task.freq === "As needed") return null;
  if (!task.lastDone) return toDateKey(nowMs); // never done, so it is due now

  const interval = FREQ_DAYS[task.freq] ?? 7;
  const due = Date.parse(task.lastDone) + interval * DAY_MS;
  if (Number.isNaN(due)) return null;

  // Anything already overdue belongs on today rather than in the past, where
  // nobody would see it.
  return due < nowMs ? toDateKey(nowMs) : toDateKey(due);
}

/**
 * Every event the calendar should contain, given the current household data.
 * Returns [{ key, summary, date }] where `date` is an all-day date key.
 */
export function planEvents(data, nowMs) {
  if (!data) return [];

  const events = [];
  const monday = mondayOf(nowMs);

  // Dinners. weekPlan is keyed by weekday name, so it lands on this week.
  const plan = data.weekPlan && typeof data.weekPlan === "object" ? data.weekPlan : {};
  WEEKDAYS.forEach((weekday, index) => {
    const name = mealNameFor(data, plan[weekday]);
    if (!name) return;
    const date = addDays(monday, index);
    events.push({ key: `meal:${date}`, summary: `Dinner: ${name}`, date });
  });

  // Cleaning, on the day each task is next due.
  for (const task of asArray(data.cleaning)) {
    const date = nextDue(task, nowMs);
    if (!date || !task?.id) continue;
    events.push({ key: `clean:${task.id}`, summary: `Clean: ${task.name}`, date });
  }

  // Food about to go off.
  for (const item of asArray(data.inventory)) {
    if (!item?.expiry || !item.id) continue;
    const parsed = Date.parse(item.expiry);
    if (Number.isNaN(parsed)) continue;
    events.push({ key: `expiry:${item.id}`, summary: `Use up: ${item.name}`, date: toDateKey(parsed) });
  }

  return events;
}

/**
 * Works out the calls needed to make the calendar match the plan.
 *
 * @param desired  [{ key, summary, date }] from planEvents
 * @param existing [{ uid, summary, date, key }] read back from Home Assistant,
 *                 already filtered to events carrying our marker
 */
export function reconcileEvents(desired, existing) {
  const toCreate = [];
  const toDelete = [];

  const existingByKey = new Map();
  for (const event of existing) {
    // A duplicate key means a previous run created two events for the same
    // thing. Keep one, delete the rest, or they accumulate forever.
    if (existingByKey.has(event.key)) toDelete.push(event);
    else existingByKey.set(event.key, event);
  }

  const desiredKeys = new Set();

  for (const event of desired) {
    desiredKeys.add(event.key);
    const current = existingByKey.get(event.key);

    if (!current) {
      toCreate.push(event);
      continue;
    }

    // There is no update service, so a change is a delete followed by a create.
    if (current.summary !== event.summary || current.date !== event.date) {
      toDelete.push(current);
      toCreate.push(event);
    }
  }

  for (const [key, event] of existingByKey) {
    if (!desiredKeys.has(key)) toDelete.push(event);
  }

  return { toCreate, toDelete };
}
