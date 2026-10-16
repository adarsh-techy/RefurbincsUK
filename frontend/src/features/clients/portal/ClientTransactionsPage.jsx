import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FiCalendar,
  FiDollarSign,
  FiTrendingUp,
  FiRefreshCw,
  FiTool,
  FiCheckCircle,
  FiAlertTriangle,
  FiZap,
  FiSearch,
  FiX,
  FiGrid,
  FiList,
  FiArrowRight,
  FiUser,
  FiInbox,
} from 'react-icons/fi';
import apiClient from '../../../services/api-client';
import DataTable from '../../../components/ui/table/DataTable';
import TableState from '../../../components/ui/table/TableState';
import { StatusBadge } from '../../../components/ui/primitives/Badge';

// Helper to format ISO date to YYYY-MM
function getMonthKey(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function formatMonthLabel(monthKey) {
  if (!monthKey || monthKey === 'ALL') return 'All Time';
  const [y, m] = monthKey.split('-');
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function formatDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getChargeCategory(row) {
  if (row.charge_type === 'repair') {
    return {
      type: 'repair',
      label: 'Repair Service',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900/50',
      icon: FiTool,
    };
  }
  if (row.battery_status === 'unserviceable' || row.battery_status === 'tested_parts_removed') {
    return {
      type: 'diagnostic',
      label: 'Diagnostic Fee',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900/50',
      icon: FiAlertTriangle,
    };
  }
  return {
    type: 'service',
    label: 'Service & Testing',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/80 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-900/50',
    icon: FiZap,
  };
}

function ClientTransactionsPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState('ALL'); // 'ALL' or 'YYYY-MM'
  const [chargeFilter, setChargeFilter] = useState('all'); // 'all' | 'repair' | 'service'
  const [search, setSearch] = useState('');

  // Default to compact cards on mobile (< 768px) to eliminate horizontal table scrolling
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768 ? 'cards' : 'table';
    }
    return 'cards';
  });

  useEffect(() => {
    fetchTransactions();
  }, []);

  async function fetchTransactions() {
    setLoading(true);
    setError(null);
    try {
      const { data: result } = await apiClient.get('/clients/me/transactions');
      setData(result.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }

  // Derive unique months available in the data (sorted newest first)
  const availableMonths = useMemo(() => {
    const monthMap = new Map();
    data.forEach((row) => {
      const k = getMonthKey(row.repaired_at);
      if (k) {
        monthMap.set(k, (monthMap.get(k) || 0) + 1);
      }
    });
    return Array.from(monthMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, count]) => ({
        key,
        label: formatMonthLabel(key),
        count,
      }));
  }, [data]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return data.filter((row) => {
      // Month filter
      if (selectedMonth !== 'ALL' && getMonthKey(row.repaired_at) !== selectedMonth) {
        return false;
      }

      // Charge category filter
      if (chargeFilter === 'repair' && row.charge_type !== 'repair') return false;
      if (chargeFilter === 'service' && row.charge_type !== 'service') return false;

      // Search filter
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        row.battery_code?.toLowerCase().includes(q) ||
        row.part_name?.toLowerCase().includes(q) ||
        String(row.truck_number || '').toLowerCase().includes(q) ||
        row.staff_name?.toLowerCase().includes(q)
      );
    });
  }, [data, selectedMonth, chargeFilter, search]);

  // Breakdown metrics for current period
  const metrics = useMemo(() => {
    const totalAmount = filteredRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

    const repairAmount = filteredRows
      .filter((r) => r.charge_type === 'repair')
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);

    const repairCount = filteredRows.filter((r) => r.charge_type === 'repair').length;

    const serviceAmount = filteredRows
      .filter((r) => r.charge_type === 'service')
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);

    const serviceCount = filteredRows.filter((r) => r.charge_type === 'service').length;

    const uniqueBatteries = new Set(filteredRows.map((r) => r.battery_code).filter(Boolean)).size;
    const avgPerBattery = uniqueBatteries ? totalAmount / uniqueBatteries : 0;

    return {
      totalAmount,
      repairAmount,
      repairCount,
      serviceAmount,
      serviceCount,
      uniqueBatteries,
      avgPerBattery,
    };
  }, [filteredRows]);

  const anyFilter = Boolean(selectedMonth !== 'ALL' || chargeFilter !== 'all' || search);

  const columns = [
    {
      key: 'repaired_at',
      label: 'Date',
      render: (row) => (
        <span className="text-xs font-medium text-slate-600 dark:text-neutral-300 whitespace-nowrap">
          {formatDate(row.repaired_at)}
        </span>
      ),
    },
    {
      key: 'battery_code',
      label: 'Battery ID',
      render: (row) => (
        <div className="flex flex-col py-0.5">
          <Link
            to={`/batteries/${encodeURIComponent(row.battery_code)}`}
            className="font-mono font-bold text-xs sm:text-sm text-emerald-700 hover:underline dark:text-emerald-400"
          >
            {row.battery_code}
          </Link>
          {row.truck_number ? (
            <span className="text-[10px] text-slate-400 dark:text-neutral-500">
              Truck {row.truck_number}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'battery_status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.battery_status} />,
    },
    {
      key: 'charge_type',
      label: 'Charge Category',
      render: (row) => {
        const cat = getChargeCategory(row);
        const IconComponent = cat.icon;
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-bold border ${cat.badgeClass}`}>
            <IconComponent className="w-3 h-3" />
            <span>{cat.label}</span>
          </span>
        );
      },
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (row) => (
        <span className="font-mono font-black text-xs sm:text-sm text-slate-900 dark:text-white">
          £{Number(row.amount || 0).toFixed(2)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4 min-w-0 pb-12">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="border-b border-slate-200/80 pb-3 dark:border-white/10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap min-w-0">
            <h1 className="text-lg sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Transactions & Billing
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700 dark:bg-surface-800 dark:text-neutral-300 border border-slate-200/80 dark:border-white/10">
              {filteredRows.length} Items
            </span>
          </div>

          <button
            type="button"
            onClick={fetchTransactions}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700 cursor-pointer shrink-0 transition-all active:scale-98"
            title="Refresh transactions"
          >
            <FiRefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1 leading-relaxed">
          Verified repair charges, diagnostic inspection fees, and service billing across your fleet.
        </p>
      </div>

      {loading ? (
        <TableState>Loading transactions…</TableState>
      ) : error ? (
        <TableState tone="error">{error}</TableState>
      ) : (
        <>
          {/* ── 4 Top Metric Cards (Responsive 2x2 on Mobile, 4 Cols on Desktop) ── */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 lg:grid-cols-4">
            {/* Total Billed */}
            <div
              onClick={() => setChargeFilter('all')}
              className={`rounded-2xl border p-3.5 sm:p-4 flex flex-col justify-between transition-all cursor-pointer ${
                chargeFilter === 'all'
                  ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-800/60 dark:bg-emerald-950/20 shadow-2xs'
                  : 'border-slate-200/90 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-surface-900 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 truncate">
                  {selectedMonth === 'ALL' ? 'Total Billed' : 'Month Total'}
                </span>
                <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 shrink-0">
                  <FiDollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-base sm:text-xl font-black text-slate-900 dark:text-white leading-tight">
                  £{metrics.totalAmount.toFixed(2)}
                </div>
                <p className="text-[10px] sm:text-xs text-slate-400 dark:text-neutral-500 mt-0.5 font-medium truncate">
                  {filteredRows.length} billing item{filteredRows.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            {/* Repair Services */}
            <div
              onClick={() => setChargeFilter(chargeFilter === 'repair' ? 'all' : 'repair')}
              className={`rounded-2xl border p-3.5 sm:p-4 flex flex-col justify-between transition-all cursor-pointer ${
                chargeFilter === 'repair'
                  ? 'border-blue-400 bg-blue-50/70 dark:border-blue-500/70 dark:bg-blue-950/30 ring-1 ring-blue-400/30 shadow-2xs'
                  : 'border-slate-200/90 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-surface-900 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-blue-800 dark:text-blue-400 truncate">
                  Repairs
                </span>
                <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 shrink-0">
                  <FiTool className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-base sm:text-xl font-black text-slate-900 dark:text-white leading-tight">
                  £{metrics.repairAmount.toFixed(2)}
                </div>
                <p className="text-[10px] sm:text-xs text-slate-400 dark:text-neutral-500 mt-0.5 font-medium truncate">
                  {metrics.repairCount} repair charge{metrics.repairCount === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            {/* Testing & Fees */}
            <div
              onClick={() => setChargeFilter(chargeFilter === 'service' ? 'all' : 'service')}
              className={`rounded-2xl border p-3.5 sm:p-4 flex flex-col justify-between transition-all cursor-pointer ${
                chargeFilter === 'service'
                  ? 'border-indigo-400 bg-indigo-50/70 dark:border-indigo-500/70 dark:bg-indigo-950/30 ring-1 ring-indigo-400/30 shadow-2xs'
                  : 'border-slate-200/90 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-surface-900 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-indigo-800 dark:text-indigo-400 truncate">
                  Testing & Fees
                </span>
                <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 shrink-0">
                  <FiCheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-base sm:text-xl font-black text-slate-900 dark:text-white leading-tight">
                  £{metrics.serviceAmount.toFixed(2)}
                </div>
                <p className="text-[10px] sm:text-xs text-slate-400 dark:text-neutral-500 mt-0.5 font-medium truncate">
                  {metrics.serviceCount} test fee{metrics.serviceCount === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            {/* Fleet Serviced */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 flex flex-col justify-between dark:border-white/10 dark:bg-surface-900 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-400 truncate">
                  Fleet Serviced
                </span>
                <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 shrink-0">
                  <FiTrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-base sm:text-xl font-black text-slate-900 dark:text-white leading-tight">
                  {metrics.uniqueBatteries} <span className="text-xs font-semibold text-slate-400">Units</span>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-400 dark:text-neutral-500 mt-0.5 font-medium truncate">
                  Avg. £{metrics.avgPerBattery.toFixed(2)}/unit
                </p>
              </div>
            </div>
          </div>

          {/* ── Search and Filter Controls Toolbar ─────────────────────── */}
          <div className="space-y-2">
            {/* Search Input */}
            <div className="relative w-full">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <FiSearch className="h-4 w-4" />
              </div>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search battery ID, part or truck…"
                className="w-full rounded-xl border border-slate-200/90 bg-white pl-10 pr-9 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 shadow-2xs h-10"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300 cursor-pointer"
                  title="Clear search"
                >
                  <FiX className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filter Pills & View Toggle Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1 border-t border-slate-100 dark:border-white/5">
              {/* Category Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: 'all', label: 'All Items' },
                  { id: 'repair', label: 'Repairs' },
                  { id: 'service', label: 'Testing' },
                ].map((tab) => {
                  const active = chargeFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setChargeFilter(tab.id)}
                      className={`inline-flex items-center rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer h-8.5 sm:h-9 ${
                        active
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs'
                          : 'border border-slate-200/90 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-300'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Month Selector + Reset + View Toggle */}
              <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
                {/* Month Dropdown Selector */}
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:border-emerald-500 focus:outline-hidden dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 cursor-pointer shadow-2xs h-8.5 sm:h-9"
                >
                  <option value="ALL">All Months ({data.length})</option>
                  {availableMonths.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label} ({m.count})
                    </option>
                  ))}
                </select>

                {anyFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMonth('ALL');
                      setChargeFilter('all');
                      setSearch('');
                    }}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 cursor-pointer h-8.5 sm:h-9 shadow-2xs"
                  >
                    Reset
                  </button>
                )}

                {/* View Mode Toggle: Cards vs Table */}
                <div className="inline-flex rounded-xl border border-slate-200/90 bg-white p-0.5 shadow-2xs dark:border-white/10 dark:bg-surface-800 h-8.5 sm:h-9 items-center">
                  <button
                    type="button"
                    onClick={() => setViewMode('cards')}
                    className={`rounded-lg px-2 py-1 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      viewMode === 'cards'
                        ? 'bg-slate-900 text-white shadow-2xs dark:bg-surface-700 dark:text-white'
                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200'
                    }`}
                    title="Card view (Mobile optimized)"
                  >
                    <FiGrid className="h-3.5 w-3.5" />
                    <span className="hidden min-[400px]:inline text-[11px]">Cards</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('table')}
                    className={`rounded-lg px-2 py-1 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      viewMode === 'table'
                        ? 'bg-slate-900 text-white shadow-2xs dark:bg-surface-700 dark:text-white'
                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200'
                    }`}
                    title="Table view"
                  >
                    <FiList className="h-3.5 w-3.5" />
                    <span className="hidden min-[400px]:inline text-[11px]">Table</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Content Area ───────────────────────────────────────────── */}
          {filteredRows.length === 0 ? (
            /* Compact Solid Empty State */
            <div className="rounded-2xl border border-slate-200/90 bg-white p-8 sm:p-12 text-center shadow-2xs dark:border-white/10 dark:bg-surface-900 space-y-3">
              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800/40 shadow-2xs">
                <FiInbox className="h-6 w-6" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {anyFilter ? 'No matching transactions' : 'No Transactions Recorded Yet'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-neutral-400 max-w-sm mx-auto leading-relaxed">
                {anyFilter
                  ? 'No billing items match your current filter selection. Try clearing the search keyword or selecting a different month.'
                  : 'Verified billing line items for diagnostic inspections, parts, and battery repairs will automatically populate here as jobs complete.'}
              </p>
              {anyFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMonth('ALL');
                    setChargeFilter('all');
                    setSearch('');
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : viewMode === 'cards' ? (
            /* Responsive Card View (Zero horizontal scroll on phones & tablets) */
            <div className="grid grid-cols-1 gap-3 sm:gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredRows.map((row, idx) => {
                const cat = getChargeCategory(row);
                const IconComponent = cat.icon;

                return (
                  <div
                    key={`${row.charge_type}-${row.id || idx}-${row.battery_code}`}
                    className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-2xs transition-all hover:border-slate-300 hover:shadow-xs dark:border-surface-700/80 dark:bg-surface-900"
                  >
                    <div>
                      {/* Card Header: Battery ID + Amount */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1 flex items-center gap-2">
                          <Link
                            to={`/batteries/${encodeURIComponent(row.battery_code)}`}
                            className="font-mono text-sm font-black text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1.5 truncate"
                          >
                            <span>{row.battery_code}</span>
                            <FiArrowRight className="w-3 h-3 opacity-60 shrink-0" />
                          </Link>
                          {row.truck_number ? (
                            <span className="text-[10px] font-medium text-slate-500 dark:text-neutral-400 bg-slate-100 dark:bg-surface-800 px-1.5 py-0.5 rounded-md shrink-0">
                              Truck {row.truck_number}
                            </span>
                          ) : null}
                        </div>

                        <span className="font-mono text-sm sm:text-base font-black text-slate-900 dark:text-white shrink-0 bg-slate-50 dark:bg-surface-800 border border-slate-200/60 dark:border-white/5 px-2 py-0.5 rounded-lg">
                          £{Number(row.amount || 0).toFixed(2)}
                        </span>
                      </div>

                      {/* Badge row: Category + Status */}
                      <div className="mt-2.5 flex items-center justify-between gap-1.5 flex-wrap">
                        <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-bold border ${cat.badgeClass}`}>
                          <IconComponent className="w-3 h-3" />
                          <span>{cat.label}</span>
                        </span>

                        {row.battery_status ? (
                          <StatusBadge status={row.battery_status} />
                        ) : null}
                      </div>

                      {/* Details row: Date + Staff */}
                      <div className="mt-2.5 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2 text-xs dark:bg-surface-800/80 border border-slate-100 dark:border-white/5">
                        <div>
                          <span className="text-slate-400 dark:text-neutral-400 block font-medium flex items-center gap-1 text-[10px] uppercase tracking-wider">
                            <FiCalendar className="w-3 h-3" /> Date
                          </span>
                          <span className="text-slate-700 dark:text-neutral-200 font-bold block truncate mt-0.5">
                            {formatDate(row.repaired_at)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 dark:text-neutral-400 block font-medium flex items-center gap-1 text-[10px] uppercase tracking-wider">
                            <FiUser className="w-3 h-3" /> Staff
                          </span>
                          <span className="text-slate-700 dark:text-neutral-200 font-bold block truncate mt-0.5">
                            {row.staff_name || 'Workshop'}
                          </span>
                        </div>
                      </div>

                      {/* Part Name if present */}
                      {row.part_name ? (
                        <p className="mt-2 text-xs text-slate-500 dark:text-neutral-400 truncate flex items-center gap-1.5">
                          <FiTool className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="font-semibold text-slate-700 dark:text-neutral-300 truncate">
                            {row.part_name}
                          </span>
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Table View with responsive container */
            <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-2xs dark:border-surface-700/80 dark:bg-surface-900">
              <DataTable
                columns={columns}
                rows={filteredRows}
                showRowNumber
                headerColor="blue"
                maxHeight="calc(100vh - 280px)"
                emptyMessage={
                  selectedMonth === 'ALL'
                    ? 'No transactions yet.'
                    : `No transactions found for ${formatMonthLabel(selectedMonth)}.`
                }
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ClientTransactionsPage;
