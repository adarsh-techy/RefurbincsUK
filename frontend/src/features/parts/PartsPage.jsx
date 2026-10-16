import { useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Link, useSearchParams } from 'react-router-dom';
import {
  FiPackage,
  FiSearch,
  FiX,
  FiPlus,
  FiAlertTriangle,
  FiCheckCircle,
  FiBox,
  FiLayers,
  FiRefreshCw,
  FiEdit2,
  FiTrash2,
} from 'react-icons/fi';
import useFetchList from '../../utils/use-fetch-list';
import DataTable from '../../components/ui/table/DataTable';
import TableState from '../../components/ui/table/TableState';
import Modal from '../../components/ui/overlays/Modal';
import ConfirmModal from '../../components/ui/overlays/ConfirmModal';
import AlertModal from '../../components/ui/overlays/AlertModal';
import Badge from '../../components/ui/primitives/Badge';
import RowActions from '../../components/ui/table/RowActions';
import apiClient from '../../services/api-client';
import { hasPermission } from '../../utils/permissions';
import PartForm from './PartForm';
import RestockForm from './RestockForm';

function PartsPage() {
  const { data, loading, error, refetch } = useFetchList('/parts');
  const user = useSelector((state) => state.auth.user);
  const isSuperAdmin = user?.role === 'super_admin';
  const canManageParts = hasPermission(user, 'parts');

  // The dashboard's "Low Stock Parts" card deep links here with ?lowStock=true
  const [searchParams] = useSearchParams();
  const [lowStockOnly, setLowStockOnly] = useState(searchParams.get('lowStock') === 'true');
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('');

  // null = closed, 'new' = create form, a part object = edit form
  const [formTarget, setFormTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [restockTarget, setRestockTarget] = useState(null);

  const parts = useMemo(() => (Array.isArray(data) ? data : data?.data || []), [data]);

  const clientOptions = useMemo(() => {
    return [...new Map(parts.map((p) => [String(p.client_id ?? ''), p.client_name || 'Unassigned'])).entries()]
      .sort((a, b) => a[1].localeCompare(b[1]));
  }, [parts]);

  const isLow = (p) => Number(p.quantity) <= Number(p.min_stock ?? 5);

  const totalParts = parts.length;
  const totalUnits = useMemo(
    () => parts.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0),
    [parts]
  );
  const lowStockCount = useMemo(() => parts.filter(isLow).length, [parts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return parts
      .filter((p) => !clientFilter || String(p.client_id ?? '') === clientFilter)
      .filter((p) => !lowStockOnly || isLow(p))
      .filter((p) => {
        if (!q) return true;
        return (
          p.name?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.client_name?.toLowerCase().includes(q)
        );
      });
  }, [parts, clientFilter, lowStockOnly, search]);

  function handleSaved() {
    refetch();
    setFormTarget(null);
  }

  function handleRestocked() {
    refetch();
    setRestockTarget(null);
  }

  async function handleConfirmDelete() {
    setDeleteError(null);
    try {
      await apiClient.delete(`/parts/${deleteTarget.id}`);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      setDeleteError(err.response?.data?.message || err.message);
      setDeleteTarget(null);
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Part Name',
      render: (row) => (
        <Link
          to={`/parts/${row.id}`}
          className="font-medium text-xs text-violet-700 hover:text-violet-900 hover:underline dark:text-violet-400"
        >
          {row.name}
        </Link>
      ),
    },
    {
      key: 'client_name',
      label: 'Client',
      render: (row) =>
        row.client_name ? (
          <span className="text-xs font-semibold text-slate-700 dark:text-neutral-300">
            {row.client_name}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300">
            Unassigned
          </span>
        ),
    },
    {
      key: 'sku',
      label: 'SKU',
      render: (row) => (
        <span className="font-mono text-xs text-slate-600 dark:text-neutral-400">
          {row.sku || '—'}
        </span>
      ),
    },
    {
      key: 'quantity',
      label: 'Qty in Stock',
      render: (row) => (
        <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs font-bold text-slate-900 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-100">
          {row.quantity}
        </span>
      ),
    },
    {
      key: 'min_stock',
      label: 'Min Stock',
      render: (row) => (
        <span className="font-mono text-xs text-slate-500 dark:text-neutral-400">
          {row.min_stock ?? 5}
        </span>
      ),
    },
    ...(isSuperAdmin
      ? [
          {
            key: 'service_charge',
            label: 'Service Charge',
            render: (row) => (
              <span className="font-mono text-xs font-bold text-slate-800 dark:text-neutral-200">
                £{Number(row.service_charge || 0).toFixed(2)}
              </span>
            ),
          },
        ]
      : []),
    {
      key: 'in_stock',
      label: 'Status',
      render: (row) => (
        <Badge tone={row.in_stock ? 'good' : Number(row.quantity) > 0 ? 'warning' : 'critical'}>
          {row.in_stock
            ? 'In Stock'
            : Number(row.quantity) > 0
            ? `Low Stock (${row.quantity} left)`
            : 'Out of Stock'}
        </Badge>
      ),
    },
    ...(canManageParts
      ? [
          {
            key: 'actions',
            label: '',
            render: (row) => (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setRestockTarget(row)}
                  className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700 hover:bg-violet-100 dark:border-violet-800/40 dark:bg-violet-950/40 dark:text-violet-300 transition-colors cursor-pointer"
                >
                  Restock
                </button>
                {isSuperAdmin && (
                  <RowActions
                    onEdit={() => setFormTarget(row)}
                    onDelete={() => setDeleteTarget(row)}
                  />
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      {/* Executive Header Card */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-5 shadow-2xs dark:border-white/10 dark:bg-surface-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-neutral-100">
                Parts & Inventory
              </h1>
              <span className="inline-flex items-center rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-700 dark:border-violet-800/40 dark:bg-violet-950/40 dark:text-violet-300">
                Spares & Consumables
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-neutral-400">
              Manage spare parts stock, client allocations, and repair consumables.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFormTarget('new')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-700 hover:bg-violet-800 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer"
            >
              <FiPlus className="h-3.5 w-3.5" />
              <span>Add Part</span>
            </button>
          </div>
        </div>

        {/* Live Counters */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2 sm:gap-3 border-t border-slate-100 pt-3 dark:border-white/5">
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200">
            <FiPackage className="h-3 w-3 text-slate-500" />
            <span>
              Total Parts: <strong className="font-extrabold text-slate-900 dark:text-neutral-100">{totalParts}</strong>
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>
              Total Units in Stock: <strong className="font-extrabold text-emerald-950 dark:text-emerald-100">{totalUnits.toLocaleString()}</strong>
            </span>
          </div>

          {lowStockCount > 0 ? (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300">
              <FiAlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
              <span>
                Low Stock: <strong className="font-extrabold text-amber-950 dark:text-amber-100">{lowStockCount}</strong>
              </span>
            </div>
          ) : null}

          <span className="text-[11px] text-slate-400 dark:text-neutral-500 hidden sm:inline ml-auto">
            {filtered.length} {filtered.length === 1 ? 'part' : 'parts'} shown
          </span>
        </div>
      </div>

      {/* Modern Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-2xs dark:border-white/10 dark:bg-surface-900">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-3.5 w-3.5" />
          <input
            id="part-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search part name, SKU, or client…"
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

        <div className="flex flex-wrap items-center gap-2">
          {/* Client Filter */}
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-violet-500 focus:bg-white focus:outline-hidden dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-200 cursor-pointer"
            aria-label="Filter by client"
          >
            <option value="">All Clients</option>
            {clientOptions.map(([id, name]) => (
              <option key={id || 'none'} value={id}>
                {name}
              </option>
            ))}
          </select>

          {/* Low Stock Toggle Pill */}
          <button
            type="button"
            onClick={() => setLowStockOnly((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
              lowStockOnly
                ? 'bg-rose-600 text-white shadow-xs'
                : 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800/40 dark:bg-rose-950/40 dark:text-rose-300'
            }`}
          >
            <FiAlertTriangle className="h-3.5 w-3.5" />
            <span>Low Stock Only</span>
            {lowStockCount > 0 ? (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                  lowStockOnly ? 'bg-white/20 text-white' : 'bg-rose-200 text-rose-800'
                }`}
              >
                {lowStockCount}
              </span>
            ) : null}
          </button>

          {(search || clientFilter || lowStockOnly) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setClientFilter('');
                setLowStockOnly(false);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-300 cursor-pointer transition-colors"
            >
              <FiX className="h-3 w-3" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Forms & Dialog Modals */}
      {formTarget && (
        <Modal
          title={formTarget === 'new' ? 'Add Part' : 'Edit Part'}
          description={
            formTarget === 'new' ? 'Add a new part to inventory.' : 'Update this part’s details.'
          }
          onClose={() => setFormTarget(null)}
        >
          <PartForm
            part={formTarget === 'new' ? null : formTarget}
            defaultClientId={clientFilter || undefined}
            onSaved={handleSaved}
            onCancel={() => setFormTarget(null)}
          />
        </Modal>
      )}

      {restockTarget && (
        <Modal
          title="Restock Part"
          description={`Add stock for "${restockTarget.name}".`}
          onClose={() => setRestockTarget(null)}
        >
          <RestockForm
            part={restockTarget}
            onSaved={handleRestocked}
            onCancel={() => setRestockTarget(null)}
          />
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Part"
          message={`Delete part "${deleteTarget.name}"? This can't be undone.`}
          requireTyping={false}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {deleteError && (
        <AlertModal
          title="Cannot Delete Part"
          message={deleteError}
          onClose={() => setDeleteError(null)}
        />
      )}

      {loading && <TableState>Loading parts inventory…</TableState>}
      {error && <TableState tone="error">{error}</TableState>}

      {!loading && !error && (
        <>
          {/* Desktop Table (>= lg) */}
          <div className="hidden lg:block overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs dark:border-white/10 dark:bg-surface-900">
            <DataTable
              columns={columns}
              rows={filtered}
              headerColor="blue"
              showRowNumber
              emptyMessage={lowStockOnly ? 'No parts are low on stock.' : 'No parts match these filters.'}
              maxHeight="calc(100vh - 300px)"
            />
          </div>

          {/* Mobile Card Stream (< lg) — COMPACT, ZERO HORIZONTAL SCROLLING */}
          <div className="block lg:hidden space-y-2">
            {filtered.length === 0 ? (
              <div className="items-center rounded-xl border border-slate-200/90 bg-white p-6 text-center dark:border-white/10 dark:bg-surface-900">
                <FiPackage className="mx-auto h-6 w-6 text-slate-400" />
                <p className="mt-1.5 text-xs font-semibold text-slate-700 dark:text-neutral-200">
                  {lowStockOnly ? 'No parts are low on stock.' : 'No parts match your search.'}
                </p>
              </div>
            ) : (
              filtered.map((p, idx) => {
                const quantity = Number(p.quantity) || 0;
                const minStock = Number(p.min_stock ?? 5);
                const stockRatio = Math.min(100, Math.max(5, Math.round((quantity / Math.max(minStock * 2, 10)) * 100)));

                return (
                  <div
                    key={p.id}
                    className="rounded-xl border border-slate-200/85 bg-white p-2.5 sm:p-3 shadow-2xs dark:border-white/10 dark:bg-surface-900 transition-all hover:border-slate-300 dark:hover:border-white/20 space-y-2"
                  >
                    {/* Top Header: Avatar + Title & Client + Status Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="h-7 w-7 rounded-lg bg-violet-50 dark:bg-violet-950/60 border border-violet-100 dark:border-violet-800/50 flex items-center justify-center shrink-0 text-violet-700 dark:text-violet-300">
                          <FiPackage className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold font-mono text-slate-400 dark:text-neutral-500 shrink-0">#{idx + 1}</span>
                            <Link
                              to={`/parts/${p.id}`}
                              className="font-bold text-xs sm:text-sm text-slate-900 hover:text-violet-700 dark:text-neutral-100 dark:hover:text-violet-400 truncate block"
                            >
                              {p.name}
                            </Link>
                          </div>
                          {/* Client & SKU line */}
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5 flex-wrap leading-tight">
                            <span className="inline-flex items-center gap-1">
                              <span className="text-slate-400 text-[10px]">Client:</span>
                              <strong className={`font-semibold ${p.client_name ? 'text-slate-700 dark:text-neutral-200' : 'text-amber-600 dark:text-amber-400'}`}>
                                {p.client_name || 'Unassigned'}
                              </strong>
                            </span>
                            {p.sku ? (
                              <>
                                <span className="text-slate-300 dark:text-neutral-600">•</span>
                                <span className="rounded bg-slate-100 dark:bg-surface-800 px-1 py-0.2 font-mono text-[9.5px] font-medium text-slate-600 dark:text-neutral-300">
                                  SKU: {p.sku}
                                </span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      {p.in_stock ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300 shrink-0">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          <span>In Stock</span>
                        </span>
                      ) : quantity > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[10.5px] font-bold text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300 shrink-0">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          <span>Low ({quantity})</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-200/80 bg-rose-50 px-2 py-0.5 text-[10.5px] font-bold text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/40 dark:text-rose-300 shrink-0">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                          <span>Out of Stock</span>
                        </span>
                      )}
                    </div>

                    {/* Compact Visual Stock Level Container */}
                    <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2 dark:border-white/5 dark:bg-surface-800/60 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 dark:text-neutral-500 block leading-none">
                            Inventory Level
                          </span>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="text-base font-extrabold text-slate-900 dark:text-white leading-none">
                              {quantity}
                            </span>
                            <span className="text-[11px] font-medium text-slate-500 dark:text-neutral-400">
                              units in stock
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 dark:text-neutral-500 block leading-none">
                            Min. Reserve
                          </span>
                          <span className="inline-block mt-0.5 rounded border border-slate-200/80 bg-white px-1.5 py-0.2 text-[10.5px] font-semibold text-slate-700 dark:border-white/10 dark:bg-surface-700 dark:text-neutral-200 font-mono">
                            {minStock} units
                          </span>
                        </div>
                      </div>

                      {/* Visual Health bar */}
                      <div className="space-y-1">
                        <div className="h-1.5 w-full rounded-full bg-slate-200/80 dark:bg-surface-700 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              p.in_stock ? 'bg-emerald-500' : quantity > 0 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${stockRatio}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-neutral-400 pt-0.5">
                          <span>
                            {p.in_stock ? (
                              <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                                ✓ Healthy level ({quantity - minStock} above min)
                              </span>
                            ) : quantity > 0 ? (
                              <span className="text-amber-700 dark:text-amber-400 font-medium">
                                ⚠️ Low stock: reorder recommended
                              </span>
                            ) : (
                              <span className="text-rose-600 dark:text-rose-400 font-bold">
                                ✕ Out of stock: restock needed
                              </span>
                            )}
                          </span>

                          {isSuperAdmin && (
                            <span className="font-semibold text-slate-700 dark:text-neutral-300">
                              Fee: <strong className="font-mono text-slate-900 dark:text-neutral-100">£{Number(p.service_charge || 0).toFixed(2)}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Compact Action Buttons Row */}
                    {canManageParts && (
                      <div className="flex items-center justify-between pt-0.5 flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => setRestockTarget(p)}
                          className="inline-flex items-center gap-1 rounded-lg bg-violet-700 hover:bg-violet-800 active:bg-violet-900 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs transition-colors cursor-pointer"
                        >
                          <FiPlus className="h-3 w-3" />
                          <span>Restock</span>
                        </button>

                        {isSuperAdmin && (
                          <div className="flex items-center gap-1.5 ml-auto">
                            <button
                              type="button"
                              onClick={() => setFormTarget(p)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700 transition-colors cursor-pointer shadow-2xs"
                            >
                              <FiEdit2 className="h-2.5 w-2.5 text-slate-400" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(p)}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 px-2 py-1 text-[11px] font-bold text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/60 transition-colors cursor-pointer shadow-2xs"
                            >
                              <FiTrash2 className="h-2.5 w-2.5 text-rose-500" />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default PartsPage;
