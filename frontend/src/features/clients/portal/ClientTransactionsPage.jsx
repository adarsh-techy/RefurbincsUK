import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FiCalendar,
  FiDollarSign,
  FiTrendingUp,
  FiFilter,
  FiLayers,
  FiRefreshCw,
  FiTool,
  FiCheckCircle,
  FiAlertTriangle,
  FiZap,
} from 'react-icons/fi';
import apiClient from '../../../services/api-client';
import PageHeader from '../../../components/ui/primitives/PageHeader';
import DataTable from '../../../components/ui/table/DataTable';
import TableState from '../../../components/ui/table/TableState';
import { StatusBadge } from '../../../components/ui/primitives/Badge';

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

// The client's billing history — every repair charge and testing/service fee
// across every battery they've sent in, with monthly analytics and month filtering.
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

  // Filtered rows based on selected month
  const filteredRows = useMemo(() => {
    if (selectedMonth === 'ALL') return data;
    return data.filter((row) => getMonthKey(row.repaired_at) === selectedMonth);
  }, [data, selectedMonth]);

  // Filtered breakdown totals
  const filteredTotal = useMemo(() => {
    return filteredRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  }, [filteredRows]);

  const filteredRepairTotal = useMemo(() => {
    return filteredRows
      .filter((r) => r.charge_type === 'repair')
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  }, [filteredRows]);

  const repairLinesCount = useMemo(() => {
    return filteredRows.filter((r) => r.charge_type === 'repair').length;
  }, [filteredRows]);

  const filteredServiceTotal = useMemo(() => {
    return filteredRows
      .filter((r) => r.charge_type === 'service')
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  }, [filteredRows]);

  const serviceLinesCount = useMemo(() => {
    return filteredRows.filter((r) => r.charge_type === 'service').length;
  }, [filteredRows]);

  // Unique batteries serviced in this period
  const uniqueBatteriesCount = useMemo(() => {
    return new Set(filteredRows.map((r) => r.battery_code).filter(Boolean)).size;
  }, [filteredRows]);

  // Average cost per battery
  const avgCostPerBattery = useMemo(() => {
    if (!uniqueBatteriesCount) return 0;
    return filteredTotal / uniqueBatteriesCount;
  }, [filteredTotal, uniqueBatteriesCount]);

  const columns = [
    {
      key: 'repaired_at',
      label: 'Date',
      render: (row) => (
        <span className="text-xs font-medium text-slate-600 dark:text-neutral-300 whitespace-nowrap">
          {row.repaired_at
            ? new Date(row.repaired_at).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })
            : '—'}
        </span>
      ),
    },
    {
      key: 'battery_code',
      label: 'Battery ID',
      render: (row) => (
        <div className="flex flex-col">
          <Link
            to={`/batteries/${encodeURIComponent(row.battery_code)}`}
            className="font-mono font-bold text-brand-700 hover:underline dark:text-emerald-400"
          >
            {row.battery_code}
          </Link>
          {row.truck_number && (
            <span className="text-[10.5px] text-slate-400 dark:text-neutral-500">
              Truck {row.truck_number}
            </span>
          )}
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
        if (row.charge_type === 'repair') {
          return (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 border border-blue-200/80 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900/50">
              <FiTool className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Repair Service</span>
            </span>
          );
        }
        if (row.battery_status === 'unserviceable' || row.battery_status === 'tested_parts_removed') {
          return (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 border border-rose-200/80 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900/50">
              <FiAlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>Testing & Diagnostic Fee</span>
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 border border-indigo-200/80 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-900/50">
            <FiZap className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Service & Testing Fee</span>
          </span>
        );
      },
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
            description="Verified repair charges, diagnostic inspection fees, and service billing across all your batteries."
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
          {/* Classic Financial Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Card 1: Total Billed */}
            <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/50 p-4 dark:border-emerald-900/40 dark:bg-surface-900 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                  {selectedMonth === 'ALL' ? 'Total Billed' : `${formatMonthLabel(selectedMonth)} Total`}
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
                  <FiDollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  £{filteredTotal.toFixed(2)}
                </span>
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 font-medium">
                {filteredRows.length} total billing line{filteredRows.length === 1 ? '' : 's'}
              </p>
            </div>

            {/* Card 2: Repair Services */}
            <div className="rounded-2xl border border-blue-200/90 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-surface-900 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
                  Repair Services
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                  <FiTool className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  £{filteredRepairTotal.toFixed(2)}
                </span>
              </div>
              <p className="text-[11px] text-blue-700 dark:text-blue-400 mt-1 font-medium">
                {repairLinesCount} repair service line{repairLinesCount === 1 ? '' : 's'} (refurbishment & service)
              </p>
            </div>

            {/* Card 3: Testing & Diagnostics */}
            <div className="rounded-2xl border border-indigo-200/90 bg-indigo-50/50 p-4 dark:border-indigo-900/40 dark:bg-surface-900 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider">
                  Testing & Diagnostics
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400">
                  <FiCheckCircle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  £{filteredServiceTotal.toFixed(2)}
                </span>
              </div>
              <p className="text-[11px] text-indigo-700 dark:text-indigo-400 mt-1 font-medium">
                {serviceLinesCount} intake inspection & QA test{serviceLinesCount === 1 ? '' : 's'}
              </p>
            </div>

            {/* Card 4: Batteries Serviced & Unit Avg */}
            <div className="rounded-2xl border border-amber-200/90 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-surface-900 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                  Batteries Serviced
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
                  <FiTrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {uniqueBatteriesCount} {uniqueBatteriesCount === 1 ? 'Battery' : 'Batteries'}
                </span>
              </div>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 font-medium">
                Avg. £{avgCostPerBattery.toFixed(2)} per battery
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
                      {m.label} ({m.count} records)
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
