# MyHiroList HA Add-on Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the household app as a Home Assistant add-on installed from a GitHub repo, where a non-developer can edit the repo and have Home Assistant update itself.

**Architecture:** The repo is an HA add-on repository. The add-on container serves the built Vite app plus a dependency-free Node server that owns `/data/household.json` and bridges to Home Assistant through the Supervisor proxy. GitHub Actions builds and publishes the image; HA pulls it.

**Tech Stack:** Node 20 (server, no runtime deps), Vite + React 18 (app, unchanged), Docker (HA base images), GitHub Actions, GHCR.

**Spec:** `docs/superpowers/specs/2026-08-23-myhirolist-ha-addon-design.md`

## Global Constraints

- **No runtime npm dependencies in the server.** Node built-ins only. Tests use `node:test`.
- **No Supabase, no Vercel, no external accounts.** Anything reaching outside the house goes through Home Assistant.
- **No secrets in the repo.** The scan feature uses HA AI Task; no API key is ever stored here.
- **`App.jsx` is not restructured.** Exactly one line changes (its import).
- **Add-on version format:** `1.0.<github.run_number>`, stamped by CI, never hand-edited.
- **Node version:** 20 or later, both in the image and in CI.
- **Ingress-safe paths:** all client fetches are relative (`./api/...`), never absolute (`/api/...`), because ingress serves the app from a path prefix.
- **A failed build must never publish.** Image push happens only after the app build succeeds.

---

## File Structure

| File | Responsibility |
|---|---|
| `repository.yaml` | Tells HA this repo is an add-on repository |
| `myhirolist/config.yaml` | Add-on manifest: ingress, options, permissions, version |
| `myhirolist/build.yaml` | Per-architecture base images |
| `myhirolist/Dockerfile` | Build app, assemble runtime |
| `myhirolist/run.sh` | Entrypoint: read options, exec server |
| `myhirolist/server/store.js` | The blob, rev guard, snapshots. Pure, testable. |
| `myhirolist/server/ha.js` | Supervisor proxy: sensors, AI Task, to-do list |
| `myhirolist/server/sync.js` | Shopping list reconciliation. Pure, testable. |
| `myhirolist/server/index.js` | HTTP: routes, SSE, static files |
| `myhirolist/server/test/*.test.js` | `node:test` suites for store and sync |
| `myhirolist/app/src/lib/api.js` | Replaces `supabase.js`, same four exports |
| `.github/workflows/build.yml` | Version bump, build, publish, release |
| `.github/workflows/preview.yml` | GitHub Pages UI preview |
| `docs/FOR-HER.md` | Plain-English change-and-publish guide |
| `docs/ROLLBACK.md` | Code and data rollback |
| `docs/homeassistant/` | Sensors, cards, auto-update automation |

---

### Task 1: Repository skeleton

**Files:**
- Create: `repository.yaml`, `.gitignore`, `README.md`, `myhirolist/CHANGELOG.md`

**Interfaces:**
- Produces: a git repo HA recognises as an add-on repository.

- [ ] **Step 1: Write `repository.yaml`**

```yaml
name: MyHiroList
url: https://github.com/Sulak19/MyHirolist
maintainer: Sulak19
```

- [ ] **Step 2: Write `.gitignore`**

Must cover `node_modules/`, `dist/`, `.env`, `.DS_Store`.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: add-on repository skeleton"
```

---

### Task 2: Carry the app over

**Files:**
- Create: `myhirolist/app/` from `../home-base-app/`
- Modify: `myhirolist/app/package.json` (drop `vite-plugin-pwa`, `@supabase/supabase-js`)
- Modify: `myhirolist/app/vite.config.js` (drop PWA plugin, set `base: './'`)
- Modify: `myhirolist/app/src/App.jsx:24` (import path only)
- Delete: `myhirolist/app/src/lib/supabase.js`
- Create: `myhirolist/app/src/lib/api.js`

**Interfaces:**
- Produces: `loadHouseholdData()`, `saveHouseholdData(data)`, `subscribeToHouseholdData(cb)`, `scanImageWithClaude(base64, prompt)`, `getCapabilities()`.

`base: './'` is load-bearing — ingress serves from a prefixed path, so absolute asset URLs 404.

- [ ] **Step 1: Copy app, strip Supabase and PWA**
- [ ] **Step 2: Write `api.js` with the five exports above**

`saveHouseholdData` sends `{rev, data}` and on HTTP 409 refetches, replays onto fresh state, retries once.
`subscribeToHouseholdData` opens `EventSource('./api/events')` and returns an unsubscribe.

- [ ] **Step 3: Verify the app still builds**

Run: `cd myhirolist/app && npm install && npm run build`
Expected: `dist/` produced, no Supabase in the bundle.

- [ ] **Step 4: Commit**

---

### Task 3: The store (TDD)

**Files:**
- Create: `myhirolist/server/store.js`, `myhirolist/server/test/store.test.js`

**Interfaces:**
- Produces: `createStore(dir)` returning `{read(), write(data, expectedRev), snapshots(), restore(id), onChange(cb)}`.
- `write` throws `RevMismatch` when `expectedRev !== current.rev`.

- [ ] **Step 1: Write failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { createStore } from '../store.js';

test('write increments rev', async () => {
  const s = createStore(tmp());
  const a = await s.write({ x: 1 }, 0);
  assert.equal(a.rev, 1);
});

test('stale rev is rejected', async () => {
  const s = createStore(tmp());
  await s.write({ x: 1 }, 0);
  await assert.rejects(() => s.write({ x: 2 }, 0), /RevMismatch/);
});

test('restore brings back an earlier snapshot', async () => {
  const s = createStore(tmp());
  await s.write({ meals: ['a'] }, 0);
  const [snap] = await s.snapshots();
  await s.write({ meals: [] }, 1);
  await s.restore(snap.id);
  assert.deepEqual((await s.read()).data.meals, ['a']);
});
```

