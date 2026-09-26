import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link, useNavigate, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import apiClient from '../../../services/api-client';
import { isIntakeUnverified as intakeIsUnverified } from '../../../utils/permissions';
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
  FiCopy,
  FiXCircle,
  FiTrash2,
  FiCamera,
  FiRefreshCw,
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
    label: 'Diagnostic Fee',
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
  pass_back: {
    label: 'Passed to Technician (Rework)',
    dot: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    icon: (
      <path
        fillRule="evenodd"
        d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Z"
        clipRule="evenodd"
      />
    ),
  },
  recycle: {
    label: 'Sent for Recycling',
    dot: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    icon: (
      <path
        fillRule="evenodd"
        d="M4 4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2h5a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h1V4Zm3 6v6a1 1 0 0 0 2 0v-6a1 1 0 0 0-2 0Zm4 0v6a1 1 0 0 0 2 0v-6a1 1 0 0 0-2 0Z"
        clipRule="evenodd"
      />
    ),
  },
};

function buildEvents(visits = [], history = [], returns = [], issues = [], services = [], recycleBatch = null, battery = null) {
  const events = [];

  const allVisits = [...(visits || [])];
  if (allVisits.length === 0) {
    allVisits.push({
      visit_id: 'initial',
      truck_intake_id: battery?.truck_intake_id,
      truck_number: battery?.intake_truck_number,
      driver_name: battery?.intake_driver_name,
      intake_at: battery?.intake_at || battery?.created_at || new Date().toISOString(),
      status: battery?.intake_status || 'verified',
      verified_at: battery?.intake_verified_at || battery?.created_at,
    });
  }

  allVisits.forEach((v) => {
    const isVerified = v.status === 'verified' || !!v.verified_at;
    events.push({
      key: `intake-${v.visit_id || v.truck_intake_id || Math.random()}`,
      type: 'intake',
      date: v.intake_at,
      primary: `Truck ${v.truck_number || battery?.intake_truck_number || '—'} · Driver ${v.driver_name || battery?.intake_driver_name || '—'}`,
      truckNumber: v.truck_number || battery?.intake_truck_number,
      driverName: v.driver_name || battery?.intake_driver_name,
      isVerified,
      verifiedAt: v.verified_at,
      notes: isVerified ? 'Verified arrival at workshop' : 'Pending workshop verification',
    });
  });

  (history || []).forEach((h) => {
    const isRemoved = !!h.removed_at;
    const partCost = Number(h.price) + Number(h.labor_charge || 0);

    events.push({
      key: `repair-${h.id}`,
      type: 'repair',
      date: h.repaired_at,
      primary: `${h.part_name} (Qty ${h.quantity_used || 1}) · by ${h.staff_name || 'Technician'}${isRemoved ? ' (Removed & Restocked)' : ''}`,
      partName: h.part_name,
      quantityUsed: h.quantity_used || 1,
      staffName: h.staff_name,
      price: isRemoved ? 0 : partCost,
      originalPrice: partCost,
      partPrice: Number(h.price || 0),
      laborCharge: Number(h.labor_charge || 0),
      notes: h.notes,
      durationSeconds: h.duration_seconds != null ? Number(h.duration_seconds) : null,
      isRemoved,
    });

    if (h.removed_at) {
      events.push({
        key: `removed-${h.id}`,
        type: 'part_removed',
        date: h.removed_at,
        primary: `${h.part_name} · Restocked by ${h.removed_by_staff_name || 'Workshop Staff'}`,
        partName: h.part_name,
        notes: `Restocked to inventory (-£${partCost.toFixed(2)})`,
        price: 0,
        deductedPrice: partCost,
        isDeduction: true,
        removedByStaffName: h.removed_by_staff_name,
      });
    }
  });

  (services || []).forEach((s) => {
    const isPassBack = s.service_name === 'Passed back to Technician';
    const isDiagFee =
      !s.service_name ||
      s.service_name.toLowerCase().includes('diagnostic') ||
      s.service_name.toLowerCase().includes('fee') ||
      s.is_mandatory;

    events.push({
      key: `service-${s.id}`,
      type: isPassBack ? 'pass_back' : 'service',
      label: isPassBack ? 'Passed to Technician (Rework)' : isDiagFee ? 'Diagnostic Fee' : 'Testing Service',
      date: s.completed_at,
      primary: `${s.service_name}${s.staff_name ? ` · by ${s.staff_name}` : ''}`,
      serviceName: s.service_name,
      staffName: s.staff_name,
      price: Number(s.rate || 0),
      notes: s.notes,
    });
  });

  (issues || []).forEach((iss) => {
    events.push({
      key: `issue-${iss.id}`,
      type: 'issue',
      date: iss.reported_at,
      primary: `Issue: ${iss.reason_label || 'Unserviceable'} · by ${iss.staff_name || 'Workshop Staff'}`,
      reasonLabel: iss.reason_label,
      staffName: iss.staff_name,
      notes: iss.note,
      photos: iss.photo_urls || [],
    });
  });

  if (recycleBatch) {
    events.push({
      key: `recycle-${recycleBatch.id}`,
      type: 'recycle',
      date: recycleBatch.recycled_at,
      primary: `Vehicle ${recycleBatch.vehicle_number} · Driver ${recycleBatch.driver_name}`,
      vehicleNumber: recycleBatch.vehicle_number,
      driverName: recycleBatch.driver_name,
      recycleBatchId: recycleBatch.id,
      notes: recycleBatch.notes || 'Sent to material recycler',
    });
  }

  (returns || []).forEach((r) => {
    events.push({
      key: `return-${r.id}`,
      type: 'return',
      date: r.returned_at,
      primary: `Truck ${r.truck_number || '—'} · Driver ${r.driver_name || '—'}`,
      truckNumber: r.truck_number,
      driverName: r.driver_name,
    });
  });

  return events.sort((a, b) => new Date(a.date) - new Date(b.date));
}

