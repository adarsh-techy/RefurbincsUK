import { useState } from 'react';
import { Link } from 'react-router-dom';
import useFetchList from '../../utils/use-fetch-list';
import DataTable from '../../components/ui/DataTable';
import TableState from '../../components/ui/TableState';
import PageHeader from '../../components/ui/PageHeader';

function toLocalDateValue(value) {
  const dt = new Date(value);
  const offset = dt.getTimezoneOffset();
  return new Date(dt.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function RecycleClientShipmentsPage() {
  const { data, loading, error } = useFetchList('/recycle-client/me/shipments');
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');

  const shipments = data?.data || data || [];

  const filtered = shipments.filter((row) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      row.driver_name?.toLowerCase().includes(q) ||
      row.vehicle_number?.toLowerCase().includes(q);
    const matchesDate = !date || toLocalDateValue(row.recycled_at) === date;
    return matchesSearch && matchesDate;
  });

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
      label: 'Received At',
      render: (row) => new Date(row.recycled_at).toLocaleString(),
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <Link
          to={`/recycle/${row.id}`}
          className="text-sm font-medium text-brand-700 hover:underline dark:text-emerald-400"
        >
          View shipment →
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recycle Shipments"
        description="All unserviceable battery shipments dispatched to your facility."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by driver or vehicle..."
            className="w-full max-w-xs rounded-md border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-100"
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-100"
          />
          {(search || date) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setDate('');
              }}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-white"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {loading && <TableState>Loading shipments…</TableState>}
      {error && <TableState tone="error">{error}</TableState>}

      {!loading && !error && (
        <DataTable
          columns={columns}
          rows={filtered}
          showRowNumber
          emptyMessage="No recycle shipments match your filter criteria."
        />
      )}
    </div>
  );
}

export default RecycleClientShipmentsPage;
