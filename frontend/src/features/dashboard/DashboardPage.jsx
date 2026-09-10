import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import useFetchList from '../../utils/use-fetch-list';
import StatCard from '../../components/ui/StatCard';
import BarChart from '../../components/ui/BarChart';
import MiniCalendar from '../../components/ui/MiniCalendar';
import TableState from '../../components/ui/TableState';
import { hasPermission } from '../../utils/permissions';
import formatDuration from '../../utils/format-duration';

const QUICK_ACTIONS = [
  { to: '/truck-intakes', label: 'Intake Battery', permission: 'truck_intakes' },
  { to: '/repairs', label: 'Log a Repair', permission: 'repairs' },
  { to: '/parts', label: 'Manage Inventory', permission: 'parts' },
  { to: '/returns', label: 'Return Battery', permission: 'returns' },
];

const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 18;

// Converts to a YYYY-MM-DD string in the browser's local timezone, so the
// day picked in the mini calendar matches what the backend scopes
// "Today's Repairs" to — toISOString() alone would shift the date near
// midnight in non-UTC zones.
function toLocalDateValue(date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

// Defaults to typical business hours, but widens to cover any hour that
// actually has repairs logged — real activity outside 8am-6pm should never
// be silently dropped from the chart.
function buildHourlyRange(hourlyData) {
  const countsByHour = Object.fromEntries(hourlyData.map((d) => [d.hour, d.count]));
  const activeHours = hourlyData.map((d) => d.hour);
  const startHour = Math.min(DEFAULT_START_HOUR, ...activeHours);
  const endHour = Math.max(DEFAULT_END_HOUR, ...activeHours);

  const hours = [];
  for (let h = startHour; h <= endHour; h += 1) {
    const label = h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`;
    hours.push({ label, count: countsByHour[h] || 0 });
  }
  return hours;
}

// Ranked horizontal bars for "average time spent" breakdowns — the longer
// the bar (relative to the slowest entry in this list), the longer that
// service/technician takes on average. Slowest-first, so #1 is the one
// worth an admin's attention.
function DurationList({ items, getLabel, getTo }) {
  const max = Math.max(1, ...items.map((i) => i.avgDurationSeconds || 0));
  const itemClasses =
    'flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-surface-800';

  return (
    <ul className="flex flex-col gap-1">
      {items.map((item, i) => {
        const to = getTo?.(item);
        const Wrapper = to ? Link : 'li';
        return (
          <Wrapper key={getLabel(item)} {...(to ? { to } : {})} className={itemClasses}>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500 dark:bg-surface-700 dark:text-neutral-400">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-medium text-slate-700 dark:text-neutral-200">
                  {getLabel(item)}
                </span>
                <span className="shrink-0 font-semibold text-blue-700 dark:text-blue-400">
                  {formatDuration(item.avgDurationSeconds)}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-surface-800">
                <div
                  className="h-full rounded-full bg-brand-500 dark:bg-emerald-500"
                  style={{ width: `${Math.max(4, (item.avgDurationSeconds / max) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-400 dark:text-neutral-500">
                {item.repairCount} repair{item.repairCount === 1 ? '' : 's'}
              </p>
            </div>
          </Wrapper>
        );
      })}
    </ul>
  );
}

