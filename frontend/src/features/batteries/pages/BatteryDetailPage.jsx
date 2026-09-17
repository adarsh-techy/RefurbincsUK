import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link, useNavigate, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import apiClient from '../../../services/api-client';
import { socket } from '../../../services/socket-client';
import PageHeader from '../../../components/ui/primitives/PageHeader';
import Modal from '../../../components/ui/overlays/Modal';
import TableState from '../../../components/ui/table/TableState';
import { StatusBadge, ClientStatusBadge } from '../../../components/ui/primitives/Badge';
import StatCard from '../../../components/ui/primitives/StatCard';
import TechnicianRepairPanel from '../technician/TechnicianRepairPanel';
import ImageLightboxModal from '../../../components/ui/overlays/ImageLightboxModal';
import { resolveImageUrl } from '../../../utils/image-url';
import formatDuration from '../../../utils/format-duration';
import {
  FiPackage,
  FiTruck,
  FiTool,
  FiCheckCircle,
  FiAlertTriangle,
  FiDownload,
  FiPrinter,
  FiLayers,
  FiCalendar,
  FiExternalLink,
  FiShield,
  FiCpu,
  FiActivity,
  FiArrowLeft,
  FiGrid,
  FiChevronDown,
  FiChevronUp,
  FiZap,
  FiCheck,
  FiStar,
} from 'react-icons/fi';
import RatingModal from '../../../components/feedback/RatingModal';

const STATUS_ACCENT = {
  in_repair: 'border-warning-500',
  in_progress: 'border-critical-500',
  in_testing: 'border-purple-500',
  testing: 'border-purple-500',
  repair_testing: 'border-purple-500',
  repaired: 'border-brand-500',
  returned: 'border-info-500',
};

const STATUS_ICON_BG = {
  in_repair: 'bg-warning-100 text-warning-700 dark:bg-amber-500/15 dark:text-amber-300',
  in_progress: 'bg-critical-100 text-critical-700 dark:bg-red-500/15 dark:text-red-300',
  in_testing: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
  testing: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
  repair_testing: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
  repaired: 'bg-brand-100 text-brand-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  returned: 'bg-info-100 text-info-700 dark:bg-sky-500/15 dark:text-sky-300',
};

const STATUS_BANNER_BG = {
  in_repair: 'from-amber-50 to-white dark:from-amber-500/15 dark:to-surface-950',
  in_progress: 'from-red-50 to-white dark:from-red-500/15 dark:to-surface-950',
  in_testing: 'from-purple-50 to-white dark:from-purple-500/15 dark:to-surface-950',
  testing: 'from-purple-50 to-white dark:from-purple-500/15 dark:to-surface-950',
  repair_testing: 'from-purple-50 to-white dark:from-purple-500/15 dark:to-surface-950',
  repaired: 'from-emerald-50 to-white dark:from-emerald-500/15 dark:to-surface-950',
  returned: 'from-sky-50 to-white dark:from-sky-500/15 dark:to-surface-950',
};

const EVENT_META = {
  intake: {
    label: 'Intake',
    dot: 'bg-slate-100 text-slate-600 dark:bg-surface-700 dark:text-neutral-300',
    icon: (
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h7A1.5 1.5 0 0 1 13 6.5V8h1.379a1.5 1.5 0 0 1 1.06.44l2.122 2.12A1.5 1.5 0 0 1 18 11.622V13.5a1.5 1.5 0 0 1-1.5 1.5H16a2 2 0 1 1-4 0H8a2 2 0 1 1-4 0h-.5A1.5 1.5 0 0 1 2 13.5v-6A1.5 1.5 0 0 1 3.5 6H3v.5ZM14 9.5v3h2.5v-1.878L14.379 9.5H14ZM6 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm8 0a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" />
    ),
  },
  repair: {
    label: 'Repair',
    dot: 'bg-brand-100 text-brand-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    icon: (
      <path
        fillRule="evenodd"
        d="M14.279 2.152a.75.75 0 0 1 .07 1.058l-2.487 2.85 1.278 1.279 2.85-2.488a.75.75 0 0 1 1.058.07 4.5 4.5 0 0 1-5.048 6.965l-4.5 4.949a2.121 2.121 0 1 1-3-3l4.949-4.5a4.5 4.5 0 0 1 6.965-5.048 4.462 4.462 0 0 1 .865-1.135ZM4.5 15a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"
        clipRule="evenodd"
      />
    ),
  },
  return: {
    label: 'Returned',
    dot: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
    icon: (
      <path
        fillRule="evenodd"
        d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z"
        clipRule="evenodd"
      />
    ),
  },
  issue: {
    label: 'Reported Unserviceable',
    dot: 'bg-critical-100 text-critical-700 dark:bg-red-500/15 dark:text-red-300',
    icon: (
      <path
        fillRule="evenodd"
        d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
        clipRule="evenodd"
      />
    ),
  },
  service: {
    label: 'Testing Service',
    dot: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
    icon: (
      <path
        fillRule="evenodd"
        d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-2.625 6c-.54 0-.828.419-.936.634a1.96 1.96 0 0 0-.189.866c0 .298.059.605.189.866.108.215.395.634.936.634.54 0 .828-.419.936-.634.13-.26.189-.568.189-.866 0-.298-.059-.605-.189-.866-.108-.215-.396-.634-.936-.634Zm5.25 0c-.54 0-.828.419-.936.634a1.96 1.96 0 0 0-.189.866c0 .298.059.605.189.866.108.215.395.634.936.634.54 0 .828-.419.936-.634.13-.26.189-.568.189-.866 0-.298-.059-.605-.189-.866-.108-.215-.396-.634-.936-.634Z"
        clipRule="evenodd"
      />
    ),
  },
  part_removed: {
    label: 'Part Removed & Restocked',
    dot: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    icon: (
      <path
        fillRule="evenodd"
        d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.09 3.05 14.5 3.447 14.5 3.978v.255a49.19 49.19 0 0 0-5 0v-.255c0-.53.41-.928.864-.952ZM10 9.75a.75.75 0 0 1 .75.75v6a.75.75 0 0 1-1.5 0v-6a.75.75 0 0 1 .75-.75Zm4.5.75a.75.75 0 0 0-1.5 0v6a.75.75 0 0 0 1.5 0v-6Z"
        clipRule="evenodd"
      />
    ),
  },
};

