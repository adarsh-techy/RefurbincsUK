// Shared by the technician Dashboard and History pages, which both read
// GET /staff/me.
//
// A repair row in the database represents a repair unit of work logged by
// the technician. Unless parts were removed / the job was marked failed,
// it is completed work performed by the technician.
// Outcome ('completed' | 'active' | 'failed') indicates the lifecycle of the
// battery in the workshop pipeline:
// - 'completed': Battery has passed QA / returned to client.
// - 'active': Battery is currently in testing / awaiting QA.
// - 'failed': Parts were removed or battery deemed unserviceable.

const FAILED_STATUSES = [
  'unserviceable',
  'tested_parts_removed',
  'unserviceable_parts_removed',
  'recycled',
];

export function isCompletedRepair(r) {
  if (!r) return false;
  // If explicitly failed or parts were removed, it's not a successful repair
  if (r.outcome === 'failed' || r.parts_removed) return false;
  if (FAILED_STATUSES.includes(r.battery_status)) return false;
  // If repaired_at or id exists, technician finished this repair
  return Boolean(r.repaired_at || r.id);
}

export function isActiveRepair(r) {
  if (!r) return false;
  if (r.outcome === 'failed' || r.parts_removed) return false;
  return (
    r.battery_status === 'in_testing' ||
    r.battery_status === 'in_progress' ||
    r.outcome === 'active'
  );
}

export function isVerifiedRepair(r) {
  if (!r) return false;
  if (r.outcome === 'failed' || r.parts_removed) return false;
  return (
    r.battery_status === 'repaired' ||
    r.battery_status === 'returned' ||
    r.outcome === 'completed'
  );
}

export function isPartsRemoved(r) {
  if (!r) return false;
  return Boolean(
    r.parts_removed ||
    r.removed_at ||
    r.removed_by_me ||
    r.battery_status === 'tested_parts_removed' ||
    r.battery_status === 'unserviceable_parts_removed'
  );
}

// Which status badge to show against a repair job: the job's own result, not
// whatever the battery happens to be doing today.
export function repairBadgeStatus(r) {
  if (!r) return 'repaired';
  if (isPartsRemoved(r)) return 'tested_parts_removed';
  if (r.outcome === 'completed') return r.battery_status === 'returned' ? 'returned' : 'repaired';
  if (r.outcome === 'failed') {
    return FAILED_STATUSES.includes(r.battery_status) ? r.battery_status : 'tested_parts_removed';
  }
  return r.battery_status || 'repaired';
}
