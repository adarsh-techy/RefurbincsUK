// CSV builders for the client Service History — same columns, quoting and
// file names as the web ClientHistoryPage (exportHistoryToCsv) and
// ClientHistoryDetailPage (exportTruckManifestCsv), so a file exported from
// the phone opens exactly like one exported from the web portal.

export function formatEventTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const today = () => new Date().toISOString().slice(0, 10);

// Every (filtered) history event → one row
export function buildHistoryCsv(events) {
  const headers = [
    'Event ID',
    'Event Type',
    'Date & Time',
    'Battery Count',
    'Truck/Vehicle',
    'Driver',
    'Details',
    'Batteries Included',
    'Amount (£)',
  ];
  const rows = (events || []).map((e) => {
    const listCodes = (e.batteries_list || []).map((b) => b.code).filter(Boolean).join('; ');
    return [
      `"${e.id || ''}"`,
      `"${e.type_label || e.type || ''}"`,
      `"${formatEventTime(e.timestamp)}"`,
      `"${e.battery_count || (e.batteries_list ? e.batteries_list.length : 1)}"`,
      `"${e.vehicle_number || ''}"`,
      `"${e.driver_name || e.staff_name || ''}"`,
      `"${(e.details || '').replace(/"/g, '""')}"`,
      `"${listCodes || e.battery_code || ''}"`,
      `"${e.amount ? Number(e.amount).toFixed(2) : ''}"`,
    ];
  });
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export const historyCsvFileName = () => `fleet_history_${today()}.csv`;

// One truck shipment's batteries
export function buildTruckManifestCsv(event) {
  const headers = ['Battery ID', 'Serial Number', 'Notes / Reason', 'Status'];
  const rows = (event?.batteries_list || []).map((b) => [
    `"${b.code || ''}"`,
    `"${b.serial || ''}"`,
    `"${(b.notes || '').replace(/"/g, '""')}"`,
    `"${b.status || ''}"`,
  ]);
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function truckManifestFileName(event) {
  const cleanTruck = (event?.vehicle_number || 'shipment').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `truck_manifest_${cleanTruck}_${today()}.csv`;
}
