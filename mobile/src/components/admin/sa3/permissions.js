// Mirrors frontend/src/utils/permissions.js (which mirrors the backend's
// config/permissions.js): admin modules and the client portal modules.

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

export function hasPermission(user, permission) {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  return (user.permissions || []).includes(permission);
}
