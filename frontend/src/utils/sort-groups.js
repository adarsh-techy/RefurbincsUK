// The client-side-only "Battery Sorting" grouping tool stores its data in
// localStorage (it's a personal organizing aid, not backend data — see
// ClientBatterySortPage). Shared here so any client page can read it.
export function sortGroupsKey(userId) {
  return `battery-sort-groups-${userId || 'guest'}`;
}

export function loadSortGroups(userId) {
  try {
    const raw = localStorage.getItem(sortGroupsKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
