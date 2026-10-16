import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FiAlertTriangle,
  FiSearch,
  FiX,
  FiCalendar,
  FiRefreshCw,
  FiArrowRight,
  FiImage,
} from 'react-icons/fi';
import useInfiniteList from '../../../utils/use-infinite-list';
import DataTable from '../../../components/ui/table/DataTable';
import TableState from '../../../components/ui/table/TableState';
import InfiniteScrollTrigger from '../../../components/ui/table/InfiniteScrollTrigger';
import { StatusBadge } from '../../../components/ui/primitives/Badge';
import ImageLightboxModal from '../../../components/ui/overlays/ImageLightboxModal';
import { resolveImageUrl } from '../../../utils/image-url';
import { socket } from '../../../services/socket-client';

const PAGE_SIZE = 15;
const SEARCH_DEBOUNCE_MS = 250;
const UNSERVICEABLE_ALL = 'unserviceable,tested_parts_removed';

function UnserviceableBatteriesPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [date, setDate] = useState('');
  const [statusFilter, setStatusFilter] = useState(UNSERVICEABLE_ALL);
  const [lightboxState, setLightboxState] = useState({
    isOpen: false,
    images: [],
    initialIndex: 0,
    title: '',
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const { items, loading, hasMore, total, error, loadMore, refetch } = useInfiniteList(
    '/batteries',
    PAGE_SIZE,
    {
      status: statusFilter,
      search: debouncedSearch || undefined,
      date: date || undefined,
    }
  );

  // Sync real-time count updates
  useEffect(() => {
    socket.on('batteries:unserviceable-count', refetch);
    return () => socket.off('batteries:unserviceable-count', refetch);
  }, [refetch]);

  const isFiltered = Boolean(search || date || statusFilter !== UNSERVICEABLE_ALL);

  const clearAllFilters = () => {
    setSearch('');
    setDate('');
    setStatusFilter(UNSERVICEABLE_ALL);
  };

  const columns = [
    {
      key: 'battery_code',
      label: 'Battery ID',
      width: '130px',
      render: (row) => (
        <Link
          to={`/batteries/${row.battery_code}`}
          className="font-mono text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:underline"
        >
          {row.battery_code}
        </Link>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '140px',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'client_name',
      label: 'Client',
      width: '150px',
      render: (row) => (
        <span className="text-xs font-medium text-slate-800 dark:text-neutral-200">
          {row.client_name || '—'}
        </span>
      ),
    },
    {
      key: 'issue_reason',
      label: 'Fault Reason',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <FiAlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span className="font-semibold text-xs text-slate-900 dark:text-neutral-100">
            {row.issue_reason || '—'}
          </span>
        </div>
      ),
    },
    {
      key: 'issue_note',
      label: 'Technician Note',
      render: (row) => (
        <span className="text-xs text-slate-600 dark:text-neutral-400 line-clamp-1">
          {row.issue_note || '—'}
        </span>
      ),
    },
    {
      key: 'issue_photos',
      label: 'Photos',
      width: '120px',
      render: (row) => {
        const photos = row.issue_photos || [];
        if (!photos || photos.length === 0) {
          return <span className="text-slate-400 dark:text-neutral-500 text-xs">—</span>;
        }
        return (
          <div className="flex items-center gap-1.5">
            {photos.slice(0, 3).map((photo, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() =>
                  setLightboxState({
                    isOpen: true,
                    images: photos,
                    initialIndex: idx,
                    title: `Photos — ${row.battery_code}`,
                  })
                }
                className="group relative h-7 w-7 overflow-hidden rounded border border-slate-200 bg-white dark:border-surface-700 dark:bg-surface-800 transition hover:scale-105 hover:border-amber-500 shadow-2xs cursor-pointer"
                title="Click to view photo"
              >
                <img
                  src={resolveImageUrl(photo)}
                  alt={`Photo ${idx + 1}`}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
            {photos.length > 3 && (
              <span className="text-[10px] font-bold text-slate-400 dark:text-neutral-500">
                +{photos.length - 3}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'issue_reported_at',
      label: 'Reported',
      width: '130px',
      render: (row) => (
        <span className="text-[11px] text-slate-500 dark:text-neutral-400">
          {row.issue_reported_at
            ? new Date(row.issue_reported_at).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })
            : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      width: '60px',
      render: (row) => (
        <Link
          to={`/batteries/${row.battery_code}`}
          className="inline-flex items-center gap-0.5 rounded px-2 py-0.5 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-surface-800 transition-colors"
        >
          <span>View</span>
          <FiArrowRight className="h-3 w-3" />
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-2.5 sm:space-y-4 pb-10 w-full max-w-full overflow-x-hidden">
      {/* Executive Header Card — COMPACT */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-neutral-100">
                Unserviceable Batteries
              </h1>
              <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300">
                Workshop Quarantine
              </span>
            </div>
            <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500 dark:text-neutral-400">
              Batteries reported as unserviceable or test-failed (parts removed) — quarantined in workshop.
            </p>
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 shadow-2xs transition-colors cursor-pointer self-start sm:self-auto"
            title="Refresh list"
          >
            <FiRefreshCw className={`h-3 w-3 ${loading ? 'animate-spin text-amber-600' : 'text-slate-500'}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Live Counters Strip — Ultra-compact Single Line */}
        <div className="mt-2.5 flex items-center gap-2 text-[10.5px] text-slate-500 dark:text-neutral-400 border-t border-slate-100 pt-2 dark:border-white/5 flex-wrap">
          <span>
            Total Quarantined:{' '}
            <strong className="font-bold text-slate-900 dark:text-neutral-100">
              {total !== undefined ? total : items.length}
            </strong>
          </span>
          <span className="text-slate-300 dark:text-neutral-600">•</span>
          <span>
            Showing:{' '}
            <strong className="font-bold text-amber-700 dark:text-amber-300">
              {items.length}
            </strong>
          </span>
          {total !== undefined && total >= 100 && (
            <>
              <span className="text-slate-300 dark:text-neutral-600">•</span>
              <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                <FiAlertTriangle className="h-3 w-3" />
                <span>100+ Threshold Alert (Recycle Review Needed)</span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Toolbar: Search, Status Filters & Date Picker — COMPACT & WRAPPING */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-2 sm:p-2.5 shadow-2xs dark:border-white/10 dark:bg-surface-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        {/* Status Tab Pills — Wrapping */}
        <div className="flex flex-wrap items-center gap-1 pb-0.5 sm:pb-0">
          <button
            type="button"
            onClick={() => setStatusFilter(UNSERVICEABLE_ALL)}
            className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] sm:text-[11px] font-bold transition-colors cursor-pointer ${
              statusFilter === UNSERVICEABLE_ALL
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-300'
            }`}
          >
            <span>All Quarantined</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('unserviceable')}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer shrink-0 ${
              statusFilter === 'unserviceable'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800/40 dark:bg-rose-950/40 dark:text-rose-300'
            }`}
          >
            <span>Unserviceable</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('tested_parts_removed')}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer shrink-0 ${
              statusFilter === 'tested_parts_removed'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300'
            }`}
          >
            <span>Test Failed (Parts Removed)</span>
          </button>
        </div>

        {/* Search & Date Controls */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Search Box */}
          <div className="relative min-w-[170px] sm:w-56 flex-1 sm:flex-none">
            <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search battery / client / reason…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-8 pr-7 py-1 text-xs text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-surface-800 dark:text-neutral-100 transition-colors"
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

          {/* Date Picker */}
          <div className="relative">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50/70 px-2 py-1 text-xs text-slate-700 focus:border-amber-500 focus:outline-none dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 cursor-pointer"
            />
          </div>

          {/* Clear Filters */}
          {isFiltered && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="rounded-lg px-2 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-surface-800 dark:text-rose-400 transition-colors cursor-pointer shrink-0"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {error && <TableState tone="error">{error}</TableState>}

      {items.length === 0 && loading ? (
        <TableState>Loading unserviceable batteries…</TableState>
      ) : (
        <>
          {/* ──────────────── DESKTOP VIEW (>= lg) ──────────────── */}
          <div className="hidden lg:block overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs dark:border-white/10 dark:bg-surface-900">
            <DataTable
              columns={columns}
              rows={items}
              emptyMessage="No unserviceable batteries match these filters."
              showRowNumber
              headerColor="blue"
              maxHeight="calc(100vh - 270px)"
              onScrollBottom={hasMore && !loading ? loadMore : null}
            />
            <InfiniteScrollTrigger hasMore={hasMore} loading={loading} onVisible={loadMore} />
          </div>

          {/* ──────────────── MOBILE CARDS STREAM (< lg) — ZERO HORIZONTAL SCROLLING ──────────────── */}
          <div className="block lg:hidden space-y-2">
            {items.length === 0 ? (
              <div className="rounded-xl border border-slate-200/90 bg-white p-5 text-center dark:border-white/10 dark:bg-surface-900 shadow-2xs">
                <FiAlertTriangle className="mx-auto h-5 w-5 text-slate-400" />
                <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-neutral-200">
                  {isFiltered
                    ? 'No batteries match your filters.'
                    : 'No unserviceable batteries quarantined.'}
                </p>
              </div>
            ) : (
              items.map((b, idx) => {
                const photos = b.issue_photos || [];
                return (
                  <div
                    key={b.id || b.battery_code || idx}
                    className="rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-2xs dark:border-white/10 dark:bg-surface-900 space-y-1.5 transition-all hover:border-slate-300 dark:hover:border-white/20"
                  >
                    {/* Top Row: Avatar + Battery Code + Status Badge */}
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <div className="h-6 w-6 rounded-md bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-800/50 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
                          <FiAlertTriangle className="h-3 w-3" />
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span className="text-[10px] font-bold font-mono text-slate-400 dark:text-neutral-500 shrink-0">
                            #{idx + 1}
                          </span>
                          <Link
                            to={`/batteries/${b.battery_code}`}
                            className="font-mono font-extrabold text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 truncate"
                          >
                            {b.battery_code}
                          </Link>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <StatusBadge status={b.status} />
                    </div>

                    {/* Client & Fault Reason Container */}
                    <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2 dark:border-white/5 dark:bg-surface-800/60 space-y-1">
                      <div className="flex items-center justify-between text-[11px] gap-2">
                        <span className="text-slate-500 dark:text-neutral-400">
                          Client: <strong className="font-semibold text-slate-800 dark:text-neutral-200">{b.client_name || '—'}</strong>
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-neutral-500">
                          {b.issue_reported_at
                            ? new Date(b.issue_reported_at).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                              })
                            : '—'}
                        </span>
                      </div>

                      {/* Reason Pill */}
                      <div className="flex items-center gap-1 text-[11px]">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Reason:</span>
                        <span className="font-semibold text-amber-800 dark:text-amber-300 rounded bg-amber-100/70 dark:bg-amber-950/60 px-1.5 py-0.2 text-[10.5px]">
                          {b.issue_reason || '—'}
                        </span>
                      </div>

                      {/* Note */}
                      {b.issue_note ? (
                        <p className="text-[10.5px] text-slate-600 dark:text-neutral-400 italic bg-white/70 dark:bg-surface-800/90 rounded px-1.5 py-0.5 border border-slate-100 dark:border-white/5">
                          "{b.issue_note}"
                        </p>
                      ) : null}

                      {/* Photos Row */}
                      {photos.length > 0 && (
                        <div className="flex items-center gap-1 pt-0.5">
                          <FiImage className="h-3 w-3 text-slate-400 shrink-0" />
                          <div className="flex items-center gap-1 overflow-x-auto">
                            {photos.map((photo, pIdx) => (
                              <button
                                key={pIdx}
                                type="button"
                                onClick={() =>
                                  setLightboxState({
                                    isOpen: true,
                                    images: photos,
                                    initialIndex: pIdx,
                                    title: `Photos — ${b.battery_code}`,
                                  })
                                }
                                className="h-7 w-7 rounded overflow-hidden border border-slate-200 dark:border-surface-700 bg-white dark:bg-surface-800 shrink-0 cursor-pointer shadow-2xs"
                              >
                                <img
                                  src={resolveImageUrl(photo)}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Row */}
                    <div className="flex items-center justify-end pt-0.5">
                      <Link
                        to={`/batteries/${b.battery_code}`}
                        className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white hover:bg-slate-50 px-2.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 shadow-2xs transition-colors"
                      >
                        <span>View Battery</span>
                        <FiArrowRight className="h-2.5 w-2.5 text-slate-400" />
                      </Link>
                    </div>
                  </div>
                );
              })
            )}

            {/* Mobile Infinite Scroll */}
            <InfiniteScrollTrigger hasMore={hasMore} loading={loading} onVisible={loadMore} />
          </div>
        </>
      )}

      {/* Lightbox Modal */}
      {lightboxState.isOpen && (
        <ImageLightboxModal
          images={lightboxState.images}
          initialIndex={lightboxState.initialIndex}
          title={lightboxState.title}
          onClose={() => setLightboxState({ isOpen: false, images: [], initialIndex: 0, title: '' })}
        />
      )}
    </div>
  );
}

export default UnserviceableBatteriesPage;
