// Two weeks of meal plan.
//
// `weekPlan` is this week's dinners, keyed by weekday name, and has been
// since the first version of the app. Rather than change its shape - which
// every read in the app and the server depends on - next week lives
// alongside it as `nextWeekPlan` with the same shape, and on Monday next week
// becomes this week.

export const EMPTY_WEEK = { Monday: null, Tuesday: null, Wednesday: null, Thursday: null, Friday: null };

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

/**
 * Promotes next week's plan into this week's once a new week has begun.
 *
 * `planWeekOf` records which Monday `weekPlan` belongs to. If it is this
 * Monday (or missing on legacy data, which is treated as current), nothing
 * happens. If it is older, next week's plan moves into weekPlan, nextWeekPlan
 * empties, and the stamp moves forward.
 *
 * Returns the same object when no change is needed, so callers can compare
 * by identity and avoid a pointless save.
 */
export function rolloverWeeks(data, now = new Date()) {
  if (!data || typeof data !== "object") return data;

  const thisMonday = mondayOf(now);
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

  return {
    ...data,
    weekPlan: exactlyOneWeek ? { ...EMPTY_WEEK, ...(data.nextWeekPlan ?? {}) } : { ...EMPTY_WEEK },
    nextWeekPlan: { ...EMPTY_WEEK },
    planWeekOf: thisMonday,
  };
}
