import { useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
  FiAlertTriangle,
  FiPlus,
  FiSearch,
  FiX,
  FiEdit2,
  FiTrash2,
  FiCheckCircle,
  FiSlash,
} from 'react-icons/fi';
import useFetchList from '../../utils/use-fetch-list';
import { hasPermission } from '../../utils/permissions';
import DataTable from '../../components/ui/table/DataTable';
import TableState from '../../components/ui/table/TableState';
import Modal from '../../components/ui/overlays/Modal';
import ConfirmModal from '../../components/ui/overlays/ConfirmModal';
import AlertModal from '../../components/ui/overlays/AlertModal';
import RowActions from '../../components/ui/table/RowActions';
import apiClient from '../../services/api-client';
import IssueReasonForm from './IssueReasonForm';

// Manages the "can't service this battery" fault reasons technicians select in the app
function IssueReasonsPage() {
  const { data, loading, error, refetch } = useFetchList('/issue-reasons');
  const user = useSelector((state) => state.auth.user);
  const canManage = hasPermission(user, 'issue_reasons');
  const isSuperAdmin = user?.role === 'super_admin';

  // formTarget: null = closed, 'new' = create form, reason object = edit form
  const [formTarget, setFormTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'disabled'
  const [search, setSearch] = useState('');

  const activeCount = useMemo(
    () => (data || []).filter((r) => r.active).length,
    [data]
  );
  const disabledCount = useMemo(
    () => (data || []).filter((r) => !r.active).length,
    [data]
  );

  const searchLower = search.toLowerCase().trim();
  const filtered = useMemo(() => {
    return (data || [])
      .filter((r) => {
        if (statusFilter === 'active') return r.active;
        if (statusFilter === 'disabled') return !r.active;
        return true;
      })
      .filter((r) => {
        if (!searchLower) return true;
        return (
          r.label?.toLowerCase().includes(searchLower) ||
          String(r.sort_order || '').includes(searchLower)
        );
      })
      .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
  }, [data, statusFilter, searchLower]);

  function handleSaved() {
    refetch();
    setFormTarget(null);
  }

  async function handleConfirmDelete() {
    setDeleteError(null);
    try {
      await apiClient.delete(`/issue-reasons/${deleteTarget.id}`);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      setDeleteError(err.response?.data?.message || err.message);
      setDeleteTarget(null);
    }
  }

  const columns = [
    {
      key: 'sort_order',
      label: 'Order',
      width: '80px',
      render: (row) => (
        <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 dark:bg-surface-800 px-2 py-0.5 rounded">
          #{row.sort_order}
        </span>
      ),
    },
    {
      key: 'label',
      label: 'Fault Reason Description',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-800/50 flex items-center justify-center shrink-0 text-rose-600 dark:text-rose-400">
            <FiAlertTriangle className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="font-bold text-slate-900 dark:text-neutral-100 block">
              {row.label}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'active',
      label: 'Status',
      width: '120px',
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
            row.active
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'border border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-400'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              row.active ? 'bg-emerald-500' : 'bg-slate-400'
            }`}
          />
          <span>{row.active ? 'Active' : 'Disabled'}</span>
        </span>
      ),
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            label: '',
            width: '80px',
            render: (row) => (
              <RowActions
                onEdit={() => setFormTarget(row)}
                onDelete={isSuperAdmin ? () => setDeleteTarget(row) : undefined}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-2.5 sm:space-y-4 pb-10 w-full max-w-full overflow-x-hidden">
      {/* Executive Header Card — COMPACT */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-neutral-100">
                Fault & Issue Reasons
              </h1>
              <span className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/40 dark:text-rose-300">
                Unserviceable Criteria
              </span>
            </div>
            <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500 dark:text-neutral-400">
              Reasons a technician can report when a battery cannot be serviced, tested, or repaired.
            </p>
          </div>

          {canManage && (
            <button
              type="button"
              onClick={() => setFormTarget('new')}
              className="inline-flex items-center gap-1 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
            >
              <FiPlus className="h-3 w-3" />
              <span>Add Reason</span>
            </button>
          )}
        </div>

        {/* Live Counters Strip — Ultra-compact Single Line */}
        <div className="mt-2.5 flex items-center gap-2 text-[10.5px] text-slate-500 dark:text-neutral-400 border-t border-slate-100 pt-2 dark:border-white/5 flex-wrap">
          <span>
            Total: <strong className="font-bold text-slate-900 dark:text-neutral-100">{data?.length || 0}</strong>
          </span>
          <span className="text-slate-300 dark:text-neutral-600">•</span>
          <span>
            Active: <strong className="font-bold text-emerald-700 dark:text-emerald-300">{activeCount}</strong>
          </span>
          <span className="text-slate-300 dark:text-neutral-600">•</span>
          <span>
            Disabled: <strong className="font-bold text-slate-600 dark:text-neutral-300">{disabledCount}</strong>
          </span>
        </div>
      </div>

      {/* Toolbar: Search & Tab Chips — COMPACT & WRAPPING */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-2 sm:p-2.5 shadow-2xs dark:border-white/10 dark:bg-surface-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        {/* Tab Pills — Wrapping */}
        <div className="flex flex-wrap items-center gap-1 pb-0.5 sm:pb-0">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] sm:text-[11px] font-bold transition-colors cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-300'
            }`}
          >
            <span>All</span>
            <span
              className={`rounded px-1 text-[9.5px] font-extrabold ${
                statusFilter === 'all'
                  ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                  : 'bg-slate-200 text-slate-700 dark:bg-surface-700 dark:text-neutral-300'
              }`}
            >
              {data?.length || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
              statusFilter === 'active'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300'
            }`}
          >
            <FiCheckCircle className="h-3 w-3" />
            <span>Active</span>
            <span
              className={`rounded px-1 text-[9.5px] font-extrabold ${
                statusFilter === 'active' ? 'bg-white/20 text-white' : 'bg-emerald-200 text-emerald-800'
              }`}
            >
              {activeCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('disabled')}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
              statusFilter === 'disabled'
                ? 'bg-slate-600 text-white shadow-xs'
                : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-300'
            }`}
          >
            <FiSlash className="h-3 w-3" />
            <span>Disabled</span>
            <span
              className={`rounded px-1 text-[9.5px] font-extrabold ${
                statusFilter === 'disabled' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {disabledCount}
            </span>
          </button>
        </div>

        {/* Search Box */}
        <div className="relative min-w-[180px] sm:w-60">
          <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fault reasons…"
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
      </div>

      {error && <TableState tone="error">{error}</TableState>}

      {loading && !data ? (
        <TableState>Loading issue reasons…</TableState>
      ) : (
        <>
          {/* ──────────────── DESKTOP VIEW (>= lg) ──────────────── */}
          <div className="hidden lg:block overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs dark:border-white/10 dark:bg-surface-900">
            <DataTable
              columns={columns}
              rows={filtered}
              emptyMessage={
                search
                  ? 'No fault reasons match your search.'
                  : "No issue reasons configured yet. Click '+ Add Reason' to create one."
              }
              showRowNumber
              headerColor="blue"
              maxHeight="calc(100vh - 270px)"
            />
          </div>

          {/* ──────────────── MOBILE CARDS STREAM (< lg) — ZERO HORIZONTAL SCROLLING ──────────────── */}
          <div className="block lg:hidden space-y-2">
            {filtered.length === 0 ? (
              <div className="items-center rounded-xl border border-slate-200/90 bg-white p-5 text-center dark:border-white/10 dark:bg-surface-900">
                <FiAlertTriangle className="mx-auto h-5 w-5 text-slate-400" />
                <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-neutral-200">
                  {search ? 'No reasons match your search.' : 'No issue reasons configured.'}
                </p>
              </div>
            ) : (
              filtered.map((r, idx) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-slate-200/80 bg-white p-2 sm:p-2.5 shadow-2xs dark:border-white/10 dark:bg-surface-900 transition-all hover:border-slate-300 dark:hover:border-white/20 space-y-1.5"
                >
                  {/* Top Header: Avatar + Title + Status */}
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <div className="h-6 w-6 rounded-md bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-800/50 flex items-center justify-center shrink-0 text-rose-600 dark:text-rose-400">
                        <FiAlertTriangle className="h-3 w-3" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold font-mono text-slate-400 dark:text-neutral-500 shrink-0">
                            #{idx + 1}
                          </span>
                          <span className="font-bold text-xs text-slate-900 dark:text-neutral-100 truncate">
                            {r.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.2 text-[9.5px] font-bold shrink-0 ${
                        r.active
                          ? 'border border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'border border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-400'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          r.active ? 'bg-emerald-500' : 'bg-slate-400'
                        }`}
                      />
                      <span>{r.active ? 'Active' : 'Disabled'}</span>
                    </span>
                  </div>

                  {/* Priority & Compact Action Buttons Row */}
                  <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-2 py-1 dark:border-white/5 dark:bg-surface-800/60 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-neutral-400">
                      <span>
                        Order: <strong className="font-mono font-bold text-slate-700 dark:text-neutral-200">#{r.sort_order}</strong>
                      </span>
                      <span className="text-slate-300 dark:text-neutral-600">•</span>
                      <span>
                        {r.active ? 'Selectable in app' : 'Hidden'}
                      </span>
                    </div>

                    {/* Compact Actions */}
                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setFormTarget(r)}
                          className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white hover:bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 transition-colors cursor-pointer shadow-2xs"
                        >
                          <FiEdit2 className="h-2.5 w-2.5 text-slate-400" />
                          <span>Edit</span>
                        </button>
                        {isSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(r)}
                            className="inline-flex items-center gap-0.5 rounded border border-rose-200 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/40 dark:text-rose-300 transition-colors cursor-pointer shadow-2xs"
                          >
                            <FiTrash2 className="h-2.5 w-2.5 text-rose-500" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Create / Edit Modal */}
      {formTarget && (
        <Modal
          title={formTarget === 'new' ? 'Add Reason' : 'Edit Reason'}
          description={
            formTarget === 'new'
              ? 'Add a new reason technicians can select.'
              : 'Update this reason’s details.'
          }
          onClose={() => setFormTarget(null)}
        >
          <IssueReasonForm
            reason={formTarget === 'new' ? null : formTarget}
            existingReasons={data}
            onSaved={handleSaved}
            onCancel={() => setFormTarget(null)}
          />
        </Modal>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Reason"
          message={`Delete reason "${deleteTarget.label}"? This can't be undone.`}
          confirmLabel="Delete"
          tone="critical"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Delete Error Alert */}
      {deleteError && (
        <AlertModal
          title="Cannot Delete Reason"
          message={deleteError}
          onClose={() => setDeleteError(null)}
        />
      )}
    </div>
  );
}

export default IssueReasonsPage;
