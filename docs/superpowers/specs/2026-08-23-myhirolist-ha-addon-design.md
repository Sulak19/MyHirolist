# MyHiroList — Home Assistant add-on

**Date:** 2026-08-23
**Status:** approved, in implementation

## Purpose

Take the household app ("Home Base") and turn it into something a non-developer can keep improving from a GitHub repo, where the changes reach Home Assistant on their own. No third-party accounts.

Two people, two phones, one household dataset: meal planning, weekend prep, shopping, cleaning schedule, dog food, fridge inventory, batch cooking, recipes.

## Constraints

These came from the user and are not negotiable without a new decision:

1. **No Supabase.** The original app stored its data there. Removed.
2. **No development on the user's PC.** The partner connects Claude to the GitHub repo and works there. She cannot run a build, a dev server, or a test.
3. **Home Assistant OS**, reachable from outside the house.
4. **Reuse her code.** `App.jsx` is ~2,900 lines of working UI. It is carried over as-is.
5. **Version control that permits rollback**, for both code and data.

## Architecture

The repository is a Home Assistant **add-on repository**. The user adds its URL to the Add-on Store once. From then on, install and update are buttons in Home Assistant.

```
Partner edits repo ──> GitHub Actions builds image ──> GHCR
                                                        │
                          HA update check (hourly) <────┘
                                                        │
                                            HA sidebar panel (ingress)
```

Inside the add-on container:

- the built static app, served over HTTP
- a small Node server owning `/data/household.json`
- a bridge to Home Assistant via the Supervisor proxy

`/data` is persistent across add-on restarts and updates, and is included in Home Assistant's own backups.

### Why an add-on rather than external hosting

- **Auth is free.** Ingress means HA has already authenticated the viewer. No tokens stored in a browser, no anon key shipped to the client.
- **Both phones already have it.** It is a sidebar entry in the HA companion app, working away from home through existing external access. No second app to install, no second login.
- **Backups are free.** `/data` rides along in HA backups.

The accepted cost: HA polls for add-on updates on its own cycle, so a push is not instantly live. Mitigated with an hourly forced update check (see Rollback and updates).

## Data ownership

Split by what Home Assistant already does natively.

| Data | Home | Reason |
|---|---|---|
| Shopping list | `todo.shopping_list` (native HA) | Already exists in this HA. Voice, dashboards, and the app then share one list. |
| Meals, prep, cleaning, dog food, fridge, batch, recipes | `/data/household.json` | No native equivalent. |
| Dog food days left, cleaning due count, shopping count | HA sensors, published by the add-on | Read-only, so automations and dashboards keep working. |

Cleaning deliberately stays app-side. Its recurring-schedule logic (`isDue`, `daysOverdue`) has no native counterpart, and flattening it into a to-do entity would lose the schedule.

### Storage format

One JSON blob, matching how the app already treats its state:

```json
{ "rev": 41, "updatedAt": "2026-08-23T10:04:00Z", "data": { } }
```

`rev` is a monotonic counter. A `PUT` carries the rev the client last saw; a mismatch returns 409 and the client re-syncs before retrying. This is what stops two phones editing at once from silently clobbering each other — the original Supabase version was last-write-wins.

## The server

Plain Node, no runtime dependencies. Endpoints, all behind ingress:

| Route | Purpose |
|---|---|
| `GET /api/data` | Current blob and rev |
| `PUT /api/data` | Write, guarded by rev |
| `GET /api/events` | Server-sent events; pushes `{rev, data}` on change |
| `POST /api/scan` | Image to structured data, via HA AI Task |
| `GET /api/capabilities` | What this install can actually do |
| `GET /api/snapshots` | List restore points |
| `POST /api/snapshots/:id/restore` | Restore one |

**Server-sent events, not WebSockets**, for live sync between the two phones. SSE is a plain long-lived HTTP response, so it needs no dependency and passes through ingress as ordinary traffic.

## Client changes

