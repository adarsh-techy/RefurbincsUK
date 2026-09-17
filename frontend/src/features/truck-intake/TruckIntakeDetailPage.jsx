import { useEffect, useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import apiClient from '../../services/api-client';
import PageHeader from '../../components/ui/primitives/PageHeader';
import TableState from '../../components/ui/table/TableState';
import { StatusBadge } from '../../components/ui/primitives/Badge';
import StatCard from '../../components/ui/primitives/StatCard';
import DataTable from '../../components/ui/table/DataTable';
import TruckVerifyModal from './TruckVerifyModal';

function isThisMonth(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function TruckIntakeDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiClient
      .get(`/truck-intakes/${id}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const { intake, batteries } = data || { intake: {}, batteries: [] };
  const repairedCount = (batteries || []).filter((b) => b.status === 'repaired').length;
  const returnedCount = (batteries || []).filter((b) => b.status === 'returned').length;
  const inRepairCount = (batteries || []).filter(
    (b) => !['repaired', 'returned', 'unserviceable', 'recycled', 'tested_parts_removed'].includes(b.status)
  ).length;
  const unserviceableCount = (batteries || []).filter(
    (b) => b.status === 'unserviceable' || b.status === 'recycled' || b.status === 'tested_parts_removed'
  ).length;
  const isPending = intake?.status === 'pending_arrival';

  const filteredBatteries = useMemo(() => {
    if (!batteries) return [];
    return batteries.filter((b) => {
      // Status filter
      if (statusFilter === 'repaired' && b.status !== 'repaired') return false;
      if (statusFilter === 'returned' && b.status !== 'returned') return false;
      if (
        statusFilter === 'in_repair' &&
        ['repaired', 'returned', 'unserviceable', 'recycled', 'tested_parts_removed'].includes(b.status)
      ) {
        return false;
      }
      if (
        statusFilter === 'unserviceable' &&
        !['unserviceable', 'recycled', 'tested_parts_removed'].includes(b.status)
      ) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const code = (b.battery_code || '').toLowerCase();
        const serial = (b.serial_number || '').toLowerCase();
        const parts = (b.last_repaired_parts || '').toLowerCase();
        if (!code.includes(q) && !serial.includes(q) && !parts.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [batteries, statusFilter, searchQuery]);

  if (loading) return <TableState>Loading…</TableState>;
  if (error) {
    return (
      <div>
        <Link to="/truck-intakes" className="mb-4 inline-block text-sm text-brand-700 hover:underline dark:text-emerald-400">
          ← Back to Intake
        </Link>
        <TableState tone="error">{error}</TableState>
      </div>
    );
  }

  return (
    <div>
      <Link
        to="/truck-intakes"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-emerald-400"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path
            fillRule="evenodd"
            d="M12.79 5.23a.75.75 0 0 1 0 1.06L9.06 10l3.73 3.71a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
            clipRule="evenodd"
          />
        </svg>
        Back to Intake
      </Link>

      <PageHeader
        title={
          <>
            <span className="font-normal text-slate-400 dark:text-neutral-500">Truck</span> {intake.truck_number}
          </>
        }
        description={
          <span className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-600 dark:text-neutral-300">
            <span>Driver: <strong className="font-bold text-blue-700 dark:text-blue-400">{intake.driver_name}</strong></span>
            {intake.client_name && (
              <span>Client: <strong className="font-bold text-blue-700 dark:text-blue-400">{intake.client_name}</strong></span>
            )}
            <span>Date: <strong className="font-bold text-blue-700 dark:text-blue-400">{new Date(intake.intake_at).toLocaleDateString()}</strong></span>
            <span>Time: <strong className="font-bold text-blue-700 dark:text-blue-400">{new Date(intake.intake_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>
          </span>
        }
      />

      {isPending ? (
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50/90 p-3.5 shadow-xs dark:border-amber-800/60 dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-base shadow-2xs dark:bg-amber-900/60">
              🚚
            </span>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-200">
                Pending Arrival — Packed by Client for Repair
              </h3>
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                Scan every battery as it comes off the truck to check it against the client's list.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <span className="rounded-xl bg-white px-3 py-1.5 text-xs font-black text-amber-900 shadow-2xs dark:bg-surface-900 dark:text-amber-200">
              {batteries.length} expected
            </span>
            <button
              type="button"
              onClick={() => setVerifyModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-emerald-700 active:scale-95 dark:bg-emerald-600 dark:hover:bg-emerald-500 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M1 4.75C1 3.784 1.784 3 2.75 3h14.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 17.25 17H2.75A1.75 1.75 0 0 1 1 15.25V4.75ZM2.75 4.5a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h14.5a.25.25 0 0 0 .25-.25V4.75a.25.25 0 0 0-.25-.25H2.75Z" clipRule="evenodd" />
                <path d="M4 6.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5A.75.75 0 0 1 4 6.25Zm0 3.75a.75.75 0 0 1 .75-.75h5.5a.75.75 0 0 1 0 1.5h-5.5A.75.75 0 0 1 4 10Zm0 3.75a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 0 1.5h-3.5a.75.75 0 0 1-.75-.75Z" />
              </svg>
              <span>Scan to Verify</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-2 text-xs font-semibold text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-emerald-600">
            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
          </svg>
          <span>Truck arrival verified at workshop on {new Date(intake.verified_at || intake.intake_at).toLocaleString()}</span>
        </div>
      )}

      {/* Verification Modal */}
      {verifyModalOpen && (
        <TruckVerifyModal
          intakeId={id}
          initialData={data}
          onClose={() => setVerifyModalOpen(false)}
          onSuccess={() => {
            apiClient.get(`/truck-intakes/${id}`).then((res) => setData(res.data));
            setVerifyModalOpen(false);
          }}
        />
      )}

      {/* Interactive Stat Cards */}
      <div className="mb-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`text-left transition-all rounded-xl focus:outline-hidden ${
            statusFilter === 'all'
              ? 'ring-2 ring-blue-600 dark:ring-blue-400 ring-offset-2 dark:ring-offset-surface-900 shadow-md scale-[1.02]'
              : 'hover:opacity-90 hover:scale-[1.01] opacity-95'
          }`}
        >
          <StatCard label="Batteries Delivered" value={intake.battery_count} tone="info" />
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'repaired' ? 'all' : 'repaired')}
          className={`text-left transition-all rounded-xl focus:outline-hidden ${
            statusFilter === 'repaired'
              ? 'ring-2 ring-emerald-600 dark:ring-emerald-400 ring-offset-2 dark:ring-offset-surface-900 shadow-md scale-[1.02]'
              : 'hover:opacity-90 hover:scale-[1.01] opacity-95'
          }`}
        >
          <StatCard label="Repair Completed" value={repairedCount} tone="good" />
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'returned' ? 'all' : 'returned')}
          className={`text-left transition-all rounded-xl focus:outline-hidden ${
            statusFilter === 'returned'
              ? 'ring-2 ring-blue-600 dark:ring-blue-400 ring-offset-2 dark:ring-offset-surface-900 shadow-md scale-[1.02]'
              : 'hover:opacity-90 hover:scale-[1.01] opacity-95'
          }`}
        >
          <StatCard label="Returned to Client" value={returnedCount} tone="info" />
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'in_repair' ? 'all' : 'in_repair')}
          className={`text-left transition-all rounded-xl focus:outline-hidden ${
            statusFilter === 'in_repair'
              ? 'ring-2 ring-amber-600 dark:ring-amber-400 ring-offset-2 dark:ring-offset-surface-900 shadow-md scale-[1.02]'
              : 'hover:opacity-90 hover:scale-[1.01] opacity-95'
          }`}
        >
          <StatCard label="In Repair" value={inRepairCount} tone="warning" />
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'unserviceable' ? 'all' : 'unserviceable')}
          className={`text-left transition-all rounded-xl focus:outline-hidden ${
            statusFilter === 'unserviceable'
              ? 'ring-2 ring-red-600 dark:ring-red-400 ring-offset-2 dark:ring-offset-surface-900 shadow-md scale-[1.02]'
              : 'hover:opacity-90 hover:scale-[1.01] opacity-95'
          }`}
        >
          <StatCard label="Unserviceable" value={unserviceableCount} tone="critical" />
        </button>
      </div>

      <div className="space-y-3">
        {/* Header & Filter Controls Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-neutral-100 uppercase tracking-wider">
              Batteries From This Truck ({filteredBatteries.length}
              {filteredBatteries.length !== batteries.length && (
                <span className="font-normal text-slate-400 dark:text-neutral-500"> of {batteries.length}</span>
              )})
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search battery ID, serial…"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 pl-8 text-xs font-medium text-slate-800 placeholder-slate-400 shadow-2xs transition-all focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-200 dark:placeholder-neutral-500"
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400 dark:text-neutral-500"
              >
                <path
                  fillRule="evenodd"
                  d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
                  clipRule="evenodd"
                />
              </svg>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:text-neutral-500 dark:hover:text-neutral-300"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status Tabs Filter */}
            <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-surface-800/80">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs dark:bg-surface-700 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-neutral-200'
                }`}
              >
                All ({batteries.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('repaired')}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === 'repaired'
                    ? 'bg-emerald-600 text-white shadow-2xs dark:bg-emerald-600'
                    : 'text-slate-600 hover:text-emerald-700 dark:text-neutral-400 dark:hover:text-emerald-400'
                }`}
              >
                Completed ({repairedCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('returned')}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === 'returned'
                    ? 'bg-blue-600 text-white shadow-2xs dark:bg-blue-600'
                    : 'text-slate-600 hover:text-blue-700 dark:text-neutral-400 dark:hover:text-blue-400'
                }`}
              >
                Returned ({returnedCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('in_repair')}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === 'in_repair'
                    ? 'bg-amber-500 text-white shadow-2xs dark:bg-amber-600'
                    : 'text-slate-600 hover:text-amber-700 dark:text-neutral-400 dark:hover:text-amber-400'
                }`}
              >
                In Repair ({inRepairCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('unserviceable')}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === 'unserviceable'
                    ? 'bg-red-600 text-white shadow-2xs dark:bg-red-600'
                    : 'text-slate-600 hover:text-red-700 dark:text-neutral-400 dark:hover:text-red-400'
                }`}
              >
                Unserviceable ({unserviceableCount})
              </button>
            </div>

            {(statusFilter !== 'all' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('all');
                  setSearchQuery('');
                }}
                className="rounded-xl border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-600 shadow-2xs hover:bg-slate-50 dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-300 dark:hover:bg-surface-700 cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Battery Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-surface-700">
          <DataTable
            headerColor="blue"
            showRowNumber
            bordered={false}
            maxHeight="440px"
            emptyMessage={
              statusFilter !== 'all' || searchQuery
                ? 'No batteries found matching the current filter.'
                : 'No batteries recorded for this intake.'
            }
            columns={[
              {
                key: 'battery_code',
                label: 'Battery ID',
                render: (b) => (
                  <Link
                    to={`/batteries/${b.battery_code}`}
                    className="font-semibold text-blue-700 hover:underline dark:text-blue-400"
                  >
                    {b.battery_code}
                  </Link>
                ),
              },
              {
                key: 'created_at',
                label: 'Date',
                render: (b) => new Date(b.created_at).toLocaleDateString(),
              },
              {
                key: 'last_repaired_at',
                label: 'Previous Service Date',
                render: (b) =>
                  b.last_repaired_at ? (
                    <span className="block whitespace-normal text-xs">
                      <span
                        className={
                          isThisMonth(b.last_repaired_at)
                            ? 'font-semibold text-critical-600 dark:text-red-400'
                            : undefined
                        }
                      >
                        {new Date(b.last_repaired_at).toLocaleDateString()}
                      </span>
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
            rows={filteredBatteries}
          />
        </div>
      </div>
    </div>
  );
}

export default TruckIntakeDetailPage;
