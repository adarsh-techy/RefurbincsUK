import { useEffect, useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import apiClient from '../../services/api-client';
import TableState from '../../components/ui/table/TableState';
import { StatusBadge } from '../../components/ui/primitives/Badge';
import StatCard from '../../components/ui/primitives/StatCard';
import DataTable from '../../components/ui/table/DataTable';
import ImageLightboxModal from '../../components/ui/overlays/ImageLightboxModal';
import { resolveImageUrl } from '../../utils/image-url';

function RecycleDetailPage() {
  const { id } = useParams();
  const user = useSelector((state) => state.auth.user);
  const isRecycleClient = user?.role === 'recycle_client';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'photos' | 'notes'

  const [lightboxState, setLightboxState] = useState({
    isOpen: false,
    images: [],
    initialIndex: 0,
    title: '',
  });

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiClient
      .get(`/recycle/${id}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const backLink = isRecycleClient ? '/my/recycle-shipments' : '/recycle';
  const backLabel = isRecycleClient ? 'Back to My Shipments' : 'Back to Recycle';

  const batteries = data?.batteries || [];
  const batch = data?.batch;

  const recycledCount = useMemo(() => batteries.filter((b) => b.status === 'recycled').length, [batteries]);
  const distinctClients = useMemo(() => [...new Set(batteries.map((b) => b.client_name).filter(Boolean))].length, [batteries]);
  const withPhotosCount = useMemo(() => batteries.filter((b) => b.issue_photos && b.issue_photos.length > 0).length, [batteries]);
  const withNotesCount = useMemo(() => batteries.filter((b) => Boolean(b.issue_note && b.issue_note.trim())).length, [batteries]);

  const filteredBatteries = useMemo(() => {
    let list = batteries;
    if (activeTab === 'photos') {
      list = list.filter((b) => b.issue_photos && b.issue_photos.length > 0);
    } else if (activeTab === 'notes') {
      list = list.filter((b) => Boolean(b.issue_note && b.issue_note.trim()));
    }

    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(
      (b) =>
        b.battery_code?.toLowerCase().includes(q) ||
        b.client_name?.toLowerCase().includes(q) ||
        b.issue_reason?.toLowerCase().includes(q) ||
        b.issue_note?.toLowerCase().includes(q)
    );
  }, [batteries, activeTab, search]);

  if (loading) {
    return (
      <div className="py-12">
        <TableState>Loading vehicle shipment details…</TableState>
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="py-6">
        <Link
          to={backLink}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline dark:text-emerald-400"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 0 1 0 1.06L9.06 10l3.73 3.71a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
          </svg>
          {backLabel}
        </Link>
        <TableState tone="error">{error || 'Shipment not found'}</TableState>
      </div>
    );
  }

  const columns = [
    {
      key: 'battery_code',
      label: 'Battery ID',
      render: (b) => (
        <Link
          to={`/batteries/${b.battery_code}`}
          className="inline-flex items-center gap-1.5 font-bold text-blue-700 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300 font-mono text-xs sm:text-sm"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
          {b.battery_code}
        </Link>
      ),
    },
    {
      key: 'client_name',
      label: 'Original Client',
      render: (b) =>
        b.client_name ? (
          <div className="inline-flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold text-slate-700 dark:bg-surface-800 dark:text-neutral-300">
              {b.client_name.charAt(0).toUpperCase()}
            </span>
            <span className="font-medium text-slate-800 dark:text-neutral-200">{b.client_name}</span>
          </div>
        ) : (
          <span className="text-slate-400 dark:text-neutral-500">—</span>
        ),
    },
    {
      key: 'issue_reason',
      label: 'Declared Reason',
      render: (b) =>
        b.issue_reason ? (
          <span className="inline-flex items-center rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-600/20 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-400/30">
            {b.issue_reason}
          </span>
        ) : (
          <span className="text-slate-400 dark:text-neutral-500">—</span>
        ),
    },
    {
      key: 'issue_note',
      label: 'Technician Note',
      render: (b) =>
        b.issue_note ? (
          <p className="text-xs text-slate-600 dark:text-neutral-300 line-clamp-2 max-w-sm" title={b.issue_note}>
            {b.issue_note}
          </p>
        ) : (
          <span className="text-slate-400 dark:text-neutral-500 text-xs">—</span>
        ),
    },
    {
      key: 'issue_photos',
      label: 'Photo Evidence',
      render: (b) => {
        const photos = b.issue_photos || [];
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
                    title: `Evidence Photos — ${b.battery_code}`,
                  })
                }
                className="group relative h-8 w-8 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-surface-700 dark:bg-surface-800 transition hover:scale-110 hover:border-blue-500 shadow-2xs cursor-pointer"
                title="Click to zoom photo"
              >
                <img
                  src={resolveImageUrl(photo)}
                  alt={`Photo ${idx + 1}`}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
            {photos.length > 3 && (
              <button
                type="button"
                onClick={() =>
                  setLightboxState({
                    isOpen: true,
                    images: photos,
                    initialIndex: 3,
                    title: `Evidence Photos — ${b.battery_code}`,
                  })
                }
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-700 hover:bg-slate-200 dark:bg-surface-800 dark:text-neutral-300 cursor-pointer"
              >
                +{photos.length - 3}
              </button>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (b) => <StatusBadge status={b.status} />,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Top Breadcrumb */}
      <div>
        <Link
          to={backLink}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-blue-700 dark:text-neutral-400 dark:hover:text-blue-400 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path
              fillRule="evenodd"
              d="M12.79 5.23a.75.75 0 0 1 0 1.06L9.06 10l3.73 3.71a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
              clipRule="evenodd"
            />
          </svg>
          {backLabel}
        </Link>
      </div>

      {/* Classic Hero Header Card */}
      <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-slate-50/50 to-blue-50/30 p-4 sm:p-6 shadow-xs dark:border-surface-700 dark:from-surface-900 dark:via-surface-850 dark:to-surface-800">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-xl text-white shadow-md shadow-blue-500/20 dark:bg-blue-500">
              ♻️
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-neutral-100">
                  <span className="font-light text-slate-400 dark:text-neutral-500">Vehicle</span> {batch.vehicle_number}
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Dispatched
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                Shipment manifest for unserviceable batteries transferred for recycling
              </p>
            </div>
          </div>
        </div>

        {/* Metadata Details Grid */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-slate-200/80 pt-4 dark:border-surface-700/80 text-xs">
          <div className="flex flex-col">
            <span className="text-slate-400 dark:text-neutral-500 uppercase tracking-wider font-semibold text-[10px]">Driver</span>
            <span className="mt-0.5 font-bold text-slate-800 dark:text-neutral-100 flex items-center gap-1">
              👤 {batch.driver_name}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-slate-400 dark:text-neutral-500 uppercase tracking-wider font-semibold text-[10px]">Recycle Partner</span>
            <span className="mt-0.5 font-bold text-slate-800 dark:text-neutral-100 flex items-center gap-1">
              🏢 {batch.recycle_client_name || 'Standard Recycler'}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-slate-400 dark:text-neutral-500 uppercase tracking-wider font-semibold text-[10px]">Dispatched Date</span>
            <span className="mt-0.5 font-bold text-slate-800 dark:text-neutral-100 flex items-center gap-1">
              📅 {new Date(batch.recycled_at).toLocaleDateString()}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-slate-400 dark:text-neutral-500 uppercase tracking-wider font-semibold text-[10px]">Dispatched Time</span>
            <span className="mt-0.5 font-bold text-slate-800 dark:text-neutral-100 flex items-center gap-1">
              ⏰ {new Date(batch.recycled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatCard
          label="Total Batteries"
          value={batch.battery_count}
          tone="info"
          icon="📦"
        />
        <StatCard
          label="Confirmed Recycled"
          value={recycledCount}
          tone="good"
          icon="✅"
        />
        <StatCard
          label="Original Clients"
          value={distinctClients}
          tone="neutral"
          icon="🏢"
        />
        <StatCard
          label="With Evidence Photos"
          value={withPhotosCount}
          tone="warning"
          icon="📸"
        />
      </div>

      {/* Batteries Manifest Table Card */}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs dark:border-surface-700 dark:bg-surface-850">
        {/* Table Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-neutral-100 uppercase tracking-wider">
              Manifest Inventory ({filteredBatteries.length})
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-neutral-400">
              Detailed battery codes and declared defect information
            </p>
          </div>

          {/* Search & Tabs Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Filter Tabs */}
            <div className="flex rounded-xl bg-slate-100 p-0.5 dark:bg-surface-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`rounded-lg px-2.5 py-1 transition cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs dark:bg-surface-700 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white'
                }`}
              >
                All ({batteries.length})
              </button>
              {withPhotosCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('photos')}
                  className={`rounded-lg px-2.5 py-1 transition cursor-pointer ${
                    activeTab === 'photos'
                      ? 'bg-white text-slate-900 shadow-2xs dark:bg-surface-700 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white'
                  }`}
                >
                  Photos ({withPhotosCount})
                </button>
              )}
              {withNotesCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('notes')}
                  className={`rounded-lg px-2.5 py-1 transition cursor-pointer ${
                    activeTab === 'notes'
                      ? 'bg-white text-slate-900 shadow-2xs dark:bg-surface-700 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white'
                  }`}
                >
                  Notes ({withNotesCount})
                </button>
              )}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[14rem]">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search battery / reason..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-100"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Inner Scroll Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-surface-700">
          <DataTable
            headerColor="blue"
            showRowNumber
            bordered={false}
            maxHeight="calc(100vh - 430px)"
            emptyMessage="No batteries match your filter or search."
            columns={columns}
            rows={filteredBatteries}
          />
        </div>
      </div>

      {/* Lightbox Preview */}
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

export default RecycleDetailPage;
