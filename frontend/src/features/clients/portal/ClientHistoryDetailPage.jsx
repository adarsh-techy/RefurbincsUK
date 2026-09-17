import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import apiClient from '../../../services/api-client';
import PageHeader from '../../../components/ui/primitives/PageHeader';
import TableState from '../../../components/ui/table/TableState';
import { FiArrowLeft, FiDownload, FiExternalLink, FiSearch } from 'react-icons/fi';

function formatEventTime(dateStr) {
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

function exportTruckManifestCsv(event) {
  if (!event || !event.batteries_list) return;
  const headers = ['Battery ID', 'Serial Number', 'Notes / Reason', 'Status'];
  const rows = event.batteries_list.map((b) => [
    `"${b.code || ''}"`,
    `"${b.serial || ''}"`,
    `"${(b.notes || '').replace(/"/g, '""')}"`,
    `"${b.status || ''}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const cleanTruck = (event.vehicle_number || 'shipment').replace(/[^a-zA-Z0-9_-]/g, '_');
  link.setAttribute('download', `truck_manifest_${cleanTruck}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Full-page version of what used to be the "Truck Shipment Details" modal
// on ClientHistoryPage — same content, just its own route so it's
// shareable/bookmarkable and has real browser back/forward instead of an
// overlay. History has no single-event endpoint, so this re-fetches the
// whole list (same as the parent page) and picks out the matching one.
function ClientHistoryDetailPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiClient
      .get('/clients/me/history')
      .then((res) => {
        if (cancelled) return;
        const events = res.data?.events || [];
        const match = events.find((e) => String(e.id) === eventId);
        if (!match) {
          setError('This shipment could not be found — it may have been updated or removed.');
        } else {
          setEvent(match);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || err.message || 'Failed to load shipment details.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const filteredBatteries = useMemo(() => {
    if (!event?.batteries_list) return [];
    if (!search.trim()) return event.batteries_list;
    const q = search.toLowerCase().trim();
    return event.batteries_list.filter(
      (b) =>
        (b.code && b.code.toLowerCase().includes(q)) ||
        (b.serial && b.serial.toLowerCase().includes(q)) ||
        (b.notes && b.notes.toLowerCase().includes(q)) ||
        (b.status && b.status.toLowerCase().includes(q))
    );
  }, [event, search]);

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => navigate('/my/history')}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-white cursor-pointer"
      >
        <FiArrowLeft className="h-3.5 w-3.5" />
        <span>Back to History &amp; Activity</span>
      </button>

      {loading ? (
        <TableState>Loading shipment details…</TableState>
      ) : error ? (
        <TableState tone="error">{error}</TableState>
      ) : (
        <>
          <PageHeader
            title={`Truck Shipment — ${event.vehicle_number ? `Truck ${event.vehicle_number}` : event.reference}`}
            description={`${event.type_label} · ${formatEventTime(event.timestamp)}`}
            titleClassName="text-xl font-bold tracking-tight text-slate-900 dark:text-white"
          />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-surface-800 border border-slate-200/60 dark:border-white/10">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">Truck Number</span>
              <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                {event.vehicle_number || '—'}
              </p>
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">Driver</span>
              <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                {event.driver_name || '—'}
              </p>
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">Total Batteries</span>
              <p className="text-sm font-black text-blue-600 dark:text-blue-400 mt-0.5">
                {event.batteries_list?.length || 0} Units
              </p>
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">Status</span>
              <p className="text-sm font-bold text-slate-800 dark:text-neutral-200 mt-0.5">
                {event.type_label}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
              <input
                type="text"
                placeholder="Search battery ID or serial on this truck..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 dark:bg-surface-800 dark:border-white/10 dark:text-white dark:placeholder:text-neutral-500"
              />
            </div>

            <button
              type="button"
              onClick={() => exportTruckManifestCsv(event)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-2xs cursor-pointer"
            >
              <FiDownload className="w-3.5 h-3.5" />
              <span>Export Truck Manifest</span>
            </button>
          </div>

          <div className="overflow-x-auto overflow-y-auto rounded-2xl border border-slate-200/80 dark:border-white/10">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 dark:bg-surface-800 dark:text-neutral-200 font-bold sticky top-0">
                <tr>
                  <th className="px-4 py-2.5">#</th>
                  <th className="px-4 py-2.5">Battery ID</th>
                  <th className="px-4 py-2.5">Serial Number</th>
                  <th className="px-4 py-2.5">Client Notes / Issue</th>
                  <th className="px-4 py-2.5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 bg-white dark:bg-surface-900">
                {filteredBatteries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400 dark:text-neutral-500">
                      No batteries found matching "{search}"
                    </td>
                  </tr>
                ) : (
                  filteredBatteries.map((b, idx) => (
                    <tr key={b.code || idx} className="hover:bg-slate-50/80 dark:hover:bg-surface-800/50">
                      <td className="px-4 py-2.5 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="px-4 py-2.5">
                        <Link
                          to={`/batteries/${encodeURIComponent(b.code)}`}
                          className="font-mono font-bold text-brand-600 hover:underline dark:text-emerald-400 flex items-center gap-1"
                        >
                          <span>{b.code}</span>
                          <FiExternalLink className="w-3 h-3 opacity-60" />
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-600 dark:text-neutral-300">
                        {b.serial || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-neutral-300 max-w-xs truncate">
                        {b.notes || '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <Link
                          to={`/batteries/${encodeURIComponent(b.code)}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700 transition-colors"
                        >
                          <span>View Battery</span>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default ClientHistoryDetailPage;
