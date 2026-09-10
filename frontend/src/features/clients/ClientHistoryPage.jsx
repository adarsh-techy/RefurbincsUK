import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../services/api-client';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import TableState from '../../components/ui/TableState';
import Modal from '../../components/ui/Modal';
import { useTheme } from '../../context/ThemeContext';
import {
  FiClock,
  FiPackage,
  FiTruck,
  FiTool,
  FiCheckCircle,
  FiFileText,
  FiLayers,
  FiSearch,
  FiDownload,
  FiRefreshCw,
  FiList,
  FiActivity,
  FiCalendar,
  FiUser,
  FiExternalLink,
  FiInfo,
  FiCpu,
  FiMaximize2,
  FiShield,
} from 'react-icons/fi';

const EVENT_CONFIG = {
  packed: {
    label: 'Packed for Repair',
    icon: FiPackage,
    color: 'text-indigo-500 dark:text-indigo-400',
    bg: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/50',
    dot: 'bg-indigo-500',
    badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  },
  intake: {
    label: 'Workshop Intake',
    icon: FiTruck,
    color: 'text-blue-500 dark:text-blue-400',
    bg: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50',
    dot: 'bg-blue-500',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  },
  repair: {
    label: 'Repair & Service',
    icon: FiTool,
    color: 'text-amber-500 dark:text-amber-400',
    bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50',
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  },
  return: {
    label: 'Returned to Fleet',
    icon: FiCheckCircle,
    color: 'text-emerald-500 dark:text-emerald-400',
    bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  invoice: {
    label: 'Invoice Issued',
    icon: FiFileText,
    color: 'text-purple-500 dark:text-purple-400',
    bg: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/50',
    dot: 'bg-purple-500',
    badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  },
  sort: {
    label: 'Battery Sorted',
    icon: FiLayers,
    color: 'text-teal-500 dark:text-teal-400',
    bg: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/50',
    dot: 'bg-teal-500',
    badge: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  },
  scrap: {
    label: 'Scrapped / Recycled',
    icon: FiInfo,
    color: 'text-rose-500 dark:text-rose-400',
    bg: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/50',
    dot: 'bg-rose-500',
    badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  },
};

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

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function exportHistoryToCsv(events) {
  if (!events || !events.length) return;
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

  const rows = events.map((e) => {
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

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `fleet_history_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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

function ClientHistoryPage() {
  const { customTheme } = useTheme();
  const accent = customTheme?.accentColor || '#10b981';

  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & display state
  const [selectedType, setSelectedType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' | 'table'
  const [dateFilter, setDateFilter] = useState('all'); // 'all' | '7d' | '30d' | '90d' | 'year'

  // Truck Details Modal
  const [selectedTruckEvent, setSelectedTruckEvent] = useState(null);
  const [modalSearch, setModalSearch] = useState('');

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/clients/me/history');
      if (res.data?.success) {
        setEvents(res.data.events || []);
        setSummary(res.data.summary || {});
      } else {
        setEvents(res.data?.events || []);
        setSummary(res.data?.summary || {});
      }
    } catch (err) {
      console.error('Failed to load client history:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load fleet history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Filtered list
  const filteredEvents = useMemo(() => {
    let list = events;

    // Type filter
    if (selectedType !== 'all') {
      list = list.filter((e) => e.type === selectedType);
    }

    // Date preset filter
    if (dateFilter !== 'all') {
      const now = new Date();
      let cutoff = new Date();
      if (dateFilter === '7d') cutoff.setDate(now.getDate() - 7);
      else if (dateFilter === '30d') cutoff.setDate(now.getDate() - 30);
      else if (dateFilter === '90d') cutoff.setDate(now.getDate() - 90);
      else if (dateFilter === 'year') cutoff.setFullYear(now.getFullYear() - 1);

      list = list.filter((e) => new Date(e.timestamp) >= cutoff);
    }

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter((e) => {
        const listMatch = (e.batteries_list || []).some(
          (b) =>
            (b.code && b.code.toLowerCase().includes(q)) ||
            (b.serial && b.serial.toLowerCase().includes(q)) ||
            (b.notes && b.notes.toLowerCase().includes(q))
        );

        return (
          listMatch ||
          (e.battery_code && e.battery_code.toLowerCase().includes(q)) ||
          (e.serial_number && e.serial_number.toLowerCase().includes(q)) ||
          (e.reference && e.reference.toLowerCase().includes(q)) ||
          (e.vehicle_number && e.vehicle_number.toLowerCase().includes(q)) ||
          (e.driver_name && e.driver_name.toLowerCase().includes(q)) ||
          (e.staff_name && e.staff_name.toLowerCase().includes(q)) ||
          (e.details && e.details.toLowerCase().includes(q)) ||
          (e.type_label && e.type_label.toLowerCase().includes(q))
        );
      });
    }

    return list;
  }, [events, selectedType, dateFilter, searchTerm]);

  // Group events by day for timeline view
  const groupedTimeline = useMemo(() => {
    const groups = {};
    for (const item of filteredEvents) {
      const dateKey = new Date(item.timestamp).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(item);
    }
    return Object.entries(groups).map(([date, items]) => ({ date, items }));
  }, [filteredEvents]);

  // Filtered batteries inside the active truck modal
  const modalFilteredBatteries = useMemo(() => {
    if (!selectedTruckEvent?.batteries_list) return [];
    if (!modalSearch.trim()) return selectedTruckEvent.batteries_list;
    const q = modalSearch.toLowerCase().trim();
    return selectedTruckEvent.batteries_list.filter(
      (b) =>
        (b.code && b.code.toLowerCase().includes(q)) ||
        (b.serial && b.serial.toLowerCase().includes(q)) ||
        (b.notes && b.notes.toLowerCase().includes(q)) ||
        (b.status && b.status.toLowerCase().includes(q))
    );
  }, [selectedTruckEvent, modalSearch]);

  // Table Columns Definition
  const tableColumns = [
    {
      key: 'timestamp',
      label: 'Date & Time',
      width: '18%',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-800 dark:text-neutral-100 whitespace-nowrap">
            {formatEventTime(row.timestamp)}
          </span>
          <span className="text-xs text-slate-400 dark:text-neutral-500">
            {formatRelativeTime(row.timestamp)}
          </span>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Event Type',
      width: '18%',
      render: (row) => {
        const conf = EVENT_CONFIG[row.type] || EVENT_CONFIG.intake;
        const Icon = conf.icon;
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${conf.bg}`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{row.type_label || conf.label}</span>
          </span>
        );
      },
    },
    {
      key: 'details',
      label: 'Activity & Shipment Overview',
      width: '38%',
      render: (row) => {
        const isTruckBatch = row.batteries_list && row.batteries_list.length > 0;
        const count = row.battery_count || (row.batteries_list ? row.batteries_list.length : 1);

        return (
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-slate-800 dark:text-neutral-100 leading-snug">
              {row.details || '—'}
            </p>

            {isTruckBatch && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTruckEvent(row);
                    setModalSearch('');
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-2xs transition-all cursor-pointer"
                >
                  <FiMaximize2 className="w-3 h-3" />
                  <span>View Truck Details ({count} Batteries)</span>
                </button>

                {row.batteries_list.slice(0, 3).map((b) => (
                  <Link
                    key={b.code}
                    to={`/batteries/${encodeURIComponent(b.code)}`}
                    className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:text-neutral-300 transition-colors"
                  >
                    {b.code}
                  </Link>
                ))}
                {row.batteries_list.length > 3 && (
                  <span className="text-[11px] font-bold text-slate-400">
                    +{row.batteries_list.length - 3} more
                  </span>
                )}
              </div>
            )}

            {row.battery_code && !isTruckBatch && (
              <Link
                to={`/batteries/${encodeURIComponent(row.battery_code)}`}
                className="font-mono font-bold text-xs text-brand-600 hover:underline dark:text-emerald-400 inline-flex items-center gap-1"
              >
                <span>{row.battery_code}</span>
                <FiExternalLink className="w-3 h-3 opacity-60" />
              </Link>
            )}

            {row.amount && (
              <span className="inline-block text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 rounded">
                Billed: £{Number(row.amount).toFixed(2)}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'logistics',
      label: 'Logistics / Truck',
      width: '26%',
      render: (row) => {
        if (row.vehicle_number || row.driver_name) {
          return (
            <div className="flex flex-col text-xs text-slate-600 dark:text-neutral-400 space-y-0.5">
              {row.vehicle_number && (
                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                  <FiTruck className="w-3.5 h-3.5 text-blue-500" />
                  <span>Truck {row.vehicle_number}</span>
                </span>
              )}
              {row.driver_name && <span>Driver: {row.driver_name}</span>}
              {row.verified_by_client && (
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <FiCheckCircle className="w-3 h-3" />
                  <span>Verified Delivery</span>
                </span>
              )}
            </div>
          );
        }
        if (row.staff_name) {
          return (
            <span className="text-xs text-slate-600 dark:text-neutral-400 flex items-center gap-1">
              <FiUser className="w-3 h-3 text-slate-400" />
              <span>{row.staff_name}</span>
            </span>
          );
        }
        return <span className="text-slate-400">—</span>;
      },
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <PageHeader
            title="History & Activity"
            description="Complete chronological audit of your battery fleet — truck-wise packed batches, workshop intakes, service logs, returns, and invoices."
          />
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={fetchHistory}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 dark:bg-white/5 dark:text-neutral-200 dark:border-white/10 dark:hover:bg-white/10 shadow-2xs transition-all cursor-pointer"
          >
            <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => exportHistoryToCsv(filteredEvents)}
            disabled={!filteredEvents.length}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition-all hover:brightness-110 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            style={{ backgroundColor: accent }}
          >
            <FiDownload className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ── KPI Summary Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
              Total Events
            </span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-neutral-300">
              <FiActivity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {summary?.total_events ?? events.length}
            </span>
            <p className="text-[11px] text-slate-400 dark:text-neutral-500 mt-0.5">Recorded lifecycle</p>
          </div>
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-white p-4 shadow-xs dark:border-indigo-900/30 dark:from-indigo-950/20 dark:to-transparent flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Packed Batches
            </span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <FiPackage className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-indigo-950 dark:text-indigo-200">
              {summary?.packed_count ?? 0}
            </span>
            <p className="text-[11px] text-indigo-600/70 dark:text-indigo-400/70 mt-0.5">Trucks packed</p>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/50 to-white p-4 shadow-xs dark:border-blue-900/30 dark:from-blue-950/20 dark:to-transparent flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Intakes
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <FiTruck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-blue-950 dark:text-blue-200">
              {summary?.intake_count ?? 0}
            </span>
            <p className="text-[11px] text-blue-600/70 dark:text-blue-400/70 mt-0.5">Workshop arrivals</p>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/50 to-white p-4 shadow-xs dark:border-amber-900/30 dark:from-amber-950/20 dark:to-transparent flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Repaired
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <FiTool className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-amber-950 dark:text-amber-200">
              {summary?.repair_count ?? 0}
            </span>
            <p className="text-[11px] text-amber-600/70 dark:text-amber-400/70 mt-0.5">Repairs completed</p>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/50 to-white p-4 shadow-xs dark:border-emerald-900/30 dark:from-emerald-950/20 dark:to-transparent flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Returned Trucks
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <FiCheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-emerald-950 dark:text-emerald-200">
              {summary?.return_count ?? 0}
            </span>
            <p className="text-[11px] text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">Trucks delivered</p>
          </div>
        </div>

        <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50/50 to-white p-4 shadow-xs dark:border-purple-900/30 dark:from-purple-950/20 dark:to-transparent flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Invoices
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <FiFileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-purple-950 dark:text-purple-200">
              {summary?.invoice_count ?? 0}
            </span>
            <p className="text-[11px] text-purple-600/70 dark:text-purple-400/70 mt-0.5">Statements issued</p>
          </div>
        </div>
      </div>

      {/* ── Filter & Search Control Panel ───────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-white/5 space-y-4">
        {/* Top bar: Type Filter Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: 'all', label: 'All Activity', count: events.length },
            { id: 'packed', label: 'Trucks Packed', count: summary?.packed_count },
            { id: 'intake', label: 'Workshop Intakes', count: summary?.intake_count },
            { id: 'repair', label: 'Repairs & Services', count: summary?.repair_count },
            { id: 'return', label: 'Trucks Returned', count: summary?.return_count },
            { id: 'invoice', label: 'Invoices', count: summary?.invoice_count },
          ].map((tab) => {
            const active = selectedType === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedType(tab.id)}
                className={`shrink-0 flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  active
                    ? 'text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/70 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10'
                }`}
                style={active ? { backgroundColor: accent } : {}}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count !== null && (
                  <span
                    className={`px-1.5 py-0.5 text-[10px] rounded-full font-black ${
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-neutral-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search, Time Preset & View Mode Toggle */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-white/5">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
            <input
              type="text"
              placeholder="Search truck number, driver, battery ID, or details..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 dark:bg-white/5 dark:border-white/10 dark:text-white dark:placeholder:text-neutral-500 transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Date Presets & View Mode Toggle */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-white/5 p-1 rounded-xl border border-slate-200/80 dark:border-white/10">
              <FiCalendar className="w-3.5 h-3.5 text-slate-400 ml-2" />
              {[
                { id: 'all', label: 'All Time' },
                { id: '30d', label: '30 Days' },
                { id: '90d', label: '90 Days' },
                { id: 'year', label: '1 Year' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDateFilter(opt.id)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    dateFilter === opt.id
                      ? 'bg-white shadow-2xs text-slate-900 dark:bg-white/20 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* View Mode Switch */}
            <div className="flex items-center bg-slate-50 dark:bg-white/5 p-1 rounded-xl border border-slate-200/80 dark:border-white/10">
              <button
                type="button"
                onClick={() => setViewMode('timeline')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  viewMode === 'timeline'
                    ? 'bg-white shadow-2xs text-slate-900 dark:bg-white/20 dark:text-white'
                    : 'text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white'
                }`}
                title="Timeline View"
              >
                <FiClock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Timeline</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white shadow-2xs text-slate-900 dark:bg-white/20 dark:text-white'
                    : 'text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white'
                }`}
                title="Table View"
              >
                <FiList className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content Area ───────────────────────────────────────── */}
      {loading && (
        <div className="py-16 text-center">
          <TableState>Loading fleet history…</TableState>
        </div>
      )}

      {error && (
        <div className="py-12">
          <TableState tone="error">{error}</TableState>
        </div>
      )}

      {!loading && !error && filteredEvents.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/10 p-12 text-center bg-white/50 dark:bg-white/2">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 dark:text-neutral-500 mb-3">
            <FiActivity className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-neutral-200">
            No history events found
          </h3>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1 max-w-sm mx-auto">
            {searchTerm || selectedType !== 'all' || dateFilter !== 'all'
              ? 'Try changing or clearing your search and filter criteria.'
              : 'As truck batches are packed, delivered, repaired, or returned, all lifecycle activity will appear here automatically.'}
          </p>
          {(searchTerm || selectedType !== 'all' || dateFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedType('all');
                setDateFilter('all');
              }}
              className="mt-4 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:text-neutral-200 dark:hover:bg-white/20 transition-all cursor-pointer"
            >
              Reset All Filters
            </button>
          )}
        </div>
      )}

      {/* ── Timeline View ───────────────────────────────────────────── */}
      {!loading && !error && filteredEvents.length > 0 && viewMode === 'timeline' && (
        <div className="space-y-8">
          {groupedTimeline.map((group) => (
            <div key={group.date} className="relative">
              {/* Day Header Pill */}
              <div className="sticky top-20 z-10 mb-4 flex items-center gap-3">
                <span className="px-3.5 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider bg-slate-900 text-white dark:bg-white/15 dark:text-white shadow-sm flex items-center gap-1.5">
                  <FiCalendar className="w-3.5 h-3.5 opacity-70" />
                  <span>{group.date}</span>
                </span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-white/10" />
                <span className="text-xs font-semibold text-slate-400 dark:text-neutral-500">
                  {group.items.length} {group.items.length === 1 ? 'event' : 'events'}
                </span>
              </div>

              {/* Day Items Vertical Track */}
              <div className="relative pl-6 sm:pl-8 space-y-4 before:absolute before:left-2.5 sm:before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-white/10">
                {group.items.map((event) => {
                  const conf = EVENT_CONFIG[event.type] || EVENT_CONFIG.intake;
                  const Icon = conf.icon;
                  const isTruckBatch = event.batteries_list && event.batteries_list.length > 0;
                  const count = event.battery_count || (event.batteries_list ? event.batteries_list.length : 1);

                  return (
                    <div
                      key={event.id}
                      className="group relative rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs transition-all hover:border-slate-300 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20"
                    >
                      {/* Timeline Node Dot */}
                      <span
                        className={`absolute -left-6 sm:-left-8 top-5 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full ring-4 ring-white dark:ring-neutral-900 ${conf.dot}`}
                      />

                      {/* Event Card Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-white/5">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${conf.bg}`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            <span>{event.type_label || conf.label}</span>
                          </span>

                          {event.vehicle_number && (
                            <span className="font-mono text-xs font-extrabold text-slate-800 dark:text-neutral-100 bg-slate-100 dark:bg-white/10 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-white/5 flex items-center gap-1">
                              <FiTruck className="w-3.5 h-3.5 text-blue-500" />
                              <span>Truck {event.vehicle_number}</span>
                            </span>
                          )}

                          {isTruckBatch && (
                            <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                              {count} {count === 1 ? 'Battery' : 'Batteries'}
                            </span>
                          )}

                          {event.battery_code && !isTruckBatch && (
                            <Link
                              to={`/batteries/${encodeURIComponent(event.battery_code)}`}
                              className="font-mono font-bold text-xs sm:text-sm text-brand-600 hover:underline dark:text-emerald-400 flex items-center gap-1 bg-slate-50 dark:bg-white/5 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-white/5"
                            >
                              <span>{event.battery_code}</span>
                              <FiExternalLink className="w-3 h-3 opacity-60" />
                            </Link>
                          )}
                        </div>

                        {/* Timestamp & Relative Badge */}
                        <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-neutral-500">
                          <span className="font-medium text-slate-600 dark:text-neutral-300">
                            {formatEventTime(event.timestamp)}
                          </span>
                          <span>•</span>
                          <span className="font-semibold text-slate-500 dark:text-neutral-400">
                            {formatRelativeTime(event.timestamp)}
                          </span>
                        </div>
                      </div>

                      {/* Event Details Body */}
                      <div className="mt-3 text-sm text-slate-700 dark:text-neutral-200 leading-relaxed flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="space-y-2">
                          <p className="font-medium text-slate-800 dark:text-neutral-100">{event.details}</p>

                          {/* Batteries Quick Preview for Truck Shipments */}
                          {isTruckBatch && (
                            <div className="flex items-center gap-1.5 flex-wrap pt-1">
                              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                                Batteries on Truck:
                              </span>
                              {event.batteries_list.slice(0, 5).map((b) => (
                                <Link
                                  key={b.code}
                                  to={`/batteries/${encodeURIComponent(b.code)}`}
                                  className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-neutral-200 dark:hover:bg-white/20 transition-all font-semibold"
                                >
                                  {b.code}
                                </Link>
                              ))}
                              {event.batteries_list.length > 5 && (
                                <span className="text-xs font-bold text-slate-500 dark:text-neutral-400">
                                  +{event.batteries_list.length - 5} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Truck Details Action Button */}
                        {isTruckBatch && (
                          <div className="shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTruckEvent(event);
                                setModalSearch('');
                              }}
                              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-2xs hover:shadow-md transition-all cursor-pointer"
                            >
                              <FiMaximize2 className="w-3.5 h-3.5" />
                              <span>View Truck Details</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Event Tags & Meta Footer */}
                      <div className="mt-3.5 flex items-center gap-2 flex-wrap pt-2 text-xs border-t border-slate-100 dark:border-white/5">
                        {event.driver_name && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 dark:bg-white/5 dark:text-neutral-300 font-medium">
                            <FiUser className="w-3 h-3 text-slate-400" />
                            <span>Driver: {event.driver_name}</span>
                          </span>
                        )}

                        {event.amount && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 font-bold">
                            <FiFileText className="w-3 h-3 text-purple-500" />
                            <span>Billed: £{Number(event.amount).toFixed(2)}</span>
                          </span>
                        )}

                        {event.verified_by_client && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 font-bold">
                            <FiCheckCircle className="w-3 h-3 text-emerald-500" />
                            <span>Verified by Client</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Table View ──────────────────────────────────────────────── */}
      {!loading && !error && filteredEvents.length > 0 && viewMode === 'table' && (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden dark:border-white/10 dark:bg-white/5">
          <DataTable
            columns={tableColumns}
            rows={filteredEvents}
            showRowNumber
            emptyMessage="No events found matching your filter criteria."
          />
        </div>
      )}

      {/* ── Truck Shipment Details Modal ─────────────────────────────── */}
      {selectedTruckEvent && (
        <Modal
          title={`Truck Shipment — ${selectedTruckEvent.vehicle_number ? `Truck ${selectedTruckEvent.vehicle_number}` : selectedTruckEvent.reference}`}
          description={`${selectedTruckEvent.type_label} · ${formatEventTime(selectedTruckEvent.timestamp)}`}
          onClose={() => setSelectedTruckEvent(null)}
          size="5xl"
        >
          <div className="space-y-5">
            {/* Top Shipment Meta Card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Truck Number</span>
                <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                  {selectedTruckEvent.vehicle_number ? `🚛 ${selectedTruckEvent.vehicle_number}` : '—'}
                </p>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Driver</span>
                <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                  {selectedTruckEvent.driver_name || '—'}
                </p>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Batteries</span>
                <p className="text-sm font-black text-blue-600 dark:text-blue-400 mt-0.5">
                  {selectedTruckEvent.batteries_list?.length || 0} Units
                </p>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Status</span>
                <p className="text-sm font-bold text-slate-800 dark:text-neutral-200 mt-0.5">
                  {selectedTruckEvent.type_label}
                </p>
              </div>
            </div>

            {/* In-Modal Search & Export bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                <input
                  type="text"
                  placeholder="Search battery ID or serial on this truck..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 dark:bg-white/5 dark:border-white/10 dark:text-white"
                />
              </div>

              <button
                type="button"
                onClick={() => exportTruckManifestCsv(selectedTruckEvent)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-2xs cursor-pointer"
              >
                <FiDownload className="w-3.5 h-3.5" />
                <span>Export Truck Manifest</span>
              </button>
            </div>

            {/* Batteries List Table */}
            <div className="max-h-[50vh] overflow-y-auto rounded-2xl border border-slate-200/80 dark:border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-neutral-300 font-bold sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5">#</th>
                    <th className="px-4 py-2.5">Battery ID</th>
                    <th className="px-4 py-2.5">Serial Number</th>
                    <th className="px-4 py-2.5">Client Notes / Issue</th>
                    <th className="px-4 py-2.5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {modalFilteredBatteries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        No batteries found matching "{modalSearch}"
                      </td>
                    </tr>
                  ) : (
                    modalFilteredBatteries.map((b, idx) => (
                      <tr key={b.code || idx} className="hover:bg-slate-50/80 dark:hover:bg-white/5">
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
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:text-neutral-200"
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
          </div>
        </Modal>
      )}
    </div>
  );
}

export default ClientHistoryPage;
