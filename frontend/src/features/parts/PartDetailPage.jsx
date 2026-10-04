import { useEffect, useState, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  FiArrowLeft,
  FiPackage,
  FiTool,
  FiDollarSign,
  FiCheckCircle,
  FiAlertTriangle,
  FiXCircle,
  FiClock,
  FiCalendar,
  FiUser,
  FiTruck,
  FiShield,
  FiSearch,
  FiEdit2,
  FiPlus,
  FiTrash2,
  FiRefreshCw,
  FiExternalLink,
  FiBarChart2,
  FiActivity,
  FiTag,
  FiCopy,
  FiCheck,
  FiLayers,
  FiTrendingUp,
  FiTrendingDown,
  FiInbox,
  FiRotateCcw,
} from 'react-icons/fi';
import apiClient from '../../services/api-client';
import TableState from '../../components/ui/table/TableState';
import { StatusBadge } from '../../components/ui/primitives/Badge';
import Modal from '../../components/ui/overlays/Modal';
import ConfirmModal from '../../components/ui/overlays/ConfirmModal';
import { hasPermission } from '../../utils/permissions';
import RestockForm from './RestockForm';
import PartForm from './PartForm';

const MONTHS_SHOWN = 6;

// Buckets usage (repairs) and restocks (manual top-ups) into the last N calendar months
function buildMonthlyBreakdown(usageHistory = [], stockHistory = []) {
  const monthKey = (dateString) => {
    const d = new Date(dateString);
    return `${d.getFullYear()}-${d.getMonth()}`;
  };

  const usedByMonth = {};
  usageHistory.forEach((h) => {
    const key = monthKey(h.repaired_at);
    usedByMonth[key] = (usedByMonth[key] || 0) + Number(h.quantity_used || 1);
  });

  const restockedByMonth = {};
  stockHistory.forEach((a) => {
    const key = monthKey(a.adjusted_at);
    restockedByMonth[key] = (restockedByMonth[key] || 0) + Number(a.quantity_added || 0);
  });

  const now = new Date();
  const months = [];
  for (let i = MONTHS_SHOWN - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    months.push({
      key,
      label: d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
      restocked: restockedByMonth[key] || 0,
      used: usedByMonth[key] || 0,
    });
  }
  return months;
}

function formatDate(val) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateOnly(val) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '—';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const remSec = seconds % 60;
  return remSec > 0 ? `${mins}m ${remSec}s` : `${mins}m`;
}

function PartDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin' || isSuperAdmin;
  const canManageParts = hasPermission(user, 'parts') || isAdmin;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals
  const [restocking, setRestocking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [copiedSku, setCopiedSku] = useState(false);

  // Active view tab: 'usage' | 'removed' | 'restock' | 'specs' | 'analytics'
  const [activeTab, setActiveTab] = useState('usage');

  // Usage search and status filter
  const [usageSearch, setUsageSearch] = useState('');
  const [usageStatusFilter, setUsageStatusFilter] = useState('all');

  // Removed parts search
  const [removedSearch, setRemovedSearch] = useState('');

  // Restock search
  const [restockSearch, setRestockSearch] = useState('');

  const load = () => {
    setLoading(true);
    setError(null);
    apiClient
      .get(`/parts/${id}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  function handleCopySku(sku) {
    if (!sku) return;
    navigator.clipboard.writeText(sku);
    setCopiedSku(true);
    setTimeout(() => setCopiedSku(false), 2000);
  }

  async function handleDeleteConfirm() {
    setDeleteError(null);
    try {
      await apiClient.delete(`/parts/${id}`);
      navigate('/parts');
    } catch (err) {
      setDeleteError(err.response?.data?.message || err.message || 'Failed to delete part');
    }
  }

  if (loading) {
    return (
      <div className="py-12">
        <TableState>Loading part inventory details…</TableState>
      </div>
    );
  }

  if (error || !data?.part) {
    return (
      <div className="py-8">
        <Link
          to="/parts"
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-emerald-600 dark:text-neutral-300 dark:hover:text-emerald-400"
        >
          <FiArrowLeft className="w-4 h-4" />
          <span>Back to Parts Inventory</span>
        </Link>
        <TableState tone="error">{error || 'Part not found'}</TableState>
      </div>
    );
  }

  const { part, usageHistory = [], stockHistory = [] } = data;

  // Active vs Removed breakdown
  const removedHistory = usageHistory.filter((h) => Boolean(h.removed_at));
  const activeHistory = usageHistory.filter((h) => !h.removed_at);

  const totalQuantityUsed = usageHistory.reduce((sum, h) => sum + Number(h.quantity_used || 1), 0);
  const totalRemovedQuantity = removedHistory.reduce((sum, h) => sum + Number(h.quantity_used || 1), 0);
  const activeQuantity = activeHistory.reduce((sum, h) => sum + Number(h.quantity_used || 1), 0);

  // Key metrics and calculations
  const quantity = Number(part.quantity || 0);
  const unitCost = Number(part.repair_cost || 0);
  const serviceCharge = Number(part.service_charge || 0);
  const unitMargin = serviceCharge - unitCost;
  const marginPct = serviceCharge > 0 ? ((unitMargin / serviceCharge) * 100).toFixed(1) : '0.0';
  const totalStockValuation = quantity * unitCost;
  const potentialRevenue = quantity * serviceCharge;

  const totalRevenue = usageHistory.reduce(
    (sum, h) => (h.removed_at ? sum : sum + Number(h.price || 0) + Number(h.labor_charge || 0)),
    0
  );
  const totalRestocked = stockHistory.reduce((sum, a) => sum + Number(a.quantity_added || 0), 0);

  const uniqueBatteriesCount = new Set(usageHistory.map((h) => h.battery_code).filter(Boolean)).size;
  const uniqueClientsCount = new Set(usageHistory.map((h) => h.client_name).filter(Boolean)).size;

  const lastRestockedAt = stockHistory.length > 0 ? stockHistory[0].adjusted_at : null;

  // Stock status determination
  const isOutOfStock = quantity <= 0;
  const isLowStock = quantity > 0 && quantity <= 10;

  // Monthly breakdown
  const monthlyBreakdown = buildMonthlyBreakdown(usageHistory, stockHistory);
  const maxMonthly = Math.max(1, ...monthlyBreakdown.flatMap((m) => [m.restocked, m.used]));
  const totalUsedLast6Months = monthlyBreakdown.reduce((sum, m) => sum + m.used, 0);
  const avgMonthlyBurnRate = (totalUsedLast6Months / MONTHS_SHOWN).toFixed(1);
  const monthsOfSupplyRemaining =
    Number(avgMonthlyBurnRate) > 0 ? (quantity / Number(avgMonthlyBurnRate)).toFixed(1) : '∞';

  // Filtered usage history
  const filteredUsage = usageHistory.filter((item) => {
    const q = usageSearch.toLowerCase().trim();
    const matchesSearch =
      !q ||
      item.battery_code?.toLowerCase().includes(q) ||
      item.serial_number?.toLowerCase().includes(q) ||
      item.client_name?.toLowerCase().includes(q) ||
      item.staff_name?.toLowerCase().includes(q) ||
      item.removed_by_staff_name?.toLowerCase().includes(q) ||
      item.truck_number?.toLowerCase().includes(q) ||
      item.notes?.toLowerCase().includes(q);

    if (usageStatusFilter === 'active') return matchesSearch && !item.removed_at;
    if (usageStatusFilter === 'removed') return matchesSearch && Boolean(item.removed_at);
    if (usageStatusFilter === 'all') return matchesSearch;

    return matchesSearch && item.battery_status?.toLowerCase() === usageStatusFilter.toLowerCase();
  });

  // Filtered removed history
  const filteredRemoved = removedHistory.filter((item) => {
    const q = removedSearch.toLowerCase().trim();
    return (
      !q ||
      item.battery_code?.toLowerCase().includes(q) ||
      item.serial_number?.toLowerCase().includes(q) ||
      item.client_name?.toLowerCase().includes(q) ||
      item.removed_by_staff_name?.toLowerCase().includes(q) ||
      item.staff_name?.toLowerCase().includes(q) ||
      item.truck_number?.toLowerCase().includes(q) ||
      item.battery_status?.toLowerCase().includes(q) ||
      item.notes?.toLowerCase().includes(q)
    );
  });

  // Filtered restock history
  const filteredStockHistory = stockHistory.filter((item) => {
    const q = restockSearch.toLowerCase().trim();
    return (
      !q ||
      item.adjusted_by_name?.toLowerCase().includes(q) ||
      item.adjusted_by_email?.toLowerCase().includes(q) ||
      item.note?.toLowerCase().includes(q) ||
      String(item.quantity_added).includes(q)
    );
  });

  return (
    <div className="space-y-6 pb-16">
      {/* ── Top Navigation & Breadcrumbs ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200/80 pb-4 dark:border-white/10">
        <Link
          to="/parts"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-emerald-700 dark:text-neutral-400 dark:hover:text-emerald-400 transition-colors"
        >
          <FiArrowLeft className="w-4 h-4" />
          <span>Back to Parts Inventory</span>
        </Link>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {canManageParts && (
            <button
              type="button"
              onClick={() => setRestocking(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 active:scale-95 transition-all cursor-pointer"
            >
              <FiPlus className="w-3.5 h-3.5" />
              <span>+ Restock Stock</span>
            </button>
          )}

          {canManageParts && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700 transition-all shadow-2xs cursor-pointer"
            >
              <FiEdit2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Edit Details</span>
            </button>
          )}

          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setDeleting(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-900/50 transition-all shadow-2xs cursor-pointer"
              title="Delete this part"
            >
              <FiTrash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          )}

          <button
            type="button"
            onClick={load}
            className="inline-flex items-center justify-center p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-300 dark:hover:bg-surface-700 transition-colors shadow-2xs cursor-pointer"
            title="Refresh part details"
          >
            <FiRefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Main Part Header Title & Badges ─────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {part.name}
            </h1>
            <span className="rounded-lg bg-slate-100 px-2.5 py-0.5 text-xs font-mono font-bold text-slate-700 dark:bg-surface-800 dark:text-neutral-300">
              ID #{part.id}
            </span>
            {isOutOfStock ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-0.5 text-xs font-bold text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                <span className="h-2 w-2 rounded-full bg-rose-600 dark:bg-rose-400 animate-pulse" />
                <span>Out of Stock</span>
              </span>
            ) : isLowStock ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                <span className="h-2 w-2 rounded-full bg-amber-600 dark:bg-amber-400 animate-pulse" />
                <span>Low Stock ({quantity} left)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                <span>In Stock &amp; Available</span>
              </span>
            )}
            {totalRemovedQuantity > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50">
                <FiRotateCcw className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>{totalRemovedQuantity} Reclaimed / Removed</span>
              </span>
            )}
          </div>

          <div className="mt-2 flex items-center gap-4 text-xs text-slate-500 dark:text-neutral-400 flex-wrap">
            {part.sku ? (
              <button
                type="button"
                onClick={() => handleCopySku(part.sku)}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-300 transition-colors cursor-pointer"
                title="Click to copy SKU"
              >
                <FiTag className="w-3 h-3 text-slate-400" />
                <span>SKU: {part.sku}</span>
                {copiedSku ? (
                  <FiCheck className="w-3 h-3 text-emerald-600" />
                ) : (
                  <FiCopy className="w-3 h-3 text-slate-400" />
                )}
              </button>
            ) : (
              <span className="text-slate-400 dark:text-neutral-500">No SKU registered</span>
            )}
            <span>&bull;</span>
            <span className="inline-flex items-center gap-1">
              <FiCalendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Registered on {formatDateOnly(part.created_at)}</span>
            </span>
            {lastRestockedAt && (
              <>
                <span>&bull;</span>
                <span className="inline-flex items-center gap-1">
                  <FiClock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Last restocked {formatDateOnly(lastRestockedAt)}</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Fast Action Restock Button */}
        {canManageParts && (
          <button
            type="button"
            onClick={() => setRestocking(true)}
            className="self-start md:self-auto inline-flex items-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50/80 px-4 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300 transition-all shadow-2xs cursor-pointer"
          >
            <FiPackage className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Manage Inventory ({quantity} on hand)</span>
          </button>
        )}
      </div>

      {/* ── Top Hero Stock Health & Unit Economics Gauge ─────────────────────── */}
      <div
        className={`rounded-3xl border p-5 sm:p-6 shadow-2xs transition-all ${
          isOutOfStock
            ? 'border-rose-200/90 bg-gradient-to-br from-rose-50/60 via-white to-rose-50/20 dark:border-rose-900/40 dark:from-rose-950/20 dark:to-surface-900'
            : isLowStock
              ? 'border-amber-200/90 bg-gradient-to-br from-amber-50/60 via-white to-amber-50/20 dark:border-amber-900/40 dark:from-amber-950/20 dark:to-surface-900'
              : 'border-emerald-200/90 bg-gradient-to-br from-emerald-50/60 via-white to-emerald-50/20 dark:border-emerald-900/40 dark:from-emerald-950/20 dark:to-surface-900'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Stock Level Left Column */}
          <div className="flex items-start gap-4">
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-2xs ${
                isOutOfStock
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300'
                  : isLowStock
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
              }`}
            >
              <FiPackage className="h-7 w-7" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">
                  {quantity.toLocaleString()}
                </span>
                <span className="text-sm font-bold text-slate-500 dark:text-neutral-400">
                  unit{quantity === 1 ? '' : 's'} available
                </span>
              </div>

              {/* Progress bar visual meter */}
              <div className="mt-2.5 flex items-center gap-3">
                <div className="h-2.5 w-44 sm:w-56 overflow-hidden rounded-full bg-slate-200 dark:bg-surface-800">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isOutOfStock
                        ? 'bg-rose-500 w-0'
                        : isLowStock
                          ? 'bg-amber-500 w-1/4'
                          : 'bg-emerald-500 w-full'
                    }`}
                  />
                </div>
                <span className="text-[11px] font-bold text-slate-500 dark:text-neutral-400">
                  {isOutOfStock ? '0% (Depleted)' : isLowStock ? 'Low Stock Warning' : 'Healthy Inventory'}
                </span>
              </div>
            </div>
          </div>

          {/* Economics Right Column */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t lg:border-t-0 lg:border-l border-slate-200/80 pt-4 lg:pt-0 lg:pl-6 dark:border-white/10">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                Unit Cost
              </span>
              <p className="mt-1 text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono">
                £{unitCost.toFixed(2)}
              </p>
              <span className="text-[10px] text-slate-400 dark:text-neutral-500">Acquisition cost</span>
            </div>

            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                Billing Rate
              </span>
              <p className="mt-1 text-base sm:text-lg font-black text-blue-700 dark:text-blue-400 font-mono">
                £{serviceCharge.toFixed(2)}
              </p>
              <span className="text-[10px] text-slate-400 dark:text-neutral-500">Client charge</span>
            </div>

            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                Gross Margin
              </span>
              <p className="mt-1 text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-400 font-mono">
                £{unitMargin.toFixed(2)}
              </p>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                {marginPct}% margin
              </span>
            </div>

            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                Inventory Value
              </span>
              <p className="mt-1 text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono">
                £{totalStockValuation.toFixed(2)}
              </p>
              <span className="text-[10px] text-slate-400 dark:text-neutral-500">Asset on hand</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 6 Core Part Metric Cards Grid ───────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Card 1: Available Units */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-neutral-400">
              Stock on Hand
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <FiPackage className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{quantity}</p>
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 font-medium">
            {isOutOfStock ? 'Depleted' : 'Ready for repair'}
          </p>
        </div>

        {/* Card 2: Units Installed (Active in Fleet) */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-neutral-400">
              Active in Fleet
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
              <FiTool className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{activeQuantity}</p>
          <p className="text-[11px] text-blue-700 dark:text-blue-400 mt-1 font-medium">
            {activeHistory.length} active installation{activeHistory.length === 1 ? '' : 's'}
          </p>
        </div>

        {/* Card 3: Removed / Reclaimed Units */}
        <div
          onClick={() => setActiveTab('removed')}
          className="rounded-2xl border border-amber-200/90 bg-gradient-to-br from-amber-50/50 via-white to-amber-50/20 p-4 shadow-2xs dark:border-amber-900/40 dark:from-amber-950/20 dark:to-surface-900 cursor-pointer hover:border-amber-400 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-400">
              Reclaimed Parts
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
              <FiRotateCcw className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-amber-900 dark:text-amber-300">{totalRemovedQuantity}</p>
          <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 font-medium">
            From {removedHistory.length} battery{removedHistory.length === 1 ? '' : 'ies'} (View →)
          </p>
        </div>

        {/* Card 4: Total Restocked */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-neutral-400">
              Total Restocked
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
              <FiTrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">+{totalRestocked}</p>
          <p className="text-[11px] text-indigo-700 dark:text-indigo-400 mt-1 font-medium">
            {stockHistory.length} restock batch{stockHistory.length === 1 ? '' : 'es'}
          </p>
        </div>

        {/* Card 5: Unique Batteries Serviced */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-neutral-400">
              Batteries Serviced
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
              <FiShield className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{uniqueBatteriesCount}</p>
          <p className="text-[11px] text-teal-700 dark:text-teal-400 mt-1 font-medium">
            Across {uniqueClientsCount} client fleet{uniqueClientsCount === 1 ? '' : 's'}
          </p>
        </div>

        {/* Card 6: Run-rate & Supply Runway */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-neutral-400">
              Supply Runway
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
              <FiActivity className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {monthsOfSupplyRemaining === '∞' ? 'Ample' : `${monthsOfSupplyRemaining} mo`}
          </p>
          <p className="text-[11px] text-purple-700 dark:text-purple-400 mt-1 font-medium">
            ~{avgMonthlyBurnRate} units/mo burn
          </p>
        </div>
      </div>

      {/* ── Interactive View Tabs ───────────────────────────────────────────── */}
      <div className="border-b border-slate-200 dark:border-white/10">
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-px">
          {/* Tab 1: Usage in Repairs */}
          <button
            type="button"
            onClick={() => setActiveTab('usage')}
            className={`inline-flex items-center gap-2 border-b-2 py-3 px-3.5 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'usage'
                ? 'border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            <FiTool className="w-4 h-4" />
            <span>Usage &amp; Fitted ({usageHistory.length})</span>
          </button>

          {/* Tab 2: Removed / Reclaimed Parts */}
          <button
            type="button"
            onClick={() => setActiveTab('removed')}
            className={`inline-flex items-center gap-2 border-b-2 py-3 px-3.5 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'removed'
                ? 'border-amber-600 text-amber-700 dark:border-amber-400 dark:text-amber-300'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            <FiRotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Removed / Reclaimed Parts</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-bold ${
              removedHistory.length > 0
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                : 'bg-slate-100 text-slate-600 dark:bg-surface-800'
            }`}>
              {removedHistory.length}
            </span>
          </button>

          {/* Tab 3: Restock Receipts */}
          <button
            type="button"
            onClick={() => setActiveTab('restock')}
            className={`inline-flex items-center gap-2 border-b-2 py-3 px-3.5 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'restock'
                ? 'border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            <FiPackage className="w-4 h-4" />
            <span>Restock Receipts ({stockHistory.length})</span>
          </button>

          {/* Tab 4: Part Specifications */}
          <button
            type="button"
            onClick={() => setActiveTab('specs')}
            className={`inline-flex items-center gap-2 border-b-2 py-3 px-3.5 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'specs'
                ? 'border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            <FiLayers className="w-4 h-4" />
            <span>Part Specifications &amp; Economics</span>
          </button>

          {/* Tab 5: Monthly Analytics */}
          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`inline-flex items-center gap-2 border-b-2 py-3 px-3.5 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            <FiBarChart2 className="w-4 h-4" />
            <span>Monthly Activity &amp; Burn Rate</span>
          </button>
        </div>
      </div>

      {/* ── TAB 1: Usage in Repairs (All Installations & State) ─────────────── */}
      {activeTab === 'usage' && (
        <div className="space-y-4">
          {/* Search and Filters Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs dark:bg-surface-900 dark:border-white/10">
            <div className="relative flex-1 max-w-md">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search battery code, serial, client, technician, truck…"
                value={usageSearch}
                onChange={(e) => setUsageSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-100"
              />
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-500 dark:text-neutral-400">Filter:</span>
              {[
                { key: 'all', label: `All (${usageHistory.length})` },
                { key: 'active', label: `Active (${activeHistory.length})` },
                { key: 'removed', label: `Removed (${removedHistory.length})` },
                { key: 'returned', label: 'Returned Fleet' },
                { key: 'in_repair', label: 'In Repair' },
                { key: 'recycled', label: 'Recycled' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setUsageStatusFilter(key)}
                  className={`rounded-xl px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer ${
                    usageStatusFilter === key
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-surface-800 dark:text-neutral-300 dark:hover:bg-surface-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Usage Table */}
          {filteredUsage.length === 0 ? (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-12 text-center shadow-2xs dark:border-white/10 dark:bg-surface-900">
              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-surface-800">
                <FiTool className="w-6 h-6" />
              </div>
              <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
                {usageHistory.length === 0 ? 'No repairs logged with this part yet' : 'No repairs match your filter'}
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400 max-w-sm mx-auto">
                {usageHistory.length === 0
                  ? 'When technicians assign this part during battery diagnostics or module replacement, complete details will be tracked here.'
                  : 'Try clearing your search query or status filter to see all repair records.'}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-2xs dark:border-white/10 dark:bg-surface-900">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-xs">
                  <thead className="bg-slate-50/90 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/80 dark:bg-surface-850 dark:border-white/10 dark:text-neutral-400">
                    <tr>
                      <th className="py-3.5 px-4">Battery / Code</th>
                      <th className="py-3.5 px-4">Client Fleet</th>
                      <th className="py-3.5 px-4">Truck Intake</th>
                      <th className="py-3.5 px-4">Battery Status</th>
                      <th className="py-3.5 px-4">Quantity</th>
                      <th className="py-3.5 px-4">Part State</th>
                      <th className="py-3.5 px-4">Installed By</th>
                      <th className="py-3.5 px-4">Date Logged</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                    {filteredUsage.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors">
                        {/* Battery Code */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <Link
                              to={`/batteries/${encodeURIComponent(row.battery_code)}`}
                              className="font-mono font-bold text-emerald-700 hover:underline dark:text-emerald-400"
                            >
                              {row.battery_code}
                            </Link>
                            {row.serial_number && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                SN: {row.serial_number}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Client Fleet */}
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-800 dark:text-neutral-200">
                            {row.client_name || '—'}
                          </span>
                        </td>

                        {/* Truck Intake */}
                        <td className="py-3.5 px-4">
                          {row.truck_number ? (
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-700 dark:text-neutral-300">
                              <FiTruck className="w-3.5 h-3.5 text-slate-400" />
                              <span>#{row.truck_number}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-neutral-500">—</span>
                          )}
                        </td>

                        {/* Battery Status */}
                        <td className="py-3.5 px-4">
                          <StatusBadge status={row.battery_status} />
                        </td>

                        {/* Quantity */}
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {row.quantity_used || 1} unit{Number(row.quantity_used || 1) === 1 ? '' : 's'}
                          </span>
                        </td>

                        {/* Part State (Active vs Removed) */}
                        <td className="py-3.5 px-4">
                          {row.removed_at ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900/50 w-fit">
                                <FiRotateCcw className="w-2.5 h-2.5 text-amber-600" />
                                <span>Part Removed / Salvaged</span>
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {formatDateOnly(row.removed_at)} by {row.removed_by_staff_name || 'Staff'}
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900/50 w-fit">
                              <FiCheckCircle className="w-2.5 h-2.5 text-emerald-600" />
                              <span>Active / Fitted</span>
                            </span>
                          )}
                        </td>

                        {/* Installed By */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-700 dark:bg-surface-800 dark:text-neutral-200">
                              {row.staff_name ? row.staff_name.charAt(0).toUpperCase() : 'W'}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-800 dark:text-neutral-200">
                                {row.staff_name || 'Workshop'}
                              </span>
                              {row.staff_role && (
                                <span className="text-[10px] text-slate-400 capitalize">
                                  {row.staff_role}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Repair Date & Duration */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span className="text-slate-700 dark:text-neutral-300">
                              {formatDateOnly(row.repaired_at)}
                            </span>
                            {row.duration_seconds > 0 && (
                              <span className="text-[10px] text-slate-400 inline-flex items-center gap-1">
                                <FiClock className="w-3 h-3" />
                                <span>{formatDuration(row.duration_seconds)}</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Action Link */}
                        <td className="py-3.5 px-4 text-right">
                          <Link
                            to={`/batteries/${encodeURIComponent(row.battery_code)}`}
                            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline dark:text-emerald-400"
                          >
                            <span>View Battery</span>
                            <FiExternalLink className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 p-3.5 text-xs text-slate-500 dark:border-white/5 dark:bg-surface-850 dark:text-neutral-400">
                <span>
                  Showing {filteredUsage.length} of {usageHistory.length} total repair installation{usageHistory.length === 1 ? '' : 's'}
                </span>
                <span className="font-mono font-semibold text-slate-700 dark:text-neutral-300">
                  Active: {activeHistory.length} &bull; Removed: {removedHistory.length}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: REMOVED / RECLAIMED PARTS (Dedicated Detailed View) ──────── */}
      {activeTab === 'removed' && (
        <div className="space-y-4">
          {/* Explanation Alert Banner */}
          <div className="rounded-2xl border border-amber-200/90 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
              <FiRotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-amber-900 dark:text-amber-200">
                Reclaimed &amp; Disassembled Inventory ({totalRemovedQuantity} units total)
              </h4>
              <p className="mt-0.5 text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                When batteries are decommissioned, recycled, or unserviceable, working parts previously fitted during diagnosis are reclaimed back into workshop inventory to avoid wasted parts.
              </p>
            </div>
          </div>

          {/* Quick Metrics for Removed Parts */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="rounded-2xl border border-amber-200/80 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Total Units Reclaimed
              </span>
              <p className="mt-1 text-2xl font-black text-amber-700 dark:text-amber-400 font-mono">
                {totalRemovedQuantity} unit{totalRemovedQuantity === 1 ? '' : 's'}
              </p>
              <span className="text-[10px] text-slate-500">Recovered from repairs</span>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Batteries Disassembled
              </span>
              <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white font-mono">
                {new Set(removedHistory.map((h) => h.battery_code)).size} batteries
              </p>
              <span className="text-[10px] text-slate-500">Unserviceable or recycled</span>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Recovered Asset Value
              </span>
              <p className="mt-1 text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
                £{(totalRemovedQuantity * unitCost).toFixed(2)}
              </p>
              <span className="text-[10px] text-slate-500">Saved component value</span>
            </div>
          </div>

          {/* Search Bar for Removed Parts */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs dark:bg-surface-900 dark:border-white/10">
            <div className="relative flex-1 max-w-md">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search removed battery code, client, staff who removed it…"
                value={removedSearch}
                onChange={(e) => setRemovedSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-100"
              />
            </div>
          </div>

          {/* Table of Removed Parts */}
          {filteredRemoved.length === 0 ? (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-12 text-center shadow-2xs dark:border-white/10 dark:bg-surface-900">
              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                <FiRotateCcw className="w-6 h-6" />
              </div>
              <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
                {removedHistory.length === 0 ? 'No removed parts recorded for this component' : 'No records match search'}
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400 max-w-sm mx-auto">
                {removedHistory.length === 0
                  ? 'All units ever installed on batteries remain actively fitted with client fleets.'
                  : 'Clear the search query above to see all removed records.'}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-amber-200/80 bg-white shadow-2xs dark:border-white/10 dark:bg-surface-900">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-xs">
                  <thead className="bg-amber-50/70 text-[11px] font-bold uppercase tracking-wider text-amber-900 border-b border-amber-200/70 dark:bg-surface-850 dark:border-white/10 dark:text-amber-300">
                    <tr>
                      <th className="py-3.5 px-4">Battery / Code</th>
                      <th className="py-3.5 px-4">Client Fleet</th>
                      <th className="py-3.5 px-4">Battery State</th>
                      <th className="py-3.5 px-4">Quantity Reclaimed</th>
                      <th className="py-3.5 px-4">Removed By</th>
                      <th className="py-3.5 px-4">Date Removed</th>
                      <th className="py-3.5 px-4">Originally Installed</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                    {filteredRemoved.map((row) => (
                      <tr key={row.id} className="hover:bg-amber-50/30 dark:hover:bg-white/5 transition-colors">
                        <td className="py-3.5 px-4">
                          <Link
                            to={`/batteries/${encodeURIComponent(row.battery_code)}`}
                            className="font-mono font-bold text-amber-800 hover:underline dark:text-amber-400"
                          >
                            {row.battery_code}
                          </Link>
                          {row.serial_number && (
                            <span className="text-[10px] text-slate-400 block font-mono">
                              SN: {row.serial_number}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-800 dark:text-neutral-200">
                            {row.client_name || '—'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <StatusBadge status={row.battery_status} />
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                            +{row.quantity_used || 1} unit recovered
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                              {row.removed_by_staff_name ? row.removed_by_staff_name.charAt(0).toUpperCase() : 'S'}
                            </div>
                            <span className="font-semibold text-slate-800 dark:text-neutral-200">
                              {row.removed_by_staff_name || row.staff_name || 'Staff'}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-bold text-amber-900 dark:text-amber-300">
                            {formatDate(row.removed_at)}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-slate-500 dark:text-neutral-400">
                          {formatDateOnly(row.repaired_at)} by {row.staff_name}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <Link
                            to={`/batteries/${encodeURIComponent(row.battery_code)}`}
                            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline dark:text-emerald-400"
                          >
                            <span>Inspect</span>
                            <FiExternalLink className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-amber-200/60 bg-amber-50/40 p-3.5 text-xs text-amber-900/80 dark:border-white/5 dark:bg-surface-850 dark:text-neutral-400 flex items-center justify-between">
                <span>Total Recovered Records: {filteredRemoved.length}</span>
                <span className="font-mono font-bold text-amber-900 dark:text-amber-300">
                  {totalRemovedQuantity} Total Units Reclaimed
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: Restock Receipts & Inventory Top-ups ─────────────────────── */}
      {activeTab === 'restock' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs dark:bg-surface-900 dark:border-white/10">
            <div className="relative flex-1 max-w-md">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search restock note, user name, email, or quantity…"
                value={restockSearch}
                onChange={(e) => setRestockSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-100"
              />
            </div>

            {canManageParts && (
              <button
                type="button"
                onClick={() => setRestocking(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition-all cursor-pointer"
              >
                <FiPlus className="w-3.5 h-3.5" />
                <span>+ Add Restock Receipt</span>
              </button>
            )}
          </div>

          {filteredStockHistory.length === 0 ? (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-12 text-center shadow-2xs dark:border-white/10 dark:bg-surface-900">
              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                <FiPackage className="w-6 h-6" />
              </div>
              <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
                No restock entries recorded yet
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400 max-w-sm mx-auto">
                Record supplier inventory batches or warehouse replenishments to track stock arrivals and audit trails.
              </p>
              {canManageParts && (
                <button
                  type="button"
                  onClick={() => setRestocking(true)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition-all cursor-pointer"
                >
                  <FiPlus className="w-3.5 h-3.5" />
                  <span>Restock This Part</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-2xs dark:border-white/10 dark:bg-surface-900">
              <ul className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredStockHistory.map((item) => (
                  <li key={item.id} className="p-4 sm:p-5 flex items-start gap-4 hover:bg-slate-50/60 dark:hover:bg-white/5 transition-colors">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                      <FiPackage className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-base font-black text-blue-700 dark:text-blue-400">
                            +{item.quantity_added} units
                          </span>
                          <span className="rounded-md bg-blue-50 border border-blue-200/80 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/60 dark:border-blue-900/50 dark:text-blue-300">
                            Stock Inflow
                          </span>
                        </div>
                        <span className="text-xs text-slate-400 dark:text-neutral-500 font-medium">
                          {formatDate(item.adjusted_at)}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 dark:text-neutral-400 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          <FiUser className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            Logged by <strong className="text-slate-800 dark:text-neutral-200">{item.adjusted_by_name || 'Admin'}</strong>
                          </span>
                        </span>
                        {item.adjusted_by_role && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-surface-800 dark:text-neutral-300 capitalize">
                            {item.adjusted_by_role}
                          </span>
                        )}
                        {item.adjusted_by_email && (
                          <span className="text-slate-400">({item.adjusted_by_email})</span>
                        )}
                      </div>

                      {item.note && (
                        <div className="mt-2.5 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-700 dark:bg-surface-800/80 dark:text-neutral-200 border border-slate-100 dark:border-white/5">
                          <span className="font-bold text-slate-400 text-[10px] uppercase block mb-0.5">Note / Memo</span>
                          <p>{item.note}</p>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: Part Specifications & Economics ──────────────────────────── */}
      {activeTab === 'specs' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card: Item Identifiers & Physical Specs */}
          <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xs dark:border-white/10 dark:bg-surface-900">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <FiTag className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Identity &amp; Inventory Profile</span>
            </h3>

            <dl className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
              <div className="py-3 flex items-center justify-between">
                <dt className="text-slate-500 dark:text-neutral-400">Part Name</dt>
                <dd className="font-bold text-slate-900 dark:text-white">{part.name}</dd>
              </div>

              <div className="py-3 flex items-center justify-between">
                <dt className="text-slate-500 dark:text-neutral-400">SKU / Catalog Code</dt>
                <dd className="font-mono font-bold text-slate-800 dark:text-neutral-200">
                  {part.sku ? (
                    <button
                      type="button"
                      onClick={() => handleCopySku(part.sku)}
                      className="inline-flex items-center gap-1.5 text-emerald-700 hover:underline dark:text-emerald-400 cursor-pointer"
                    >
                      <span>{part.sku}</span>
                      <FiCopy className="w-3 h-3 text-slate-400" />
                    </button>
                  ) : (
                    'Not specified'
                  )}
                </dd>
              </div>

              <div className="py-3 flex items-center justify-between">
                <dt className="text-slate-500 dark:text-neutral-400">System Database ID</dt>
                <dd className="font-mono text-slate-700 dark:text-neutral-300">#{part.id}</dd>
              </div>

              <div className="py-3 flex items-center justify-between">
                <dt className="text-slate-500 dark:text-neutral-400">Current Stock Quantity</dt>
                <dd className="font-bold text-slate-900 dark:text-white">
                  {quantity} unit{quantity === 1 ? '' : 's'}
                </dd>
              </div>

              <div className="py-3 flex items-center justify-between">
                <dt className="text-slate-500 dark:text-neutral-400">Active Units in Fleet</dt>
                <dd className="font-bold text-blue-700 dark:text-blue-400">
                  {activeQuantity} unit{activeQuantity === 1 ? '' : 's'}
                </dd>
              </div>

              <div className="py-3 flex items-center justify-between">
                <dt className="text-slate-500 dark:text-neutral-400">Reclaimed / Removed Units</dt>
                <dd className="font-bold text-amber-700 dark:text-amber-400">
                  {totalRemovedQuantity} unit{totalRemovedQuantity === 1 ? '' : 's'}
                </dd>
              </div>

              <div className="py-3 flex items-center justify-between">
                <dt className="text-slate-500 dark:text-neutral-400">Inventory Status</dt>
                <dd>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      isOutOfStock
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                        : isLowStock
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    }`}
                  >
                    {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
                  </span>
                </dd>
              </div>

              <div className="py-3 flex items-center justify-between">
                <dt className="text-slate-500 dark:text-neutral-400">Registered In System</dt>
                <dd className="text-slate-700 dark:text-neutral-300">{formatDate(part.created_at)}</dd>
              </div>
            </dl>
          </div>

          {/* Card: Financial Economics & Workshop Billing */}
          <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xs dark:border-white/10 dark:bg-surface-900">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <FiDollarSign className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Unit Economics &amp; Pricing</span>
            </h3>

            <dl className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
              <div className="py-3 flex items-center justify-between">
                <dt className="text-slate-500 dark:text-neutral-400">Unit Purchase Cost (Supplier)</dt>
                <dd className="font-mono font-bold text-slate-900 dark:text-white">
                  £{unitCost.toFixed(2)}
                </dd>
              </div>

              <div className="py-3 flex items-center justify-between">
                <dt className="text-slate-500 dark:text-neutral-400">Client Service Charge (Billing Rate)</dt>
                <dd className="font-mono font-bold text-blue-700 dark:text-blue-400">
                  £{serviceCharge.toFixed(2)}
                </dd>
              </div>

              <div className="py-3 flex items-center justify-between">
                <dt className="text-slate-500 dark:text-neutral-400">Gross Margin per Unit</dt>
                <dd className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                  £{unitMargin.toFixed(2)} ({marginPct}%)
                </dd>
              </div>

              <div className="py-3 flex items-center justify-between">
                <dt className="text-slate-500 dark:text-neutral-400">Current Stock Asset Valuation</dt>
                <dd className="font-mono font-bold text-slate-900 dark:text-white">
                  £{totalStockValuation.toFixed(2)}
                </dd>
              </div>

              <div className="py-3 flex items-center justify-between">
                <dt className="text-slate-500 dark:text-neutral-400">Potential Retail Billing Value</dt>
                <dd className="font-mono font-bold text-indigo-700 dark:text-indigo-400">
                  £{potentialRevenue.toFixed(2)}
                </dd>
              </div>

              <div className="py-3 flex items-center justify-between">
                <dt className="text-slate-500 dark:text-neutral-400">Active Revenue Generated</dt>
                <dd className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                  £{totalRevenue.toFixed(2)}
                </dd>
              </div>

              <div className="py-3 flex items-center justify-between">
                <dt className="text-slate-500 dark:text-neutral-400">Lifetime Units Consumed</dt>
                <dd className="font-bold text-slate-900 dark:text-white">
                  {totalQuantityUsed} unit{totalQuantityUsed === 1 ? '' : 's'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {/* ── TAB 5: Monthly Consumption Activity & Velocity ──────────────────── */}
      {activeTab === 'analytics' && (
        <div className="space-y-5">
          <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xs dark:border-white/10 dark:bg-surface-900">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FiBarChart2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Monthly Inflow vs Outflow</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
                  Restock top-ups versus repair consumption across the last {MONTHS_SHOWN} calendar months.
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-bold">
                <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400">
                  <span className="h-3 w-3 rounded-md bg-blue-500" />
                  <span>Restocked (+units)</span>
                </div>
                <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                  <span className="h-3 w-3 rounded-md bg-rose-500" />
                  <span>Used in Repairs (-units)</span>
                </div>
              </div>
            </div>

            {/* Visual Bar Chart */}
            <div className="flex items-end gap-3 sm:gap-6 pt-6" style={{ height: 180 }}>
              {monthlyBreakdown.map((m) => (
                <div key={m.key} className="flex flex-1 flex-col items-center gap-2 h-full justify-end">
                  <div className="flex h-full w-full items-end justify-center gap-1.5 sm:gap-2">
                    {/* Restocked Bar */}
                    <div className="relative group w-1/2 max-w-[28px] h-full flex items-end justify-center">
                      <div
                        className="w-full rounded-t-lg bg-gradient-to-t from-blue-600 to-blue-400 transition-all duration-300 hover:brightness-110"
                        style={{ height: `${Math.max(m.restocked > 0 ? 8 : 2, (m.restocked / maxMonthly) * 100)}%` }}
                      />
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-7 text-[10px] font-mono font-bold bg-slate-900 text-white rounded-md px-1.5 py-0.5 pointer-events-none whitespace-nowrap shadow-xs">
                        +{m.restocked} restocked
                      </span>
                    </div>

                    {/* Used Bar */}
                    <div className="relative group w-1/2 max-w-[28px] h-full flex items-end justify-center">
                      <div
                        className="w-full rounded-t-lg bg-gradient-to-t from-rose-600 to-rose-400 transition-all duration-300 hover:brightness-110"
                        style={{ height: `${Math.max(m.used > 0 ? 8 : 2, (m.used / maxMonthly) * 100)}%` }}
                      />
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-7 text-[10px] font-mono font-bold bg-slate-900 text-white rounded-md px-1.5 py-0.5 pointer-events-none whitespace-nowrap shadow-xs">
                        -{m.used} used
                      </span>
                    </div>
                  </div>

                  <span className="text-[11px] font-bold text-slate-700 dark:text-neutral-300 whitespace-nowrap">
                    {m.label}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 dark:text-neutral-500 whitespace-nowrap">
                    +{m.restocked} / -{m.used}
                  </span>
                </div>
              ))}
            </div>

            {/* Velocity & Stock Run-rate Insights */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-100 pt-5 dark:border-white/5">
              <div className="rounded-2xl bg-slate-50 p-3.5 dark:bg-surface-850 border border-slate-100 dark:border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Average Monthly Consumption
                </span>
                <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">
                  {avgMonthlyBurnRate} units / month
                </p>
                <span className="text-[10px] text-slate-500">Based on past 6 months</span>
              </div>

              <div className="rounded-2xl bg-slate-50 p-3.5 dark:bg-surface-850 border border-slate-100 dark:border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Stock Depletion Projection
                </span>
                <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">
                  {monthsOfSupplyRemaining === '∞' ? 'Ample Supply' : `~${monthsOfSupplyRemaining} months`}
                </p>
                <span className="text-[10px] text-slate-500">Estimated stock runway</span>
              </div>

              <div className="rounded-2xl bg-slate-50 p-3.5 dark:bg-surface-850 border border-slate-100 dark:border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Total 6-Month Inflow / Outflow
                </span>
                <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">
                  +{monthlyBreakdown.reduce((s, m) => s + m.restocked, 0)} / -{totalUsedLast6Months}
                </p>
                <span className="text-[10px] text-slate-500">Net movement</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Restock Modal ───────────────────────────────────────────────────── */}
      {restocking && (
        <Modal
          title="Restock Inventory"
          description={`Record fresh stock receipt for "${part.name}".`}
          onClose={() => setRestocking(false)}
        >
          <RestockForm
            part={part}
            onSaved={() => {
              setRestocking(false);
              load();
            }}
            onCancel={() => setRestocking(false)}
          />
        </Modal>
      )}

      {/* ── Edit Part Details Modal ─────────────────────────────────────────── */}
      {editing && (
        <Modal
          title="Edit Part Specifications"
          description={`Update details, SKU, and unit costs for "${part.name}".`}
          onClose={() => setEditing(false)}
        >
          <PartForm
            part={part}
            onSaved={() => {
              setEditing(false);
              load();
            }}
            onCancel={() => setEditing(false)}
          />
        </Modal>
      )}

      {/* ── Delete Part Modal ───────────────────────────────────────────────── */}
      {deleting && (
        <ConfirmModal
          title="Delete Part"
          message={`Are you sure you want to delete "${part.name}"? Note that if this part has already been used in recorded repairs, it cannot be deleted.`}
          confirmWord="delete"
          confirmLabel="Delete Part"
          requireTyping={false}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleting(false)}
        />
      )}
    </div>
  );
}

export default PartDetailPage;