- [ ] **Step 2: Run, confirm failure** — `node --test server/test/`
- [ ] **Step 3: Implement `store.js`** — atomic write via temp file + rename; snapshot when newest is older than 1h; prune to 48 hourly + 14 daily.
- [ ] **Step 4: Run, confirm pass**
- [ ] **Step 5: Commit**

---

### Task 4: HTTP server and SSE

**Files:**
- Create: `myhirolist/server/index.js`

**Interfaces:**
- Consumes: `createStore` from Task 3.
- Produces: routes in the spec's table; serves `dist/` for everything else.

- [ ] **Step 1: Implement routes and static serving**
- [ ] **Step 2: Smoke test locally**

```bash
DATA_DIR=./tmp node server/index.js &
curl -s localhost:8099/api/data
curl -s -X PUT localhost:8099/api/data -d '{"rev":0,"data":{"x":1}}'
curl -sN localhost:8099/api/events &   # expect an event after the next write
```

- [ ] **Step 3: Verify SSE is not buffered through ingress** — install once on the real HA and confirm a change on one phone appears on the other. Fall back to 5s polling in `api.js` if buffered.
- [ ] **Step 4: Commit**

---

### Task 5: Home Assistant bridge

**Files:**
- Create: `myhirolist/server/ha.js`

**Interfaces:**
- Produces: `publishSensors(summary)`, `probeAiTask()`, `scan(base64, prompt)`, `getTodoItems()`, `addTodoItem(name)`, `completeTodoItem(uid)`.
- All calls go to `http://supervisor/core/api/...` with `Authorization: Bearer ${SUPERVISOR_TOKEN}`.

- [ ] **Step 1: Implement, with every call wrapped so HA being unreachable degrades rather than crashes**
- [ ] **Step 2: `GET /api/capabilities` reports `{aiTask: bool, todo: bool}`; client hides scan buttons when false**
- [ ] **Step 3: Commit**

---

### Task 6: Container

**Files:**
- Create: `myhirolist/Dockerfile`, `myhirolist/build.yaml`, `myhirolist/config.yaml`, `myhirolist/run.sh`

`config.yaml` requires: `ingress: true`, `ingress_port: 8099`, `hassio_api: true`, `homeassistant_api: true`, `map: [] ` (uses `/data` only), options `sync_shopping_list` and `log_level`.

- [ ] **Step 1: Multi-stage Dockerfile** — stage 1 builds the app, stage 2 is the HA base image plus nodejs, server, and `dist/`.
- [ ] **Step 2: Build locally** — `docker build -t myhirolist-test myhirolist/`
- [ ] **Step 3: Commit**

---

### Task 7: CI

**Files:**
- Create: `.github/workflows/build.yml`, `.github/workflows/preview.yml`

- [ ] **Step 1: `build.yml`** — on push to main: compute `1.0.${{github.run_number}}`, write into `config.yaml`, build multi-arch via `home-assistant/builder`, push to GHCR, commit the bump with `[skip ci]`, create a release tag.
- [ ] **Step 2: `preview.yml`** — build with `VITE_PREVIEW=1`, deploy `dist/` to Pages.
- [ ] **Step 3: Confirm a deliberately broken commit fails before the push step**
- [ ] **Step 4: Commit**

---

### Task 8: Documentation and HA glue

**Files:**
- Create: `docs/FOR-HER.md`, `docs/ROLLBACK.md`, `docs/homeassistant/auto_update_automation.yaml`, `docs/homeassistant/dashboard_cards.yaml`

- [ ] **Step 1: Write them, in plain English, no jargon**
- [ ] **Step 2: Commit**

---

### Task 9: Shopping list two-way sync (last, riskiest)

**Files:**
- Create: `myhirolist/server/sync.js`, `myhirolist/server/test/sync.test.js`

**Interfaces:**
- Produces: `reconcile(appItems, todoItems, mapping)` returning `{toAdd, toComplete, toRemove, mapping}`. Pure function — no I/O, fully testable.

- [ ] **Step 1: Write failing tests** covering: new app item pushes to HA; new HA item pulls into app; completing on either side propagates; an item added and removed twice does not duplicate; the same name on both sides collapses to one mapping.
- [ ] **Step 2: Run, confirm failure**
- [ ] **Step 3: Implement `reconcile`**
- [ ] **Step 4: Run, confirm pass**
- [ ] **Step 5: Wire into `index.js` behind the `sync_shopping_list` option, defaulting on**
- [ ] **Step 6: Commit**

---

## Self-Review

**Spec coverage:** storage format → Task 3; server routes → Tasks 4-5; client changes → Task 2; photo scan → Task 5; code rollback → Tasks 7-8; data rollback → Task 3; update latency → Task 8; preview → Task 7; native shopping list → Task 9; sensors → Task 5. No gaps.

**Placeholder scan:** none.

**Type consistency:** `createStore` shape is used identically in Tasks 3 and 4. `reconcile` appears only in Task 9. Client export names in Task 2 match the four the spec requires plus `getCapabilities`, consumed in Task 5.
