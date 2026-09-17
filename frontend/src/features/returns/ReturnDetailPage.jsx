import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import apiClient from '../../services/api-client';
import PageHeader from '../../components/ui/primitives/PageHeader';
import TableState from '../../components/ui/table/TableState';
import { StatusBadge } from '../../components/ui/primitives/Badge';
import StatCard from '../../components/ui/primitives/StatCard';
import DataTable from '../../components/ui/table/DataTable';

// Return detail page: which batteries shipped out on this return, and the
// service each one had just before shipping — reached by clicking the
// truck number on the Return Battery list.
function ReturnDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiClient
      .get(`/returns/${id}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <TableState>Loading…</TableState>;
  if (error) {
    return (
      <div>
        <Link to="/returns" className="mb-4 inline-block text-sm text-brand-700 hover:underline dark:text-emerald-400">
          ← Back to Returns
        </Link>
        <TableState tone="error">{error}</TableState>
      </div>
    );
  }

  const { returnRecord, batteries } = data;
  const returnedCount = batteries.filter((b) => b.status === 'returned').length;

  return (
    <div>
      <Link
        to="/returns"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-emerald-400"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path
            fillRule="evenodd"
            d="M12.79 5.23a.75.75 0 0 1 0 1.06L9.06 10l3.73 3.71a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
            clipRule="evenodd"
          />
        </svg>
        Back to Returns
      </Link>

      <PageHeader
        title={
          <>
            <span className="font-normal text-slate-400 dark:text-neutral-500">Truck</span>{' '}
            {returnRecord.truck_number}
          </>
        }
        description={
          <span className="mt-1 flex flex-col gap-3">
            <span>
              Driver: <span className="font-medium text-blue-700 dark:text-blue-400">{returnRecord.driver_name}</span>
            </span>
            {returnRecord.client_name && (
              <span>
                Client:{' '}
                <span className="font-medium text-blue-700 dark:text-blue-400">{returnRecord.client_name}</span>
              </span>
            )}
            <span>
              Date:{' '}
              <span className="font-medium text-blue-700 dark:text-blue-400">
                {new Date(returnRecord.returned_at).toLocaleDateString()}
              </span>
            </span>
            <span>
              Time:{' '}
              <span className="font-medium text-blue-700 dark:text-blue-400">
                {new Date(returnRecord.returned_at).toLocaleTimeString()}
              </span>
            </span>
          </span>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Batteries Shipped" value={returnRecord.battery_count} tone="info" />
        <StatCard label="Confirmed Returned" value={returnedCount} tone="good" />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-neutral-100">Batteries In This Return</h2>

        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-surface-700">
          <DataTable
            headerColor="blue"
            showRowNumber
            maxHeight="calc(100vh - 360px)"
            emptyMessage="No batteries recorded for this return."
            columns={[
              {
                key: 'battery_code',
                label: 'Battery ID',
                render: (b) => (
                  <Link
                    to={`/batteries/${b.battery_code}`}
                    className="font-medium text-blue-700 hover:underline dark:text-blue-400"
                  >
                    {b.battery_code}
                  </Link>
                ),
              },
              {
                key: 'last_repaired_at',
                label: 'Service Performed',
                render: (b) =>
                  b.last_repaired_at ? (
                    <span className="block whitespace-normal text-xs">
                      {new Date(b.last_repaired_at).toLocaleDateString()}
                      {b.last_repaired_parts && (
                        <span className="text-slate-400 dark:text-neutral-500"> · {b.last_repaired_parts}</span>
                      )}
                    </span>
                  ) : (
                    '—'
                  ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (b) => <StatusBadge status={b.status} />,
              },
            ]}
            rows={batteries}
          />
        </div>
      </div>
    </div>
  );
}

export default ReturnDetailPage;
