import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  FiTrash2,
  FiRefreshCw,
  FiSearch,
  FiX,
  FiRotateCcw,
  FiEye,
  FiCalendar,
  FiAlertTriangle,
  FiChevronLeft,
  FiChevronRight,
  FiBox,
  FiUser,
  FiTruck,
  FiFileText,
  FiTool,
  FiShield,
  FiArchive,
} from 'react-icons/fi';
import apiClient from '../../services/api-client';
import TableState from '../../components/ui/table/TableState';
import ConfirmModal from '../../components/ui/overlays/ConfirmModal';
import RestoreModal from './RestoreModal';

const ITEM_TYPES = [
  { value: 'all', label: 'All Items' },
  { value: 'battery', label: 'Batteries', icon: FiBox },
  { value: 'truck_intake', label: 'Truck Intakes', icon: FiTruck },
  { value: 'staff', label: 'Staff', icon: FiUser },
  { value: 'part', label: 'Parts', icon: FiTool },
  { value: 'invoice', label: 'Invoices', icon: FiFileText },
  { value: 'client', label: 'Clients', icon: FiShield },
  { value: 'service', label: 'Services', icon: FiTool },
  { value: 'issue_reason', label: 'Issue Reasons', icon: FiAlertTriangle },
];

const TYPE_CONFIG = {
  battery: {
    label: 'Battery',
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40',
    iconBg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50',
    icon: FiBox,
  },
  truck_intake: {
    label: 'Truck Intake',
    bg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40',
    iconBg: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border-blue-100 dark:border-blue-800/50',
    icon: FiTruck,
  },
  staff: {
    label: 'Staff Member',
    bg: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40',
    iconBg: 'bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 border-purple-100 dark:border-purple-800/50',
    icon: FiUser,
  },
  part: {
    label: 'Inventory Part',
    bg: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40',
    iconBg: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border-amber-100 dark:border-amber-800/50',
    icon: FiTool,
  },
  invoice: {
    label: 'Invoice',
    bg: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40',
    iconBg: 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border-rose-100 dark:border-rose-800/50',
    icon: FiFileText,
  },
  client: {
    label: 'Client',
    bg: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800/40',
    iconBg: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/60 dark:text-cyan-400 border-cyan-100 dark:border-cyan-800/50',
    icon: FiShield,
  },
  service: {
    label: 'Service',
    bg: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/40',
    iconBg: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800/50',
    icon: FiTool,
  },
  issue_reason: {
    label: 'Issue Reason',
    bg: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/40',
    iconBg: 'bg-orange-50 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400 border-orange-100 dark:border-orange-800/50',
    icon: FiAlertTriangle,
  },
};

