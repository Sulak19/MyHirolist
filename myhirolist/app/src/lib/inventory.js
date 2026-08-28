export function moveInventoryItem(items, id, location) {
  return items.map((item) => (item.id === id ? { ...item, location } : item));
}