`src/lib/supabase.js` is replaced by `src/lib/api.js` exporting the same four names — `loadHouseholdData`, `saveHouseholdData`, `subscribeToHouseholdData`, `scanImageWithClaude`. `App.jsx` changes on one line: its import. The UI is otherwise untouched.

**`vite-plugin-pwa` is removed.** Under ingress, URLs carry rotating tokens; a service worker caching against them is the standard cause of "the update is live but my phone shows the old app." The HA sidebar replaces the home-screen icon, so the PWA earns nothing and costs staleness bugs.

## Photo scan

The original called an Anthropic key held in a Supabase Edge Function. Replaced with Home Assistant's **AI Task** (`ai_task.generate_data`), called through the Supervisor proxy.

This means the user picks the brain in HA's own UI — a local Ollama vision model, or a cloud provider — and can change it later without the app changing. No API key in the repo, the image, or the browser.

**AI Task is not yet configured on this HA.** The feature is therefore built to degrade: on start the server probes for an AI Task entity and reports capability at `GET /api/capabilities`. The client hides the scan buttons when it is absent. Nothing errors, nothing half-works.

If AI Task turns out to be unavailable long-term, the offline fallback is bundling Tesseract OCR in the image — fully local, adequate on printed receipts, poor on handwriting. Not built now.

## Rollback and updates

### Code

Versions are `1.0.<build number>`, monotonic, stamped into `config.yaml` by CI and committed back with `[skip ci]`. Every build is tagged as a GitHub release, so any past version is identifiable.

**Rolling back is a revert, not a downgrade.** Home Assistant expects versions to move forward, so the supported path is: revert the bad commit on GitHub, which publishes a *new* version containing the *old* code. One action in the GitHub UI, and it uses the same update path as any other change. Documented in `docs/ROLLBACK.md`.

### Data

The server snapshots `household.json` before each write when the last snapshot is over an hour old, keeping hourly snapshots for 48 hours and daily ones for 14 days, in `/data/snapshots/`. Restores are available from the app itself, so recovering a wiped meal plan does not require restoring an entire Home Assistant backup.

### Update latency

An HA automation forces an update check hourly, so worst case is about an hour and the typical case is minutes. Shipped as `docs/homeassistant/auto_update_automation.yaml`.

## Safety properties

- **She cannot take the app down.** If her change fails to build, CI never publishes an image and HA keeps running the last good version.
- **She can see her work.** Every push deploys a GitHub Pages preview of the UI, backed by throwaway local storage rather than real data, because she cannot run a build in the browser.
- **Concurrent edits do not clobber.** The `rev` guard.
- **Bad data is recoverable.** Snapshots.

## Repository layout

```
repository.yaml              add-on repository metadata
README.md
docs/
  FOR-HER.md                 plain-English guide to changing and publishing
  ROLLBACK.md
  homeassistant/             dashboard cards, sensors, auto-update automation
  superpowers/specs/         this document
.github/workflows/
  build.yml                  version bump, image build, GHCR publish, release tag
  preview.yml                GitHub Pages UI preview
myhirolist/
  config.yaml                add-on manifest: ingress, options, permissions
  build.yaml                 per-architecture base images
  Dockerfile                 build app, assemble runtime
  CHANGELOG.md
  server/                    Node server, no dependencies
  app/                       her Vite app
```

## Out of scope

- Meal plan to native HA `calendar` — a good fit, worth doing later.
- Cleaning as a second to-do list.
- Tesseract OCR fallback.
- Any redesign of her UI.

## Risks

| Risk | Handling |
|---|---|
| Two-way shopping sync loops or duplicates | Server is sole reconciler; app-item-to-todo-uid mapping persisted; behind a `sync_shopping_list` option that can be switched off. Built last. |
| SSE buffered by the ingress proxy | Verify early against real HA; fall back to short polling if buffered. |
| CI version bump commit retriggering CI | `[skip ci]` plus `paths-ignore`. |
| Sensors set via the REST API are transient across HA restarts | Republished on a timer and on change. |
