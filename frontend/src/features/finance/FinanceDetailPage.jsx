import { useEffect, useState, useMemo, Fragment } from 'react';
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
  FiChevronDown,
  FiChevronUp,
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

  const [expandedBatteries, setExpandedBatteries] = useState(new Set());

  const toggleExpand = (key) => {
    setExpandedBatteries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Group all repairs and service fee entries by battery so each battery is consolidated in one row
  const groupedBatteries = useMemo(() => {
    if (!repairs || repairs.length === 0) return [];

    const map = new Map();

    repairs.forEach((r, idx) => {
      const bCode = (r.batteryCode || r.battery_code || '').trim().toUpperCase();
      const bId = r.batteryId || r.battery_id;
      const key = bCode ? `code_${bCode}` : (bId ? `id_${bId}` : `item_${r.id || idx}`);

      if (!map.has(key)) {
        map.set(key, {
          key,
          batteryId: bId,
          batteryCode: r.batteryCode || r.battery_code || (bCode || null),
          batteryStatus: r.batteryStatus || r.battery_status,
          clientId: r.clientId || r.client_id,
          clientName: r.clientName || r.client_name || 'Direct / Unassigned',
          staffList: [],
          services: new Set(),
          parts: new Set(),
          chargeTypes: new Set(),
          laborCharge: 0,
          partsCharge: 0,
          serviceFee: 0,
          totalCharge: 0,
          items: [],
          latestDate: r.repairedAt || r.charge_date,
          notes: [],
        });
      }

      const group = map.get(key);

      group.laborCharge += Number(r.laborCharge || r.labor_charge || 0);
      group.partsCharge += Number(r.partsCharge || r.parts_charge || 0);
      group.serviceFee += Number(r.serviceFee || r.service_fee || 0);
      group.totalCharge += Number(r.totalCharge || r.total_charge || 0);

      // Merge services if array
      if (Array.isArray(r.services)) {
        r.services.forEach((s) => group.services.add(s));
      }
      // Merge parts if array
      if (Array.isArray(r.parts)) {
        r.parts.forEach((p) => group.parts.add(p));
      }

      const isServiceFee =
        r.chargeType === 'service_fee' || (r.serviceFee > 0 && !r.partsCharge && !r.laborCharge);
      if (isServiceFee) {
        group.chargeTypes.add('service_fee');
        const desc = r.itemDescription || r.partName || 'Service Fee';
        if (desc && !Array.isArray(r.services)) group.services.add(desc);
      } else {
        group.chargeTypes.add('repair');
        if (!Array.isArray(r.parts)) {
          const partsArr = (r.partName || r.itemDescription || '')
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean);
          partsArr.forEach((p) => group.parts.add(p));
        }
      }

      if (Array.isArray(r.chargeTypes)) {
        r.chargeTypes.forEach((t) => group.chargeTypes.add(t));
      }

      // Track staff members
      if (Array.isArray(r.staffList) && r.staffList.length > 0) {
        r.staffList.forEach((st) => {
          if (!group.staffList.some((s) => s.id === st.id && s.name === st.name)) {
            group.staffList.push(st);
          }
        });
      } else {
        const sName = r.staffName || (r.staffId ? `Staff #${r.staffId}` : 'System Auto');
        if (sName && !group.staffList.some((s) => s.id === r.staffId && s.name === sName)) {
          group.staffList.push({ id: r.staffId, name: sName });
        }
      }

      if (r.batteryStatus || r.battery_status) {
        group.batteryStatus = r.batteryStatus || r.battery_status;
      }
      if ((r.batteryCode || r.battery_code) && !group.batteryCode) {
        group.batteryCode = r.batteryCode || r.battery_code;
      }
      if (r.clientName && r.clientName !== 'Direct / Unassigned') {
        group.clientName = r.clientName;
      }
      if (r.clientId && !group.clientId) {
        group.clientId = r.clientId;
      }

      const itemDate = r.repairedAt || r.charge_date;
      if (itemDate) {
        if (!group.latestDate || new Date(itemDate) > new Date(group.latestDate)) {
          group.latestDate = itemDate;
        }
      }

      if (r.notes && typeof r.notes === 'string' && r.notes.trim()) {
        group.notes.push(r.notes.trim());
      }

      if (Array.isArray(r.items) && r.items.length > 0) {
        r.items.forEach((it) => group.items.push(it));
      } else {
        group.items.push(r);
      }
    });

    const list = Array.from(map.values()).map((g) => ({
      ...g,
      services: Array.from(g.services),
      parts: Array.from(g.parts),
      chargeTypes: Array.from(g.chargeTypes),
      items: g.items.sort((a, b) => new Date(b.repairedAt || b.charge_date || 0) - new Date(a.repairedAt || a.charge_date || 0)),
    }));

    list.sort((a, b) => new Date(b.latestDate || 0) - new Date(a.latestDate || 0));

    return list;
  }, [repairs]);

  // Search filtered grouped batteries
  const filteredBatteries = useMemo(() => {
    if (!searchQuery.trim()) return groupedBatteries;
    const q = searchQuery.toLowerCase();

    return groupedBatteries.filter((b) => {
      const code = (b.batteryCode || '').toLowerCase();
      const client = (b.clientName || '').toLowerCase();
      const staffMatches = b.staffList.some((s) => (s.name || '').toLowerCase().includes(q));
      const serviceMatches = b.services.some((s) => s.toLowerCase().includes(q));
      const partMatches = b.parts.some((p) => p.toLowerCase().includes(q));
      const noteMatches = b.notes.some((n) => n.toLowerCase().includes(q));
      const typeMatches = b.chargeTypes.some((t) => t.toLowerCase().includes(q));
      const statusMatches = (b.batteryStatus || '').toLowerCase().includes(q);

      return (
        code.includes(q) ||
        client.includes(q) ||
        staffMatches ||
        serviceMatches ||
        partMatches ||
        noteMatches ||
        typeMatches ||
        statusMatches
      );
    });
  }, [groupedBatteries, searchQuery]);

  const totalItemizedChargesCount = useMemo(() => {
    return filteredBatteries.reduce((sum, b) => sum + (b.items?.length || 0), 0);
  }, [filteredBatteries]);

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
              Itemized Battery Charges & Fee Ledger ({filteredBatteries.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-neutral-400">
              Complete breakdown of every billable repair, mandatory intake fee, and diagnostic service consolidated per battery.
            </p>
          </div>

          <div className="relative min-w-[240px]">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
            <input
              type="text"
              placeholder="Search battery, client, service, part, fee…"
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
          <div className="max-h-[560px] overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-100/95 dark:bg-surface-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-white/10">
                <tr className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                  <th className="py-3 px-3.5 w-12 text-center">#</th>
                  <th className="py-3 px-3.5 min-w-[130px]">Date & Time</th>
                  <th className="py-3 px-3.5 min-w-[140px]">Battery Code</th>
                  <th className="py-3 px-3.5 min-w-[130px]">Client</th>
                  <th className="py-3 px-3.5 min-w-[120px]">Type</th>
                  <th className="py-3 px-3.5 min-w-[130px]">Staff / System</th>
                  <th className="py-3 px-3.5 min-w-[180px]">Service / Parts</th>
                  <th className="py-3 px-3.5 min-w-[90px]">Labor</th>
                  <th className="py-3 px-3.5 min-w-[90px]">Parts</th>
                  <th className="py-3 px-3.5 min-w-[90px]">Fee</th>
                  <th className="py-3 px-3.5 min-w-[100px]">Total Charge</th>
                  <th className="py-3 px-3.5 min-w-[100px]">Status</th>
                  <th className="py-3 px-2 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 bg-white dark:bg-surface-850">
                {filteredBatteries.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-slate-400 dark:text-neutral-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FiTool className="w-8 h-8 text-slate-300 dark:text-neutral-600" />
                        <p className="font-semibold">
                          {searchQuery
                            ? 'No batteries match your search query.'
                            : 'No battery fees or repair charges found for this period.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredBatteries.map((b, index) => {
                    const hasRepair = b.chargeTypes.includes('repair') || b.partsCharge > 0 || b.laborCharge > 0;
                    const hasServiceFee = b.chargeTypes.includes('service_fee') || b.serviceFee > 0;
                    const isExpanded = expandedBatteries.has(b.key);

                    return (
                      <Fragment key={b.key}>
                        <tr className="hover:bg-slate-50/80 dark:hover:bg-surface-800/60 transition-colors">
                          <td className="py-3 px-3.5 text-center font-mono text-slate-400 dark:text-neutral-500">
                            {index + 1}
                          </td>
                          <td className="py-3 px-3.5">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800 dark:text-neutral-200">
                                {b.latestDate ? new Date(b.latestDate).toLocaleDateString([], {
                                  day: '2-digit',
                                  month: 'short',
                                }) : '—'}
                              </span>
                              <span className="text-[10px] text-slate-400 dark:text-neutral-500">
                                {b.latestDate ? new Date(b.latestDate).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                }) : ''}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3.5 font-medium">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {b.batteryCode ? (
                                <Link
                                  to={`/batteries/${b.batteryCode}`}
                                  className="inline-flex items-center gap-1 font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md hover:underline dark:bg-blue-950/60 dark:text-blue-300"
                                >
                                  {b.batteryCode}
                                </Link>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                              {b.items.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(b.key)}
                                  className="inline-flex items-center text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-surface-800 dark:text-neutral-300 dark:hover:bg-surface-700 px-1.5 py-0.5 rounded-full transition-colors cursor-pointer"
                                  title="Toggle charge breakdown"
                                >
                                  {b.items.length} charges
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3.5 font-semibold text-slate-800 dark:text-neutral-200">
                            {b.clientName}
                          </td>
                          <td className="py-3 px-3.5">
                            <div className="flex flex-wrap gap-1">
                              {hasRepair && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                  Repair
                                </span>
                              )}
                              {hasServiceFee && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                                  Service Fee
                                </span>
                              )}
                              {!hasRepair && !hasServiceFee && (
                                <span className="text-slate-400">—</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3.5">
                            {b.staffList.length > 0 ? (
                              <div className="flex flex-col gap-0.5">
                                {b.staffList.map((st, sIdx) =>
                                  st.id ? (
                                    <Link
                                      key={sIdx}
                                      to={`/staff/${st.id}`}
                                      className="font-medium text-blue-600 hover:underline dark:text-blue-400 block truncate max-w-[130px]"
                                      title={st.name}
                                    >
                                      {st.name}
                                    </Link>
                                  ) : (
                                    <span
                                      key={sIdx}
                                      className="text-slate-500 dark:text-neutral-400 block truncate max-w-[130px]"
                                      title={st.name}
                                    >
                                      {st.name}
                                    </span>
                                  )
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3.5">
                            <div className="flex flex-wrap gap-1 max-w-[280px]">
                              {b.services.map((s, sIdx) => (
                                <span
                                  key={`srv-${sIdx}`}
                                  className="inline-flex items-center rounded-md bg-purple-50 px-1.5 py-0.5 text-[11px] font-semibold text-purple-700 dark:bg-purple-950/60 dark:text-purple-300"
                                >
                                  {s}
                                </span>
                              ))}
                              {b.parts.map((p, pIdx) => (
                                <span
                                  key={`prt-${pIdx}`}
                                  className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                >
                                  {p}
                                </span>
                              ))}
                              {b.services.length === 0 && b.parts.length === 0 && (
                                <span className="text-slate-400 dark:text-neutral-500">—</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3.5 font-mono text-slate-600 dark:text-neutral-300">
                            {b.laborCharge > 0 ? formatMoney(b.laborCharge) : '—'}
                          </td>
                          <td className="py-3 px-3.5 font-mono text-slate-600 dark:text-neutral-300">
                            {b.partsCharge > 0 ? formatMoney(b.partsCharge) : '—'}
                          </td>
                          <td className="py-3 px-3.5 font-mono text-purple-600 dark:text-purple-400 font-bold">
                            {b.serviceFee > 0 ? formatMoney(b.serviceFee) : '—'}
                          </td>
                          <td className="py-3 px-3.5 font-mono font-black text-emerald-600 dark:text-emerald-400">
                            {formatMoney(b.totalCharge)}
                          </td>
                          <td className="py-3 px-3.5">
                            {b.batteryStatus ? <StatusBadge status={b.batteryStatus} /> : '—'}
                          </td>
                          <td className="py-3 px-2 text-center">
                            {b.items.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => toggleExpand(b.key)}
                                title={isExpanded ? 'Collapse charge details' : 'Expand charge details'}
                                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-surface-800 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                              >
                                {isExpanded ? (
                                  <FiChevronUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                ) : (
                                  <FiChevronDown className="w-4 h-4" />
                                )}
                              </button>
                            ) : null}
                          </td>
                        </tr>

                        {/* Expandable itemized sub-row */}
                        {isExpanded && (
                          <tr className="bg-slate-50/80 dark:bg-surface-900/60 border-y border-slate-200/70 dark:border-white/5">
                            <td colSpan={13} className="py-3 px-4 pl-10 pr-6">
                              <div className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-white/10 dark:bg-surface-850 shadow-2xs space-y-2">
                                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-neutral-200 border-b border-slate-100 dark:border-white/5 pb-2">
                                  <span>Itemized Individual Charges ({b.items.length})</span>
                                  <span className="text-[11px] font-normal text-slate-400">
                                    Battery: <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{b.batteryCode || '—'}</span>
                                  </span>
                                </div>
                                <div className="space-y-1.5">
                                  {b.items.map((item, itemIdx) => {
                                    const isItemSrv =
                                      item.chargeType === 'service_fee' ||
                                      (item.serviceFee > 0 && !item.partsCharge && !item.laborCharge);
                                    return (
                                      <div
                                        key={item.id || itemIdx}
                                        className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 dark:bg-surface-900/80 text-xs border border-slate-100 dark:border-white/5"
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="font-mono text-[11px] text-slate-400 w-5">#{itemIdx + 1}</span>
                                          <span
                                            className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                              isItemSrv
                                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                            }`}
                                          >
                                            {isItemSrv ? 'Service Fee' : 'Repair Job'}
                                          </span>
                                          <span className="font-semibold text-slate-800 dark:text-neutral-200">
                                            {item.itemDescription || item.partName || (isItemSrv ? 'Service Fee' : 'Repair')}
                                          </span>
                                          {item.notes && (
                                            <span className="text-[11px] text-slate-500 italic truncate max-w-xs">
                                              — "{item.notes}"
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-4 text-right shrink-0">
                                          <span className="text-[11px] text-slate-400">
                                            {item.repairedAt
                                              ? new Date(item.repairedAt).toLocaleString([], {
                                                  day: '2-digit',
                                                  month: 'short',
                                                  hour: '2-digit',
                                                  minute: '2-digit',
                                                })
                                              : '—'}
                                          </span>
                                          <span className="text-[11px] text-slate-500">
                                            by {item.staffName || 'System'}
                                          </span>
                                          <div className="text-[11px] text-slate-500 flex items-center gap-2">
                                            {item.laborCharge > 0 && <span>Labor: {formatMoney(item.laborCharge)}</span>}
                                            {item.partsCharge > 0 && <span>Parts: {formatMoney(item.partsCharge)}</span>}
                                            {item.serviceFee > 0 && <span>Fee: {formatMoney(item.serviceFee)}</span>}
                                          </div>
                                          <div className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400 min-w-[70px]">
                                            {formatMoney(item.totalCharge)}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
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
