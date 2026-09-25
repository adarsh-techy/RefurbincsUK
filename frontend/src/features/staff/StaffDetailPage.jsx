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
} from 'react-icons/fi';
import apiClient from '../../services/api-client';
import PageHeader from '../../components/ui/primitives/PageHeader';
import TableState from '../../components/ui/table/TableState';
import { StatusBadge } from '../../components/ui/primitives/Badge';
import Badge from '../../components/ui/primitives/Badge';
import StatCard from '../../components/ui/primitives/StatCard';
import BarChart from '../../components/ui/charts/BarChart';
import Modal from '../../components/ui/overlays/Modal';
import Button from '../../components/ui/primitives/Button';
import StaffForm from './StaffForm';
import { resolveImageUrl } from '../../utils/image-url';

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
  if (seconds == null || isNaN(seconds)) return null;
  const s = Math.round(Number(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const remS = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${remS}s`;
  return `${remS}s`;
}

function StaffDetailPage() {
  const { id } = useParams();
  const currentUser = useSelector((state) => state.auth.user);
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & State
  const [datePreset, setDatePreset] = useState('all'); // 'all' | 'today' | 'yesterday' | '7days' | 'month' | 'custom'
  const [customDate, setCustomDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'completed' | 'in_progress'
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('repairs'); // 'repairs' | 'issues'

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

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

  const { staff, repairs = [], issues = [] } = data || {};

  // Completed vs In-progress repairs
  const completedVisits = useMemo(() => {
    return (repairs || []).filter(
      (v) => v.battery_status === 'repaired' || v.battery_status === 'returned'
    );
  }, [repairs]);

  const inProgressVisits = useMemo(() => {
    return (repairs || []).filter(
      (v) => v.battery_status !== 'repaired' && v.battery_status !== 'returned'
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

  // Total labor value
  const totalLaborValue = useMemo(() => {
    return (repairs || []).reduce((acc, curr) => {
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

  // Filtered visits list
  const filteredVisits = useMemo(() => {
    return (repairs || []).filter((r) => {
      // Status filter
      if (statusFilter === 'completed') {
        if (r.battery_status !== 'repaired' && r.battery_status !== 'returned') return false;
      } else if (statusFilter === 'in_progress') {
        if (r.battery_status === 'repaired' || r.battery_status === 'returned') return false;
      }

      // Date filter
      if (!matchesDatePreset(r.repaired_at)) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const code = (r.battery_code || '').toLowerCase();
        const part = (r.part_name || '').toLowerCase();
        const notes = (r.notes || '').toLowerCase();
        const batch = (r.batch_id || '').toLowerCase();
        if (!code.includes(q) && !part.includes(q) && !notes.includes(q) && !batch.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [repairs, statusFilter, datePreset, customDate, searchQuery]);

  // Filtered issues list
  const filteredIssues = useMemo(() => {
    return (issues || []).filter((iss) => {
      // Date filter
      if (!matchesDatePreset(iss.reported_at)) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const code = (iss.battery_code || '').toLowerCase();
        const reason = (iss.reason_label || '').toLowerCase();
        const note = (iss.note || '').toLowerCase();
        if (!code.includes(q) && !reason.includes(q) && !note.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [issues, datePreset, customDate, searchQuery]);

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

  if (loading) return <TableState>Loading staff profile and work history…</TableState>;

  if (error || !staff) {
    return (
      <div className="space-y-4">
        <Link
          to="/staff"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:underline dark:text-emerald-400"
        >
          ← Back to Staff Members
        </Link>
        <TableState tone="error">{error || 'Staff member not found.'}</TableState>
      </div>
    );
  }

  const roleLabel = staff.role
    ? staff.role.charAt(0).toUpperCase() + staff.role.slice(1)
    : 'Technician';

  return (
    <div className="space-y-6 pb-12">
      {/* Top Breadcrumb & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/staff"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
        >
          ← Back to Staff
        </Link>

        {isSuperAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-bold shadow-2xs"
          >
            <FiEdit className="w-3.5 h-3.5" />
            <span>Edit Staff Profile</span>
          </Button>
        )}
      </div>

      {/* Main Staff Header Profile Banner */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 md:p-6 shadow-sm dark:border-white/10 dark:bg-surface-850">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start md:items-center gap-4">
            <div className="relative">
              <div
                className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-black shadow-inner ${
                  staff.active
                    ? 'bg-linear-to-br from-emerald-500 to-teal-600 text-white'
                    : 'bg-linear-to-br from-slate-400 to-slate-600 text-white'
                }`}
              >
                {staff.name?.[0]?.toUpperCase() || 'S'}
              </div>
              <span
                className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white dark:border-surface-850 ${
                  staff.active ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
                title={staff.active ? 'Active' : 'Inactive'}
              />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {staff.name}
                </h1>
                <Badge tone={staff.active ? 'good' : 'neutral'}>
                  {staff.active ? 'Active' : 'Inactive'}
                </Badge>
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                  {roleLabel}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-neutral-400">
                {staff.phone && (
                  <a
                    href={`tel:${staff.phone}`}
                    className="inline-flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    <FiPhone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{staff.phone}</span>
                  </a>
                )}
                {(staff.email || staff.linked_user_email) && (
                  <a
                    href={`mailto:${staff.email || staff.linked_user_email}`}
                    className="inline-flex items-center gap-1.5 font-mono hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    <FiMail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{staff.email || staff.linked_user_email}</span>
                  </a>
                )}
                {staff.created_at && (
                  <span className="inline-flex items-center gap-1.5">
                    <FiCalendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Joined {new Date(staff.created_at).toLocaleDateString([], { month: 'short', year: 'numeric', day: 'numeric' })}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Identification & Right to Work Compliance */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-surface-850 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <FiShield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Identification & Right to Work Compliance
              </h3>
              <p className="text-xs text-slate-500 dark:text-neutral-400">
                Official employee credentials, national insurance, and identity documentation.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* NI Number */}
          <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-surface-900/60 border border-slate-100 dark:border-white/5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                NI Number (National Insurance)
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
                {copiedKey === 'ni' ? <FiCheck className="w-4 h-4 text-emerald-600" /> : <FiCopy className="w-4 h-4" />}
              </button>
            )}
          </div>

          {/* Passport Number */}
          <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-surface-900/60 border border-slate-100 dark:border-white/5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Passport Number
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
                {copiedKey === 'passport' ? <FiCheck className="w-4 h-4 text-emerald-600" /> : <FiCopy className="w-4 h-4" />}
              </button>
            )}
          </div>

          {/* Share Code */}
          <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-surface-900/60 border border-slate-100 dark:border-white/5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Share Code (Right to Work)
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
                {copiedKey === 'share' ? <FiCheck className="w-4 h-4 text-emerald-600" /> : <FiCopy className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {/* Uploaded Document Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
              <FiFileText className="w-4 h-4 shrink-0" />
            </div>
            <div>
              <span className="font-bold text-xs text-slate-900 dark:text-white block">
                {staff.document_name || (staff.document_path ? 'Staff Compliance Document' : 'No document uploaded')}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-neutral-400">
                {staff.document_path
                  ? 'Official verification file stored securely'
                  : 'You can upload an ID or passport file by clicking "Edit Staff Profile"'}
              </span>
            </div>
          </div>

          {staff.document_path && (
            <a
              href={resolveImageUrl(`/uploads/staff-docs/${staff.document_path}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-2xs transition-colors shrink-0"
            >
              <FiDownload className="w-3.5 h-3.5" />
              <span>Download Document</span>
            </a>
          )}
        </div>
      </div>

      {/* KPI Performance Stat Cards Grid */}
      <div className={`grid grid-cols-2 ${isSuperAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-3'} gap-3.5`}>
        <StatCard
          label="Total Completed"
          value={completedVisits.length}
          tone="good"
          sub="All-time completed repairs"
        />
        <StatCard
          label="Repairs Today"
          value={todayCount}
          tone="info"
          sub="Logged on today's shift"
        />
        <StatCard
          label="In Progress"
          value={inProgressVisits.length}
          tone="warn"
          sub="Mid-cycle / in testing"
        />
        {isSuperAdmin && (
          <StatCard
            label="Avg Duration"
            value={avgDurationFormatted}
            tone="neutral"
            sub="Start to completion"
          />
        )}
        {isSuperAdmin && (
          <StatCard
            label="Labor Value"
            value={`£${totalLaborValue.toFixed(2)}`}
            tone="good"
            sub="Total repair value"
          />
        )}
      </div>

      {/* 14-Day Activity Chart */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-surface-850">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <FiTrendingUp className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Repairs Activity (Last {DAYS_SHOWN} Days)
            </h2>
          </div>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full">
            {recent14DayTotal} completed in 14 days
          </span>
        </div>

        {hasRecentActivity ? (
          <div className="pt-2">
            <BarChart data={dailyCounts} color="#10b981" activeColor="#059669" />
          </div>
        ) : (
          <p className="py-8 text-center text-xs text-slate-400 dark:text-neutral-500">
            No repairs logged in the last {DAYS_SHOWN} days.
          </p>
        )}
      </div>

      {/* Comprehensive Work History & Filters Section */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-surface-850 space-y-4">
        {/* Section Header & Main Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
              <FiActivity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">Work History & Activity</h2>
              <p className="text-xs text-slate-500 dark:text-neutral-400">
                Detailed log of completed repairs and reported issues.
              </p>
            </div>
          </div>

          {/* Activity Category Switcher (Repairs vs Issues) */}
          <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 p-1 dark:bg-surface-900">
            <button
              type="button"
              onClick={() => setActiveTab('repairs')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                activeTab === 'repairs'
                  ? 'bg-white text-slate-900 shadow-2xs dark:bg-surface-800 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              <FiTool className="w-3.5 h-3.5" />
              <span>Repairs ({repairs.length})</span>
            </button>

            {issues.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('issues')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  activeTab === 'issues'
                    ? 'bg-white text-slate-900 shadow-2xs dark:bg-surface-800 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white'
                }`}
              >
                <FiAlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>Reported Issues ({issues.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
          {/* Date Filter Preset Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-400 dark:text-neutral-500 mr-1 inline-flex items-center gap-1">
              <FiCalendar className="w-3.5 h-3.5" /> Filter Date:
            </span>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: '7days', label: 'Last 7 Days' },
              { id: 'month', label: 'This Month' },
              { id: 'custom', label: 'Custom' },
            ].map((preset) => {
              const isActive = datePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setDatePreset(preset.id)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-surface-800 dark:text-neutral-300 dark:hover:bg-surface-700'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}

            {datePreset === 'custom' && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="ml-1 rounded-lg border border-blue-200 bg-blue-50/60 px-2.5 py-1 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-blue-800/40 dark:bg-blue-950/40 dark:text-neutral-100"
              />
            )}
          </div>

          {/* Search & Status Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {activeTab === 'repairs' && (
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-white/10 dark:bg-surface-900 text-xs">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-2 py-1 rounded font-bold transition-colors ${
                    statusFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-2xs dark:bg-surface-800 dark:text-white'
                      : 'text-slate-500 hover:text-slate-900 dark:text-neutral-400'
                  }`}
                >
                  All Status
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('completed')}
                  className={`px-2 py-1 rounded font-bold transition-colors ${
                    statusFilter === 'completed'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-neutral-400'
                  }`}
                >
                  Completed
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('in_progress')}
                  className={`px-2 py-1 rounded font-bold transition-colors ${
                    statusFilter === 'in_progress'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-neutral-400'
                  }`}
                >
                  In Progress
                </button>
              </div>
            )}

            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
              <input
                type="text"
                placeholder="Search battery, part, note…"
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

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="px-2.5 py-1 text-xs font-bold text-slate-500 hover:text-red-600 dark:text-neutral-400 dark:hover:text-red-400 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Active Filter Summary Tag */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-neutral-400 bg-slate-50 dark:bg-surface-900/60 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-white/5">
            <FiFilter className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>
              Showing {activeTab === 'repairs' ? filteredVisits.length : filteredIssues.length} matching result(s)
            </span>
          </div>
        )}

        {/* Table Content: Repairs View */}
        {activeTab === 'repairs' && (
          <div className="rounded-xl border border-slate-200/80 dark:border-white/10 overflow-hidden shadow-2xs">
            <div className="max-h-[520px] overflow-y-auto overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-100/95 dark:bg-surface-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-white/10">
                  <tr className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                    <th className="py-3 px-3.5 w-12 text-center">#</th>
                    <th className="py-3 px-3.5 min-w-[140px]">Date & Time</th>
                    <th className="py-3 px-3.5 min-w-[150px]">Battery Code</th>
                    <th className="py-3 px-3.5 min-w-[110px]">Status</th>
                    <th className="py-3 px-3.5 min-w-[180px]">Parts Changed</th>
                    {isSuperAdmin && <th className="py-3 px-3.5 min-w-[120px]">Duration</th>}
                    {isSuperAdmin && <th className="py-3 px-3.5 min-w-[100px]">Labor / Price</th>}
                    <th className="py-3 px-3.5 min-w-[180px]">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 bg-white dark:bg-surface-850">
                  {filteredVisits.length === 0 ? (
                    <tr>
                      <td colSpan={isSuperAdmin ? 8 : 6} className="py-12 text-center text-slate-400 dark:text-neutral-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <FiTool className="w-8 h-8 text-slate-300 dark:text-neutral-600" />
                          <p className="font-semibold">
                            {hasActiveFilters
                              ? 'No repairs match your active filter criteria.'
                              : 'No repair visits recorded for this technician yet.'}
                          </p>
                          {hasActiveFilters && (
                            <button
                              type="button"
                              onClick={clearAllFilters}
                              className="mt-1 text-xs font-bold text-blue-600 hover:underline dark:text-blue-400"
                            >
                              Reset all filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredVisits.map((r, index) => {
                      const parts = (r.part_name || '').split(',').map((p) => p.trim()).filter(Boolean);
                      return (
                        <tr
                          key={r.batch_id || r.id || index}
                          className="hover:bg-slate-50/80 dark:hover:bg-surface-800/60 transition-colors"
                        >
                          {/* Row Number */}
                          <td className="py-3 px-3.5 text-center font-mono text-slate-400 dark:text-neutral-500">
                            {index + 1}
                          </td>

                          {/* Date & Time */}
                          <td className="py-3 px-3.5">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800 dark:text-neutral-200">
                                {new Date(r.repaired_at).toLocaleDateString([], {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </span>
                              <span className="text-[10px] text-slate-400 dark:text-neutral-500">
                                {new Date(r.repaired_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          </td>

                          {/* Battery Code */}
                          <td className="py-3 px-3.5 font-medium">
                            <span className="inline-flex items-center gap-1 font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md dark:bg-blue-950/60 dark:text-blue-300">
                              {r.battery_code}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-3.5">
                            <StatusBadge status={r.battery_status} />
                          </td>

                          {/* Parts Changed */}
                          <td className="py-3 px-3.5">
                            <div className="flex flex-wrap gap-1">
                              {parts.length > 0 ? (
                                parts.map((part, pIdx) => (
                                  <span
                                    key={pIdx}
                                    className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
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
                          {isSuperAdmin && (
                            <td className="py-3 px-3.5">
                              {r.duration_seconds != null ? (
                                <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-neutral-300">
                                  <FiClock className="w-3.5 h-3.5 text-slate-400" />
                                  {formatDuration(r.duration_seconds)}
                                </span>
                              ) : (
                                <span className="text-slate-400 dark:text-neutral-500">—</span>
                              )}
                            </td>
                          )}

                          {/* Labor / Price */}
                          {isSuperAdmin && (
                            <td className="py-3 px-3.5 font-bold text-slate-900 dark:text-white">
                              £{Number(r.labor_charge || r.price || 0).toFixed(2)}
                            </td>
                          )}

                          {/* Notes */}
                          <td className="py-3 px-3.5 max-w-[240px]">
                            {r.notes ? (
                              <span
                                className="text-slate-600 dark:text-neutral-300 line-clamp-2"
                                title={r.notes}
                              >
                                {r.notes}
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-neutral-500">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Table Content: Issues View */}
        {activeTab === 'issues' && (
          <div className="rounded-xl border border-slate-200/80 dark:border-white/10 overflow-hidden shadow-2xs">
            <div className="max-h-[520px] overflow-y-auto overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-100/95 dark:bg-surface-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-white/10">
                  <tr className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                    <th className="py-3 px-3.5 w-12 text-center">#</th>
                    <th className="py-3 px-3.5 min-w-[140px]">Reported At</th>
                    <th className="py-3 px-3.5 min-w-[150px]">Battery Code</th>
                    <th className="py-3 px-3.5 min-w-[110px]">Status</th>
                    <th className="py-3 px-3.5 min-w-[180px]">Reason</th>
                    <th className="py-3 px-3.5 min-w-[200px]">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 bg-white dark:bg-surface-850">
                  {filteredIssues.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-neutral-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <FiAlertTriangle className="w-8 h-8 text-amber-400" />
                          <p className="font-semibold">
                            {hasActiveFilters
                              ? 'No issues match your filter criteria.'
                              : 'No unserviceable issues reported by this technician.'}
                          </p>
                          {hasActiveFilters && (
                            <button
                              type="button"
                              onClick={clearAllFilters}
                              className="mt-1 text-xs font-bold text-blue-600 hover:underline dark:text-blue-400"
                            >
                              Reset all filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredIssues.map((iss, index) => (
                      <tr
                        key={iss.id || index}
                        className="hover:bg-slate-50/80 dark:hover:bg-surface-800/60 transition-colors"
                      >
                        <td className="py-3 px-3.5 text-center font-mono text-slate-400 dark:text-neutral-500">
                          {index + 1}
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800 dark:text-neutral-200">
                              {new Date(iss.reported_at).toLocaleDateString([], {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-neutral-500">
                              {new Date(iss.reported_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3.5 font-medium">
                          <span className="inline-flex items-center gap-1 font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md dark:bg-blue-950/60 dark:text-blue-300">
                            {iss.battery_code}
                          </span>
                        </td>
                        <td className="py-3 px-3.5">
                          <StatusBadge status={iss.battery_status} />
                        </td>
                        <td className="py-3 px-3.5">
                          <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            {iss.reason_label || 'Unserviceable'}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 max-w-[240px]">
                          {iss.note ? (
                            <span className="text-slate-600 dark:text-neutral-300" title={iss.note}>
                              {iss.note}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-neutral-500">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Edit Staff Modal */}
      {isEditModalOpen && (
        <Modal
          size="3xl"
          title={`Edit Staff Profile — ${staff.name}`}
          description="Update employee credentials, national insurance, and identity documentation."
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
