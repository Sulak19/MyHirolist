## 1.0.18

Tidy meal selection and cleaning UI (#5)

Add a one-tap deselect-all meals action and remove the cleaning-equipment summary line while preserving stored household data.

## 1.0.17

Split Dogs and House into focused tabs (#4)

Promote Dogs to top-level navigation and split Dogs and House into focused sub-tabs while preserving saved data.

## 1.0.16

Keep homemade low-stock staples out of Shopping (#3)

Apply the prep-only rule to every shopping entry point and remove stale Shopping entries while those staples are low.

## 1.0.15

Clarify saved meal search and creation (#2)

Separate saved-meal search and filtering from the dedicated add-meal bottom sheet.

## 1.0.14

Route homemade low-stock staples to prep (#1)

Keep frozen rice, bread, garlic koji, and ginger off shopping when low and create prep tasks instead.

## 1.0.13

feat(prep): automatic, split from day-of, and redesigned

The button is gone. Prep now follows the plan the way shopping does -
choosing a meal is enough. A list you have to remember to refresh is a
list that goes stale, which is exactly what happened: pressing the button
a second time did nothing, because tasks were deduplicated by label.

Prep notes carry two different things: weekend work, and what to do on
the night ('Day-of: coat in starch and fry'). Only the first belongs on a
weekend list, so they are split. The day-of half still travels with the
task, shown quietly underneath, but it is not what you read while
prepping.

The tab is rebuilt around that:
- Grouped by WHEN the work is for - This week, then Cook ahead for next
  week - instead of a heading per meal above a single task.
- The meal is a small chip, not a section header.
- A progress bar and a count, because a prep list is something you work
  through.
- Completed tasks collapse to a muted Done section rather than sitting
  greyed out among the live ones.
- Tasks carry a stable key, so ticking one off survives a replan, and a
  job already done is never removed when the plan moves on.

The plan button now suggests rather than decides: 'Suggest for the empty
days' proposes a meal per empty day, which you accept one at a time with
Use this. Nothing is written to the plan until you say so.

62 app tests, 77 server tests. Verified on a 375px viewport: suggesting
leaves the plan untouched, accepting one generates its prep unprompted,
the day-of half is separated, and nothing overflows.

## 1.0.12

feat: shopping driven by stock and forecast, staged put-away, live replanning

Shopping
- Anything flagged low is on the list whether or not a meal wants it;
  staples run out between meal plans. Where an item lives beats guessing
  from its name, so a low 'Tomato passata' in the Pantry is Pantry.
- Items say which week they are for, and whether they are there because
  the plan wants them or because stock ran low. An item wanted by both
  weeks says so once rather than appearing twice.
- Rows the app added are tinted, so it is obvious which came from the
  plan and which were typed in.

Ticking off
- Checking an item means it is in the house: something already tracked
  stops being low, and anything new is staged under 'Recent shop' with
  Fridge/Freezer/Pantry/Supplements buttons to put it away. That is where
  receipt scanning should land too.

Planning
- The plan is a suggestion, not a decision. Overriding one day pins it
  and replans the days the app chose around it - and since prep and
  shopping derive from the plan, both follow. Days before today are left
  alone; nobody wants Monday's dinner reshuffled on Thursday.
- Clearing a day now leaves it empty. It used to be refilled immediately
  by the replan that followed, so a day could not be cleared at all.

Prep
- This week's food only, plus next week's meals that actually freeze -
  judged from the household's own prep notes, which mostly say so. Those
  are labelled as cook-ahead. Chopping salad a week early helps nobody.
  Portion counts are not invented: meals carry no servings data.

64 app tests, 77 server tests. Verified in a browser: low stock reaches
the list, week tags and the tint render, and ticking an item off stages
it into Recent shop. The override-replan path is covered by unit tests
and confirmed by inspection rather than driven through the UI.

## 1.0.11

feat: fortnight meal planner, aisle-grouped shopping, grouped prep

Planning
- 'Plan the empty days' fills a week using variety, stock and batch
  portions. Nothing repeats across the fortnight, proteins are spread so
  it is not chicken five nights, batch portions are spent before fresh
  meals, and days already chosen are never overwritten. Deterministic -
  ties break on list position, not at random.
- weekPlan is archived into mealHistory at rollover, which is what makes
  variety possible: the planner can see a meal was cooked three weeks ago.
  Capped at 180 entries.

Stock
- The kitchen inventory has no quantities, only a low-stock flag, so
  stock is never decremented. Ingredients used by an already-planned meal
  are treated as COMMITTED and not available to assume for next week.
  That needs no extra data entry and is close enough for a household.

Shopping
- Derived from both weeks' meals and kept in step automatically. Items
  the app added carry source: 'plan'; anything typed in by hand is never
  touched. Something already ticked off stays even if the plan moves on.
- Grouped by supermarket aisle, and each item cites the meals that want
  it. Pantry is matched before produce so 'black bean paste' is a jar,
  not a vegetable.
- Deleting an app-added item is remembered, so it does not reappear on
  the next pass - and the memory is pruned once the plan stops wanting
  it, so it can return honestly later.

Prep
- Grouped by the job rather than the meal: three meals wanting onions is
  one chopping session. Meals carrying their own prepNotes keep them
  verbatim, since those are specific instructions worth preserving.

48 app tests, 77 server tests. Verified in a browser: both weeks fill
with zero overlap, aisles render in shop order, and a deleted ingredient
stays deleted across a reconcile pass.

## 1.0.10

feat(home): agenda fed by the calendar - today, plus tomorrow when today is thin

The Home tab no longer shows a flat dump of calendar events. It reads the
calendar and builds an agenda: today always, and tomorrow when today has
fewer than three open items or it is past 6pm. Each day is grouped -
dinner, chores, use up, and anything else on the Home Base calendar - so
it reads as a plan.

Today's chores are tappable chips; a tap marks the task done. The
calendar event goes on the next sync pass, but the chip disappears
instantly from local data so nothing lingers. Verified on a 375px
viewport: tap, gone, persisted, no horizontal overflow.

Without a calendar configured the same card is built from local data, so
the tab never goes blank - it just cannot look ahead.

agenda.js is pure: classification by the stamped event key, grouping,
local-date placement for timed events, and the show-tomorrow rule. 9
tests, passing in UTC and Sydney. The thresholds are two named constants.

## 1.0.9

feat: two-week meal plan, projected a fortnight onto the calendar

The Plan tab gains a This week / Next week toggle. weekPlan keeps its
shape - every existing read still works - and nextWeekPlan sits beside
it with the same shape. On Monday the app rolls next week into this week
and empties next week; planWeekOf stamps which Monday weekPlan belongs
to, so the rollover is idempotent across phones and skipped cleanly on
legacy data. If more than one week passed, both reset, since the old
'next week' is stale too. 9 tests, passing in UTC and Sydney.

The calendar now projects both weeks, so dinners cover a fortnight.
Cleaning and expiry already reached 120 days out. dinner_tomorrow reads
next week's plan when tomorrow is Monday.

Verified in a browser: the toggle renders; accepting a meal on Next week
writes nextWeekPlan only.

## 1.0.8

fix: Home tab reads only the Home Base calendar; correct ingress path

Reading every calendar put ten energy-tariff events above the chores on
the Home tab. Default is now just calendar.home_base. A new
today_calendars option widens it - 'all', or a comma-separated list -
for households that want bin collections and the like shown there.

The sidebar opens the add-on at /<slug>, not /hassio/ingress/<slug>;
the dashboard and README now use the form that actually resolves.

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
