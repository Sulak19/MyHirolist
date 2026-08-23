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
