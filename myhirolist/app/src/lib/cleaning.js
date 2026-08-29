const FREQUENCY_DAYS = {
  Daily: 1,
  "Twice weekly": 3,
  Weekly: 7,
  Fortnightly: 14,
  Monthly: 30,
};

function dueAt(task) {
  const days = FREQUENCY_DAYS[task?.freq];
  if (!days) return null;
  if (!task?.lastDone) return Number.NEGATIVE_INFINITY;
  const lastDone = new Date(task.lastDone).getTime();
  return Number.isNaN(lastDone) ? Number.NEGATIVE_INFINITY : lastDone + days * 86400000;
}

export function sortCleaningTasks(tasks, now = new Date()) {
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const currentTime = Number.isNaN(nowMs) ? Date.now() : nowMs;

  const details = (task) => {
    const nextDue = dueAt(task);
    const due = nextDue !== null && nextDue <= currentTime;
    const completed = Boolean(task?.lastDone) && !due;
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
