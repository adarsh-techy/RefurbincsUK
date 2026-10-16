import { useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import {
  FiFileText,
  FiSearch,
  FiX,
  FiPlus,
  FiBox,
  FiTruck,
  FiUser,
  FiClock,
  FiCalendar,
  FiCheckCircle,
} from 'react-icons/fi';
import useFetchList from '../../utils/use-fetch-list';
import DataTable from '../../components/ui/table/DataTable';
import TableState from '../../components/ui/table/TableState';
import Modal from '../../components/ui/overlays/Modal';
import ConfirmModal from '../../components/ui/overlays/ConfirmModal';
import RowActions from '../../components/ui/table/RowActions';
import apiClient from '../../services/api-client';
import ReturnForm from './ReturnForm';
import ReturnEditForm from './ReturnEditForm';
import { resolveImageUrl } from '../../utils/image-url';

// Converts to a YYYY-MM-DD string in the browser's local timezone, so a date
// picked in the filter matches returns recorded that same calendar day —
// toISOString() alone would shift the date near midnight in non-UTC zones.
function toLocalDateValue(value) {
  const dt = new Date(value);
  const offset = dt.getTimezoneOffset();
  return new Date(dt.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function ReturnsPage() {
  const { data, loading, error, refetch } = useFetchList('/returns');
  const user = useSelector((state) => state.auth.user);
  const isSuperAdmin = user?.role === 'super_admin';

  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');

  const rows = useMemo(() => (Array.isArray(data) ? data : data?.data || []), [data]);

  const totalReturns = rows.length;
  const totalBatteries = useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.battery_count) || 0), 0),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch =
        !q ||
        row.driver_name?.toLowerCase().includes(q) ||
        row.truck_number?.toLowerCase().includes(q) ||
        row.client_name?.toLowerCase().includes(q);
      const matchesDate = !date || toLocalDateValue(row.returned_at) === date;
      return matchesSearch && matchesDate;
    });
  }, [rows, search, date]);

  function handleCreated() {
    refetch();
    setShowForm(false);
  }

  function handleSaved() {
    refetch();
    setEditTarget(null);
  }

  async function handleConfirmDelete() {
    setDeleteError(null);
    try {
      await apiClient.delete(`/returns/${deleteTarget.id}`);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      setDeleteError(err.response?.data?.message || err.message);
      setDeleteTarget(null);
    }
  }

  const columns = [
    {
      key: 'truck_number',
      label: 'Truck #',
      render: (row) => (
        <Link
          to={`/returns/${row.id}`}
          className="font-mono text-xs font-bold text-violet-700 hover:text-violet-900 hover:underline dark:text-violet-400"
        >
          {row.truck_number}
        </Link>
      ),
    },
    {
      key: 'driver_name',
      label: 'Driver',
      render: (row) => (
        <span className="text-xs font-medium text-slate-800 dark:text-neutral-200">
          {row.driver_name || '—'}
        </span>
      ),
    },
    {
      key: 'client_name',
      label: 'Client',
      render: (row) => (
        <span className="text-xs font-semibold text-slate-700 dark:text-neutral-300">
          {row.client_name || '—'}
        </span>
      ),
    },
    {
      key: 'battery_count',
      label: 'Batteries',
      render: (row) => (
        <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-bold text-slate-800 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200">
          {row.battery_count ?? 0}
        </span>
      ),
    },
    {
      key: 'returned_at',
      label: 'Dispatched At',
      render: (row) => (
        <span className="text-xs text-slate-500 dark:text-neutral-400">
          {new Date(row.returned_at).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'document',
      label: 'Document',
      render: (row) =>
        row.document_url ? (
          <a
            href={resolveImageUrl(row.document_url)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200/80 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300 transition-colors"
          >
            <FiFileText className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="truncate max-w-[120px]">
              {row.document_name ? row.document_name : 'View Note'}
            </span>
          </a>
        ) : (
          <span className="text-xs text-slate-400 dark:text-neutral-500">—</span>
        ),
    },
    ...(isSuperAdmin
      ? [
          {
            key: 'actions',
            label: '',
            render: (row) => (
              <RowActions
                onEdit={() => setEditTarget(row)}
                onDelete={() => setDeleteTarget(row)}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      {/* Executive Header */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-5 shadow-2xs dark:border-white/10 dark:bg-surface-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-neutral-100">
                Return Dispatch
              </h1>
              <span className="inline-flex items-center rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-700 dark:border-violet-800/40 dark:bg-violet-950/40 dark:text-violet-300">
                Outbound Logistics
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-neutral-400">
              Repaired batteries dispatched and returned back to customer locations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-700 hover:bg-violet-800 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer"
            >
              <FiPlus className="h-3.5 w-3.5" />
              <span>Record Return</span>
            </button>
          </div>
        </div>

        {/* Live Counters */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2 sm:gap-3 border-t border-slate-100 pt-3 dark:border-white/5">
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>
              Total Dispatches: <strong className="font-extrabold text-emerald-950 dark:text-emerald-100">{totalReturns}</strong>
            </span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800 dark:border-violet-800/40 dark:bg-violet-950/40 dark:text-violet-300">
            <FiBox className="h-3 w-3 text-violet-600 dark:text-violet-400" />
            <span>
              Batteries Returned: <strong className="font-extrabold text-violet-950 dark:text-violet-100">{totalBatteries.toLocaleString()}</strong>
            </span>
          </div>
          <span className="text-[11px] text-slate-400 dark:text-neutral-500 hidden sm:inline ml-auto">
            {filtered.length} {filtered.length === 1 ? 'record' : 'records'} shown
          </span>
        </div>
      </div>

      {/* Modal Forms */}
      {showForm && (
        <Modal
          title="Record a Return"
          description="Dispatch repaired batteries back to the customer."
          size="5xl"
          className="max-h-[92vh] flex flex-col"
          onClose={() => setShowForm(false)}
        >
          <ReturnForm onCreated={handleCreated} onCancel={() => setShowForm(false)} />
        </Modal>
      )}

      {editTarget && (
        <Modal
          title="Edit Return"
          description="Update the truck/driver details for this return."
          size="2xl"
          onClose={() => setEditTarget(null)}
        >
          <ReturnEditForm
            returnRecord={editTarget}
            onSaved={handleSaved}
            onCancel={() => setEditTarget(null)}
          />
        </Modal>
      )}

      {/* Modern Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-2xs dark:border-white/10 dark:bg-surface-900">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-3.5 w-3.5" />
          <input
            id="return-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search driver, truck #, or client…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-8 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:outline-hidden dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-100"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 cursor-pointer"
            >
              <FiX className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <input
              id="return-date-filter"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-violet-500 focus:bg-white focus:outline-hidden dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-200 cursor-pointer"
            />
          </div>

          {(search || date) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setDate('');
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100 dark:border-rose-800/40 dark:bg-rose-950/40 dark:text-rose-400 cursor-pointer transition-colors"
            >
              <FiX className="h-3 w-3" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {deleteError && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/40 dark:text-rose-400">
          {deleteError}
        </p>
      )}

      {loading && <TableState>Loading dispatches…</TableState>}
      {error && <TableState tone="error">{error}</TableState>}

      {!loading && !error && (
        <>
          {/* Desktop Table (>= lg) */}
          <div className="hidden lg:block overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs dark:border-white/10 dark:bg-surface-900">
            <DataTable
              columns={columns}
              rows={filtered}
              emptyMessage="No returns match these filters."
              headerColor="blue"
              showRowNumber
              maxHeight="calc(100vh - 300px)"
            />
          </div>

          {/* Mobile Card Stream (< lg) — ZERO HORIZONTAL SCROLLING */}
          <div className="block lg:hidden space-y-2.5">
            {filtered.length === 0 ? (
              <div className="items-center rounded-2xl border border-slate-200/90 bg-white p-8 text-center dark:border-white/10 dark:bg-surface-900">
                <FiTruck className="mx-auto h-7 w-7 text-slate-400" />
                <p className="mt-2 text-xs font-semibold text-slate-700 dark:text-neutral-200">
                  No return dispatches match your search.
                </p>
              </div>
            ) : (
              filtered.map((r, idx) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs dark:border-white/10 dark:bg-surface-900 space-y-2"
                >
                  {/* Top Bar: Index, Truck Link, Battery Count */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10.5px] font-semibold text-slate-400">#{idx + 1}</span>
                      <Link
                        to={`/returns/${r.id}`}
                        className="font-mono text-xs font-extrabold text-violet-700 hover:text-violet-800 hover:underline dark:text-violet-400 truncate"
                      >
                        {r.truck_number}
                      </Link>
                    </div>
                    <span className="inline-flex items-center rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-800 dark:border-violet-800/40 dark:bg-violet-950/40 dark:text-violet-300 shrink-0">
                      {r.battery_count ?? 0} {r.battery_count === 1 ? 'battery' : 'batteries'}
                    </span>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-1.5 text-xs border-t border-slate-100 pt-1.5 dark:border-white/5">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Driver</span>
                      <span className="font-semibold text-slate-800 dark:text-neutral-200 truncate block">
                        {r.driver_name || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Client</span>
                      <span className="font-semibold text-slate-800 dark:text-neutral-200 truncate block">
                        {r.client_name || '—'}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Dispatched Date</span>
                      <span className="text-slate-600 dark:text-neutral-400">
                        {new Date(r.returned_at).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Document & Actions Row */}
                  <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-white/5 flex-wrap">
                    {r.document_url ? (
                      <a
                        href={resolveImageUrl(r.document_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300"
                      >
                        <FiFileText className="h-3 w-3" />
                        <span className="truncate max-w-[140px]">{r.document_name || 'View Note'}</span>
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-400">No document</span>
                    )}

                    {isSuperAdmin && (
                      <div className="flex items-center gap-1.5 ml-auto">
                        <button
                          type="button"
                          onClick={() => setEditTarget(r)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(r)}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-800/40 dark:bg-rose-950/40 dark:text-rose-300 cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Return"
          message={`Delete return "${deleteTarget.truck_number}"? Its batteries will go back to "Repaired" status.`}
          requireTyping={false}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

export default ReturnsPage;
