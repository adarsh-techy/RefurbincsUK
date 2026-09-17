import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiCalendar,
  FiDollarSign,
  FiTrendingUp,
  FiTool,
  FiLayers,
  FiFilter,
  FiArrowRight,
  FiSearch,
  FiX,
  FiBarChart2,
  FiClock,
} from 'react-icons/fi';
import apiClient from '../../services/api-client';
import StatCard from '../../components/ui/primitives/StatCard';
import TableState from '../../components/ui/table/TableState';
import PageHeader from '../../components/ui/primitives/PageHeader';
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
        count: item.repairRevenue,
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

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <PageHeader
        title="Finance & Billing"
        description="Comprehensive repair revenue, parts vs labor margins, staff payroll, and profit analysis."
        titleClassName="text-2xl font-bold tracking-tight text-green-600 dark:text-green-400"
      />

      {/* Date Filter Toolbar */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 md:p-5 shadow-sm dark:border-white/10 dark:bg-surface-850 space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-400 dark:text-neutral-500 mr-1 inline-flex items-center gap-1">
              <FiCalendar className="w-3.5 h-3.5" /> Date Filter:
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
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
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

          {/* Breakdown Type Switcher (Monthly vs Daily) */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 dark:text-neutral-500">
              View By:
            </span>
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-surface-900 text-xs">
              <button
                type="button"
                onClick={() => setBreakdownType('month')}
                className={`flex items-center gap-1.5 px-3 py-1 font-bold rounded-lg transition-colors ${
                  breakdownType === 'month'
                    ? 'bg-white text-slate-900 shadow-2xs dark:bg-surface-800 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white'
                }`}
              >
                <FiCalendar className="w-3.5 h-3.5" />
                <span>Monthly</span>
              </button>
              <button
                type="button"
                onClick={() => setBreakdownType('day')}
                className={`flex items-center gap-1.5 px-3 py-1 font-bold rounded-lg transition-colors ${
                  breakdownType === 'day'
                    ? 'bg-white text-slate-900 shadow-2xs dark:bg-surface-800 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white'
                }`}
              >
                <FiClock className="w-3.5 h-3.5" />
                <span>Daily</span>
              </button>
            </div>
          </div>
        </div>

        {/* Custom Date Range Picker */}
        {datePreset === 'custom' && (
          <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <label className="font-bold text-slate-600 dark:text-neutral-300">From:</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg border border-blue-200 bg-blue-50/60 px-2.5 py-1 font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-blue-800/40 dark:bg-blue-950/40 dark:text-neutral-100"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="font-bold text-slate-600 dark:text-neutral-300">To:</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg border border-blue-200 bg-blue-50/60 px-2.5 py-1 font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-blue-800/40 dark:bg-blue-950/40 dark:text-neutral-100"
              />
            </div>
          </div>
        )}
      </div>

      {loading && <TableState>Loading financial breakdown…</TableState>}
      {error && <TableState tone="error">{error}</TableState>}

      {!loading && !error && (
        <>
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
            <StatCard
              label="Repair Revenue"
              value={formatMoney(totals.repairRevenue)}
              tone="good"
              sub={`Parts: ${formatMoney(totals.partsRevenue)} · Labor: ${formatMoney(totals.laborRevenue)}`}
            />
            <StatCard
              label="Labor Revenue"
              value={formatMoney(totals.laborRevenue)}
              tone="info"
              sub="Direct service earnings"
            />
            <StatCard
              label="Parts Revenue"
              value={formatMoney(totals.partsRevenue)}
              tone="neutral"
              sub="Inventory components billed"
            />
            <StatCard
              label="Staff Salary (Monthly)"
              value={formatMoney(totals.staffSalaryTotal)}
              tone="warning"
              sub="Active technician payroll"
            />
            <StatCard
              label="Net Profit"
              value={formatMoney(totals.netProfit)}
              tone={totals.netProfit >= 0 ? 'good' : 'critical'}
              sub={totals.netProfit >= 0 ? 'Profitable operation' : 'Below payroll cost'}
            />
          </div>

          {/* Revenue Trend Visualizer */}
          {chartSeries.length > 0 && (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-surface-850 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                    <FiTrendingUp className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {breakdownType === 'month' ? 'Monthly Revenue Trend' : 'Daily Revenue Trend'}
                  </h3>
                </div>
                <span className="text-xs font-bold text-slate-400 dark:text-neutral-500">
                  {breakdown.length} period{breakdown.length === 1 ? '' : 's'} tracked
                </span>
              </div>
              <div className="pt-2">
                <BarChart data={chartSeries} color="#10b981" activeColor="#047857" />
              </div>
            </div>
          )}

          {/* Breakdown Table Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-surface-850 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-white/5">
              <div>
                <h2 className="text-sm font-black text-slate-900 dark:text-white">
                  {breakdownType === 'month' ? 'Monthly Financial Breakdown' : 'Daily Financial Breakdown'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-neutral-400">
                  Click on any {breakdownType === 'month' ? 'month' : 'day'} row to view its itemized statements, client distribution, and technician logs.
                </p>
              </div>

              {/* Search */}
              <div className="relative min-w-[220px]">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                <input
                  type="text"
                  placeholder="Search period…"
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

            {/* Inside Sticky-Scrolling Data Table */}
            <div className="rounded-xl border border-slate-200/80 dark:border-white/10 overflow-hidden shadow-2xs">
              <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-100/95 dark:bg-surface-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-white/10">
                    <tr className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                      <th className="py-3 px-3.5 w-12 text-center">#</th>
                      <th className="py-3 px-3.5 min-w-[150px]">
                        {breakdownType === 'month' ? 'Month' : 'Date'}
                      </th>
                      <th className="py-3 px-3.5 min-w-[130px]">Total Revenue</th>
                      <th className="py-3 px-3.5 min-w-[120px]">Labor Billed</th>
                      <th className="py-3 px-3.5 min-w-[120px]">Parts Billed</th>
                      <th className="py-3 px-3.5 min-w-[120px]">Repairs Logged</th>
                      <th className="py-3 px-3.5 min-w-[130px]">Batteries Serviced</th>
                      <th className="py-3 px-3.5 min-w-[120px] text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 bg-white dark:bg-surface-850">
                    {filteredBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-neutral-500">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <FiCalendar className="w-8 h-8 text-slate-300 dark:text-neutral-600" />
                            <p className="font-semibold">
                              {searchQuery
                                ? 'No periods match your search query.'
                                : 'No financial activity recorded for the selected date range.'}
                            </p>
                            {hasActiveFilters && (
                              <button
                                type="button"
                                onClick={clearAllFilters}
                                className="mt-1 text-xs font-bold text-blue-600 hover:underline dark:text-blue-400"
                              >
                                Reset all filters
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredBreakdown.map((row, index) => (
                        <tr
                          key={row.key || index}
                          className="hover:bg-slate-50/80 dark:hover:bg-surface-800/60 transition-colors"
                        >
                          <td className="py-3 px-3.5 text-center font-mono text-slate-400 dark:text-neutral-500">
                            {index + 1}
                          </td>
                          <td className="py-3 px-3.5 font-bold text-slate-900 dark:text-white">
                            <Link
                              to={`/finance/detail?type=${breakdownType}&period=${row.key}`}
                              className="text-blue-600 hover:underline dark:text-blue-400 inline-flex items-center gap-1.5"
                            >
                              <span>{row.label}</span>
                            </Link>
                          </td>
                          <td className="py-3 px-3.5 font-mono font-black text-emerald-600 dark:text-emerald-400">
                            {formatMoney(row.repairRevenue)}
                          </td>
                          <td className="py-3 px-3.5 font-mono text-slate-700 dark:text-neutral-300">
                            {formatMoney(row.laborRevenue)}
                          </td>
                          <td className="py-3 px-3.5 font-mono text-slate-700 dark:text-neutral-300">
                            {formatMoney(row.partsRevenue)}
                          </td>
                          <td className="py-3 px-3.5 font-semibold text-slate-800 dark:text-neutral-200">
                            {row.repairsCount} job{row.repairsCount === 1 ? '' : 's'}
                          </td>
                          <td className="py-3 px-3.5 text-slate-600 dark:text-neutral-400">
                            {row.batteriesCount} unit{row.batteriesCount === 1 ? '' : 's'}
                          </td>
                          <td className="py-3 px-3.5 text-right">
                            <Link
                              to={`/finance/detail?type=${breakdownType}&period=${row.key}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60 transition-colors"
                            >
                              <span>View Statement</span>
                              <FiArrowRight className="w-3 h-3" />
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default FinancePage;