function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function getInitials(name) {
  if (!name) return 'U';
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function TrashPage() {
  const currentUser = useSelector((state) => state.auth.user);
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ total: 0, byType: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 15 });

  // Modals
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [emptyTrashModal, setEmptyTrashModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await apiClient.get('/trash/stats');
      setStats(res.data.data);
    } catch (err) {
      console.error('Failed to load trash stats:', err);
    }
  };

  const fetchTrash = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit: 15,
        search: search.trim() || undefined,
        itemType: selectedType !== 'all' ? selectedType : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };
      const res = await apiClient.get('/trash', { params });
      setItems(res.data.data || []);
      setPagination(res.data.pagination || { total: 0, totalPages: 1, limit: 15 });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch trash items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchTrash();
  }, [page, selectedType, startDate, endDate]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchTrash();
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const handlePermanentDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await apiClient.delete(`/trash/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchStats();
      fetchTrash();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to permanently delete item');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEmptyTrash = async () => {
    setActionLoading(true);
    try {
      await apiClient.delete('/trash');
      setEmptyTrashModal(false);
      setPage(1);
      fetchStats();
      fetchTrash();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to empty trash');
    } finally {
      setActionLoading(false);
    }
  };

  const isFiltered = Boolean(search || selectedType !== 'all' || startDate || endDate);
  const resetFilters = () => {
    setSearch('');
    setSelectedType('all');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  return (
    <div className="space-y-2.5 sm:space-y-4 pb-12 w-full max-w-full overflow-x-hidden">
      {/* Executive Header Card — COMPACT */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-neutral-100">
                Trash Bin
              </h1>
              <span className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/40 dark:text-rose-300">
                Audit Archive
              </span>
            </div>
            <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500 dark:text-neutral-400">
              Audit trail of deleted records across batteries, truck intakes, parts, staff, and invoices.
            </p>
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => {
                fetchStats();
                fetchTrash();
              }}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 shadow-2xs transition-colors cursor-pointer"
            >
              <FiRefreshCw className={`h-3 w-3 ${loading ? 'animate-spin text-rose-600' : 'text-slate-500'}`} />
              <span>Refresh</span>
            </button>

            {isSuperAdmin && stats.total > 0 && (
              <button
                type="button"
                onClick={() => setEmptyTrashModal(true)}
                className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 px-2.5 py-1 text-[11px] font-bold text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/40 dark:text-rose-300 shadow-2xs transition-colors cursor-pointer"
              >
                <FiTrash2 className="h-3 w-3 text-rose-600" />
                <span>Empty Trash</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Counters Strip — Ultra-compact Single Line */}
        <div className="mt-2.5 flex items-center gap-2 text-[10.5px] text-slate-500 dark:text-neutral-400 border-t border-slate-100 pt-2 dark:border-white/5 flex-wrap">
          <span>
            Total Deleted:{' '}
            <strong className="font-bold text-slate-900 dark:text-neutral-100">
              {stats.total || 0}
            </strong>
          </span>
          <span className="text-slate-300 dark:text-neutral-600">•</span>
          <span>
            Batteries:{' '}
            <strong className="font-bold text-emerald-700 dark:text-emerald-300">
              {stats.byType?.battery || 0}
            </strong>
          </span>
          <span className="text-slate-300 dark:text-neutral-600">•</span>
          <span>
            Intakes:{' '}
            <strong className="font-bold text-blue-700 dark:text-blue-300">
              {stats.byType?.truck_intake || 0}
            </strong>
          </span>
          <span className="text-slate-300 dark:text-neutral-600">•</span>
          <span>
            Parts:{' '}
            <strong className="font-bold text-amber-700 dark:text-amber-300">
              {stats.byType?.part || 0}
            </strong>
          </span>
          <span className="text-slate-300 dark:text-neutral-600">•</span>
          <span>
            Staff:{' '}
            <strong className="font-bold text-purple-700 dark:text-purple-300">
              {stats.byType?.staff || 0}
            </strong>
          </span>
        </div>
      </div>

      {/* Type Filter Pills Bar — WRAPPING (Zero Horizontal Scrolling) */}
      <div className="flex flex-wrap items-center gap-1 pb-0.5">
        {ITEM_TYPES.map((t) => {
          const isSelected = selectedType === t.value;
          const count = t.value === 'all' ? stats.total || 0 : stats.byType?.[t.value] || 0;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                setSelectedType(t.value);
                setPage(1);
              }}
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] sm:text-[11px] font-bold transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-300'
              }`}
            >
              <span>{t.label}</span>
              <span
                className={`rounded px-1 text-[9px] sm:text-[9.5px] font-extrabold ${
                  isSelected
                    ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 dark:bg-surface-700 dark:text-neutral-300'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Toolbar: Search & Date Range Filters — COMPACT & FULLY RESPONSIVE */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-2 sm:p-2.5 shadow-2xs dark:border-white/10 dark:bg-surface-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        {/* Search Box */}
        <div className="relative w-full sm:w-auto sm:min-w-[200px] flex-1 sm:max-w-md">
          <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by title, detail, or user…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-8 pr-7 py-1 text-xs text-slate-800 placeholder-slate-400 focus:border-rose-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-surface-800 dark:text-neutral-100 transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 cursor-pointer"
            >
              <FiX className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Date Controls & Reset */}
        <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-neutral-400 flex-1 sm:flex-none min-w-0">
            <span className="shrink-0">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full sm:w-auto rounded-md border border-slate-200 bg-slate-50/70 px-1.5 py-0.5 text-xs text-slate-700 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200"
            />
          </div>

          <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-neutral-400 flex-1 sm:flex-none min-w-0">
            <span className="shrink-0">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full sm:w-auto rounded-md border border-slate-200 bg-slate-50/70 px-1.5 py-0.5 text-xs text-slate-700 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200"
            />
          </div>

          {isFiltered && (
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-md px-2 py-0.5 text-[11px] font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-surface-800 dark:text-rose-400 transition-colors cursor-pointer shrink-0"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {error && <TableState tone="error">{error}</TableState>}

      {loading ? (
        <div className="flex h-44 flex-col items-center justify-center rounded-xl border border-slate-200/90 bg-white dark:border-white/10 dark:bg-surface-900 shadow-2xs">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-rose-500 border-t-transparent" />
          <p className="mt-2 text-xs text-slate-500 dark:text-neutral-400">Loading trash bin…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-slate-200/90 bg-white p-6 text-center dark:border-white/10 dark:bg-surface-900 shadow-2xs">
          <FiArchive className="mx-auto h-6 w-6 text-slate-400" />
          <h3 className="mt-2 text-xs font-semibold text-slate-800 dark:text-neutral-200">
            {isFiltered ? 'No matching deleted items' : 'Trash Bin is Empty'}
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-neutral-400 max-w-sm mx-auto">
            {isFiltered
              ? 'Try modifying your search query or adjusting type/date filters.'
              : 'Deleted batteries, truck intakes, parts, staff, and invoices will appear here with an audit log.'}
          </p>
        </div>
      ) : (
        <>
          {/* ──────────────── DESKTOP VIEW (>= lg) ──────────────── */}
          <div className="hidden lg:block overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs dark:border-white/10 dark:bg-surface-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-surface-700 dark:bg-surface-900/50 dark:text-neutral-400">
                  <tr>
                    <th scope="col" className="px-4 py-3">Item & Details</th>
                    <th scope="col" className="px-3 py-3">Type</th>
                    <th scope="col" className="px-3 py-3">Deleted By</th>
                    <th scope="col" className="px-3 py-3">Deleted When</th>
                    <th scope="col" className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-surface-700">
                  {items.map((item) => {
                    const cfg = TYPE_CONFIG[item.item_type] || {
                      label: item.item_type,
                      bg: 'bg-slate-100 text-slate-600 border-slate-200',
                      iconBg: 'bg-slate-100 text-slate-600 border-slate-200',
                      icon: FiBox,
                    };
                    const ItemIcon = cfg.icon || FiBox;

                    return (
                      <tr
                        key={item.id}
                        className="group transition-colors hover:bg-slate-50/75 dark:hover:bg-surface-750"
                      >
                        {/* Title & Details */}
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2.5">
                            <div className={`h-7 w-7 rounded-md border flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
                              <ItemIcon className="h-3.5 w-3.5" />
                            </div>
                            <div>
                              <Link
                                to={`/trash/${item.id}`}
                                className="font-bold text-slate-900 hover:text-rose-600 hover:underline dark:text-white dark:hover:text-rose-400"
                              >
                                {item.title}
                              </Link>
                              {item.subtitle && (
                                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-neutral-400">
                                  {item.subtitle}
                                </p>
                              )}
                              {item.original_id && (
                                <span className="mt-0.5 inline-block rounded bg-slate-100 px-1 py-0.2 text-[9.5px] font-mono text-slate-600 dark:bg-surface-700 dark:text-neutral-300">
                                  Original ID: #{item.original_id}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Type Badge */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.2 text-[10px] font-bold ${cfg.bg}`}>
                            {cfg.label}
                          </span>
                        </td>

                        {/* Deleted By */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700 dark:bg-surface-600 dark:text-neutral-100">
                              {getInitials(item.deleted_by_name)}
                            </div>
                            <div>
                              <div className="flex items-center gap-1">
                                <span className="font-semibold text-slate-900 dark:text-neutral-100">
                                  {item.deleted_by_name || 'System / Admin'}
                                </span>
                                {item.deleted_by_role && (
                                  <span className="rounded bg-slate-100 px-1 py-0.2 text-[9px] uppercase font-bold text-slate-600 dark:bg-surface-700 dark:text-neutral-300">
                                    {item.deleted_by_role.replace(/_/g, ' ')}
                                  </span>
                                )}
                              </div>
                              {item.deleted_by_email && (
                                <p className="text-[10px] text-slate-400 dark:text-neutral-400">
                                  {item.deleted_by_email}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Deleted When */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="font-semibold text-slate-800 dark:text-neutral-200">
                            {new Date(item.deleted_at).toLocaleDateString([], {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-neutral-500">
                            {formatRelativeTime(item.deleted_at)}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              to={`/trash/${item.id}`}
                              className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white hover:bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-700 shadow-2xs dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 transition-colors"
                            >
                              <FiEye className="h-2.5 w-2.5 text-slate-400" />
                              <span>Inspect</span>
                            </Link>

                            {item.restorable ? (
                              <button
                                type="button"
                                onClick={() => setRestoreTarget(item)}
                                className="inline-flex items-center gap-0.5 rounded border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 shadow-2xs dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300 transition-colors cursor-pointer"
                              >
                                <FiRotateCcw className="h-2.5 w-2.5 text-emerald-600" />
                                <span>Restore</span>
                              </button>
                            ) : (
                              <span
                                title={item.restore_blocked_reason || 'This item can’t be restored'}
                                className="text-[10px] font-medium text-slate-400 dark:text-neutral-500 cursor-help px-1"
                              >
                                Locked
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              title="Delete Permanently"
                              className="inline-flex items-center rounded border border-rose-200 bg-rose-50 hover:bg-rose-100 p-1 text-rose-600 shadow-2xs dark:border-rose-800/40 dark:bg-rose-950/40 dark:text-rose-300 transition-colors cursor-pointer"
                            >
                              <FiTrash2 className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2.5 dark:border-surface-700">
                <div className="text-[11px] text-slate-500 dark:text-neutral-400">
                  Showing <strong className="font-bold text-slate-700 dark:text-neutral-200">{(page - 1) * pagination.limit + 1}</strong> to{' '}
                  <strong className="font-bold text-slate-700 dark:text-neutral-200">{Math.min(page * pagination.limit, pagination.total)}</strong> of{' '}
                  <strong className="font-bold text-slate-700 dark:text-neutral-200">{pagination.total}</strong> items
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white px-2 py-0.5 text-[10.5px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 shadow-2xs transition-colors"
                  >
                    <FiChevronLeft className="h-3 w-3" />
                    <span>Prev</span>
                  </button>
                  <span className="text-[10.5px] font-bold text-slate-600 dark:text-neutral-300 px-1">
                    {page} / {pagination.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white px-2 py-0.5 text-[10.5px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 shadow-2xs transition-colors"
                  >
                    <span>Next</span>
                    <FiChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ──────────────── MOBILE CARDS STREAM (< lg) — ZERO HORIZONTAL SCROLLING ──────────────── */}
          <div className="block lg:hidden space-y-2">
            {items.map((item, idx) => {
              const cfg = TYPE_CONFIG[item.item_type] || {
                label: item.item_type,
                bg: 'bg-slate-100 text-slate-600 border-slate-200',
                iconBg: 'bg-slate-100 text-slate-600 border-slate-200',
                icon: FiBox,
              };
              const ItemIcon = cfg.icon || FiBox;

              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-2xs dark:border-white/10 dark:bg-surface-900 space-y-1.5 transition-all hover:border-slate-300 dark:hover:border-white/20"
                >
                  {/* Top Row: Avatar + Title + Type Badge */}
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <div className={`h-6 w-6 rounded-md border flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
                        <ItemIcon className="h-3 w-3" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/trash/${item.id}`}
                          className="font-bold text-xs text-slate-900 dark:text-neutral-100 hover:text-rose-600 truncate block"
                        >
                          {item.title}
                        </Link>
                      </div>
                    </div>

                    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.2 text-[9.5px] font-bold shrink-0 ${cfg.bg}`}>
                      {cfg.label}
                    </span>
                  </div>

                  {/* Subtitle & Original ID */}
                  {(item.subtitle || item.original_id) && (
                    <div className="flex items-center gap-1.5 flex-wrap text-[10.5px] text-slate-500 dark:text-neutral-400">
                      {item.subtitle && <span>{item.subtitle}</span>}
                      {item.original_id && (
                        <span className="rounded bg-slate-100 dark:bg-surface-800 px-1 py-0.2 font-mono text-[9px] text-slate-600 dark:text-neutral-300">
                          #{item.original_id}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Deleted By User & Time Container */}
                  <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2 dark:border-white/5 dark:bg-surface-800/60 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-700 dark:bg-surface-600 dark:text-neutral-100">
                        {getInitials(item.deleted_by_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="font-semibold text-[10.5px] text-slate-800 dark:text-neutral-200 truncate">
                            {item.deleted_by_name || 'System / Admin'}
                          </span>
                          {item.deleted_by_role && (
                            <span className="rounded bg-slate-200/60 dark:bg-surface-700 px-1 py-0.2 text-[8.5px] font-bold uppercase text-slate-600 dark:text-neutral-300">
                              {item.deleted_by_role.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-medium text-slate-500 dark:text-neutral-400 block">
                        {formatRelativeTime(item.deleted_at)}
                      </span>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center justify-between pt-0.5">
                    <Link
                      to={`/trash/${item.id}`}
                      className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white hover:bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 shadow-2xs"
                    >
                      <FiEye className="h-2.5 w-2.5 text-slate-400" />
                      <span>Inspect</span>
                    </Link>

                    <div className="flex items-center gap-1">
                      {item.restorable ? (
                        <button
                          type="button"
                          onClick={() => setRestoreTarget(item)}
                          className="inline-flex items-center gap-0.5 rounded border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300 shadow-2xs cursor-pointer"
                        >
                          <FiRotateCcw className="h-2.5 w-2.5 text-emerald-600" />
                          <span>Restore</span>
                        </button>
                      ) : (
                        <span className="text-[9.5px] text-slate-400 font-medium px-1">
                          Can't restore
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => setDeleteTarget(item)}
                        title="Delete Permanently"
                        className="inline-flex items-center rounded border border-rose-200 bg-rose-50 hover:bg-rose-100 p-1 text-rose-600 dark:border-rose-800/40 dark:bg-rose-950/40 dark:text-rose-300 shadow-2xs cursor-pointer"
                      >
                        <FiTrash2 className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Mobile Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-2xs dark:border-white/10 dark:bg-surface-900">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white px-2 py-0.5 text-[10.5px] font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 shadow-2xs"
                >
                  <FiChevronLeft className="h-3 w-3" />
                  <span>Prev</span>
                </button>
                <span className="text-[10.5px] font-bold text-slate-600 dark:text-neutral-300">
                  Page {page} of {pagination.totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white px-2 py-0.5 text-[10.5px] font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 shadow-2xs"
                >
                  <span>Next</span>
                  <FiChevronRight className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Restore Item Modal */}
      {restoreTarget && (
        <RestoreModal
          item={restoreTarget}
          onClose={() => setRestoreTarget(null)}
          onRestored={() => {
            setRestoreTarget(null);
            fetchStats();
            fetchTrash();
          }}
        />
      )}

      {/* Delete Item Modal */}
      {deleteTarget && (
        <ConfirmModal
          title="Permanently Delete Item?"
          message={`Are you sure you want to permanently purge "${deleteTarget.title}" from the trash bin? This action cannot be undone.`}
          confirmLabel="Permanently Delete"
          requireTyping={false}
          onConfirm={handlePermanentDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Empty Trash Modal */}
      {emptyTrashModal && (
        <ConfirmModal
          title="Empty Entire Trash Bin?"
          message="Are you sure you want to permanently delete all archived items in the trash? All deleted history records will be completely removed."
          confirmLabel="Empty Trash"
          requireTyping={false}
          onConfirm={handleEmptyTrash}
          onCancel={() => setEmptyTrashModal(false)}
        />
      )}
    </div>
  );
}
