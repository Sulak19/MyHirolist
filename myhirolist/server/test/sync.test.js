import { test } from "node:test";
import assert from "node:assert/strict";

import { reconcile } from "../sync.js";

// app item:  { id, name, checked }
// todo item: { uid, summary, status: "needs_action" | "completed" }
// mapping:   { [appId]: { uid, lastChecked, lastSummary } }

test("a new app item is pushed to Home Assistant", () => {
  const plan = reconcile([{ id: "a1", name: "Milk", checked: false }], [], {});

  assert.deepEqual(plan.addToTodo, [{ appId: "a1", summary: "Milk" }]);
  assert.equal(plan.addToApp.length, 0);
});

test("a new Home Assistant item is pulled into the app", () => {
  const plan = reconcile([], [{ uid: "t1", summary: "Bread", status: "needs_action" }], {});

  assert.equal(plan.addToTodo.length, 0);
  assert.deepEqual(plan.addToApp, [{ uid: "t1", summary: "Bread", checked: false }]);
});

test("an item already mirrored on both sides produces no work", () => {
  const plan = reconcile(
    [{ id: "a1", name: "Milk", checked: false }],
    [{ uid: "t1", summary: "Milk", status: "needs_action" }],
    { a1: { uid: "t1", lastChecked: false, lastSummary: "Milk" } }
  );

  assert.equal(plan.addToTodo.length, 0);
  assert.equal(plan.addToApp.length, 0);
  assert.equal(plan.updateTodo.length, 0);
  assert.equal(plan.updateApp.length, 0);
  assert.equal(plan.removeFromTodo.length, 0);
  assert.equal(plan.removeFromApp.length, 0);
});

test("ticking it off in the app ticks it off in Home Assistant", () => {
  const plan = reconcile(
    [{ id: "a1", name: "Milk", checked: true }],
    [{ uid: "t1", summary: "Milk", status: "needs_action" }],
    { a1: { uid: "t1", lastChecked: false, lastSummary: "Milk" } }
  );

  assert.deepEqual(plan.updateTodo, [{ uid: "t1", status: "completed" }]);
  assert.equal(plan.updateApp.length, 0);
});

test("ticking it off in Home Assistant ticks it off in the app", () => {
  const plan = reconcile(
    [{ id: "a1", name: "Milk", checked: false }],
    [{ uid: "t1", summary: "Milk", status: "completed" }],
    { a1: { uid: "t1", lastChecked: false, lastSummary: "Milk" } }
  );

  assert.deepEqual(plan.updateApp, [{ appId: "a1", checked: true }]);
  assert.equal(plan.updateTodo.length, 0);
});

test("when both sides changed, the app wins", () => {
  // She ticked it off on her phone while he unticked it in HA. Someone has to
  // win; the app is the side people actually shop from.
  const plan = reconcile(
    [{ id: "a1", name: "Milk", checked: true }],
    [{ uid: "t1", summary: "Milk", status: "needs_action" }],
    { a1: { uid: "t1", lastChecked: false, lastSummary: "Milk" } }
  );

  assert.deepEqual(plan.updateTodo, [{ uid: "t1", status: "completed" }]);
  assert.equal(plan.updateApp.length, 0);
});

test("deleting in the app deletes in Home Assistant", () => {
  const plan = reconcile(
    [],
    [{ uid: "t1", summary: "Milk", status: "needs_action" }],
    { a1: { uid: "t1", lastChecked: false, lastSummary: "Milk" } }
  );

  assert.deepEqual(plan.removeFromTodo, [{ uid: "t1" }]);
  assert.equal(plan.addToApp.length, 0, "a mapped item must not come back as new");
});

test("deleting in Home Assistant deletes in the app", () => {
  const plan = reconcile(
    [{ id: "a1", name: "Milk", checked: false }],
    [],
    { a1: { uid: "t1", lastChecked: false, lastSummary: "Milk" } }
  );

  assert.deepEqual(plan.removeFromApp, [{ appId: "a1" }]);
  assert.equal(plan.addToTodo.length, 0, "a mapped item must not be re-added");
});

test("the same name appearing on both sides collapses to one mapping", () => {
  // Both people added "Milk" independently before the first sync ran.
  const plan = reconcile(
    [{ id: "a1", name: "Milk", checked: false }],
    [{ uid: "t1", summary: "milk", status: "needs_action" }],
    {}
  );

  assert.equal(plan.addToTodo.length, 0, "must not create a duplicate in HA");
  assert.equal(plan.addToApp.length, 0, "must not create a duplicate in the app");
  assert.deepEqual(plan.mapping.a1, { uid: "t1", lastChecked: false, lastSummary: "Milk" });
});

test("running twice in a row is a no-op the second time", () => {
  const appItems = [{ id: "a1", name: "Milk", checked: false }];
  const first = reconcile(appItems, [], {});

  // Home Assistant now holds what the first pass asked for.
  const todoItems = [{ uid: "t1", summary: "Milk", status: "needs_action" }];
  const mapping = { ...first.mapping, a1: { uid: "t1", lastChecked: false, lastSummary: "Milk" } };

  const second = reconcile(appItems, todoItems, mapping);

  assert.equal(second.addToTodo.length, 0);
  assert.equal(second.addToApp.length, 0);
  assert.equal(second.removeFromApp.length, 0);
  assert.equal(second.removeFromTodo.length, 0);
});

test("a mapping entry pointing at a vanished item is cleaned up", () => {
  const plan = reconcile([], [], { a1: { uid: "t1", lastChecked: false, lastSummary: "Milk" } });

  assert.equal(Object.keys(plan.mapping).length, 0);
});

test("names are matched ignoring case and surrounding space", () => {
  const plan = reconcile(
    [{ id: "a1", name: "  Bread ", checked: false }],
    [{ uid: "t1", summary: "BREAD", status: "needs_action" }],
    {}
  );

  assert.equal(plan.addToTodo.length, 0);
  assert.equal(plan.addToApp.length, 0);
});

test("two app items with the same name do not both claim one todo item", () => {
  const plan = reconcile(
    [
      { id: "a1", name: "Milk", checked: false },
      { id: "a2", name: "Milk", checked: false },
    ],
    [{ uid: "t1", summary: "Milk", status: "needs_action" }],
    {}
  );

  assert.equal(plan.addToTodo.length, 1, "the second one needs its own todo item");
  assert.equal(plan.addToTodo[0].appId, "a2");
  assert.equal(plan.mapping.a1.uid, "t1");
});
