import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiCalendar,
  FiTrendingUp,
  FiTool,
  FiLayers,
  FiArrowRight,
  FiSearch,
  FiX,
  FiClock,
  FiRotateCcw,
  FiCpu,
  FiTarget,
  FiRefreshCw,
} from 'react-icons/fi';
import apiClient from '../../services/api-client';
import StatCard from '../../components/ui/primitives/StatCard';
import TableState from '../../components/ui/table/TableState';
import BarChart from '../../components/ui/charts/BarChart';

function formatMoney(value) {
  return `£${Number(value || 0).toFixed(2)}`;
}

function FinancePage() {
  const navigate = useNavigate();

  // Filters
  const [datePreset, setDatePreset] = useState('all'); // 'all' | 'today' | 'yesterday' | '7days' | '30days' | 'month' | 'year' | 'custom'
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [breakdownType, setBreakdownType] = useState('month'); // 'month' | 'day'
  const [searchQuery, setSearchQuery] = useState('');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFinanceData = () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set('preset', datePreset);
    params.set('breakdown', breakdownType);
    if (datePreset === 'custom') {
      if (customFrom) params.set('from', customFrom);
      if (customTo) params.set('to', customTo);
    }

    apiClient
      .get(`/finance/summary?${params.toString()}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchFinanceData();
  }, [datePreset, breakdownType, customFrom, customTo]);

  const { totals = {}, breakdown = [] } = data || {};

  // Build chart series from breakdown data
  const chartSeries = useMemo(() => {
    if (!breakdown || breakdown.length === 0) return [];
    // Take up to last 14 items in reverse chronological order for chart display
    return breakdown
      .slice(0, 14)
      .reverse()
      .map((item) => ({
        label: item.label,
        count: item.totalRevenue ?? item.repairRevenue,
      }));
  }, [breakdown]);

  // Filtered breakdown table rows
  const filteredBreakdown = useMemo(() => {
    if (!searchQuery.trim()) return breakdown;
    const q = searchQuery.toLowerCase();
    return (breakdown || []).filter((item) => {
      const label = (item.label || '').toLowerCase();
      const key = (item.key || '').toLowerCase();
      return label.includes(q) || key.includes(q);
    });
  }, [breakdown, searchQuery]);

  const hasActiveFilters =
    datePreset !== 'all' ||
    customFrom !== '' ||
    customTo !== '' ||
    searchQuery.trim() !== '';

  const clearAllFilters = () => {
    setDatePreset('all');
    setCustomFrom('');
    setCustomTo('');
    setSearchQuery('');
  };

  const avgPerUnit =
    totals.avgRevenuePerBattery ||
    (totals.batteriesCount > 0
      ? (Number(totals.repairRevenue || 0) + Number(totals.servicesRevenue || 0)) / totals.batteriesCount
      : 0);

  return (
    <div className="w-full max-w-full overflow-x-hidden space-y-4 sm:space-y-5 pb-12">
      {/* ── 1. Executive Header Card with Live Metrics Strip ────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
                Finance & Billing Reports
              </h1>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10.5px] font-bold text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/50">
                Fiscal Governance
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1 max-w-2xl leading-4">
              Comprehensive repair revenue, recycling payouts, itemized service charges, and period performance.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={fetchFinanceData}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-850 dark:text-neutral-200 dark:hover:bg-surface-800 transition-colors shadow-2xs cursor-pointer"
            >
              <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Live Counters Strip */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2.5 mt-2.5 border-t border-slate-100 dark:border-white/5 text-[11px]">
          <span className="text-slate-500 dark:text-neutral-400">
            Total Revenue: <strong className="font-black text-emerald-600 dark:text-emerald-400">{formatMoney(totals.totalRevenue)}</strong>
          </span>
          <span className="text-slate-300 dark:text-white/20">•</span>
          <span className="text-slate-500 dark:text-neutral-400">
            Parts: <strong className="font-bold text-slate-800 dark:text-neutral-200">{formatMoney(totals.repairRevenue)}</strong>
          </span>
          <span className="text-slate-300 dark:text-white/20">•</span>
          <span className="text-slate-500 dark:text-neutral-400">
            Service: <strong className="font-bold text-purple-600 dark:text-purple-400">{formatMoney(totals.servicesRevenue)}</strong>
          </span>
          <span className="text-slate-300 dark:text-white/20">•</span>
          <span className="text-slate-500 dark:text-neutral-400">
            Recycle: <strong className="font-bold text-blue-600 dark:text-blue-400">{formatMoney(totals.recycleRevenue)}</strong>
          </span>
          <span className="text-slate-300 dark:text-white/20">•</span>
          <span className="text-slate-500 dark:text-neutral-400">
            Units: <strong className="font-bold text-slate-800 dark:text-neutral-200">{totals.batteriesCount || 0}</strong>
          </span>
          <span className="text-slate-300 dark:text-white/20">•</span>
          <span className="text-slate-500 dark:text-neutral-400">
            Avg/Unit: <strong className="font-bold text-slate-800 dark:text-neutral-200">{formatMoney(avgPerUnit)}</strong>
          </span>
        </div>
      </div>

      {/* ── 2. Date Filter Toolbar (Wrapping Pills, Zero Horizontal Scroll) ──── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-3.5 shadow-2xs dark:border-white/10 dark:bg-surface-850 space-y-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          {/* Preset Buttons — WRAPPING */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[11px] font-bold text-slate-400 dark:text-neutral-500 mr-1 inline-flex items-center gap-1">
              <FiCalendar className="w-3 h-3" /> Date:
            </span>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: '7days', label: 'Last 7 Days' },
              { id: '30days', label: 'Last 30 Days' },
              { id: 'month', label: 'This Month' },
              { id: 'year', label: 'This Year' },
              { id: 'custom', label: 'Custom Range' },
            ].map((preset) => {
              const isActive = datePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setDatePreset(preset.id)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-surface-800 dark:text-neutral-300 dark:hover:bg-surface-700'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* Breakdown Type Switcher (Monthly vs Daily) & Reset */}
          <div className="flex items-center gap-2 self-start lg:self-auto flex-wrap">
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-surface-900 text-xs">
              <button
                type="button"
                onClick={() => setBreakdownType('month')}
                className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors cursor-pointer ${
                  breakdownType === 'month'
                    ? 'bg-white text-slate-900 shadow-2xs dark:bg-surface-800 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white'
                }`}
              >
                <FiCalendar className="w-3 h-3" />
                <span>Monthly</span>
              </button>
              <button
                type="button"
                onClick={() => setBreakdownType('day')}
                className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors cursor-pointer ${
                  breakdownType === 'day'
                    ? 'bg-white text-slate-900 shadow-2xs dark:bg-surface-800 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white'
                }`}
              >
                <FiClock className="w-3 h-3" />
                <span>Daily</span>
              </button>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
              >
                ✕ Reset
              </button>
            )}
          </div>
        </div>

        {/* Custom Date Range Picker */}
        {datePreset === 'custom' && (
          <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex flex-wrap items-center gap-2.5 text-xs">
            <div className="flex items-center gap-1.5">
              <label className="font-bold text-slate-600 dark:text-neutral-300 text-[11px]">From:</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-surface-800 dark:text-neutral-100"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="font-bold text-slate-600 dark:text-neutral-300 text-[11px]">To:</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-surface-800 dark:text-neutral-100"
              />
            </div>
          </div>
        )}
      </div>

      {loading && <TableState>Loading financial breakdown…</TableState>}
      {error && <TableState tone="error">{error}</TableState>}

      {!loading && !error && (
        <>
          {/* ── 3. KPI Stat Cards (6 Balanced Pillars) ────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
            <StatCard
              icon={<FiTrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
              label="Total Revenue"
              value={formatMoney(totals.totalRevenue)}
              tone="good"
              sub="All services & recycling"
            />
            <StatCard
              icon={<FiTool className="h-3.5 w-3.5 text-slate-600 dark:text-neutral-400" />}
              label="Parts Service"
              value={formatMoney(totals.repairRevenue)}
              tone="neutral"
              sub="Fitting & part charges"
            />
            <StatCard
              icon={<FiLayers className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />}
              label="Service & Fees"
              value={formatMoney(totals.servicesRevenue)}
              tone="info"
              sub={`${totals.servicesCount || 0} diagnostic & tests`}
            />
            <StatCard
              icon={<FiRotateCcw className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />}
              label="Recycle Scrap"
              value={formatMoney(totals.recycleRevenue)}
              tone="warning"
              sub="End-of-life battery payout"
            />
            <StatCard
              icon={<FiCpu className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
              label="Units Serviced"
              value={`${totals.batteriesCount || 0} units`}
              tone="good"
              sub="Unique batteries handled"
            />
            <StatCard
              icon={<FiTarget className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />}
              label="Avg. per Unit"
              value={formatMoney(avgPerUnit)}
              tone="purple"
              sub="Average revenue per battery"
            />
          </div>

          {/* ── 4. Revenue Trend Visualizer ───────────────────────────────────── */}
          {chartSeries.length > 0 && (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-2xs dark:border-white/10 dark:bg-surface-850 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                    <FiTrendingUp className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    {breakdownType === 'month' ? 'Monthly Revenue Trend' : 'Daily Revenue Trend'}
                  </h3>
                </div>
                <span className="text-[11px] font-bold text-slate-400 dark:text-neutral-500">
                  {breakdown.length} period{breakdown.length === 1 ? '' : 's'} tracked · {totals.batteriesCount || 0} units
                </span>
              </div>
              <div className="pt-1">
                <BarChart data={chartSeries} color="#10b981" activeColor="#047857" />
              </div>
            </div>
          )}

          {/* ── 5. Breakdown Section: Mobile Cards vs Desktop Table ──────────── */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-2xs dark:border-white/10 dark:bg-surface-850 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3 dark:border-white/5">
              <div>
                <h2 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                  {breakdownType === 'month' ? 'Monthly Financial Breakdown' : 'Daily Financial Breakdown'}
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                  Click on any {breakdownType === 'month' ? 'month' : 'day'} to view its itemized statements, client distribution, battery fees, and technician logs.
                </p>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-auto min-w-0 sm:min-w-[200px]">
                <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3" />
                <input
                  type="text"
                  placeholder="Search period…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-7 pr-6 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-surface-900 dark:text-white"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200"
                  >
                    <FiX className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {filteredBreakdown.length === 0 ? (
              <div className="py-8 text-center text-slate-400 dark:text-neutral-500">
                <div className="flex flex-col items-center justify-center gap-1.5">
                  <FiCalendar className="w-6 h-6 text-slate-300 dark:text-neutral-600" />
                  <p className="text-xs font-semibold">
                    {searchQuery
                      ? 'No periods match your search query.'
                      : 'No financial activity recorded for the selected date range.'}
                  </p>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="mt-1 text-xs font-bold text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
                    >
                      Reset all filters
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* ── Mobile Stacking Cards (< lg) (Zero Horizontal Scrolling) ── */}
                <div className="lg:hidden space-y-2">
                  {filteredBreakdown.map((row, index) => {
                    const jobs = (row.repairsCount || 0) + (row.servicesCount || 0);
                    return (
                      <Link
                        key={row.key || index}
                        to={`/finance/detail?type=${breakdownType}&period=${row.key}`}
                        className="block rounded-xl border border-slate-200/90 bg-white p-3 hover:border-blue-300 dark:border-white/10 dark:bg-surface-900 transition-all shadow-2xs space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-mono text-[10px] text-slate-400 w-4">#{index + 1}</span>
                            <span className="font-extrabold text-xs text-blue-700 dark:text-blue-400 truncate">
                              {row.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="font-mono font-black text-xs text-emerald-600 dark:text-emerald-400">
                              {formatMoney(row.totalRevenue)}
                            </span>
                            <FiArrowRight className="w-3 h-3 text-slate-400" />
                          </div>
                        </div>

                        {/* 4-Stat Micro Grid */}
                        <div className="grid grid-cols-2 gap-1.5 text-[11px] p-2 rounded-lg bg-slate-50/80 dark:bg-surface-800/60 border border-slate-100 dark:border-white/5">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Repair Cost:</span>
                            <span className="font-bold text-slate-800 dark:text-neutral-200">{formatMoney(row.repairRevenue)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Service Fees:</span>
                            <span className="font-bold text-purple-600 dark:text-purple-400">{formatMoney(row.servicesRevenue || 0)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Recycle:</span>
                            <span className="font-bold text-blue-600 dark:text-blue-400">{formatMoney(row.recycleRevenue || 0)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Activity:</span>
                            <span className="font-bold text-slate-800 dark:text-neutral-200">{jobs}j · {row.batteriesCount || 0}u</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {/* ── Desktop Data Table (lg:block) ── */}
                <div className="hidden lg:block rounded-xl border border-slate-200/80 dark:border-white/10 overflow-hidden shadow-2xs">
                  <div className="max-h-[500px] overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 z-10 bg-slate-100/95 dark:bg-surface-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-white/10">
                        <tr className="text-[10.5px] font-black uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                          <th className="py-2.5 px-3 w-10 text-center">#</th>
                          <th className="py-2.5 px-3">{breakdownType === 'month' ? 'Month' : 'Date'}</th>
                          <th className="py-2.5 px-3">Total Revenue</th>
                          <th className="py-2.5 px-3">Repair Cost</th>
                          <th className="py-2.5 px-3">Service & Fees</th>
                          <th className="py-2.5 px-3">Recycle Revenue</th>
                          <th className="py-2.5 px-3">Jobs Logged</th>
                          <th className="py-2.5 px-3">Batteries Serviced</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5 bg-white dark:bg-surface-850">
                        {filteredBreakdown.map((row, index) => (
                          <tr
                            key={row.key || index}
                            className="hover:bg-slate-50/80 dark:hover:bg-surface-800/60 transition-colors"
                          >
                            <td className="py-2.5 px-3 text-center font-mono text-slate-400 dark:text-neutral-500 text-[11px]">
                              {index + 1}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                              <Link
                                to={`/finance/detail?type=${breakdownType}&period=${row.key}`}
                                className="text-blue-600 hover:underline dark:text-blue-400 inline-flex items-center gap-1.5"
                              >
                                <span>{row.label}</span>
                              </Link>
                            </td>
                            <td className="py-2.5 px-3 font-mono font-black text-emerald-600 dark:text-emerald-400">
                              {formatMoney(row.totalRevenue)}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-neutral-300">
                              {formatMoney(row.repairRevenue)}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-purple-600 dark:text-purple-400">
                              {formatMoney(row.servicesRevenue || 0)}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-blue-600 dark:text-blue-400">
                              {formatMoney(row.recycleRevenue || 0)}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-neutral-200">
                              {(row.repairsCount || 0) + (row.servicesCount || 0)} job{((row.repairsCount || 0) + (row.servicesCount || 0)) === 1 ? '' : 's'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-neutral-400">
                              {row.batteriesCount || 0} unit{row.batteriesCount === 1 ? '' : 's'}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <Link
                                to={`/finance/detail?type=${breakdownType}&period=${row.key}`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 font-bold text-[11px] hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60 transition-colors"
                              >
                                <span>Statement</span>
                                <FiArrowRight className="w-2.5 h-2.5" />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default FinancePage;
