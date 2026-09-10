import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import apiClient from '../../services/api-client';
import PageHeader from '../../components/ui/PageHeader';
import TableState from '../../components/ui/TableState';
import { StatusBadge } from '../../components/ui/Badge';
import StatCard from '../../components/ui/StatCard';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { hasPermission } from '../../utils/permissions';
import RestockForm from './RestockForm';

const MONTHS_SHOWN = 6;

// Buckets usage (repairs) and restocks (manual top-ups) into the last N
// calendar months, oldest first — months with no activity show as 0 rather
// than being skipped, same fixed-window approach as the dashboard charts.
function buildMonthlyBreakdown(usageHistory, stockHistory) {
  const monthKey = (dateString) => {
    const d = new Date(dateString);
    return `${d.getFullYear()}-${d.getMonth()}`;
  };

  const usedByMonth = {};
  usageHistory.forEach((h) => {
    const key = monthKey(h.repaired_at);
    usedByMonth[key] = (usedByMonth[key] || 0) + Number(h.quantity_used);
  });

  const restockedByMonth = {};
  stockHistory.forEach((a) => {
    const key = monthKey(a.adjusted_at);
    restockedByMonth[key] = (restockedByMonth[key] || 0) + Number(a.quantity_added);
  });

  const now = new Date();
  const months = [];
  for (let i = MONTHS_SHOWN - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    months.push({
      key,
      label: d.toLocaleDateString([], { month: 'short', year: 'numeric' }),
      restocked: restockedByMonth[key] || 0,
      used: usedByMonth[key] || 0,
    });
  }
  return months;
}