function buildEvents(visits, history, returns, issues, services = []) {
  const events = [];

  visits.forEach((v) => {
    events.push({
      key: `intake-${v.visit_id}`,
      type: 'intake',
      date: v.intake_at,
      primary: `Truck ${v.truck_number} · Driver ${v.driver_name}`,
    });
  });

  history.forEach((h) => {
    const isRemoved = !!h.removed_at;
    const partCost = Number(h.price) + Number(h.labor_charge || 0);

    events.push({
      key: `repair-${h.id}`,
      type: 'repair',
      date: h.repaired_at,
      primary: `${h.part_name} · by ${h.staff_name}${isRemoved ? ' (Removed)' : ''}`,
      price: isRemoved ? 0 : partCost,
      originalPrice: partCost,
      notes: h.notes,
      durationSeconds: h.duration_seconds != null ? Number(h.duration_seconds) : null,
      isRemoved,
    });

    if (h.removed_at) {
      events.push({
        key: `removed-${h.id}`,
        type: 'part_removed',
        date: h.removed_at,
        primary: `${h.part_name} · Removed by ${h.removed_by_staff_name || 'Workshop Staff'}`,
        notes: `Restocked to inventory (-£${partCost.toFixed(2)})`,
        price: -partCost,
        isDeduction: true,
        removedByStaffName: h.removed_by_staff_name,
      });
    }
  });

  services.forEach((s) => {
    events.push({
      key: `service-${s.id}`,
      type: 'service',
      date: s.completed_at,
      primary: `${s.service_name}${s.staff_name ? ` · by ${s.staff_name}` : ''}`,
      price: Number(s.rate || 0),
      notes: s.notes,
    });
  });

  returns.forEach((r) => {
    events.push({
      key: `return-${r.id}`,
      type: 'return',
      date: r.returned_at,
      primary: `Truck ${r.truck_number} · Driver ${r.driver_name}`,
    });
  });

  issues.forEach((iss) => {
    events.push({
      key: `issue-${iss.id}`,
      type: 'issue',
      date: iss.reported_at,
      primary: `${iss.reason_label} · by ${iss.staff_name}`,
      notes: iss.note,
      photos: iss.photo_urls || [],
    });
  });

  return events.sort((a, b) => new Date(a.date) - new Date(b.date));
}

const PROCESS_STEPS = ['Intake', 'Repair In Progress', 'Testing & QA', 'Repair Completed', 'Returned to Client'];
const STATUS_STEP_INDEX = { in_repair: 0, in_progress: 1, in_testing: 2, testing: 2, repair_testing: 2, repaired: 3, returned: 4 };

const UNSERVICEABLE_STEPS = ['Intake', 'In Progress', 'Unserviceable', 'Recycled'];
const UNSERVICEABLE_STATUS_STEP_INDEX = { in_repair: 0, in_progress: 1, unserviceable: 2, recycled: 3 };
const UNSERVICEABLE_DANGER_INDEX = 2;

