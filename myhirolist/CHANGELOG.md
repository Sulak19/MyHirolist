## 1.0.7

feat: dinner and today sensors, plus a native HA dashboard

sensor.myhirolist_dinner_tonight and _dinner_tomorrow answer 'what's for
dinner?' through Assist once exposed. sensor.myhirolist_today is one
readable sentence - dinner, chores, shopping, expiry, dog food - for a
morning notification, with the untruncated text as an attribute since HA
caps states at 255 chars.

docs/homeassistant/dashboard.yaml is a complete native dashboard built
from these sensors, the Home Base calendar and the shopping to-do list.
On a wall tablet that beats embedding the app: instant, themed, no
iframe. The app stays one tap away for editing.

## 1.0.6

refactor(ui): quieten the chrome, gate meal prep to Friday-Sunday

- The save bar announced 'Saving...' and 'Saved' constantly, which says
  nothing the user had not already assumed. It now appears only when a
  save actually fails, which is the case worth interrupting for.
- 'restore an earlier version' moved from under the header to the foot of
  the app: still reachable, no longer competing with the content. It also
  remains in the error boundary, which is where it matters most.
- Meal prep suggestions only show Friday to Sunday. Prep is a weekend
  job, so nagging about it on a Tuesday is noise.

## 1.0.5

feat: mirror meals, chores and expiry onto a Home Assistant calendar

Anything with a date becomes a calendar event; anything that is just a
list stays a to-do list. Dinners land on this week's weekdays, cleaning
tasks on the date they are NEXT due (so marking one done moves its event
forward), and inventory items on their expiry date.

The Home tab now also reads today's events back out of Home Assistant,
across every calendar it knows about, so it shows the real day rather
than only its own projections.

Notes on the approach:

- One-way. The app owns the data, the calendar mirrors it. Two-way would
  need conflict resolution and risks duplicate events for little gain.
- Home Assistant has calendar.create_event and calendar.get_events but no
  delete or update action, and get_events omits the uid. So creates go
  over REST, reads use /api/calendars/<entity> (which does return uids),
  and deletes go over the WebSocket API - hence ws.js. Node 20 hides the
  WebSocket global behind a flag, so run.sh enables it below Node 22.
- Only events carrying our marker are ever considered, so anything added
  to the calendar by hand is invisible to the reconciler and safe.
- Events outside the sync window are dropped from the plan as well as the
  read; otherwise a far-future expiry would be invisible to the read,
  judged missing every pass, and recreated forever.
- Dates are LOCAL, not UTC. At 9am in Australia the UTC date is still
  yesterday, which would have put dinners on the wrong day all morning.
  Tests build their instants locally and pass under UTC, Australia/Sydney
  and America/Los_Angeles.

Needs a Local Calendar named 'Home Base'. Without it the feature logs how
to set it up and stays off; the Home tab card renders nothing at all.

## 1.0.4

feat(app): debounced saves, deep-merged defaults, error boundary

- useAutoSave waited for no pause, and two inputs write to state per
  keystroke, so typing an 18-character note produced 18 writes and 18
  live-sync broadcasts to the other phone. Now debounced to 800ms and
  flushed on visibilitychange/pagehide so backgrounding the app mid-edit
  still saves. Verified in a browser: 18 chars -> 0 writes while typing,
  1 after the pause.
- Loading did a shallow spread of stored data over DEFAULT_DATA, so a
  field added inside weekPlan or dogFood would arrive undefined for
  existing households and white-screen the app. mergeWithDefaults
  recurses into objects and replaces arrays wholesale, so deleted meals
  and chores stay deleted. 10 tests.
- Added an error boundary: a crash now shows the message, the component
  stack, a copy button and revert instructions instead of a white
  screen. It can also list and restore data snapshots, because the
  in-app restore panel lives inside the tree that just crashed - which
  is exactly when bad data needs rolling back. Verified end to end:
  corrupt data -> crash -> restore -> recovered.
- CI runs the app tests as well as the server ones.

Also: dropped armv7 and pinned the app build stage to BUILDPLATFORM, so
cross-architecture builds no longer emulate a vite build. Added example
automations for the published sensors.

## 1.0.3

First working release. amd64 image published to GHCR.

# Changelog

Versions are stamped automatically by CI as `1.0.<build number>`.
