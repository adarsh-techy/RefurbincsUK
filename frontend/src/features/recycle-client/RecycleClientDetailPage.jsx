import { useEffect, useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import apiClient from '../../services/api-client';
import TableState from '../../components/ui/table/TableState';
import StatCard from '../../components/ui/primitives/StatCard';
import DataTable from '../../components/ui/table/DataTable';

function RecycleClientDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiClient
      .get(`/clients/${id}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const client = data?.client;
  const shipments = data?.shipments || [];
  const stats = data?.stats || { shipment_count: 0, battery_count: 0 };

  const avgPerShipment = useMemo(() => {
    if (!stats.shipment_count || stats.shipment_count === 0) return '0';
    return (stats.battery_count / stats.shipment_count).toFixed(1);
  }, [stats]);

  const filteredShipments = useMemo(() => {
    if (!search.trim()) return shipments;
    const q = search.trim().toLowerCase();
    return shipments.filter(
      (s) =>
        s.vehicle_number?.toLowerCase().includes(q) ||
        s.driver_name?.toLowerCase().includes(q)
    );
  }, [shipments, search]);

  if (loading) {
    return (
      <div className="py-12">
        <TableState>Loading recycle client details…</TableState>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="py-6">
        <Link
          to="/recycle-clients"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline dark:text-emerald-400"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 0 1 0 1.06L9.06 10l3.73 3.71a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
          </svg>
          Back to Recycle Clients
        </Link>
        <TableState tone="error">{error || 'Recycle client not found'}</TableState>
      </div>
    );
  }

  const columns = [
    {
      key: 'vehicle_number',
      label: 'Vehicle #',
      render: (row) => (
        <Link
          to={`/recycle/${row.id}`}
          className="inline-flex items-center gap-1.5 font-bold text-blue-700 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300 font-mono text-xs sm:text-sm"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
          {row.vehicle_number}
        </Link>
      ),
    },
    {
      key: 'driver_name',
      label: 'Driver Name',
      render: (row) => (
        <span className="font-medium text-slate-800 dark:text-neutral-200">
          👤 {row.driver_name}
        </span>
      ),
    },
    {
      key: 'battery_count',
      label: 'Batteries Received',
      render: (row) => (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-300">
          📦 {row.battery_count} units
        </span>
      ),
    },
    {
      key: 'recycled_at',
      label: 'Dispatched Date & Time',
      render: (row) => (
        <span className="text-xs text-slate-600 dark:text-neutral-300">
          {new Date(row.recycled_at).toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Top Breadcrumb */}
      <div>
        <Link
          to="/recycle-clients"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-blue-700 dark:text-neutral-400 dark:hover:text-blue-400 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path
              fillRule="evenodd"
              d="M12.79 5.23a.75.75 0 0 1 0 1.06L9.06 10l3.73 3.71a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
              clipRule="evenodd"
            />
          </svg>
          Back to Recycle Clients
        </Link>
      </div>

      {/* Classic Hero Header Card */}
      <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-slate-50/50 to-emerald-50/30 p-4 sm:p-6 shadow-xs dark:border-surface-700 dark:from-surface-900 dark:via-surface-850 dark:to-surface-800">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-xl text-white shadow-md shadow-emerald-500/20 dark:bg-emerald-500">
              🏢
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-neutral-100">
                  {client.name}
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Recycle Client Partner
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                Authorized recycling facility receiving unserviceable battery dispatches
              </p>
            </div>
          </div>
        </div>

        {/* Metadata Details Grid */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-slate-200/80 pt-4 dark:border-surface-700/80 text-xs">
          <div className="flex flex-col">
            <span className="text-slate-400 dark:text-neutral-500 uppercase tracking-wider font-semibold text-[10px]">Portal Login</span>
            <span className="mt-0.5 font-bold text-slate-800 dark:text-neutral-100 font-mono">
              {client.login_email ? `✉️ ${client.login_email}` : 'No login account'}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-slate-400 dark:text-neutral-500 uppercase tracking-wider font-semibold text-[10px]">Partner Since</span>
            <span className="mt-0.5 font-bold text-slate-800 dark:text-neutral-100">
              📅 {client.created_at ? new Date(client.created_at).toLocaleDateString() : '—'}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-slate-400 dark:text-neutral-500 uppercase tracking-wider font-semibold text-[10px]">Account ID</span>
            <span className="mt-0.5 font-bold text-slate-800 dark:text-neutral-100 font-mono">
              #{client.id}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <StatCard
          label="Shipments Dispatched"
          value={stats.shipment_count}
          tone="info"
          icon="🚚"
        />
        <StatCard
          label="Total Batteries Received"
          value={stats.battery_count}
          tone="good"
          icon="🔋"
        />
        <StatCard
          label="Avg Units / Shipment"
          value={avgPerShipment}
          tone="neutral"
          icon="📊"
        />
      </div>

      {/* Shipments History Table Card */}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs dark:border-surface-700 dark:bg-surface-850">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-neutral-100 uppercase tracking-wider">
              Assigned Shipments ({filteredShipments.length})
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-neutral-400">
              All vehicle runs dispatched to this recycling partner
            </p>
          </div>

          <div className="relative min-w-[14rem]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vehicle or driver..."
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

        <div className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-surface-700">
          <DataTable
            headerColor="blue"
            showRowNumber
            bordered={false}
            maxHeight="calc(100vh - 430px)"
            emptyMessage="No shipments recorded for this recycling partner yet."
            columns={columns}
            rows={filteredShipments}
          />
        </div>
      </div>
    </div>
  );
}

export default RecycleClientDetailPage;
