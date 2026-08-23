import { test } from "node:test";
import assert from "node:assert/strict";

import { buildAgenda, classify, displayName, shouldShowTomorrow, openItemCount } from "../agenda.js";
import { describe } from "../calendar.js";

const D1 = "2026-08-26";
const D2 = "2026-08-27";

const ev = (summary, key, start = D1, extra = {}) => ({
  summary,
  description: key ? describe(key) : "Dentist",
  start,
  allDay: start.length === 10,
  calendar: "Home Base",
  ...extra,
});

test("events are classified by the key the projection stamped", () => {
  assert.deepEqual(classify(ev("Dinner: Karaage", "meal:2026-08-26")), { kind: "dinner", refId: "2026-08-26" });
  assert.deepEqual(classify(ev("Clean: Toilet", "clean:t1")), { kind: "chore", refId: "t1" });
  assert.deepEqual(classify(ev("Use up: Milk", "expiry:i1")), { kind: "expiry", refId: "i1" });
  assert.deepEqual(classify(ev("Dentist", null)), { kind: "other", refId: null });
});

test("display names drop the projection prefixes", () => {
  assert.equal(displayName("chore", "Clean: Toilet"), "Toilet");
  assert.equal(displayName("dinner", "Dinner: Karaage"), "Karaage");
  assert.equal(displayName("expiry", "Use up: Milk"), "Milk");
  assert.equal(displayName("other", "Dentist 3pm"), "Dentist 3pm");
});

test("a day is grouped into dinner, chores, expiry and other", () => {
  const events = [
    ev("Clean: Toilet", "clean:t1"),
    ev("Dinner: Karaage", "meal:2026-08-26"),
    ev("Use up: Milk", "expiry:i1"),
    ev("Dentist", null, "2026-08-26T15:00:00+10:00"),
    ev("Clean: Bed sheets", "clean:t2"),
  ];
  const [day] = buildAgenda(events, [D1]);

  assert.equal(day.dinner.name, "Karaage");
  assert.deepEqual(day.chores.map((c) => c.name), ["Toilet", "Bed sheets"]);
  assert.deepEqual(day.chores.map((c) => c.refId), ["t1", "t2"]);
  assert.deepEqual(day.expiry.map((e) => e.name), ["Milk"]);
  assert.deepEqual(day.other.map((o) => o.name), ["Dentist"]);
});

test("every requested day exists even when empty, in order", () => {
  const days = buildAgenda([], [D1, D2]);
  assert.deepEqual(days.map((d) => d.date), [D1, D2]);
  assert.equal(openItemCount(days[0]), 0);
});

test("events outside the requested days are ignored", () => {
  const [day] = buildAgenda([ev("Clean: Toilet", "clean:t1", "2026-09-01")], [D1]);
  assert.equal(day.chores.length, 0);
});

test("a timed event lands on its local date", () => {
  // 11pm local on the 26th must not slip to the 27th.
  const local = new Date(2026, 7, 26, 23, 0, 0).toISOString();
  const [d1, d2] = buildAgenda([ev("Late thing", null, local)], [D1, D2]);
  assert.equal(d1.other.length, 1);
  assert.equal(d2.other.length, 0);
});

test("only one dinner per day is kept", () => {
  const [day] = buildAgenda(
    [ev("Dinner: A", "meal:2026-08-26"), ev("Dinner: B", "meal:2026-08-26")],
    [D1]
  );
  assert.equal(day.dinner.name, "A");
});

test("tomorrow shows when today is thin", () => {
  const morning = new Date(2026, 7, 26, 9);
  const [thin] = buildAgenda([ev("Clean: Toilet", "clean:t1")], [D1]);
  const [full] = buildAgenda(
    [ev("Clean: A", "clean:a"), ev("Clean: B", "clean:b"), ev("Clean: C", "clean:c")],
    [D1]
  );
  assert.equal(shouldShowTomorrow(thin, morning), true);
  assert.equal(shouldShowTomorrow(full, morning), false);
});

test("tomorrow always shows in the evening, however full today is", () => {
  const evening = new Date(2026, 7, 26, 18, 30);
  const [full] = buildAgenda(
    [ev("Clean: A", "clean:a"), ev("Clean: B", "clean:b"), ev("Clean: C", "clean:c"), ev("Clean: D", "clean:d")],
    [D1]
  );
  assert.equal(shouldShowTomorrow(full, evening), true);
});
