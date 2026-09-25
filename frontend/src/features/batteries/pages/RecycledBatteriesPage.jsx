import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useInfiniteList from '../../../utils/use-infinite-list';
import DataTable from '../../../components/ui/table/DataTable';
import TableState from '../../../components/ui/table/TableState';
import InfiniteScrollTrigger from '../../../components/ui/table/InfiniteScrollTrigger';
import PageHeader from '../../../components/ui/primitives/PageHeader';
import { StatusBadge } from '../../../components/ui/primitives/Badge';
import ImageLightboxModal from '../../../components/ui/overlays/ImageLightboxModal';
import { resolveImageUrl } from '../../../utils/image-url';

const PAGE_SIZE = 15;
const SEARCH_DEBOUNCE_MS = 250;

function RecycledBatteriesPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [date, setDate] = useState('');
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

  const { items, loading, hasMore, error, loadMore, total } = useInfiniteList('/batteries', PAGE_SIZE, {
    status: 'recycled',
    search: debouncedSearch || undefined,
    date: date || undefined,
  });

  const columns = [
    {
      key: 'battery_code',
      label: 'Battery ID',
      render: (row) => (
        <Link
          to={`/batteries/${row.battery_code}`}
          className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
        >
          {row.battery_code}
        </Link>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status || 'recycled'} />,
    },
    {
      key: 'client_name',
      label: 'Original Client',
      render: (row) => (
        <span className="font-medium text-slate-800 dark:text-neutral-200">
          {row.client_name || '—'}
        </span>
      ),
    },
    {
      key: 'recycle_partner',
      label: 'Recycling Partner / Batch',
      render: (row) => {
        if (!row.recycle_client_name && !row.recycle_batch_id) {
          return <span className="text-slate-400 dark:text-neutral-500 text-xs">Standard Certified Stream</span>;
        }
        return (
          <div className="flex flex-col text-xs leading-snug">
            {row.recycle_client_name && (
              <span className="font-semibold text-slate-800 dark:text-neutral-200">
                {row.recycle_client_name}
              </span>
            )}
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-neutral-400">
              {row.recycle_batch_id && (
                <Link
                  to={`/recycle/${row.recycle_batch_id}`}
                  className="text-blue-600 hover:underline dark:text-blue-400 font-medium"
                >
                  Shipment #{row.recycle_batch_id}
                </Link>
              )}
              {row.recycle_vehicle_number && <span>• {row.recycle_vehicle_number}</span>}
            </div>
          </div>
        );
      },
    },
    {
      key: 'issue_reason',
      label: 'Decommission Reason',
      render: (row) => (
        <span className="inline-block rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          {row.issue_reason || 'Decommissioned'}
        </span>
      ),
    },
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
                    title: `Decommission Photos — ${row.battery_code}`,
                  })
                }
                className="group relative h-9 w-9 overflow-hidden rounded-md border border-slate-200 bg-white dark:border-surface-700 dark:bg-surface-800 transition hover:scale-105 hover:border-emerald-500 shadow-2xs cursor-pointer"
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
      key: 'recycled_at',
      label: 'Recycled Date',
      render: (row) => {
        const timestamp = row.recycled_at || row.updated_at || row.created_at;
        return timestamp ? (
          <span className="text-xs font-medium text-slate-700 dark:text-neutral-300">
            {new Date(timestamp).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        ) : (
          '—'
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Recycled Batteries"
        description="All decommissioned batteries safely processed and sent for certified eco-recycling and material recovery."
        action={
          total !== undefined && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 dark:border-emerald-800/40 dark:bg-emerald-950/30">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Total Recycled: {total}
              </span>
            </div>
          )
        }
      />

      <div className="mb-4 sm:mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-emerald-200 p-3 shadow-xs dark:border-emerald-800/40 bg-white/50 dark:bg-surface-900/50">
        <div className="min-w-[16rem] flex-1 sm:flex-none">
          <label htmlFor="recycled-search" className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider">
            Search battery / client / reason
          </label>
          <input
            id="recycled-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="e.g. BAT-12-001 or Damaged"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-100 sm:w-64"
          />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="recycled-date-filter" className="text-xs font-bold text-slate-600 dark:text-neutral-300 uppercase tracking-wider">
            Date
          </label>
          <input
            id="recycled-date-filter"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 focus:border-emerald-500 focus:outline-hidden dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-200"
          />
        </div>

        {(search || date) && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setDate('');
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
            emptyMessage="No recycled batteries match these filters."
            showRowNumber
            headerColor="green"
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

export default RecycledBatteriesPage;
