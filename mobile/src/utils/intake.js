// A battery that arrived on a truck intake the workshop hasn't verified yet
// (still 'pending_arrival'). Work and testing must not start on it. Mirrors
// frontend/src/utils/permissions.js isIntakeUnverified.
export function isIntakeUnverified(battery) {
  if (!battery?.truck_intake_id) return false;
  return battery.intake_status !== 'verified' || !battery.intake_verified_at;
}

export default isIntakeUnverified;
