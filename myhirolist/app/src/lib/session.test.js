import test from "node:test";
import assert from "node:assert/strict";
import { createSession } from "./session.js";

test("Undo during a save survives its acknowledgement and remote edits", async () => {
  let view, resolve, calls = 0;
  const session = createSession({ publish: x => { view = x; }, status() {},
    write: async (data) => {
      calls++;
      if (calls === 1) return new Promise(r => { resolve = r; });
      return { data, rev: 4 };
    },
  });
  session.receive({ checked: false, title: "old" }, 1);
  session.edit(x => ({ ...x, checked: true }));
  const saving = session.flush();
  session.edit(x => ({ ...x, checked: false }));
  session.receive({ checked: true, title: "partner" }, 3);
  resolve({ data: { checked: true, title: "old" }, rev: 2 });
  await saving;
  assert.deepEqual(view, { checked: false, title: "partner" });
  assert.equal(calls, 2);
});

test("failed writes retain local edits for Retry", async () => {
  let view, calls = 0, state;
  const session = createSession({ publish: x => { view = x; }, status: x => { state = x; },
    write: async data => { if (++calls === 1) throw Error("offline"); return { data, rev: 3 }; },
  });
  session.receive({ checked: false, title: "old" }, 1);
  session.edit(x => ({ ...x, checked: true }));
  await session.flush();
  assert.equal(state, "error");
  session.receive({ checked: false, title: "partner" }, 2);
  await session.flush();
  assert.deepEqual(view, { checked: true, title: "partner" });
  assert.equal(state, "saved");
});

test("normalized migrations and rollover are persisted even without a user edit", async () => {
  let saved;
  const session = createSession({ publish() {}, status() {}, normalize: x => ({ ...x, version: 2 }),
    write: async data => { saved = data; return { data, rev: 2 }; },
  });
  session.receive({ version: 1 }, 1);
  await session.flush();
  assert.deepEqual(saved, { version: 2 });
});
