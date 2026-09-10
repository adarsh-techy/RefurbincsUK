// The manageable modules a super_admin can grant to an admin account.
// Keys match the route/module name; battery lookup, the dashboard, and user
// management aren't in this list — batteries/dashboard stay open to any
// authenticated user, and user management is always super_admin-only.
const PERMISSIONS = [
  'truck_intakes',
  'repairs',
  'staff',
  'parts',
  'returns',
  'recycle',
  'audit_logs',
  'clients',
  'issue_reasons',
];

// The manageable modules a super_admin can grant to a client account.
const CLIENT_PERMISSIONS = [
  'client_dashboard',
  'client_all_batteries',
  'client_packed',
  'client_in_service',
  'client_received',
  'client_battery_sorting',
  'client_invoices',
  'client_transactions',
  'client_support',
  'client_notifications',
];

module.exports = { PERMISSIONS, CLIENT_PERMISSIONS };
