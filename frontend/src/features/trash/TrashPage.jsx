import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../services/api-client';
import PageHeader from '../../components/ui/primitives/PageHeader';
import Badge from '../../components/ui/primitives/Badge';
import Button from '../../components/ui/primitives/Button';
import TableState from '../../components/ui/table/TableState';
import ConfirmModal from '../../components/ui/overlays/ConfirmModal';
import { useSelector } from 'react-redux';

const ITEM_TYPES = [
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

const TYPE_CONFIG = {
  battery: { label: 'Battery', tone: 'good', bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  truck_intake: { label: 'Truck Intake', tone: 'info', bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  staff: { label: 'Staff Member', tone: 'testing', bg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
  part: { label: 'Inventory Part', tone: 'warning', bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  invoice: { label: 'Invoice', tone: 'critical', bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
  client: { label: 'Client', tone: 'info', bg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20' },
  service: { label: 'Service', tone: 'neutral', bg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' },
  issue_reason: { label: 'Issue Reason', tone: 'warning', bg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' },
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

  // Filters & pagination
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 15 });

  // Modals
  const [deleteTarget, setDeleteTarget] = useState(null);
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

  // Search debounce
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
      fetchStats();
      fetchTrash();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to empty trash');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                <line x1="10" x2="10" y1="11" y2="17" />
                <line x1="14" x2="14" y1="11" y2="17" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Trash Bin
              </h1>
              <p className="text-sm text-slate-500 dark:text-neutral-400">
                Audit trail of deleted items with detailed logs of who deleted them and when.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            onClick={() => {
              fetchStats();
              fetchTrash();
            }}
            className="flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
            Refresh
          </Button>

          {isSuperAdmin && stats.total > 0 && (
            <Button
              variant="danger"
              onClick={() => setEmptyTrashModal(true)}
              className="flex items-center gap-1.5 border border-red-300 dark:border-red-800"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              </svg>
              Empty Trash
            </Button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <div
          onClick={() => { setSelectedType('all'); setPage(1); }}
          className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
            selectedType === 'all'
              ? 'border-red-500 bg-red-50/50 shadow-sm dark:border-red-500/50 dark:bg-red-950/20'
              : 'border-slate-200 bg-white hover:border-slate-300 dark:border-surface-700 dark:bg-surface-800'
          }`}
        >
          <div className="text-xs font-medium text-slate-500 dark:text-neutral-400">Total Deleted</div>
          <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{stats.total || 0}</div>
        </div>

        {Object.entries(TYPE_CONFIG).map(([typeKey, cfg]) => {
          const count = stats.byType?.[typeKey] || 0;
          const isSelected = selectedType === typeKey;
          return (
            <div
              key={typeKey}
              onClick={() => { setSelectedType(isSelected ? 'all' : typeKey); setPage(1); }}
              className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                isSelected
                  ? 'border-brand-500 bg-brand-50/50 shadow-sm dark:border-brand-500/50 dark:bg-brand-950/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 dark:border-surface-700 dark:bg-surface-800'
              }`}
            >
              <div className="text-xs font-medium text-slate-500 dark:text-neutral-400">{cfg.label}s</div>
              <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{count}</div>
            </div>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-surface-700 dark:bg-surface-800 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" x2="16.65" y1="21" y2="16.65" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Search deleted items by title, detail, or user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-surface-600 dark:bg-surface-700/50 dark:text-neutral-100 dark:placeholder-neutral-400 dark:focus:border-brand-400 dark:focus:bg-surface-800"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedType}
            onChange={(e) => { setSelectedType(e.target.value); setPage(1); }}
            className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-surface-600 dark:bg-surface-700 dark:text-neutral-200"
          >
            {ITEM_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            title="Start date"
            className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-sm text-slate-700 focus:border-brand-500 focus:outline-none dark:border-surface-600 dark:bg-surface-700 dark:text-neutral-200"
          />

          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            title="End date"
            className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-sm text-slate-700 focus:border-brand-500 focus:outline-none dark:border-surface-600 dark:bg-surface-700 dark:text-neutral-200"
          />

          {(search || selectedType !== 'all' || startDate || endDate) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSelectedType('all');
                setStartDate('');
                setEndDate('');
                setPage(1);
              }}
              className="rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-neutral-400 dark:hover:bg-surface-700 dark:hover:text-neutral-200"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {error && <TableState tone="error">{error}</TableState>}

      {loading ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white dark:border-surface-700 dark:bg-surface-800">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          <p className="mt-3 text-sm text-slate-500 dark:text-neutral-400">Loading trash bin...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-16 text-center dark:border-surface-700 dark:bg-surface-800/40">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-surface-700 dark:text-neutral-400">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </div>
          <h3 className="mt-4 text-base font-semibold text-slate-800 dark:text-neutral-200">
            {search || selectedType !== 'all' ? 'No matching deleted items' : 'Trash Bin is Empty'}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-neutral-400">
            {search || selectedType !== 'all'
              ? 'Try changing your search term or adjusting filters to find what you are looking for.'
              : 'Items deleted across batteries, truck intakes, parts, and staff will appear here with an audit of who deleted them and when.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-surface-700 dark:bg-surface-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-surface-700 dark:bg-surface-900/50 dark:text-neutral-400">
                <tr>
                  <th scope="col" className="px-5 py-3.5">Item & Details</th>
                  <th scope="col" className="px-5 py-3.5">Type</th>
                  <th scope="col" className="px-5 py-3.5">Deleted By</th>
                  <th scope="col" className="px-5 py-3.5">Deleted When</th>
                  <th scope="col" className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-surface-700">
                {items.map((item) => {
                  const cfg = TYPE_CONFIG[item.item_type] || {
                    label: item.item_type,
                    tone: 'neutral',
                    bg: 'bg-slate-500/10 text-slate-600 dark:text-neutral-300',
                  };
                  return (
                    <tr
                      key={item.id}
                      className="group transition-colors hover:bg-slate-50/75 dark:hover:bg-surface-750"
                    >
                      {/* Item Title & Subtitle */}
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <div>
                            <Link
                              to={`/trash/${item.id}`}
                              className="font-semibold text-slate-900 hover:text-brand-600 hover:underline dark:text-white dark:hover:text-brand-400"
                            >
                              {item.title}
                            </Link>
                            {item.subtitle && (
                              <p className="mt-0.5 text-xs text-slate-500 dark:text-neutral-400">
                                {item.subtitle}
                              </p>
                            )}
                            {item.original_id && (
                              <span className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 dark:bg-surface-700 dark:text-neutral-300">
                                Original ID: #{item.original_id}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.bg}`}
                        >
                          {cfg.label}
                        </span>
                      </td>

                      {/* Deleted By (User info) */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700 dark:bg-surface-600 dark:text-neutral-100">
                            {getInitials(item.deleted_by_name)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-slate-900 dark:text-neutral-100">
                                {item.deleted_by_name || 'System / Admin'}
                              </span>
                              {item.deleted_by_role && (
                                <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] uppercase font-semibold text-slate-600 dark:bg-surface-700 dark:text-neutral-300">
                                  {item.deleted_by_role.replace('_', ' ')}
                                </span>
                              )}
                            </div>
                            {item.deleted_by_email && (
                              <p className="text-xs text-slate-500 dark:text-neutral-400">
                                {item.deleted_by_email}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Deleted When (Timestamp) */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="text-xs font-medium text-slate-800 dark:text-neutral-200">
                          {new Date(item.deleted_at).toLocaleString([], {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-400 dark:text-neutral-500">
                          {formatRelativeTime(item.deleted_at)}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/trash/${item.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-brand-600 dark:border-surface-600 dark:bg-surface-700 dark:text-neutral-200 dark:hover:bg-surface-650"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                            Inspect
                          </Link>

                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            title="Delete Permanently"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                              <line x1="18" x2="6" y1="6" y2="18" />
                              <line x1="6" x2="18" y1="6" y2="18" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 dark:border-surface-700">
              <div className="text-xs text-slate-500 dark:text-neutral-400">
                Showing <span className="font-medium text-slate-700 dark:text-neutral-200">{(page - 1) * pagination.limit + 1}</span> to{' '}
                <span className="font-medium text-slate-700 dark:text-neutral-200">{Math.min(page * pagination.limit, pagination.total)}</span> of{' '}
                <span className="font-medium text-slate-700 dark:text-neutral-200">{pagination.total}</span> items
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 text-xs"
                >
                  Previous
                </Button>
                <span className="text-xs font-medium text-slate-600 dark:text-neutral-300">
                  Page {page} of {pagination.totalPages}
                </span>
                <Button
                  variant="secondary"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  className="px-2.5 py-1 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Item Modal */}
      {deleteTarget && (
        <ConfirmModal
          open={Boolean(deleteTarget)}
          title="Permanently Delete Item?"
          description={`Are you sure you want to permanently purge "${deleteTarget.title}" from the trash bin? This action cannot be undone.`}
          confirmLabel="Permanently Delete"
          cancelLabel="Cancel"
          tone="critical"
          isLoading={actionLoading}
          onConfirm={handlePermanentDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Empty Trash Modal */}
      {emptyTrashModal && (
        <ConfirmModal
          open={emptyTrashModal}
          title="Empty Entire Trash Bin?"
          description="Are you sure you want to permanently delete all archived items in the trash? All deleted history records will be completely removed."
          confirmLabel="Empty Trash"
          cancelLabel="Cancel"
          tone="critical"
          isLoading={actionLoading}
          onConfirm={handleEmptyTrash}
          onCancel={() => setEmptyTrashModal(false)}
        />
      )}
    </div>
  );
}
