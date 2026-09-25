import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import {
  FiActivity,
  FiBatteryCharging,
  FiTool,
  FiCheckCircle,
  FiAlertTriangle,
  FiTrash2,
  FiRefreshCw,
  FiClock,
  FiCalendar,
  FiArrowRight,
  FiTruck,
  FiAward,
  FiLayers,
  FiTrendingUp,
  FiUser,
  FiZap,
  FiPackage,
  FiChevronRight,
  FiShield,
  FiCheck,
} from 'react-icons/fi';
import useFetchList from '../../utils/use-fetch-list';
import Sparkline from '../../components/ui/charts/Sparkline';
import BarChart from '../../components/ui/charts/BarChart';
import MiniCalendar from '../../components/ui/charts/MiniCalendar';
import { hasPermission } from '../../utils/permissions';
import formatDuration from '../../utils/format-duration';

const QUICK_ACTIONS = [
  {
    to: '/truck-intakes',
    label: 'Intake Battery Shipment',
    desc: 'Receive & scan incoming batches',
    icon: FiTruck,
    permission: 'truck_intakes',
    badge: 'Logistics',
  },
  {
    to: '/repairs',
    label: 'Log Workshop Repair',
    desc: 'Record diagnostic & replacement',
    icon: FiTool,
    permission: 'repairs',
    badge: 'Workshop',
  },
  {
    to: '/parts',
    label: 'Parts & Stock Inventory',
    desc: 'Manage quantities & restock',
    icon: FiPackage,
    permission: 'parts',
    badge: 'Inventory',
  },
  {
    to: '/returns',
    label: 'Dispatch Return Delivery',
    desc: 'Manifest verified serviced packs',
    icon: FiCheckCircle,
    permission: 'returns',
    badge: 'Dispatch',
  },
  {
    to: '/certificates',
    label: 'Milestones & Impact Hub',
    desc: 'Track ESG decarbonization awards',
    icon: FiAward,
    permission: null,
    badge: 'ESG',
  },
  {
    to: '/notifications',
    label: 'Operations Alerts Feed',
    desc: 'Live stock & support notices',
    icon: FiActivity,
    permission: null,
    badge: 'Live',
  },
];

const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 18;

function toLocalDateValue(date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

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

function DurationList({ items, getLabel, getTo }) {
  const max = Math.max(1, ...items.map((i) => i.avgDurationSeconds || 0));

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, i) => {
        const to = getTo?.(item);
        const Wrapper = to ? Link : 'li';
        const percent = Math.max(8, Math.min(100, (item.avgDurationSeconds / max) * 100));

        return (
          <Wrapper
            key={getLabel(item)}
            {...(to ? { to } : {})}
            className="group flex items-center gap-3.5 rounded-xl border border-slate-100 bg-slate-50/50 p-3 transition-all hover:border-slate-200 hover:bg-white hover:shadow-2xs dark:border-white/5 dark:bg-surface-850/50 dark:hover:border-white/10 dark:hover:bg-surface-800"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-200/70 text-xs font-black text-slate-700 dark:bg-surface-700 dark:text-slate-300">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-bold text-slate-800 group-hover:text-blue-600 dark:text-neutral-200 dark:group-hover:text-blue-400">
                  {getLabel(item)}
                </span>
                <span className="shrink-0 font-mono font-bold text-blue-700 dark:text-blue-300">
                  {formatDuration(item.avgDurationSeconds)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-surface-700">
                <div
                  className="h-full rounded-full bg-linear-to-r from-blue-500 to-indigo-600 transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] font-medium text-slate-400 dark:text-neutral-400">
                {item.repairCount} service cycle{item.repairCount === 1 ? '' : 's'} logged
              </p>
            </div>
            {to && (
              <FiChevronRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-600 dark:text-neutral-600 dark:group-hover:text-slate-300" />
            )}
          </Wrapper>
        );
      })}
    </ul>
  );
}

