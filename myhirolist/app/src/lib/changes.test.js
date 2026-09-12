import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeChanges, undoChange } from "./changes.js";

test("independent edits, additions and deletions on two devices survive", () => {
  const base = { jobs: [{ id: "a", done: false, name: "Fence" }, { id: "b", done: false }], plan: { Monday: "m1", Tuesday: "m2" } };
  const local = { jobs: [{ ...base.jobs[0], done: true }], plan: { Monday: "m3", Tuesday: "m2" } };
  const remote = { jobs: [{ ...base.jobs[0], name: "Fix fence" }, base.jobs[1], { id: "c", done: false }], plan: { Monday: "m1", Tuesday: "m4" } };
  assert.deepEqual(mergeChanges(base, local, remote), {
    jobs: [{ id: "a", done: true, name: "Fix fence" }, { id: "c", done: false }], plan: { Monday: "m3", Tuesday: "m4" },
  });
});

test("remote deletion is not resurrected by editing an old record", () => {
  assert.deepEqual(mergeChanges([{ id: "a", done: false }], [{ id: "a", done: true }], []), []);
});

test("Undo restores removed items while preserving newer remote edits", () => {
  const before = { jobs: [{ id: "a", done: false }, { id: "b", name: "Old" }] };
  const after = { jobs: [{ id: "b", name: "Local" }] };
  const current = { jobs: [{ id: "b", name: "Partner" }, { id: "c", name: "New" }] };
  assert.deepEqual(undoChange({ before, after }, current), { jobs: [{ id: "a", done: false }, { id: "b", name: "Partner" }, { id: "c", name: "New" }] });
});
