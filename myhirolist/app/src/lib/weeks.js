// Two weeks of meal plan.
//
// `weekPlan` is this week's dinners, keyed by weekday name, and has been
// since the first version of the app. Rather than change its shape - which
// every read in the app and the server depends on - next week lives
// alongside it as `nextWeekPlan` with the same shape. At 7 pm Friday, next
// week becomes this week so the household can plan the following week over
// the weekend.

export const EMPTY_WEEK = { Monday: null, Tuesday: null, Wednesday: null, Thursday: null, Friday: null };

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

// Roughly six months. Long enough for the planner to know a meal is stale,
// short enough that the blob does not grow without limit.
const HISTORY_LIMIT = 180;

export function addDays(dateKey, days) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return localDateKey(new Date(year, month - 1, day + days));
}

// What was actually eaten, so the planner can offer variety rather than the
// same four dinners forever. Batch portions are skipped - they are leftovers
// of a meal already recorded when it was cooked.
function archiveWeek(plan, mondayKey) {
  const entries = [];
  WEEKDAYS.forEach((weekday, index) => {
    const value = plan?.[weekday];
    if (!value || String(value).startsWith("batch:")) return;
    entries.push({ date: addDays(mondayKey, index), mealId: value });
  });
  return entries;
}

function localDateKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

// The Monday of the week containing `date`, as YYYY-MM-DD in local time.
export function mondayOf(date = new Date()) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = copy.getDay(); // 0 = Sunday
  copy.setDate(copy.getDate() + (weekday === 0 ? -6 : 1 - weekday));
  return localDateKey(copy);
}

// The plan switches to the coming Monday at 7 pm Friday, in the device's
// local time. Saturday and Sunday belong to that same newly promoted plan.
function activePlanMonday(date) {
  const monday = mondayOf(date);
  const weekday = date.getDay();
  const afterFridayRollover = weekday === 6 || weekday === 0 || (weekday === 5 && date.getHours() >= 19);
  return afterFridayRollover ? addDays(monday, 7) : monday;
}

/**
 * Promotes next week's plan into this week's at 7 pm Friday.
 *
 * `planWeekOf` records which Monday `weekPlan` belongs to. From Friday at
 * 7 pm through Sunday, the active plan belongs to the coming Monday. If the
 * stamp is current (or missing on legacy data), nothing happens. If it is
 * older, next week's plan moves into weekPlan, nextWeekPlan empties, and the
 * stamp moves forward.
 *
 * Returns the same object when no change is needed, so callers can compare
 * by identity and avoid a pointless save.
 */
export function rolloverWeeks(data, now = new Date()) {
  if (!data || typeof data !== "object") return data;

  const thisMonday = activePlanMonday(now);
  const stamped = data.planWeekOf;

  // Legacy data has no stamp. Treat the existing plan as current and stamp
  // it, but only if that is the sole change - no rollover on first sight.
  if (!stamped) {
    return { ...data, planWeekOf: thisMonday };
  }

  if (stamped >= thisMonday) return data;

  // A week (or more) has passed. If more than one week passed, next week's
  // plan is also stale, so both reset.
  const nextMondayAfterStamp = (() => {
    const [y, m, d] = stamped.split("-").map(Number);
    const date = new Date(y, m - 1, d + 7);
    return localDateKey(date);
  })();

  const exactlyOneWeek = nextMondayAfterStamp === thisMonday;

  const history = [...(Array.isArray(data.mealHistory) ? data.mealHistory : []), ...archiveWeek(data.weekPlan, stamped)];

  return {
    ...data,
    weekPlan: exactlyOneWeek ? { ...EMPTY_WEEK, ...(data.nextWeekPlan ?? {}) } : { ...EMPTY_WEEK },
    nextWeekPlan: { ...EMPTY_WEEK },
    planWeekOf: thisMonday,
    mealHistory: history.slice(-HISTORY_LIMIT),
  };
}
