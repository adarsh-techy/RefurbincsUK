// Trash item types — same labels and colours as the web TrashPage /
// TrashDetailPage TYPE_CONFIG.
export const ITEM_TYPES = [
  { value: 'all', label: 'All Items' },
  { value: 'battery', label: 'Batteries' },
  { value: 'truck_intake', label: 'Truck Intakes' },
  { value: 'staff', label: 'Staff' },
  { value: 'part', label: 'Parts' },
  { value: 'invoice', label: 'Invoices' },
  { value: 'client', label: 'Clients' },
  { value: 'service', label: 'Services' },
  { value: 'issue_reason', label: 'Issue Reasons' },
];

export const TYPE_CONFIG = {
  battery: { label: 'Battery', cls: 'border-emerald-300 bg-emerald-50', text: 'text-emerald-700' },
  truck_intake: { label: 'Truck Intake', cls: 'border-blue-300 bg-blue-50', text: 'text-blue-700' },
  staff: { label: 'Staff Member', cls: 'border-purple-300 bg-purple-50', text: 'text-purple-700' },
  part: { label: 'Inventory Part', cls: 'border-amber-300 bg-amber-50', text: 'text-amber-700' },
  invoice: { label: 'Invoice', cls: 'border-rose-300 bg-rose-50', text: 'text-rose-700' },
  client: { label: 'Client', cls: 'border-cyan-300 bg-cyan-50', text: 'text-cyan-700' },
  service: { label: 'Service', cls: 'border-indigo-300 bg-indigo-50', text: 'text-indigo-700' },
  issue_reason: { label: 'Issue Reason', cls: 'border-orange-300 bg-orange-50', text: 'text-orange-700' },
};

export const typeConfig = (type) => TYPE_CONFIG[type] || { label: type || 'Item', cls: 'border-slate-300 bg-slate-50', text: 'text-slate-600' };