function initials(name) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function DashboardPage() {
  const user = useSelector((state) => state.auth.user);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const isToday = toLocalDateValue(selectedDate) === toLocalDateValue(new Date());
  const { data, loading, error } = useFetchList(
    `/dashboard/summary?date=${toLocalDateValue(selectedDate)}`
  );

  // Only the very first load (data still the useFetchList default `[]`)
  // shows the full-page loader — a date click keeps the page mounted and
  // just re-fetches in the background, so picking a day doesn't blink the
  // whole dashboard (including the calendar itself) back to a blank state.
  if (loading && Array.isArray(data)) return <TableState>Loading dashboard…</TableState>;
  if (error) return <TableState tone="error">{error}</TableState>;

  const { totals, changes, trends, todaysRepairs, hourlyRepairsToday, serviceTimes, recentClientReturns = [] } = data;
  const hourlyData = buildHourlyRange(hourlyRepairsToday || []);
  const hasActivityToday = hourlyData.some((h) => h.count > 0);
  const selectedDateLabel = selectedDate.toLocaleDateString([], { day: 'numeric', month: 'short' });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-neutral-100">
          Welcome back{user?.name ? `, ${user.name}` : ''}!
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">Here's what's happening with repairs today</p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/batteries" className="block h-full rounded-xl transition-shadow hover:shadow-md">
          <StatCard
            label="Total Batteries"
            value={totals.totalBatteries}
            delta={changes.totalBatteries}
            trend={trends.totalBatteries}
            tone="info"
          />
        </Link>
        <Link to="/batteries?status=in_repair" className="block h-full rounded-xl transition-shadow hover:shadow-md">
          <StatCard
            label="Pending Repair"
            value={totals.pendingRepair}
            trend={trends.pendingRepair}
            tone="warning"
            deltaGoodDirection="down"
          />
        </Link>
        <Link to="/batteries?status=repaired" className="block h-full rounded-xl transition-shadow hover:shadow-md">
          <StatCard
            label="Repaired"
            value={totals.repaired}
            delta={changes.repaired}
            trend={trends.repaired}
            tone="good"
          />
        </Link>
        {hasPermission(user, 'parts') ? (
          <Link to="/parts?lowStock=true" className="block h-full rounded-xl transition-shadow hover:shadow-md">
            <StatCard
              label="Low Stock Parts"
              value={totals.lowStockParts}
              tone="critical"
              deltaGoodDirection="down"
            />
          </Link>
        ) : (
          <StatCard
            label="Low Stock Parts"
            value={totals.lowStockParts}
            tone="critical"
            deltaGoodDirection="down"
          />
        )}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link to="/batteries/unserviceable" className="block h-full rounded-xl transition-shadow hover:shadow-md">
          <StatCard label="Unserviceable" value={totals.unserviceable} tone="critical" />
        </Link>
        {hasPermission(user, 'recycle') && (
          <Link to="/recycle" className="block h-full rounded-xl transition-shadow hover:shadow-md">
            <StatCard label="Recycled" value={totals.recycled} tone="good" />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div
          className={`rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm transition-opacity duration-150 dark:border-surface-700 dark:bg-surface-900 lg:col-span-2 ${
            loading ? 'opacity-50' : 'opacity-100'
          }`}
        >
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-surface-800">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-neutral-100">
              {isToday ? "Today's Repairs" : `Repairs — ${selectedDateLabel}`}
            </h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 dark:bg-surface-800 dark:text-neutral-300">
              {todaysRepairs.length} repair{todaysRepairs.length === 1 ? '' : 's'}
            </span>
          </div>

          {todaysRepairs.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400 dark:text-neutral-500">
              {isToday ? 'No repairs logged yet today.' : `No repairs logged on ${selectedDateLabel}.`}
            </p>
          ) : (
            <div className="mb-8 max-h-[27rem] overflow-y-auto pr-1">
              <ul className="flex flex-col gap-2">
                {todaysRepairs.map((r) => (
                  <Link
                    key={r.id}
                    to={`/batteries/${r.batteryCode}`}
                    className="flex items-center gap-4 rounded-lg px-3 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-surface-800"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                      {initials(r.staffName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800 dark:text-neutral-100">{r.staffName}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-neutral-400">
                        {r.partName} <span className="mx-1 text-slate-300 dark:text-neutral-600">·</span>{' '}
                        <span className="font-mono text-slate-400 dark:text-neutral-500">{r.batteryCode}</span>
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500 dark:bg-surface-800 dark:text-neutral-400">
                      {new Date(r.repairedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </Link>
                ))}
              </ul>
            </div>
          )}

          <h3 className="mb-3 border-t border-slate-100 pt-4 text-xs font-medium text-slate-500 dark:border-blue-800/40 dark:text-neutral-400">
            {isToday ? 'Day Overview' : `Day Overview — ${selectedDateLabel}`}
          </h3>
          {hasActivityToday ? (
            <BarChart data={hourlyData} />
          ) : (
            <p className="py-6 text-center text-sm text-slate-400 dark:text-neutral-500">
              {isToday ? 'No repair activity yet today.' : `No repair activity on ${selectedDateLabel}.`}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-surface-700 dark:bg-surface-900">
            <MiniCalendar selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-surface-700 dark:bg-surface-900">
            <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-neutral-100">Quick Actions</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {QUICK_ACTIONS.filter((action) => hasPermission(user, action.permission)).map(
                (action) => (
                  <li key={action.to}>
                    <Link to={action.to} className="text-brand-700 hover:underline dark:text-emerald-400">
                      {action.label}
                    </Link>
                  </li>
                )
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* ── Recent Client Battery Returns & Receipts Notification Feed ─────── */}
      <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm dark:border-surface-700 dark:bg-surface-900">
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-surface-800">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4.5 w-4.5">
                <path d="M3.375 4.5C2.339 4.5 1.5 5.34 1.5 6.375V13.5h12V6.375c0-1.036-.84-1.875-1.875-1.875h-8.25ZM13.5 15h-12v2.625c0 1.035.84 1.875 1.875 1.875h.375a3 3 0 1 1 6 0h3a.75.75 0 0 0 .75-.75V15Z" />
                <path d="M8.25 19.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0ZM15.75 6.75a.75.75 0 0 0-.75.75v11.25c0 .087.015.17.042.248a3 3 0 0 1 5.958.464c.853-.175 1.522-.935 1.464-1.883a18.659 18.659 0 0 0-3.732-10.104 1.837 1.837 0 0 0-1.47-.725H15.75Z" />
                <path d="M19.5 19.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0Z" />
              </svg>
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-white">
                Client Battery Receipts & Returns
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                Live alerts for repaired batteries dispatched to and received by client fleets
              </p>
            </div>
          </div>
          {hasPermission(user, 'returns') && (
            <Link
              to="/returns"
              className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400"
            >
              View All Returns →
            </Link>
          )}
        </div>

        {recentClientReturns.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400 dark:text-neutral-500">
            No client returns recorded yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentClientReturns.map((ret) => (
              <Link
                key={ret.id}
                to={`/returns/${ret.id}`}
                className="flex flex-col justify-between gap-2.5 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs transition-all hover:scale-[1.01] hover:shadow-xs dark:border-white/10 dark:bg-surface-850"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
                      ✓ Client Received
                    </span>
                    <h3 className="mt-1.5 truncate text-xs font-bold text-slate-900 dark:text-white">
                      {ret.clientName}
                    </h3>
                  </div>
                  <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs font-bold text-slate-700 dark:bg-surface-800 dark:text-neutral-200">
                    {ret.batteryCount} {ret.batteryCount === 1 ? 'battery' : 'batteries'}
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[10px] text-slate-400 dark:border-white/5 dark:text-neutral-500">
                  <span className="truncate">Truck {ret.truckNumber || 'N/A'} {ret.driverName ? `• ${ret.driverName}` : ''}</span>
                  <span className="shrink-0">{new Date(ret.returnedAt).toLocaleDateString([], { day: '2-digit', month: 'short' })}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm dark:border-surface-700 dark:bg-surface-900">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-surface-800">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-neutral-100">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-blue-500">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .2.08.39.22.53l3.5 3.5a.75.75 0 1 0 1.06-1.06l-3.28-3.28V5Z"
                  clipRule="evenodd"
                />
              </svg>
              Average Time by Service
            </h2>
            {serviceTimes?.byPart?.length > 0 && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 dark:bg-surface-800 dark:text-neutral-300">
                {serviceTimes.byPart.length} service{serviceTimes.byPart.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
          {!serviceTimes?.byPart?.length ? (
            <p className="py-6 text-center text-sm text-slate-400 dark:text-neutral-500">
              Not enough completed repairs yet to show this.
            </p>
          ) : (
            <DurationList
              items={serviceTimes.byPart}
              getLabel={(i) => i.partName}
              getTo={(i) => (i.partId ? `/parts/${i.partId}` : null)}
            />
          )}
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm dark:border-surface-700 dark:bg-surface-900">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-surface-800">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-neutral-100">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-blue-500">
                <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-7 9a7 7 0 1 1 14 0 1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
              </svg>
              Average Time by Technician
            </h2>
            {serviceTimes?.byStaff?.length > 0 && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 dark:bg-surface-800 dark:text-neutral-300">
                {serviceTimes.byStaff.length} technician{serviceTimes.byStaff.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
          {!serviceTimes?.byStaff?.length ? (
            <p className="py-6 text-center text-sm text-slate-400 dark:text-neutral-500">
              Not enough completed repairs yet to show this.
            </p>
          ) : (
            <DurationList
              items={serviceTimes.byStaff}
              getLabel={(i) => i.staffName}
              getTo={(i) => (i.staffId ? `/staff/${i.staffId}` : null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
