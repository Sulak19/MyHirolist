const FREQUENCY_DAYS = {
  Daily: 1,
  "Twice weekly": 3,
  Weekly: 7,
  Fortnightly: 14,
  Monthly: 30,
};

const DAY_MS = 86400000;

function localDayNumber(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}

// Weekly cleaning belongs to a fixed household reset day. Always choose the
// first Friday strictly after completion, including when completed on Friday.
export function nextWeeklyFriday(lastDone) {
  const date = new Date(lastDone);
  if (Number.isNaN(date.getTime())) return null;
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysUntilFriday = (5 - result.getDay() + 7) % 7 || 7;
  result.setDate(result.getDate() + daysUntilFriday);
  return result;
}

function dueAt(task) {
  if (task?.freq === "Weekly" && task?.lastDone) {
    return nextWeeklyFriday(task.lastDone)?.getTime() ?? Number.NEGATIVE_INFINITY;
  }
  const days = FREQUENCY_DAYS[task?.freq];
  if (!days) return null;
  if (!task?.lastDone) return Number.NEGATIVE_INFINITY;
  const lastDone = new Date(task.lastDone).getTime();
  return Number.isNaN(lastDone) ? Number.NEGATIVE_INFINITY : lastDone + days * 86400000;
}

export function cleaningTaskStatus(task, now = new Date()) {
  if (task?.freq === "As needed") {
    return { due: false, overdue: false, completed: Boolean(task?.lastDone), neverDone: false, overdueBy: null };
  }

  const days = FREQUENCY_DAYS[task?.freq] ?? 7;
  if (!task?.lastDone) {
    return { due: true, overdue: true, completed: false, neverDone: true, overdueBy: null };
  }

  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const lastDone = new Date(task.lastDone).getTime();
  if (Number.isNaN(nowMs) || Number.isNaN(lastDone)) {
    return { due: false, overdue: false, completed: false, neverDone: false, overdueBy: null };
  }

  const overdueBy = task.freq === "Weekly"
    ? localDayNumber(nowMs) - localDayNumber(nextWeeklyFriday(lastDone))
    : Math.floor((nowMs - lastDone) / DAY_MS) - days;
  const due = overdueBy >= 0;
  return {
    due,
    overdue: overdueBy > 0,
    completed: !due,
    neverDone: false,
    overdueBy: due ? overdueBy : null,
  };
}

export function sortCleaningTasks(tasks, now = new Date()) {
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const currentTime = Number.isNaN(nowMs) ? Date.now() : nowMs;

  const details = (task) => {
    const nextDue = dueAt(task);
    const { due, completed } = cleaningTaskStatus(task, new Date(currentTime));
    return {
      task,
      nextDue,
      rank: due ? 0 : completed ? 2 : 1,
    };
  };

  return [...(Array.isArray(tasks) ? tasks : [])]
    .map(details)
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      const aDue = a.nextDue ?? Number.POSITIVE_INFINITY;
      const bDue = b.nextDue ?? Number.POSITIVE_INFINITY;
      if (aDue !== bDue) return aDue - bDue;
      return String(a.task?.name ?? "").localeCompare(String(b.task?.name ?? ""));
    })
    .map(({ task }) => task);
}
