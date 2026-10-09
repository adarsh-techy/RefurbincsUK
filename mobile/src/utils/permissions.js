// Mirror of frontend/src/utils/permissions.js hasClientPermission(): which
// client-portal modules a client login may open. Non-client roles are never
// constrained by these flags, and an empty permissions array means "all".
export const CLIENT_PERMISSIONS = [
  { key: 'client_dashboard', label: 'Dashboard' },
  { key: 'client_all_batteries', label: 'All Batteries' },
  { key: 'client_packed', label: 'Packed' },
  { key: 'client_received', label: 'Received' },
  { key: 'client_battery_sorting', label: 'Battery Sorting' },
  { key: 'client_invoices', label: 'Invoices' },
  { key: 'client_transactions', label: 'Transactions' },
  { key: 'client_support', label: 'Support' },
  { key: 'client_notifications', label: 'Notifications' },
];

export function hasClientPermission(user, permissionKey) {
  if (!user) return false;
  if (user.role !== 'client') return true;
  if (!permissionKey) return true;
  if (!user.permissions || !Array.isArray(user.permissions) || user.permissions.length === 0) {
    return true;
  }
  return user.permissions.includes(permissionKey);
}
