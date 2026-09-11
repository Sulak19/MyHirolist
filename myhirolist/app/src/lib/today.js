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
