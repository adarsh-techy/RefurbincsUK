// Shared by the technician Dashboard and History pages, which both read
// GET /staff/me.
//
// A repair row carries the battery's status *right now* (battery_status),
// which says nothing about a job done on an earlier visit — a battery
// repaired last month and back in the workshop today would otherwise drop
// out of "completed". The API works out what happened to each job as
// `outcome` ('completed' | 'active' | 'failed'); the fallbacks below only
// cover an older backend that doesn't send it yet.

const FAILED_STATUSES = ['unserviceable', 'tested_parts_removed', 'unserviceable_parts_removed', 'recycled'];

export function isCompletedRepair(r) {
  if (r.outcome) return r.outcome === 'completed';
  return r.battery_status === 'repaired' || r.battery_status === 'returned';
}

export function isActiveRepair(r) {
  if (r.outcome) return r.outcome === 'active';
  return r.battery_status === 'in_progress' || r.battery_status === 'in_testing';
}

// Which status badge to show against a repair job: the job's own result, not
// whatever the battery happens to be doing today.
export function repairBadgeStatus(r) {
  if (r.outcome === 'completed') return r.battery_status === 'returned' ? 'returned' : 'repaired';
  if (r.outcome === 'failed') {
    return FAILED_STATUSES.includes(r.battery_status) ? r.battery_status : 'tested_parts_removed';
  }
  return r.battery_status || 'repaired';
}
