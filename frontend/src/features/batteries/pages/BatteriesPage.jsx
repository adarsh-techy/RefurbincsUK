import { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  FiBatteryCharging,
  FiSearch,
  FiRefreshCw,
  FiCalendar,
  FiUser,
  FiTag,
  FiAlertTriangle,
  FiX,
  FiCheck,
  FiArrowRight,
} from 'react-icons/fi';
import apiClient from '../../../services/api-client';
import useInfiniteList from '../../../utils/use-infinite-list';
import DataTable from '../../../components/ui/table/DataTable';
import TableState from '../../../components/ui/table/TableState';
import InfiniteScrollTrigger from '../../../components/ui/table/InfiniteScrollTrigger';
import { StatusBadge } from '../../../components/ui/primitives/Badge';
import BatteryLookup from '../components/BatteryLookup';
import { socket } from '../../../services/socket-client';

const PAGE_SIZE = 20;

function formatShortDate(isoDateStr) {
  if (!isoDateStr) return '';
  const [y, m, d] = String(isoDateStr).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function formatFullDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'registered', label: 'Registered' },
  { value: 'in_repair', label: 'Awaiting Repair' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_testing', label: 'Testing' },
  { value: 'repaired', label: 'Repaired' },
  { value: 'returned', label: 'Returned' },
  { value: 'unserviceable', label: 'Unserviceable' },
  { value: 'tested_parts_removed', label: 'Test Failed' },
  { value: 'recycled', label: 'Recycled' },
];

function parseStatusParam(raw) {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => STATUS_FILTERS.some((f) => f.value === s && f.value !== ''))
  );
}

function BatteriesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialClient = searchParams.get('clientName') || searchParams.get('client') || '';

  const [selectedStatuses, setSelectedStatuses] = useState(() =>
    parseStatusParam(searchParams.get('status') || '')
  );
  const [clientName, setClientName] = useState(initialClient);
  const [date, setDate] = useState('');
  const [clients, setClients] = useState([]);

  useEffect(() => {
    setSelectedStatuses(parseStatusParam(searchParams.get('status') || ''));
    const c = searchParams.get('clientName') || searchParams.get('client') || '';
    setClientName(c);
  }, [searchParams]);

  const handleStatusToggle = (value) => {
    if (value === '') {
      setSelectedStatuses(new Set());
      const params = new URLSearchParams(searchParams);
      params.delete('status');
      setSearchParams(params, { replace: true });
      return;
    }

    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      const params = new URLSearchParams(searchParams);
      if (next.size > 0) {
        params.set('status', [...next].join(','));
      } else {
        params.delete('status');
      }
      setSearchParams(params, { replace: true });
      return next;
    });
  };

  const handleRemoveStatus = (value) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      next.delete(value);
      const params = new URLSearchParams(searchParams);
      if (next.size > 0) {
        params.set('status', [...next].join(','));
      } else {
        params.delete('status');
      }
      setSearchParams(params, { replace: true });
      return next;
    });
  };

  const handleClientChange = (newClient) => {
    setClientName(newClient);
    const params = new URLSearchParams(searchParams);
    if (newClient) {
      params.set('clientName', newClient);
    } else {
      params.delete('clientName');
    }
    setSearchParams(params, { replace: true });
  };

  const handleResetFilters = () => {
    setSelectedStatuses(new Set());
    setClientName('');
    setDate('');
    setSearchParams({}, { replace: true });
  };

  useEffect(() => {
    apiClient
      .get('/clients')
      .then((res) => {
        setClients((res.data || []).filter((c) => c.user_role !== 'recycle_client'));
      })
      .catch(() => {});
  }, []);

  const statusParam = selectedStatuses.size > 0 ? [...selectedStatuses].join(',') : undefined;

  const { items, loading, hasMore, total, error, loadMore, refetch } = useInfiniteList(
    '/batteries',
    PAGE_SIZE,
    {
      status: statusParam,
      clientName: clientName || undefined,
      date: date || undefined,
    }
  );

  useEffect(() => {
    socket.on('battery:updated', refetch);
    return () => socket.off('battery:updated', refetch);
  }, [refetch]);

  const hasFilters = selectedStatuses.size > 0 || clientName || date;

  // Desktop Table Columns
  const columns = [
    {
      key: 'battery_code',
      label: 'Battery ID',
      sortValue: (row) => row.battery_code,
      render: (row) => (
        <Link
          to={`/batteries/${encodeURIComponent(row.battery_code)}`}
          className="font-black text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400"
        >
          {row.battery_code}
        </Link>
      ),
    },
    {
      key: 'rfid_tag',
      label: 'RFID Tag',
      sortValue: (row) => row.rfid_tag || '',
      render: (row) =>
        row.rfid_tag ? (
          <span className="font-mono text-xs text-emerald-700 dark:text-emerald-400">
            {row.rfid_tag}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: 'serial_number',
      label: 'Battery Number',
      sortValue: (row) => row.serial_number || '',
      render: (row) =>
        row.serial_number ? (
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-slate-800 dark:text-neutral-100">
              {row.serial_number}
            </span>
            {row.serial_number_added_by_role === 'client' && (
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
                Set by Client
              </span>
            )}
          </div>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: 'client_name',
      label: 'Client',
      sortValue: (row) => row.client_name || '',
      render: (row) =>
        row.client_name ? (
          <span className="font-bold text-slate-800 dark:text-neutral-200">{row.client_name}</span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: 'status',
      label: 'Status',
      sortValue: (row) => row.status || 'registered',
      render: (row) => (
        <StatusBadge
          status={row.status}
          isPassedBack={row.is_passed_back}
          hasPendingParts={Number(row.pending_parts_count || 0) > 0}
        />
      ),
    },
    {
      key: 'created_at',
      label: 'Registered Time',
      sortValue: (row) => (row.created_at ? new Date(row.created_at).getTime() : 0),
      render: (row) => formatFullDate(row.created_at),
    },
    {
      key: 'last_repaired_at',
      label: 'Last Repaired',
      sortValue: (row) => (row.last_repaired_at ? new Date(row.last_repaired_at).getTime() : 0),
      render: (row) =>
        row.last_repaired_at ? (
          <div>
            <p className="text-xs">{formatFullDate(row.last_repaired_at)}</p>
            {row.repairs_this_month > 1 && Array.isArray(row.repairs_this_month_dates) && (
              <p className="mt-0.5 whitespace-normal text-[10px] font-bold text-amber-600">
                Repaired {row.repairs_this_month}x this month (
                {row.repairs_this_month_dates.map(formatShortDate).join(', ')})
              </p>
            )}
          </div>
        ) : (
          <span className="text-slate-400">—</span>
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
    <div className="space-y-3 sm:space-y-4 pb-12 w-full max-w-full">
      {/* ── Executive Page Header ─────────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <h1 className="text-base sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Battery Fleet
            </h1>
            <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.2 text-[9.5px] sm:text-[10.5px] font-bold text-emerald-700 dark:text-emerald-300">
              {hasFilters ? 'Filtered: ' : 'Total: '}
              {(total || 0).toLocaleString()}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
            Lifecycle tracking, service history & live status across all fleet assets
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {hasFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex h-7 sm:h-8 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 sm:px-3 text-[11px] sm:text-xs font-bold text-slate-600 shadow-2xs hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-slate-300 dark:hover:bg-white/5 transition-all cursor-pointer"
            >
              <FiX className="h-3 w-3" />
              <span>Reset</span>
            </button>
          )}

          <button
            type="button"
            onClick={refetch}
            disabled={loading}
            className="inline-flex h-7 sm:h-8 items-center gap-1.5 rounded-xl bg-blue-600 px-2.5 sm:px-3 text-[11px] sm:text-xs font-black text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-95 cursor-pointer"
          >
            <FiRefreshCw className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Sleek Integrated Controls Card ───────────────────────────── */}
      <div className="rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-2xs dark:border-white/10 dark:bg-surface-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {/* Quick ID Search & Live Lookup */}
          <div className="flex-1">
            <BatteryLookup />
          </div>

          {/* Client & Date Selectors */}
          <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
            {/* Client Filter */}
            <select
              value={clientName}
              onChange={(e) => handleClientChange(e.target.value)}
              className="h-7.5 sm:h-8.5 rounded-xl border border-slate-200 bg-white px-2.5 text-[11px] sm:text-xs font-semibold text-slate-700 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-surface-800 dark:text-slate-200 cursor-pointer"
            >
              <option value="">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Date Input */}
            <div className="relative flex items-center">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-7.5 sm:h-8.5 rounded-xl border border-slate-200 bg-white px-2 text-[10.5px] sm:text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-surface-800 dark:text-slate-200"
              />
              {date && (
                <button
                  type="button"
                  onClick={() => setDate('')}
                  className="ml-1 text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Status Filter Single-Row Scroll Track (ZERO Vertical Mess) ── */}
        <div className="mt-2.5 flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar border-t border-slate-100 pt-2 dark:border-white/5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 mr-1">
            Status:
          </span>
          {STATUS_FILTERS.map((f) => {
            const isAll = f.value === '';
            const isActive = isAll ? selectedStatuses.size === 0 : selectedStatuses.has(f.value);
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => handleStatusToggle(f.value)}
                className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] sm:text-[10.5px] font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-2xs dark:bg-white dark:text-slate-900'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:bg-surface-800 dark:text-slate-300 dark:hover:bg-white/10'
                }`}
              >
                <span>{f.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Filter Counter & Summary ─────────────────────────────────── */}
      <div className="flex items-center justify-between px-1 text-[10.5px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">
        <div>
          Showing <strong className="font-bold text-slate-800 dark:text-neutral-200">{items.length}</strong> of{' '}
          <strong className="font-bold text-slate-800 dark:text-neutral-200">{(total || 0).toLocaleString()}</strong>{' '}
          {total === 1 ? 'battery' : 'batteries'}
          {hasFilters ? ' (filtered)' : ''}
        </div>
      </div>

      {error && <TableState tone="error">{error}</TableState>}

      {/* ── Content View: Mobile Stacked Cards vs Desktop Table ──────── */}
      {items.length === 0 && loading ? (
        <TableState>Loading batteries…</TableState>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/90 bg-white p-8 sm:p-12 text-center dark:border-white/10 dark:bg-surface-900 shadow-2xs">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-surface-800 text-slate-400 mb-2.5">
            <FiBatteryCharging className="h-5 w-5" />
          </div>
          <p className="text-xs font-bold text-slate-800 dark:text-neutral-200">No batteries found</p>
          <p className="mt-0.5 text-[11px] text-slate-400 dark:text-neutral-500">
            {hasFilters ? 'Try resetting your status or client filters.' : 'No batteries registered in the fleet yet.'}
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-3 inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-slate-200"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* ── Mobile Stream (ZERO Horizontal Scroll) ───────────────── */}
          <div className="block lg:hidden space-y-2">
            {items.map((b, idx) => {
              const hasRepeatRepairs = b.repairs_this_month > 1;

              return (
                <div
                  key={b.id || b.battery_code}
                  className="rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-2xs dark:border-white/10 dark:bg-surface-900 transition-all hover:border-slate-300"
                >
                  {/* Top Bar: Code & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      to={`/batteries/${encodeURIComponent(b.battery_code)}`}
                      className="inline-flex items-center gap-1 text-xs font-black text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <span>🔋 {b.battery_code}</span>
                      <FiArrowRight className="h-2.5 w-2.5 opacity-60" />
                    </Link>

                    <StatusBadge
                      status={b.status}
                      isPassedBack={b.is_passed_back}
                      hasPendingParts={Number(b.pending_parts_count || 0) > 0}
                    />
                  </div>

                  {/* Client & Serial row */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                    {b.client_name ? (
                      <span className="rounded bg-slate-100 dark:bg-surface-800 px-1.5 py-0.2 font-bold text-slate-700 dark:text-slate-300">
                        {b.client_name}
                      </span>
                    ) : null}

                    {b.serial_number ? (
                      <span className="rounded bg-slate-100 dark:bg-surface-800 px-1.5 py-0.2 font-mono font-semibold text-slate-800 dark:text-neutral-200">
                        SN: {b.serial_number}
                      </span>
                    ) : null}

                    {b.rfid_tag ? (
                      <span className="rounded bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 font-mono font-semibold text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                        RFID: {b.rfid_tag}
                      </span>
                    ) : null}
                  </div>

                  {/* Service info & Repairs */}
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-1 border-t border-slate-100 dark:border-white/5 pt-1.5 text-[9.5px] text-slate-400 dark:text-neutral-400">
                    <div>
                      {b.last_repaired_at ? (
                        <span>
                          Repaired: <strong className="text-slate-600 dark:text-slate-300">{formatShortDate(b.last_repaired_at.slice(0, 10))}</strong>
                          {b.last_repaired_by ? ` by ${b.last_repaired_by}` : ''}
                        </span>
                      ) : (
                        <span>Registered: {formatShortDate(b.created_at?.slice(0, 10))}</span>
                      )}
                    </div>

                    {hasRepeatRepairs && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1 py-0.2 text-[8.5px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                        <FiAlertTriangle className="h-2.5 w-2.5" />
                        {b.repairs_this_month}x this mo
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Desktop DataTable (High Density) ─────────────────────── */}
          <div className="hidden lg:block">
            <DataTable
              columns={columns}
              rows={items}
              emptyMessage="No batteries match these filters."
              showRowNumber
              headerColor="blue"
              defaultSortKey="battery_code"
              defaultSortDirection="asc"
              maxHeight="calc(100vh - 270px)"
              onScrollBottom={hasMore && !loading ? loadMore : null}
            />
          </div>

          <InfiniteScrollTrigger hasMore={hasMore} loading={loading} onVisible={loadMore} />
        </>
      )}
    </div>
  );
}

export default BatteriesPage;
