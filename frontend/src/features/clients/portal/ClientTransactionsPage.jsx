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

// The client's own billing history — every repair charge, service fee, and unserviceable fee
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

  // Filtered breakdown totals
  const filteredTotal = useMemo(() => {
    return filteredRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  }, [filteredRows]);

  const filteredRepairTotal = useMemo(() => {
    return filteredRows
      .filter((r) => r.charge_type === 'repair')
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  }, [filteredRows]);

  const filteredServiceTotal = useMemo(() => {
    return filteredRows
      .filter((r) => r.charge_type === 'service')
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  }, [filteredRows]);

  const filteredUnserviceableTotal = useMemo(() => {
    return filteredRows
      .filter((r) => r.battery_status === 'unserviceable' || r.battery_status === 'tested_parts_removed')
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  }, [filteredRows]);

  const columns = [
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
            <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 border border-blue-200/80 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900/50">
              <FiTool className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              <span>Repair Parts & Labor</span>
            </span>
          );
        }
        if (row.battery_status === 'unserviceable' || row.battery_status === 'tested_parts_removed') {
          return (
            <span className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 border border-rose-200/80 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900/50">
              <FiAlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
              <span>Unserviceable / Diagnostic Fee</span>
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 rounded-lg bg-purple-50 px-2 py-0.5 text-xs font-bold text-purple-700 border border-purple-200/80 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-900/50">
            <FiZap className="w-3 h-3 text-purple-600 dark:text-purple-400" />
            <span>Service & Testing Fee</span>
          </span>
        );
      },
    },
    {
      key: 'description',
      label: 'Description / Item',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-800 dark:text-neutral-100">
            {row.description || row.part_name || 'Service & Intake'}
          </span>
          {row.notes && (
            <span className="text-[11px] italic text-slate-400 dark:text-neutral-500 line-clamp-1">
              {row.notes}
            </span>
          )}
        </div>
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
            description="Verified battery repair charges, diagnostic & unserviceable fees calculated only after workshop arrival verification."
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
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-surface-900 shadow-2xs">
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
                {filteredRows.length} total charge line{filteredRows.length === 1 ? '' : 's'}
              </p>
            </div>

            {/* Card 2: Repair Charges */}
            <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-surface-900 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
                  Repair Charges
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
                Parts & labor on repaired batteries
              </p>
            </div>

            {/* Card 3: Unserviceable & Service Fees */}
            <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-900/40 dark:bg-surface-900 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider">
                  Service & Unserviceable Fees
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-400">
                  <FiAlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  £{filteredServiceTotal.toFixed(2)}
                </span>
              </div>
              <p className="text-[11px] text-rose-700 dark:text-rose-400 mt-1 font-medium">
                Intake, diagnostic & unserviceable fees
              </p>
            </div>

            {/* Card 4: Lifetime Billed */}
            <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4 dark:border-purple-900/40 dark:bg-surface-900 shadow-2xs">
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
                {data.length} total charges across all batteries
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
