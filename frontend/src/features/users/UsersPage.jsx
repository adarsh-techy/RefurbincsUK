import { useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
  FiUserCheck,
  FiPlus,
  FiSearch,
  FiX,
  FiEdit2,
  FiTrash2,
  FiCheckCircle,
  FiSlash,
  FiShield,
  FiKey,
  FiRefreshCw,
  FiMail,
} from 'react-icons/fi';
import useFetchList from '../../utils/use-fetch-list';
import DataTable from '../../components/ui/table/DataTable';
import TableState from '../../components/ui/table/TableState';
import Modal from '../../components/ui/overlays/Modal';
import ConfirmModal from '../../components/ui/overlays/ConfirmModal';
import Badge from '../../components/ui/primitives/Badge';
import apiClient from '../../services/api-client';
import UserForm from './UserForm';
import { PERMISSIONS } from '../../utils/permissions';

function getInitials(name) {
  if (!name) return 'U';
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function UsersPage() {
  const { data, loading, error, refetch } = useFetchList('/users');
  const currentUser = useSelector((state) => state.auth.user);

  // Form & Action Modals
  const [formTarget, setFormTarget] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all'); // 'all' | 'super_admin' | 'admin' | 'active' | 'inactive'

  const adminUsers = useMemo(
    () => (data || []).filter((u) => u.role === 'admin' || u.role === 'super_admin'),
    [data]
  );

  const stats = useMemo(() => {
    const total = adminUsers.length;
    const superAdmins = adminUsers.filter((u) => u.role === 'super_admin').length;
    const standardAdmins = adminUsers.filter((u) => u.role === 'admin').length;
    const active = adminUsers.filter((u) => u.active).length;
    const inactive = adminUsers.filter((u) => !u.active).length;
    return { total, superAdmins, standardAdmins, active, inactive };
  }, [adminUsers]);

  const searchLower = search.toLowerCase().trim();
  const filteredUsers = useMemo(() => {
    return adminUsers
      .filter((u) => {
        if (filterRole === 'super_admin') return u.role === 'super_admin';
        if (filterRole === 'admin') return u.role === 'admin';
        if (filterRole === 'active') return u.active;
        if (filterRole === 'inactive') return !u.active;
        return true;
      })
      .filter((u) => {
        if (!searchLower) return true;
        const nameMatch = u.name?.toLowerCase().includes(searchLower);
        const emailMatch = u.email?.toLowerCase().includes(searchLower);
        const roleMatch = u.role?.toLowerCase().includes(searchLower);
        const permMatch = (u.permissions || []).some((p) =>
          p.toLowerCase().includes(searchLower)
        );
        return nameMatch || emailMatch || roleMatch || permMatch;
      });
  }, [adminUsers, filterRole, searchLower]);

  function handleSaved() {
    refetch();
    setFormTarget(null);
  }

  async function setActive(targetUser, active) {
    setDeleteError(null);
    try {
      await apiClient.patch(`/users/${targetUser.id}`, {
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        permissions: targetUser.permissions,
        active,
      });
      refetch();
    } catch (err) {
      setDeleteError(err.response?.data?.message || err.message);
    }
  }

  function handleActivate(targetUser) {
    setActive(targetUser, true);
  }

  async function handleConfirmDeactivate() {
    await setActive(deactivateTarget, false);
    setDeactivateTarget(null);
  }

  async function handleConfirmDelete() {
    setDeleteError(null);
    try {
      await apiClient.delete(`/users/${deleteTarget.id}`);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      setDeleteError(err.response?.data?.message || err.message);
      setDeleteTarget(null);
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Admin User',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 border border-violet-200 dark:border-violet-800/50">
            {getInitials(row.name)}
          </div>
          <div>
            <span className="font-bold text-xs text-slate-900 dark:text-neutral-100 block">
              {row.name}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-neutral-400">
              {row.email}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      width: '130px',
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
            row.role === 'super_admin'
              ? 'border border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800/40 dark:bg-violet-950/40 dark:text-violet-300'
              : 'border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/40 dark:bg-blue-950/40 dark:text-blue-300'
          }`}
        >
          <FiShield className="h-3 w-3" />
          <span>{row.role === 'super_admin' ? 'Super Admin' : 'Admin'}</span>
        </span>
      ),
    },
    {
      key: 'permissions',
      label: 'Feature Permissions',
      render: (row) => (
        <div className="max-w-[280px]">
          {row.role === 'super_admin' ? (
            <span className="inline-flex items-center gap-1 rounded bg-violet-100/70 dark:bg-violet-950/50 px-1.5 py-0.5 text-[10.5px] font-bold text-violet-800 dark:text-violet-300">
              <FiKey className="h-2.5 w-2.5" />
              <span>Full Access (All Permissions)</span>
            </span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {(row.permissions || []).length > 0 ? (
                PERMISSIONS.filter((p) => (row.permissions || []).includes(p.key)).map(
                  (p) => (
                    <span
                      key={p.key}
                      className="rounded bg-slate-100 dark:bg-surface-800 px-1.5 py-0.2 text-[10px] font-semibold text-slate-700 dark:text-neutral-300 border border-slate-200 dark:border-white/5"
                    >
                      {p.label}
                    </span>
                  )
                )
              ) : (
                <span className="text-[11px] text-slate-400">No permissions assigned</span>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'active',
      label: 'Status',
      width: '110px',
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
            row.active
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'border border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-400'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              row.active ? 'bg-emerald-500' : 'bg-slate-400'
            }`}
          />
          <span>{row.active ? 'Active' : 'Inactive'}</span>
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      width: '180px',
      render: (row) => {
        const isSelf = row.id === currentUser?.id;
        return (
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setFormTarget(row)}
              className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white hover:bg-slate-50 px-2 py-0.5 text-[10.5px] font-semibold text-slate-700 shadow-2xs dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 transition-colors cursor-pointer"
            >
              <FiEdit2 className="h-2.5 w-2.5 text-slate-400" />
              <span>Edit</span>
            </button>

            {!isSelf &&
              (row.active ? (
                <button
                  type="button"
                  onClick={() => setDeactivateTarget(row)}
                  className="rounded border border-amber-200 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300 shadow-2xs transition-colors cursor-pointer"
                >
                  Deactivate
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleActivate(row)}
                  className="rounded border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300 shadow-2xs transition-colors cursor-pointer"
                >
                  Activate
                </button>
              ))}

            {!isSelf && (
              <button
                type="button"
                onClick={() => setDeleteTarget(row)}
                title="Delete Admin"
                className="rounded border border-rose-200 bg-rose-50 hover:bg-rose-100 p-1 text-rose-600 shadow-2xs dark:border-rose-800/40 dark:bg-rose-950/40 dark:text-rose-300 transition-colors cursor-pointer"
              >
                <FiTrash2 className="h-2.5 w-2.5" />
              </button>
            )}

            {isSelf && (
              <span className="rounded bg-slate-100 dark:bg-surface-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                You
              </span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-2.5 sm:space-y-4 pb-12 w-full max-w-full overflow-x-hidden">
      {/* Executive Header Card — COMPACT */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-neutral-100">
                Admin Users & Access
              </h1>
              <span className="inline-flex items-center rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 dark:border-violet-800/40 dark:bg-violet-950/40 dark:text-violet-300">
                Access Control
              </span>
            </div>
            <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500 dark:text-neutral-400">
              Super admin only: manage administrative user accounts, roles, and granular feature permissions.
            </p>
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 shadow-2xs transition-colors cursor-pointer"
            >
              <FiRefreshCw className={`h-3 w-3 ${loading ? 'animate-spin text-violet-600' : 'text-slate-500'}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => setFormTarget('new')}
              className="inline-flex items-center gap-1 rounded-xl bg-violet-600 hover:bg-violet-700 active:bg-violet-800 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs transition-colors cursor-pointer"
            >
              <FiPlus className="h-3 w-3" />
              <span>Add Admin</span>
            </button>
          </div>
        </div>

        {/* Live Counters Strip — Ultra-compact Single Line */}
        <div className="mt-2.5 flex items-center gap-2 text-[10.5px] text-slate-500 dark:text-neutral-400 border-t border-slate-100 pt-2 dark:border-white/5 flex-wrap">
          <span>
            Total Admins:{' '}
            <strong className="font-bold text-slate-900 dark:text-neutral-100">
              {stats.total}
            </strong>
          </span>
          <span className="text-slate-300 dark:text-neutral-600">•</span>
          <span>
            Super Admins:{' '}
            <strong className="font-bold text-violet-700 dark:text-violet-300">
              {stats.superAdmins}
            </strong>
          </span>
          <span className="text-slate-300 dark:text-neutral-600">•</span>
          <span>
            Active:{' '}
            <strong className="font-bold text-emerald-700 dark:text-emerald-300">
              {stats.active}
            </strong>
          </span>
          <span className="text-slate-300 dark:text-neutral-600">•</span>
          <span>
            Inactive:{' '}
            <strong className="font-bold text-slate-600 dark:text-neutral-300">
              {stats.inactive}
            </strong>
          </span>
        </div>
      </div>

      {/* Toolbar: Search & Tab Chips — WRAPPING (Zero Horizontal Scrolling) */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-2 sm:p-2.5 shadow-2xs dark:border-white/10 dark:bg-surface-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        {/* Status / Role Tab Pills — Wrapping */}
        <div className="flex flex-wrap items-center gap-1 pb-0.5 sm:pb-0">
          <button
            type="button"
            onClick={() => setFilterRole('all')}
            className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] sm:text-[11px] font-bold transition-colors cursor-pointer ${
              filterRole === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-300'
            }`}
          >
            <span>All</span>
            <span
              className={`rounded px-1 text-[9px] sm:text-[9.5px] font-extrabold ${
                filterRole === 'all'
                  ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 dark:bg-surface-700 dark:text-neutral-300'
              }`}
            >
              {stats.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterRole('active')}
            className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] sm:text-[11px] font-bold transition-colors cursor-pointer ${
              filterRole === 'active'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300'
            }`}
          >
            <FiCheckCircle className="h-3 w-3" />
            <span>Active</span>
            <span
              className={`rounded px-1 text-[9px] sm:text-[9.5px] font-extrabold ${
                filterRole === 'active' ? 'bg-white/20 text-white' : 'bg-emerald-200 text-emerald-800'
              }`}
            >
              {stats.active}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterRole('inactive')}
            className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] sm:text-[11px] font-bold transition-colors cursor-pointer ${
              filterRole === 'inactive'
                ? 'bg-slate-600 text-white shadow-xs'
                : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-300'
            }`}
          >
            <FiSlash className="h-3 w-3" />
            <span>Inactive</span>
            <span
              className={`rounded px-1 text-[9px] sm:text-[9.5px] font-extrabold ${
                filterRole === 'inactive' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {stats.inactive}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterRole('super_admin')}
            className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] sm:text-[11px] font-bold transition-colors cursor-pointer ${
              filterRole === 'super_admin'
                ? 'bg-violet-600 text-white shadow-xs'
                : 'border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-800/40 dark:bg-violet-950/40 dark:text-violet-300'
            }`}
          >
            <FiShield className="h-3 w-3" />
            <span>Super Admins</span>
            <span
              className={`rounded px-1 text-[9px] sm:text-[9.5px] font-extrabold ${
                filterRole === 'super_admin' ? 'bg-white/20 text-white' : 'bg-violet-200 text-violet-800'
              }`}
            >
              {stats.superAdmins}
            </span>
          </button>
        </div>

        {/* Search Box */}
        <div className="relative w-full sm:w-auto sm:min-w-[200px] flex-1 sm:max-w-xs">
          <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, or role…"
            className="w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-8 pr-7 py-1 text-xs text-slate-800 placeholder-slate-400 focus:border-violet-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-surface-800 dark:text-neutral-100 transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 cursor-pointer"
            >
              <FiX className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {deleteError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700">
          {deleteError}
        </div>
      )}

      {error && <TableState tone="error">{error}</TableState>}

      {loading && !data ? (
        <TableState>Loading admin users…</TableState>
      ) : (
        <>
          {/* ──────────────── DESKTOP VIEW (>= lg) ──────────────── */}
          <div className="hidden lg:block overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs dark:border-white/10 dark:bg-surface-900">
            <DataTable
              columns={columns}
              rows={filteredUsers}
              emptyMessage={
                search
                  ? 'No admin users match your search.'
                  : "No admin accounts configured. Click '+ Add Admin' to create one."
              }
              showRowNumber
              headerColor="blue"
              maxHeight="calc(100vh - 270px)"
            />
          </div>

          {/* ──────────────── MOBILE CARDS STREAM (< lg) — ZERO HORIZONTAL SCROLLING ──────────────── */}
          <div className="block lg:hidden space-y-2">
            {filteredUsers.length === 0 ? (
              <div className="rounded-xl border border-slate-200/90 bg-white p-5 text-center dark:border-white/10 dark:bg-surface-900 shadow-2xs">
                <FiUserCheck className="mx-auto h-5 w-5 text-slate-400" />
                <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-neutral-200">
                  {search ? 'No admins match your search.' : 'No admin accounts configured.'}
                </p>
              </div>
            ) : (
              filteredUsers.map((u, idx) => {
                const isSelf = u.id === currentUser?.id;
                const perms =
                  u.role === 'super_admin'
                    ? 'All Permissions'
                    : PERMISSIONS.filter((p) => (u.permissions || []).includes(p.key))
                        .map((p) => p.label)
                        .join(', ') || 'No permissions';

                return (
                  <div
                    key={u.id}
                    className="rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-2xs dark:border-white/10 dark:bg-surface-900 space-y-1.5 transition-all hover:border-slate-300 dark:hover:border-white/20"
                  >
                    {/* Top Row: Avatar + Name + Badges */}
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 border border-violet-200 dark:border-violet-800/50">
                          {getInitials(u.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold font-mono text-slate-400 dark:text-neutral-500 shrink-0">
                              #{idx + 1}
                            </span>
                            <span className="font-bold text-xs text-slate-900 dark:text-neutral-100 truncate">
                              {u.name}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.2 text-[9.5px] font-bold ${
                            u.role === 'super_admin'
                              ? 'border border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800/40 dark:bg-violet-950/40 dark:text-violet-300'
                              : 'border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/40 dark:bg-blue-950/40 dark:text-blue-300'
                          }`}
                        >
                          <FiShield className="h-2.5 w-2.5" />
                          <span>{u.role === 'super_admin' ? 'Super Admin' : 'Admin'}</span>
                        </span>

                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.2 text-[9.5px] font-bold ${
                            u.active
                              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'border border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-400'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              u.active ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          />
                          <span>{u.active ? 'Active' : 'Inactive'}</span>
                        </span>
                      </div>
                    </div>

                    {/* Email */}
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-neutral-400">
                      <FiMail className="h-3 w-3 text-slate-400 shrink-0" />
                      <span className="truncate">{u.email}</span>
                    </div>

                    {/* Permissions Row */}
                    <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-2 py-1 dark:border-white/5 dark:bg-surface-800/60">
                      <div className="flex items-center gap-1 text-[10.5px]">
                        <span className="text-[9.5px] uppercase font-bold text-slate-400 shrink-0">
                          Access:
                        </span>
                        <span className="font-semibold text-slate-700 dark:text-neutral-200 truncate">
                          {perms}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="flex flex-wrap items-center justify-between gap-1 pt-0.5">
                      <button
                        type="button"
                        onClick={() => setFormTarget(u)}
                        className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white hover:bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 shadow-2xs transition-colors cursor-pointer"
                      >
                        <FiEdit2 className="h-2.5 w-2.5 text-slate-400" />
                        <span>Edit</span>
                      </button>

                      <div className="flex items-center gap-1">
                        {!isSelf ? (
                          <>
                            {u.active ? (
                              <button
                                type="button"
                                onClick={() => setDeactivateTarget(u)}
                                className="rounded border border-amber-200 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300 shadow-2xs transition-colors cursor-pointer"
                              >
                                Deactivate
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleActivate(u)}
                                className="rounded border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300 shadow-2xs transition-colors cursor-pointer"
                              >
                                Activate
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setDeleteTarget(u)}
                              title="Delete Admin"
                              className="inline-flex items-center rounded border border-rose-200 bg-rose-50 hover:bg-rose-100 p-1 text-rose-600 shadow-2xs dark:border-rose-800/40 dark:bg-rose-950/40 dark:text-rose-300 transition-colors cursor-pointer"
                            >
                              <FiTrash2 className="h-2.5 w-2.5" />
                            </button>
                          </>
                        ) : (
                          <span className="rounded bg-slate-100 dark:bg-surface-800 px-1.5 py-0.5 text-[9.5px] font-bold text-slate-500">
                            Your Account
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Add / Edit Admin Modal */}
      {formTarget && (
        <Modal
          title={formTarget === 'new' ? 'Add Admin' : 'Edit Admin'}
          description={
            formTarget === 'new'
              ? 'Create an admin account and configure granular access permissions.'
              : 'Update role, permissions, or account details.'
          }
          onClose={() => setFormTarget(null)}
        >
          <UserForm
            targetUser={formTarget === 'new' ? null : formTarget}
            onSaved={handleSaved}
            onCancel={() => setFormTarget(null)}
          />
        </Modal>
      )}

      {/* Deactivate Confirmation Modal */}
      {deactivateTarget && (
        <ConfirmModal
          title="Deactivate Admin"
          message={`Deactivate "${deactivateTarget.name}"? They will no longer be able to log in, but can be reactivated any time.`}
          confirmLabel="Deactivate"
          requireTyping={false}
          onConfirm={handleConfirmDeactivate}
          onCancel={() => setDeactivateTarget(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Admin"
          message={`Delete "${deleteTarget.name}"? Accounts with any activity history can't be deleted — deactivate them instead.`}
          confirmLabel="Delete"
          requireTyping={false}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

export default UsersPage;
