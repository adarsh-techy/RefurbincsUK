import { useEffect, useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  FiTruck,
  FiClock,
  FiTool,
  FiCheckCircle,
  FiXCircle,
  FiAlertTriangle,
  FiRepeat,
  FiArrowRight,
  FiSearch,
  FiCpu,
  FiShield,
  FiLayers,
} from 'react-icons/fi';
import apiClient from '../../services/api-client';
import PageHeader from '../../components/ui/primitives/PageHeader';
import TableState from '../../components/ui/table/TableState';
import StatCard from '../../components/ui/primitives/StatCard';
import DataTable from '../../components/ui/table/DataTable';
import TruckVerifyModal from './TruckVerifyModal';

function isThisMonth(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

/**
 * Derives the exact stage, visual styling, icon, and explanation for a battery
 * based on truck arrival status and battery lifecycle state.
 */
function getBatteryStageInfo(battery, isTruckPending) {
  const status = battery?.status || 'registered';
  const hasPendingPartsToRemove =
    Number(battery?.pending_parts_count || 0) > 0 ||
    battery?.is_passed_back ||
    battery?.status === 'passed_to_remove' ||
    battery?.status === 'passed_for_part_removal';

  if (isTruckPending) {
    return {
      key: 'pending_arrival',
      category: 'pending_arrival',
      label: 'Pending Arrival',
      sublabel: 'Packed on truck · Awaiting arrival scan',
      icon: FiTruck,
      badgeClass: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200',
      dotClass: 'bg-amber-500 ring-2 ring-amber-400/40',
      stepText: 'Stage 1 of 4: In Transit',
    };
  }

  // If battery has parts pending removal (passed back from testing / marked to remove parts)
  if (hasPendingPartsToRemove && ['in_repair', 'registered', 'new', 'passed_to_remove', 'passed_for_part_removal'].includes(status)) {
    return {
      key: 'passed_to_remove',
      category: 'passed_to_remove',
      label: 'Passed to Remove Parts',
      sublabel: null,
      icon: FiTool,
      badgeClass: 'border-amber-400 bg-amber-100/90 text-amber-950 dark:border-amber-600/70 dark:bg-amber-950/60 dark:text-amber-100',
      dotClass: 'bg-amber-600 ring-2 ring-amber-400/40 animate-pulse',
      stepText: 'Action Required: Part Removal',
    };
  }

  switch (status) {
    case 'repaired':
      return {
        key: 'repaired',
        category: 'repaired',
        label: 'Repair Completed',
        sublabel: 'Tested & QA passed · Ready for client dispatch',
        icon: FiCheckCircle,
        badgeClass: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700/60 dark:bg-emerald-950/40 dark:text-emerald-200',
        dotClass: 'bg-emerald-500 ring-2 ring-emerald-400/40',
        stepText: 'Stage 3 of 4: Completed',
      };

    case 'returned':
      return {
        key: 'returned',
        category: 'returned',
        label: 'Returned to Client',
        sublabel: 'Dispatched back to client',
        icon: FiTruck,
        badgeClass: 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-700/60 dark:bg-sky-950/40 dark:text-sky-200',
        dotClass: 'bg-sky-500 ring-2 ring-sky-400/40',
        stepText: 'Stage 4 of 4: Returned',
      };

    case 'in_progress':
      return {
        key: 'in_progress',
        category: 'in_progress',
        label: 'Repair In Progress',
        sublabel: 'Active repair underway on technician bench',
        icon: FiTool,
        badgeClass: 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700/60 dark:bg-blue-950/40 dark:text-blue-200',
        dotClass: 'bg-blue-500 animate-pulse ring-2 ring-blue-400/40',
        stepText: 'Stage 2 of 4: On Bench',
      };

    case 'in_testing':
    case 'testing':
    case 'repair_testing':
      return {
        key: 'in_testing',
        category: 'in_progress',
        label: 'In Testing & QA',
        sublabel: 'Diagnostic QA inspection & voltage testing',
        icon: FiShield,
        badgeClass: 'border-purple-300 bg-purple-50 text-purple-900 dark:border-purple-700/60 dark:bg-purple-950/40 dark:text-purple-200',
        dotClass: 'bg-purple-500 animate-pulse ring-2 ring-purple-400/40',
        stepText: 'Stage 2 of 4: QA Testing',
      };

    case 'unserviceable':
    case 'tested_parts_removed':
    case 'unserviceable_parts_removed':
      return {
        key: 'unserviceable',
        category: 'unserviceable',
        label: 'Unserviceable',
        sublabel: status.includes('parts_removed') ? 'QA Test Failed · Parts restocked' : 'Inspection / QA test failed',
        icon: FiXCircle,
        badgeClass: 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-700/60 dark:bg-rose-950/40 dark:text-rose-200',
        dotClass: 'bg-rose-500 ring-2 ring-rose-400/40',
        stepText: 'Terminated: Unserviceable',
      };

    case 'recycled':
      return {
        key: 'recycled',
        category: 'unserviceable',
        label: 'Sent for Recycling',
        sublabel: 'Scrapped for scrap recycling materials',
        icon: FiLayers,
        badgeClass: 'border-slate-400 bg-slate-100 text-slate-800 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-300',
        dotClass: 'bg-slate-500 ring-2 ring-slate-400/40',
        stepText: 'Terminated: Recycled',
      };

    case 'in_repair':
    case 'registered':
    case 'new':
    default:
      return {
        key: 'queued',
        category: 'queued',
        label: 'Queued for Repair',
        sublabel: 'Verified at workshop · Awaiting technician claim',
        icon: FiClock,
        badgeClass: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200',
        dotClass: 'bg-amber-500 ring-2 ring-amber-400/40',
        stepText: 'Stage 2 of 4: In Queue',
      };
  }
}

function TruckIntakeDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiClient
      .get(`/truck-intakes/${id}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const { intake, batteries = [] } = data || { intake: {}, batteries: [] };
  const isPending = intake?.status === 'pending_arrival';

  // Accurate Stage Counts
  const counts = useMemo(() => {
    let queued = 0;
    let passedToRemove = 0;
    let inProgress = 0;
    let testing = 0;
    let completed = 0;
    let returned = 0;
    let unserviceable = 0;

    batteries.forEach((b) => {
      const stage = getBatteryStageInfo(b, isPending);
      if (stage.category === 'passed_to_remove') passedToRemove++;
      else if (stage.category === 'queued') queued++;
      else if (stage.category === 'in_progress') {
        inProgress++;
        if (stage.key === 'in_testing') testing++;
      }
      else if (stage.category === 'repaired') completed++;
      else if (stage.category === 'returned') returned++;
      else if (stage.category === 'unserviceable') unserviceable++;
    });

    return {
      total: batteries.length,
      pending: isPending ? batteries.length : 0,
      queued,
      passedToRemove,
      inProgress,
      testing,
      activeRepair: inProgress,
      completed,
      returned,
      unserviceable,
    };
  }, [batteries, isPending]);

  const filteredBatteries = useMemo(() => {
    if (!batteries) return [];
    return batteries.filter((b) => {
      const stage = getBatteryStageInfo(b, isPending);

      // Status filter tab logic
      if (statusFilter !== 'all') {
        if (statusFilter === 'pending_arrival' && stage.category !== 'pending_arrival') return false;
        if (statusFilter === 'passed_to_remove' && stage.category !== 'passed_to_remove') return false;
        if (statusFilter === 'queued' && stage.category !== 'queued') return false;
        if (statusFilter === 'in_progress' && stage.category !== 'in_progress') return false;
        if (statusFilter === 'completed' && stage.category !== 'repaired') return false;
        if (statusFilter === 'returned' && stage.category !== 'returned') return false;
        if (statusFilter === 'unserviceable' && stage.category !== 'unserviceable') return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const code = (b.battery_code || '').toLowerCase();
        const serial = (b.serial_number || '').toLowerCase();
        const parts = (b.last_repaired_parts || '').toLowerCase();
        const stageLabel = (stage.label || '').toLowerCase();
        const stageSub = (stage.sublabel || '').toLowerCase();

        if (
          !code.includes(q) &&
          !serial.includes(q) &&
          !parts.includes(q) &&
          !stageLabel.includes(q) &&
          !stageSub.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [batteries, isPending, statusFilter, searchQuery]);

  if (loading) return <TableState>Loading truck intake details…</TableState>;
  if (error) {
    return (
      <div>
        <Link to="/truck-intakes" className="mb-4 inline-block text-sm text-brand-700 hover:underline dark:text-emerald-400">
          ← Back to Intake
        </Link>
        <TableState tone="error">{error}</TableState>
      </div>
    );
  }

  return (
    <div>
      <Link
        to="/truck-intakes"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline dark:text-emerald-400"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path
            fillRule="evenodd"
            d="M12.79 5.23a.75.75 0 0 1 0 1.06L9.06 10l3.73 3.71a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
            clipRule="evenodd"
          />
        </svg>
        Back to Truck Intakes
      </Link>

      <PageHeader
        title={
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-normal text-slate-400 dark:text-neutral-500">Truck Intake</span>
            <span className="font-mono font-black text-slate-900 dark:text-neutral-100">{intake.truck_number}</span>
            {isPending ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
                <FiClock className="h-3 w-3 animate-spin text-amber-600" />
                Pending Arrival Scan
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:border-emerald-700/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                <FiCheckCircle className="h-3 w-3 text-emerald-600" />
                Arrival Verified
              </span>
            )}
          </div>
        }
        description={
          <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs text-slate-600 dark:text-neutral-300">
            <span className="flex items-center gap-1.5">
              <span className="text-slate-400 dark:text-neutral-500">Driver:</span>
              <strong className="font-bold text-slate-800 dark:text-neutral-200">{intake.driver_name || '—'}</strong>
            </span>
            {intake.client_name && (
              <span className="flex items-center gap-1.5">
                <span className="text-slate-400 dark:text-neutral-500">Client:</span>
                <strong className="font-bold text-blue-700 dark:text-blue-400">{intake.client_name}</strong>
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span className="text-slate-400 dark:text-neutral-500">Intake Date:</span>
              <strong className="font-bold text-slate-800 dark:text-neutral-200">
                {new Date(intake.intake_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-slate-400 dark:text-neutral-500">Time:</span>
              <strong className="font-bold text-slate-800 dark:text-neutral-200">
                {new Date(intake.intake_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </strong>
            </span>
          </div>
        }
      />

      {/* Arrival Alert Banner */}
      {isPending ? (
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50/90 p-4 shadow-xs dark:border-amber-800/60 dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-200/80 text-lg shadow-2xs dark:bg-amber-900/60">
              🚚
            </span>
            <div>
              <h3 className="text-sm font-bold text-amber-950 dark:text-amber-100 flex items-center gap-2">
                Truck In Transit — Pending Arrival Verification
                <span className="rounded-full bg-amber-200/70 px-2 py-0.5 text-[10px] font-black uppercase text-amber-900 dark:bg-amber-900/80 dark:text-amber-200">
                  {batteries.length} Batteries Expected
                </span>
              </h3>
              <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
                These batteries are registered on this shipment and will move into the workshop queue once scanned & verified off the truck.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setVerifyModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition-all hover:bg-emerald-700 active:scale-95 dark:bg-emerald-600 dark:hover:bg-emerald-500 cursor-pointer"
            >
              <FiCheckCircle className="h-4 w-4" />
              <span>Scan to Verify Arrival</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-2.5 text-xs font-semibold text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <FiCheckCircle className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>
              All batteries verified and received at workshop on{' '}
              <strong>{new Date(intake.verified_at || intake.intake_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>
            </span>
          </div>
          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
            {batteries.length} Total Verified
          </span>
        </div>
      )}

      {/* Verification Modal */}
      {verifyModalOpen && (
        <TruckVerifyModal
          intakeId={id}
          initialData={data}
          onClose={() => setVerifyModalOpen(false)}
          onSuccess={() => {
            apiClient.get(`/truck-intakes/${id}`).then((res) => setData(res.data));
            setVerifyModalOpen(false);
          }}
        />
      )}

      {/* Clear KPI / Stage Stat Cards in Single Beautiful Line */}
      <div className="mb-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-flow-col lg:auto-cols-fr gap-2.5">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-2.5 sm:p-3 text-left transition-all duration-200 cursor-pointer focus:outline-hidden ${
            statusFilter === 'all'
              ? 'border-blue-500 bg-gradient-to-br from-blue-100 via-blue-50 to-indigo-50 shadow-md ring-2 ring-blue-500/80 scale-[1.02] dark:border-blue-400 dark:from-blue-900/50 dark:via-blue-950/40 dark:to-surface-900'
              : 'border-blue-200/80 bg-gradient-to-br from-blue-50/70 via-white to-indigo-50/40 hover:border-blue-300 hover:shadow-xs hover:scale-[1.01] dark:border-blue-900/40 dark:from-blue-950/20 dark:via-surface-900 dark:to-indigo-950/20'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-tight text-blue-900 dark:text-blue-300 truncate">
              Total on Truck
            </span>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/60 dark:text-blue-300">
              <FiLayers className="h-3 w-3" />
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-blue-950 dark:text-blue-100">
              {counts.total}
            </span>
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 opacity-80">
              Units
            </span>
          </div>
        </button>

        {isPending ? (
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'pending_arrival' ? 'all' : 'pending_arrival')}
            className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-2.5 sm:p-3 text-left transition-all duration-200 cursor-pointer focus:outline-hidden ${
              statusFilter === 'pending_arrival'
                ? 'border-amber-500 bg-gradient-to-br from-amber-100 via-amber-50 to-yellow-50 shadow-md ring-2 ring-amber-500/80 scale-[1.02] dark:border-amber-400 dark:from-amber-900/50 dark:via-amber-950/40 dark:to-surface-900'
                : 'border-amber-200/80 bg-gradient-to-br from-amber-50/70 via-white to-yellow-50/40 hover:border-amber-300 hover:shadow-xs hover:scale-[1.01] dark:border-amber-900/40 dark:from-amber-950/20 dark:via-surface-900 dark:to-yellow-950/20'
            }`}
          >
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-tight text-amber-900 dark:text-amber-300 truncate">
                Pending Arrival
              </span>
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/60 dark:text-amber-300">
                <FiClock className="h-3 w-3 animate-spin" />
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-amber-950 dark:text-amber-100">
                {counts.pending}
              </span>
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 opacity-80">
                In Transit
              </span>
            </div>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'queued' ? 'all' : 'queued')}
            className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-2.5 sm:p-3 text-left transition-all duration-200 cursor-pointer focus:outline-hidden ${
              statusFilter === 'queued'
                ? 'border-amber-500 bg-gradient-to-br from-amber-100 via-amber-50 to-yellow-50 shadow-md ring-2 ring-amber-500/80 scale-[1.02] dark:border-amber-400 dark:from-amber-900/50 dark:via-amber-950/40 dark:to-surface-900'
                : 'border-amber-200/80 bg-gradient-to-br from-amber-50/70 via-white to-yellow-50/40 hover:border-amber-300 hover:shadow-xs hover:scale-[1.01] dark:border-amber-900/40 dark:from-amber-950/20 dark:via-surface-900 dark:to-yellow-950/20'
            }`}
          >
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-tight text-amber-900 dark:text-amber-300 truncate">
                Queued for Repair
              </span>
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/60 dark:text-amber-300">
                <FiClock className="h-3 w-3" />
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-amber-950 dark:text-amber-100">
                {counts.queued}
              </span>
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 opacity-80">
                In Queue
              </span>
            </div>
          </button>
        )}

        {counts.passedToRemove > 0 && (
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'passed_to_remove' ? 'all' : 'passed_to_remove')}
            className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-2.5 sm:p-3 text-left transition-all duration-200 cursor-pointer focus:outline-hidden ${
              statusFilter === 'passed_to_remove'
                ? 'border-orange-500 bg-gradient-to-br from-orange-100 via-orange-50 to-amber-50 shadow-md ring-2 ring-orange-500/80 scale-[1.02] dark:border-orange-400 dark:from-orange-900/50 dark:via-orange-950/40 dark:to-surface-900'
                : 'border-orange-200/80 bg-gradient-to-br from-orange-50/70 via-white to-amber-50/40 hover:border-orange-300 hover:shadow-xs hover:scale-[1.01] dark:border-orange-900/40 dark:from-orange-950/20 dark:via-surface-900 dark:to-amber-950/20'
            }`}
          >
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-tight text-orange-900 dark:text-orange-300 truncate">
                Passed to Remove
              </span>
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-900/60 dark:text-orange-300">
                <FiTool className="h-3 w-3 animate-pulse" />
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-orange-950 dark:text-orange-100">
                {counts.passedToRemove}
              </span>
              <span className="text-[10px] font-bold text-orange-700 dark:text-orange-400 opacity-80">
                Rework
              </span>
            </div>
          </button>
        )}

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'in_progress' ? 'all' : 'in_progress')}
          className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-2.5 sm:p-3 text-left transition-all duration-200 cursor-pointer focus:outline-hidden ${
            statusFilter === 'in_progress'
              ? 'border-purple-500 bg-gradient-to-br from-purple-100 via-purple-50 to-indigo-50 shadow-md ring-2 ring-purple-500/80 scale-[1.02] dark:border-purple-400 dark:from-purple-900/50 dark:via-purple-950/40 dark:to-surface-900'
              : 'border-purple-200/80 bg-gradient-to-br from-purple-50/70 via-white to-indigo-50/40 hover:border-purple-300 hover:shadow-xs hover:scale-[1.01] dark:border-purple-900/40 dark:from-purple-950/20 dark:via-surface-900 dark:to-indigo-950/20'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-tight text-purple-900 dark:text-purple-300 truncate">
              In Progress & QA
            </span>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/60 dark:text-purple-300">
              <FiShield className="h-3 w-3" />
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-purple-950 dark:text-purple-100">
              {counts.activeRepair}
            </span>
            <span className="text-[10px] font-bold text-purple-700 dark:text-purple-400 opacity-80">
              On Bench
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')}
          className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-2.5 sm:p-3 text-left transition-all duration-200 cursor-pointer focus:outline-hidden ${
            statusFilter === 'completed'
              ? 'border-emerald-500 bg-gradient-to-br from-emerald-100 via-emerald-50 to-teal-50 shadow-md ring-2 ring-emerald-500/80 scale-[1.02] dark:border-emerald-400 dark:from-emerald-900/50 dark:via-emerald-950/40 dark:to-surface-900'
              : 'border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/40 hover:border-emerald-300 hover:shadow-xs hover:scale-[1.01] dark:border-emerald-900/40 dark:from-emerald-950/20 dark:via-surface-900 dark:to-teal-950/20'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-tight text-emerald-900 dark:text-emerald-300 truncate">
              Repair Completed
            </span>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-300">
              <FiCheckCircle className="h-3 w-3" />
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-emerald-950 dark:text-emerald-100">
              {counts.completed}
            </span>
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 opacity-80">
              Passed QA
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'returned' ? 'all' : 'returned')}
          className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-2.5 sm:p-3 text-left transition-all duration-200 cursor-pointer focus:outline-hidden ${
            statusFilter === 'returned'
              ? 'border-sky-500 bg-gradient-to-br from-sky-100 via-sky-50 to-cyan-50 shadow-md ring-2 ring-sky-500/80 scale-[1.02] dark:border-sky-400 dark:from-sky-900/50 dark:via-sky-950/40 dark:to-surface-900'
              : 'border-sky-200/80 bg-gradient-to-br from-sky-50/70 via-white to-cyan-50/40 hover:border-sky-300 hover:shadow-xs hover:scale-[1.01] dark:border-sky-900/40 dark:from-sky-950/20 dark:via-surface-900 dark:to-cyan-950/20'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-tight text-sky-900 dark:text-sky-300 truncate">
              Returned to Client
            </span>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-600 dark:bg-sky-900/60 dark:text-sky-300">
              <FiTruck className="h-3 w-3" />
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-sky-950 dark:text-sky-100">
              {counts.returned}
            </span>
            <span className="text-[10px] font-bold text-sky-700 dark:text-sky-400 opacity-80">
              Dispatched
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'unserviceable' ? 'all' : 'unserviceable')}
          className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-2.5 sm:p-3 text-left transition-all duration-200 cursor-pointer focus:outline-hidden ${
            statusFilter === 'unserviceable'
              ? 'border-rose-500 bg-gradient-to-br from-rose-100 via-rose-50 to-red-50 shadow-md ring-2 ring-rose-500/80 scale-[1.02] dark:border-rose-400 dark:from-rose-900/50 dark:via-rose-950/40 dark:to-surface-900'
              : 'border-rose-200/80 bg-gradient-to-br from-rose-50/70 via-white to-red-50/40 hover:border-rose-300 hover:shadow-xs hover:scale-[1.01] dark:border-rose-900/40 dark:from-rose-950/20 dark:via-surface-900 dark:to-red-950/20'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-tight text-rose-900 dark:text-rose-300 truncate">
              Unserviceable
            </span>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-900/60 dark:text-rose-300">
              <FiXCircle className="h-3 w-3" />
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-rose-950 dark:text-rose-100">
              {counts.unserviceable}
            </span>
            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 opacity-80">
              Scrap / Failed
            </span>
          </div>
        </button>
      </div>

      <div className="space-y-3.5">
        {/* Header & Filter Controls Bar */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-2">
              <span>Batteries from this Shipment</span>
              <span className="rounded-md bg-slate-200 px-2 py-0.5 text-xs font-black text-slate-700 dark:bg-surface-700 dark:text-neutral-300">
                {filteredBatteries.length}
                {filteredBatteries.length !== batteries.length && ` of ${batteries.length}`}
              </span>
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5">
              Live status and workshop pipeline stage of each individual battery delivered on truck {intake.truck_number}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative min-w-[220px] flex-1 sm:flex-initial">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search battery ID, serial, stage…"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 pl-8 text-xs font-medium text-slate-800 placeholder-slate-400 shadow-2xs transition-all focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-200 dark:placeholder-neutral-500"
              />
              <FiSearch className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-neutral-500" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:text-neutral-500 dark:hover:text-neutral-300 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Stage Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-surface-800/80">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs dark:bg-surface-700 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-neutral-200'
                }`}
              >
                All ({counts.total})
              </button>

              {isPending ? (
                <button
                  type="button"
                  onClick={() => setStatusFilter('pending_arrival')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                    statusFilter === 'pending_arrival'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-amber-700 dark:text-neutral-400 dark:hover:text-amber-400'
                  }`}
                >
                  Pending Arrival ({counts.pending})
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStatusFilter('queued')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                    statusFilter === 'queued'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-amber-700 dark:text-neutral-400 dark:hover:text-amber-400'
                  }`}
                >
                  In Queue ({counts.queued})
                </button>
              )}

              {counts.passedToRemove > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('passed_to_remove')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                    statusFilter === 'passed_to_remove'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-amber-700 dark:text-neutral-400 dark:hover:text-amber-400'
                  }`}
                >
                  Passed to Remove ({counts.passedToRemove})
                </button>
              )}

              <button
                type="button"
                onClick={() => setStatusFilter('in_progress')}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === 'in_progress'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-blue-700 dark:text-neutral-400 dark:hover:text-blue-400'
                }`}
              >
                In Progress & QA ({counts.activeRepair})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('completed')}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === 'completed'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-emerald-700 dark:text-neutral-400 dark:hover:text-emerald-400'
                }`}
              >
                Completed ({counts.completed})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('returned')}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === 'returned'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-sky-700 dark:text-neutral-400 dark:hover:text-sky-400'
                }`}
              >
                Returned ({counts.returned})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('unserviceable')}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === 'unserviceable'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-rose-700 dark:text-neutral-400 dark:hover:text-rose-400'
                }`}
              >
                Unserviceable ({counts.unserviceable})
              </button>
            </div>

            {(statusFilter !== 'all' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('all');
                  setSearchQuery('');
                }}
                className="rounded-xl border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-600 shadow-2xs hover:bg-slate-50 dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-300 dark:hover:bg-surface-700 cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Battery Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 shadow-2xs dark:border-surface-700">
          <DataTable
            headerColor="blue"
            showRowNumber
            bordered={false}
            maxHeight="520px"
            emptyMessage={
              statusFilter !== 'all' || searchQuery
                ? 'No batteries found matching the current search or stage filter.'
                : 'No batteries recorded for this intake.'
            }
            columns={[
              {
                key: 'battery_code',
                label: 'Battery ID',
                render: (b) => {
                  const isRepeat = Number(b.intake_count_this_month) > 1;
                  return (
                    <div className="py-1">
                      <div className="flex items-center gap-1.5">
                        <Link
                          to={`/batteries/${b.battery_code}`}
                          className="font-mono font-bold text-sm text-blue-700 hover:underline dark:text-blue-400 flex items-center gap-1"
                        >
                          {b.battery_code}
                        </Link>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {b.serial_number ? (
                          <span className="font-mono text-[11px] text-slate-500 dark:text-neutral-400">
                            SN: <strong className="text-slate-700 dark:text-neutral-300">{b.serial_number}</strong>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 dark:text-neutral-500">No SN</span>
                        )}
                        {isRepeat && (
                          <span className="inline-flex items-center gap-1 rounded-sm bg-rose-100 px-1.5 py-0.2 text-[10px] font-bold text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                            <FiRepeat className="h-2.5 w-2.5" />
                            {b.intake_count_this_month}x this month
                          </span>
                        )}
                      </div>
                    </div>
                  );
                },
              },
              {
                key: 'exact_stage',
                label: 'Status',
                render: (b) => {
                  const stage = getBatteryStageInfo(b, isPending);
                  const Icon = stage.icon;
                  return (
                    <div className="py-1">
                      <div className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${stage.badgeClass}`}>
                        <span className={`h-2 w-2 shrink-0 rounded-full ${stage.dotClass}`} />
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span>{stage.label}</span>
                      </div>
                    </div>
                  );
                },
              },
              {
                key: 'last_repaired_at',
                label: 'Previous Service History',
                render: (b) => {
                  if (!b.last_repaired_at) {
                    return (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-neutral-500 font-medium">
                        First Time Intake
                      </span>
                    );
                  }
                  const repairedThisMonth = isThisMonth(b.last_repaired_at);
                  return (
                    <div className="text-xs max-w-xs">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={
                            repairedThisMonth
                              ? 'font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1'
                              : 'font-medium text-slate-700 dark:text-neutral-300'
                          }
                        >
                          {repairedThisMonth && <FiAlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />}
                          {new Date(b.last_repaired_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        {repairedThisMonth && (
                          <span className="rounded-sm bg-rose-100 px-1 py-0.2 text-[9px] font-black text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 uppercase">
                            Recent
                          </span>
                        )}
                      </div>
                      {b.last_repaired_parts && (
                        <div className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5 truncate" title={b.last_repaired_parts}>
                          Parts: <span className="font-semibold text-slate-700 dark:text-neutral-300">{b.last_repaired_parts}</span>
                        </div>
                      )}
                    </div>
                  );
                },
              },
              {
                key: 'actions',
                label: 'Action',
                render: (b) => (
                  <Link
                    to={`/batteries/${b.battery_code}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700 shadow-2xs hover:border-blue-300 hover:bg-blue-50/70 dark:border-surface-700 dark:bg-surface-800 dark:text-blue-400 dark:hover:bg-surface-700 transition-all"
                  >
                    <span>Inspect</span>
                    <FiArrowRight className="h-3 w-3" />
                  </Link>
                ),
              },
            ]}
            rows={filteredBatteries}
          />
        </div>
      </div>
    </div>
  );
}

export default TruckIntakeDetailPage;
