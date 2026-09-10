import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../services/api-client';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import TableState from '../../components/ui/TableState';
import DataTable from '../../components/ui/DataTable';

// A recycle client's own read-only dashboard: summary of recycle batches
// received, total unserviceable batteries received for recycling, and recent shipments.
function RecycleClientDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient
      .get('/recycle-client/me/dashboard')
      .then(({ data }) => {
        if (!cancelled) setData(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <TableState>Loading…</TableState>;
  if (error) return <TableState tone="error">{error}</TableState>;

  const { client, stats, recentShipments } = data;

  const columns = [
    {
      key: 'vehicle_number',
      label: 'Vehicle',
      render: (row) => (
        <Link
          to={`/recycle/${row.id}`}
          className="font-medium text-brand-700 hover:underline dark:text-emerald-400"
        >
          {row.vehicle_number}
        </Link>
      ),
    },
    { key: 'driver_name', label: 'Driver' },
    {
      key: 'battery_count',
      label: 'Batteries',
      render: (row) => (
        <span className="font-semibold text-slate-800 dark:text-neutral-200">
          {row.battery_count} units
        </span>
      ),
    },
    {
      key: 'recycled_at',
      label: 'Date Received',
      render: (row) => new Date(row.recycled_at).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <Link
          to={`/recycle/${row.id}`}
          className="text-sm font-medium text-brand-700 hover:underline dark:text-emerald-400"
        >
          View Details →
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${client?.name || 'Recycle Partner'}`}
        description="Overview of unserviceable battery recycling shipments assigned to you."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Shipments"
          value={stats?.shipment_count || 0}
          tone="info"
        />
        <StatCard
          label="Total Batteries Received"
          value={stats?.total_batteries || 0}
          tone="good"
        />
        <StatCard
          label="Latest Shipment"
          value={
            stats?.latest_shipment_at
              ? new Date(stats.latest_shipment_at).toLocaleDateString()
              : 'None'
          }
          tone="warning"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-surface-700 dark:bg-black">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-neutral-100">
              Recent Recycle Shipments
            </h2>
            <p className="text-xs text-slate-500 dark:text-neutral-400">
              The latest battery batches transferred to your facility.
            </p>
          </div>
          <Link
            to="/my/recycle-shipments"
            className="text-sm font-medium text-brand-700 hover:underline dark:text-emerald-400"
          >
            View all shipments →
          </Link>
        </div>

        <DataTable
          columns={columns}
          rows={recentShipments || []}
          emptyMessage="No recycle shipments recorded for your account yet."
        />
      </div>
    </div>
  );
}

export default RecycleClientDashboardPage;
