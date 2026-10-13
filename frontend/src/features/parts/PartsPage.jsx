import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Link, useSearchParams } from 'react-router-dom';
import useFetchList from '../../utils/use-fetch-list';
import DataTable from '../../components/ui/table/DataTable';
import TableState from '../../components/ui/table/TableState';
import PageHeader from '../../components/ui/primitives/PageHeader';
import Button from '../../components/ui/primitives/Button';
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

  // The dashboard's "Low Stock Parts" card deep links here with
  // ?lowStock=true, so the list opens pre-filtered instead of requiring a
  // second click.
  const [searchParams] = useSearchParams();
  const [lowStockOnly, setLowStockOnly] = useState(searchParams.get('lowStock') === 'true');

  // null = closed, 'new' = create form, a part object = edit form
  const [formTarget, setFormTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [restockTarget, setRestockTarget] = useState(null);

  // parts are kept per client: filter by client, and "low" = at or below each part's own minimum
  const [clientFilter, setClientFilter] = useState('');
  const clientOptions = [...new Map((data || []).map((p) => [String(p.client_id ?? ''), p.client_name || 'Unassigned'])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1]));
  const isLow = (p) => Number(p.quantity) <= Number(p.min_stock ?? 5);
  const filtered = (data || [])
    .filter((p) => !clientFilter || String(p.client_id ?? '') === clientFilter)
    .filter((p) => !lowStockOnly || isLow(p));

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
      label: 'Part',
      render: (row) => (
        <Link to={`/parts/${row.id}`} className="font-medium text-blue-700 hover:underline dark:text-blue-400">
          {row.name}
        </Link>
      ),
    },
    {
      key: 'client_name',
      label: 'Client',
      render: (row) => row.client_name || <span className="font-semibold text-amber-600 dark:text-amber-400">Unassigned</span>,
    },
    { key: 'sku', label: 'SKU', render: (row) => row.sku || '—' },
    { key: 'quantity', label: 'Qty' },
    { key: 'min_stock', label: 'Min. Stock', render: (row) => row.min_stock ?? 5 },
    ...(isSuperAdmin
      ? [
          {
            key: 'service_charge',
            label: 'Service Charge',
            render: (row) => `£${Number(row.service_charge || 0).toFixed(2)}`,
          },
        ]
      : []),
    {
      key: 'in_stock',
      label: 'Status',
      render: (row) => (
        // in_stock is false at or below the part's minimum; only 0 is actually out
        <Badge tone={row.in_stock ? 'good' : Number(row.quantity) > 0 ? 'warning' : 'critical'}>
          {row.in_stock ? 'In Stock' : Number(row.quantity) > 0 ? `Low Stock (${row.quantity} left)` : 'Out of Stock'}
        </Badge>
      ),
    },
    ...(canManageParts
      ? [
          {
            key: 'actions',
            label: '',
            render: (row) => (
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setRestockTarget(row)}
                  className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-400"
                >
                  Restock
                </button>
                {isSuperAdmin && (
                  <RowActions onEdit={() => setFormTarget(row)} onDelete={() => setDeleteTarget(row)} />
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Parts stock used for battery repairs."
        titleClassName="text-2xl font-bold tracking-tight text-green-600 dark:text-green-400"
      >
        <Button variant="darkViolet" onClick={() => setFormTarget('new')}>+ Add Part</Button>
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-200"
          aria-label="Filter by client"
        >
          <option value="">All clients</option>
          {clientOptions.map(([id, name]) => (
            <option key={id || 'none'} value={id}>{name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setLowStockOnly((prev) => !prev)}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            lowStockOnly
              ? 'bg-critical-600 text-white dark:bg-red-600'
              : 'border border-critical-200 text-critical-700 hover:bg-critical-50 dark:border-red-800/40 dark:text-red-300 dark:hover:bg-red-500/10'
          }`}
        >
          Low Stock Only
        </button>
        {lowStockOnly && (
          <span className="text-sm text-slate-500 dark:text-neutral-400">
            {filtered.length} part{filtered.length === 1 ? '' : 's'} at or below their minimum stock
          </span>
        )}
      </div>

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
          <RestockForm part={restockTarget} onSaved={handleRestocked} onCancel={() => setRestockTarget(null)} />
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
        <AlertModal title="Cannot Delete Part" message={deleteError} onClose={() => setDeleteError(null)} />
      )}

      {loading && <TableState>Loading…</TableState>}
      {error && <TableState tone="error">{error}</TableState>}
      {!loading && !error && (
        <DataTable
          columns={columns}
          rows={filtered}
          headerColor="blue"
          showRowNumber
          emptyMessage={lowStockOnly ? 'No parts are low on stock.' : undefined}
        />
      )}
    </div>
  );
}

export default PartsPage;
