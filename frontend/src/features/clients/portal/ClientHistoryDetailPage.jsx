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

// Full-page executive version of the Truck Shipment Details manifest
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

  const availableStatuses = useMemo(() => {
    if (!event?.batteries_list) return [];
    const set = new Set();
    event.batteries_list.forEach((b) => {
      if (b.status) set.add(b.status);
    });
    return Array.from(set);
  }, [event]);

  const filteredBatteries = useMemo(() => {
    if (!event?.batteries_list) return [];
    let list = event.batteries_list;

    if (statusFilter !== 'all') {
      list = list.filter((b) => b.status === statusFilter);
    }

    if (!search.trim()) return list;
    const q = search.toLowerCase().trim();
    return list.filter(
      (b) =>
        (b.code && b.code.toLowerCase().includes(q)) ||
        (b.serial && b.serial.toLowerCase().includes(q)) ||
        (b.notes && b.notes.toLowerCase().includes(q)) ||
        (b.status && b.status.toLowerCase().includes(q))
    );
  }, [event, search, statusFilter]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 px-4 sm:px-6">
      {/* Top Back Navigation */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/my/history')}
          className="group inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 shadow-2xs transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-300 dark:hover:bg-surface-700 dark:hover:text-white cursor-pointer"
        >
          <FiArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to History &amp; Activity</span>
        </button>
      </div>

      {loading ? (
        <TableState>Loading shipment manifest details…</TableState>
      ) : error ? (
        <TableState tone="error">{error}</TableState>
      ) : !event ? (
        <TableState>No shipment details found.</TableState>
      ) : (
        <>
          {/* Executive Hero Banner */}
          <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xs dark:border-white/10 dark:bg-surface-900">
            <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500" />
            <div className="p-5 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40">
                    <FiTruck className="w-3.5 h-3.5" />
                    <span className="uppercase tracking-wider">Truck Shipment Manifest</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span>{event.type_label}</span>
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                  {event.vehicle_number ? `Truck #${event.vehicle_number}` : event.reference || 'Shipment Manifest'}
                </h1>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <FiCalendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{formatEventTime(event.timestamp)}</span>
                  </span>
                  {event.driver_name && (
                    <span className="flex items-center gap-1.5">
                      <FiUser className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        Driver: <strong className="font-semibold text-slate-700 dark:text-neutral-200">{event.driver_name}</strong>
                      </span>
                    </span>
                  )}
                  {event.reference && (
                    <span className="font-mono text-[11px] bg-slate-100 dark:bg-surface-800 px-2 py-0.5 rounded-md text-slate-600 dark:text-neutral-300 border border-slate-200/60 dark:border-white/5">
                      Ref: {event.reference}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => exportTruckManifestCsv(event)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 rounded-2xl transition-all shadow-xs hover:shadow-md active:scale-98 cursor-pointer"
                >
                  <FiDownload className="w-4 h-4" />
                  <span>Export Manifest CSV</span>
                </button>
              </div>
            </div>
          </div>

          {/* 4 Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                  <FiTruck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400 block">Truck / Vehicle</span>
                  <p className="text-base font-black text-slate-900 dark:text-white truncate">
                    {event.vehicle_number ? `Truck #${event.vehicle_number}` : '—'}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
                  <FiUser className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400 block">Assigned Driver</span>
                  <p className="text-base font-bold text-slate-900 dark:text-white truncate">
                    {event.driver_name || 'Workshop Logistics'}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                  <FiLayers className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400 block">Batteries Included</span>
                  <p className="text-base font-black text-emerald-600 dark:text-emerald-400">
                    {event.batteries_list?.length || 0} Units
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
                  <FiCheckCircle className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400 block">Logistics Status</span>
                  <p className="text-base font-bold text-slate-900 dark:text-white truncate">
                    {event.type_label}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Search, Filter & Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search battery ID, serial, or notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-9 py-2 text-xs rounded-xl bg-white border border-slate-200/80 shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-surface-800 dark:border-white/10 dark:text-white dark:placeholder:text-neutral-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <FiXCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {availableStatuses.length > 1 && (
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-xs font-semibold px-3 py-2 rounded-xl bg-white border border-slate-200/80 shadow-2xs text-slate-700 dark:bg-surface-800 dark:border-white/10 dark:text-neutral-200"
                >
                  <option value="all">All Statuses ({event.batteries_list?.length || 0})</option>
                  {availableStatuses.map((st) => (
                    <option key={st} value={st}>
                      {st.replace(/_/g, ' ').toUpperCase()}
                    </option>
                  ))}
                </select>
              )}
              <span className="text-xs font-semibold text-slate-500 dark:text-neutral-400 whitespace-nowrap">
                Showing {filteredBatteries.length} of {event.batteries_list?.length || 0} units
              </span>
            </div>
          </div>

          {/* Batteries Table */}
          <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-white/10 dark:bg-surface-900">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-700 dark:bg-surface-800/80 dark:text-neutral-200 font-bold border-b border-slate-200/80 dark:border-white/10">
                  <tr>
                    <th className="px-5 py-3.5 w-12 text-slate-400 font-mono">#</th>
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
                            className="font-mono font-black text-brand-600 hover:underline dark:text-emerald-400 inline-flex items-center gap-1.5"
                          >
                            <span>{b.code}</span>
                            <FiExternalLink className="w-3.5 h-3.5 opacity-60" />
                          </Link>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-slate-600 dark:text-neutral-300">
                          {b.serial || '—'}
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
                            <FiExternalLink className="w-3 h-3 opacity-60" />
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
