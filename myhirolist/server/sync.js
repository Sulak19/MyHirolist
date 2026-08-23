// Mirrors the app's shopping list into Home Assistant's own to-do list, both
// ways, so that voice assistants, HA dashboards, and the app all edit one
// list.
//
// This is the riskiest part of the add-on: a sloppy two-way sync duplicates
// items forever. The rules that keep it honest:
//
//   * `reconcile` is pure. All the tricky decisions are testable without a
//     store, a network, or Home Assistant.
//   * A persisted mapping remembers what was mirrored last time, which is
//     what makes "deleted on one side" distinguishable from "new on the
//     other side". Without it, deleting an item just resurrects it.
//   * The app wins when both sides changed the same item. Someone has to.

import fs from "node:fs/promises";
import path from "node:path";

const normalise = (value) => String(value ?? "").trim().toLowerCase();
const statusFor = (checked) => (checked ? "completed" : "needs_action");

/**
 * Works out what to change on each side.
 *
 * @param appItems  [{ id, name, checked }]
 * @param todoItems [{ uid, summary, status }]
 * @param mapping   { [appId]: { uid, lastChecked, lastSummary } }
 */
export function reconcile(appItems = [], todoItems = [], mapping = {}) {
  const plan = {
    addToTodo: [],
    addToApp: [],
    updateTodo: [],
    updateApp: [],
    removeFromTodo: [],
    removeFromApp: [],
    mapping: {},
  };

  const todoByUid = new Map(todoItems.map((item) => [item.uid, item]));
  const claimed = new Set();

  // 1. Items we have mirrored before.
  for (const item of appItems) {
    const remembered = mapping[item.id];
    if (!remembered) continue;

    const todo = todoByUid.get(remembered.uid);

    if (!todo) {
      // It was removed in Home Assistant since last time.
      plan.removeFromApp.push({ appId: item.id });
      continue;
    }

    claimed.add(todo.uid);

    const todoChecked = todo.status === "completed";
    const appChanged = item.checked !== remembered.lastChecked;
    const todoChanged = todoChecked !== remembered.lastChecked;

    let settled = remembered.lastChecked;

    if (appChanged) {
      settled = item.checked;
      if (todoChecked !== item.checked) {
        plan.updateTodo.push({ uid: todo.uid, status: statusFor(item.checked) });
      }
    } else if (todoChanged) {
      settled = todoChecked;
      plan.updateApp.push({ appId: item.id, checked: todoChecked });
    }

    plan.mapping[item.id] = {
      uid: todo.uid,
      lastChecked: settled,
      lastSummary: String(item.name ?? "").trim(),
    };
  }

  // 2. App items we have not mirrored yet. Match by name first, so two
  //    people adding "Milk" independently end up with one entry, not two.
  const unclaimedByName = new Map();
  for (const todo of todoItems) {
    if (claimed.has(todo.uid)) continue;
    const key = normalise(todo.summary);
    if (!unclaimedByName.has(key)) unclaimedByName.set(key, []);
    unclaimedByName.get(key).push(todo);
  }

  for (const item of appItems) {
    if (mapping[item.id]) continue;

    const name = String(item.name ?? "").trim();
    const bucket = unclaimedByName.get(normalise(name));
    const match = bucket && bucket.length ? bucket.shift() : null;

    if (!match) {
      plan.addToTodo.push({ appId: item.id, summary: name });
      continue;
    }

    claimed.add(match.uid);

    if ((match.status === "completed") !== Boolean(item.checked)) {
      plan.updateTodo.push({ uid: match.uid, status: statusFor(item.checked) });
    }

    plan.mapping[item.id] = { uid: match.uid, lastChecked: Boolean(item.checked), lastSummary: name };
  }

  // 3. Mapped items whose app entry is gone were deleted in the app.
  const appIds = new Set(appItems.map((item) => item.id));
  for (const [appId, remembered] of Object.entries(mapping)) {
    if (appIds.has(appId)) continue;
    if (todoByUid.has(remembered.uid)) {
      plan.removeFromTodo.push({ uid: remembered.uid });
      claimed.add(remembered.uid);
    }
    // Either way the mapping entry is not carried forward.
  }

  // 4. Anything left in Home Assistant is new and belongs in the app.
  for (const todo of todoItems) {
    if (claimed.has(todo.uid)) continue;
    plan.addToApp.push({
      uid: todo.uid,
      summary: todo.summary,
      checked: todo.status === "completed",
    });
  }

  return plan;
}

