// Owns the household data: one JSON blob, a revision counter, and snapshots.
//
// Deliberately has no idea that HTTP or Home Assistant exist, so it can be
// tested on its own.

import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";

const SNAPSHOT_INTERVAL_MS = 60 * 60 * 1000; // one an hour, at most
const HOURLY_WINDOW_MS = 48 * 60 * 60 * 1000; // keep every one for two days
const DAILY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // then one a day for a fortnight
const DAY_MS = 24 * 60 * 60 * 1000;

const EMPTY = { rev: 0, updatedAt: null, data: null };

export function createStore(dir, options = {}) {
  const now = options.now ?? (() => Date.now());
  const snapshotIntervalMs = options.snapshotIntervalMs ?? SNAPSHOT_INTERVAL_MS;

  const dataFile = path.join(dir, "household.json");
  const snapshotDir = path.join(dir, "snapshots");

  const listeners = new Set();

  // Writes are serialised through this chain. Without it, two overlapping
  // writes could both read the same revision and both think they won.
  let queue = Promise.resolve();

  let cache = null;

  fsSync.mkdirSync(snapshotDir, { recursive: true });

  async function readFromDisk() {
    try {
      const raw = await fs.readFile(dataFile, "utf8");
      const parsed = JSON.parse(raw);
      if (typeof parsed?.rev !== "number") return { ...EMPTY };
      return { rev: parsed.rev, updatedAt: parsed.updatedAt ?? null, data: parsed.data ?? null };
    } catch {
      // Missing or corrupt. Either way the honest answer is "nothing yet" --
      // refusing to start would leave the household with no app at all.
      return { ...EMPTY };
    }
  }

  async function read() {
    if (!cache) cache = await readFromDisk();
    return cache;
  }

  async function writeAtomic(file, contents) {
    const temp = `${file}.tmp`;
    await fs.writeFile(temp, contents, "utf8");
    await fs.rename(temp, file);
  }

  function parseSnapshotName(name) {
    // <takenAt>-r<rev>.json
    const match = /^(\d+)-r(\d+)\.json$/.exec(name);
    if (!match) return null;
    return { id: name.replace(/\.json$/, ""), takenAt: Number(match[1]), rev: Number(match[2]) };
  }

  async function snapshots() {
    let names;
    try {
      names = await fs.readdir(snapshotDir);
    } catch {
      return [];
    }
    return names
      .map(parseSnapshotName)
      .filter(Boolean)
      .sort((a, b) => b.takenAt - a.takenAt);
  }

  // Keep every snapshot for two days, then one per day for a fortnight.
  function selectForDeletion(existing, nowMs) {
    const keptDays = new Set();
    const doomed = [];

    for (const snapshot of existing) {
      const age = nowMs - snapshot.takenAt;

      if (age <= HOURLY_WINDOW_MS) continue;

      if (age > DAILY_WINDOW_MS) {
        doomed.push(snapshot);
        continue;
      }

      const day = Math.floor(snapshot.takenAt / DAY_MS);
      if (keptDays.has(day)) doomed.push(snapshot);
      else keptDays.add(day);
    }

    return doomed;
  }

  async function maybeSnapshot(state) {
    const existing = await snapshots();
    const newest = existing[0];
    const nowMs = now();

    if (newest && nowMs - newest.takenAt < snapshotIntervalMs) return;

    const id = `${nowMs}-r${state.rev}`;
    await writeAtomic(path.join(snapshotDir, `${id}.json`), JSON.stringify(state));

    const doomed = selectForDeletion([{ id, takenAt: nowMs, rev: state.rev }, ...existing], nowMs);
    await Promise.all(
      doomed.map((snapshot) =>
        fs.unlink(path.join(snapshotDir, `${snapshot.id}.json`)).catch(() => {})
      )
    );
  }

  function notify(state) {
    for (const listener of listeners) {
      try {
        listener(state);
      } catch {
        // A broken subscriber must not break the write that triggered it.
      }
    }
  }

  // Runs `task` once every earlier write has finished.
  function enqueue(task) {
    const result = queue.then(task, task);
    // Keep the chain alive even when a task rejects, or every later write
    // would inherit that rejection.
    queue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  async function commit(data, expectedRev) {
    const current = await read();

    if (expectedRev !== current.rev) {
      const error = new Error(
        `RevMismatch: expected revision ${expectedRev}, store is at ${current.rev}`
      );
      error.code = "RevMismatch";
      error.currentRev = current.rev;
      throw error;
    }

    const next = {
      rev: current.rev + 1,
      updatedAt: new Date(now()).toISOString(),
      data,
    };

    await writeAtomic(dataFile, JSON.stringify(next));
    cache = next;

    await maybeSnapshot(next);
    notify(next);

    return next;
  }

  return {
    read,

    write(data, expectedRev) {
      return enqueue(() => commit(data, expectedRev));
    },

    snapshots,

    async restore(id) {
      return enqueue(async () => {
        let raw;
        try {
          raw = await fs.readFile(path.join(snapshotDir, `${id}.json`), "utf8");
        } catch {
          throw new Error(`Snapshot not found: ${id}`);
        }

        const snapshot = JSON.parse(raw);
        const current = await read();

        // Restoring moves the revision forward rather than rewinding it.
        // Rewinding would leave connected phones believing they were ahead
        // of the server, and their next save would be rejected forever.
        return commit(snapshot.data, current.rev);
      });
    },

    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
