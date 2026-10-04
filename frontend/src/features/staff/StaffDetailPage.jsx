import { useEffect, useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  FiMail,
  FiPhone,
  FiDollarSign,
  FiShield,
  FiFileText,
  FiDownload,
  FiCheckCircle,
  FiClock,
  FiCalendar,
  FiUser,
  FiSearch,
  FiFilter,
  FiEdit,
  FiActivity,
  FiLayers,
  FiAlertTriangle,
  FiCopy,
  FiCheck,
  FiX,
  FiTool,
  FiTrendingUp,
  FiExternalLink,
  FiArrowLeft,
  FiRotateCcw,
  FiCheckSquare,
  FiAward,
  FiZap,
  FiKey,
  FiEye,
} from 'react-icons/fi';
import apiClient from '../../services/api-client';
import TableState from '../../components/ui/table/TableState';
import { StatusBadge } from '../../components/ui/primitives/Badge';
import Badge from '../../components/ui/primitives/Badge';
import StatCard from '../../components/ui/primitives/StatCard';
import BarChart from '../../components/ui/charts/BarChart';
import Modal from '../../components/ui/overlays/Modal';
import Button from '../../components/ui/primitives/Button';
import StaffForm from './StaffForm';
import { ImageLightboxModal } from '../../components/ui/overlays/ImageLightboxModal';
import { resolveImageUrl } from '../../utils/image-url';
import { hasPermission } from '../../utils/permissions';

const DAYS_SHOWN = 14;

// Converts to a YYYY-MM-DD string in the browser's local timezone
function toLocalDateValue(value) {
  if (!value) return '';
  const dt = new Date(value);
  if (isNaN(dt.getTime())) return '';
  const offset = dt.getTimezoneOffset();
  return new Date(dt.getTime() - offset * 60000).toISOString().slice(0, 10);
}

