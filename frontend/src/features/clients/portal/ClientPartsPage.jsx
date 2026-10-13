import { useMemo, useState } from 'react';
import PageHeader from '../../../components/ui/primitives/PageHeader';
import DataTable from '../../../components/ui/table/DataTable';
import TableState from '../../../components/ui/table/TableState';
import useFetchList from '../../../utils/use-fetch-list';

// The client's own parts inventory: the stock the workshop holds for this
// client's repairs, with each part's minimum level. Only this client's parts
// come back from /clients/me/parts.
function stockState(p) {
  const qty = Number(p.quantity) || 0;
  if (qty <= 0) return { label: 'Out of Stock', cls: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300' };
  if (p.is_low) return { label: `Low Stock (${qty} left)`, cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' };
  return { label: 'In Stock', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' };
}

function ClientPartsPage() {
  const { data, loading, error, refetch } = useFetchList('/clients/me/parts');
  const parts = useMemo(() => data?.data || [], [data]);
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const lowCount = parts.filter((p) => p.is_low).length;

  const rows = parts
    .filter((p) => !lowOnly || p.is_low)
    .filter((p) => {
      const q = search.trim().toLowerCase();
      return !q || p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q);
    });

  const columns = [
    { key: 'name', label: 'Part', render: (p) => <span className="font-semibold text-slate-900 dark:text-white">{p.name}</span> },
    { key: 'sku', label: 'SKU', render: (p) => p.sku || '—' },
    { key: 'quantity', label: 'Available', render: (p) => <span className="font-bold">{p.quantity}</span> },
    { key: 'min_stock', label: 'Minimum', render: (p) => p.min_stock },
    {
      key: 'status',
      label: 'Status',
      render: (p) => {
        const s = stockState(p);
        return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${s.cls}`}>{s.label}</span>;
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Parts Inventory"
        description="The parts stock the workshop holds for your batteries, and the minimum level for each."
        titleClassName="text-2xl font-bold tracking-tight text-green-600 dark:text-green-400"
      />

      {lowCount > 0 && (
        <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <strong>{lowCount} part{lowCount === 1 ? ' is' : 's are'} at or below the minimum stock level.</strong>{' '}
          Repairs may be delayed until the stock is topped up.
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search part name or SKU…"
          className="w-full max-w-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-100"
        />
        <button
          type="button"
          onClick={() => setLowOnly((v) => !v)}
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${
            lowOnly
              ? 'bg-amber-600 text-white'
              : 'border border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-800/50 dark:text-amber-300'
          }`}
        >
          Low Stock Only ({lowCount})
        </button>
        <button type="button" onClick={refetch} className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-400">
          Refresh
        </button>
      </div>

      {error ? (
        <TableState tone="error">{error}</TableState>
      ) : loading && !parts.length ? (
        <TableState>Loading…</TableState>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          showRowNumber
          emptyMessage={parts.length ? 'No parts match your search.' : 'No parts are held for you yet.'}
        />
      )}
    </div>
  );
}

export default ClientPartsPage;
