import { test } from "node:test";
import assert from "node:assert/strict";

test("saving retries conflicts with field-level merge and serialises queued saves", async () => {
  const originalFetch = globalThis.fetch;
  let server = { rev: 1, data: { shopping: [{ id: "s", checked: false }], cleaning: [{ id: "c", name: "Floor", done: false }] } };
  let conflict = true;
  let active = 0;
  let peak = 0;
  globalThis.fetch = async (_url, options) => {
    if (!options) return new Response(JSON.stringify(server));
    active++; peak = Math.max(active, peak);
    await new Promise((r) => setTimeout(r, 1));
    const body = JSON.parse(options.body);
    if (conflict) { server = { rev: 2, data: { ...server.data, cleaning: [{ id: "c", name: "Floor", done: true }] } }; conflict = false; }
    active--;
    if (body.rev !== server.rev) return new Response(JSON.stringify(server), { status: 409 });
    server = { rev: server.rev + 1, data: body.data };
    return new Response(JSON.stringify({ rev: server.rev }));
  };
  try {
    const api = await import("./api.js");
    const base = await api.loadHouseholdData();
    const results = await Promise.all([
      api.saveHouseholdData({ ...base, shopping: [{ id: "s", checked: true }] }, base),
      api.saveHouseholdData({ ...base, shopping: [{ id: "s", checked: true }, { id: "new", checked: false }] }, base),
    ]);
    assert.equal(server.data.cleaning[0].done, true);
    assert.equal(server.data.shopping[0].checked, true);
    assert.equal(server.data.shopping.length, 2);
    assert.equal(peak, 1);
    assert.deepEqual(results[1].data, server.data);
  } finally { globalThis.fetch = originalFetch; }
});
