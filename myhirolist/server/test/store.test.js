import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createStore } from "../store.js";

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "myhirolist-"));
}

// A controllable clock, so snapshot timing is tested rather than waited for.
function fakeClock(startMs) {
  let now = startMs;
  return {
    now: () => now,
    advance: (ms) => {
      now += ms;
    },
  };
}

const HOUR = 60 * 60 * 1000;

test("an empty store reads as rev 0 with no data", async () => {
  const store = createStore(tmpDir());
  const state = await store.read();

  assert.equal(state.rev, 0);
  assert.equal(state.data, null);
});

test("a write increments the revision and returns the stored data", async () => {
  const store = createStore(tmpDir());
  const state = await store.write({ meals: ["curry"] }, 0);

  assert.equal(state.rev, 1);
  assert.deepEqual(state.data, { meals: ["curry"] });
});

test("a write based on a stale revision is rejected", async () => {
  const store = createStore(tmpDir());
  await store.write({ x: 1 }, 0);

  await assert.rejects(
    () => store.write({ x: 2 }, 0),
    (error) => error.code === "RevMismatch" && error.currentRev === 1
  );
});

test("data survives being reopened", async () => {
  const dir = tmpDir();
  await createStore(dir).write({ dog: "fed" }, 0);

  const state = await createStore(dir).read();
  assert.deepEqual(state.data, { dog: "fed" });
  assert.equal(state.rev, 1);
});

test("subscribers are told about writes", async () => {
  const store = createStore(tmpDir());
  const seen = [];
  const unsubscribe = store.onChange((state) => seen.push(state.rev));

  await store.write({ a: 1 }, 0);
  await store.write({ a: 2 }, 1);
  unsubscribe();
  await store.write({ a: 3 }, 2);

  assert.deepEqual(seen, [1, 2]);
});

test("the first write leaves a snapshot behind", async () => {
  const store = createStore(tmpDir(), { now: fakeClock(0).now });
  await store.write({ meals: ["curry"] }, 0);

  const snapshots = await store.snapshots();
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].rev, 1);
});

test("writes within the snapshot interval do not pile up snapshots", async () => {
  const clock = fakeClock(0);
  const store = createStore(tmpDir(), { now: clock.now });

  await store.write({ n: 1 }, 0);
  clock.advance(5 * 60 * 1000);
  await store.write({ n: 2 }, 1);
  clock.advance(5 * 60 * 1000);
  await store.write({ n: 3 }, 2);

  assert.equal((await store.snapshots()).length, 1);
});

test("a write after the snapshot interval takes a fresh snapshot", async () => {
  const clock = fakeClock(0);
  const store = createStore(tmpDir(), { now: clock.now });

  await store.write({ n: 1 }, 0);
  clock.advance(HOUR + 1000);
  await store.write({ n: 2 }, 1);

  assert.equal((await store.snapshots()).length, 2);
});

test("restoring brings back an earlier version as a new revision", async () => {
  const clock = fakeClock(0);
  const store = createStore(tmpDir(), { now: clock.now });

  await store.write({ meals: ["curry"] }, 0);
  const [firstSnapshot] = await store.snapshots();

  clock.advance(HOUR + 1000);
  await store.write({ meals: [] }, 1);

  const restored = await store.restore(firstSnapshot.id);

  assert.deepEqual(restored.data, { meals: ["curry"] });
  // Restoring moves forward, it does not rewind the revision counter --
  // otherwise connected phones would think they were ahead of the server.
  assert.equal(restored.rev, 3);
});

test("restoring an unknown snapshot fails loudly", async () => {
  const store = createStore(tmpDir());
  await assert.rejects(() => store.restore("no-such-snapshot"), /not found/i);
});

test("snapshots are listed newest first", async () => {
  const clock = fakeClock(0);
  const store = createStore(tmpDir(), { now: clock.now });

  await store.write({ n: 1 }, 0);
  clock.advance(HOUR + 1000);
  await store.write({ n: 2 }, 1);

  const snapshots = await store.snapshots();
  assert.equal(snapshots.length, 2);
  assert.ok(snapshots[0].takenAt > snapshots[1].takenAt);
});

test("old snapshots are pruned to hourly for two days and daily beyond", async () => {
  const clock = fakeClock(0);
  const store = createStore(tmpDir(), { now: clock.now });

  // Twenty days of hourly writes.
  let rev = 0;
  for (let hour = 0; hour < 24 * 20; hour += 1) {
    await store.write({ hour }, rev);
    rev += 1;
    clock.advance(HOUR + 1000);
  }

  const snapshots = await store.snapshots();
  // 48 hourly + at most 14 daily, never the full 480.
  assert.ok(snapshots.length <= 62, `expected <= 62 snapshots, got ${snapshots.length}`);
  assert.ok(snapshots.length >= 48, `expected >= 48 snapshots, got ${snapshots.length}`);
});

test("concurrent writes do not interleave or lose data", async () => {
  const store = createStore(tmpDir());
  await store.write({ n: 0 }, 0);

  // Only one of these carries the correct revision, so exactly one wins.
  const results = await Promise.allSettled([
    store.write({ n: 1 }, 1),
    store.write({ n: 2 }, 1),
    store.write({ n: 3 }, 1),
  ]);

  const fulfilled = results.filter((r) => r.status === "fulfilled");
  assert.equal(fulfilled.length, 1);
  assert.equal((await store.read()).rev, 2);
});

test("a corrupt data file does not take the store down", async () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, "household.json"), "{ this is not json");

  const state = await createStore(dir).read();
  assert.equal(state.rev, 0);
  assert.equal(state.data, null);
});