function ProcessStepper({ isOngoing, batteryStatus }) {
  const isUnserviceableFlow =
    isOngoing && (batteryStatus === 'unserviceable' || batteryStatus === 'recycled');
  const steps = isUnserviceableFlow ? UNSERVICEABLE_STEPS : PROCESS_STEPS;
  const stepIndex = isUnserviceableFlow ? UNSERVICEABLE_STATUS_STEP_INDEX : STATUS_STEP_INDEX;

  const threshold = isOngoing ? stepIndex[batteryStatus] ?? 0 : steps.length - 1;

  const stepState = steps.map((_, i) => {
    if (i <= threshold) return 2; // done
    if (i === threshold + 1) return 1; // current / next action
    return 0; // pending
  });

  return (
    <div className="flex items-center">
      {steps.map((label, i) => {
        const state = stepState[i];
        const isDanger = isUnserviceableFlow && i >= UNSERVICEABLE_DANGER_INDEX && state > 0;
        return (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  isDanger
                    ? 'bg-critical-600 text-white dark:bg-red-500'
                    : state === 2
                      ? 'bg-brand-600 text-white dark:bg-emerald-500'
                      : state === 1
                        ? 'border-2 border-brand-600 text-brand-600 dark:border-emerald-500 dark:text-emerald-400'
                        : 'bg-slate-100 text-slate-400 dark:bg-surface-700 dark:text-neutral-500'
                }`}
              >
                {state === 2 ? '✓' : i + 1}
              </span>
              <span
                className={`text-xs font-medium whitespace-nowrap ${
                  state === 0
                    ? 'text-slate-400 dark:text-neutral-500'
                    : 'text-slate-700 dark:text-neutral-200'
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span
                className={`mx-2 mb-5 h-0.5 flex-1 rounded ${
                  state !== 2
                    ? 'bg-slate-200 dark:bg-surface-700'
                    : isDanger
                      ? 'bg-critical-600 dark:bg-red-500'
                      : 'bg-brand-600 dark:bg-emerald-500'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function buildCycles(events) {
  const cycles = [];
  let current = [];

  for (const event of events) {
    current.push(event);
    if (event.type === 'return') {
      cycles.push(current);
      current = [];
    }
  }
  if (current.length > 0) cycles.push(current);

  return cycles;
}

// ── CLIENT-SPECIFIC ELEGANT, VIBRANT & INTERACTIVE BATTERY VIEW ────────────
function ClientBatteryDetailView({ battery, history = [], returns = [], visits = [], issues = [], services = [], qrDataUrl, onDownloadQr, onReload }) {
  const navigate = useNavigate();
  const [showRatingModal, setShowRatingModal] = useState(false);

  // An unserviceable battery's fitted parts are being reclaimed back to
  // inventory (see Parts Pending Removal), not staying in the battery — so
  // the client shouldn't see them listed as a completed service visit.
  const isUnserviceableForHistory = battery.status === 'unserviceable' || battery.status === 'recycled';

  // Distinct repair cycles / batches
  const repairBatches = {};
  (isUnserviceableForHistory ? [] : history).forEach((h) => {
    const key = h.batch_id || `batch-${h.id}`;
    if (!repairBatches[key]) {
      repairBatches[key] = {
        batchId: key,
        date: h.repaired_at,
        parts: [],
        notes: h.notes,
      };
    }
    if (h.part_name && !repairBatches[key].parts.includes(h.part_name)) {
      repairBatches[key].parts.push(h.part_name);
    }
  });
  const serviceVisitsList = Object.values(repairBatches).sort((a, b) => new Date(b.date) - new Date(a.date));

  // State to track which maintenance visit cards are expanded
  const [expandedBatches, setExpandedBatches] = useState(() => {
    const initial = new Set();
    if (serviceVisitsList.length > 0) {
      initial.add(serviceVisitsList[0].batchId);
    }
    return initial;
  });

  const toggleBatch = (batchId) => {
    setExpandedBatches((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) {
        next.delete(batchId);
      } else {
        next.add(batchId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedBatches(new Set(serviceVisitsList.map((v) => v.batchId)));
  };

  const collapseAll = () => {
    setExpandedBatches(new Set());
  };

  // Helper for component tag styling
  const getPartBadgeStyle = (partName) => {
    const lower = (partName || '').toLowerCase();
    if (lower.includes('bms') || lower.includes('circuit') || lower.includes('controller') || lower.includes('pcb') || lower.includes('board')) {
      return 'bg-indigo-50 text-indigo-700 border-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/50';
    }
    if (lower.includes('cell') || lower.includes('lithium') || lower.includes('pack') || lower.includes('module')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50';
    }
    if (lower.includes('wire') || lower.includes('harness') || lower.includes('cable') || lower.includes('terminal')) {
      return 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50';
    }
    if (lower.includes('case') || lower.includes('housing') || lower.includes('cover') || lower.includes('enclosure') || lower.includes('fuse')) {
      return 'bg-cyan-50 text-cyan-700 border-cyan-200/80 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800/50';
    }
    return 'bg-violet-50 text-violet-700 border-violet-200/80 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800/50';
  };

  // Determine Client-Friendly Status
  const isReturned = battery.status === 'returned';
  const isInService = battery.status === 'in_progress' || battery.status === 'in_testing' || battery.status === 'repaired';
  const isPacked = battery.status === 'in_repair';
  const isUnserviceable = battery.status === 'unserviceable' || battery.status === 'recycled';

  // Client Status Stepper Configuration
  const CLIENT_STEPS = [
    { key: 'packed', label: 'Intake & Logging', desc: 'Received at workshop facility', icon: FiPackage, color: 'from-amber-500 to-orange-500' },
    { key: 'in_progress', label: 'Cell & BMS Service', desc: 'Precision repair & restoration', icon: FiTool, color: 'from-blue-500 to-cyan-500' },
    { key: 'in_testing', label: 'Safety & Bench Testing', desc: 'Capacity & load cycle verification', icon: FiActivity, color: 'from-indigo-500 to-purple-500' },
    { key: 'repaired', label: 'Restoration Certified', desc: 'Quality approved & packed', icon: FiCheckCircle, color: 'from-emerald-500 to-teal-500' },
    { key: 'returned', label: 'Active in Fleet', desc: 'Delivered & in operational rotation', icon: FiShield, color: 'from-emerald-600 to-teal-600' },
  ];

  let currentStepIdx = 0;
  if (battery.status === 'in_repair') currentStepIdx = 0;
  else if (battery.status === 'in_progress') currentStepIdx = 1;
  else if (battery.status === 'in_testing') currentStepIdx = 2;
  else if (battery.status === 'repaired') currentStepIdx = 3;
  else if (battery.status === 'returned') currentStepIdx = 4;
  else if (isUnserviceable) currentStepIdx = 1;

  const latestReturn = returns?.[0] || null;
  const latestIntake = visits?.[0] || null;

  const allExpanded = serviceVisitsList.length > 0 && expandedBatches.size === serviceVisitsList.length;

  return (
    <div className="space-y-6 pb-12">
      {/* ── Top Navigation Bar ──────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/my/batteries/all'))}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200/80 hover:bg-slate-50 hover:border-slate-300 dark:bg-white/5 dark:text-neutral-200 dark:border-white/10 dark:hover:bg-white/10 shadow-xs transition-all cursor-pointer"
        >
          <FiArrowLeft className="w-4 h-4 text-emerald-500" />
          <span>Back to Fleet Overview</span>
        </button>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200/80 hover:bg-slate-50 dark:bg-white/5 dark:text-neutral-200 dark:border-white/10 dark:hover:bg-white/10 shadow-xs transition-all cursor-pointer"
          >
            <FiPrinter className="w-3.5 h-3.5 text-slate-400" />
            <span>Print Report</span>
          </button>
          {qrDataUrl && (
            <button
              type="button"
              onClick={onDownloadQr}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-xs transition-all cursor-pointer"
            >
              <FiDownload className="w-3.5 h-3.5" />
              <span>Download QR</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Battery Hero Header (Vibrant Gradient Mesh, No Client Name) ─ */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-emerald-50/20 to-teal-50/30 p-6 sm:p-8 shadow-sm dark:border-white/10 dark:from-surface-900 dark:via-surface-900/90 dark:to-surface-950">
        {/* Glow ambient background orbs */}
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-slate-900 text-white dark:bg-white/15 dark:text-white shadow-xs">
                <FiZap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>Battery Asset</span>
              </span>
              <ClientStatusBadge status={battery.status} />
              {battery.battery_type && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/50">
                  {battery.battery_type}
                </span>
              )}
            </div>

            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
                {battery.battery_code}
              </h1>
              {battery.serial_number && (
                <p className="mt-1.5 text-sm font-mono font-semibold text-slate-500 dark:text-neutral-400 flex items-center gap-2">
                  <span>Serial No:</span>
                  <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-surface-800 font-bold text-slate-800 dark:text-neutral-200 border border-slate-200/60 dark:border-white/10">
                    {battery.serial_number}
                  </span>
                </p>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-neutral-400 flex-wrap">
              <span className="inline-flex items-center gap-1.5">
                <FiCalendar className="w-3.5 h-3.5 text-emerald-500" />
                <span>Enrolled in Fleet: <strong>{battery.created_at ? new Date(battery.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</strong></span>
              </span>
              {battery.last_service_date && (
                <span className="inline-flex items-center gap-1.5">
                  <FiTool className="w-3.5 h-3.5 text-blue-500" />
                  <span>Last Service: <strong>{new Date(battery.last_service_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></span>
                </span>
              )}
              {isReturned && !battery.already_rated && (
                <button
                  type="button"
                  onClick={() => setShowRatingModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 border border-amber-300 hover:bg-amber-100 dark:bg-amber-950/50 dark:border-amber-900/50 dark:text-amber-300 transition-colors shadow-2xs cursor-pointer"
                >
                  <FiStar className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>Rate Service Quality</span>
                </button>
              )}
              {isReturned && battery.already_rated && (
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 border border-slate-200 dark:bg-white/5 dark:border-white/10 dark:text-neutral-400">
                  <FiStar className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>Rated — Thank You!</span>
                </span>
              )}
            </div>
          </div>

          {/* Scannable Tag QR Card */}
          {qrDataUrl && (
            <div className="shrink-0 flex items-center gap-4 bg-white/90 dark:bg-surface-800 p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-sm backdrop-blur-sm">
              <img
                src={qrDataUrl}
                alt={`QR code for ${battery.battery_code}`}
                className="w-20 h-20 rounded-xl object-contain bg-white p-1 border border-slate-100 dark:border-white/10 shadow-2xs"
              />
              <div className="text-xs space-y-1.5">
                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <FiGrid className="w-4 h-4 text-emerald-500" />
                  <span>Depot QR Tag</span>
                </span>
                <p className="text-[11px] text-slate-500 dark:text-neutral-400 max-w-[140px] leading-relaxed">
                  Fast scan for workshop intake, dispatch & fleet custody checks.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 4 Colorful Client KPI Metric Cards ───────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Operational Status (Emerald) */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-5 shadow-xs dark:border-emerald-500/20 dark:bg-surface-900 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Fleet Status
            </span>
            <span className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <FiShield className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4">
            <div className="flex items-center gap-2">
              <span
                className={`h-3 w-3 rounded-full ${
                  isReturned
                    ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                    : isInService
                      ? 'bg-blue-500 animate-pulse shadow-sm shadow-blue-500/50'
                      : isPacked
                        ? 'bg-amber-500 shadow-sm shadow-amber-500/50'
                        : 'bg-rose-500'
                }`}
              />
              <span className="text-base font-extrabold text-slate-900 dark:text-white">
                {isReturned
                  ? 'Operational in Fleet'
                  : isPacked
                    ? 'Packed for Workshop'
                    : isInService
                      ? 'In Workshop Service'
                      : 'Unserviceable'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-1">Live custody verification</p>
          </div>
        </div>

        {/* Card 2: Service Cycles (Indigo) */}
        <div className="relative overflow-hidden rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent p-5 shadow-xs dark:border-indigo-500/20 dark:bg-surface-900 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
              Service Visits
            </span>
            <span className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <FiTool className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-indigo-950 dark:text-indigo-200 font-mono">
              {serviceVisitsList.length}
            </span>
            <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-1">
              {serviceVisitsList.length === 1 ? '1 Completed maintenance round' : `${serviceVisitsList.length} Completed maintenance rounds`}
            </p>
          </div>
        </div>

        {/* Card 3: Components Restored (Violet) */}
        <div className="relative overflow-hidden rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent p-5 shadow-xs dark:border-violet-500/20 dark:bg-surface-900 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-violet-700 dark:text-violet-400">
              Restored Parts
            </span>
            <span className="w-8 h-8 rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <FiCpu className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-violet-950 dark:text-violet-200 font-mono">
              {history.length}
            </span>
            <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-1">
              Subsystems refurbished & tested
            </p>
          </div>
        </div>

        {/* Card 4: Verification & Transport (Amber/Cyan) */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-5 shadow-xs dark:border-amber-500/20 dark:bg-surface-900 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Fleet Custody
            </span>
            <span className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <FiTruck className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4">
            <div className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900 dark:text-white">
              {isReturned ? (
                <>
                  <FiCheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Delivered to Client</span>
                </>
              ) : (
                <>
                  <FiActivity className="w-4 h-4 text-blue-500 shrink-0 animate-pulse" />
                  <span>In Workshop Cycle</span>
                </>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-1">
              {latestReturn?.truck_number ? `Delivered via Truck ${latestReturn.truck_number}` : 'Transport log synchronized'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Interactive Visual Service Lifecycle Stepper ────────────── */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs dark:border-white/10 dark:bg-surface-900">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-white/10">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FiActivity className="w-4 h-4 text-emerald-500" />
              <span>Service Lifecycle & Diagnostic Stages</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
              Refurbishment progress from workshop intake to capacity benchmark and fleet delivery.
            </p>
          </div>
          <span className="px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50 shadow-2xs">
            Cycle #{serviceVisitsList.length > 0 ? serviceVisitsList.length : 1}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5">
          {CLIENT_STEPS.map((step, idx) => {
            const isCompleted = idx < currentStepIdx || (idx === currentStepIdx && isReturned);
            const isCurrent = idx === currentStepIdx && !isReturned;
            const Icon = step.icon;

            return (
              <div
                key={step.key}
                className={`relative flex flex-col p-4 rounded-2xl border transition-all ${
                  isCompleted
                    ? 'border-emerald-300/80 bg-gradient-to-b from-emerald-50/80 to-teal-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/20 shadow-2xs'
                    : isCurrent
                      ? 'border-blue-400 bg-gradient-to-b from-blue-50/90 to-indigo-50/40 dark:border-blue-700/70 dark:bg-blue-950/30 ring-2 ring-blue-500/20 shadow-xs'
                      : 'border-slate-100 bg-slate-50/40 dark:border-white/5 dark:bg-white/2 opacity-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <span
                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition-transform ${
                      isCompleted
                        ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-2xs'
                        : isCurrent
                          ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-xs animate-pulse scale-105'
                          : 'bg-slate-200 text-slate-400 dark:bg-white/10 dark:text-neutral-500'
                    }`}
                  >
                    {isCompleted ? <FiCheck className="w-4 h-4 stroke-[3]" /> : <Icon className="w-4 h-4" />}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 font-mono">
                    0{idx + 1}
                  </span>
                </div>
                <h3 className="font-bold text-xs text-slate-900 dark:text-white">{step.label}</h3>
                <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5 leading-snug">{step.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Maintenance & Component Restoration Log (Card-Wise + Expandable) ─ */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs dark:border-white/10 dark:bg-surface-900 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-white/10">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FiTool className="w-4 h-4 text-emerald-500" />
              <span>Maintenance & Component Service History</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
              Card-by-card breakdown of refurbished components, restoration notes, and diagnostic records.
            </p>
          </div>

          {serviceVisitsList.length > 0 && (
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold text-slate-600 dark:text-neutral-300 bg-slate-100 dark:bg-white/10 px-3 py-1 rounded-xl">
                {serviceVisitsList.length} {serviceVisitsList.length === 1 ? 'Service Visit' : 'Service Visits'}
              </span>
              <button
                type="button"
                onClick={allExpanded ? collapseAll : expandAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40 transition-colors cursor-pointer"
              >
                {allExpanded ? (
                  <>
                    <FiChevronUp className="w-3.5 h-3.5" />
                    <span>Collapse All</span>
                  </>
                ) : (
                  <>
                    <FiChevronDown className="w-3.5 h-3.5" />
                    <span>Expand All</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {serviceVisitsList.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 space-y-2">
            <FiCheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="text-sm font-bold text-slate-800 dark:text-neutral-200">No Repairs Required</p>
            <p className="text-xs text-slate-400 dark:text-neutral-500 max-w-md mx-auto">
              This battery is operating in original factory state with no component replacements recorded.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {serviceVisitsList.map((visit, index) => {
              const isExpanded = expandedBatches.has(visit.batchId);
              const visitNumber = serviceVisitsList.length - index;

              return (
                <div
                  key={visit.batchId}
                  className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                    isExpanded
                      ? 'border-emerald-300/80 bg-gradient-to-b from-slate-50/90 to-white dark:border-emerald-800/50 dark:from-surface-850 dark:to-surface-900 shadow-sm'
                      : 'border-slate-200/80 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-surface-900 dark:hover:border-white/20'
                  }`}
                >
                  {/* ── Expandable Card Header (Click to Toggle) ── */}
                  <div
                    onClick={() => toggleBatch(visit.batchId)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 cursor-pointer select-none transition-colors hover:bg-slate-50/60 dark:hover:bg-white/5"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleBatch(visit.batchId);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="px-3 py-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-black tracking-wide shadow-2xs">
                        Service Visit #{visitNumber}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-neutral-300">
                        <FiCalendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {visit.date
                            ? new Date(visit.date).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '—'}
                        </span>
                      </span>
                      <span className="text-xs text-slate-400 dark:text-neutral-500">
                        • {visit.parts.length} {visit.parts.length === 1 ? 'component serviced' : 'components serviced'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40">
                        <FiCheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Certified Restoration</span>
                      </span>

                      <div className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-neutral-300">
                        <span>{isExpanded ? 'Hide Details' : 'View Details'}</span>
                        <FiChevronDown
                          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                            isExpanded ? 'rotate-180 text-emerald-500' : ''
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* ── Expanded Card Body ── */}
                  {isExpanded && (
                    <div className="p-4 sm:p-6 border-t border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-surface-850 space-y-4">
                      {/* Restored Components List */}
                      <div>
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-neutral-400 mb-2.5 flex items-center gap-1.5">
                          <FiLayers className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Restored & Calibrated Subsystems:</span>
                        </h4>
                        <div className="flex flex-wrap gap-2.5">
                          {visit.parts.map((part) => (
                            <span
                              key={part}
                              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border shadow-2xs transition-all ${getPartBadgeStyle(
                                part
                              )}`}
                            >
                              <FiCpu className="w-4 h-4 shrink-0 opacity-80" />
                              <span>{part}</span>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Work Notes / Summary */}
                      {visit.notes && (
                        <div>
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-neutral-400 mb-2 flex items-center gap-1.5">
                            <FiActivity className="w-3.5 h-3.5 text-blue-500" />
                            <span>Service Diagnosis & Work Notes:</span>
                          </h4>
                          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-800 border border-slate-200/70 dark:border-white/10 text-xs text-slate-700 dark:text-neutral-300 leading-relaxed">
                            {visit.notes}
                          </div>
                        </div>
                      )}

                      {/* Certification Assurance Box */}
                      <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/30 flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-200 font-medium">
                          <FiCheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            {services && services.length > 0 ? (
                              <>
                                Full verified services completed:{' '}
                                {services.map((s, i) => (
                                  <span key={s.id || i}>
                                    <strong>{s.service_name}</strong>
                                    {i < services.length - 1 ? ', ' : ''}
                                  </span>
                                ))}
                                .
                              </>
                            ) : (
                              <>Full multi-point testing & quality assurance verified.</>
                            )}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          Refurbishment ID: {visit.batchId.slice(0, 16)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Logistics & Fleet Transport Record (Vibrant Cards) ──────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Workshop Intake Logistics */}
        <div className="rounded-3xl border border-blue-200/80 bg-gradient-to-br from-blue-50/40 via-white to-white p-6 shadow-xs dark:border-blue-900/40 dark:from-blue-950/20 dark:via-surface-900 dark:to-surface-900 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <span className="w-7 h-7 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <FiTruck className="w-4 h-4" />
            </span>
            <span>Workshop Collection & Intake</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-white/10">
              <span className="text-slate-400 dark:text-neutral-400">Truck Number:</span>
              <span className="font-mono font-bold text-slate-800 dark:text-neutral-200">
                {battery.intake_truck_number || latestIntake?.truck_number || '—'}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-white/10">
              <span className="text-slate-400 dark:text-neutral-400">Collection Driver:</span>
              <span className="font-semibold text-slate-800 dark:text-neutral-200">
                {battery.intake_driver_name || latestIntake?.driver_name || '—'}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-400 dark:text-neutral-400">Intake Logged On:</span>
              <span className="font-semibold text-slate-800 dark:text-neutral-200">
                {battery.intake_at || latestIntake?.intake_at
                  ? new Date(battery.intake_at || latestIntake?.intake_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                  : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Fleet Return Logistics */}
        <div className="rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/40 via-white to-white p-6 shadow-xs dark:border-emerald-900/40 dark:from-emerald-950/20 dark:via-surface-900 dark:to-surface-900 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <span className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <FiCheckCircle className="w-4 h-4" />
            </span>
            <span>Fleet Dispatch & Operational Return</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-white/10">
              <span className="text-slate-400 dark:text-neutral-400">Delivery Truck:</span>
              <span className="font-mono font-bold text-slate-800 dark:text-neutral-200">
                {latestReturn?.truck_number || (isReturned ? 'Fleet Delivered' : 'Pending Dispatch')}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-white/10">
              <span className="text-slate-400 dark:text-neutral-400">Delivery Driver:</span>
              <span className="font-semibold text-slate-800 dark:text-neutral-200">
                {latestReturn?.driver_name || (isReturned ? 'Verified Delivery' : '—')}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-400 dark:text-neutral-400">Delivered On:</span>
              <span className="font-semibold text-slate-800 dark:text-neutral-200">
                {latestReturn?.returned_at
                  ? new Date(latestReturn.returned_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                  : isReturned
                    ? 'In Fleet Operation'
                    : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {showRatingModal && (
        <RatingModal
          batteryCode={battery.battery_code}
          onClose={() => setShowRatingModal(false)}
          onSuccess={() => {
            setShowRatingModal(false);
            if (onReload) onReload();
          }}
        />
      )}
    </div>
  );
}

// ── MAIN BATTERY DETAIL PAGE ROUTER ──────────────────────────────────────────
function BatteryDetailPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const isTechnician = user?.role === 'technician';
  const isClient = user?.role === 'client';
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);

  // Battery Number assign / edit modal
  const [showSerialModal, setShowSerialModal] = useState(false);
  const [serialInput, setSerialInput] = useState('');
  const [serialInputRetype, setSerialInputRetype] = useState('');
  const [serialSaving, setSerialSaving] = useState(false);
  const [serialError, setSerialError] = useState(null);
  const [serialConfirmText, setSerialConfirmText] = useState('');
  const [submittingSerial, setSubmittingSerial] = useState(false);
  const [lightboxState, setLightboxState] = useState({
    isOpen: false,
    images: [],
    initialIndex: 0,
    title: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get(`/batteries/${encodeURIComponent(code)}`);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function handleUpdated(battery) {
      if (battery?.battery_code === code) load();
    }
    socket.on('battery:updated', handleUpdated);
    return () => socket.off('battery:updated', handleUpdated);
  }, [code, load]);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(`${window.location.origin}/batteries/${encodeURIComponent(code)}`, {
      width: 320,
      margin: 1,
    }).then((dataUrl) => {
      if (!cancelled) setQrDataUrl(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  function handleDownloadQr() {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `qr-${code}.png`;
    link.click();
  }

  function openSerialModal(battery) {
    setSerialInput(battery.serial_number || '');
    setSerialInputRetype(battery.serial_number || '');
    setSerialConfirmText('');
    setSerialError(null);
    setShowSerialModal(true);
  }

  async function handleSerialSave(battery) {
    if (serialInput.trim() && serialInput.trim() !== serialInputRetype.trim()) {
      setSerialError('The two battery numbers you typed don’t match. Please re-check and try again.');
      return;
    }
    setSerialSaving(true);
    setSerialError(null);
    try {
      await apiClient.patch(`/batteries/${battery.id}/serial-number`, {
        serialNumber: serialInput.trim(),
      });
      setShowSerialModal(false);
      load();
    } catch (err) {
      setSerialError(err.response?.data?.message || err.message);
    } finally {
      setSerialSaving(false);
    }
  }

  const fallbackBackTo = isClient ? '/my/batteries/all' : isTechnician ? '/my/dashboard' : isAdmin ? '/batteries' : null;
  const canShowBack = fallbackBackTo !== null;

  function handleBack() {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else if (fallbackBackTo) {
      navigate(fallbackBackTo);
    }
  }

  if (loading) return <TableState>Loading battery details & history…</TableState>;
  if (error) {
    return (
      <div>
        {canShowBack ? (
          <button
            type="button"
            onClick={handleBack}
            className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-emerald-400"
          >
            <FiArrowLeft className="h-4 w-4" />
            Back
          </button>
        ) : (
          <Link
            to="/login"
            className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-emerald-400"
          >
            ← Sign In
          </Link>
        )}
        <TableState tone="error">{error}</TableState>
      </div>
    );
  }

  const {
    battery,
    history = [],
    returns = [],
    visits = [],
    issues = [],
    services = [],
    recycleBatch,
    pendingPartsRemoval = [],
  } = result || {};

  // If viewed by client (or an unauthenticated QR scan), render the client view without internal workshop staff / prices
  if (isClient || (!user && battery)) {
    return (
      <ClientBatteryDetailView
        battery={battery}
        history={history}
        returns={returns}
        visits={visits}
        issues={issues}
        services={services}
        qrDataUrl={qrDataUrl}
        onDownloadQr={handleDownloadQr}
        onReload={load}
      />
    );
  }

  // ── ADMIN & TECHNICIAN INTERNAL VIEW ──────────────────────────────────────
  const cycles = buildCycles(buildEvents(visits || [], history || [], returns || [], issues || [], services || []));
  const totalSpent =
    (history || []).reduce(
      (sum, h) => (h.removed_at ? sum : sum + Number(h.price) + Number(h.labor_charge || 0)),
      0
    ) + (services || []).reduce((sum, s) => sum + Number(s.rate || 0), 0);
  const repairVisits = new Set((history || []).map((h) => h.batch_id)).size;
  // Every part logged in the same repair batch shares that batch's single
  // duration_seconds value (see repair.model.js's create()), so summing
  // per-row would multiply-count the same time spent once per part.
  const totalRepairDurationSeconds = Array.from(
    new Map((history || []).map((h) => [h.batch_id, h.duration_seconds])).values()
  ).reduce((sum, d) => sum + (Number(d) || 0), 0);
  const now = new Date();
  const repairVisitsThisMonth = new Set(
    (history || [])
      .filter((h) => {
        const d = new Date(h.repaired_at);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .map((h) => h.batch_id)
  ).size;

  return (
    <div>
      {canShowBack ? (
        <button
          type="button"
          onClick={handleBack}
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-emerald-400 cursor-pointer"
        >
          <FiArrowLeft className="h-4 w-4" />
          Back
        </button>
      ) : (
        <div className="mb-4 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Verified Battery Record
          </span>
          <span className="text-xs text-slate-400 dark:text-neutral-500">
            Scanned via QR Code
          </span>
        </div>
      )}

      <PageHeader title={battery.battery_code} description="Full intake-to-return history." />

      {showQrModal && (
        <Modal title={battery.battery_code} onClose={() => setShowQrModal(false)}>
          <div className="flex flex-col items-center">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR code for battery ${battery.battery_code}`}
                className="h-64 w-64 rounded-lg border border-slate-100 dark:border-surface-700"
              />
            ) : (
              <div className="flex h-64 w-64 items-center justify-center text-sm text-slate-400 dark:text-neutral-500">
                Generating…
              </div>
            )}
            {!isTechnician && battery.client_name && (
              <p className="mt-4 text-sm text-slate-500 dark:text-neutral-400">Client: {battery.client_name}</p>
            )}
            {battery.serial_number && (
              <p className="text-sm text-slate-500 dark:text-neutral-400">Battery Number: {battery.serial_number}</p>
            )}
            <button
              type="button"
              onClick={handleDownloadQr}
              disabled={!qrDataUrl}
              className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500 cursor-pointer"
            >
              Download PNG
            </button>
          </div>
        </Modal>
      )}

      <div
        className={`mb-6 flex flex-wrap items-center gap-4 rounded-xl border-l-4 border-y border-r border-slate-200 bg-gradient-to-r p-5 shadow-sm dark:border-y-white/10 dark:border-r-white/10 dark:bg-surface-900 ${STATUS_ACCENT[battery.status] || 'border-slate-300'} ${STATUS_BANNER_BG[battery.status] || 'from-white to-slate-50 dark:from-surface-900 dark:to-surface-950'}`}
      >
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${STATUS_ICON_BG[battery.status] || 'bg-slate-100 text-slate-500 dark:bg-surface-800 dark:text-neutral-300'}`}
        >
          <FiCpu className="h-6 w-6" />
        </span>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={battery.status} />
            {!isTechnician && battery.client_name && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-surface-800 dark:text-neutral-300">
                Client: {battery.client_name}
              </span>
            )}
            {battery.serial_number ? (
              <span
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  battery.serial_number_added_by_role === 'client'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-surface-800 dark:text-neutral-300'
                }`}
              >
                {battery.serial_number_added_by_role === 'client' && (
                  <FiShield className="h-3 w-3 text-amber-600" />
                )}
                Battery No: {battery.serial_number}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => openSerialModal(battery)}
                    title="Edit Battery Number"
                    className="ml-0.5 rounded text-slate-400 hover:text-slate-600 dark:text-neutral-500 dark:hover:text-neutral-300 cursor-pointer"
                  >
                    <FiTool className="h-3 w-3" />
                  </button>
                )}
              </span>
            ) : user && !isTechnician ? (
              <button
                type="button"
                onClick={() => openSerialModal(battery)}
                className="flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-xs font-medium text-slate-400 hover:border-blue-400 hover:text-blue-600 dark:border-white/20 dark:text-neutral-400 dark:hover:border-blue-500 dark:hover:text-blue-400 cursor-pointer"
              >
                + Assign Battery Number
              </button>
            ) : null}

            {battery.status === 'in_progress' && battery.started_by_name && (
              <span className="flex items-center gap-1 rounded-full bg-critical-100 px-2.5 py-0.5 text-xs font-medium text-critical-700 dark:bg-red-500/15 dark:text-red-300">
                Being worked on by {battery.started_by_name}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">
            Tracked since{' '}
            {battery.created_at ? new Date(battery.created_at).toLocaleDateString() : '—'}
          </p>
          {repairVisitsThisMonth > 1 && (
            <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-critical-600 dark:text-red-400">
              <FiAlertTriangle className="h-4 w-4" />
              Serviced {repairVisitsThisMonth} times this month — worth a closer look.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowQrModal(true)}
          title="View / download QR code"
          className="shrink-0 rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm transition-transform hover:scale-105 dark:border-white/10 dark:bg-surface-800 cursor-pointer"
        >
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR code for battery ${battery.battery_code}`}
              className="h-16 w-16 rounded-md bg-white p-0.5"
            />
          ) : (
            <div className="h-16 w-16 animate-pulse rounded-md bg-slate-100 dark:bg-surface-800" />
          )}
        </button>
      </div>

      {(battery.status === 'unserviceable' || battery.status === 'recycled') && result.issues?.[0] && (
        <div className="mb-6 rounded-xl border border-critical-200 bg-critical-50 p-5 dark:border-red-500/30 dark:bg-red-500/10 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex-1">
              <h2 className="mb-1 text-sm font-semibold text-critical-700 dark:text-red-300">
                {result.issues[0].reason_label}
              </h2>
              {result.issues[0].note && (
                <p className="mb-1 text-sm text-slate-600 dark:text-neutral-300">{result.issues[0].note}</p>
              )}
              <p className="text-xs text-slate-500 dark:text-neutral-500">
                Reported by {result.issues[0].staff_name} on{' '}
                {new Date(result.issues[0].reported_at).toLocaleString()}
              </p>
            </div>

            {result.issues[0].photo_urls && result.issues[0].photo_urls.length > 0 && (
              <div className="shrink-0 flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-critical-700 dark:text-red-300">
                  Photos ({result.issues[0].photo_urls.length})
                </span>
                <div className="flex items-center gap-2">
                  {result.issues[0].photo_urls.map((photo, pIdx) => (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() =>
                        setLightboxState({
                          isOpen: true,
                          images: result.issues[0].photo_urls,
                          initialIndex: pIdx,
                          title: `Issue Photos — ${result.battery.battery_code}`,
                        })
                      }
                      className="group relative h-14 w-14 overflow-hidden rounded-lg border border-red-200 bg-white dark:bg-surface-800 dark:border-red-800/60 shadow-xs transition hover:scale-105 hover:border-red-500"
                    >
                      <img
                        src={resolveImageUrl(photo)}
                        alt={`Issue Photo ${pIdx + 1}`}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 text-white text-xs">🔍</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {battery.status === 'recycled' && recycleBatch && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-surface-900">
          <h2 className="mb-1 text-sm font-semibold text-slate-700 dark:text-neutral-200">Sent for Recycling</h2>
          <p className="text-sm text-slate-600 dark:text-neutral-300">
            Vehicle <span className="font-medium">{recycleBatch.vehicle_number}</span> · Driver{' '}
            <span className="font-medium">{recycleBatch.driver_name}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-neutral-500">
            {new Date(recycleBatch.recycled_at).toLocaleString()} ·{' '}
            <Link to={`/recycle/${recycleBatch.id}`} className="text-blue-700 hover:underline dark:text-blue-400">
              View shipment
            </Link>
          </p>
        </div>
      )}

      {isTechnician && (
        <TechnicianRepairPanel
          battery={battery}
          pendingPartsRemoval={pendingPartsRemoval}
          onUpdated={load}
        />
      )}

      <div className={`mb-6 grid grid-cols-1 gap-4 ${isTechnician ? 'sm:grid-cols-3' : 'sm:grid-cols-4'}`}>
        <StatCard label="Repairs Logged" value={repairVisits} tone="good" />
        <StatCard label="Return Shipments" value={returns.length} tone="info" />
        <StatCard
          label="Total Repair Time"
          value={totalRepairDurationSeconds > 0 ? formatDuration(totalRepairDurationSeconds) : '—'}
          tone="info"
        />
        {!isTechnician && (
          <StatCard label="Total Price" value={`£${totalSpent.toFixed(2)}`} tone="warning" />
        )}
      </div>

      {cycles.length === 0 ? (
        <TableState>No history recorded for this battery yet.</TableState>
      ) : (
        <div className="flex flex-col gap-6">
          {cycles.map((cycle, i) => {
            const isOngoing = i === cycles.length - 1 && !cycle.some((e) => e.type === 'return');
            const isUnserviceableCycle =
              isOngoing && (battery.status === 'unserviceable' || battery.status === 'recycled');
            const cardTone = isUnserviceableCycle
              ? 'red'
              : !isOngoing
                ? 'blue'
                : battery.status === 'repaired'
                  ? 'green'
                  : 'amber';
            const cardLabel =
              cardTone === 'red'
                ? (battery.status === 'recycled' ? 'Recycled' : 'Unserviceable')
                : cardTone === 'amber'
                  ? 'With the Shop'
                  : cardTone === 'green'
                    ? 'Ready to Return'
                    : 'Completed';
            const TONE_CLASSES = {
              amber: {
                border: 'border-warning-500',
                bg: 'bg-warning-100 dark:bg-amber-500/15',
                text: 'text-warning-700 dark:text-amber-300',
              },
              green: {
                border: 'border-brand-500',
                bg: 'bg-green-100 dark:bg-emerald-500/15',
                text: 'text-green-800 dark:text-emerald-300',
              },
              blue: {
                border: 'border-info-500',
                bg: 'bg-info-100 dark:bg-sky-500/15',
                text: 'text-info-700 dark:text-sky-300',
              },
              red: {
                border: 'border-critical-500',
                bg: 'bg-critical-100 dark:bg-red-500/15',
                text: 'text-critical-700 dark:text-red-300',
              },
            };
            const tone = TONE_CLASSES[cardTone];
            const cycleTotal = cycle.reduce(
              (sum, event) => sum + (event.price !== undefined ? Number(event.price) : 0),
              0
            );
            return (
              <div
                key={cycle[0].key}
                className={`overflow-hidden rounded-xl border-l-4 border-y border-r border-slate-200 bg-white shadow-sm dark:border-y-white/10 dark:border-r-white/10 dark:bg-surface-900 ${tone.border}`}
              >
                <div className={`flex items-center justify-between px-5 py-3 ${tone.bg}`}>
                  <h2 className={`text-xs font-bold uppercase tracking-wider ${tone.text}`}>
                    Cycle {i + 1}
                  </h2>
                  <div className="flex items-center gap-2">
                    {!isTechnician && cycleTotal > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-bold text-brand-700 dark:bg-surface-800/80 dark:text-emerald-300">
                        £{cycleTotal.toFixed(2)}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-semibold dark:bg-surface-800/80 ${tone.text}`}
                    >
                      {cardLabel}
                    </span>
                  </div>
                </div>
                <div className="border-b border-slate-100 px-6 py-5 dark:border-white/10">
                  <ProcessStepper isOngoing={isOngoing} batteryStatus={battery.status} />
                </div>
                <div className="p-5">
                  <ol>
                    {cycle.map((event, idx) => {
                      const meta = EVENT_META[event.type];
                      const isLast = idx === cycle.length - 1;
                      return (
                        <li key={event.key} className="relative flex gap-4">
                          {!isLast && (
                            <span className="absolute left-4 top-9 bottom-0 w-px -translate-x-1/2 bg-slate-200 dark:bg-white/10" />
                          )}
                          <span
                            className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.dot}`}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              className="h-4 w-4"
                            >
                              {meta.icon}
                            </svg>
                          </span>
                          <div className={`min-w-0 flex-1 ${isLast ? 'pb-0' : 'pb-6'}`}>
                            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-slate-800 dark:text-neutral-100">
                                {meta.label}
                              </span>
                              <span className="text-xs text-slate-400 dark:text-neutral-500">
                                {new Date(event.date).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-neutral-300">{event.primary}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              {event.durationSeconds != null && (
                                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-white/5 dark:text-neutral-300">
                                  Time taken: {formatDuration(event.durationSeconds)}
                                </span>
                              )}
                              {!isTechnician && event.price !== undefined && (
                                <span
                                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                    event.isDeduction
                                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                                      : event.isRemoved
                                        ? 'bg-slate-100 text-slate-500 line-through dark:bg-white/10 dark:text-neutral-400'
                                        : 'bg-brand-50 text-brand-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                                  }`}
                                >
                                  {event.isDeduction
                                    ? `-£${Math.abs(Number(event.price)).toFixed(2)}`
                                    : `£${Number(event.price || event.originalPrice || 0).toFixed(2)}`}
                                </span>
                              )}
                              {event.notes && (
                                <span className="text-xs text-slate-400 dark:text-neutral-500">{event.notes}</span>
                              )}
                              {event.photos && event.photos.length > 0 && (
                                <div className="mt-2 flex items-center gap-2">
                                  {event.photos.map((photo, pIdx) => (
                                    <button
                                      key={pIdx}
                                      type="button"
                                      onClick={() =>
                                        setLightboxState({
                                          isOpen: true,
                                          images: event.photos,
                                          initialIndex: pIdx,
                                          title: `Issue Photos — ${battery.battery_code}`,
                                        })
                                      }
                                      className="group relative h-12 w-12 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-surface-800 shadow-2xs transition hover:scale-105 hover:border-blue-500 cursor-pointer"
                                    >
                                      <img
                                        src={resolveImageUrl(photo)}
                                        alt={`Issue ${pIdx + 1}`}
                                        className="h-full w-full object-cover"
                                      />
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Battery Number assign / edit modal */}
      {showSerialModal && (
        <Modal
          title={`Battery Number — ${battery.battery_code}`}
          onClose={() => {
            setShowSerialModal(false);
            setSerialError(null);
          }}
        >
          <div className="flex flex-col gap-4">
            {isAdmin && battery.serial_number && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                {battery.serial_number_added_by_role === 'client' ? (
                  <>
                    <strong>Client-set number:</strong> the client can no longer edit this themselves. Changing it
                    is an admin override — type <strong>CONFIRM</strong> below to unlock Save.
                  </>
                ) : (
                  <>
                    You're changing an existing Battery Number. Type <strong>CONFIRM</strong> below to unlock Save.
                  </>
                )}
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-neutral-200">
                Battery Number (manufacturer serial)
              </label>
              <input
                type="text"
                value={serialInput}
                onChange={(e) => setSerialInput(e.target.value)}
                placeholder="e.g. SN-88213"
                autoComplete="off"
                className="w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p className="mt-1.5 text-xs text-slate-500 dark:text-neutral-400">
                Leave blank to clear the Battery Number.
              </p>
            </div>
            {serialInput.trim() && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-neutral-200">
                  Re-type to Confirm
                </label>
                <input
                  type="text"
                  value={serialInputRetype}
                  onChange={(e) => setSerialInputRetype(e.target.value)}
                  placeholder="Type the battery number again"
                  autoComplete="off"
                  className="w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                />
                <p className="mt-1.5 text-xs text-slate-500 dark:text-neutral-400">Typed twice to catch typos.</p>
              </div>
            )}
            {isAdmin && battery.serial_number && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-neutral-200">
                  Type <span className="font-semibold text-amber-700 dark:text-amber-400">CONFIRM</span> to change it
                </label>
                <input
                  type="text"
                  value={serialConfirmText}
                  onChange={(e) => setSerialConfirmText(e.target.value)}
                  placeholder="CONFIRM"
                  autoComplete="off"
                  className="w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                />
              </div>
            )}
            {serialError && <p className="text-sm text-critical-600 dark:text-red-400">{serialError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowSerialModal(false);
                  setSerialError(null);
                }}
                className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-white/10 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSerialSave(battery)}
                disabled={
                  serialSaving ||
                  (serialInput.trim() && serialInput.trim() !== serialInputRetype.trim()) ||
                  (isAdmin && battery.serial_number && serialConfirmText.trim().toUpperCase() !== 'CONFIRM')
                }
                className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                {serialSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {lightboxState.isOpen && (
        <ImageLightboxModal
          images={lightboxState.images}
          initialIndex={lightboxState.initialIndex}
          title={lightboxState.title}
          onClose={() => setLightboxState({ isOpen: false, images: [], initialIndex: 0, title: '' })}
        />
      )}
    </div>
  );
}

export default BatteryDetailPage;
