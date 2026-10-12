// Mirror of frontend/src/features/batteries/technician/work-outcome.js, so
// the mobile Dashboard counts a technician's work exactly like the web.
// Shared reading of GET /staff/me repair rows.
//
// A repair row is one unit of work the technician logged. Unless its parts
// were pulled back out, it is completed work — even if the battery later
// failed testing (the backend reports that as outcome 'completed').
// outcome: 'completed' (passed QA / returned / repaired again since),
// 'active' (still in testing / awaiting QA), 'parts_removed'.

const FAILED_STATUSES = [
  'unserviceable',
  'tested_parts_removed',
  'unserviceable_parts_removed',
  'recycled',
];

export function isCompletedRepair(r) {
  if (!r) return false;
  if (r.parts_removed) return false;
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