function initials(name) {
  return (name || 'U')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function DashboardPage() {
  const user = useSelector((state) => state.auth.user);
  const isSuperAdmin = user?.role === 'super_admin';
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const isToday = toLocalDateValue(selectedDate) === toLocalDateValue(new Date());

  const { data, loading, error, refetch } = useFetchList(
    `/dashboard/summary?date=${toLocalDateValue(selectedDate)}`
  );

  if (loading && Array.isArray(data)) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-blue-500 border-t-transparent" />
        <p className="text-xs font-bold text-slate-500 dark:text-neutral-400">
          Loading Executive Dashboard…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50/50 p-8 text-center dark:border-red-900/40 dark:bg-red-950/20">
        <p className="text-sm font-bold text-red-600 dark:text-red-400">{error}</p>
        <button
          type="button"
          onClick={refetch}
          className="mt-4 rounded-xl bg-red-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-red-700"
        >
          Retry Loading
        </button>
      </div>
    );
  }

  const {
    totals = {},
    changes = {},
    trends = {},
    todaysRepairs = [],
    hourlyRepairsToday = [],
    serviceTimes = {},
    recentClientReturns = [],
  } = data || {};

  const hourlyData = buildHourlyRange(hourlyRepairsToday || []);
  const hasActivityToday = hourlyData.some((h) => h.count > 0);
  const selectedDateLabel = selectedDate.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-6 pb-12">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            Welcome back{user?.name ? `, ${user.name}` : ''}!
          </h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Real-time battery refurbishment overview, workshop throughput analytics & return dispatches
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!isToday && (
            <button
              type="button"
              onClick={() => setSelectedDate(new Date())}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-slate-200 dark:hover:bg-white/5 transition-all"
            >
              <FiCalendar className="h-3.5 w-3.5 text-blue-500" />
              <span>Reset to Today</span>
            </button>
          )}

          <Link
            to="/notifications"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-black text-white shadow-xs hover:bg-blue-700 transition-all"
          >
            <FiActivity className="h-3.5 w-3.5" />
            <span>Operations Feed</span>
            {totals?.lowStockParts > 0 && (
              <span className="flex h-4.5 min-w-[1.125rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">
                {totals.lowStockParts}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* ── 6 Primary Operational KPI Metrics ─────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* 1. Total Fleet Batteries */}
        <Link
          to="/batteries"
          className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-surface-900"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
              Total Batteries
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <FiBatteryCharging className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {Number(totals?.totalBatteries || 0).toLocaleString()}
          </div>
          {typeof changes?.totalBatteries === 'number' && (
            <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              <FiTrendingUp className="h-3 w-3" />
              <span>{changes.totalBatteries > 0 ? `+${changes.totalBatteries}%` : `${changes.totalBatteries}%`}</span>
              <span className="font-normal text-slate-400">vs mo.</span>
            </div>
          )}
          {trends?.totalBatteries && (
            <div className="mt-2 pt-1 border-t border-slate-100 dark:border-white/5">
              <Sparkline values={trends.totalBatteries} color="#2563eb" />
            </div>
          )}
        </Link>

        {/* 2. Pending Repair Backlog */}
        <Link
          to="/batteries?status=in_repair"
          className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-amber-200/80 bg-linear-to-b from-amber-50/40 to-white p-4 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-amber-900/40 dark:from-amber-950/20 dark:to-surface-900"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              In Workshop
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
              <FiTool className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-950 dark:text-amber-100">
            {Number(totals?.pendingRepair || 0).toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] font-medium text-amber-700/80 dark:text-amber-300/80">
            Active service queue
          </div>
          {trends?.pendingRepair && (
            <div className="mt-2 pt-1 border-t border-amber-100 dark:border-white/5">
              <Sparkline values={trends.pendingRepair} color="#d97706" />
            </div>
          )}
        </Link>

        {/* 3. Successfully Repaired */}
        <Link
          to="/batteries?status=repaired"
          className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-emerald-200/80 bg-linear-to-b from-emerald-50/40 to-white p-4 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-emerald-900/40 dark:from-emerald-950/20 dark:to-surface-900"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              Repaired & Ready
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
              <FiCheckCircle className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-950 dark:text-emerald-100">
            {Number(totals?.repaired || 0).toLocaleString()}
          </div>
          {typeof changes?.repaired === 'number' && (
            <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              <FiTrendingUp className="h-3 w-3" />
              <span>{changes.repaired > 0 ? `+${changes.repaired}%` : `${changes.repaired}%`}</span>
              <span className="font-normal text-slate-400">throughput</span>
            </div>
          )}
          {trends?.repaired && (
            <div className="mt-2 pt-1 border-t border-emerald-100 dark:border-white/5">
              <Sparkline values={trends.repaired} color="#059669" />
            </div>
          )}
        </Link>

        {/* 4. Critical Stock Watch */}
        <Link
          to="/parts?lowStock=true"
          className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
            totals?.lowStockParts > 0
              ? 'border-rose-300 bg-linear-to-b from-rose-50/50 to-white dark:border-rose-900/50 dark:from-rose-950/20 dark:to-surface-900'
              : 'border-slate-200/90 bg-white dark:border-white/10 dark:bg-surface-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
              Low Stock Parts
            </span>
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                totals?.lowStockParts > 0
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300 animate-pulse'
                  : 'bg-slate-100 text-slate-600 dark:bg-surface-800 dark:text-neutral-300'
              }`}
            >
              <FiPackage className="h-4 w-4" />
            </span>
          </div>
          <div
            className={`mt-2 text-2xl font-black ${
              totals?.lowStockParts > 0 ? 'text-rose-750 dark:text-rose-300' : 'text-slate-900 dark:text-white'
            }`}
          >
            {Number(totals?.lowStockParts || 0).toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] font-medium text-slate-500 dark:text-neutral-400">
            {totals?.lowStockParts > 0 ? '⚠️ Replenishment needed' : '✓ Stock levels healthy'}
          </div>
        </Link>

        {/* 5. Unserviceable Batteries */}
        <Link
          to="/batteries/unserviceable"
          className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-surface-900"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
              Unserviceable
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400">
              <FiAlertTriangle className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {Number(totals?.unserviceable || 0).toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] font-medium text-slate-500 dark:text-neutral-400">
            Awaiting scrap batch
          </div>
        </Link>

        {/* 6. Recycled Batteries */}
        <Link
          to="/recycle"
          className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-surface-900"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
              Recycled & Saved
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400">
              <FiShield className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {Number(totals?.recycled || 0).toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] font-medium text-slate-500 dark:text-neutral-400">
            Diverted to recycling
          </div>
        </Link>
      </div>

      {/* ── Main Operations Grid: Repairs Activity & Calendar/Actions ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Activity Feed for Selected Date + Hourly Velocity */}
        <div className="space-y-6 lg:col-span-2">
          {/* Repairs Stream Container */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xs dark:border-white/10 dark:bg-surface-900 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 dark:border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                  <FiTool className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900 dark:text-white sm:text-base">
                    {isToday ? "Today's Logged Repairs" : `Repairs Log — ${selectedDateLabel}`}
                  </h2>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Workshop technician diagnostic & repair execution stream
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-surface-800 dark:text-slate-300">
                  {todaysRepairs.length} logged unit{todaysRepairs.length === 1 ? '' : 's'}
                </span>
                <Link
                  to="/repairs"
                  className="rounded-xl bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/50"
                >
                  All Repairs →
                </Link>
              </div>
            </div>

            {todaysRepairs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 dark:bg-surface-800 dark:text-neutral-500">
                  <FiClock className="h-6 w-6" />
                </div>
                <h3 className="mt-3 text-xs font-bold text-slate-700 dark:text-neutral-300">
                  {isToday ? 'No repairs logged yet today.' : `No repairs found on ${selectedDateLabel}.`}
                </h3>
                <p className="mt-1 text-[11px] text-slate-400 dark:text-neutral-500">
                  Select a different date on the mini calendar to inspect previous activity logs.
                </p>
              </div>
            ) : (
              <div className="mt-4 max-h-[26rem] overflow-y-auto pr-1 no-scrollbar space-y-2">
                {todaysRepairs.map((r) => (
                  <Link
                    key={r.id}
                    to={`/batteries/${encodeURIComponent(r.batteryCode)}`}
                    className="group flex items-center justify-between gap-3.5 rounded-2xl border border-slate-100 bg-slate-50/40 p-3 transition-all hover:border-slate-200 hover:bg-white hover:shadow-2xs dark:border-white/5 dark:bg-surface-850/40 dark:hover:border-white/10 dark:hover:bg-surface-800"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-black text-white shadow-2xs">
                        {initials(r.staffName)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-xs font-black text-slate-900 dark:text-white">
                            {r.staffName}
                          </p>
                          <span className="rounded-md bg-blue-100 px-1.5 py-0.2 font-mono text-[10px] font-bold text-blue-800 dark:bg-blue-950/80 dark:text-blue-300">
                            {r.batteryCode}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          Serviced: <span className="font-semibold text-slate-700 dark:text-slate-300">{r.partName}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-mono font-bold text-slate-600 dark:bg-surface-700 dark:text-slate-300">
                        {new Date(r.repairedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <FiArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all dark:text-neutral-600 dark:group-hover:text-blue-400" />
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Hourly Throughput Bar Chart */}
            <div className="mt-6 border-t border-slate-100 pt-5 dark:border-white/5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                  {isToday ? 'Hourly Workshop Velocity (Today)' : `Hourly Breakdown (${selectedDateLabel})`}
                </span>
                <span className="text-[10px] font-medium text-slate-400">
                  Peak hours throughput analysis
                </span>
              </div>
              {hasActivityToday ? (
                <BarChart data={hourlyData} color="#3b82f6" activeColor="#1d4ed8" height={150} />
              ) : (
                <p className="py-6 text-center text-xs text-slate-400 dark:text-neutral-500">
                  No hourly repairs distribution recorded for this date.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Mini Calendar & Quick Launcher */}
        <div className="space-y-6">
          {/* Mini Calendar Card */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xs dark:border-white/10 dark:bg-surface-900">
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/5">
              <div className="flex items-center gap-2">
                <FiCalendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Filter Date Scoped Data
                </span>
              </div>
              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                {selectedDateLabel}
              </span>
            </div>
            <MiniCalendar selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          </div>

          {/* Quick Action Commands */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xs dark:border-white/10 dark:bg-surface-900">
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-white/5">
              <div className="flex items-center gap-2">
                <FiZap className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Quick Command Launcher
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {QUICK_ACTIONS.filter(
                (action) => !action.permission || hasPermission(user, action.permission)
              ).map((action) => {
                const ActionIcon = action.icon;
                return (
                  <Link
                    key={action.to}
                    to={action.to}
                    className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-2.5 transition-all hover:border-slate-200 hover:bg-white hover:shadow-2xs dark:border-white/5 dark:bg-surface-850/50 dark:hover:border-white/10 dark:hover:bg-surface-800"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-slate-700 shadow-2xs group-hover:bg-blue-600 group-hover:text-white transition-all dark:bg-surface-700 dark:text-slate-200">
                        <ActionIcon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-800 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                          {action.label}
                        </p>
                        <p className="truncate text-[10px] text-slate-400 dark:text-neutral-400">
                          {action.desc}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-600 dark:bg-surface-700 dark:text-slate-300">
                      {action.badge}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Client Returns & Logistics Stream ────────────────────────── */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xs dark:border-white/10 dark:bg-surface-900 sm:p-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3.5 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400">
              <FiTruck className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white sm:text-base">
                Client Battery Returns & Receipt Dispatches
              </h2>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Live dispatches of repaired packs returned to customer fleets
              </p>
            </div>
          </div>
          {hasPermission(user, 'returns') && (
            <Link
              to="/returns"
              className="inline-flex items-center gap-1 rounded-xl bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-700 hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-300 dark:hover:bg-teal-900/50 transition-all"
            >
              <span>Manage All Returns</span>
              <FiArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {recentClientReturns.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-400 dark:text-neutral-500">
            No recent client return dispatches recorded.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {recentClientReturns.map((ret) => (
              <Link
                key={ret.id}
                to={`/returns/${ret.id}`}
                className="group flex flex-col justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs transition-all hover:-translate-y-0.5 hover:shadow-xs hover:border-teal-300 dark:border-white/10 dark:bg-surface-850 dark:hover:border-teal-700/60"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
                      ✓ Dispatched
                    </span>
                    <h3 className="mt-2 truncate text-xs font-black text-slate-900 group-hover:text-teal-600 dark:text-white dark:group-hover:text-teal-400">
                      {ret.clientName}
                    </h3>
                  </div>
                  <span className="shrink-0 rounded-xl bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold text-slate-800 dark:bg-surface-700 dark:text-slate-200">
                    {ret.batteryCount} {ret.batteryCount === 1 ? 'pack' : 'packs'}
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] text-slate-400 dark:border-white/5 dark:text-neutral-500">
                  <span className="truncate font-medium">
                    Truck {ret.truckNumber || 'N/A'} {ret.driverName ? `• ${ret.driverName}` : ''}
                  </span>
                  <span className="shrink-0 font-bold">
                    {new Date(ret.returnedAt).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Workshop Performance Matrix: Average Times ──────────────── */}
      {isSuperAdmin && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Average Time by Service / Part */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xs dark:border-white/10 dark:bg-surface-900 sm:p-6">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3.5 dark:border-white/5">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                  <FiClock className="h-4 w-4" />
                </span>
                <h2 className="text-sm font-black text-slate-900 dark:text-white">
                  Average Duration by Service / Part
                </h2>
              </div>
              {serviceTimes?.byPart?.length > 0 && (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600 dark:bg-surface-800 dark:text-slate-300">
                  {serviceTimes.byPart.length} monitored
                </span>
              )}
            </div>
            {!serviceTimes?.byPart?.length ? (
              <p className="py-8 text-center text-xs text-slate-400 dark:text-neutral-500">
                Not enough completed service sessions recorded to benchmark times.
              </p>
            ) : (
              <DurationList
                items={serviceTimes.byPart}
                getLabel={(i) => i.partName}
                getTo={(i) => (i.partId ? `/parts/${i.partId}` : null)}
              />
            )}
          </div>

          {/* Average Time by Technician */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xs dark:border-white/10 dark:bg-surface-900 sm:p-6">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3.5 dark:border-white/5">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
                  <FiUser className="h-4 w-4" />
                </span>
                <h2 className="text-sm font-black text-slate-900 dark:text-white">
                  Average Duration by Technician
                </h2>
              </div>
              {serviceTimes?.byStaff?.length > 0 && (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600 dark:bg-surface-800 dark:text-slate-300">
                  {serviceTimes.byStaff.length} technicians
                </span>
              )}
            </div>
            {!serviceTimes?.byStaff?.length ? (
              <p className="py-8 text-center text-xs text-slate-400 dark:text-neutral-500">
                Not enough completed technician sessions recorded to benchmark times.
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
      )}
    </div>
  );
}

export default DashboardPage;
