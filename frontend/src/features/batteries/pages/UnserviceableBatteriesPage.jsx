import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useInfiniteList from '../../../utils/use-infinite-list';
import DataTable from '../../../components/ui/table/DataTable';
import TableState from '../../../components/ui/table/TableState';
import InfiniteScrollTrigger from '../../../components/ui/table/InfiniteScrollTrigger';
import PageHeader from '../../../components/ui/primitives/PageHeader';
import Badge from '../../../components/ui/primitives/Badge';
import ImageLightboxModal from '../../../components/ui/overlays/ImageLightboxModal';
import { resolveImageUrl } from '../../../utils/image-url';
import { socket } from '../../../services/socket-client';

const PAGE_SIZE = 15;
const SEARCH_DEBOUNCE_MS = 250;

function UnserviceableBatteriesPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [date, setDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('unserviceable,tested_parts_removed');
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

  const { items, loading, hasMore, error, loadMore, refetch } = useInfiniteList('/batteries', PAGE_SIZE, {
    status: statusFilter,
    search: debouncedSearch || undefined,
    date: date || undefined,
  });

  // Keeps the list in sync while this page is open — the same push that
  // drives the 100-battery popup alert (see UnserviceableBatteriesAlert).
  useEffect(() => {
    socket.on('batteries:unserviceable-count', refetch);
    return () => socket.off('batteries:unserviceable-count', refetch);
  }, [refetch]);

  const columns = [
    {
      key: 'battery_code',
      label: 'Battery ID',
      render: (row) => (
        <Link to={`/batteries/${row.battery_code}`} className="font-medium text-blue-700 hover:underline dark:text-blue-400">
          {row.battery_code}
        </Link>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <Badge status={row.status} />,
    },
    { key: 'client_name', label: 'Client', render: (row) => row.client_name || '—' },
    { key: 'issue_reason', label: 'Reason', render: (row) => row.issue_reason || '—' },
    { key: 'issue_note', label: 'Note', render: (row) => row.issue_note || '—' },
    {
      key: 'issue_photos',
      label: 'Photos',
      render: (row) => {
        const photos = row.issue_photos || [];
        if (!photos || photos.length === 0) {
          return <span className="text-slate-400 dark:text-neutral-500 text-xs">—</span>;
        }
        return (
          <div className="flex items-center gap-1.5">
            {photos.map((photo, idx) => (
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
                className="group relative h-9 w-9 overflow-hidden rounded-md border border-slate-200 bg-white dark:border-surface-700 dark:bg-surface-800 transition hover:scale-105 hover:border-blue-500 shadow-2xs"
                title="Click to view photo"
              >
                <img
                  src={resolveImageUrl(photo)}
                  alt={`Photo ${idx + 1}`}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        );
      },
    },
    {
      key: 'issue_reported_at',
      label: 'Reported',
      render: (row) => (row.issue_reported_at ? new Date(row.issue_reported_at).toLocaleString() : '—'),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Unserviceable Batteries"
        description="Batteries a technician reported as unable to be serviced — terminal, not returned to the active queue."
      />

      <div className="mb-4 sm:mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-blue-200 p-3 shadow-xs dark:border-blue-800/40">
        <div className="min-w-[16rem] flex-1 sm:flex-none">
          <label htmlFor="unserviceable-search" className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider">
            Search battery / client / reason
          </label>
          <input
            id="unserviceable-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="e.g. BAT-12-001 or Damaged"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-100 sm:w-64"
          />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="unserviceable-status-filter" className="text-xs font-bold text-slate-600 dark:text-neutral-300 uppercase tracking-wider">
            Status
          </label>
          <select
            id="unserviceable-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-200"
          >
            <option value="unserviceable,tested_parts_removed">All Unserviceable</option>
            <option value="unserviceable">Unserviceable Only</option>
            <option value="tested_parts_removed">Test Failed (Parts Removed)</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="unserviceable-date-filter" className="text-xs font-bold text-slate-600 dark:text-neutral-300 uppercase tracking-wider">
            Created on
          </label>
          <input
            id="unserviceable-date-filter"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-200"
          />
        </div>

        {(search || date || statusFilter !== 'unserviceable,tested_parts_removed') && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setDate('');
              setStatusFilter('unserviceable,tested_parts_removed');
            }}
            className="text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 cursor-pointer transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {error && <TableState tone="error">{error}</TableState>}

      {items.length === 0 && loading ? (
        <TableState>Loading…</TableState>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-surface-700">
          <DataTable
            columns={columns}
            rows={items}
            emptyMessage="No unserviceable batteries match these filters."
            showRowNumber
            headerColor="blue"
            maxHeight="calc(100vh - 320px)"
            onScrollBottom={hasMore && !loading ? loadMore : null}
          />
          <InfiniteScrollTrigger hasMore={hasMore} loading={loading} onVisible={loadMore} />
        </div>
      )}

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
