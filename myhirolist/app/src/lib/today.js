const WEEKEND_PREP_DAYS = new Set([0, 5, 6]); // Sunday, Friday, Saturday

export function shouldShowMealPrepToday(prepItems, now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return false;
  return WEEKEND_PREP_DAYS.has(now.getDay()) && Array.isArray(prepItems) && prepItems.some((item) => !item?.checked);
}
