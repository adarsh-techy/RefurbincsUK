import { useEffect, useState } from 'react';
import apiClient from '../../../services/api-client';
import PageHeader from '../../../components/ui/primitives/PageHeader';
import StatCard from '../../../components/ui/primitives/StatCard';
import BarChart from '../../../components/ui/charts/BarChart';
import TableState from '../../../components/ui/table/TableState';

const DAYS_SHOWN = 14;

// Same fixed-window bucketing as StaffDetailPage's admin-facing version —
// days with no repairs show as 0 rather than being skipped.
function buildDailyCounts(repairs) {
  const countsByDay = {};
  for (const r of repairs) {
    const day = new Date(r.repaired_at).toDateString();
    countsByDay[day] = (countsByDay[day] || 0) + 1;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const series = [];
  for (let i = DAYS_SHOWN - 1; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    series.push({
      label: day.toLocaleDateString([], { day: '2-digit', month: 'short' }),
      count: countsByDay[day.toDateString()] || 0,
    });
  }
  return series;
}

// A technician's own stats: how much they've done today and lately. Scoped
// server-side to whichever `staff` row is linked to the logged-in account
// (GET /staff/me).
function TechnicianDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient
      .get('/staff/me')
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

  const { staff, repairs } = data;
  const dailyCounts = buildDailyCounts(repairs);
  const hasRecentActivity = dailyCounts.some((d) => d.count > 0);
  const todayCount = dailyCounts[dailyCounts.length - 1]?.count || 0;

  return (
    <div>
      <PageHeader title={`Welcome, ${staff.name}`} description="Your repair activity at a glance." />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Repairs Today" value={todayCount} tone="good" />
        <StatCard label="Total Repairs" value={repairs.length} tone="info" />
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm dark:border-blue-800/40 dark:bg-blue-900/20">
        <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-neutral-100">
          Repairs per day (last {DAYS_SHOWN} days)
        </h2>
        {hasRecentActivity ? (
          <BarChart data={dailyCounts} />
        ) : (
          <p className="py-6 text-center text-sm text-slate-400 dark:text-neutral-500">
            No repairs logged in the last {DAYS_SHOWN} days.
          </p>
        )}
      </div>
    </div>
  );
}

export default TechnicianDashboardPage;
