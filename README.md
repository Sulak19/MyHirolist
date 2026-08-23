# MyHiroList

A household dashboard — meals, weekend prep, shopping, cleaning, dog food,
fridge inventory, batch cooking, recipes — that runs as a Home Assistant
add-on.

No Supabase, no Vercel, no accounts anywhere. The data lives in Home
Assistant, gets backed up with Home Assistant, and is reachable wherever
Home Assistant is.

## Installing it

1. In Home Assistant, go to **Settings → Apps** (Home Assistant renamed
   Add-ons to Apps; older docs still say Add-ons), then the **store**
   button at the bottom right. Or go straight to `/hassio/store`.
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
| `sync_calendar` | `true` | Puts dinners, cleaning due dates, and food expiry on a calendar. |
| `calendar_entity` | `calendar.home_base` | Which calendar to write to. See below. |
| `today_calendars` | *(empty)* | Which calendars the Home tab reads. Empty = just Home Base. `all` = every calendar. Or a comma-separated list. |
| `log_level` | `info` | Set to `debug` when something needs diagnosing. |

## The calendar

Anything with a date goes on a calendar; anything that is just a list stays a
to-do list. So dinners, chores, and expiry dates are calendar events, while
the shopping list stays on `todo.shopping_list` where voice already works.

**Set it up once:** Settings → Devices & Services → **Add Integration** →
**Local Calendar** → name it **Home Base**. That creates
`calendar.home_base`, which is what the add-on writes to by default. Restart
the add-on afterwards.

Give it its own calendar rather than pointing it at one you already use. The
add-on deletes and rewrites its own events as things change, and a calendar
it owns outright cannot take anything of yours with it.

What lands there:

- **Dinners** — this week's plan, on the matching weekday.
- **Cleaning** — each task on the date it is *next* due, not merely "today".
  Marking one done moves its event forward automatically. "As needed" tasks
  have no date, so they stay off the calendar.
- **Expiring food** — anything in the kitchen inventory with an expiry date.

It is a one-way mirror. The app is the place to make changes; edits made to
the events themselves are overwritten on the next sync.

The Home tab also reads **today's events back out of Home Assistant**. By
default just this calendar; set `today_calendars` to `all`, or to a list, if
you want bin collections and the like to show there too.

## What it adds to Home Assistant

**Sensors**, refreshed every minute:

- `sensor.myhirolist_dinner_tonight` / `_dinner_tomorrow` — expose these to
  Assist and ask *"what's for dinner?"*
- `sensor.myhirolist_today` — one readable sentence covering dinner, chores,
  shopping and expiry, for a morning notification
- `sensor.myhirolist_shopping_list` — unchecked items
- `sensor.myhirolist_cleaning_due` — tasks due, with the names as an attribute
- `sensor.myhirolist_dog_food_days_left` — days until the first dog runs out
- `sensor.myhirolist_expiring_soon` — items within three days of expiry
- `sensor.myhirolist_low_stock` — anything flagged low

**Shopping list**: the app and `todo.shopping_list` stay in step, so "add
milk to the shopping list" said to a voice assistant shows up in the app.

**Calendar**: `calendar.home_base` carries dinners, cleaning due dates, and
food expiry, so they appear on dashboards and in Assist alongside everything
else.

A complete native dashboard (`dashboard.yaml`), example automations, and
an hourly update-check automation are in
[`docs/homeassistant/`](docs/homeassistant/).

### Making it the default view

The app is already a sidebar panel, so it is always one tap away. To make it
what Home Assistant *opens to*, use the native dashboard above: paste
`dashboard.yaml` into a new dashboard, then click your name (bottom-left) →
**Default dashboard** → pick it. That is per-device, so a kitchen tablet can
land there while a phone keeps the normal view.

Do **not** use a "Webpage" dashboard or an iframe card pointed at the ingress
URL. Home Assistant sends `X-Frame-Options: SAMEORIGIN` on its own pages, so
that shows "refused to connect" rather than the app.

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
