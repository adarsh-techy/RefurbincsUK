import apiClient from '../services/api-client';

export function sortGroupsKey(userId) {
  return `battery-sort-groups-${userId || 'guest'}`;
}

export function clearLegacySortGroups(userId) {
  try {
    if (userId) {
      localStorage.removeItem(sortGroupsKey(userId));
    }
    // Also remove generic guest key
    localStorage.removeItem(sortGroupsKey('guest'));
    localStorage.removeItem('battery-sort-groups');
  } catch {
    // non-fatal
  }
}

// Deprecated synchronous loader: always cleans up legacy localStorage to prevent
// stale sorted data from previous databases from persisting.
export function loadSortGroups(userId) {
  clearLegacySortGroups(userId);
  return [];
}

export async function fetchSortGroups() {
  try {
    const { data: res } = await apiClient.get('/clients/me/sort-groups');
    return res.data || [];
  } catch (err) {
    // Re-throw: a failed load must never be mistaken for "no groups", because
    // saving on top of it would replace (delete) every group stored server-side.
    console.error('Failed to fetch sort groups:', err);
    throw err;
  }
}

export async function saveSortGroups(groups) {
  try {
    const { data: res } = await apiClient.put('/clients/me/sort-groups', { groups });
    return res.data || [];
  } catch (err) {
    console.error('Failed to save sort groups:', err);
    throw err;
  }
}