function ProcessStepper({ isOngoing, batteryStatus, cycle, pendingPartsCount = 0 }) {
  const hasReturn = cycle.some((e) => e.type === 'return');
  const hasRecycle = cycle.some((e) => e.type === 'recycle');
  const hasIssue = cycle.some((e) => e.type === 'issue');
  const isUnserviceableFlow =
    hasIssue ||
    hasRecycle ||
    (isOngoing && ['unserviceable', 'tested_parts_removed', 'recycled'].includes(batteryStatus));

  if (isUnserviceableFlow) {
    const steps = [
      'Intake',
      'Diagnostic & Work',
      'Reported Unserviceable',
      'Parts Restocked',
      'Sent for Recycling',
    ];
    const hadPartsFitted = cycle.some((e) => e.type === 'repair');
    const partsRemoved = cycle.some((e) => e.type === 'part_removed');
    const isRecycled = hasRecycle || (isOngoing && batteryStatus === 'recycled');

    const stepStates = [
      2, // 1. Intake: done
      2, // 2. Diagnostic & Work: done
      2, // 3. Reported Unserviceable: done (danger red)
      hadPartsFitted
        ? partsRemoved || pendingPartsCount === 0
          ? 2
          : 1
        : 2, // 4. Parts Restocked: 2 if done or not needed, 1 if action required
      isRecycled ? 2 : 1, // 5. Recycling: 2 if sent, 1 if pending dispatch
    ];

    return (
      <div className="flex items-center overflow-x-auto pb-1">
        {steps.map((label, i) => {
          const state = stepStates[i];
          const isDangerStep = i === 2; // Reported Unserviceable
          const isWarningStep = i === 3 && state === 1; // Pending parts removal
          return (
            <div key={label} className="flex flex-1 items-center last:flex-none min-w-[120px]">
              <div className="flex flex-col items-center gap-1.5 text-center w-full">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    isDangerStep
                      ? 'bg-critical-600 text-white dark:bg-red-500 shadow-xs'
                      : isWarningStep
                        ? 'border-2 border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                        : state === 2
                          ? 'bg-brand-600 text-white dark:bg-emerald-500'
                          : state === 1
                            ? 'border-2 border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300 animate-pulse'
                            : 'bg-slate-100 text-slate-400 dark:bg-surface-700 dark:text-neutral-500'
                  }`}
                >
                  {state === 2 ? (isDangerStep ? '✕' : '✓') : i + 1}
                </span>
                <span
                  className={`text-xs font-medium whitespace-nowrap ${
                    isDangerStep
                      ? 'font-bold text-critical-700 dark:text-red-400'
                      : isWarningStep
                        ? 'font-bold text-amber-700 dark:text-amber-400'
                        : state === 2
                          ? 'text-slate-800 dark:text-neutral-200'
                          : state === 1
                            ? 'font-semibold text-blue-700 dark:text-blue-400'
                            : 'text-slate-400 dark:text-neutral-500'
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <span
                  className={`mx-2 mb-5 h-0.5 flex-1 rounded ${
                    i < 2
                      ? 'bg-brand-600 dark:bg-emerald-500'
                      : i === 2
                        ? 'bg-critical-600 dark:bg-red-500'
                        : isRecycled
                          ? 'bg-critical-600 dark:bg-red-500'
                          : 'bg-slate-200 dark:bg-surface-700'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Normal Repair Lifecycle
  const steps = ['Intake', 'Repair In Progress', 'Testing & QA', 'Repair Completed', 'Returned to Client'];
  let threshold = steps.length - 1;

  if (isOngoing) {
    if (batteryStatus === 'in_repair') threshold = 0;
    else if (batteryStatus === 'in_progress') threshold = 1;
    else if (['in_testing', 'testing', 'repair_testing'].includes(batteryStatus)) threshold = 2;
    else if (batteryStatus === 'repaired') threshold = 3;
    else if (batteryStatus === 'returned' || hasReturn) threshold = 4;
  }

  const stepStates = steps.map((_, i) => {
    if (i <= threshold) return 2; // done
    if (i === threshold + 1) return 1; // current / next action
    return 0; // pending
  });

  return (
    <div className="flex items-center overflow-x-auto pb-1">
      {steps.map((label, i) => {
        const state = stepStates[i];
        return (
          <div key={label} className="flex flex-1 items-center last:flex-none min-w-[120px]">
            <div className="flex flex-col items-center gap-1.5 text-center w-full">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  state === 2
                    ? 'bg-brand-600 text-white dark:bg-emerald-500'
                    : state === 1
                      ? 'border-2 border-brand-600 bg-brand-50 text-brand-700 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-300 animate-pulse'
                      : 'bg-slate-100 text-slate-400 dark:bg-surface-700 dark:text-neutral-500'
                }`}
              >
                {state === 2 ? '✓' : i + 1}
              </span>
              <span
                className={`text-xs font-medium whitespace-nowrap ${
                  state === 2
                    ? 'text-slate-800 dark:text-neutral-200'
                    : state === 1
                      ? 'font-bold text-brand-700 dark:text-emerald-400'
                      : 'text-slate-400 dark:text-neutral-500'
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span
                className={`mx-2 mb-5 h-0.5 flex-1 rounded ${
                  state === 2 && stepStates[i + 1] > 0
                    ? 'bg-brand-600 dark:bg-emerald-500'
                    : 'bg-slate-200 dark:bg-surface-700'
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
    if (event.type === 'intake' && current.length > 0 && current.some((e) => e.type === 'intake')) {
      cycles.push(current);
      current = [];
    }

    current.push(event);

    if (event.type === 'return' || event.type === 'recycle') {
      cycles.push(current);
      current = [];
    }
  }
  if (current.length > 0) cycles.push(current);

  return cycles;
}

// ── CLIENT & RECYCLED ELEGANT, VIBRANT & INTERACTIVE BATTERY VIEW ────────────
function ClientBatteryDetailView({
  battery,
  history = [],
  returns = [],
  visits = [],
  issues = [],
  services = [],
  recycleBatch = null,
  qrDataUrl,
  onDownloadQr,
  onReload,
  isAdmin = false,
  onEditSerial = null,
}) {
  const navigate = useNavigate();
  const authUser = useSelector((state) => state.auth.user);
  const isAdminRole = authUser?.role === 'admin';
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [lightboxState, setLightboxState] = useState({
    isOpen: false,
    images: [],
    initialIndex: 0,
    title: '',
  });

  const handleCopyCode = () => {
    if (!battery?.battery_code) return;
    navigator.clipboard.writeText(battery.battery_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // An unserviceable battery's fitted parts are being reclaimed back to
  // inventory, so the client shouldn't see them listed as a completed service visit.
  const isDecommissioned =
    battery.status === 'unserviceable' ||
    battery.status === 'tested_parts_removed' ||
    battery.status === 'recycled';

  // Distinct repair cycles / batches
  const repairBatches = {};
  (isDecommissioned ? [] : history).forEach((h) => {
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
  const isRecycled = battery.status === 'recycled';
  const isUnserviceable =
    (battery.status === 'unserviceable' || battery.status === 'tested_parts_removed') && !isRecycled;

  // Client Status Stepper Configuration for Standard Repairs
  const CLIENT_STEPS = [
    { key: 'packed', label: 'Intake & Logging', desc: 'Received at workshop facility', icon: FiPackage },
    { key: 'in_progress', label: 'Cell & BMS Service', desc: 'Precision repair & restoration', icon: FiTool },
    { key: 'in_testing', label: 'Safety & Bench Testing', desc: 'Capacity & load cycle verification', icon: FiActivity },
    { key: 'repaired', label: 'Restoration Certified', desc: 'Quality approved & packed', icon: FiCheckCircle },
    { key: 'returned', label: 'Active in Fleet', desc: 'Delivered & in operational rotation', icon: FiShield },
  ];

  // Unserviceable Stepper Configuration
  const UNSERVICEABLE_STEPS = [
    { key: 'intake', label: 'Intake & Logging', desc: 'Received at workshop facility', icon: FiPackage, state: 'done' },
    { key: 'inspection', label: 'Workshop Diagnostics', desc: 'Multi-point safety assessment', icon: FiActivity, state: 'done' },
    { key: 'bench_test', label: 'Safety & Load Testing', desc: 'Critical electrical defect identified', icon: FiXCircle, state: 'failed' },
    { key: 'unserviceable', label: 'Decommissioned Unit', desc: 'Fitted parts reclaimed to stock', icon: FiAlertTriangle, state: 'warning' },
    {
      key: 'recycle',
      label: 'Quarantine / Recycling',
      desc: 'Awaiting eco-recycling dispatch',
      icon: FiTrash2,
      state: 'active',
    },
  ];

  let currentStepIdx = 0;
  if (battery.status === 'in_repair') currentStepIdx = 0;
  else if (battery.status === 'in_progress') currentStepIdx = 1;
  else if (battery.status === 'in_testing') currentStepIdx = 2;
  else if (battery.status === 'repaired') currentStepIdx = 3;
  else if (battery.status === 'returned') currentStepIdx = 4;

  const latestReturn = returns?.[0] || null;
  const latestIntake = visits?.[0] || null;
  const latestIssue = issues?.[0] || null;

  // Diagnostic fee details
  const diagService = (services || []).find((s) =>
    !s.service_name ||
    s.service_name.toLowerCase().includes('diagnostic') ||
    s.service_name.toLowerCase().includes('fee') ||
    s.is_mandatory
  );
  // No hard-coded fallback: only show a fee that a battery_services row backs.
  const diagnosticFee = diagService ? Number(diagService.rate || 0) : null;
  const diagnosticFeeLabel = diagnosticFee == null ? 'Not configured' : `£${diagnosticFee.toFixed(2)}`;

  const allExpanded = serviceVisitsList.length > 0 && expandedBatches.size === serviceVisitsList.length;

  return (
    <div className="space-y-6 pb-12">
      {/* ── Top Navigation Bar ──────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <button
          type="button"
          onClick={() => {
            if (window.history.state?.idx > 0) {
              navigate(-1);
            } else if (isAdmin) {
              navigate('/batteries/recycled');
            } else {
              navigate('/my/batteries/all');
            }
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200/80 hover:bg-slate-50 hover:border-slate-300 dark:bg-white/5 dark:text-neutral-200 dark:border-white/10 dark:hover:bg-white/10 shadow-xs transition-all cursor-pointer"
        >
          <FiArrowLeft className="w-4 h-4 text-emerald-500" />
          <span>{isAdmin ? 'Back to Recycled Batteries' : 'Back to Fleet Overview'}</span>
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

      {/* ── Battery Hero Header (Vibrant Modern Mesh / Eco Recycled Banner) ────────────────── */}
      <div className={`relative overflow-hidden rounded-3xl border p-6 sm:p-8 shadow-sm backdrop-blur-sm ${
        isRecycled
          ? 'border-emerald-200/90 bg-gradient-to-br from-emerald-50/70 via-teal-50/40 to-slate-50/90 dark:border-emerald-800/40 dark:from-surface-900 dark:via-surface-900/95 dark:to-emerald-950/25'
          : isUnserviceable
            ? 'border-rose-200/80 bg-gradient-to-br from-rose-50/40 via-white to-amber-50/20 dark:border-rose-900/40 dark:from-surface-900 dark:via-surface-900/90 dark:to-surface-950'
            : 'border-slate-200/80 bg-gradient-to-br from-white via-emerald-50/20 to-teal-50/30 dark:border-white/10 dark:from-surface-900 dark:via-surface-900/90 dark:to-surface-950'
      }`}>
        {/* Glow ambient background orbs */}
        <div className={`absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl pointer-events-none ${
          isRecycled ? 'bg-emerald-500/15' : isUnserviceable ? 'bg-rose-500/10' : 'bg-emerald-500/10'
        }`} />
        <div className={`absolute -bottom-24 -left-24 w-72 h-72 rounded-full blur-3xl pointer-events-none ${
          isRecycled ? 'bg-teal-500/15' : 'bg-blue-500/10'
        }`} />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 flex-wrap">
              {isRecycled ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-600 text-white shadow-xs">
                  <FiRefreshCw className="w-3.5 h-3.5" />
                  <span>RECYCLED BATTERY</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-slate-900 text-white dark:bg-white/15 dark:text-white shadow-xs">
                  <FiZap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span>Battery Asset</span>
                </span>
              )}
              <ClientStatusBadge
                status={battery.status}
                isVerified={returns && returns.length > 0 ? (returns[0].status === 'verified' || Boolean(returns[0].verified_at)) : true}
                returnStatus={returns?.[0]?.status}
              />
              {battery.battery_type && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/50">
                  {battery.battery_type}
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
                  {battery.battery_code}
                </h1>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="p-2 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1 border text-slate-400 hover:text-slate-700 hover:bg-slate-100/80 dark:hover:bg-white/10 dark:hover:text-white border-transparent hover:border-slate-200 dark:hover:border-white/10"
                  title="Copy Battery ID"
                >
                  {copiedCode ? (
                    <>
                      <FiCheck className="w-4 h-4 text-emerald-500" />
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <FiCopy className="w-4 h-4" />
                  )}
                </button>
              </div>

              {battery.serial_number ? (
                <div className="mt-2 text-sm font-mono font-semibold flex items-center gap-2 text-slate-500 dark:text-neutral-400">
                  <span>Serial No:</span>
                  <span className="px-2.5 py-0.5 rounded-lg font-bold border bg-slate-100 dark:bg-surface-800 text-slate-800 dark:text-neutral-200 border-slate-200/60 dark:border-white/10">
                    {battery.serial_number}
                  </span>
                  {isAdmin && onEditSerial && (
                    <button
                      type="button"
                      onClick={onEditSerial}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline cursor-pointer ml-1"
                    >
                      Edit
                    </button>
                  )}
                </div>
              ) : (
                isAdmin && onEditSerial && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={onEditSerial}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40 transition-colors cursor-pointer"
                    >
                      + Assign Serial Number
                    </button>
                  </div>
                )
              )}

              {isRecycled && (
                <div className="mt-3.5 inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] shrink-0" />
                  <span>
                    <strong>Lifecycle Concluded:</strong> Decommissioned from fleet and safely dispatched for certified eco-friendly materials recycling.
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs flex-wrap text-slate-500 dark:text-neutral-400">
              <span className="inline-flex items-center gap-1.5">
                <FiCalendar className="w-3.5 h-3.5 text-emerald-500" />
                <span>Enrolled in Fleet: <strong className="text-slate-700 dark:text-neutral-200">{battery.created_at ? new Date(battery.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</strong></span>
              </span>
              {battery.last_service_date && !isRecycled && (
                <span className="inline-flex items-center gap-1.5">
                  <FiTool className="w-3.5 h-3.5 text-blue-500" />
                  <span>Last Service: <strong>{new Date(battery.last_service_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></span>
                </span>
              )}
              {recycleBatch?.recycled_at && (
                <span className="inline-flex items-center gap-1.5">
                  <FiRefreshCw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Recycled on: <strong className="text-emerald-700 dark:text-emerald-300">{new Date(recycleBatch.recycled_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></span>
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
            <div className="shrink-0 flex items-center gap-4 p-4 rounded-2xl border shadow-sm backdrop-blur-sm bg-white/90 dark:bg-surface-800 border-slate-200/80 dark:border-white/10">
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
                <p className="text-[11px] max-w-[140px] leading-relaxed text-slate-500 dark:text-neutral-400">
                  {isRecycled ? 'Archived identification tag for recycling chain of custody.' : 'Fast scan for workshop intake, dispatch & fleet custody checks.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 4 Colorful Client KPI Metric Cards ───────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isRecycled ? (
          <>
            {/* Recycled Card 1: Final Status (Emerald) */}
            <div className="relative overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-5 shadow-xs dark:border-emerald-500/20 dark:bg-surface-900 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Lifecycle State
                </span>
                <span className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <FiRefreshCw className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-4">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                  <span className="text-lg font-black text-slate-900 dark:text-white">
                    Recycled
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-1">
                  Lifecycle concluded · Retired from fleet
                </p>
              </div>
            </div>

            {/* Recycled Card 2: Decommission Reason (Amber) */}
            <div className="relative overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-5 shadow-xs dark:border-amber-500/20 dark:bg-surface-900 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Decommission Reason
                </span>
                <span className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <FiAlertTriangle className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-4">
                <span className="text-base font-extrabold text-slate-900 dark:text-white line-clamp-1" title={latestIssue?.reason_label || 'Physical / Electrical Defect'}>
                  {latestIssue?.reason_label || 'Test Failed / Cell Degradation'}
                </span>
                <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-1">
                  Exceeded safe operating tolerance
                </p>
              </div>
            </div>

            {/* Recycled Card 3: Material Reclaim (Teal) */}
            <div className="relative overflow-hidden rounded-2xl border border-teal-200/80 bg-gradient-to-br from-teal-500/10 via-teal-500/5 to-transparent p-5 shadow-xs dark:border-teal-500/20 dark:bg-surface-900 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                  Material Recovery
                </span>
                <span className="w-8 h-8 rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                  <FiCpu className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-4">
                <span className="text-lg font-black text-slate-900 dark:text-white font-mono">
                  100% Eco-Processed
                </span>
                <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-1">
                  Cells neutralized & reclaimed to raw stock
                </p>
              </div>
            </div>

            {/* Recycled Card 4: Disposal Logistics (Sky) */}
            <div className="relative overflow-hidden rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-500/10 via-sky-500/5 to-transparent p-5 shadow-xs dark:border-sky-500/20 dark:bg-surface-900 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">
                  Recycle Logistics
                </span>
                <span className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  <FiTruck className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-4">
                <span className="text-base font-extrabold text-slate-900 dark:text-white">
                  {recycleBatch?.vehicle_number ? `Truck ${recycleBatch.vehicle_number}` : 'Certified Depot'}
                </span>
                <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-1">
                  {recycleBatch?.recycled_at ? new Date(recycleBatch.recycled_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Verified partner transfer'}
                </p>
                {recycleBatch?.id && (
                  <Link
                    to={`/recycle/${recycleBatch.id}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-sky-700 hover:text-sky-800 dark:text-sky-400 hover:underline mt-2"
                  >
                    <span>Shipment #{recycleBatch.id}</span>
                    <FiExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>
          </>
        ) : isUnserviceable ? (
          <>
            {/* Unserviceable Card 1: Diagnostic Finding */}
            <div className="relative overflow-hidden rounded-2xl border border-rose-200/80 bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent p-5 shadow-xs dark:border-rose-500/20 dark:bg-surface-900 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                  Diagnostic Verdict
                </span>
                <span className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <FiXCircle className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-4">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />
                  <span className="text-base font-extrabold text-slate-900 dark:text-white">
                    Unserviceable
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-1">
                  Test Failed · Safety threshold exceeded
                </p>
              </div>
            </div>

            {/* Unserviceable Card 2: Defect Classification */}
            <div className="relative overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-5 shadow-xs dark:border-amber-500/20 dark:bg-surface-900 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Identified Defect
                </span>
                <span className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <FiAlertTriangle className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-4">
                <span className="text-base font-extrabold text-slate-900 dark:text-white line-clamp-1" title={latestIssue?.reason_label || 'Physical / Electrical Defect'}>
                  {latestIssue?.reason_label || 'Physical / Electrical Defect'}
                </span>
                <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-1">
                  Bench inspection verified
                </p>
              </div>
            </div>

            {/* Unserviceable Card 3: Billing Assessment */}
            {!isAdminRole && (
              <div className="relative overflow-hidden rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent p-5 shadow-xs dark:border-indigo-500/20 dark:bg-surface-900 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                    Diagnostic Fee
                  </span>
                  <span className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <FiShield className="w-4 h-4" />
                  </span>
                </div>
                <div className="mt-4">
                  <span className="text-2xl font-black text-indigo-950 dark:text-indigo-200 font-mono">
                    {diagnosticFeeLabel}
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-1">
                    Parts charge waived (£0.00)
                  </p>
                </div>
              </div>
            )}

            {/* Unserviceable Card 4: Custody & Disposal */}
            <div className="relative overflow-hidden rounded-2xl border border-purple-200/80 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent p-5 shadow-xs dark:border-purple-500/20 dark:bg-surface-900 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
                  Custody State
                </span>
                <span className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <FiTrash2 className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-4">
                <span className="text-base font-extrabold text-slate-900 dark:text-white">
                  {battery.status === 'recycled' ? 'Recycled' : 'Quarantine Depot'}
                </span>
                <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-1">
                  Eco-compliant disposal protocol
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Standard Card 1: Operational Status (Emerald) */}
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
                            : 'bg-emerald-500'
                    }`}
                  />
                  <span className="text-base font-extrabold text-slate-900 dark:text-white">
                    {isReturned
                      ? 'Operational in Fleet'
                      : isPacked
                        ? 'Waiting for Service'
                        : isInService
                          ? 'In Workshop Service'
                          : 'Service Completed'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-1">Live custody verification</p>
              </div>
            </div>

            {/* Standard Card 2: Service Cycles (Indigo) */}
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

            {/* Standard Card 3: Components Restored (Violet) */}
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

            {/* Standard Card 4: Verification & Transport */}
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
          </>
        )}
      </div>

      {/* ── Interactive Visual Service Lifecycle Stepper ────────────── */}
      <div className={`rounded-3xl border p-6 sm:p-8 shadow-xs ${
        isRecycled
          ? 'border-emerald-200/80 bg-white dark:border-emerald-900/30 dark:bg-surface-900'
          : 'border-slate-200/80 bg-white dark:border-white/10 dark:bg-surface-900'
      }`}>
        <div className={`flex items-center justify-between mb-6 pb-4 border-b ${
          isRecycled ? 'border-emerald-100 dark:border-white/10' : 'border-slate-100 dark:border-white/10'
        }`}>
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              {isRecycled ? (
                <>
                  <FiRefreshCw className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-slate-900 dark:text-white">Eco-Recycling & Decommissioning Journey</span>
                </>
              ) : (
                <>
                  <FiActivity className="w-4 h-4 text-emerald-500" />
                  <span className="text-slate-900 dark:text-white">Service Lifecycle & Diagnostic Stages</span>
                </>
              )}
            </h2>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
              {isRecycled
                ? 'Full history tracking from intake diagnostic failure to certified material recycling.'
                : isUnserviceable
                  ? 'Technical assessment journey leading to unit decommissioning and safe disposal.'
                  : 'Refurbishment progress from workshop intake to capacity benchmark and fleet delivery.'}
            </p>
          </div>
          <span className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold border shadow-2xs ${
            isRecycled
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50'
              : isUnserviceable
                ? 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50'
          }`}>
            {isRecycled ? '✓ Recycled' : isUnserviceable ? 'Decommissioned' : `Cycle #${serviceVisitsList.length > 0 ? serviceVisitsList.length : 1}`}
          </span>
        </div>

        {isRecycled ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5">
            {[
              { label: 'Intake & Logging', desc: 'Received at workshop facility', icon: FiPackage, state: 'done' },
              { label: 'Workshop Diagnostics', desc: 'Multi-point safety assessment', icon: FiActivity, state: 'done' },
              { label: 'Safety & Load Testing', desc: 'Critical electrical defect identified', icon: FiXCircle, state: 'failed' },
              { label: 'Parts Reclaimed', desc: 'Usable hardware restocked to inventory', icon: FiCpu, state: 'done' },
              { label: 'Material Recycled', desc: '100% Eco-certified disposal completed', icon: FiRefreshCw, state: 'recycled_done' },
            ].map((step, idx) => {
              const Icon = step.icon;
              const isRecycledFinal = step.state === 'recycled_done';
              const isFailed = step.state === 'failed';
              const isDone = step.state === 'done';

              return (
                <div
                  key={idx}
                  className={`relative flex flex-col p-4 rounded-2xl border transition-all ${
                    isRecycledFinal
                      ? 'border-emerald-400 bg-gradient-to-b from-emerald-50 to-teal-50/60 dark:border-emerald-600 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20 shadow-xs'
                      : isFailed
                        ? 'border-rose-200 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-950/20'
                        : isDone
                          ? 'border-emerald-200/80 bg-emerald-50/40 dark:border-emerald-900/30 dark:bg-emerald-950/15'
                          : 'border-slate-100 bg-slate-50/40 dark:border-white/5 opacity-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <span
                      className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        isRecycledFinal
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : isFailed
                            ? 'bg-rose-500 text-white shadow-xs'
                            : isDone
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-200 text-slate-400 dark:bg-white/10'
                      }`}
                    >
                      {isRecycledFinal ? <FiRefreshCw className="w-4 h-4" /> : isDone ? <FiCheck className="w-4 h-4 stroke-[3]" /> : <Icon className="w-4 h-4" />}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 font-mono">
                      0{idx + 1}
                    </span>
                  </div>
                  <h3 className={`font-bold text-xs ${isRecycledFinal ? 'text-emerald-900 dark:text-emerald-200 font-black' : 'text-slate-900 dark:text-white'}`}>{step.label}</h3>
                  <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5 leading-snug">{step.desc}</p>
                </div>
              );
            })}
          </div>
        ) : isUnserviceable ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5">
            {UNSERVICEABLE_STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isFailed = step.state === 'failed';
              const isDone = step.state === 'done';
              const isWarn = step.state === 'warning';
              const isActive = step.state === 'active';

              return (
                <div
                  key={step.key}
                  className={`relative flex flex-col p-4 rounded-2xl border transition-all ${
                    isFailed
                      ? 'border-rose-300 bg-gradient-to-b from-rose-50 to-red-50/40 dark:border-rose-800/60 dark:bg-rose-950/30 ring-2 ring-rose-500/20 shadow-xs'
                      : isWarn
                        ? 'border-amber-300 bg-gradient-to-b from-amber-50 to-orange-50/40 dark:border-amber-800/60 dark:bg-amber-950/30 shadow-xs'
                        : isDone
                          ? 'border-emerald-200/80 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20'
                          : isActive
                            ? 'border-purple-300 bg-purple-50/40 dark:border-purple-800/60 dark:bg-purple-950/20'
                            : 'border-slate-100 bg-slate-50/40 dark:border-white/5 opacity-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <span
                      className={`w-8 h-8 rounded-xl flex items-center justify-center transition-transform ${
                        isFailed
                          ? 'bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-xs'
                          : isWarn
                            ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-xs'
                            : isDone
                              ? 'bg-emerald-500 text-white'
                              : isActive
                                ? 'bg-purple-600 text-white animate-pulse'
                                : 'bg-slate-200 text-slate-400 dark:bg-white/10'
                      }`}
                    >
                      {isDone ? <FiCheck className="w-4 h-4 stroke-[3]" /> : <Icon className="w-4 h-4" />}
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
        ) : (
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
        )}
      </div>

      {/* ── Unserviceable Inspection & Diagnostics Report Card ───────── */}
      {isUnserviceable && (
        <div className="rounded-3xl border border-rose-200/80 bg-gradient-to-b from-rose-50/30 via-white to-white p-6 sm:p-8 shadow-xs dark:border-rose-900/40 dark:from-rose-950/20 dark:via-surface-900 dark:to-surface-900 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-rose-100 dark:border-rose-900/30">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center shadow-xs">
                <FiAlertTriangle className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Diagnostic Assessment & Inspection Findings</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
                  Official workshop technical report explaining why this battery could not be refurbished.
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
              <FiXCircle className="w-3.5 h-3.5" />
              <span>Safety Threshold Failure</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-surface-800 border border-slate-200/80 dark:border-white/10 space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
                Primary Defect Identified
              </span>
              <p className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>{latestIssue?.reason_label || 'Physical / Electrical Cell Defect'}</span>
              </p>
              <div className="pt-2 border-t border-slate-100 dark:border-white/10 flex items-center justify-between text-xs text-slate-500 dark:text-neutral-400">
                <span>Inspector: <strong>{latestIssue?.staff_name || 'Workshop Technical Team'}</strong></span>
                <span>
                  Date:{' '}
                  <strong>
                    {latestIssue?.reported_at
                      ? new Date(latestIssue.reported_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'}
                  </strong>
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-surface-800 border border-slate-200/80 dark:border-white/10 space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
                Workshop Technical Notes
              </span>
              <p className="text-xs text-slate-700 dark:text-neutral-300 leading-relaxed italic">
                "{latestIssue?.note || 'Bench load testing indicated severe cell degradation or physical damage beyond safe operational tolerance.'}"
              </p>
            </div>
          </div>

          {/* Diagnostic Fee Guarantee Box */}
          {!isAdminRole && (
            <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/70 dark:border-indigo-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FiShield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-900 dark:text-indigo-200">
                    Intake & Diagnostic Fee Policy ({diagnosticFeeLabel})
                  </span>
                </div>
                <p className="text-xs text-indigo-800/90 dark:text-indigo-300 leading-relaxed">
                  Covers intake scanning, initial diagnostic bench testing, and technical safety evaluation. Any replacement parts fitted during testing were safely returned to workshop stock at <strong>£0.00</strong> charge.
                </p>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-xs text-slate-500 dark:text-neutral-400 block">Total Unit Charge</span>
                <span className="text-xl font-black font-mono text-indigo-900 dark:text-indigo-200">
                  {diagnosticFeeLabel}
                </span>
              </div>
            </div>
          )}

          {/* Workshop Diagnostic Evidence Photos */}
          {latestIssue?.photo_urls && latestIssue.photo_urls.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-neutral-300 flex items-center gap-2">
                <FiCamera className="w-3.5 h-3.5 text-rose-500" />
                <span>Inspection Photo Evidence ({latestIssue.photo_urls.length})</span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {latestIssue.photo_urls.map((photo, pIdx) => {
                  const resolvedUrl = resolveImageUrl(photo);
                  return (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() =>
                        setLightboxState({
                          isOpen: true,
                          images: latestIssue.photo_urls.map(resolveImageUrl),
                          initialIndex: pIdx,
                          title: `Inspection Evidence - ${battery.battery_code}`,
                        })
                      }
                      className="group relative aspect-square rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 bg-slate-100 hover:ring-2 hover:ring-rose-500/50 transition-all cursor-pointer"
                    >
                      <img
                        src={resolvedUrl}
                        alt={`Diagnostic inspection ${pIdx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="px-2 py-1 rounded-lg bg-black/60 text-white text-[10px] font-bold">
                          Zoom
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Certified Eco-Recycling Manifest & Compliance (Recycled Batteries) ── */}
      {isRecycled && (
        <div className="rounded-3xl border border-emerald-200/80 bg-white p-6 sm:p-8 shadow-xs dark:border-emerald-900/40 dark:bg-surface-900 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-white/10">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center shadow-xs">
                <FiShield className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Certified Eco-Recycling Manifest & Environmental Compliance</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
                  Official disposal audit trail ensuring zero hazardous material landfill discharge.
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60">
              <FiCheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>WEEE Compliant · Certified</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 dark:bg-surface-800 dark:border-white/10 space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                Transport Vehicle
              </span>
              <p className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                {recycleBatch?.vehicle_number || 'TRK-RECYCLE'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-neutral-400">Dedicated Hazmat Transport</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 dark:bg-surface-800 dark:border-white/10 space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                Authorized Driver
              </span>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {recycleBatch?.driver_name || 'Authorized Courier'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-neutral-400">Chain of custody signed</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 dark:bg-surface-800 dark:border-white/10 space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                Dispatched Date
              </span>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {recycleBatch?.recycled_at
                  ? new Date(recycleBatch.recycled_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                  : (battery.created_at ? new Date(battery.created_at).toLocaleDateString('en-GB') : '—')}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-neutral-400">Archived timestamp</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 dark:bg-surface-800 dark:border-white/10 space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                Processing Facility
              </span>
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                {recycleBatch?.recycle_client_name || 'Refurbnics Recycling Depot'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                {recycleBatch?.recycle_client_name ? 'Certified Partner Facility' : 'Raw lithium & copper recovery'}
              </p>
            </div>
          </div>

          {/* Defect note / inspection details if available */}
          {latestIssue && (
            <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80 dark:bg-amber-950/20 dark:border-amber-900/40 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                Diagnostic Finding Prior to Decommissioning
              </span>
              <p className="text-xs text-slate-700 dark:text-neutral-300 leading-relaxed">
                <strong className="text-rose-600 dark:text-rose-400 font-semibold">{latestIssue.reason_label}</strong>: {latestIssue.note || 'Battery failed multi-point internal resistance and load bench tests, requiring safe material reclamation.'}
              </p>
            </div>
          )}

          {/* Diagnostic Fee Policy */}
          {!isAdminRole && (
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200/80 dark:bg-surface-800 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FiShield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-neutral-200">
                    Intake & Recycling Fee Policy ({diagnosticFeeLabel})
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-neutral-400 leading-relaxed">
                  Covers intake scanning, initial diagnostic bench testing, and certified eco-recycling processing. Replacement parts were restocked at <strong>£0.00</strong> charge.
                </p>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-xs text-slate-400 dark:text-neutral-500 block">Total Unit Settlement</span>
                <span className="text-xl font-black font-mono text-emerald-700 dark:text-emerald-400">
                  {diagnosticFeeLabel}
                </span>
              </div>
            </div>
          )}

          {/* Environmental Statement Callout */}
          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 dark:bg-emerald-950/20 dark:border-emerald-900/40 flex items-start gap-3">
            <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <FiRefreshCw className="w-4 h-4" />
            </span>
            <div className="text-xs space-y-1">
              <p className="font-bold text-emerald-900 dark:text-emerald-200">
                Circular Economy & Sustainable Mineral Recovery
              </p>
              <p className="text-emerald-800/80 dark:text-emerald-300/80 leading-relaxed">
                This unit was responsibly discharged and decommissioned under strict environmental oversight. All internal cells, copper busbars, and BMS circuitry are processed for secondary mineral reclamation with 0% landfill footprint.
              </p>
            </div>
          </div>

          {/* Photo evidence if any */}
          {latestIssue?.photo_urls && latestIssue.photo_urls.length > 0 && (
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-neutral-300 flex items-center gap-2">
                <FiCamera className="w-3.5 h-3.5 text-slate-500" />
                <span>Inspection Photo Evidence ({latestIssue.photo_urls.length})</span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {latestIssue.photo_urls.map((photo, pIdx) => {
                  const resolvedUrl = resolveImageUrl(photo);
                  return (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() =>
                        setLightboxState({
                          isOpen: true,
                          images: latestIssue.photo_urls.map(resolveImageUrl),
                          initialIndex: pIdx,
                          title: `Inspection Evidence - ${battery.battery_code}`,
                        })
                      }
                      className="group relative aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-white dark:border-white/10 dark:bg-surface-800 hover:ring-2 hover:ring-emerald-500/50 transition-all cursor-pointer shadow-xs"
                    >
                      <img
                        src={resolvedUrl}
                        alt={`Diagnostic inspection ${pIdx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="px-2 py-1 rounded-lg bg-black/70 text-white text-[10px] font-bold">
                          Zoom
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Workshop Inventory Recovery & Parts Restocked (Admin Audit) ── */}
      {isRecycled && isAdmin && history.some((h) => h.removed_at) && (
        <div className="rounded-3xl border border-blue-200/80 bg-white p-6 sm:p-8 shadow-xs dark:border-blue-900/40 dark:bg-surface-900 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 flex items-center justify-center">
                <FiTool className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Workshop Inventory Recovery & Reclaimed Parts
                </h3>
                <p className="text-xs text-slate-500 dark:text-neutral-400">
                  Parts fitted during repair cycles that were safely reclaimed and refunded back to stock upon decommissioning.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/50">
              Admin Audit Log
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {history
              .filter((h) => h.removed_at)
              .map((h, hIdx) => (
                <div
                  key={hIdx}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 dark:bg-surface-800 dark:border-white/10 space-y-2 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {h.part_name}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs font-bold">
                      Qty {h.quantity_used} restocked
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-neutral-400 space-y-0.5">
                    <p>Fitted by: <strong className="text-slate-700 dark:text-neutral-200">{h.staff_name}</strong></p>
                    <p>Restocked by: <strong className="text-slate-700 dark:text-neutral-200">{h.removed_by_staff_name || 'Technician'}</strong></p>
                    <p className="text-[11px] text-slate-400 dark:text-neutral-500 pt-1">
                      {new Date(h.removed_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── Maintenance & Component Restoration Log (Standard Batteries) ─ */}
      {!isUnserviceable && !isRecycled && (
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
      )}

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

      {/* Image Lightbox Modal for Inspection Photos */}
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

// ── MAIN BATTERY DETAIL PAGE ROUTER ──────────────────────────────────────────
function BatteryDetailPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const isTechnician = user?.role === 'technician';
  const isStaff = user?.role === 'staff';
  const isClient = user?.role === 'client';
  const isRecycleClient = user?.role === 'recycle_client';
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';
  const isSuperAdmin = user?.role === 'super_admin';

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

  if (loading && !result) return <TableState>Loading battery details & history…</TableState>;
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

  // If battery is recycled OR viewed by client (or unauthenticated QR scan), render the dedicated beautiful view!
  if (battery?.status === 'recycled' || isClient || (!user && battery)) {
    return (
      <>
        <ClientBatteryDetailView
          battery={battery}
          history={history}
          returns={returns}
          visits={visits}
          issues={issues}
          services={services}
          recycleBatch={recycleBatch}
          qrDataUrl={qrDataUrl}
          onDownloadQr={handleDownloadQr}
          onReload={load}
          isAdmin={isAdmin}
          onEditSerial={() => {
            setSerialInput(battery.serial_number || '');
            setSerialInputRetype(battery.serial_number || '');
            setSerialConfirmText('');
            setSerialError(null);
            setShowSerialModal(true);
          }}
        />

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
      </>
    );
  }

  // ── ADMIN & TECHNICIAN INTERNAL VIEW ──────────────────────────────────────
  const passBackService = (services || []).find((s) => s.service_name === 'Passed back to Technician');
  const isPassedBack = Boolean(passBackService && battery?.status === 'in_repair');
  const hasPendingPartsToRemove = (pendingPartsRemoval && pendingPartsRemoval.length > 0) || isPassedBack;
  const isIntakeUnverified = intakeIsUnverified(battery);

  const cycles = buildCycles(
    buildEvents(
      visits || [],
      history || [],
      returns || [],
      issues || [],
      services || [],
      recycleBatch,
      battery
    )
  );
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
          {isIntakeUnverified ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              Intake Not Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Verified Battery Record
            </span>
          )}
          <span className="text-xs text-slate-400 dark:text-neutral-500">
            Scanned via QR Code
          </span>
        </div>
      )}

      {isIntakeUnverified && (
        <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50/90 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 text-lg dark:bg-amber-900/50 dark:text-amber-300">
              ⚠️
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  Shipment Arrival Not Verified
                </h4>
                <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:bg-amber-900/80 dark:text-amber-200">
                  Pending Intake
                </span>
              </div>
              <p className="mt-1 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                This battery arrived under Truck #{battery.intake_truck_number || 'N/A'}{battery.intake_driver_name ? ` (Driver: ${battery.intake_driver_name})` : ''}, but this truck shipment has not been verified yet by workshop staff. Work and testing cannot be started on this battery until arrival is verified.
              </p>
              {battery.truck_intake_id && (
                <div className="mt-2.5">
                  <Link
                    to={`/truck-intakes/${battery.truck_intake_id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-amber-700 transition-colors"
                  >
                    <span>View Truck Intake #{battery.intake_truck_number}</span>
                    <FiExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </div>
          </div>
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
        className={`mb-6 flex flex-wrap items-center gap-4 rounded-xl border-l-4 border-y border-r p-5 shadow-sm dark:border-y-white/10 dark:border-r-white/10 ${
          hasPendingPartsToRemove
            ? 'border-l-amber-500 border-amber-300 bg-gradient-to-r from-amber-50 to-white dark:border-amber-700/60 dark:bg-surface-900 dark:from-amber-950/30 dark:to-surface-950'
            : `border-slate-200 bg-gradient-to-r dark:bg-surface-900 ${STATUS_ACCENT[battery.status] || 'border-slate-300'} ${STATUS_BANNER_BG[battery.status] || 'from-white to-slate-50 dark:from-surface-900 dark:to-surface-950'}`
        }`}
      >
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
            hasPendingPartsToRemove
              ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-400/40 dark:bg-amber-900/40 dark:text-amber-300'
              : (STATUS_ICON_BG[battery.status] || 'bg-slate-100 text-slate-500 dark:bg-surface-800 dark:text-neutral-300')
          }`}
        >
          {hasPendingPartsToRemove ? <FiTool className="h-6 w-6" /> : <FiCpu className="h-6 w-6" />}
        </span>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={battery.status}
              isPassedBack={isPassedBack}
              hasPendingParts={hasPendingPartsToRemove}
            />
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
            ) : user && !isTechnician && !isRecycleClient ? (
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

      {(battery.status === 'unserviceable' || battery.status === 'tested_parts_removed' || battery.status === 'recycled') && result.issues?.[0] && (
        <div className="mb-6 rounded-xl border border-critical-200 bg-critical-50 p-5 dark:border-red-500/30 dark:bg-red-500/10 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-critical-100 text-critical-800 dark:bg-red-950/60 dark:text-red-300">
                  {battery.status === 'tested_parts_removed' ? 'Unserviceable · Test Failed' : 'Unserviceable'}
                </span>
                <h2 className="text-sm font-semibold text-critical-700 dark:text-red-300">
                  {result.issues[0].reason_label}
                </h2>
              </div>
              {result.issues[0].note && (
                <p className="mb-1 text-sm text-slate-600 dark:text-neutral-300">{result.issues[0].note}</p>
              )}
              <p className="text-xs text-slate-500 dark:text-neutral-500">
                Reported by {result.issues[0].staff_name} on{' '}
                {new Date(result.issues[0].reported_at).toLocaleString()}
              </p>

              {/* Full Audit Trail: Fitted parts & Removed parts */}
              {history.some((h) => h.removed_at) && (
                <div className="mt-3 pt-3 border-t border-red-200/80 dark:border-red-800/40">
                  <span className="text-xs font-bold text-red-900 dark:text-red-200 block mb-1">
                    Fitted Parts Removed &amp; Restocked:
                  </span>
                  <div className="space-y-1">
                    {history
                      .filter((h) => h.removed_at)
                      .map((h, hIdx) => (
                        <p key={hIdx} className="text-xs text-red-800 dark:text-red-300">
                          • <span className="font-semibold">{h.part_name}</span> (Qty {h.quantity_used}) — fitted by{' '}
                          <span className="font-semibold">{h.staff_name}</span> and removed by{' '}
                          <span className="font-semibold">{h.removed_by_staff_name || 'Technician'}</span> on{' '}
                          {new Date(h.removed_at).toLocaleString()}
                        </p>
                      ))}
                  </div>
                </div>
              )}
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

      {battery.status === 'recycled' && (
        <div className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-950 p-6 text-white shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <FiRefreshCw className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Decommissioned & Recycled</span>
                  <span className="rounded-full bg-emerald-950 border border-emerald-500/40 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400">
                    Eco Certified
                  </span>
                </h2>
                <p className="text-xs text-neutral-400">
                  This battery has been retired and processed for certified eco-friendly materials recycling.
                </p>
              </div>
            </div>
          </div>
          {recycleBatch ? (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/60 p-3.5">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500">Recycle Transport</span>
                <span className="mt-1 block font-mono text-sm font-bold text-white">Vehicle {recycleBatch.vehicle_number}</span>
              </div>
              <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/60 p-3.5">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500">Dispatched Driver</span>
                <span className="mt-1 block text-sm font-bold text-white">{recycleBatch.driver_name}</span>
              </div>
              <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/60 p-3.5">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500">Recycle Date</span>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-sm font-bold text-white">{new Date(recycleBatch.recycled_at).toLocaleDateString('en-GB')}</span>
                  <Link to={`/recycle/${recycleBatch.id}`} className="text-xs font-semibold text-emerald-400 hover:underline">
                    View shipment →
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-neutral-400">
              Dispatched from facility. All cells and materials decommissioned under environmental guidelines.
            </p>
          )}
        </div>
      )}

      {!isRecycleClient && !isAdmin && (isTechnician || isStaff) && (
        <TechnicianRepairPanel
          battery={battery}
          services={services}
          pendingPartsRemoval={pendingPartsRemoval}
          history={history}
          issues={issues}
          returns={returns}
          onUpdated={load}
          onDone={() => navigate('/?autoScan=1')}
        />
      )}

      {/* Recycled Partner View: Clean Scrap Battery Summary */}
      {isRecycleClient ? (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs dark:border-white/10 dark:bg-surface-900 mb-6">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300">
            Recycled Battery Information
          </h2>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 dark:border-white/10 dark:bg-surface-800/60">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
                Battery ID
              </span>
              <span className="mt-1 block font-mono text-base font-bold text-slate-900 dark:text-white">
                {battery.battery_code}
              </span>
            </div>

            {battery.serial_number && (
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 dark:border-white/10 dark:bg-surface-800/60">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
                  Serial Number
                </span>
                <span className="mt-1 block font-mono text-sm font-bold text-slate-800 dark:text-neutral-200">
                  {battery.serial_number}
                </span>
              </div>
            )}

            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 dark:border-white/10 dark:bg-surface-800/60">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
                Current Status
              </span>
              <div className="mt-1.5">
                <StatusBadge status={battery.status} />
              </div>
            </div>

            {recycleBatch && (
              <>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 dark:border-white/10 dark:bg-surface-800/60">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
                    Recycle Shipment Truck
                  </span>
                  <span className="mt-1 block font-mono text-sm font-bold text-slate-800 dark:text-neutral-200">
                    {recycleBatch.vehicle_number || '—'}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 dark:border-white/10 dark:bg-surface-800/60">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
                    Transport Driver
                  </span>
                  <span className="mt-1 block text-sm font-bold text-slate-800 dark:text-neutral-200">
                    {recycleBatch.driver_name || '—'}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 dark:border-white/10 dark:bg-surface-800/60">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
                    Dispatched Date
                  </span>
                  <span className="mt-1 block text-sm font-bold text-slate-800 dark:text-neutral-200">
                    {new Date(recycleBatch.recycled_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className={`mb-6 grid grid-cols-1 gap-4 ${isSuperAdmin ? (isTechnician ? 'sm:grid-cols-3' : 'sm:grid-cols-4') : 'sm:grid-cols-2'}`}>
            <StatCard label="Repairs Logged" value={repairVisits} tone="good" />
            <StatCard label="Return Shipments" value={returns.length} tone="info" />
            {isSuperAdmin && (
              <StatCard
                label="Total Repair Time"
                value={totalRepairDurationSeconds > 0 ? formatDuration(totalRepairDurationSeconds) : '—'}
                tone="info"
              />
            )}
            {isSuperAdmin && !isTechnician && (
              <StatCard label="Total Price" value={`£${totalSpent.toFixed(2)}`} tone="warning" />
            )}
          </div>

          {!isTechnician && (
            cycles.length === 0 ? (
              <TableState>No history recorded for this battery yet.</TableState>
            ) : (
          <div className="flex flex-col gap-6">
            {cycles.map((cycle, i) => {
              const isOngoing = i === cycles.length - 1 && !cycle.some((e) => e.type === 'return' || e.type === 'recycle');
              const hasReturn = cycle.some((e) => e.type === 'return');
              const hasRecycle = cycle.some((e) => e.type === 'recycle');
              const hasIssue = cycle.some((e) => e.type === 'issue');
              const isUnserviceableCycle =
                hasIssue ||
                hasRecycle ||
                (isOngoing && ['unserviceable', 'tested_parts_removed', 'recycled'].includes(battery.status));

              let cardTone = 'blue';
              let cardLabel = 'Completed';

              if (isUnserviceableCycle) {
                cardTone = 'red';
                if (hasRecycle || battery.status === 'recycled') {
                  cardLabel = 'Sent for Recycling';
                } else if ((pendingPartsRemoval?.length || 0) > 0) {
                  cardLabel = 'Unserviceable (Parts Removal Required)';
                } else if (cycle.some((e) => e.type === 'part_removed')) {
                  cardLabel = 'Unserviceable (Parts Restocked)';
                } else {
                  cardLabel = 'Reported Unserviceable';
                }
              } else if (isOngoing) {
                if (battery.status === 'repaired') {
                  cardTone = 'green';
                  cardLabel = 'Repair Completed · Ready to Return';
                } else if (['in_testing', 'testing', 'repair_testing'].includes(battery.status)) {
                  cardTone = 'purple';
                  cardLabel = 'In Testing & QA';
                } else if (battery.status === 'in_progress') {
                  cardTone = 'amber';
                  cardLabel = 'Repair In Progress';
                } else if (battery.status === 'in_repair') {
                  cardTone = 'amber';
                  cardLabel = intakeIsUnverified(battery) ? 'Awaiting Truck Arrival Verification' : 'Queued for Repair';
                }
              } else {
                cardTone = 'emerald';
                cardLabel = 'Returned to Client';
              }

              const TONE_CLASSES = {
                amber: {
                  border: 'border-amber-500',
                  bg: 'bg-amber-50 dark:bg-amber-500/15',
                  text: 'text-amber-800 dark:text-amber-300',
                  badge: 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
                },
                green: {
                  border: 'border-emerald-500',
                  bg: 'bg-emerald-50 dark:bg-emerald-500/15',
                  text: 'text-emerald-800 dark:text-emerald-300',
                  badge: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
                },
                emerald: {
                  border: 'border-emerald-500',
                  bg: 'bg-emerald-50 dark:bg-emerald-500/15',
                  text: 'text-emerald-800 dark:text-emerald-300',
                  badge: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
                },
                blue: {
                  border: 'border-blue-500',
                  bg: 'bg-blue-50 dark:bg-sky-500/15',
                  text: 'text-blue-800 dark:text-sky-300',
                  badge: 'bg-blue-100 text-blue-900 dark:bg-blue-950/40 dark:text-sky-300',
                },
                purple: {
                  border: 'border-purple-500',
                  bg: 'bg-purple-50 dark:bg-purple-500/15',
                  text: 'text-purple-800 dark:text-purple-300',
                  badge: 'bg-purple-100 text-purple-900 dark:bg-purple-950/40 dark:text-purple-300',
                },
                red: {
                  border: 'border-rose-500',
                  bg: 'bg-rose-50 dark:bg-rose-500/15',
                  text: 'text-rose-800 dark:text-rose-300',
                  badge: 'bg-rose-100 text-rose-900 dark:bg-rose-950/40 dark:text-rose-300',
                },
              };
              const tone = TONE_CLASSES[cardTone] || TONE_CLASSES.blue;

              const intakeEvent = cycle.find((e) => e.type === 'intake');
              const returnEvent = cycle.find((e) => e.type === 'return');
              const recycleEvent = cycle.find((e) => e.type === 'recycle');
              const latestIssue = [...cycle].reverse().find((e) => e.type === 'issue');
              const cycleRepairs = cycle.filter((e) => e.type === 'repair');
              const cycleServices = cycle.filter((e) => e.type === 'service');
              const cycleRemovedParts = cycle.filter((e) => e.type === 'part_removed');
              const totalRepairTimeSec = cycleRepairs.reduce((sum, r) => sum + (r.durationSeconds || 0), 0);

              const cyclePartsTotal = cycleRepairs
                .filter((r) => !r.isRemoved)
                .reduce((sum, r) => sum + (Number(r.price) || 0), 0);
              const cycleServicesTotal = cycleServices.reduce(
                (sum, s) => sum + (Number(s.price) || 0),
                0
              );
              const cycleTotal = Math.max(0, cyclePartsTotal + cycleServicesTotal);

              const startDateStr = cycle[0]?.date ? new Date(cycle[0].date).toLocaleDateString() : null;
              const endDateStr = (returnEvent?.date || recycleEvent?.date)
                ? new Date(returnEvent?.date || recycleEvent?.date).toLocaleDateString()
                : null;

              return (
                <div
                  key={cycle[0].key}
                  className={`overflow-hidden rounded-2xl border-l-4 border-y border-r border-slate-200 bg-white shadow-sm dark:border-y-white/10 dark:border-r-white/10 dark:bg-surface-900 ${tone.border}`}
                >
                  {/* Cycle Header */}
                  <div className={`flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-200/80 dark:border-white/10 ${tone.bg}`}>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h2 className={`text-sm font-bold uppercase tracking-wider ${tone.text}`}>
                          Cycle #{i + 1}
                        </h2>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold shadow-2xs ${tone.badge}`}>
                          {cardLabel}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-neutral-400">
                        {startDateStr ? `Started ${startDateStr}` : ''}
                        {endDateStr ? ` · Completed ${endDateStr}` : isOngoing ? ' · Active Workshop Cycle' : ''}
                      </p>
                    </div>

                    {isSuperAdmin && (
                      <div className="flex items-center gap-2">
                        {cycleTotal > 0 ? (
                          <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/95 px-3 py-1 text-xs font-extrabold text-slate-900 shadow-2xs dark:bg-surface-800 dark:text-white border border-slate-200/80 dark:border-white/10">
                            <span>Total: £{cycleTotal.toFixed(2)}</span>
                            {isUnserviceableCycle && cycleServicesTotal > 0 && cyclePartsTotal === 0 && (
                              <span className="rounded-md bg-rose-100/90 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/60 dark:border-rose-900/40">
                                Diagnostic Fee
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-xl bg-white/90 px-3 py-1 text-xs font-semibold text-slate-500 dark:bg-surface-800 dark:text-neutral-400 border border-slate-200/60 dark:border-white/10">
                            No Charge
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Cycle at a Glance Summary Pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3 bg-slate-50/70 border-b border-slate-100 dark:bg-surface-950/40 dark:border-white/5 text-xs">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-neutral-500 block">Intake Truck</span>
                      <span className="font-semibold text-slate-700 dark:text-neutral-200">
                        {intakeEvent?.truckNumber ? `Truck #${intakeEvent.truckNumber}` : battery?.intake_truck_number ? `Truck #${battery.intake_truck_number}` : '—'}
                        {intakeEvent?.isVerified ? ' (Verified)' : ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-neutral-500 block">Parts Fitted</span>
                      <span className="font-semibold text-slate-700 dark:text-neutral-200">
                        {cycleRepairs.length} {cycleRepairs.length === 1 ? 'part' : 'parts'}
                        {isSuperAdmin && totalRepairTimeSec > 0 ? ` (${formatDuration(totalRepairTimeSec)})` : ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-neutral-500 block">QA & Services</span>
                      <span className="font-semibold text-slate-700 dark:text-neutral-200">
                        {cycleServices.length} {cycleServices.length === 1 ? 'service' : 'services'}
                        {isSuperAdmin && cycleServicesTotal > 0 ? ` (£${cycleServicesTotal.toFixed(2)})` : ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-neutral-500 block">Outcome / Delivery</span>
                      <span className="font-semibold text-slate-700 dark:text-neutral-200">
                        {returnEvent?.truckNumber
                          ? `Returned (Truck #${returnEvent.truckNumber})`
                          : recycleEvent
                            ? `Recycled (Vehicle #${recycleEvent.vehicleNumber})`
                            : isUnserviceableCycle
                              ? 'Unserviceable'
                              : 'In Workshop'}
                      </span>
                    </div>
                  </div>

                  {/* Stepper */}
                  <div className="border-b border-slate-100 px-6 py-5 dark:border-white/10">
                    <ProcessStepper
                      isOngoing={isOngoing}
                      batteryStatus={battery.status}
                      cycle={cycle}
                      pendingPartsCount={pendingPartsRemoval?.length || 0}
                    />
                  </div>

                  {/* Unserviceable Diagnostic Highlights (If unserviceable cycle) */}
                  {isUnserviceableCycle && latestIssue && (
                    <div className="m-5 rounded-2xl border border-rose-200 bg-rose-50/80 p-4 dark:border-rose-900/50 dark:bg-rose-950/20">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-200 text-rose-800 text-xs font-bold dark:bg-rose-900/60 dark:text-rose-200">
                          ⚠
                        </span>
                        <h4 className="text-xs font-bold text-rose-900 dark:text-rose-200 uppercase tracking-wider">
                          Unserviceable Unit Diagnostic Record
                        </h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-rose-800 dark:text-rose-300">
                        <p>
                          <span className="font-semibold text-rose-950 dark:text-rose-100">Failure Reason:</span> {latestIssue.reasonLabel || 'Unserviceable'}
                        </p>
                        <p>
                          <span className="font-semibold text-rose-950 dark:text-rose-100">Reported By:</span> {latestIssue.staffName || 'Workshop Staff'}
                          {latestIssue.date ? ` on ${new Date(latestIssue.date).toLocaleString()}` : ''}
                        </p>
                      </div>
                      {latestIssue.notes && (
                        <div className="mt-2 rounded-xl border border-rose-200/60 bg-white/80 p-2.5 dark:border-rose-900/40 dark:bg-surface-900">
                          <p className="text-xs italic text-rose-900 dark:text-rose-200">"{latestIssue.notes}"</p>
                        </div>
                      )}
                      {latestIssue.photos && latestIssue.photos.length > 0 && (
                        <div className="mt-3">
                          <span className="text-[11px] font-bold text-rose-900 dark:text-rose-200 block mb-1.5">
                            Diagnostic Photos ({latestIssue.photos.length})
                          </span>
                          <div className="flex items-center gap-2">
                            {latestIssue.photos.map((src, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() =>
                                  setLightboxState({
                                    isOpen: true,
                                    images: latestIssue.photos,
                                    initialIndex: idx,
                                    title: `Issue Photos — ${battery.battery_code}`,
                                  })
                                }
                                className="group relative h-14 w-14 overflow-hidden rounded-xl border border-rose-200 bg-white shadow-2xs hover:scale-105 transition-all dark:border-white/10 dark:bg-surface-800 cursor-pointer"
                              >
                                <img src={resolveImageUrl(src)} alt="" className="h-full w-full object-cover" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="mt-3 pt-2.5 border-t border-rose-200/60 dark:border-rose-900/40 flex flex-wrap items-center gap-4 text-[11px] font-medium text-rose-900 dark:text-rose-300">
                        <span>
                          Fitted Parts: {cycleRemovedParts.length > 0 ? `✓ ${cycleRemovedParts.length} parts restocked to inventory` : (pendingPartsRemoval?.length || 0) > 0 ? `⚠ ${pendingPartsRemoval.length} parts pending removal` : 'None installed'}
                        </span>
                        <span>•</span>
                        <span>
                          Recycling: {recycleEvent || battery.status === 'recycled' ? `✓ Dispatched for recycling` : '⏳ Awaiting recycling shipment'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Recycling Shipment Details (If recycled) */}
                  {recycleEvent && (
                    <div className="mx-5 mb-3 rounded-2xl border border-rose-200 bg-rose-50/50 p-3.5 dark:border-rose-900/40 dark:bg-rose-950/10 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-rose-900 dark:text-rose-200">Sent for Material Recycling</span>
                        <p className="text-rose-700 dark:text-rose-300 text-[11px]">
                          Vehicle {recycleEvent.vehicleNumber} · Driver {recycleEvent.driverName} on {new Date(recycleEvent.date).toLocaleString()}
                        </p>
                      </div>
                      {recycleEvent.recycleBatchId && (
                        <Link
                          to={`/recycle/${recycleEvent.recycleBatchId}`}
                          className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-rose-700 transition-colors"
                        >
                          View Shipment
                        </Link>
                      )}
                    </div>
                  )}

                  {/* Event Timeline */}
                  <div className="p-5">
                    <ol>
                      {cycle.map((event, idx) => {
                        const meta = EVENT_META[event.type] || EVENT_META.repair;
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
                                  {event.label || meta.label}
                                </span>
                                <span className="text-xs text-slate-400 dark:text-neutral-500">
                                  {new Date(event.date).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-sm text-slate-600 dark:text-neutral-300">{event.primary}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                {isSuperAdmin && event.durationSeconds != null && (
                                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-white/5 dark:text-neutral-300">
                                    Time taken: {formatDuration(event.durationSeconds)}
                                  </span>
                                )}
                                {isSuperAdmin && event.price !== undefined && (
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
        )
      )}
      </>
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
