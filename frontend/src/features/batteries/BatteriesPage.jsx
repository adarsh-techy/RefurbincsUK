import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import apiClient from '../../services/api-client';
import useInfiniteList from '../../utils/use-infinite-list';
import DataTable from '../../components/ui/DataTable';
import TableState from '../../components/ui/TableState';
import InfiniteScrollTrigger from '../../components/ui/InfiniteScrollTrigger';
import PageHeader from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/Badge';
import BatteryLookup from './BatteryLookup';
import { socket } from '../../services/socket-client';

const PAGE_SIZE = 15;

// "2026-07-16" -> "16 Jul". Built from the parts directly (not `new
// Date(isoString)`) since that parses as UTC midnight and can roll back a
// day once formatted in a browser timezone behind UTC.
function formatShortDate(isoDateStr) {
  const [y, m, d] = isoDateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'registered', label: 'Registered' },
  { value: 'in_repair', label: 'Awaiting Repair' },
  { value: 'in_progress', label: 'Repair In Progress' },
  { value: 'in_testing', label: 'In Testing' },
  { value: 'repaired', label: 'Repair Completed' },
  { value: 'returned', label: 'Returned to Client' },
  { value: 'unserviceable', label: 'Unserviceable' },
  { value: 'recycled', label: 'Recycled' },
];

const VALID_STATUS_FILTERS = new Set(STATUS_FILTERS.map((f) => f.value).filter(Boolean));

function BatteriesPage() {
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('status') || '';
  const initialClient = searchParams.get('clientName') || searchParams.get('client') || '';

  const [status, setStatus] = useState(VALID_STATUS_FILTERS.has(initialStatus) ? initialStatus : '');
  const [clientName, setClientName] = useState(initialClient);
  const [date, setDate] = useState('');
  const [clients, setClients] = useState([]);

  useEffect(() => {
    apiClient
      .get('/clients')
      .then((res) => {
        setClients(res.data || []);
      })
      .catch(() => {});
  }, []);

  const { items, loading, hasMore, error, loadMore, refetch } = useInfiniteList('/batteries', PAGE_SIZE, {
    status: status || undefined,
    clientName: clientName || undefined,
    date: date || undefined,
  });

  // Keeps this list in sync while it's open
  useEffect(() => {
    socket.on('battery:updated', refetch);
    return () => socket.off('battery:updated', refetch);
  }, [refetch]);

  const columns = [
    {
      key: 'battery_code',
      label: 'Battery ID',
      sortValue: (row) => row.battery_code,
      render: (row) => (
        <Link to={`/batteries/${row.battery_code}`} className="font-medium text-blue-700 hover:underline dark:text-blue-400">
          {row.battery_code}
        </Link>
      ),
    },
    {
      key: 'client_name',
      label: 'Client',
      sortValue: (row) => row.client_name || '',
      render: (row) =>
        row.client_name ? (
          <span className="font-semibold text-slate-800 dark:text-neutral-200">{row.client_name}</span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: 'status',
      label: 'Status',
      sortValue: (row) => row.status || 'registered',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'created_at',
      label: 'Registered Time',
      sortValue: (row) => (row.created_at ? new Date(row.created_at).getTime() : 0),
      render: (row) => new Date(row.created_at).toLocaleString(),
    },
    {
      key: 'last_repaired_at',
      label: 'Last Repaired',
      sortValue: (row) => (row.last_repaired_at ? new Date(row.last_repaired_at).getTime() : 0),
      render: (row) =>
        row.last_repaired_at ? (
          <div>
            <p>{new Date(row.last_repaired_at).toLocaleString()}</p>
            {row.repairs_this_month > 1 && (
              <p className="mt-0.5 whitespace-normal text-xs font-medium text-warning-600">
                ⟳ Repaired {row.repairs_this_month}x this month (
                {row.repairs_this_month_dates.map(formatShortDate).join(', ')})
              </p>
            )}
          </div>
        ) : (
          '—'
        ),
    },
    {
      key: 'last_repaired_parts',
      label: 'Part(s) Changed',
      sortValue: (row) => row.last_repaired_parts || '',
      render: (row) => row.last_repaired_parts || '—',
    },
    {
      key: 'last_repaired_by',
      label: 'Repaired By',
      sortValue: (row) => row.last_repaired_by || '',
      render: (row) => row.last_repaired_by || '—',
    },
  ];

  return (
    <div>
      <PageHeader
        title="Global Battery"
        description="Every battery ever taken in, tracked by its unique ID."
        titleClassName="text-2xl font-bold tracking-tight text-green-600 dark:text-green-400"
      />

      <div className="mb-8 flex flex-wrap items-end gap-3 rounded-2xl border border-blue-200/80 bg-white/60 p-4 shadow-2xs dark:border-blue-900/40 dark:bg-surface-900/60">
        <BatteryLookup />

        {/* ── Client Filter Dropdown ──────────────────────────────────── */}
        <div className="flex flex-col gap-1">
          <label htmlFor="battery-client-filter" className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
            Client
          </label>
          <div className="relative">
            <select
              id="battery-client-filter"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="appearance-none rounded-xl border border-slate-300 bg-white py-1.5 pl-3 pr-8 text-sm font-semibold text-slate-800 shadow-2xs focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-100"
            >
              <option value="">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-slate-400">
              <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </div>
        </div>

        {/* ── Status Pill Filter ──────────────────────────────────────── */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
            Status
          </span>
          <div className="flex flex-wrap rounded-xl border border-slate-300 p-0.5 dark:border-surface-600">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatus(f.value)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                  status === f.value
                    ? 'bg-emerald-700 text-white dark:bg-emerald-600 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-surface-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Created on Date Filter ─────────────────────────────────── */}
        <div className="flex flex-col gap-1">
          <label htmlFor="battery-date-filter" className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
            Created on
          </label>
          <div className="flex items-center gap-2">
            <input
              id="battery-date-filter"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-2xs focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-100"
            />
            {date && (
              <button
                type="button"
                onClick={() => setDate('')}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-neutral-200"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Clear All Filters Button */}
        {(status || clientName || date) && (
          <button
            type="button"
            onClick={() => {
              setStatus('');
              setClientName('');
              setDate('');
            }}
            className="self-end rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-200 dark:bg-white/10 dark:text-neutral-200 dark:hover:bg-white/20"
          >
            Reset Filters
          </button>
        )}
      </div>

      {error && <TableState tone="error">{error}</TableState>}

      {items.length === 0 && loading ? (
        <TableState>Loading…</TableState>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={items}
            emptyMessage="No batteries match these filters."
            showRowNumber
            headerColor="blue"
            defaultSortKey="created_at"
            defaultSortDirection="desc"
          />
          <InfiniteScrollTrigger hasMore={hasMore} loading={loading} onVisible={loadMore} />
        </>
      )}
    </div>
  );
}

export default BatteriesPage;
