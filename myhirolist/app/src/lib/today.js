const WEEKEND_PREP_DAYS = new Set([0, 5, 6]); // Sunday, Friday, Saturday

export function shouldShowMealPrepToday(prepItems, now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return false;
  return WEEKEND_PREP_DAYS.has(now.getDay()) && Array.isArray(prepItems) && prepItems.some((item) => !item?.checked);
}

export function oddJobsDueToday(jobs, now = new Date()) {
  if (!Array.isArray(jobs) || !(now instanceof Date) || Number.isNaN(now.getTime())) return [];
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const today = `${now.getFullYear()}-${month}-${day}`;
  return jobs.filter((job) => !job?.done && /^\d{4}-\d{2}-\d{2}$/.test(job?.dueDate) && job.dueDate <= today);
}

export function daysUntilExpiry(expiry, now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return null;
  const value = String(expiry ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  const valid = parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
  if (!valid) return null;

  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const expiryUtc = Date.UTC(year, month - 1, day);
  return Math.round((expiryUtc - todayUtc) / 86400000);
}

export function inventoryUseUpToday(items, now = new Date()) {
  if (!Array.isArray(items) || !(now instanceof Date) || Number.isNaN(now.getTime())) return [];
  return items
    .map((item, index) => ({ item, index, days: daysUntilExpiry(item?.expiry, now) }))
    .filter(({ days }) => days !== null && days <= 7)
    .sort((a, b) => a.days - b.days || a.index - b.index)
    .map(({ item }) => item);
}

/** Display order for each Kitchen section: urgent use-up items first,
 * earliest date first; then staples; then everything else. Saved order is
 * retained within the staple and remainder tiers. */
export function sortKitchenItems(items, now = new Date()) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => {
      const days = daysUntilExpiry(item?.expiry, now);
      const useUpSoon = days !== null && days <= 7;
      return {
        item,
        index,
        days,
        tier: useUpSoon ? 0 : item?.staple === true ? 1 : 2,
      };
    })
    .sort((a, b) => a.tier - b.tier || (a.tier === 0 ? a.days - b.days : a.index - b.index))
    .map(({ item }) => item);
}

export function completeOddJob(jobs, id) {
  if (!Array.isArray(jobs) || !id) return jobs;
  let changed = false;
  const next = jobs.map((job) => {
    if (job?.id !== id || job.done) return job;
    changed = true;
    return { ...job, done: true };
  });
  return changed ? next : jobs;
}
