import { useState } from 'react';
import useInfiniteList from '../../utils/use-infinite-list';
import DataTable from '../../components/ui/table/DataTable';
import TableState from '../../components/ui/table/TableState';
import InfiniteScrollTrigger from '../../components/ui/table/InfiniteScrollTrigger';
import PageHeader from '../../components/ui/primitives/PageHeader';
import Badge from '../../components/ui/primitives/Badge';

const PAGE_SIZE = 15;

const ACTION_TONES = {
  create: 'good',
  import: 'good',
  update_stock: 'info',
  update: 'info',
  delete: 'critical',
};

function formatLabel(value) {
  return value?.replace(/_/g, ' ');
}

const columns = [
  { key: 'user_name', label: 'User', render: (row) => row.user_name || 'System' },
  {
    key: 'action',
    label: 'Action',
    render: (row) => (
      <Badge tone={ACTION_TONES[row.action] || 'neutral'}>{formatLabel(row.action)}</Badge>
    ),
  },
  { key: 'entity', label: 'Entity', render: (row) => formatLabel(row.entity) },
  { key: 'entity_id', label: 'Entity ID', render: (row) => row.entity_id ?? '—' },
  {
    key: 'created_at',
    label: 'Date/Time',
    render: (row) => new Date(row.created_at).toLocaleString(),
  },
];

function AuditLogPage() {
  const [date, setDate] = useState('');
  const { items, loading, hasMore, error, loadMore } = useInfiniteList('/audit-logs', PAGE_SIZE, {
    date: date || undefined,
  });

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="Who did what, and when."
        titleClassName="text-2xl font-bold tracking-tight text-green-600 dark:text-green-400"
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 p-3 shadow-sm dark:border-blue-800/40">
        <div className="flex items-center gap-2">
          <label htmlFor="audit-date-filter" className="text-sm font-medium text-slate-600 dark:text-neutral-300">
            Log date
          </label>
          <input
            id="audit-date-filter"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-blue-200 bg-blue-50/60 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-blue-800/40 dark:bg-blue-900/10 dark:text-neutral-100 dark:focus:border-blue-400 dark:focus:ring-blue-400/30 [&::-webkit-calendar-picker-indicator]:[filter:invert(70%)_sepia(90%)_saturate(600%)_hue-rotate(360deg)_brightness(100%)]"
          />
          {date && (
            <button
              type="button"
              onClick={() => setDate('')}
              className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {error && <TableState tone="error">{error}</TableState>}
      {items.length === 0 && loading ? (
        <TableState>Loading…</TableState>
      ) : (
        !error && (
          <>
            <DataTable columns={columns} rows={items} bordered={false} headerColor="blue" />
            <InfiniteScrollTrigger hasMore={hasMore} loading={loading} onVisible={loadMore} />
          </>
        )
      )}
    </div>
  );
}

export default AuditLogPage;
