import { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  FiArrowLeft,
  FiCalendar,
  FiDollarSign,
  FiTrendingUp,
  FiUsers,
  FiTool,
  FiLayers,
  FiSearch,
  FiX,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiDownload,
} from 'react-icons/fi';
import apiClient from '../../services/api-client';
import PageHeader from '../../components/ui/primitives/PageHeader';
import TableState from '../../components/ui/table/TableState';
import StatCard from '../../components/ui/primitives/StatCard';
import { StatusBadge } from '../../components/ui/primitives/Badge';

function formatMoney(value) {
  return `£${Number(value || 0).toFixed(2)}`;
}

function formatDuration(seconds) {
  if (seconds == null || isNaN(seconds)) return '—';
  const s = Math.round(Number(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const remS = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${remS}s`;
  return `${remS}s`;
}

function FinanceDetailPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const type = searchParams.get('type') || 'month'; // 'month' | 'day'
  const period = searchParams.get('period') || ''; // '2026-03' or '2026-03-14'
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (period) params.set('period', period);
    if (from) params.set('from', from);
    if (to) params.set('to', to);

    apiClient
      .get(`/finance/period-detail?${params.toString()}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  }, [type, period, from, to]);

  // Navigate to previous / next period
  const handleStepPeriod = (direction) => {
    if (!period) return;
    if (type === 'month') {
      const [year, month] = period.split('-').map(Number);
      const dt = new Date(year, month - 1 + direction, 1);
      const newMonth = dt.toISOString().slice(0, 7);
      setSearchParams({ type: 'month', period: newMonth });
    } else if (type === 'day') {
      const dt = new Date(period);
      dt.setDate(dt.getDate() + direction);
      const newDay = dt.toISOString().slice(0, 10);
      setSearchParams({ type: 'day', period: newDay });
    }
  };

  const {
    totals = {},
    clientBreakdown = [],
    staffBreakdown = [],
    partBreakdown = [],
    serviceBreakdown = [],
    repairs = [],
  } = data || {};

  // Formatted header title
  const formattedTitle = useMemo(() => {
    if (type === 'month' && period) {
      const [year, month] = period.split('-').map(Number);
      const dt = new Date(year, month - 1, 1);
      return `Monthly Statement: ${dt.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`;
    }
    if (type === 'day' && period) {
      const dt = new Date(period);
      return `Daily Statement: ${dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    }
    if (from || to) {
      return `Custom Statement: ${from || 'Start'} to ${to || 'Present'}`;
    }
    return 'Period Financial Statement';
  }, [type, period, from, to]);

  // Search filtered repairs & battery fee charges
  const filteredRepairs = useMemo(() => {
    if (!searchQuery.trim()) return repairs;
    const q = searchQuery.toLowerCase();
    return repairs.filter((r) => {
      const code = (r.batteryCode || '').toLowerCase();
      const client = (r.clientName || '').toLowerCase();
      const staff = (r.staffName || '').toLowerCase();
      const part = (r.partName || r.itemDescription || '').toLowerCase();
      const note = (r.notes || '').toLowerCase();
      const chargeType = (r.chargeType || '').toLowerCase();
      return (
        code.includes(q) ||
        client.includes(q) ||
        staff.includes(q) ||
        part.includes(q) ||
        note.includes(q) ||
        chargeType.includes(q)
      );
    });
  }, [repairs, searchQuery]);

  if (loading) return <TableState>Loading detailed period financial report…</TableState>;

  if (error) {
    return (
      <div className="space-y-4">
        <Link
          to="/finance"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline dark:text-blue-400"
        >
          <FiArrowLeft className="w-3.5 h-3.5" /> Back to Finance & Billing
        </Link>
        <TableState tone="error">{error}</TableState>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Breadcrumb & Step Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/finance"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
        >
          <FiArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Finance & Billing</span>
        </Link>

        {period && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleStepPeriod(-1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-850 dark:text-neutral-200 dark:hover:bg-surface-800 transition-colors shadow-2xs"
            >
              <FiChevronLeft className="w-3.5 h-3.5" />
              <span>Previous {type === 'month' ? 'Month' : 'Day'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleStepPeriod(1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-850 dark:text-neutral-200 dark:hover:bg-surface-800 transition-colors shadow-2xs"
            >
              <span>Next {type === 'month' ? 'Month' : 'Day'}</span>
              <FiChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Hero Period Statement Banner */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 md:p-6 shadow-sm dark:border-white/10 dark:bg-surface-850">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 shrink-0">
              <FiCalendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
                  {type === 'month' ? 'Monthly Statement' : 'Daily Statement'}
                </span>
                <span className="text-xs text-slate-400 dark:text-neutral-500">
                  {data?.period?.startDate} {data?.period?.endDate !== data?.period?.startDate ? `to ${data?.period?.endDate}` : ''}
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mt-1">
                {formattedTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-900/40 text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                Total Revenue
              </span>
              <span className="text-xl md:text-2xl font-black text-emerald-700 dark:text-emerald-300">
                {formatMoney(totals.totalRevenue)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <StatCard
          label="Total Revenue"
          value={formatMoney(totals.totalRevenue)}
          tone="good"
          sub="Repairs, Fees & Recycling"
        />
        <StatCard
          label="Repair Cost"
          value={formatMoney(totals.repairRevenue)}
          tone="neutral"
          sub={`Parts: ${formatMoney(totals.partsRevenue)} · Labor: ${formatMoney(totals.laborRevenue)}`}
        />
        <StatCard
          label="Service & Intake Fees"
          value={formatMoney(totals.servicesRevenue)}
          tone="info"
          sub={`${totals.servicesCount || 0} service / intake fee items`}
        />
        <StatCard
          label="Recycle Revenue"
          value={formatMoney(totals.recycleRevenue)}
          tone="warning"
          sub="Scrap & battery recycling payout"
        />
        <StatCard
          label="Batteries Serviced"
          value={`${totals.batteriesCount || 0} units`}
          tone="good"
          sub={`${(totals.repairsCount || 0) + (totals.servicesCount || 0)} total logged actions`}
        />
      </div>

      {/* Summary Distribution Grids: Clients, Staff, Services & Parts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 1. Client Breakdown */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-surface-850 space-y-3.5 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                <FiUsers className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                Revenue by Client ({clientBreakdown.length})
              </h3>
            </div>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[300px] pr-1">
            {clientBreakdown.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400 dark:text-neutral-500">
                No client activity in this period.
              </p>
            ) : (
              clientBreakdown.map((c, idx) => {
                const totalBilled = totals.totalRevenue || totals.repairRevenue || 1;
                const sharePercent =
                  totalBilled > 0
                    ? Math.round((c.totalRevenue / totalBilled) * 100)
                    : 0;
                return (
                  <div
                    key={c.id || idx}
                    className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 dark:bg-surface-900/60 dark:border-white/5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 dark:text-white truncate max-w-[170px]">
                        {c.name}
                      </span>
                      <span className="font-mono font-black text-xs text-emerald-600 dark:text-emerald-400">
                        {formatMoney(c.totalRevenue)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-neutral-400">
                      <span>{c.repairsCount} repairs · {c.servicesCount || 0} fees ({c.batteriesCount} batteries)</span>
                      <span>{sharePercent}% share</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-surface-800 h-1 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.max(2, sharePercent))}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 2. Staff Output Breakdown */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-surface-850 space-y-3.5 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
                <FiTool className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                Technician Output ({staffBreakdown.length})
              </h3>
            </div>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[300px] pr-1">
            {staffBreakdown.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400 dark:text-neutral-500">
                No technician logged work in this period.
              </p>
            ) : (
              staffBreakdown.map((s, idx) => (
                <div
                  key={s.id || idx}
                  className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 dark:bg-surface-900/60 dark:border-white/5 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <Link
                      to={`/staff/${s.id}`}
                      className="font-bold text-xs text-blue-600 hover:underline dark:text-blue-400 truncate max-w-[170px]"
                    >
                      {s.name}
                    </Link>
                    <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                      {formatMoney(s.totalRevenue)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-neutral-400">
                    <span>{s.repairsCount} repairs · {s.servicesCount || 0} services</span>
                    {s.avgDurationSeconds ? (
                      <span className="inline-flex items-center gap-1 font-mono">
                        <FiClock className="w-3 h-3 text-slate-400" />
                        {formatDuration(s.avgDurationSeconds)}
                      </span>
                    ) : (
                      <span className="font-mono text-slate-400">Fee/Test</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 3. Services & Intake Fees & Parts Breakdown */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-surface-850 space-y-3.5 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400">
                <FiLayers className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                Services & Intake Fees ({serviceBreakdown.length})
              </h3>
            </div>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[300px] pr-1">
            {serviceBreakdown.length === 0 && partBreakdown.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400 dark:text-neutral-500">
                No service fees or parts logged in this period.
              </p>
            ) : (
              <>
                {serviceBreakdown.map((s, idx) => (
                  <div
                    key={`srv-${s.service_id || idx}`}
                    className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-100 dark:bg-purple-950/30 dark:border-purple-900/40 flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="font-bold text-xs text-purple-900 dark:text-purple-200 block truncate">
                        {s.name}
                      </span>
                      <span className="text-[11px] text-purple-700/80 dark:text-purple-400">
                        {s.timesApplied} applied ({s.batteriesCount} batteries) · {formatMoney(s.avgRate)}/unit
                      </span>
                    </div>
                    <span className="font-mono font-bold text-xs text-purple-700 dark:text-purple-300 shrink-0">
                      {formatMoney(s.totalRevenue)}
                    </span>
                  </div>
                ))}

                {partBreakdown.slice(0, 4).map((p, idx) => (
                  <div
                    key={`prt-${p.id || idx}`}
                    className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 dark:bg-surface-900/60 dark:border-white/5 flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-white block truncate">
                        {p.name}
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-neutral-400">
                        {p.quantityUsed} unit{p.quantityUsed === 1 ? '' : 's'} replaced
                      </span>
                    </div>
                    <span className="font-mono font-bold text-xs text-slate-900 dark:text-white shrink-0">
                      {formatMoney(p.totalRevenue)}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Itemized Battery Fee & Service Transaction Log */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-surface-850 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-white/5">
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-white">
              Itemized Battery Charges & Fee Ledger ({filteredRepairs.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-neutral-400">
              Complete itemized breakdown of every billable repair, mandatory intake fee, and diagnostic service across all batteries.
            </p>
          </div>

          <div className="relative min-w-[240px]">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
            <input
              type="text"
              placeholder="Search battery, client, service, fee…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-surface-900 dark:text-white dark:placeholder:text-neutral-500 dark:focus:bg-surface-800"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200"
              >
                <FiX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Data Table */}
        <div className="rounded-xl border border-slate-200/80 dark:border-white/10 overflow-hidden shadow-2xs">
          <div className="max-h-[520px] overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-100/95 dark:bg-surface-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-white/10">
                <tr className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                  <th className="py-3 px-3.5 w-12 text-center">#</th>
                  <th className="py-3 px-3.5 min-w-[130px]">Date & Time</th>
                  <th className="py-3 px-3.5 min-w-[130px]">Battery Code</th>
                  <th className="py-3 px-3.5 min-w-[140px]">Client</th>
                  <th className="py-3 px-3.5 min-w-[120px]">Type</th>
                  <th className="py-3 px-3.5 min-w-[130px]">Staff / System</th>
                  <th className="py-3 px-3.5 min-w-[170px]">Service / Parts</th>
                  <th className="py-3 px-3.5 min-w-[90px]">Labor</th>
                  <th className="py-3 px-3.5 min-w-[90px]">Parts</th>
                  <th className="py-3 px-3.5 min-w-[90px]">Fee</th>
                  <th className="py-3 px-3.5 min-w-[100px]">Total Charge</th>
                  <th className="py-3 px-3.5 min-w-[100px]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 bg-white dark:bg-surface-850">
                {filteredRepairs.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-400 dark:text-neutral-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FiTool className="w-8 h-8 text-slate-300 dark:text-neutral-600" />
                        <p className="font-semibold">
                          {searchQuery
                            ? 'No charges match your search query.'
                            : 'No battery fees or repair charges found for this period.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRepairs.map((r, index) => {
                    const isServiceFee = r.chargeType === 'service_fee' || (r.serviceFee > 0 && !r.partsCharge && !r.laborCharge);
                    const parts = (r.partName || r.itemDescription || '').split(',').map((p) => p.trim()).filter(Boolean);

                    return (
                      <tr
                        key={r.batchId || r.id || index}
                        className="hover:bg-slate-50/80 dark:hover:bg-surface-800/60 transition-colors"
                      >
                        <td className="py-3 px-3.5 text-center font-mono text-slate-400 dark:text-neutral-500">
                          {index + 1}
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800 dark:text-neutral-200">
                              {r.repairedAt ? new Date(r.repairedAt).toLocaleDateString([], {
                                day: '2-digit',
                                month: 'short',
                              }) : '—'}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-neutral-500">
                              {r.repairedAt ? new Date(r.repairedAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              }) : ''}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3.5 font-medium">
                          {r.batteryCode ? (
                            <Link
                              to={`/batteries/${r.batteryCode}`}
                              className="inline-flex items-center gap-1 font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md hover:underline dark:bg-blue-950/60 dark:text-blue-300"
                            >
                              {r.batteryCode}
                            </Link>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 font-semibold text-slate-800 dark:text-neutral-200">
                          {r.clientName}
                        </td>
                        <td className="py-3 px-3.5">
                          {isServiceFee ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                              Service Fee
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                              Repair Job
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5">
                          {r.staffId ? (
                            <Link
                              to={`/staff/${r.staffId}`}
                              className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                            >
                              {r.staffName}
                            </Link>
                          ) : (
                            <span className="text-slate-500 dark:text-neutral-400">{r.staffName || 'System Auto'}</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5">
                          {isServiceFee ? (
                            <span className="font-semibold text-slate-800 dark:text-neutral-200">
                              {r.itemDescription || r.partName || 'Service Fee'}
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {parts.length > 0 ? (
                                parts.map((p, pIdx) => (
                                  <span
                                    key={pIdx}
                                    className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  >
                                    {p}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400 dark:text-neutral-500">—</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3.5 font-mono text-slate-600 dark:text-neutral-300">
                          {r.laborCharge > 0 ? formatMoney(r.laborCharge) : '—'}
                        </td>
                        <td className="py-3 px-3.5 font-mono text-slate-600 dark:text-neutral-300">
                          {r.partsCharge > 0 ? formatMoney(r.partsCharge) : '—'}
                        </td>
                        <td className="py-3 px-3.5 font-mono text-purple-600 dark:text-purple-400 font-bold">
                          {r.serviceFee > 0 ? formatMoney(r.serviceFee) : '—'}
                        </td>
                        <td className="py-3 px-3.5 font-mono font-black text-emerald-600 dark:text-emerald-400">
                          {formatMoney(r.totalCharge)}
                        </td>
                        <td className="py-3 px-3.5">
                          {r.batteryStatus ? <StatusBadge status={r.batteryStatus} /> : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FinanceDetailPage;
