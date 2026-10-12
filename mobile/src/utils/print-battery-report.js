import * as Sharing from 'expo-sharing';
import { qrContentFor, qrSvg } from './print-qr-sheet';

// Loaded on first use, not at app start: keeps startup light and keeps a
// problem in a print / export library from affecting launch (e.g. in Expo Go).
const loadPrint = () => require('expo-print');

// Printable battery report — the mobile twin of the web BatteryDetailPage
// "Print Report" (window.print). Built from the same GET /batteries/:code
// payload BatteryDetailScreen already has: { battery, history (repairs /
// parts), visits, issues, returns, services, recycleBatch }. Prices only
// appear for a super admin, like the web page.

// same wording as components/ui/Badge STATUS_MAP
const STATUS_LABELS = {
  registered: 'Registered',
  with_client: 'With Client',
  in_repair: 'Pending',
  in_progress: 'In Progress',
  in_testing: 'In Testing',
  testing: 'In Testing',
  repair_testing: 'Repair Testing',
  repaired: 'Completed',
  returned: 'Returned',
  unserviceable: 'Unserviceable',
  tested_parts_removed: 'Unserviceable (Test Failed)',
  recycled: 'Recycled',
};

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const when = (v) => (v ? new Date(v).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const money = (v) => `£${Number(v || 0).toFixed(2)}`;
const duration = (s) => {
  const n = Number(s) || 0;
  if (!n) return '—';
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m ${n % 60}s`;
};

function table(title, headers, rows) {
  if (!rows.length) return `<h2>${esc(title)}</h2><p class="empty">None recorded.</p>`;
  return `<h2>${esc(title)} (${rows.length})</h2>
  <table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
  <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

export function buildBatteryReportHtml(data, { showPrices = false } = {}) {
  const b = data?.battery || {};
  const history = data?.history || [];
  const visits = data?.visits || [];
  const issues = data?.issues || [];
  const returns = data?.returns || [];
  const services = data?.services || [];
  const recycle = Array.isArray(data?.recycleBatch) ? data.recycleBatch : data?.recycleBatch ? [data.recycleBatch] : [];

  const details = [
    ['Battery ID', b.battery_code],
    ['Status', STATUS_LABELS[b.status] || b.status],
    ['Client', b.client_name],
    ['Battery number (serial)', b.serial_number],
    ['RFID tag', b.rfid_tag],
    ['Registered', when(b.created_at)],
    ['QR generated', when(b.qr_generated_at)],
    ['Latest intake truck', b.intake_truck_number ? `${b.intake_truck_number}${b.intake_driver_name ? ` · ${b.intake_driver_name}` : ''}` : null],
    ['Intake date', b.intake_at ? when(b.intake_at) : null],
    ['Arrival verified', b.intake_verified_at ? when(b.intake_verified_at) : null],
    ['Work started', b.work_started_at ? `${when(b.work_started_at)}${b.started_by_name ? ` by ${b.started_by_name}` : ''}` : null],
    ['Notes', b.notes],
  ].filter(([, v]) => v !== null && v !== undefined && v !== '');

  // same sum as the web page: price + labour per fitted part, removed parts excluded
  const partsTotal = history.reduce((s, h) => (h.removed_at ? s : s + Number(h.price || 0) + Number(h.labor_charge || 0)), 0);
  const servicesTotal = services.reduce((s, x) => s + Number(x.rate || 0), 0);

  const repairRows = history.map((h) => [
    when(h.repaired_at),
    h.part_name || '—',
    h.quantity_used ?? 1,
    h.staff_name || '—',
    duration(h.duration_seconds),
    h.removed_at ? `Removed ${when(h.removed_at)}${h.removed_by_staff_name ? ` by ${h.removed_by_staff_name}` : ''}` : 'Fitted',
    ...(showPrices ? [money(Number(h.price || 0) + Number(h.labor_charge || 0))] : []),
  ]);
  const serviceRows = services.map((x) => [
    x.service_name || '—',
    x.staff_name || '—',
    x.completed_at ? when(x.completed_at) : 'Not completed',
    x.notes || '',
    ...(showPrices ? [money(x.rate)] : []),
  ]);

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<style>
  @page { size: A4; margin: 28pt; }
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #0f172a; font-size: 10pt; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #059669; padding-bottom: 10pt; margin-bottom: 12pt; }
  .brand { font-size: 9pt; font-weight: 700; letter-spacing: 2pt; color: #059669; text-transform: uppercase; }
  h1 { font-size: 20pt; margin: 4pt 0 2pt; }
  .sub { color: #64748b; font-size: 9pt; }
  .status { display: inline-block; margin-top: 4pt; padding: 2pt 8pt; border-radius: 10pt; background: #ecfdf5; color: #047857; font-weight: 700; font-size: 9pt; }
  .qr { width: 92pt; height: 92pt; }
  .qr svg { width: 100%; height: 100%; }
  h2 { font-size: 11pt; margin: 14pt 0 6pt; color: #334155; text-transform: uppercase; letter-spacing: 0.5pt; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 4pt 6pt; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  th { background: #f8fafc; font-size: 8.5pt; color: #475569; }
  .kv td:first-child { width: 34%; color: #64748b; }
  .empty { color: #94a3b8; font-style: italic; margin: 0; }
  .totals { margin-top: 6pt; text-align: right; font-weight: 700; }
  footer { margin-top: 18pt; color: #94a3b8; font-size: 8pt; text-align: center; }
</style></head>
<body>
  <header>
    <div>
      <div class="brand">Refurbnics · Battery report</div>
      <h1>${esc(b.battery_code)}</h1>
      <div class="sub">${esc(b.client_name || 'No client')}${b.serial_number ? ` · SN ${esc(b.serial_number)}` : ''}</div>
      <div class="status">${esc(STATUS_LABELS[b.status] || b.status || '—')}</div>
    </div>
    <div class="qr">${b.battery_code ? qrSvg(qrContentFor(b.battery_code)) : ''}</div>
  </header>

  <h2>Battery details</h2>
  <table class="kv"><tbody>${details.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</tbody></table>

  ${table('Workshop visits', ['Intake date', 'Truck', 'Driver'], visits.map((v) => [when(v.intake_at), v.truck_number || '—', v.driver_name || '—']))}
  ${table('Repairs & parts', ['Date', 'Part', 'Qty', 'Technician', 'Time', 'State', ...(showPrices ? ['Price'] : [])], repairRows)}
  ${table('Services', ['Service', 'Done by', 'Completed', 'Notes', ...(showPrices ? ['Rate'] : [])], serviceRows)}
  ${showPrices && (history.length || services.length) ? `<div class="totals">Parts &amp; labour ${money(partsTotal)} · Services ${money(servicesTotal)} · Total ${money(partsTotal + servicesTotal)}</div>` : ''}
  ${table('Issues reported', ['Date', 'Reason', 'Note', 'Reported by', 'Test failed'], issues.map((i) => [when(i.reported_at), i.reason_label || i.label || '—', i.note || '', i.staff_name || '—', i.failed_testing ? 'Yes' : 'No']))}
  ${table('Returns to client', ['Date', 'Truck', 'Driver'], returns.map((r) => [when(r.returned_at), r.truck_number || '—', r.driver_name || '—']))}
  ${recycle.length ? table('Recycling', ['Date', 'Vehicle', 'Driver'], recycle.map((r) => [when(r.recycled_at), r.vehicle_number || '—', r.driver_name || '—'])) : ''}

  <footer>Printed ${esc(when(new Date()))} · Refurbnics</footer>
</body></html>`;
}

export async function printBatteryReport(data, opts) {
  await loadPrint().printAsync({ html: buildBatteryReportHtml(data, opts) });
}

export async function shareBatteryReport(data, opts) {
  const { uri } = await loadPrint().printToFileAsync({ html: buildBatteryReportHtml(data, opts) });
  if (!(await Sharing.isAvailableAsync())) throw new Error(`Sharing isn't available on this device. PDF saved at ${uri}`);
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: `Battery report ${data?.battery?.battery_code || ''}`,
  });
}