// Builds a fixed DAYS_SHOWN-day range ending today
function buildDailyCounts(visits) {
  const countsByDay = {};
  for (const v of visits) {
    if (v.repaired_at) {
      const day = new Date(v.repaired_at).toDateString();
      countsByDay[day] = (countsByDay[day] || 0) + 1;
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const series = [];
  for (let i = DAYS_SHOWN - 1; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    series.push({
      label: day.toLocaleDateString([], { day: '2-digit', month: 'short' }),
      count: countsByDay[day.toDateString()] || 0,
    });
  }
  return series;
}

// Formats duration seconds into clean human-readable text
function formatDuration(seconds) {
  if (seconds == null || isNaN(seconds)) return '—';
  const s = Math.round(Number(seconds));
  if (s <= 0) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const remS = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${remS}s`;
  return `${remS}s`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateOnly(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function StaffDetailPage() {
  const { id } = useParams();
  const currentUser = useSelector((state) => state.auth.user);
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const canManageStaff = isSuperAdmin || currentUser?.role === 'admin' || hasPermission(currentUser, 'staff');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // View Navigation Tabs: 'repairs' | 'disassembly' | 'tests' | 'issues' | 'profile'
  const [activeTab, setActiveTab] = useState('repairs');

  // Filters & State for Repairs
  const [datePreset, setDatePreset] = useState('all'); // 'all' | 'today' | 'yesterday' | '7days' | 'month' | 'custom'
  const [customDate, setCustomDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active_fleet' | 'completed' | 'removed' | 'in_repair'
  const [searchQuery, setSearchQuery] = useState('');

  // Search filter for other tabs
  const [disassemblySearch, setDisassemblySearch] = useState('');
  const [testsSearch, setTestsSearch] = useState('');
  const [issuesSearch, setIssuesSearch] = useState('');

  // Edit Modal State & Lightbox
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);
  const [lightboxImages, setLightboxImages] = useState(null);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    apiClient
      .get(`/staff/${id}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const copyToClipboard = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const { staff, repairs = [], issues = [], tests = [] } = data || {};

  // Disassembly vs Active repair breakdown
  const removedVisits = useMemo(() => {
    return (repairs || []).filter((v) => Boolean(v.parts_removed) || Boolean(v.removed_at) || v.outcome === 'parts_removed');
  }, [repairs]);

  const activeVisits = useMemo(() => {
    return (repairs || []).filter((v) => !v.parts_removed && !v.removed_at && v.outcome !== 'parts_removed');
  }, [repairs]);

  const completedVisits = useMemo(() => {
    return (repairs || []).filter(
      (v) => (v.battery_status === 'repaired' || v.battery_status === 'returned' || v.outcome === 'completed') && !v.parts_removed
    );
  }, [repairs]);

  const inProgressVisits = useMemo(() => {
    return (repairs || []).filter(
      (v) => v.battery_status !== 'repaired' && v.battery_status !== 'returned' && !v.parts_removed && v.battery_status !== 'recycled' && v.battery_status !== 'unserviceable'
    );
  }, [repairs]);

  // Average repair duration calculation
  const avgDurationFormatted = useMemo(() => {
    const validDurations = (repairs || [])
      .map((r) => Number(r.duration_seconds))
      .filter((s) => !isNaN(s) && s > 0);
    if (!validDurations.length) return '—';
    const total = validDurations.reduce((acc, curr) => acc + curr, 0);
    return formatDuration(total / validDurations.length);
  }, [repairs]);

  // Total labor value (excluding removed parts for true revenue)
  const totalLaborValue = useMemo(() => {
    return (repairs || []).reduce((acc, curr) => {
      if (curr.parts_removed) return acc;
      const val = Number(curr.labor_charge || curr.price || 0);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
  }, [repairs]);

  // Daily Chart counts (last 14 days)
  const dailyCounts = useMemo(() => buildDailyCounts(completedVisits), [completedVisits]);
  const hasRecentActivity = dailyCounts.some((d) => d.count > 0);
  const todayCount = dailyCounts[dailyCounts.length - 1]?.count || 0;
  const recent14DayTotal = dailyCounts.reduce((acc, d) => acc + d.count, 0);

  // Date filtering helper
  const matchesDatePreset = (dateStr) => {
    if (!dateStr) return false;
    if (datePreset === 'all') return true;

    const targetLocal = toLocalDateValue(dateStr);
    const now = new Date();
    const todayLocal = toLocalDateValue(now);

    if (datePreset === 'today') {
      return targetLocal === todayLocal;
    }

    if (datePreset === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return targetLocal === toLocalDateValue(yesterday);
    }

    if (datePreset === '7days') {
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const rowDate = new Date(dateStr);
      return rowDate >= sevenDaysAgo && rowDate <= now;
    }

    if (datePreset === 'month') {
      const rowDate = new Date(dateStr);
      return (
        rowDate.getFullYear() === now.getFullYear() &&
        rowDate.getMonth() === now.getMonth()
      );
    }

    if (datePreset === 'custom' && customDate) {
      return targetLocal === customDate;
    }

    return true;
  };

  // Filtered repairs list
  const filteredVisits = useMemo(() => {
    return (repairs || []).filter((r) => {
      // Status filter
      if (statusFilter === 'active_fleet') {
        if (r.parts_removed || r.battery_status === 'recycled' || r.battery_status === 'unserviceable') return false;
      } else if (statusFilter === 'completed') {
        if (r.battery_status !== 'repaired' && r.battery_status !== 'returned' && r.outcome !== 'completed') return false;
      } else if (statusFilter === 'removed') {
        if (!r.parts_removed && !r.removed_at && r.outcome !== 'parts_removed') return false;
      } else if (statusFilter === 'in_progress') {
        if (r.battery_status === 'repaired' || r.battery_status === 'returned' || r.parts_removed) return false;
      }

      // Date filter
      if (!matchesDatePreset(r.repaired_at)) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const code = (r.battery_code || '').toLowerCase();
        const serial = (r.serial_number || '').toLowerCase();
        const client = (r.client_name || '').toLowerCase();
        const part = (r.part_name || '').toLowerCase();
        const notes = (r.notes || '').toLowerCase();
        const batch = (r.batch_id || '').toLowerCase();
        if (
          !code.includes(q) &&
          !serial.includes(q) &&
          !client.includes(q) &&
          !part.includes(q) &&
          !notes.includes(q) &&
          !batch.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [repairs, statusFilter, datePreset, customDate, searchQuery]);

  // Filtered Disassembly / Removed List
  const filteredDisassembly = useMemo(() => {
    return removedVisits.filter((r) => {
      if (!disassemblySearch.trim()) return true;
      const q = disassemblySearch.toLowerCase();
      return (
        r.battery_code?.toLowerCase().includes(q) ||
        r.serial_number?.toLowerCase().includes(q) ||
        r.client_name?.toLowerCase().includes(q) ||
        r.part_name?.toLowerCase().includes(q) ||
        r.notes?.toLowerCase().includes(q)
      );
    });
  }, [removedVisits, disassemblySearch]);

  // Filtered QA Tests
  const filteredTests = useMemo(() => {
    return (tests || []).filter((t) => {
      if (!testsSearch.trim()) return true;
      const q = testsSearch.toLowerCase();
      return (
        t.battery_code?.toLowerCase().includes(q) ||
        t.serial_number?.toLowerCase().includes(q) ||
        t.client_name?.toLowerCase().includes(q) ||
        t.service_name?.toLowerCase().includes(q) ||
        t.notes?.toLowerCase().includes(q)
      );
    });
  }, [tests, testsSearch]);

  // Filtered issues list
  const filteredIssues = useMemo(() => {
    return (issues || []).filter((iss) => {
      if (!issuesSearch.trim()) return true;
      const q = issuesSearch.toLowerCase();
      return (
        iss.battery_code?.toLowerCase().includes(q) ||
        iss.serial_number?.toLowerCase().includes(q) ||
        iss.client_name?.toLowerCase().includes(q) ||
        iss.reason_label?.toLowerCase().includes(q) ||
        iss.note?.toLowerCase().includes(q)
      );
    });
  }, [issues, issuesSearch]);

  const hasActiveFilters =
    datePreset !== 'all' ||
    customDate !== '' ||
    statusFilter !== 'all' ||
    searchQuery.trim() !== '';

  const clearAllFilters = () => {
    setDatePreset('all');
    setCustomDate('');
    setStatusFilter('all');
    setSearchQuery('');
  };

  if (loading) {
    return (
      <div className="space-y-4 py-8">
        <TableState>Loading staff profile, repair logs, QA testing and compliance records…</TableState>
      </div>
    );
  }

  if (error || !staff) {
    return (
      <div className="space-y-4 py-8">
        <Link
          to="/staff"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-emerald-600 dark:text-neutral-300 dark:hover:text-emerald-400"
        >
          <FiArrowLeft className="w-4 h-4" />
          <span>Back to Staff Directory</span>
        </Link>
        <TableState tone="error">{error || 'Staff member not found.'}</TableState>
      </div>
    );
  }

  const isSupervisor = staff.role?.toLowerCase() === 'supervisor';
  const roleLabel = isSupervisor ? 'Workshop Supervisor' : 'Technician';
  const roleToneColor = isSupervisor
    ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border-purple-200 dark:border-purple-800/40'
    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40';

  const employeeCode = `EMP-${String(staff.id).padStart(4, '0')}`;
  const salaryNum = Number(staff.salary || 0);

  return (
    <div className="space-y-6 pb-16">
      {/* ── Top Breadcrumbs & Header Actions ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/staff"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
        >
          <FiArrowLeft className="w-4 h-4" />
          <span>Staff Directory</span>
          <span className="text-slate-300 dark:text-neutral-600">/</span>
          <span className="text-slate-900 dark:text-white font-mono">{employeeCode}</span>
        </Link>

        <div className="flex items-center gap-2">
          {canManageStaff && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold shadow-2xs hover:border-emerald-500 hover:text-emerald-600 dark:hover:border-emerald-400 dark:hover:text-emerald-400"
            >
              <FiEdit className="w-3.5 h-3.5" />
              <span>Edit Staff Profile</span>
            </Button>
          )}

          {staff.document_path && (
            <a
              href={resolveImageUrl(`/uploads/staff-docs/${staff.document_path}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-2xs transition-colors dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              <FiDownload className="w-3.5 h-3.5" />
              <span>Compliance Doc</span>
            </a>
          )}
        </div>
      </div>

      {/* ── Executive Hero Card ──────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-6 md:p-8 shadow-xs dark:border-white/10 dark:bg-surface-900 transition-all relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-emerald-500/5 via-teal-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative">
          {/* Avatar and Identity */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="relative">
              <div
                className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl text-3xl font-black shadow-inner tracking-wider ${
                  staff.active
                    ? 'bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 text-white shadow-emerald-500/20'
                    : 'bg-gradient-to-br from-slate-400 to-slate-600 text-white shadow-slate-500/10'
                }`}
              >
                {staff.name?.[0]?.toUpperCase() || 'S'}
              </div>
              <span
                className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-white dark:border-surface-900 ${
                  staff.active ? 'bg-emerald-500 shadow-xs' : 'bg-slate-400'
                }`}
                title={staff.active ? 'Active Staff Member' : 'Inactive Staff Member'}
              />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {staff.name}
                </h1>
                <span className="font-mono text-xs font-bold text-slate-400 dark:text-neutral-500 bg-slate-100 dark:bg-surface-800 px-2 py-0.5 rounded-md">
                  {employeeCode}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold border ${roleToneColor}`}
                >
                  <FiShield className="w-3 h-3" />
                  <span>{roleLabel}</span>
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    staff.active
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                      : 'bg-slate-100 text-slate-600 dark:bg-surface-800 dark:text-neutral-400'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${staff.active ? 'bg-emerald-500' : 'bg-slate-400'}`}
                  />
                  <span>{staff.active ? 'Active in Workshop' : 'Inactive'}</span>
                </span>
              </div>

              {/* Sub-header contacts */}
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500 dark:text-neutral-400">
                {staff.phone && (
                  <a
                    href={`tel:${staff.phone}`}
                    className="inline-flex items-center gap-1.5 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors font-medium"
                  >
                    <FiPhone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{staff.phone}</span>
                  </a>
                )}
                {(staff.email || staff.linked_user_email) && (
                  <a
                    href={`mailto:${staff.email || staff.linked_user_email}`}
                    className="inline-flex items-center gap-1.5 font-mono hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors font-medium"
                  >
                    <FiMail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{staff.email || staff.linked_user_email}</span>
                  </a>
                )}
                {staff.created_at && (
                  <span className="inline-flex items-center gap-1.5">
                    <FiCalendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Joined {formatDateOnly(staff.created_at)}</span>
                  </span>
                )}
                {staff.user_id && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300">
                    <FiKey className="w-3 h-3" />
                    <span>Technician Portal Account Active</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Output Highlights Pill */}
          <div className="flex md:flex-col items-end gap-2 shrink-0">
            <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-100 dark:bg-surface-850 dark:border-white/5 text-right w-full sm:w-auto">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500 block">
                Total Output
              </span>
              <span className="text-xl font-black text-slate-900 dark:text-white font-mono block mt-0.5">
                {repairs.length + tests.length} Actions
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold block">
                {completedVisits.length} repairs &bull; {tests.length} tests
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Identification, Right to Work & Compensation ─────────────────────── */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-surface-900 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700 dark:bg-surface-800 dark:text-neutral-300">
              <FiShield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Credentials &amp; Right to Work Compliance
              </h3>
              <p className="text-xs text-slate-500 dark:text-neutral-400">
                Official employee credentials, identity, and workshop authorizations.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* NI Number */}
          <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-surface-850 border border-slate-100 dark:border-white/5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                National Insurance (NI)
              </span>
              <span className="font-mono font-black text-sm text-slate-900 dark:text-white mt-1 block">
                {staff.ni_number || '—'}
              </span>
            </div>
            {staff.ni_number && (
              <button
                type="button"
                onClick={() => copyToClipboard(staff.ni_number, 'ni')}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 hover:bg-slate-200/60 dark:hover:bg-surface-800 transition-colors"
                title="Copy NI Number"
              >
                {copiedKey === 'ni' ? (
                  <FiCheck className="w-4 h-4 text-emerald-600" />
                ) : (
                  <FiCopy className="w-4 h-4" />
                )}
              </button>
            )}
          </div>

          {/* Passport Number */}
          <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-surface-850 border border-slate-100 dark:border-white/5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Passport / ID Document
              </span>
              <span className="font-mono font-bold text-sm text-slate-800 dark:text-neutral-200 mt-1 block">
                {staff.passport_number || '—'}
              </span>
            </div>
            {staff.passport_number && (
              <button
                type="button"
                onClick={() => copyToClipboard(staff.passport_number, 'passport')}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 hover:bg-slate-200/60 dark:hover:bg-surface-800 transition-colors"
                title="Copy Passport"
              >
                {copiedKey === 'passport' ? (
                  <FiCheck className="w-4 h-4 text-emerald-600" />
                ) : (
                  <FiCopy className="w-4 h-4" />
                )}
              </button>
            )}
          </div>

          {/* Share Code */}
          <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-surface-850 border border-slate-100 dark:border-white/5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Right to Work Share Code
              </span>
              <span className="font-mono font-bold text-sm text-slate-800 dark:text-neutral-200 mt-1 block">
                {staff.share_code || '—'}
              </span>
            </div>
            {staff.share_code && (
              <button
                type="button"
                onClick={() => copyToClipboard(staff.share_code, 'share')}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 hover:bg-slate-200/60 dark:hover:bg-surface-800 transition-colors"
                title="Copy Share Code"
              >
                {copiedKey === 'share' ? (
                  <FiCheck className="w-4 h-4 text-emerald-600" />
                ) : (
                  <FiCopy className="w-4 h-4" />
                )}
              </button>
            )}
          </div>

          {/* Salary / Compensation (Visible to admin/super_admin) */}
          <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-surface-850 border border-slate-100 dark:border-white/5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Monthly / Contract Wage
              </span>
              <span className="font-mono font-black text-sm text-slate-900 dark:text-white mt-1 block">
                {isSuperAdmin || canManageStaff ? (salaryNum > 0 ? `£${salaryNum.toFixed(2)}` : 'Standard Hourly') : 'Restricted'}
              </span>
            </div>
            <div className="p-1.5 rounded-lg text-slate-400 bg-slate-100 dark:bg-surface-800">
              <FiDollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </div>

        {/* Uploaded Verification File Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 dark:bg-surface-850 dark:border-white/5">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
              <FiFileText className="w-5 h-5 shrink-0" />
            </div>
            <div>
              <span className="font-bold text-xs text-slate-900 dark:text-white block">
                {staff.document_name || (staff.document_path ? 'Official Identity & Compliance Document' : 'No document on file')}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-neutral-400">
                {staff.document_path
                  ? 'Secure document stored on server for audit and compliance requirements'
                  : 'Upload an identity card, proof of address, or right-to-work passport file by clicking Edit Staff Profile'}
              </span>
            </div>
          </div>

          {staff.document_path && (
            <a
              href={resolveImageUrl(`/uploads/staff-docs/${staff.document_path}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-2xs transition-colors shrink-0"
            >
              <FiDownload className="w-3.5 h-3.5" />
              <span>Download Document</span>
            </a>
          )}
        </div>
      </div>

      {/* ── Key Performance Indicators (KPI Cards) ─────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <StatCard
          label="Repairs Completed"
          value={completedVisits.length}
          tone="good"
          sub="Finished jobs"
        />
        <StatCard
          label="Active in Fleet"
          value={activeVisits.length}
          tone="info"
          sub="Running in client fleets"
        />
        <StatCard
          label="Reclaimed Parts"
          value={removedVisits.length}
          tone="warn"
          sub="Disassembled components"
        />
        <StatCard
          label="QA Testing Sign-offs"
          value={tests.length}
          tone="neutral"
          sub={isSupervisor ? 'Supervisor testing' : 'Signed inspections'}
        />
        <StatCard
          label="Avg Duration"
          value={avgDurationFormatted}
          tone="neutral"
          sub="Time per job"
        />
        <StatCard
          label="Labor Value"
          value={isSuperAdmin ? `£${totalLaborValue.toFixed(2)}` : 'Active'}
          tone="good"
          sub={isSuperAdmin ? 'Total labor billed' : 'Workshop staff'}
        />
      </div>

      {/* ── 14-Day Velocity & Output Chart ─────────────────────────────────── */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-surface-900">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <FiTrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">
                Daily Repair Velocity (Last {DAYS_SHOWN} Days)
              </h2>
              <p className="text-xs text-slate-500 dark:text-neutral-400">
                Number of completed repair battery operations logged per calendar day.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full font-mono">
              {recent14DayTotal} finished in last 14 days
            </span>
            {todayCount > 0 && (
              <span className="text-xs font-bold text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 px-2.5 py-1 rounded-full font-mono">
                {todayCount} today
              </span>
            )}
          </div>
        </div>

        {hasRecentActivity ? (
          <div className="pt-2">
            <BarChart data={dailyCounts} color="#10b981" activeColor="#059669" />
          </div>
        ) : (
          <p className="py-8 text-center text-xs text-slate-400 dark:text-neutral-500">
            No completed repairs logged in the last {DAYS_SHOWN} days.
          </p>
        )}
      </div>

      {/* ── Navigation Tabs ─────────────────────────────────────────────────── */}
      <div className="border-b border-slate-200 dark:border-white/10">
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-px">
          {/* Tab 1: Repairs */}
          <button
            type="button"
            onClick={() => setActiveTab('repairs')}
            className={`inline-flex items-center gap-2 border-b-2 py-3 px-3.5 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'repairs'
                ? 'border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            <FiTool className="w-4 h-4" />
            <span>Repairs &amp; Fitted ({repairs.length})</span>
          </button>

          {/* Tab 2: Disassembly & Reclaimed Parts */}
          <button
            type="button"
            onClick={() => setActiveTab('disassembly')}
            className={`inline-flex items-center gap-2 border-b-2 py-3 px-3.5 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'disassembly'
                ? 'border-amber-600 text-amber-700 dark:border-amber-400 dark:text-amber-300'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            <FiRotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Disassembly &amp; Reclaimed ({removedVisits.length})</span>
          </button>

          {/* Tab 3: QA Testing & Sign-Offs */}
          <button
            type="button"
            onClick={() => setActiveTab('tests')}
            className={`inline-flex items-center gap-2 border-b-2 py-3 px-3.5 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'tests'
                ? 'border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            <FiCheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>QA Testing &amp; Sign-Offs ({tests.length})</span>
          </button>

          {/* Tab 4: Reported Issues */}
          <button
            type="button"
            onClick={() => setActiveTab('issues')}
            className={`inline-flex items-center gap-2 border-b-2 py-3 px-3.5 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'issues'
                ? 'border-red-600 text-red-700 dark:border-red-400 dark:text-red-300'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            <FiAlertTriangle className="w-4 h-4 text-red-500" />
            <span>Reported Issues ({issues.length})</span>
          </button>
        </div>
      </div>

      {/* ── TAB 1: Repairs & Assemblies ─────────────────────────────────────── */}
      {activeTab === 'repairs' && (
        <div className="space-y-4">
          {/* Search, Filter Bar and Date Presets */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200/90 shadow-2xs dark:bg-surface-900 dark:border-white/10">
            {/* Search Input */}
            <div className="relative min-w-[260px] flex-1">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search battery code, serial, client fleet, parts, notes…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-surface-800 dark:text-white dark:placeholder:text-neutral-500"
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

            {/* Status Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-400 dark:text-neutral-500">Status:</span>
              {[
                { id: 'all', label: `All (${repairs.length})` },
                { id: 'active_fleet', label: `Active Fleet (${activeVisits.length})` },
                { id: 'completed', label: `Completed (${completedVisits.length})` },
                { id: 'removed', label: `Parts Reclaimed (${removedVisits.length})` },
              ].map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setStatusFilter(btn.id)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    statusFilter === btn.id
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-surface-800 dark:text-neutral-300 dark:hover:bg-surface-700'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Date Preset Pills */}
            <div className="flex items-center gap-1.5 flex-wrap border-t lg:border-t-0 pt-2 lg:pt-0 border-slate-100 dark:border-white/5">
              <span className="text-xs font-bold text-slate-400 dark:text-neutral-500">Date:</span>
              {[
                { id: 'all', label: 'All' },
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: '7days', label: '7 Days' },
                { id: 'custom', label: 'Custom' },
              ].map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setDatePreset(preset.id)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    datePreset === preset.id
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-surface-800 dark:text-neutral-300'
                  }`}
                >
                  {preset.label}
                </button>
              ))}

              {datePreset === 'custom' && (
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="rounded-xl border border-emerald-300 bg-emerald-50/50 px-2 py-1 text-xs font-semibold text-slate-900 focus:outline-hidden dark:border-emerald-800 dark:bg-surface-800 dark:text-neutral-100"
                />
              )}

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-xs font-bold text-red-600 hover:underline dark:text-red-400 ml-1"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Repairs Table */}
          {filteredVisits.length === 0 ? (
            <div className="rounded-3xl border border-slate-200/90 bg-white p-12 text-center shadow-2xs dark:border-white/10 dark:bg-surface-900">
              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                <FiTool className="w-6 h-6" />
              </div>
              <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
                {repairs.length === 0 ? 'No repairs logged yet for this technician' : 'No repairs match active filters'}
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400 max-w-sm mx-auto">
                {hasActiveFilters ? 'Try adjusting your search query, status, or date range filters above.' : 'Repairs submitted via the workshop app will automatically populate here.'}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="mt-3 text-xs font-bold text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  Reset all filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-2xs dark:border-white/10 dark:bg-surface-900">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200/80 dark:bg-surface-850 dark:border-white/10 dark:text-neutral-300">
                    <tr>
                      <th className="py-3.5 px-4">Battery / Code</th>
                      <th className="py-3.5 px-4">Client Fleet</th>
                      <th className="py-3.5 px-4">Battery Status</th>
                      <th className="py-3.5 px-4">Work Outcome</th>
                      <th className="py-3.5 px-4">Parts Installed</th>
                      <th className="py-3.5 px-4">Duration</th>
                      {isSuperAdmin && <th className="py-3.5 px-4">Labor Value</th>}
                      <th className="py-3.5 px-4">Repaired At</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                    {filteredVisits.map((row) => {
                      const partsList = (row.part_name || '').split(',').map((p) => p.trim()).filter(Boolean);
                      const isRemoved = Boolean(row.parts_removed) || Boolean(row.removed_at) || row.outcome === 'parts_removed';

                      return (
                        <tr
                          key={row.batch_id || row.id}
                          className="hover:bg-slate-50/60 dark:hover:bg-white/5 transition-colors"
                        >
                          {/* Battery Code & Serial */}
                          <td className="py-3.5 px-4">
                            <Link
                              to={`/batteries/${encodeURIComponent(row.battery_code)}`}
                              className="font-mono font-bold text-slate-900 hover:text-emerald-600 hover:underline dark:text-white dark:hover:text-emerald-400"
                            >
                              {row.battery_code}
                            </Link>
                            {row.serial_number && (
                              <span className="text-[10px] text-slate-400 block font-mono">
                                SN: {row.serial_number}
                              </span>
                            )}
                          </td>

                          {/* Client Fleet */}
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-slate-800 dark:text-neutral-200">
                              {row.client_name || '—'}
                            </span>
                          </td>

                          {/* Battery Status */}
                          <td className="py-3.5 px-4">
                            <StatusBadge status={row.battery_status} />
                          </td>

                          {/* Work Outcome */}
                          <td className="py-3.5 px-4">
                            {isRemoved ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                <FiRotateCcw className="w-3 h-3" />
                                <span>Parts Reclaimed</span>
                              </span>
                            ) : row.outcome === 'completed' || row.battery_status === 'repaired' || row.battery_status === 'returned' ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                <FiCheckCircle className="w-3 h-3" />
                                <span>Completed</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                                <FiActivity className="w-3 h-3" />
                                <span>In Progress</span>
                              </span>
                            )}
                          </td>

                          {/* Parts Installed */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1">
                              {partsList.length > 0 ? (
                                partsList.map((part, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-surface-800 dark:text-neutral-300"
                                  >
                                    {part}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400 dark:text-neutral-500">—</span>
                              )}
                            </div>
                          </td>

                          {/* Duration */}
                          <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-neutral-400">
                            {formatDuration(row.duration_seconds)}
                          </td>

                          {/* Labor / Revenue */}
                          {isSuperAdmin && (
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                              £{Number(row.labor_charge || row.price || 0).toFixed(2)}
                            </td>
                          )}

                          {/* Date & Time */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col">
                              <span className="text-slate-800 dark:text-neutral-200">
                                {formatDateOnly(row.repaired_at)}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(row.repaired_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </td>

                          {/* Action Link */}
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
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 p-4 text-xs text-slate-500 dark:border-white/5 dark:bg-surface-850 dark:text-neutral-400">
                <span>
                  Showing {filteredVisits.length} of {repairs.length} total repair entries
                </span>
                <span className="font-mono font-semibold text-slate-700 dark:text-neutral-300">
                  Completed: {completedVisits.length} &bull; Reclaimed: {removedVisits.length}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: Disassembly & Reclaimed Parts ───────────────────────────── */}
      {activeTab === 'disassembly' && (
        <div className="space-y-4">
          {/* Explanation Alert Banner */}
          <div className="rounded-3xl border border-amber-200/90 bg-amber-50/60 p-5 dark:border-amber-900/40 dark:bg-amber-950/20 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
              <FiRotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-amber-900 dark:text-amber-200">
                Workshop Component Salvage &amp; Disassembly Operations ({removedVisits.length} events)
              </h4>
              <p className="mt-0.5 text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                When batteries are declared unserviceable, fail QA verification, or are sent to recycling, this technician disassembles and salvages working fitted parts back into active stock.
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="rounded-2xl border border-amber-200/80 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Salvaged Disassemblies
              </span>
              <p className="mt-1 text-2xl font-black text-amber-700 dark:text-amber-400 font-mono">
                {removedVisits.length} batteries
              </p>
              <span className="text-[10px] text-slate-500">Components recovered for reuse</span>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Distinct Client Fleets
              </span>
              <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white font-mono">
                {new Set(removedVisits.map((r) => r.client_name).filter(Boolean)).size} Fleets
              </p>
              <span className="text-[10px] text-slate-500">Salvaged across client pools</span>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Workshop Salvage Status
              </span>
              <p className="mt-1 text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
                100% Salvage Recorded
              </p>
              <span className="text-[10px] text-slate-500">Audit trail preserved in parts ledger</span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200/90 shadow-2xs dark:bg-surface-900 dark:border-white/10">
            <div className="relative flex-1 max-w-md">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search battery code, serial, client fleet, parts salvaged…"
                value={disassemblySearch}
                onChange={(e) => setDisassemblySearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-100"
              />
            </div>
          </div>

          {/* Table */}
          {filteredDisassembly.length === 0 ? (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-12 text-center shadow-2xs dark:border-white/10 dark:bg-surface-900">
              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                <FiRotateCcw className="w-6 h-6" />
              </div>
              <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
                {removedVisits.length === 0 ? 'No disassembled parts recorded for this technician' : 'No records match search'}
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400 max-w-sm mx-auto">
                {removedVisits.length === 0
                  ? 'All repair jobs installed by this technician currently remain active in fleet.'
                  : 'Clear the search query above to see all disassembly records.'}
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
                      <th className="py-3.5 px-4">Battery Status</th>
                      <th className="py-3.5 px-4">Parts Salvaged</th>
                      <th className="py-3.5 px-4">Disassembly Date</th>
                      <th className="py-3.5 px-4">Originally Installed</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                    {filteredDisassembly.map((row) => (
                      <tr key={row.batch_id || row.id} className="hover:bg-amber-50/30 dark:hover:bg-white/5 transition-colors">
                        <td className="py-3.5 px-4">
                          <Link
                            to={`/batteries/${encodeURIComponent(row.battery_code)}`}
                            className="font-mono font-bold text-amber-900 hover:underline dark:text-amber-400"
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
                            {row.part_name || 'Fitted Components'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 font-bold text-amber-900 dark:text-amber-300">
                          {formatDate(row.removed_at || row.repaired_at)}
                        </td>

                        <td className="py-3.5 px-4 text-slate-500 dark:text-neutral-400">
                          {formatDateOnly(row.repaired_at)}
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
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: QA Testing & Sign-Offs ───────────────────────────────────── */}
      {activeTab === 'tests' && (
        <div className="space-y-4">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="rounded-2xl border border-blue-200/80 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Total Inspections &amp; Tests
              </span>
              <p className="mt-1 text-2xl font-black text-blue-700 dark:text-blue-400 font-mono">
                {tests.length} tests
              </p>
              <span className="text-[10px] text-slate-500">Quality assurance sign-offs</span>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Verified &amp; Passed
              </span>
              <p className="mt-1 text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
                {tests.filter((t) => !t.passed_back).length} passed
              </p>
              <span className="text-[10px] text-slate-500">Approved for fleet deployment</span>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Sent Back for Rework
              </span>
              <p className="mt-1 text-2xl font-black text-amber-700 dark:text-amber-400 font-mono">
                {tests.filter((t) => t.passed_back).length} reworked
              </p>
              <span className="text-[10px] text-slate-500">Returned to technicians pool</span>
            </div>
          </div>

          {/* Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200/90 shadow-2xs dark:bg-surface-900 dark:border-white/10">
            <div className="relative flex-1 max-w-md">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search battery code, serial, client fleet, test service…"
                value={testsSearch}
                onChange={(e) => setTestsSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-100"
              />
            </div>
          </div>

          {/* Tests Table */}
          {filteredTests.length === 0 ? (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-12 text-center shadow-2xs dark:border-white/10 dark:bg-surface-900">
              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
                <FiCheckSquare className="w-6 h-6" />
              </div>
              <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
                {tests.length === 0 ? 'No QA test sign-offs logged for this staff member' : 'No tests match search'}
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400 max-w-sm mx-auto">
                {tests.length === 0
                  ? 'Supervisors and QA testers log battery test verification and cycling runs before returning batteries to clients.'
                  : 'Clear search to view all logged QA tests.'}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-blue-200/80 bg-white shadow-2xs dark:border-white/10 dark:bg-surface-900">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-xs">
                  <thead className="bg-blue-50/70 text-[11px] font-bold uppercase tracking-wider text-blue-900 border-b border-blue-200/70 dark:bg-surface-850 dark:border-white/10 dark:text-blue-300">
                    <tr>
                      <th className="py-3.5 px-4">Battery / Code</th>
                      <th className="py-3.5 px-4">Client Fleet</th>
                      <th className="py-3.5 px-4">Current Status</th>
                      <th className="py-3.5 px-4">Test Service / Verification</th>
                      <th className="py-3.5 px-4">Duration</th>
                      <th className="py-3.5 px-4">QA Outcome</th>
                      <th className="py-3.5 px-4">Tested At</th>
                      <th className="py-3.5 px-4">Notes</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                    {filteredTests.map((t) => (
                      <tr key={t.id} className="hover:bg-blue-50/30 dark:hover:bg-white/5 transition-colors">
                        <td className="py-3.5 px-4">
                          <Link
                            to={`/batteries/${encodeURIComponent(t.battery_code)}`}
                            className="font-mono font-bold text-blue-900 hover:underline dark:text-blue-400"
                          >
                            {t.battery_code}
                          </Link>
                          {t.serial_number && (
                            <span className="text-[10px] text-slate-400 block font-mono">
                              SN: {t.serial_number}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-800 dark:text-neutral-200">
                            {t.client_name || '—'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <StatusBadge status={t.battery_status} />
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {t.service_name}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-neutral-400">
                          {formatDuration(t.testing_duration_seconds)}
                        </td>

                        <td className="py-3.5 px-4">
                          {t.passed_back ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                              <FiRotateCcw className="w-3 h-3" />
                              <span>Passed Back to Tech</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                              <FiCheckCircle className="w-3 h-3" />
                              <span>Verified &amp; Passed</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-slate-700 dark:text-neutral-300">
                          {formatDate(t.tested_at)}
                        </td>

                        <td className="py-3.5 px-4 text-slate-500 dark:text-neutral-400 max-w-[180px] truncate" title={t.notes || ''}>
                          {t.notes || '—'}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <Link
                            to={`/batteries/${encodeURIComponent(t.battery_code)}`}
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
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: Reported Diagnostic Issues ──────────────────────────────── */}
      {activeTab === 'issues' && (
        <div className="space-y-4">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="rounded-2xl border border-red-200/80 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Issues Logged
              </span>
              <p className="mt-1 text-2xl font-black text-red-700 dark:text-red-400 font-mono">
                {issues.length} incidents
              </p>
              <span className="text-[10px] text-slate-500">Unserviceable or defect reports</span>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Photo Evidence Attached
              </span>
              <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white font-mono">
                {issues.filter((i) => (i.photo_urls || []).length > 0).length} reports
              </p>
              <span className="text-[10px] text-slate-500">With inspection photos</span>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Failure Categories
              </span>
              <p className="mt-1 text-2xl font-black text-amber-700 dark:text-amber-400 font-mono">
                {new Set(issues.map((i) => i.reason_label)).size} types
              </p>
              <span className="text-[10px] text-slate-500">Distinct defect classifications</span>
            </div>
          </div>

          {/* Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200/90 shadow-2xs dark:bg-surface-900 dark:border-white/10">
            <div className="relative flex-1 max-w-md">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search battery code, serial, client fleet, failure reason, note…"
                value={issuesSearch}
                onChange={(e) => setIssuesSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-red-500/20 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-100"
              />
            </div>
          </div>

          {/* Issues Table */}
          {filteredIssues.length === 0 ? (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-12 text-center shadow-2xs dark:border-white/10 dark:bg-surface-900">
              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400">
                <FiAlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
                {issues.length === 0 ? 'No issues reported by this technician' : 'No issues match search'}
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400 max-w-sm mx-auto">
                {issues.length === 0
                  ? 'All battery operations completed normally without unserviceable escalations.'
                  : 'Clear search to view all reported defect issues.'}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-red-200/80 bg-white shadow-2xs dark:border-white/10 dark:bg-surface-900">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-xs">
                  <thead className="bg-red-50/70 text-[11px] font-bold uppercase tracking-wider text-red-900 border-b border-red-200/70 dark:bg-surface-850 dark:border-white/10 dark:text-red-300">
                    <tr>
                      <th className="py-3.5 px-4">Battery / Code</th>
                      <th className="py-3.5 px-4">Client Fleet</th>
                      <th className="py-3.5 px-4">Current Status</th>
                      <th className="py-3.5 px-4">Reason / Defect</th>
                      <th className="py-3.5 px-4">Diagnostic Note</th>
                      <th className="py-3.5 px-4">Photos</th>
                      <th className="py-3.5 px-4">Reported At</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                    {filteredIssues.map((iss) => {
                      const photos = iss.photo_urls || [];

                      return (
                        <tr key={iss.id} className="hover:bg-red-50/30 dark:hover:bg-white/5 transition-colors">
                          <td className="py-3.5 px-4">
                            <Link
                              to={`/batteries/${encodeURIComponent(iss.battery_code)}`}
                              className="font-mono font-bold text-red-900 hover:underline dark:text-red-400"
                            >
                              {iss.battery_code}
                            </Link>
                            {iss.serial_number && (
                              <span className="text-[10px] text-slate-400 block font-mono">
                                SN: {iss.serial_number}
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-slate-800 dark:text-neutral-200">
                              {iss.client_name || '—'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <StatusBadge status={iss.battery_status} />
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center rounded-md bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-900 dark:bg-red-950/60 dark:text-red-200">
                              {iss.reason_label || 'Unserviceable'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-slate-700 dark:text-neutral-300 max-w-[240px] truncate" title={iss.note || ''}>
                            {iss.note || '—'}
                          </td>

                          <td className="py-3.5 px-4">
                            {photos.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => setLightboxImages(photos)}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-surface-800 dark:text-neutral-300 text-[11px] font-bold"
                              >
                                <FiEye className="w-3 h-3 text-red-600" />
                                <span>{photos.length} Photo{photos.length === 1 ? '' : 's'}</span>
                              </button>
                            ) : (
                              <span className="text-slate-400 dark:text-neutral-500">—</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-slate-700 dark:text-neutral-300">
                            {formatDate(iss.reported_at)}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <Link
                              to={`/batteries/${encodeURIComponent(iss.battery_code)}`}
                              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline dark:text-emerald-400"
                            >
                              <span>Inspect</span>
                              <FiExternalLink className="w-3 h-3" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Lightbox Modal for Issue Photos ──────────────────────────────────── */}
      {lightboxImages && (
        <ImageLightboxModal
          images={lightboxImages}
          onClose={() => setLightboxImages(null)}
          title="Diagnostic Defect Photos"
        />
      )}

      {/* ── Edit Staff Modal ─────────────────────────────────────────────────── */}
      {isEditModalOpen && (
        <Modal
          size="3xl"
          title={`Edit Staff Profile — ${staff.name}`}
          description="Update employee credentials, national insurance, wage, and identity documentation."
          onClose={() => setIsEditModalOpen(false)}
        >
          <StaffForm
            staff={staff}
            onSaved={() => {
              setIsEditModalOpen(false);
              fetchData();
            }}
            onCancel={() => setIsEditModalOpen(false)}
          />
        </Modal>
      )}
    </div>
  );
}

export default StaffDetailPage;
