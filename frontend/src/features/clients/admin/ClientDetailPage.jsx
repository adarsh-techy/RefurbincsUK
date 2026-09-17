import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import apiClient from '../../../services/api-client';
import PageHeader from '../../../components/ui/primitives/PageHeader';
import TableState from '../../../components/ui/table/TableState';
import StatCard from '../../../components/ui/primitives/StatCard';

const STATUS_BREAKDOWN = [
  { key: 'in_repair_count', label: 'Awaiting Repair', dot: 'bg-warning-500' },
  { key: 'in_progress_count', label: 'Repair In Progress', dot: 'bg-critical-500' },
  { key: 'in_testing_count', label: 'In Testing', dot: 'bg-blue-500' },
  { key: 'repaired_count', label: 'Repair Completed', dot: 'bg-brand-500' },
  { key: 'returned_count', label: 'Returned to Client', dot: 'bg-info-500' },
];

// A client's detail page — status breakdown across every battery they've
// sent in via a tagged truck intake, plus their full billing history.
function ClientDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiClient
      .get(`/clients/${id}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <TableState>Loading…</TableState>;
  if (error) {
    return (
      <div>
        <Link to="/clients" className="mb-4 inline-block text-sm text-brand-700 hover:underline dark:text-emerald-400">
          ← Back to Clients
        </Link>
        <TableState tone="error">{error}</TableState>
      </div>
    );
  }

  const { client, stats, transactions } = data;

  return (
    <div>
      <Link
        to="/clients"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-emerald-400"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path
            fillRule="evenodd"
            d="M12.79 5.23a.75.75 0 0 1 0 1.06L9.06 10l3.73 3.71a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
            clipRule="evenodd"
          />
        </svg>
        Back to Clients
      </Link>

      <PageHeader
        title={client.name}
        description={
          client.invoice_email
            ? `Invoice Email: ${client.invoice_email}${client.login_email ? ` • Login: ${client.login_email}` : ''}`
            : client.login_email
              ? `Login: ${client.login_email}`
              : 'No login access'
        }
      />

      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border-l-4 border-y border-r border-slate-200 bg-gradient-to-r from-emerald-50/70 via-white to-emerald-50/30 p-4 sm:p-5 shadow-sm dark:border-y-surface-700 dark:border-r-surface-700 dark:from-emerald-500/10 dark:via-surface-900 dark:to-surface-850 border-emerald-500">
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 shadow-2xs">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.42 0-8 2.24-8 5v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2c0-2.76-3.58-5-8-5Z" />
            </svg>
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {STATUS_BREAKDOWN.map((s) => (
                <span key={s.key} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-neutral-300">
                  <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                  {s.label}: <span className="font-bold text-slate-900 dark:text-white">{stats[s.key]}</span>
                </span>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
              Client since {client.created_at ? new Date(client.created_at).toLocaleDateString() : '—'}
            </p>
          </div>
        </div>

        <Link
          to={`/certificates/client/${client.id}`}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 dark:bg-surface-700 dark:hover:bg-surface-600 dark:border dark:border-white/10 transition-colors shadow-2xs shrink-0 cursor-pointer"
        >
          <span>🏆 Milestone &amp; ESG Impact</span>
          <span>→</span>
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Batteries" value={stats.battery_count} tone="good" />
        <StatCard label="Repair Visits" value={stats.repair_visit_count} tone="info" />
        <StatCard label="Balance" value={`£${Number(stats.balance).toFixed(2)}`} tone="warning" />
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-sm dark:border-white/10 dark:bg-surface-900">
        <h2 className="mb-4 border-b border-slate-100 pb-4 text-sm font-bold text-slate-900 dark:border-white/5 dark:text-white">
          Billing History
        </h2>

        {transactions.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500 dark:text-neutral-400">
            No repair charges logged for this client yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-surface-800">
            {transactions.map((t) => (
              <li key={t.batch_id} className="flex gap-4 py-5 text-sm first:pt-0 last:pb-0">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                    <path d="M4 4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H4Zm0 3h12v1H4V7Zm0 3h5v3H4v-3Z" />
                  </svg>
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      to={`/batteries/${t.battery_code}`}
                      className="font-medium text-blue-700 hover:underline dark:text-blue-400"
                    >
                      {t.battery_code}
                    </Link>
                    <span className="text-xs text-slate-400 dark:text-neutral-500">
                      {new Date(t.repaired_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-slate-500 dark:text-neutral-400">
                    <span>
                      {t.part_name.includes(',') ? 'Parts:' : 'Part:'}{' '}
                      <span className="text-xs font-semibold text-brand-700 dark:text-emerald-300">{t.part_name}</span>
                    </span>
                    <span>
                      By <span className="font-semibold text-slate-700 dark:text-neutral-200">{t.staff_name}</span>
                    </span>
                    <span className="ml-auto text-sm font-semibold text-pink-800 dark:text-pink-400">
                      £{Number(t.amount).toFixed(2)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default ClientDetailPage;
