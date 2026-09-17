import { useEffect, useState } from 'react';
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

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiClient
      .get(`/truck-intakes/${id}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  }, [id]);

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

  const { intake, batteries } = data;
  const repairedCount = batteries.filter((b) => b.status === 'repaired').length;
  const returnedCount = batteries.filter((b) => b.status === 'returned').length;
  const inRepairCount = batteries.filter(
    (b) => !['repaired', 'returned', 'unserviceable', 'recycled', 'tested_parts_removed'].includes(b.status)
  ).length;
  const unserviceableCount = batteries.filter(
    (b) => b.status === 'unserviceable' || b.status === 'recycled' || b.status === 'tested_parts_removed'
  ).length;
  const isPending = intake.status === 'pending_arrival';

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

      <div className="mb-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <StatCard label="Batteries Delivered" value={intake.battery_count} tone="info" />
        <StatCard label="Repair Completed" value={repairedCount} tone="good" />
        <StatCard label="Returned to Client" value={returnedCount} tone="good" />
        <StatCard label="In Repair" value={inRepairCount} tone="warning" />
        <StatCard label="Unserviceable" value={unserviceableCount} tone="critical" />
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-neutral-100 uppercase tracking-wider">
            Batteries From This Truck ({batteries.length})
          </h2>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-surface-700">
          <DataTable
            headerColor="blue"
            showRowNumber
            bordered={false}
            maxHeight="440px"
            emptyMessage="No batteries recorded for this intake."
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
            ...(isPending
              ? [
                  {
                    key: 'scanned',
                    label: 'Scanned In',
                    render: (b) => {
                      const code = b.battery_code.toUpperCase();
                      const at = scannedAt[code];
                      return scannedSet.has(code) ? (
                        <span className="inline-flex flex-col items-start gap-0.5">
                          <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                            ✓ Verified
                          </span>
                          {at && (
                            <span className="text-[10px] font-semibold text-slate-400 dark:text-neutral-500">
                              {at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-bold text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-neutral-400">
                          Awaiting Scan
                        </span>
                      );
                    },
                  },
                ]
              : []),
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
          rows={batteries}
        />
        </div>
      </div>
    </div>
  );
}

export default TruckIntakeDetailPage;
