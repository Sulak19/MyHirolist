// Drives the calendar projection: read what is there, work out the
// difference, apply it. The thinking lives in calendar.js; this is the I/O.

import { planEvents, reconcileEvents, describe, keyFrom, addDays, toDateKey } from "./calendar.js";

// How far either side of today the projection is managed. Events outside this
// window are neither read nor written, so nothing older is disturbed.
const WINDOW_BEFORE_DAYS = 2;
const WINDOW_AFTER_DAYS = 120;

export function createCalendarSync({ store, ha, entityId, log, pollMs = 15 * 60 * 1000, settleMs = 4000 }) {
  let timer = null;
  let settleTimer = null;
  let running = false;
  let pending = false;
  let stopped = false;

  async function pass() {
    const state = await store.read();
    const now = Date.now();
    const today = toDateKey(now);

    const windowStart = addDays(today, -WINDOW_BEFORE_DAYS);
    const windowEnd = addDays(today, WINDOW_AFTER_DAYS);

    // Anything outside the window must be dropped from the plan as well as
    // from the read. Otherwise an event dated beyond the window would never
    // be seen by the read, be judged missing on every pass, and be created
    // again and again.
    const desired = planEvents(state.data, now).filter(
      (event) => event.date >= windowStart && event.date < windowEnd
    );

    const existing = await ha.getCalendarEvents(
      entityId,
      `${windowStart}T00:00:00`,
      `${windowEnd}T00:00:00`
    );

    // Only events carrying our marker are ever considered. Anything the
    // household put on this calendar by hand is invisible to the reconciler
    // and therefore safe.
    const ours = existing
      .map((event) => ({ ...event, key: keyFrom(event.description) }))
      .filter((event) => event.key && event.uid);

    const { toCreate, toDelete } = reconcileEvents(desired, ours);

    // Deletes first: a changed event is a delete plus a create, and doing it
    // in this order avoids two copies existing at once.
    for (const event of toDelete) {
      try {
        await ha.deleteCalendarEvent(entityId, event.uid, event.recurrenceId);
      } catch (error) {
        log("warn", `calendar: could not delete "${event.summary}": ${error.message}`);
      }
    }

    for (const event of toCreate) {
      try {
        await ha.createCalendarEvent(entityId, {
          summary: event.summary,
          description: describe(event.key),
          date: event.date,
          endDate: addDays(event.date, 1), // all-day; end is exclusive
        });
      } catch (error) {
        log("warn", `calendar: could not add "${event.summary}": ${error.message}`);
      }
    }

    if (toCreate.length || toDelete.length) {
      log("info", `calendar: ${toCreate.length} added, ${toDelete.length} removed`);
    }
  }

  async function runOnce() {
    if (stopped) return;
    if (running) {
      pending = true;
      return;
    }

    running = true;
    try {
      await pass();
    } catch (error) {
      log("warn", "calendar sync failed:", error.message);
    } finally {
      running = false;
      if (pending) {
        pending = false;
        setImmediate(runOnce);
      }
    }
  }

  return {
    async start() {
      await runOnce();
      timer = setInterval(runOnce, pollMs);
      if (timer.unref) timer.unref();
    },

    // A save can arrive on every keystroke pause, and each pass is several
    // HTTP calls, so wait for the edits to settle before rewriting events.
    onLocalChange() {
      if (stopped) return;
      clearTimeout(settleTimer);
      settleTimer = setTimeout(runOnce, settleMs);
      if (settleTimer.unref) settleTimer.unref();
    },

    stop() {
      stopped = true;
      clearInterval(timer);
      clearTimeout(settleTimer);
    },
  };
}

// Today's events for the Home tab. By default only the Home Base calendar:
// reading every calendar sounded good until it surfaced ten energy-tariff
// events above the chores. `entityIds` can widen it to a chosen set.
export function createTodayFeed({ ha, log, entityIds = null, cacheMs = 60000 }) {
  let cached = { at: 0, events: [] };

  return async function today() {
    if (Date.now() - cached.at < cacheMs) return cached.events;

    const all = await ha.listCalendars();
    const calendars = entityIds
      ? all.filter((calendar) => entityIds.includes(calendar.entity_id))
      : all;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const perCalendar = await Promise.all(
      calendars.map((calendar) =>
        ha
          .getCalendarEvents(calendar.entity_id, start.toISOString(), end.toISOString())
          .then((events) =>
            events.map((event) => ({
              summary: event.summary,
              start: event.start,
              allDay: event.allDay,
              calendar: calendar.name ?? calendar.entity_id,
              entityId: calendar.entity_id,
              mine: Boolean(keyFrom(event.description)),
            }))
          )
          .catch((error) => {
            log("debug", `calendar ${calendar.entity_id} unreadable: ${error.message}`);
            return [];
          })
      )
    );

    const events = perCalendar.flat().sort((a, b) => {
      // All-day events belong at the top of the day, then timed ones in order.
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return String(a.start).localeCompare(String(b.start));
    });

    cached = { at: Date.now(), events };
    return events;
  };
}
