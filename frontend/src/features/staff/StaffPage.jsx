import { useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import {
  FiUsers,
  FiUserCheck,
  FiUserPlus,
  FiShield,
  FiSearch,
  FiFilter,
  FiRefreshCw,
  FiEdit2,
  FiTrash2,
  FiEye,
  FiFileText,
  FiPhone,
  FiMail,
  FiExternalLink,
  FiX,
  FiCheckCircle,
  FiAlertCircle,
} from 'react-icons/fi';
import useFetchList from '../../utils/use-fetch-list';
import TableState from '../../components/ui/table/TableState';
import Button from '../../components/ui/primitives/Button';
import Modal from '../../components/ui/overlays/Modal';
import ConfirmModal from '../../components/ui/overlays/ConfirmModal';
import Badge from '../../components/ui/primitives/Badge';
import apiClient from '../../services/api-client';
import { resolveImageUrl } from '../../utils/image-url';
import { hasPermission } from '../../utils/permissions';
import StaffForm from './StaffForm';

function StaffPage() {
  const { data: rawData, loading, error, refetch } = useFetchList('/staff');
  const staffList = useMemo(() => (Array.isArray(rawData) ? rawData : []), [rawData]);

  const user = useSelector((state) => state.auth.user);
  const isSuperAdmin = user?.role === 'super_admin';
  const canManageStaff = isSuperAdmin || user?.role === 'admin' || hasPermission(user, 'staff');

  // Search & filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [docFilter, setDocFilter] = useState('ALL');

  // null = closed, 'new' = create form, staff object = edit form
  const [formTarget, setFormTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  }

  function handleSaved() {
    refetch();
    setFormTarget(null);
  }

  async function handleConfirmDelete() {
    setDeleteError(null);
    try {
      await apiClient.delete(`/staff/${deleteTarget.id}`);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      setDeleteError(err.response?.data?.message || err.message);
      setDeleteTarget(null);
    }
  }

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = staffList.length;
    const active = staffList.filter((s) => s.active !== false).length;
    const inactive = total - active;
    const technicians = staffList.filter((s) => (s.role || '').toLowerCase() === 'technician' || !s.role).length;
    const supervisors = staffList.filter((s) => (s.role || '').toLowerCase() === 'supervisor').length;
    const withDocs = staffList.filter((s) => Boolean(s.document_path)).length;
    return { total, active, inactive, technicians, supervisors, withDocs };
  }, [staffList]);

  // Filtered List
  const filteredStaff = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return staffList.filter((s) => {
      // Role filter
      const role = (s.role || 'technician').toLowerCase();
      if (roleFilter !== 'ALL' && role !== roleFilter.toLowerCase()) return false;

      // Status filter
      if (statusFilter === 'ACTIVE' && s.active === false) return false;
      if (statusFilter === 'INACTIVE' && s.active !== false) return false;

      // Document filter
      if (docFilter === 'HAS_DOC' && !s.document_path) return false;
      if (docFilter === 'NO_DOC' && s.document_path) return false;

      // Search query
      if (q) {
        const match =
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.email && s.email.toLowerCase().includes(q)) ||
          (s.login_email && s.login_email.toLowerCase().includes(q)) ||
          (s.phone && s.phone.toLowerCase().includes(q)) ||
          (s.ni_number && s.ni_number.toLowerCase().includes(q)) ||
          (s.passport_number && s.passport_number.toLowerCase().includes(q)) ||
          (s.role && s.role.toLowerCase().includes(q));
        if (!match) return false;
      }

      return true;
    });
  }, [staffList, searchQuery, roleFilter, statusFilter, docFilter]);

  const hasActiveFilters = searchQuery || roleFilter !== 'ALL' || statusFilter !== 'ALL' || docFilter !== 'ALL';

  function clearAllFilters() {
    setSearchQuery('');
    setRoleFilter('ALL');
    setStatusFilter('ALL');
    setDocFilter('ALL');
  }

  // Helper to get initials
  function getInitials(name) {
    if (!name) return 'ST';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Executive Header Card */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-surface-800 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-700/10 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-400/20">
                <FiShield className="h-3.5 w-3.5" />
                Workforce & Engineering
              </span>
              <span className="text-xs text-slate-400 dark:text-neutral-500">•</span>
              <span className="text-xs font-medium text-slate-500 dark:text-neutral-400">
                Staff & Workshop Directory
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-neutral-50 sm:text-2xl">
              Staff & Technicians
            </h1>
            <p className="max-w-2xl text-xs text-slate-500 dark:text-neutral-400 sm:text-sm">
              Manage workshop technicians, diagnostic engineers, supervisors, and compliance documentation.
            </p>

            {/* Live Counters Strip */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-600 dark:text-neutral-300 sm:gap-4">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                Total: <strong className="text-slate-900 dark:text-neutral-100">{metrics.total}</strong>
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                Active: <strong className="text-emerald-700 dark:text-emerald-400">{metrics.active}</strong>
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                Techs: <strong className="text-blue-700 dark:text-blue-400">{metrics.technicians}</strong>
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <span className="h-2 w-2 rounded-full bg-purple-500"></span>
                Supervisors: <strong className="text-purple-700 dark:text-purple-400">{metrics.supervisors}</strong>
              </span>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2 sm:pt-0">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing || loading}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-surface-700 dark:text-neutral-200 dark:hover:bg-surface-600 sm:text-sm"
              title="Refresh Staff Roster"
            >
              <FiRefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
              <span>Sync</span>
            </button>

            {canManageStaff && (
              <Button
                variant="darkViolet"
                onClick={() => setFormTarget('new')}
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold sm:text-sm"
              >
                <FiUserPlus className="h-4 w-4" />
                <span>+ Add Staff</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 4 Compact Executive KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {/* Total Workforce */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-surface-800">
          <div className="flex items-center justify-between text-slate-500 dark:text-neutral-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
              Total Roster
            </span>
            <span className="rounded-lg bg-slate-100 p-1.5 text-slate-700 dark:bg-white/5 dark:text-neutral-300">
              <FiUsers className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-neutral-50 sm:text-3xl">
              {metrics.total}
            </span>
            <span className="text-xs text-slate-400">registered</span>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
            Workshop & technical staff
          </div>
        </div>

        {/* Active Technicians */}
        <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/30 p-4 shadow-2xs dark:border-emerald-500/20 dark:bg-emerald-950/10">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Active On Duty
            </span>
            <span className="rounded-lg bg-emerald-100 p-1.5 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <FiUserCheck className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-300 sm:text-3xl">
              {metrics.active}
            </span>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {metrics.total > 0 ? `${Math.round((metrics.active / metrics.total) * 100)}% active` : '100%'}
            </span>
          </div>
          <div className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-400/80">
            Available for repairs & testing
          </div>
        </div>

        {/* Battery Technicians */}
        <div className="rounded-xl border border-blue-200/60 bg-blue-50/30 p-4 shadow-2xs dark:border-blue-500/20 dark:bg-blue-950/10">
          <div className="flex items-center justify-between text-blue-700 dark:text-blue-400">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Technicians
            </span>
            <span className="rounded-lg bg-blue-100 p-1.5 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              <FiShield className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-blue-700 dark:text-blue-300 sm:text-3xl">
              {metrics.technicians}
            </span>
            <span className="text-xs text-blue-600/70 dark:text-blue-400/70">
              specialists
            </span>
          </div>
          <div className="mt-1 text-xs text-blue-700/80 dark:text-blue-400/80">
            Cell repair & refurb specialists
          </div>
        </div>

        {/* Supervisors */}
        <div className="rounded-xl border border-purple-200/60 bg-purple-50/30 p-4 shadow-2xs dark:border-purple-500/20 dark:bg-purple-950/10">
          <div className="flex items-center justify-between text-purple-700 dark:text-purple-400">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Supervisors
            </span>
            <span className="rounded-lg bg-purple-100 p-1.5 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
              <FiCheckCircle className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-purple-700 dark:text-purple-300 sm:text-3xl">
              {metrics.supervisors}
            </span>
            <span className="text-xs text-purple-600/70 dark:text-purple-400/70">
              leads
            </span>
          </div>
          <div className="mt-1 text-xs text-purple-700/80 dark:text-purple-400/80">
            Sign-off & QA oversight
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar (Zero Horizontal Scrolling) */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-surface-800">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <FiSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-neutral-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, phone, NI number or passport..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-9 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-surface-700 dark:text-neutral-100 dark:placeholder:text-neutral-400 sm:text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-neutral-500 dark:hover:text-neutral-300"
                title="Clear search"
              >
                <FiX className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns - Wrapping Grid */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Role Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 dark:text-neutral-400">Role:</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-surface-700 dark:text-neutral-200"
              >
                <option value="ALL">All Roles ({metrics.total})</option>
                <option value="technician">Technician ({metrics.technicians})</option>
                <option value="supervisor">Supervisor ({metrics.supervisors})</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 dark:text-neutral-400">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-surface-700 dark:text-neutral-200"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active ({metrics.active})</option>
                <option value="INACTIVE">Inactive ({metrics.inactive})</option>
              </select>
            </div>

            {/* Document Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 dark:text-neutral-400">Docs:</span>
              <select
                value={docFilter}
                onChange={(e) => setDocFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-surface-700 dark:text-neutral-200"
              >
                <option value="ALL">All Docs</option>
                <option value="HAS_DOC">With Docs ({metrics.withDocs})</option>
                <option value="NO_DOC">Missing Docs ({metrics.total - metrics.withDocs})</option>
              </select>
            </div>

            {/* Clear All */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-400"
              >
                <FiX className="h-3.5 w-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Results Count Bar */}
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-white/5 dark:text-neutral-400">
          <span>
            Showing <strong className="text-slate-800 dark:text-neutral-200">{filteredStaff.length}</strong> of{' '}
            {metrics.total} staff members
          </span>
          {hasActiveFilters && (
            <span className="text-blue-600 dark:text-blue-400 font-medium">
              Filtered results
            </span>
          )}
        </div>
      </div>

      {deleteError && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-400">
          <FiAlertCircle className="h-4 w-4 shrink-0" />
          <span>{deleteError}</span>
        </div>
      )}

      {/* Main Content Area */}
      {loading && <TableState>Loading staff roster…</TableState>}
      {error && <TableState tone="error">{error}</TableState>}

      {!loading && !error && filteredStaff.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-white/10 dark:bg-surface-800">
          <div className="rounded-full bg-slate-100 p-3 text-slate-400 dark:bg-surface-700 dark:text-neutral-500">
            <FiUsers className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-slate-800 dark:text-neutral-200">
            No staff members found
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
            {hasActiveFilters ? 'Try adjusting your search query or role filters.' : 'Add your first technician to get started.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-700 dark:text-neutral-200"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Responsive View 1: Mobile Stacked Cards (< lg) */}
      {!loading && !error && filteredStaff.length > 0 && (
        <div className="space-y-3 lg:hidden">
          {filteredStaff.map((row, idx) => {
            const isSupervisor = (row.role || '').toLowerCase() === 'supervisor';
            const roleLabel = row.role ? row.role.charAt(0).toUpperCase() + row.role.slice(1) : 'Technician';
            const initials = getInitials(row.name);
            const docUrl = row.document_path ? resolveImageUrl(`/uploads/staff-docs/${row.document_path}`) : null;

            return (
              <div
                key={row.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs transition-all hover:border-slate-300 dark:border-white/10 dark:bg-surface-800"
              >
                {/* Card Header: Initials + Name + Badges */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                        isSupervisor
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                      }`}
                    >
                      {initials}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-400 font-mono">#{idx + 1}</span>
                        <Link
                          to={`/staff/${row.id}`}
                          className="text-sm font-bold text-slate-900 hover:text-blue-600 hover:underline dark:text-neutral-100 dark:hover:text-blue-400"
                        >
                          {row.name}
                        </Link>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            isSupervisor
                              ? 'bg-purple-50 text-purple-700 ring-1 ring-purple-600/20 dark:bg-purple-950/40 dark:text-purple-300'
                              : 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20 dark:bg-blue-950/40 dark:text-blue-300'
                          }`}
                        >
                          {roleLabel}
                        </span>
                        <Badge tone={row.active ? 'good' : 'neutral'} className="text-[10px] py-0.5">
                          {row.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Details Section */}
                <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs dark:border-white/5">
                  {/* Contact / Email */}
                  <div className="flex items-center justify-between text-slate-600 dark:text-neutral-300">
                    <span className="text-slate-400 dark:text-neutral-500 font-medium">Email / Login:</span>
                    {row.email || row.login_email ? (
                      <span className="font-mono text-[11px] font-medium text-slate-700 dark:text-neutral-200">
                        {row.email || row.login_email}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">No email</span>
                    )}
                  </div>

                  {/* Phone */}
                  {row.phone && (
                    <div className="flex items-center justify-between text-slate-600 dark:text-neutral-300">
                      <span className="text-slate-400 dark:text-neutral-500 font-medium">Phone:</span>
                      <span className="font-mono text-[11px] text-slate-700 dark:text-neutral-200">
                        {row.phone}
                      </span>
                    </div>
                  )}

                  {/* NI & Passport */}
                  <div className="flex items-center justify-between text-slate-600 dark:text-neutral-300">
                    <span className="text-slate-400 dark:text-neutral-500 font-medium">ID / Compliance:</span>
                    <div className="flex items-center gap-1.5 font-mono text-[11px]">
                      {row.ni_number && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-800 dark:bg-surface-700 dark:text-neutral-200">
                          NI: {row.ni_number}
                        </span>
                      )}
                      {row.passport_number && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600 dark:bg-surface-700 dark:text-neutral-300">
                          Pass: {row.passport_number}
                        </span>
                      )}
                      {!row.ni_number && !row.passport_number && (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>
                  </div>

                  {/* Document */}
                  <div className="flex items-center justify-between text-slate-600 dark:text-neutral-300">
                    <span className="text-slate-400 dark:text-neutral-500 font-medium">Compliance Doc:</span>
                    {docUrl ? (
                      <a
                        href={docUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline dark:text-blue-400"
                      >
                        <FiFileText className="h-3.5 w-3.5" />
                        <span>View Document</span>
                      </a>
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">Not uploaded</span>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-white/5">
                  <Link
                    to={`/staff/${row.id}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    <FiEye className="h-3.5 w-3.5" />
                    <span>View Profile</span>
                  </Link>

                  <div className="flex items-center gap-2">
                    {canManageStaff && (
                      <button
                        type="button"
                        onClick={() => setFormTarget(row)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-700 dark:text-neutral-200"
                      >
                        <FiEdit2 className="h-3 w-3 text-slate-500" />
                        <span>Edit</span>
                      </button>
                    )}

                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(row)}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-400"
                        title="Delete staff record"
                      >
                        <FiTrash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Responsive View 2: Desktop Table (≥ lg) */}
      {!loading && !error && filteredStaff.length > 0 && (
        <div className="hidden overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-white/10 dark:bg-surface-800 lg:block">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-slate-600 uppercase font-semibold tracking-wider text-[11px] dark:border-white/10 dark:bg-surface-700/50 dark:text-neutral-300">
              <tr>
                <th className="py-3.5 pl-4 pr-2 w-12 text-center">#</th>
                <th className="py-3.5 px-3">Staff Member</th>
                <th className="py-3.5 px-3">Role</th>
                <th className="py-3.5 px-3">Email & Login</th>
                <th className="py-3.5 px-3">Compliance & ID</th>
                <th className="py-3.5 px-3">Document</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 pl-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {filteredStaff.map((row, idx) => {
                const isSupervisor = (row.role || '').toLowerCase() === 'supervisor';
                const roleLabel = row.role ? row.role.charAt(0).toUpperCase() + row.role.slice(1) : 'Technician';
                const initials = getInitials(row.name);
                const docUrl = row.document_path ? resolveImageUrl(`/uploads/staff-docs/${row.document_path}`) : null;

                return (
                  <tr
                    key={row.id}
                    className="transition-colors hover:bg-slate-50/70 dark:hover:bg-white/5"
                  >
                    {/* Index */}
                    <td className="py-3 pl-4 pr-2 text-center font-mono text-slate-400 text-xs">
                      {idx + 1}
                    </td>

                    {/* Member & Avatar */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                            isSupervisor
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                          }`}
                        >
                          {initials}
                        </div>
                        <div>
                          <Link
                            to={`/staff/${row.id}`}
                            className="font-bold text-slate-900 hover:text-blue-600 hover:underline dark:text-neutral-100 dark:hover:text-blue-400"
                          >
                            {row.name}
                          </Link>
                          {row.phone && (
                            <div className="text-[11px] text-slate-400 dark:text-neutral-500 font-mono">
                              {row.phone}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ${
                          isSupervisor
                            ? 'bg-purple-50 text-purple-700 ring-1 ring-purple-600/20 dark:bg-purple-950/40 dark:text-purple-300'
                            : 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20 dark:bg-blue-950/40 dark:text-blue-300'
                        }`}
                      >
                        {roleLabel}
                      </span>
                    </td>

                    {/* Email / Login */}
                    <td className="py-3 px-3">
                      {row.email || row.login_email ? (
                        <div className="font-mono text-xs text-slate-700 dark:text-neutral-200">
                          {row.email || row.login_email}
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-neutral-500 italic text-xs">
                          No email
                        </span>
                      )}
                    </td>

                    {/* NI / Passport */}
                    <td className="py-3 px-3">
                      <div className="flex flex-col gap-0.5 font-mono text-[11px]">
                        {row.ni_number && (
                          <span className="font-semibold text-slate-800 dark:text-neutral-200">
                            NI: {row.ni_number}
                          </span>
                        )}
                        {row.passport_number && (
                          <span className="text-slate-500 dark:text-neutral-400">
                            Pass: {row.passport_number}
                          </span>
                        )}
                        {!row.ni_number && !row.passport_number && (
                          <span className="text-slate-400 dark:text-neutral-500">—</span>
                        )}
                      </div>
                    </td>

                    {/* Document */}
                    <td className="py-3 px-3">
                      {docUrl ? (
                        <a
                          href={docUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline dark:text-blue-400"
                          title={row.document_name || 'View Document'}
                        >
                          <FiFileText className="h-3.5 w-3.5" />
                          <span>View Doc</span>
                        </a>
                      ) : (
                        <span className="text-slate-400 dark:text-neutral-500 text-xs">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3">
                      <Badge tone={row.active ? 'good' : 'neutral'}>
                        {row.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>

                    {/* Actions */}
                    <td className="py-3 pl-3 pr-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <Link
                          to={`/staff/${row.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-700 dark:text-neutral-200"
                          title="View detailed record"
                        >
                          <FiEye className="h-3.5 w-3.5 text-slate-500" />
                          <span>Profile</span>
                        </Link>

                        {canManageStaff && (
                          <button
                            type="button"
                            onClick={() => setFormTarget(row)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-700 dark:text-neutral-200"
                            title="Edit staff details"
                          >
                            <FiEdit2 className="h-3.5 w-3.5 text-slate-500" />
                            <span>Edit</span>
                          </button>
                        )}

                        {isSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(row)}
                            className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-400"
                            title="Delete staff member"
                          >
                            <FiTrash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Staff Form Modal */}
      {formTarget && (
        <Modal
          size="3xl"
          title={formTarget === 'new' ? 'Add Staff Member' : 'Edit Staff Details'}
          description={
            formTarget === 'new'
              ? 'Enroll a new technician or workshop employee with role permissions and compliance docs.'
              : 'Update this staff member’s profile and compliance credentials.'
          }
          onClose={() => setFormTarget(null)}
        >
          <StaffForm
            staff={formTarget === 'new' ? null : formTarget}
            onSaved={handleSaved}
            onCancel={() => setFormTarget(null)}
          />
        </Modal>
      )}

      {/* Confirm Delete Modal */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Staff"
          message={`Delete staff member "${deleteTarget.name}"?`}
          requireTyping={false}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

export default StaffPage;
