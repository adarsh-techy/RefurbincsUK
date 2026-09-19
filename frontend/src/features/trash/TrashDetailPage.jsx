import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import apiClient from '../../services/api-client';
import TableState from '../../components/ui/table/TableState';
import Button from '../../components/ui/primitives/Button';
import ConfirmModal from '../../components/ui/overlays/ConfirmModal';

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
  if (diffDay < 30) return `${diffDay} days ago`;
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

function formatKey(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function TrashDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiClient
      .get(`/trash/${id}`)
      .then((res) => setItem(res.data.data))
      .catch((err) => setError(err.response?.data?.message || 'Trash record not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const handlePermanentDelete = async () => {
    setActionLoading(true);
    try {
      await apiClient.delete(`/trash/${id}`);
      navigate('/trash');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to permanently delete item');
      setActionLoading(false);
    }
  };

  const handleCopyJson = () => {
    if (!item?.item_data) return;
    navigator.clipboard.writeText(JSON.stringify(item.item_data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        <p className="mt-3 text-sm text-slate-500 dark:text-neutral-400">Loading trash item details...</p>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="space-y-4">
        <Link
          to="/trash"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-brand-600 dark:text-neutral-400 dark:hover:text-brand-400"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to Trash Bin
        </Link>
        <TableState tone="error">{error || 'Item not found'}</TableState>
      </div>
    );
  }

  const cfg = TYPE_CONFIG[item.item_type] || {
    label: item.item_type,
    bg: 'bg-slate-500/10 text-slate-600 dark:text-neutral-300',
  };

  const itemData = typeof item.item_data === 'object' && item.item_data !== null ? item.item_data : {};
  const dataKeys = Object.keys(itemData);

  return (
    <div className="space-y-6 pb-16">
      {/* Top Breadcrumb / Back Button */}
      <div className="flex items-center justify-between">
        <Link
          to="/trash"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-brand-600 dark:text-neutral-400 dark:hover:text-brand-400"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to Trash Bin
        </Link>

        <Button
          variant="danger"
          onClick={() => setDeleteModal(true)}
          className="flex items-center gap-1.5 text-xs"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          </svg>
          Permanent Delete
        </Button>
      </div>

      {/* Hero Header Card */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-surface-700 dark:bg-surface-800">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                <line x1="10" x2="10" y1="11" y2="17" />
                <line x1="14" x2="14" y1="11" y2="17" />
              </svg>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.bg}`}>
                  {cfg.label}
                </span>
                {item.original_id && (
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-600 dark:bg-surface-700 dark:text-neutral-300">
                    Original ID: #{item.original_id}
                  </span>
                )}
                <span className="rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
                  Archived / Deleted
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {item.title}
              </h1>
              {item.subtitle && (
                <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">
                  {item.subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-neutral-400">
            <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono dark:border-surface-700 dark:bg-surface-900/60">
              Trash Record #{item.id}
            </span>
          </div>
        </div>
      </div>

      {/* Audit Attribution: WHO DELETED & WHEN (Prominently Highlighted) */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
          Deletion Audit Information
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Who Deleted Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-surface-700 dark:bg-surface-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-surface-700">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-blue-500">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
                Who Deleted This Item
              </div>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                Authorized User
              </span>
            </div>

            <div className="mt-4 flex items-start gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-base font-bold text-white shadow-sm">
                {getInitials(item.deleted_by_name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                    {item.deleted_by_name || 'System / Administrator'}
                  </h3>
                  {item.deleted_by_role && (
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:bg-surface-700 dark:text-neutral-200">
                      {item.deleted_by_role.replace('_', ' ')}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400 break-all">
                  {item.deleted_by_email || 'No email recorded'}
                </p>
                {item.deleted_by_user_id && (
                  <p className="mt-1 text-xs font-mono text-slate-400 dark:text-neutral-500">
                    Account User ID: #{item.deleted_by_user_id}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* When Deleted Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-surface-700 dark:bg-surface-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-surface-700">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-emerald-500">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                When It Was Deleted
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                {formatRelativeTime(item.deleted_at)}
              </span>
            </div>

            <div className="mt-4 space-y-2">
              <div>
                <div className="text-base font-bold text-slate-900 dark:text-white">
                  {new Date(item.deleted_at).toLocaleString([], {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </div>
                <div className="mt-1 text-xs font-mono text-slate-500 dark:text-neutral-400">
                  ISO: {item.deleted_at}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 dark:border-surface-700 dark:text-neutral-400">
                Logged securely at the exact moment of removal from active operations.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Snapshot Details Section */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-surface-700 dark:bg-surface-800">
        <div className="flex flex-col gap-2 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-surface-700">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Deleted Item Data Snapshot
            </h2>
            <p className="text-xs text-slate-500 dark:text-neutral-400">
              State and properties preserved at the exact time of deletion.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowRawJson(!showRawJson)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-surface-600 dark:bg-surface-700 dark:text-neutral-200 dark:hover:bg-surface-650"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              {showRawJson ? 'Hide Raw JSON' : 'Show Raw JSON'}
            </button>

            <button
              type="button"
              onClick={handleCopyJson}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-surface-600 dark:bg-surface-700 dark:text-neutral-200"
            >
              {copied ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-emerald-500">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                  Copy JSON
                </>
              )}
            </button>
          </div>
        </div>

        {/* Formatted Key-Value Grid */}
        <div className="p-5">
          {dataKeys.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-neutral-500">No snapshot attributes stored.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {dataKeys.map((k) => {
                const val = itemData[k];
                const displayVal =
                  val === null || val === undefined
                    ? '—'
                    : typeof val === 'object'
                    ? JSON.stringify(val)
                    : String(val);

                return (
                  <div
                    key={k}
                    className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 dark:border-surface-700/60 dark:bg-surface-900/30"
                  >
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
                      {formatKey(k)}
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-800 dark:text-neutral-100 break-words">
                      {displayVal}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Raw JSON View (Collapsible) */}
          {showRawJson && (
            <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs font-mono text-emerald-400 shadow-inner overflow-x-auto">
              <pre>{JSON.stringify(item.item_data, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>

      {/* Permanent Delete Modal */}
      {deleteModal && (
        <ConfirmModal
          open={deleteModal}
          title="Permanently Delete Item?"
          description={`Are you sure you want to completely purge this ${cfg.label.toLowerCase()} from the trash bin? This permanently removes the audit archive record.`}
          confirmLabel="Permanently Delete"
          cancelLabel="Cancel"
          tone="critical"
          isLoading={actionLoading}
          onConfirm={handlePermanentDelete}
          onCancel={() => setDeleteModal(false)}
        />
      )}
    </div>
  );
}
