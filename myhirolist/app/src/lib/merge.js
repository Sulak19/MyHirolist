// Merges stored household data onto the app's defaults.
//
// The app used to do `{ ...DEFAULT_DATA, ...remote }`, which only merges the
// top level. That is fine until someone adds a field inside a nested object
// like dogFood: the stored dogFood replaces the default wholesale, the new
// field arrives undefined, and the app white-screens on data that was
// perfectly valid yesterday. Since the whole point of this repo is that new
// fields get added over time, that had to go.

export function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Recursively fills in anything missing from `incoming` using `defaults`.
 *
 * Objects merge key by key. Arrays are replaced wholesale, deliberately: the
 * household's shopping list is theirs, and merging it with the defaults would
 * resurrect meals and chores they had deleted.
 */
export function mergeWithDefaults(defaults, incoming) {
  if (incoming === undefined || incoming === null) return defaults;
  if (!isPlainObject(defaults) || !isPlainObject(incoming)) return incoming;

  const merged = { ...defaults };

  for (const [key, value] of Object.entries(incoming)) {
    merged[key] =
      isPlainObject(defaults[key]) && isPlainObject(value)
        ? mergeWithDefaults(defaults[key], value)
        : value;
  }

  return merged;
}
