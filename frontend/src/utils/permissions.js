// Mirrors backend/src/config/permissions.js. Kept as a small, manually
// synced constant rather than fetched from the API, since it changes rarely.
export const PERMISSIONS = [
  { key: 'truck_intakes', label: 'Truck Intake' },
  { key: 'repairs', label: 'Repairs' },
  { key: 'staff', label: 'Staff' },
  { key: 'parts', label: 'Inventory' },
  { key: 'returns', label: 'Returns' },
  { key: 'recycle', label: 'Recycle' },
  { key: 'audit_logs', label: 'Audit Log' },
  { key: 'clients', label: 'Clients' },
  { key: 'issue_reasons', label: 'Issue Reasons' },
  { key: 'services', label: 'Services' },
];

// Super admin-configurable permissions for client portal accounts
export const CLIENT_PERMISSIONS = [
  { key: 'client_dashboard', label: 'Dashboard Overview', group: 'Overview', desc: 'Main fleet dashboard overview and summary metrics' },
  { key: 'client_all_batteries', label: 'All Batteries', group: 'Overview', desc: 'Full inventory of all client batteries' },
  { key: 'client_packed', label: 'Packed (Stage 1)', group: 'Repair Service', desc: 'Batteries booked/packed for repair' },
  { key: 'client_in_service', label: 'In Service (Stage 2)', group: 'Repair Service', desc: 'Batteries actively in repair or testing' },
  { key: 'client_received', label: 'Received (Stage 3)', group: 'Repair Service', desc: 'Repaired batteries returned back to client' },
  { key: 'client_battery_sorting', label: 'Battery Sorting', group: 'Sorting', desc: 'Barcode / QR code battery sorting tool' },
  { key: 'client_invoices', label: 'Invoices', group: 'Billing', desc: 'Client invoices and PDF downloads' },
  { key: 'client_transactions', label: 'Transactions', group: 'Billing', desc: 'Repair charges and financial history' },
  { key: 'client_support', label: 'Support & Chat', group: 'Support', desc: 'Live ticket support chat with Refurbinics' },
  { key: 'client_notifications', label: 'Notifications', group: 'Support', desc: 'Client system alerts and activity log' },
];

// Who may run the testing / QA stage on a battery (start-testing,
// complete-testing, pass-to-tech, remove-parts). Mirrors the backend check in
// battery.controller.js: admins always, workshop logins only when their staff
// record is a supervisor. `staff_role` is attached to the user by /auth/login
// and /auth/me, so no extra /staff/me round-trip is needed.
export function canTestBatteries(user) {
  if (!user) return false;
  if (user.role === 'super_admin' || user.role === 'admin') return true;
  return (user.staff_role || '').toLowerCase() === 'supervisor';
}

// A battery that arrived on a truck intake the workshop hasn't verified yet
// (still 'pending_arrival'). Work and testing must not start on it. One
// definition for BatteryDetailPage, TechnicianHomePage and the repair panel.
export function isIntakeUnverified(battery) {
  if (!battery?.truck_intake_id) return false;
  return battery.intake_status !== 'verified' || !battery.intake_verified_at;
}

// super_admin implicitly has every permission; an admin only has what's in
// user.permissions.
export function hasPermission(user, permission) {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  return (user.permissions || []).includes(permission);
}

// Checks if a client user has access to a particular client portal module
export function hasClientPermission(user, permissionKey) {
  if (!user) return false;
  // Non-client roles (admins, tech) are not constrained by client module flags
  if (user.role !== 'client') return true;
  // If permission key isn't specified (e.g. Profile or unconstrained link), allow
  if (!permissionKey) return true;
  // Backwards-compatible: if no permissions array defined yet, grant access
  if (!user.permissions || !Array.isArray(user.permissions) || user.permissions.length === 0) {
    return true;
  }
  return user.permissions.includes(permissionKey);
}
