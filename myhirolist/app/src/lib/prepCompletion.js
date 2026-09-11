// Keep the completion record for generated work when clearing the Done list.
// Manual rows can be deleted because the planner will not recreate them.
export function clearPrepItems(items, shouldRemove = (item) => item.checked) {
  return items.flatMap((item) => {
    if (!shouldRemove(item)) return [item];
    if (item.checked && item.key && item.source) return [{ ...item, hidden: true }];
    return [];
  });
}

export function visiblePrepItems(items) {
  return items.filter((item) => !item.hidden);
}