// A part's detail page — stock/cost at a glance, every repair that's ever
// used it, every manual restock, and a monthly restocked-vs-used breakdown
// so a manager can see how often it's needed vs how often it's topped up.
function PartDetailPage() {
  const { id } = useParams();
  const user = useSelector((state) => state.auth.user);
  const canManageParts = hasPermission(user, 'parts');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [restocking, setRestocking] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    apiClient
      .get(`/parts/${id}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  if (loading) return <TableState>Loading…</TableState>;
  if (error) {
    return (
      <div>
        <Link to="/parts" className="mb-4 inline-block text-sm text-brand-700 hover:underline dark:text-emerald-400">
          ← Back to Inventory
        </Link>
        <TableState tone="error">{error}</TableState>
      </div>
    );
  }

  const { part, usageHistory, stockHistory = [] } = data;
  const totalQuantityUsed = usageHistory.reduce((sum, h) => sum + Number(h.quantity_used), 0);
  const totalRevenue = usageHistory.reduce(
    (sum, h) => sum + Number(h.price) + Number(h.labor_charge || 0),
    0
  );
  const totalRestocked = stockHistory.reduce((sum, a) => sum + Number(a.quantity_added), 0);
  const monthlyBreakdown = buildMonthlyBreakdown(usageHistory, stockHistory);
  const maxMonthly = Math.max(1, ...monthlyBreakdown.flatMap((m) => [m.restocked, m.used]));

  function handleRestocked() {
    setRestocking(false);
    load();
  }

  return (
    <div>
      <Link
        to="/parts"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-emerald-400"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path
            fillRule="evenodd"
            d="M12.79 5.23a.75.75 0 0 1 0 1.06L9.06 10l3.73 3.71a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
            clipRule="evenodd"
          />
        </svg>
        Back to Inventory
      </Link>

      <PageHeader title={part.name} description={part.sku ? `SKU: ${part.sku}` : 'No SKU on file'}>
        {canManageParts && <Button onClick={() => setRestocking(true)}>+ Restock</Button>}
      </PageHeader>

      {restocking && (
        <Modal
          title="Restock Part"
          description={`Add stock for "${part.name}".`}
          onClose={() => setRestocking(false)}
        >
          <RestockForm part={part} onSaved={handleRestocked} onCancel={() => setRestocking(false)} />
        </Modal>
      )}

      <div
        className={`mb-6 flex flex-wrap items-center gap-4 rounded-xl border-l-4 border-y border-r border-slate-200 bg-gradient-to-r p-5 shadow-sm dark:border-y-surface-700 dark:border-r-surface-700 ${
          part.in_stock
            ? 'border-brand-500 from-emerald-50 to-white dark:from-emerald-500/15 dark:to-black'
            : 'border-critical-500 from-red-50 to-white dark:from-red-500/15 dark:to-black'
        }`}
      >
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
            part.in_stock
              ? 'bg-brand-100 text-brand-700 dark:bg-emerald-500/15 dark:text-emerald-300'
              : 'bg-critical-100 text-critical-700 dark:bg-red-500/15 dark:text-red-300'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
            <path d="M20 7h-3.17l-1.24-1.86A2 2 0 0 0 13.93 4h-3.86a2 2 0 0 0-1.66.9L7.17 7H4a1 1 0 0 0-1 1v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a1 1 0 0 0-1-1Zm-8 9a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" />
          </svg>
        </span>
        <div className="flex-1">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              part.in_stock
                ? 'bg-brand-100 text-brand-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                : 'bg-critical-100 text-critical-700 dark:bg-red-500/15 dark:text-red-300'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${part.in_stock ? 'bg-brand-600 dark:bg-emerald-400' : 'bg-critical-600 dark:bg-red-400'}`} />
            {part.in_stock ? 'In Stock' : 'Out of Stock'}
          </span>
          <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">
            {part.quantity} unit{part.quantity === 1 ? '' : 's'} remaining
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Times Used" value={usageHistory.length} tone="good" />
        <StatCard label="Total Quantity Used" value={totalQuantityUsed} tone="info" />
        <StatCard label="Total Restocked" value={totalRestocked} tone="critical" />
        <StatCard label="Price" value={`£${Number(part.repair_cost).toFixed(2)}`} tone="warning" />
        <StatCard label="Service Charge" value={`£${Number(part.service_charge || 0).toFixed(2)}`} tone="warning" />
        <StatCard label="Total Revenue" value={`£${totalRevenue.toFixed(2)}`} tone="good" />
      </div>

      <div className="mb-6 rounded-xl border border-blue-300 bg-white p-5 shadow-sm dark:border-blue-800/40 dark:bg-black">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-neutral-100">
            Monthly Activity <span className="text-slate-400 dark:text-neutral-500">· last {MONTHS_SHOWN} months</span>
          </h2>
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-neutral-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500" /> Restocked
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-critical-500 dark:bg-red-400" /> Used
            </span>
          </div>
        </div>

        <div className="flex items-end gap-3" style={{ height: 140 }}>
          {monthlyBreakdown.map((m) => (
            <div key={m.key} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-full w-full items-end justify-center gap-1">
                <div
                  className="w-1/2 max-w-[18px] rounded-t bg-blue-500"
                  style={{ height: `${Math.max(4, (m.restocked / maxMonthly) * 100)}%` }}
                  title={`Restocked: ${m.restocked}`}
                />
                <div
                  className="w-1/2 max-w-[18px] rounded-t bg-critical-500 dark:bg-red-400"
                  style={{ height: `${Math.max(4, (m.used / maxMonthly) * 100)}%` }}
                  title={`Used: ${m.used}`}
                />
              </div>
              <span className="text-[10px] text-slate-500 dark:text-neutral-500">{m.label}</span>
              <span className="text-[10px] text-slate-400 dark:text-neutral-600">
                +{m.restocked} / -{m.used}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-blue-300 bg-white p-5 shadow-sm dark:border-blue-800/40 dark:bg-black">
        <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-neutral-100">Restock History</h2>

        {stockHistory.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500 dark:text-neutral-400">
            This part hasn't been restocked yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-surface-800">
            {stockHistory.map((a) => (
              <li key={a.id} className="flex gap-4 py-4 text-sm first:pt-0 last:pb-0">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                    <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
                  </svg>
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-blue-700 dark:text-blue-300">+{a.quantity_added} units</span>
                    <span className="text-xs text-slate-400 dark:text-neutral-500">
                      {new Date(a.adjusted_at).toLocaleString()}
                    </span>
                  </div>
                  <span className="text-slate-500 dark:text-neutral-400">
                    By <span className="font-semibold text-slate-700 dark:text-neutral-200">{a.adjusted_by_name || 'Unknown'}</span>
                  </span>
                  {a.note && <p className="text-xs text-slate-400 dark:text-neutral-500">{a.note}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-blue-300 bg-white p-5 shadow-sm dark:border-blue-800/40 dark:bg-black">
        <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-neutral-100">Usage History</h2>

        {usageHistory.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500 dark:text-neutral-400">
            This part hasn't been used in any repair yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-surface-800">
            {usageHistory.map((h) => (
              <li key={h.id} className="flex gap-4 py-5 text-sm first:pt-0 last:pb-0">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                    <path
                      fillRule="evenodd"
                      d="M14.279 2.152a.75.75 0 0 1 .07 1.058l-2.487 2.85 1.278 1.279 2.85-2.488a.75.75 0 0 1 1.058.07 4.5 4.5 0 0 1-5.048 6.965l-4.5 4.949a2.121 2.121 0 1 1-3-3l4.949-4.5a4.5 4.5 0 0 1 6.965-5.048 4.462 4.462 0 0 1 .865-1.135ZM4.5 15a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/batteries/${h.battery_code}`}
                        className="font-medium text-blue-700 hover:underline dark:text-blue-400"
                      >
                        {h.battery_code}
                      </Link>
                      <StatusBadge status={h.battery_status} />
                    </div>
                    <span className="text-xs text-slate-400 dark:text-neutral-500">
                      {new Date(h.repaired_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-slate-500 dark:text-neutral-400">
                    <span>
                      By <span className="font-semibold text-brand-700 dark:text-emerald-300">{h.staff_name}</span>
                    </span>
                    <span>
                      Quantity: <span className="font-semibold text-slate-700 dark:text-neutral-200">{h.quantity_used}</span>
                    </span>
                  </div>
                  {h.notes && <p className="text-xs text-slate-400 dark:text-neutral-500">{h.notes}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default PartDetailPage;
