import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../../services/api-client';
import PageHeader from '../../../components/ui/primitives/PageHeader';
import TableState from '../../../components/ui/table/TableState';
import { StatusBadge } from '../../../components/ui/primitives/Badge';

// Every repair the logged-in technician has ever logged, newest first.
// Scoped server-side to whichever `staff` row is linked to their account
// (GET /staff/me) — same data StaffDetailPage shows an admin, just without
// the admin-only bits.
function TechnicianHistoryPage() {
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

  const { repairs, issues = [] } = data;
  const timeline = [
    ...repairs.map((r) => ({ ...r, kind: 'repair', sortDate: r.repaired_at })),
    ...issues.map((i) => ({ ...i, kind: 'issue', sortDate: i.reported_at })),
  ].sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate));

  return (
    <div>
      <PageHeader title="My Repair History" description="Every repair and reported issue you've logged." />

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm dark:border-blue-800/40 dark:bg-blue-900/20">
        {timeline.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500 dark:text-neutral-400">
            Nothing logged yet.
          </p>
        ) : (
          <ul className="divide-y divide-blue-100 dark:divide-blue-800/40">
            {timeline.map((item) =>
              item.kind === 'issue' ? (
                <li key={`issue-${item.id}`} className="py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/batteries/${item.battery_code}`}
                        className="font-medium text-critical-700 hover:underline dark:text-red-300"
                      >
                        {item.battery_code}
                      </Link>
                      <StatusBadge status={item.battery_status} />
                    </div>
                    <span className="text-xs text-slate-400 dark:text-neutral-500">
                      {new Date(item.reported_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-0.5 text-critical-600 dark:text-red-400">Reported: {item.reason_label}</p>
                  {item.note && (
                    <p className="mt-0.5 text-xs text-slate-400 dark:text-neutral-500">{item.note}</p>
                  )}
                </li>
              ) : (
                <li key={`repair-${item.id}`} className="py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/batteries/${item.battery_code}`}
                        className="font-medium text-blue-700 hover:underline dark:text-blue-300"
                      >
                        {item.battery_code}
                      </Link>
                      <StatusBadge status={item.battery_status} />
                    </div>
                    <span className="text-xs text-slate-400 dark:text-neutral-500">
                      {new Date(item.repaired_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-0.5 text-slate-500 dark:text-neutral-400">Part changed: {item.part_name}</p>
                  {item.notes && (
                    <p className="mt-0.5 text-xs text-slate-400 dark:text-neutral-500">{item.notes}</p>
                  )}
                </li>
              )
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

export default TechnicianHistoryPage;
