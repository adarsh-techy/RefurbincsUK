import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FiCalendar,
  FiDollarSign,
  FiTrendingUp,
  FiFilter,
  FiLayers,
  FiRefreshCw,
} from 'react-icons/fi';
import apiClient from '../../../services/api-client';
import PageHeader from '../../../components/ui/primitives/PageHeader';
import DataTable from '../../../components/ui/table/DataTable';
import TableState from '../../../components/ui/table/TableState';

// Helper to format ISO date to YYYY-MM
function getMonthKey(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
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

// The client's own billing history — every repair charge across every
// battery they've sent in, with monthly analytics and month filtering.
function ClientTransactionsPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('ALL'); // 'ALL' or 'YYYY-MM'

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

  // Current calendar month key (e.g. '2026-03')
  const currentCalendarMonthKey = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, []);

  // Filtered rows based on selected month
  const filteredRows = useMemo(() => {
    if (selectedMonth === 'ALL') return data;
    return data.filter((row) => getMonthKey(row.repaired_at) === selectedMonth);
  }, [data, selectedMonth]);

  // Overall calculations
  const lifetimeTotal = useMemo(() => {
    return data.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  }, [data]);

  // Current Month calculations
  const currentMonthTotal = useMemo(() => {
    return data
      .filter((row) => getMonthKey(row.repaired_at) === currentCalendarMonthKey)
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  }, [data, currentCalendarMonthKey]);

  const currentMonthCount = useMemo(() => {
    return data.filter((row) => getMonthKey(row.repaired_at) === currentCalendarMonthKey).length;
  }, [data, currentCalendarMonthKey]);

  // Selected Month calculations
  const filteredTotal = useMemo(() => {
    return filteredRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  }, [filteredRows]);

  const avgCostPerRepair = useMemo(() => {
    if (!filteredRows.length) return 0;
    return filteredTotal / filteredRows.length;
  }, [filteredRows, filteredTotal]);

  const columns = [
    {
      key: 'repaired_at',
      label: 'Date',
      render: (row) =>
        row.repaired_at
          ? new Date(row.repaired_at).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })
          : '—',
    },
    {
      key: 'battery_code',
      label: 'Battery ID',
      render: (row) => (
        <Link
          to={`/batteries/${encodeURIComponent(row.battery_code)}`}
          className="font-mono font-bold text-brand-700 hover:underline dark:text-emerald-400"
        >
          {row.battery_code}
        </Link>
      ),
    },
    {
      key: 'part_name',
      label: 'Part(s) Changed',
      render: (row) => (
        <span className="font-medium text-slate-700 dark:text-neutral-300">
          {row.part_name || 'Service & Calibration'}
        </span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (row) => (
        <span className="font-mono font-bold text-slate-900 dark:text-white">
          £{Number(row.amount || 0).toFixed(2)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header with Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200/80 pb-4 dark:border-white/10">
        <div>
          <PageHeader
            title="Transactions & Billing"
            description="Your repair billing history, monthly financial breakdown, and service invoice logs."
          />
        </div>

        <button
          type="button"
          onClick={fetchTransactions}
          className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700 transition-colors shadow-2xs cursor-pointer"
        >
          <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {loading ? (
        <TableState>Loading transactions…</TableState>
      ) : error ? (
        <TableState tone="error">{error}</TableState>
      ) : (
        <>
          {/* Monthly Financial Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Card 1: Selected Month / Filtered Spend */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-surface-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                  {selectedMonth === 'ALL' ? 'Total Period Spend' : `${formatMonthLabel(selectedMonth)} Spend`}
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
                  <FiDollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  £{filteredTotal.toFixed(2)}
                </span>
              </div>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 font-medium">
                {filteredRows.length} repair transaction{filteredRows.length === 1 ? '' : 's'}
              </p>
            </div>

            {/* Card 2: Current Month Spend */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/40 dark:bg-surface-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                  This Month Billed
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
                  <FiCalendar className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  £{currentMonthTotal.toFixed(2)}
                </span>
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 font-medium">
                {currentMonthCount} repair{currentMonthCount === 1 ? '' : 's'} in {formatMonthLabel(currentCalendarMonthKey)}
              </p>
            </div>

            {/* Card 3: Avg Cost per Repair */}
            <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-surface-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
                  Avg Cost / Repair
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                  <FiTrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  £{avgCostPerRepair.toFixed(2)}
                </span>
              </div>
              <p className="text-[11px] text-blue-700 dark:text-blue-400 mt-1 font-medium">
                Average across filtered repairs
              </p>
            </div>

            {/* Card 4: Lifetime Billed */}
            <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4 dark:border-purple-900/40 dark:bg-surface-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider">
                  Lifetime Billed
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400">
                  <FiLayers className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  £{lifetimeTotal.toFixed(2)}
                </span>
              </div>
              <p className="text-[11px] text-purple-700 dark:text-purple-400 mt-1 font-medium">
                {data.length} total repairs on record
              </p>
            </div>
          </div>

          {/* Month Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs dark:bg-surface-900 dark:border-white/10">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-surface-800 dark:text-neutral-300">
                <FiFilter className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-700 dark:text-neutral-200">
                Filter by Month:
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Dropdown Selector */}
              <div className="relative">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-100 cursor-pointer"
                >
                  <option value="ALL">All Months ({data.length} records)</option>
                  {availableMonths.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label} ({m.count} repairs)
                    </option>
                  ))}
                </select>
              </div>

              {/* Reset to All Months button if filtered */}
              {selectedMonth !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setSelectedMonth('ALL')}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-300 dark:hover:bg-surface-700 cursor-pointer transition-colors"
                >
                  Clear Filter
                </button>
              )}
            </div>
          </div>

          {/* Transactions Data Table */}
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
        </>
      )}
    </div>
  );
}

export default ClientTransactionsPage;
