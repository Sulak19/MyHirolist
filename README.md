# MyHiroList

A household dashboard — meals, weekend prep, shopping, cleaning, dog food,
fridge inventory, batch cooking, recipes — that runs as a Home Assistant
add-on.

No Supabase, no Vercel, no accounts anywhere. The data lives in Home
Assistant, gets backed up with Home Assistant, and is reachable wherever
Home Assistant is.

## Installing it

1. In Home Assistant, go to **Settings → Add-ons → Add-on Store**.
2. Top-right **⋮ → Repositories**, paste:
   `https://github.com/Sulak19/MyHirolist`, click **Add**, then **Close**.
3. The **MyHiroList** add-on now appears in the store. Click it → **Install**.
   (First install takes a minute or two while it downloads.)
4. Click **Start**, and turn on **Show in sidebar**.
5. Turn on **Auto update** on the same page — that is what makes her changes
   arrive on their own.

It then shows up in the Home Assistant sidebar, on the phone app too.

## Options

| Option | Default | What it does |
|---|---|---|
| `sync_shopping_list` | `true` | Mirrors the shopping list to Home Assistant's own to-do list, both ways. Turn off to keep the app's list private to the app. |
| `log_level` | `info` | Set to `debug` when something needs diagnosing. |

## What it adds to Home Assistant

**Sensors**, refreshed every minute:

- `sensor.myhirolist_shopping_list` — unchecked items
- `sensor.myhirolist_cleaning_due` — tasks due, with the names as an attribute
- `sensor.myhirolist_dog_food_days_left` — days until the first dog runs out
- `sensor.myhirolist_expiring_soon` — items within three days of expiry
- `sensor.myhirolist_low_stock` — anything flagged low

**Shopping list**: the app and `todo.shopping_list` stay in step, so "add
milk to the shopping list" said to a voice assistant shows up in the app.

Dashboard cards and an hourly update-check automation are in
[`docs/homeassistant/`](docs/homeassistant/).

## Photo scan

The scan buttons appear only once Home Assistant has an **AI Task** entity.
Set one up under **Settings → Devices & Services → Add Integration** — a
local Ollama vision model works, as does a cloud provider. The add-on asks
Home Assistant to do the work, so no API key is ever stored here.

Until then the buttons stay hidden rather than failing when pressed.

## Changing the app

See **[docs/FOR-HER.md](docs/FOR-HER.md)** — the plain-English version.

Gone wrong? **[docs/ROLLBACK.md](docs/ROLLBACK.md)**.

## How it is put together

- `myhirolist/app/` — the React app. `src/App.jsx` is the whole interface.
- `myhirolist/server/` — a small Node server, no dependencies, that holds the
  data at `/data/household.json` and talks to Home Assistant.
- `docs/superpowers/specs/` — why it is built this way.

Every push to `main` runs the tests, builds the app, and publishes a new
add-on version. If any of that fails, nothing is published and Home
Assistant keeps running the last working version.
