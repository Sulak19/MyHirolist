export const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const object = (v) => v && typeof v === "object" && !Array.isArray(v);
const keyed = (v) => Array.isArray(v) && v.every((item) => object(item) && item.id != null) && new Set(v.map((item) => item.id)).size === v.length;

// Apply only fields edited locally, preserving independent remote changes.
// Lists of records merge by ID, including additions and deletions.
export function mergeChanges(base, local, remote, preferRemote = false) {
  if (sameValue(base, local)) return remote;
  if (sameValue(base, remote) || sameValue(local, remote)) return local;
  if (keyed(base) && keyed(local) && keyed(remote)) {
    const b = new Map(base.map((x) => [x.id, x]));
    const l = new Map(local.map((x) => [x.id, x]));
    const r = new Map(remote.map((x) => [x.id, x]));
    return [...new Set([...local.map((x) => x.id), ...remote.map((x) => x.id)])]
      .map((id) => mergeChanges(b.get(id), l.get(id), r.get(id), preferRemote))
      .filter((item) => item !== undefined);
  }
  if (object(base) && object(local) && object(remote)) {
    return Object.fromEntries([...new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])]
      .map((key) => [key, mergeChanges(base[key], local[key], remote[key], preferRemote)])
      .filter(([, value]) => value !== undefined));
  }
  // A remote deletion wins over an edit to prevent resurrecting removed rows.
  if (remote === undefined && base !== undefined) return undefined;
  return preferRemote ? remote : local;
}

export function undoChange(change, current) {
  return mergeChanges(change.after, change.before, current, true);
}
