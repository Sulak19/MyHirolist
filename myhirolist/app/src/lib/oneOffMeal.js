const PREFIX = "one-off:";

export function oneOffMealId(name) {
  const trimmed = String(name ?? "").trim();
  return trimmed ? PREFIX + encodeURIComponent(trimmed) : null;
}

export function oneOffMealName(value) {
  if (typeof value !== "string" || !value.startsWith(PREFIX)) return null;
  try {
    return decodeURIComponent(value.slice(PREFIX.length)) || null;
  } catch {
    return null;
  }
}

export function oneOffMealFromId(value) {
  const name = oneOffMealName(value);
  return name ? { id: value, name, ingredients: [] } : null;
}
