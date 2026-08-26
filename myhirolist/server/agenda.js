// Turns raw calendar events into the Home tab's agenda: days, each grouped by
// kind. Pure, so the grouping and the "show tomorrow?" rule are testable.
//
// The event key the projection stamps into each description (meal:<date>,
// clean:<taskId>, expiry:<itemId>, odd-job:<jobId>) is what lets the Home tab know that an
// event is a chore it can tick off, rather than just a line of text.

import { keyFrom } from "./calendar.js";

// Tomorrow appears when today is thin, or when the day is mostly over.
export const THIN_DAY_THRESHOLD = 3; // fewer open items than this -> thin
export const EVENING_HOUR = 18; // from this hour tomorrow is what matters

export function classify(event) {
  const key = keyFrom(event.description);
  if (!key) return { kind: "other", refId: null };

  const [prefix, ...rest] = key.split(":");
  const refId = rest.join(":");

  switch (prefix) {
    case "meal":
      return { kind: "dinner", refId };
    case "clean":
      return { kind: "chore", refId };
    case "expiry":
      return { kind: "expiry", refId };
    case "odd-job":
      return { kind: "oddJob", refId };
    case "dog-treatment":
      // Treatment cards come directly from MyHiroList data so they retain
      // their Done action and can update stock/history. Do not show the
      // calendar mirror as a second, inert copy on Today.
      return { kind: "hidden", refId };
    default:
      return { kind: "other", refId: null };
  }
}

// Strips the prefixes the projection adds, since the Home tab groups by kind
// and does not need "Clean:" repeated on every line.
export function displayName(kind, summary) {
  const prefixes = {
    dinner: /^Dinner:\s*/i,
    chore: /^Clean:\s*/i,
    expiry: /^Use up:\s*/i,
    oddJob: /^Odd job:\s*/i,
  };
  const pattern = prefixes[kind];
  return pattern ? String(summary ?? "").replace(pattern, "") : String(summary ?? "");
}

function localDateKey(value) {
  // Timed events arrive as ISO strings with a timezone; all-day ones as a
  // plain date. Both need to land on a local calendar date.
  if (typeof value !== "string") return null;
  if (value.length === 10) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function emptyDay(date) {
  return { date, dinner: null, chores: [], expiry: [], other: [] };
}

/**
 * Groups events into days, each with dinner / chores / expiry / other.
 * `dates` is the ordered list of date keys to produce, so the caller controls
 * the window and every requested day exists even when empty.
 */
export function buildAgenda(events, dates) {
  const days = new Map(dates.map((date) => [date, emptyDay(date)]));

  for (const event of events) {
    const date = localDateKey(event.start);
    const day = days.get(date);
    if (!day) continue;

    const { kind, refId } = classify(event);
    if (kind === "hidden") continue;
    const name = displayName(kind, event.summary);
    const entry = {
      name,
      refId,
      start: event.start,
      allDay: Boolean(event.allDay),
      calendar: event.calendar ?? null,
    };

    if (kind === "dinner") day.dinner = day.dinner ?? entry; // one dinner a day
    else if (kind === "chore") day.chores.push(entry);
    else if (kind === "expiry") day.expiry.push(entry);
    else day.other.push(entry);
  }

  for (const day of days.values()) {
    day.other.sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return String(a.start).localeCompare(String(b.start));
    });
  }

  return dates.map((date) => days.get(date));
}

export function openItemCount(day) {
  if (!day) return 0;
  return (day.dinner ? 1 : 0) + day.chores.length + day.expiry.length + day.other.length;
}

// The rule the user asked for: today always; tomorrow too when today is thin
// or the evening has arrived.
export function shouldShowTomorrow(today, now = new Date()) {
  if (now.getHours() >= EVENING_HOUR) return true;
  return openItemCount(today) < THIN_DAY_THRESHOLD;
}