export function createShoppingSync({ store, ha, entityId, log, dataDir = "/data", pollMs = 15000 }) {
  const mappingFile = path.join(dataDir, "shopping-sync.json");

  let mapping = {};
  let timer = null;
  let running = false;
  let pending = false;
  let stopped = false;

  async function loadMapping() {
    try {
      mapping = JSON.parse(await fs.readFile(mappingFile, "utf8"));
    } catch {
      mapping = {};
    }
  }

  async function saveMapping() {
    const temp = `${mappingFile}.tmp`;
    await fs.writeFile(temp, JSON.stringify(mapping), "utf8");
    await fs.rename(temp, mappingFile);
  }

  // Applies the app-side half of a plan in one store write, so a single
  // revision covers all of it.
  async function applyToApp(plan) {
    if (!plan.addToApp.length && !plan.updateApp.length && !plan.removeFromApp.length) return false;

    const state = await store.read();
    const data = state.data;
    if (!data) return false;

    const removed = new Set(plan.removeFromApp.map((entry) => entry.appId));
    const checkedById = new Map(plan.updateApp.map((entry) => [entry.appId, entry.checked]));

    let shopping = (Array.isArray(data.shopping) ? data.shopping : [])
      .filter((item) => !removed.has(item.id))
      .map((item) => (checkedById.has(item.id) ? { ...item, checked: checkedById.get(item.id) } : item));

    for (const incoming of plan.addToApp) {
      const appId = `ha-${incoming.uid}`;
      shopping = [{ id: appId, name: incoming.summary, checked: incoming.checked }, ...shopping];
      mapping[appId] = {
        uid: incoming.uid,
        lastChecked: incoming.checked,
        lastSummary: incoming.summary,
      };
    }

    try {
      await store.write({ ...data, shopping }, state.rev);
      return true;
    } catch (error) {
      if (error.code === "RevMismatch") {
        // Someone saved while we were deciding. The next pass sees the
        // newer state and works from that instead.
        log("debug", "shopping sync skipped a beat, a phone saved first");
        return false;
      }
      throw error;
    }
  }

  async function applyToTodo(plan) {
    for (const entry of plan.updateTodo) {
      await ha.updateTodoItem(entityId, entry.uid, entry.status);
    }
    for (const entry of plan.removeFromTodo) {
      await ha.removeTodoItem(entityId, entry.uid);
    }
    for (const entry of plan.addToTodo) {
      await ha.addTodoItem(entityId, entry.summary);
    }
    return plan.addToTodo.length > 0;
  }

  async function pass() {
    const state = await store.read();
    const appItems = Array.isArray(state.data?.shopping) ? state.data.shopping : [];
    const todoItems = await ha.getTodoItems(entityId);

    const plan = reconcile(appItems, todoItems, mapping);
    mapping = plan.mapping;

    const added = await applyToTodo(plan);
    await applyToApp(plan);
    await saveMapping();

    // Home Assistant's add_item does not hand back a uid, so anything we
    // just created has no mapping yet. One more pass matches it by name and
    // binds it, which is why the name matching in step 2 exists.
    return added;
  }

  async function runOnce() {
    if (stopped) return;
    if (running) {
      pending = true;
      return;
    }

    running = true;
    try {
      const needsSecondPass = await pass();
      if (needsSecondPass) await pass();
    } catch (error) {
      log("warn", "shopping sync failed:", error.message);
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
      await loadMapping();
      await runOnce();
      timer = setInterval(runOnce, pollMs);
      if (timer.unref) timer.unref();
    },

    // Called when a phone saves. Home Assistant is polled, but the app side
    // we already know about, so react immediately.
    onLocalChange() {
      runOnce();
    },

    stop() {
      stopped = true;
      if (timer) clearInterval(timer);
    },
  };
}
