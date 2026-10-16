import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import apiClient from '../../../services/api-client';
import TableState from '../../../components/ui/table/TableState';
import { StatusBadge } from '../../../components/ui/primitives/Badge';
import {
  FiArrowLeft,
  FiDownload,
  FiExternalLink,
  FiSearch,
  FiTruck,
  FiUser,
  FiCalendar,
  FiLayers,
  FiCheckCircle,
  FiXCircle,
  FiFileText,
  FiHash,
  FiAlertTriangle,
  FiArrowRight,
} from 'react-icons/fi';

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

// Executive shipment manifest detail page
function ClientHistoryDetailPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

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

  const list = useMemo(() => event?.batteries_list || [], [event]);

  // Meaningful content metrics:
  const contentStats = useMemo(() => {
    if (!list.length) return { total: 0, withSerial: 0, withNotes: 0, statusBreakdown: {} };
    let withSerial = 0;
    let withNotes = 0;
    const statusMap = {};
    list.forEach((b) => {
      if (b.serial && b.serial.trim()) withSerial++;
      if (b.notes && b.notes.trim()) withNotes++;
      const st = b.status || 'unknown';
      statusMap[st] = (statusMap[st] || 0) + 1;
    });
    return {
      total: list.length,
      withSerial,
      withNotes,
      statusBreakdown: statusMap,
    };
  }, [list]);

  const availableStatuses = useMemo(() => {
    const set = new Set();
    list.forEach((b) => {
      if (b.status) set.add(b.status);
    });
    return Array.from(set);
  }, [list]);

  const filteredBatteries = useMemo(() => {
    let rows = list;
    if (statusFilter !== 'all') {
      rows = rows.filter((b) => b.status === statusFilter);
    }
    if (!search.trim()) return rows;
    const q = search.toLowerCase().trim();
    return rows.filter(
      (b) =>
        (b.code && b.code.toLowerCase().includes(q)) ||
        (b.serial && b.serial.toLowerCase().includes(q)) ||
        (b.notes && b.notes.toLowerCase().includes(q)) ||
        (b.status && b.status.toLowerCase().includes(q))
    );
  }, [list, search, statusFilter]);

  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-5 pb-16">
      {/* ── Top Header Navigation ────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/my/history')}
          className="group inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700 dark:hover:text-white cursor-pointer active:scale-98"
        >
          <FiArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to History</span>
        </button>

        {event && (
          <button
            type="button"
            onClick={() => exportTruckManifestCsv(event)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-2xs hover:shadow-sm active:scale-98 cursor-pointer"
          >
            <FiDownload className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        )}
      </div>

      {loading ? (
        <TableState>Loading shipment manifest details…</TableState>
      ) : error ? (
        <TableState tone="error">{error}</TableState>
      ) : !event ? (
        <TableState>No shipment details found.</TableState>
      ) : (
        <>
          {/* ── Unified Executive Shipment Header Card ─────────────────── */}
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs dark:border-white/10 dark:bg-surface-900">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100 dark:border-white/5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/40">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{event.type_label}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-neutral-400">
                  <FiCalendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{formatEventTime(event.timestamp)}</span>
                </span>
              </div>

              {event.reference && (
                <span className="self-start sm:self-auto font-mono text-xs font-semibold bg-slate-100 dark:bg-surface-800 px-2 py-0.5 rounded-lg text-slate-600 dark:text-neutral-300 border border-slate-200/60 dark:border-white/5">
                  Ref: {event.reference}
                </span>
              )}
            </div>

            <div className="pt-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h1 className="text-lg sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  {event.vehicle_number ? `Truck #${event.vehicle_number}` : 'Shipment Manifest'}
                </h1>
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500 dark:text-neutral-400">
                  {event.driver_name && (
                    <span className="flex items-center gap-1.5">
                      <FiUser className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        Driver: <strong className="font-semibold text-slate-800 dark:text-neutral-200">{event.driver_name}</strong>
                      </span>
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <FiLayers className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      Manifest Load: <strong className="font-bold text-emerald-600 dark:text-emerald-400">{list.length} Batteries</strong>
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Key Shipment Metrics Grid (No Redundancy!) ──────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
            <div className="rounded-2xl border border-blue-200/90 bg-blue-50/60 p-3.5 shadow-2xs dark:border-blue-900/30 dark:bg-blue-950/20">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                  Total Units
                </span>
                <div className="h-7 w-7 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <FiLayers className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="mt-1 text-xl sm:text-2xl font-black text-blue-950 dark:text-white">
                {contentStats.total}
              </p>
              <p className="mt-0.5 text-[10px] sm:text-[11px] font-medium text-blue-600 dark:text-blue-400">
                Batteries on this shipment
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/60 p-3.5 shadow-2xs dark:border-emerald-900/30 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  With Serials
                </span>
                <div className="h-7 w-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <FiHash className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="mt-1 text-xl sm:text-2xl font-black text-emerald-950 dark:text-white">
                {contentStats.withSerial}
              </p>
              <p className="mt-0.5 text-[10px] sm:text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                {Math.round((contentStats.withSerial / (contentStats.total || 1)) * 100)}% registered serials
              </p>
            </div>

            <div className="rounded-2xl border border-amber-200/90 bg-amber-50/60 p-3.5 shadow-2xs dark:border-amber-900/30 dark:bg-amber-950/20">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  Notes / Issues
                </span>
                <div className="h-7 w-7 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <FiAlertTriangle className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="mt-1 text-xl sm:text-2xl font-black text-amber-950 dark:text-white">
                {contentStats.withNotes}
              </p>
              <p className="mt-0.5 text-[10px] sm:text-[11px] font-medium text-amber-600 dark:text-amber-400">
                Logged defect notes
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs dark:border-white/10 dark:bg-surface-900">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                  Vehicle
                </span>
                <div className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-surface-800 flex items-center justify-center text-slate-600 dark:text-neutral-300">
                  <FiTruck className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="mt-1 text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                {event.vehicle_number ? `Truck #${event.vehicle_number}` : 'Standard'}
              </p>
              <p className="mt-0.5 text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-neutral-400 truncate">
                {event.driver_name || 'Workshop Logistics'}
              </p>
            </div>
          </div>

          {/* ── Search, Filter & Controls Toolbar ──────────────────────── */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
              <input
                type="text"
                placeholder="Search battery ID, serial, or notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-9 py-2 text-xs sm:text-sm rounded-xl bg-white border border-slate-200/90 shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:bg-surface-800 dark:border-white/10 dark:text-white dark:placeholder:text-neutral-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <FiXCircle className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2.5 flex-wrap">
              {availableStatuses.length > 1 && (
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-xs font-semibold px-3 py-2 rounded-xl bg-white border border-slate-200/90 shadow-2xs text-slate-700 dark:bg-surface-800 dark:border-white/10 dark:text-neutral-200 cursor-pointer"
                >
                  <option value="all">All Statuses ({list.length})</option>
                  {availableStatuses.map((st) => (
                    <option key={st} value={st}>
                      {st.replace(/_/g, ' ').toUpperCase()} ({contentStats.statusBreakdown[st] || 0})
                    </option>
                  ))}
                </select>
              )}
              <span className="text-xs font-semibold text-slate-500 dark:text-neutral-400 whitespace-nowrap">
                Showing {filteredBatteries.length} of {list.length} units
              </span>
            </div>
          </div>

          {/* ── Batteries Mobile Cards View (sm/xs screens) ───────────── */}
          <div className="block md:hidden space-y-3">
            {filteredBatteries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/10 p-8 text-center bg-white dark:bg-surface-900">
                <p className="text-xs text-slate-400 dark:text-neutral-500">
                  No batteries found matching "{search}"
                </p>
              </div>
            ) : (
              filteredBatteries.map((b, idx) => (
                <div
                  key={b.code || idx}
                  className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs dark:border-white/10 dark:bg-surface-900 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-neutral-500 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-surface-800">
                        #{idx + 1}
                      </span>
                      <Link
                        to={`/batteries/${encodeURIComponent(b.code)}`}
                        state={{ from: location.pathname + location.search }}
                        className="font-mono text-xs font-black text-emerald-700 hover:underline dark:text-emerald-400 inline-flex items-center gap-1"
                      >
                        <span>{b.code}</span>
                        <FiExternalLink className="w-3 h-3 opacity-60" />
                      </Link>
                    </div>
                    <StatusBadge status={b.status} />
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-neutral-300">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wider">
                      Serial:
                    </span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-neutral-200">
                      {b.serial || '—'}
                    </span>
                  </div>

                  {b.notes && (
                    <div className="rounded-xl bg-amber-50/70 dark:bg-amber-950/20 p-2.5 text-xs text-amber-900 dark:text-amber-200 border border-amber-200/70 dark:border-amber-900/30">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-0.5">
                        Notes / Defect Reason:
                      </span>
                      {b.notes}
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex justify-end">
                    <Link
                      to={`/batteries/${encodeURIComponent(b.code)}`}
                      state={{ from: location.pathname + location.search }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700 transition-colors shadow-2xs"
                    >
                      <span>View Battery</span>
                      <FiArrowRight className="w-3 h-3 opacity-70" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Batteries Desktop Table (md+ screens) ─────────────────── */}
          <div className="hidden md:block overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xs dark:border-white/10 dark:bg-surface-900">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-xs">
                <thead className="bg-slate-50/90 text-slate-700 dark:bg-surface-800/80 dark:text-neutral-200 font-bold border-b border-slate-200/80 dark:border-white/10">
                  <tr>
                    <th className="px-5 py-3.5 w-14 text-slate-400 font-mono">#</th>
                    <th className="px-5 py-3.5">Battery ID</th>
                    <th className="px-5 py-3.5">Serial Number</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Client Notes / Issue</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 bg-white dark:bg-surface-900">
                  {filteredBatteries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-slate-400 dark:text-neutral-500">
                        No batteries found matching "{search}"
                      </td>
                    </tr>
                  ) : (
                    filteredBatteries.map((b, idx) => (
                      <tr key={b.code || idx} className="hover:bg-slate-50/80 dark:hover:bg-surface-800/50 transition-colors">
                        <td className="px-5 py-3.5 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="px-5 py-3.5">
                          <Link
                            to={`/batteries/${encodeURIComponent(b.code)}`}
                            state={{ from: location.pathname + location.search }}
                            className="font-mono font-black text-emerald-700 hover:underline dark:text-emerald-400 inline-flex items-center gap-1.5"
                          >
                            <span>{b.code}</span>
                            <FiExternalLink className="w-3.5 h-3.5 opacity-60" />
                          </Link>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-slate-600 dark:text-neutral-300">
                          {b.serial || <span className="text-slate-400 dark:text-neutral-500">—</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={b.status} />
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-neutral-300 max-w-sm truncate">
                          {b.notes || <span className="text-slate-400 dark:text-neutral-500">—</span>}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            to={`/batteries/${encodeURIComponent(b.code)}`}
                            state={{ from: location.pathname + location.search }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700 transition-colors shadow-2xs"
                          >
                            <span>View Battery</span>
                            <FiArrowRight className="w-3 h-3 opacity-60" />
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ClientHistoryDetailPage;
