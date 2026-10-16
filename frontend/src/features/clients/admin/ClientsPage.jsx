import { useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import {
  FiUsers,
  FiSearch,
  FiFilter,
  FiEdit2,
  FiTrash2,
  FiEye,
  FiMail,
  FiCalendar,
  FiX,
  FiPlus,
  FiCheckCircle,
  FiAlertCircle,
  FiTruck,
  FiTag,
  FiDollarSign,
  FiRefreshCw,
} from 'react-icons/fi';
import useFetchList from '../../../utils/use-fetch-list';
import TableState from '../../../components/ui/table/TableState';
import Modal from '../../../components/ui/overlays/Modal';
import ConfirmModal from '../../../components/ui/overlays/ConfirmModal';
import AlertModal from '../../../components/ui/overlays/AlertModal';
import Badge from '../../../components/ui/primitives/Badge';
import apiClient from '../../../services/api-client';
import logoUrl from '../../../utils/logo-url';
import ClientForm from './ClientForm';

function getInitials(name) {
  if (!name) return 'FC';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ClientsPage() {
  const { data, loading, error, refetch } = useFetchList('/clients');
  const user = useSelector((state) => state.auth.user);
  const isSuperAdmin = user?.role === 'super_admin';

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [prefixFilter, setPrefixFilter] = useState('ALL');

  // Modals state
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
      await apiClient.delete(`/clients/${deleteTarget.id}`);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      setDeleteError(err.response?.data?.message || err.message);
      setDeleteTarget(null);
    }
  }

  // Filter clients that belong to fleet clients (exclude recycle clients)
  const fleetClients = useMemo(
    () => (data || []).filter((c) => c.user_role !== 'recycle_client'),
    [data]
  );

  // Executive Metrics
  const metrics = useMemo(() => {
    const total = fleetClients.length;
    const withLogin = fleetClients.filter((c) => Boolean(c.login_email)).length;
    const active = fleetClients.filter((c) => c.user_active !== false && Boolean(c.login_email)).length;
    const inactive = fleetClients.filter((c) => c.user_active === false).length;
    const withPrefix = fleetClients.filter((c) => Boolean(c.battery_prefix)).length;
    const noLogin = total - withLogin;
    return { total, withLogin, active, inactive, withPrefix, noLogin };
  }, [fleetClients]);

  // Filtered List
  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return fleetClients.filter((c) => {
      // Status filter
      if (statusFilter === 'ACTIVE' && (c.user_active === false || !c.login_email)) return false;
      if (statusFilter === 'INACTIVE' && c.user_active !== false) return false;
      if (statusFilter === 'NO_LOGIN' && c.login_email) return false;

      // Prefix filter
      if (prefixFilter === 'HAS_PREFIX' && !c.battery_prefix) return false;
      if (prefixFilter === 'NO_PREFIX' && c.battery_prefix) return false;

      // Search query
      if (q) {
        const matchesName = c.name?.toLowerCase().includes(q);
        const matchesLogin = c.login_email?.toLowerCase().includes(q);
        const matchesInvoice = c.invoice_email?.toLowerCase().includes(q);
        const matchesPrefix = c.battery_prefix?.toLowerCase().includes(q);
        if (!matchesName && !matchesLogin && !matchesInvoice && !matchesPrefix) return false;
      }

      return true;
    });
  }, [fleetClients, search, statusFilter, prefixFilter]);

  const hasActiveFilters = search || statusFilter !== 'ALL' || prefixFilter !== 'ALL';

  function clearAllFilters() {
    setSearch('');
    setStatusFilter('ALL');
    setPrefixFilter('ALL');
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Executive Header Card */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-surface-800 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-700/10 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-400/20">
                <FiTruck className="h-3.5 w-3.5" />
                Fleet Operations & Accounts
              </span>
              <span className="text-xs text-slate-400 dark:text-neutral-500">•</span>
              <span className="text-xs font-medium text-slate-500 dark:text-neutral-400">
                Commercial Fleet Directory
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-neutral-50 sm:text-2xl">
              Fleet Clients
            </h1>
            <p className="max-w-2xl text-xs text-slate-500 dark:text-neutral-400 sm:text-sm">
              Manage commercial battery fleet operators, dedicated serial prefixes, and billing accounts.
            </p>

            {/* Live Counters Strip */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-600 dark:text-neutral-300 sm:gap-4">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                Total Fleets: <strong className="text-slate-900 dark:text-neutral-100">{metrics.total}</strong>
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                Active Portals: <strong className="text-emerald-700 dark:text-emerald-400">{metrics.active}</strong>
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                With Prefix: <strong className="text-blue-700 dark:text-blue-400">{metrics.withPrefix}</strong>
              </span>
              {metrics.inactive > 0 && (
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                  Inactive: <strong className="text-rose-700 dark:text-rose-400">{metrics.inactive}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2 sm:pt-0">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing || loading}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-surface-700 dark:text-neutral-200 dark:hover:bg-surface-600 sm:text-sm"
              title="Refresh Fleet Directory"
            >
              <FiRefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
              <span>Sync</span>
            </button>

            <button
              type="button"
              onClick={() => setFormTarget('new')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-700 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-violet-800 sm:text-sm"
            >
              <FiPlus className="h-4 w-4" />
              <span>+ Add Client</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Compact Executive KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {/* Total Fleets */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-surface-800">
          <div className="flex items-center justify-between text-slate-500 dark:text-neutral-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
              Total Fleets
            </span>
            <span className="rounded-lg bg-slate-100 p-1.5 text-slate-700 dark:bg-white/5 dark:text-neutral-300">
              <FiTruck className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-neutral-50 sm:text-3xl">
              {metrics.total}
            </span>
            <span className="text-xs text-slate-400">operators</span>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
            Active battery fleets
          </div>
        </div>

        {/* Active Portals */}
        <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/30 p-4 shadow-2xs dark:border-emerald-500/20 dark:bg-emerald-950/10">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Active Portals
            </span>
            <span className="rounded-lg bg-emerald-100 p-1.5 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <FiCheckCircle className="h-4 w-4" />
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
            Authorized client accounts
          </div>
        </div>

        {/* Battery Prefixes */}
        <div className="rounded-xl border border-blue-200/60 bg-blue-50/30 p-4 shadow-2xs dark:border-blue-500/20 dark:bg-blue-950/10">
          <div className="flex items-center justify-between text-blue-700 dark:text-blue-400">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Dedicated Prefixes
            </span>
            <span className="rounded-lg bg-blue-100 p-1.5 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              <FiTag className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-blue-700 dark:text-blue-300 sm:text-3xl">
              {metrics.withPrefix}
            </span>
            <span className="text-xs text-blue-600/70 dark:text-blue-400/70">
              prefixed
            </span>
          </div>
          <div className="mt-1 text-xs text-blue-700/80 dark:text-blue-400/80">
            Custom battery barcodes
          </div>
        </div>

        {/* Pending / No Login */}
        <div className="rounded-xl border border-amber-200/60 bg-amber-50/30 p-4 shadow-2xs dark:border-amber-500/20 dark:bg-amber-950/10">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-400">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Pending Setup
            </span>
            <span className="rounded-lg bg-amber-100 p-1.5 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <FiAlertCircle className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-amber-700 dark:text-amber-300 sm:text-3xl">
              {metrics.inactive + metrics.noLogin}
            </span>
            <span className="text-xs text-amber-600/70 dark:text-amber-400/70">
              actionable
            </span>
          </div>
          <div className="mt-1 text-xs text-amber-700/80 dark:text-amber-400/80">
            No login or inactive
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search fleet name, login email, invoice email or prefix..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-9 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-surface-700 dark:text-neutral-100 dark:placeholder:text-neutral-400 sm:text-sm"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-neutral-500 dark:hover:text-neutral-300"
                title="Clear search"
              >
                <FiX className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns - Wrapping Grid */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 dark:text-neutral-400">Portal:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-surface-700 dark:text-neutral-200"
              >
                <option value="ALL">All Portals ({metrics.total})</option>
                <option value="ACTIVE">Active Portals ({metrics.active})</option>
                <option value="INACTIVE">Inactive Logins ({metrics.inactive})</option>
                <option value="NO_LOGIN">No Login ({metrics.noLogin})</option>
              </select>
            </div>

            {/* Prefix Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 dark:text-neutral-400">Prefix:</span>
              <select
                value={prefixFilter}
                onChange={(e) => setPrefixFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-surface-700 dark:text-neutral-200"
              >
                <option value="ALL">All Prefixes</option>
                <option value="HAS_PREFIX">With Prefix ({metrics.withPrefix})</option>
                <option value="NO_PREFIX">No Prefix ({metrics.total - metrics.withPrefix})</option>
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
            Showing <strong className="text-slate-800 dark:text-neutral-200">{filteredClients.length}</strong> of{' '}
            {metrics.total} fleet clients
          </span>
          {hasActiveFilters && (
            <span className="text-blue-600 dark:text-blue-400 font-medium">
              Filtered results
            </span>
          )}
        </div>
      </div>

      {deleteError && (
        <AlertModal title="Cannot Delete Client" message={deleteError} onClose={() => setDeleteError(null)} />
      )}

      {/* Main Content Area */}
      {loading && <TableState>Loading fleet clients…</TableState>}
      {error && <TableState tone="error">{error}</TableState>}

      {!loading && !error && filteredClients.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-white/10 dark:bg-surface-800">
          <div className="rounded-full bg-slate-100 p-3 text-slate-400 dark:bg-surface-700 dark:text-neutral-500">
            <FiTruck className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-slate-800 dark:text-neutral-200">
            No fleet clients found
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
            {hasActiveFilters
              ? 'Try adjusting your search query or portal status filters.'
              : "Click '+ Add Client' above to create one."}
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
      {!loading && !error && filteredClients.length > 0 && (
        <div className="space-y-3 lg:hidden">
          {filteredClients.map((row, idx) => {
            const initials = getInitials(row.name);
            const hasLogin = Boolean(row.login_email);
            const isActive = row.user_active !== false && hasLogin;
            const logo = row.logo_path ? logoUrl(row.logo_path) : null;

            return (
              <div
                key={row.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs transition-all hover:border-slate-300 dark:border-white/10 dark:bg-surface-800"
              >
                {/* Header: Avatar / Logo + Name + Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {logo ? (
                      <img
                        src={logo}
                        alt={row.name}
                        className="h-10 w-10 shrink-0 rounded-xl object-contain border border-slate-100 bg-white p-1 dark:border-surface-700"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                        {initials}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-400 font-mono">#{idx + 1}</span>
                        <Link
                          to={`/clients/${row.id}`}
                          className="text-sm font-bold text-slate-900 hover:text-blue-600 hover:underline dark:text-neutral-100 dark:hover:text-blue-400"
                        >
                          {row.name}
                        </Link>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {row.battery_prefix && (
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-blue-700 ring-1 ring-blue-700/10 dark:bg-blue-950/40 dark:text-blue-300">
                            {row.battery_prefix}-
                          </span>
                        )}
                        {hasLogin ? (
                          <Badge tone={isActive ? 'good' : 'critical'} className="text-[10px] py-0.5">
                            {isActive ? 'Portal Active' : 'Login Inactive'}
                          </Badge>
                        ) : (
                          <Badge tone="neutral" className="text-[10px] py-0.5">
                            No Login
                          </Badge>
                        )}
                        <span className="text-[10px] text-slate-400 dark:text-neutral-500">
                          Added {new Date(row.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Details Section */}
                <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs dark:border-white/5">
                  <div className="flex items-center justify-between text-slate-600 dark:text-neutral-300">
                    <span className="text-slate-400 dark:text-neutral-500 font-medium">Login Account:</span>
                    {row.login_email ? (
                      <span className="font-mono text-[11px] font-medium text-slate-700 dark:text-neutral-200">
                        {row.login_email}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">No login assigned</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-slate-600 dark:text-neutral-300">
                    <span className="text-slate-400 dark:text-neutral-500 font-medium">Invoice Email:</span>
                    {row.invoice_email ? (
                      <span className="font-mono text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                        {row.invoice_email}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">Same as login</span>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-white/5">
                  <Link
                    to={`/clients/${row.id}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    <FiEye className="h-3.5 w-3.5" />
                    <span>View Fleet & Stats</span>
                  </Link>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFormTarget(row)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-700 dark:text-neutral-200"
                    >
                      <FiEdit2 className="h-3 w-3 text-slate-500" />
                      <span>Edit</span>
                    </button>

                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(row)}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-400"
                        title="Delete client"
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
      {!loading && !error && filteredClients.length > 0 && (
        <div className="hidden overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-white/10 dark:bg-surface-800 lg:block">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-slate-600 uppercase font-semibold tracking-wider text-[11px] dark:border-white/10 dark:bg-surface-700/50 dark:text-neutral-300">
              <tr>
                <th className="py-3.5 pl-4 pr-2 w-12 text-center">#</th>
                <th className="py-3.5 px-3">Fleet Client</th>
                <th className="py-3.5 px-3">Prefix</th>
                <th className="py-3.5 px-3">Login Account</th>
                <th className="py-3.5 px-3">Billing Email</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-3">Added Date</th>
                <th className="py-3.5 pl-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {filteredClients.map((row, idx) => {
                const initials = getInitials(row.name);
                const hasLogin = Boolean(row.login_email);
                const isActive = row.user_active !== false && hasLogin;
                const logo = row.logo_path ? logoUrl(row.logo_path) : null;

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
                        {logo ? (
                          <img
                            src={logo}
                            alt={row.name}
                            className="h-8 w-8 shrink-0 rounded-lg object-contain border border-slate-100 bg-white p-0.5 dark:border-surface-700"
                          />
                        ) : (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                            {initials}
                          </div>
                        )}
                        <div>
                          <Link
                            to={`/clients/${row.id}`}
                            className="font-bold text-slate-900 hover:text-blue-600 hover:underline dark:text-neutral-100 dark:hover:text-blue-400"
                          >
                            {row.name}
                          </Link>
                          <div className="text-[11px] text-slate-400 dark:text-neutral-500">
                            Commercial Fleet Client
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Prefix */}
                    <td className="py-3 px-3">
                      {row.battery_prefix ? (
                        <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-xs font-bold text-blue-700 ring-1 ring-blue-700/10 dark:bg-blue-950/40 dark:text-blue-300">
                          {row.battery_prefix}-
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-neutral-500 text-xs">—</span>
                      )}
                    </td>

                    {/* Login Account */}
                    <td className="py-3 px-3">
                      {row.login_email ? (
                        <div className="font-mono text-xs text-slate-700 dark:text-neutral-200">
                          {row.login_email}
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-neutral-500 italic text-xs">
                          No login
                        </span>
                      )}
                    </td>

                    {/* Invoice Email */}
                    <td className="py-3 px-3">
                      {row.invoice_email ? (
                        <div className="font-mono text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          {row.invoice_email}
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-neutral-500 text-xs italic">
                          Same as login
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3">
                      {hasLogin ? (
                        <Badge tone={isActive ? 'good' : 'critical'}>
                          {isActive ? 'Portal Active' : 'Login Inactive'}
                        </Badge>
                      ) : (
                        <Badge tone="neutral">No Login</Badge>
                      )}
                    </td>

                    {/* Added Date */}
                    <td className="py-3 px-3 text-slate-600 dark:text-neutral-300">
                      <div className="flex items-center gap-1 font-mono text-[11px]">
                        <FiCalendar className="h-3 w-3 text-slate-400" />
                        <span>{new Date(row.created_at).toLocaleDateString()}</span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 pl-3 pr-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <Link
                          to={`/clients/${row.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-700 dark:text-neutral-200"
                          title="View fleet stats & breakdown"
                        >
                          <FiEye className="h-3.5 w-3.5 text-slate-500" />
                          <span>Fleet</span>
                        </Link>

                        <button
                          type="button"
                          onClick={() => setFormTarget(row)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-700 dark:text-neutral-200"
                          title="Edit client details"
                        >
                          <FiEdit2 className="h-3.5 w-3.5 text-slate-500" />
                          <span>Edit</span>
                        </button>

                        {isSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(row)}
                            className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-400"
                            title="Delete fleet client"
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

      {/* Client Form Modal */}
      {formTarget && (
        <Modal
          title={formTarget === 'new' ? 'Add Client' : `Edit ${formTarget.name}`}
          description={
            formTarget === 'new'
              ? 'Enroll a new commercial fleet operator with dedicated prefix and portal permissions.'
              : 'Update this client’s profile, billing email, logo, and permissions.'
          }
          size="5xl"
          className="[@media(min-height:720px)]:min-h-[580px] [@media(min-height:800px)]:md:min-h-[640px]"
          onClose={() => setFormTarget(null)}
        >
          <ClientForm
            client={formTarget === 'new' ? null : formTarget}
            onSaved={handleSaved}
            onCancel={() => setFormTarget(null)}
          />
        </Modal>
      )}

      {/* Confirm Delete Modal */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Client"
          message={`Delete client "${deleteTarget.name}"? This can't be undone.`}
          requireTyping={false}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

export default ClientsPage;
