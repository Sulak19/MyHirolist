import { mergeChanges, sameValue } from "./changes.js";

// Keep local intentions until their write is acknowledged. Incoming events
// cannot replace unsaved ticks, and Undo can reverse an in-flight write.
export function createSession({ write, publish, status, normalize = (x) => x }) {
  let server = null, revision = -1, view = null, pending = [], running = false;
  const render = () => {
    const raw = pending.reduce((value, change) => mergeChanges(change.before, change.after, value), server);
    const next = normalize(raw);
    if (!sameValue(raw, next)) pending.push({ before: raw, after: next });
    if (!sameValue(view, next)) { view = next; publish(next); }
  };
  const receive = (data, rev) => {
    if (rev < revision) return;
    server = data; revision = rev; render();
  };
  return {
    receive,
    edit(updater) {
      const next = normalize(typeof updater === "function" ? updater(view) : updater);
      if (sameValue(view, next)) return;
      pending.push({ before: view, after: next });
      view = next; publish(next); status("saving", "");
    },
    async flush() {
      if (running || !pending.length) return;
      running = true;
      try {
        while (pending.length) {
          const batch = pending.slice();
          const base = server;
          const desired = normalize(batch.reduce((value, change) => mergeChanges(change.before, change.after, value), base));
          const result = await write(desired, base);
          pending = pending.slice(batch.length);
          receive(result.data, result.rev);
          render();
        }
        status("saved", "");
      } catch (error) {
        status("error", error.message || "Save failed. Try again.");
      } finally { running = false; }
    },
  };
}
