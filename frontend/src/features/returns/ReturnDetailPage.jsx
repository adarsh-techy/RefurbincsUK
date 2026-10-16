import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiFileText, FiDownload } from 'react-icons/fi';
import apiClient from '../../services/api-client';
import PageHeader from '../../components/ui/primitives/PageHeader';
import TableState from '../../components/ui/table/TableState';
import { StatusBadge } from '../../components/ui/primitives/Badge';
import StatCard from '../../components/ui/primitives/StatCard';
import DataTable from '../../components/ui/table/DataTable';
import { resolveImageUrl } from '../../utils/image-url';

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
    <div className="space-y-4">
      {/* Executive Header Card */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs dark:border-white/10 dark:bg-surface-900">
        <div className="mb-3">
          <Link
            to="/returns"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-700 hover:text-violet-800 hover:underline dark:text-violet-400"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path
                fillRule="evenodd"
                d="M12.79 5.23a.75.75 0 0 1 0 1.06L9.06 10l3.73 3.71a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
                clipRule="evenodd"
              />
            </svg>
            Back to Return Dispatches
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3 dark:border-white/5">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-neutral-100">
              <span className="font-normal text-slate-400 dark:text-neutral-500">Truck</span> {returnRecord.truck_number}
            </h1>
            <span className="rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-700 dark:border-violet-800/40 dark:bg-violet-950/40 dark:text-violet-300">
              Return Dispatch #{returnRecord.id}
            </span>
          </div>
          {returnRecord.document_url && (
            <a
              href={resolveImageUrl(returnRecord.document_url)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300 transition-colors"
            >
              <FiFileText className="h-3.5 w-3.5" />
              <span>{returnRecord.document_name || 'Download Dispatch Note'}</span>
              <FiDownload className="h-3 w-3 opacity-70" />
            </a>
          )}
        </div>

        {/* Metadata Grid */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Driver</span>
            <span className="font-semibold text-slate-800 dark:text-neutral-200">{returnRecord.driver_name || '—'}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Client</span>
            <span className="font-semibold text-slate-800 dark:text-neutral-200">{returnRecord.client_name || '—'}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Dispatched Date</span>
            <span className="text-slate-700 dark:text-neutral-300">
              {new Date(returnRecord.returned_at).toLocaleDateString()}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Dispatched Time</span>
            <span className="text-slate-700 dark:text-neutral-300">
              {new Date(returnRecord.returned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard label="Batteries Shipped" value={returnRecord.battery_count} tone="info" />
        <StatCard label="Confirmed Returned" value={returnedCount} tone="good" />
      </div>

      {/* Battery List Card */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-5 shadow-2xs dark:border-white/10 dark:bg-surface-900 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-200">
            Batteries In This Return
          </h2>
          <span className="text-xs text-slate-400 dark:text-neutral-500 font-semibold">
            {batteries.length} {batteries.length === 1 ? 'unit' : 'units'}
          </span>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200/90 dark:border-white/10">
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
                    className="font-mono text-xs font-bold text-violet-700 hover:text-violet-900 hover:underline dark:text-violet-400"
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
                    <span className="block whitespace-normal text-xs text-slate-700 dark:text-neutral-300">
                      {new Date(b.last_repaired_at).toLocaleDateString()}
                      {b.last_repaired_parts && (
                        <span className="text-slate-400 dark:text-neutral-500"> · {b.last_repaired_parts}</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
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

        {/* Mobile Battery Cards (Zero Horizontal Scroll) */}
        <div className="block md:hidden space-y-2">
          {batteries.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">No batteries recorded for this return.</p>
          ) : (
            batteries.map((b, i) => (
              <div
                key={b.id || b.battery_code}
                className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-2.5 dark:border-white/10 dark:bg-surface-800 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-slate-400">#{i + 1}</span>
                    <Link
                      to={`/batteries/${b.battery_code}`}
                      className="font-mono text-xs font-extrabold text-violet-700 hover:underline dark:text-violet-400"
                    >
                      {b.battery_code}
                    </Link>
                  </div>
                  <StatusBadge status={b.status} />
                </div>
                <div className="border-t border-slate-200/60 pt-1 text-xs dark:border-white/5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Service Performed</span>
                  <span className="text-slate-700 dark:text-neutral-300">
                    {b.last_repaired_at ? new Date(b.last_repaired_at).toLocaleDateString() : '—'}
                    {b.last_repaired_at && b.last_repaired_parts ? (
                      <span className="text-slate-400"> · {b.last_repaired_parts}</span>
                    ) : null}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default ReturnDetailPage;
