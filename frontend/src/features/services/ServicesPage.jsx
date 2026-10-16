import { useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
  FiTool,
  FiShield,
  FiPlus,
  FiSearch,
  FiX,
  FiEdit2,
  FiTrash2,
} from 'react-icons/fi';
import useFetchList from '../../utils/use-fetch-list';
import { hasPermission } from '../../utils/permissions';
import DataTable from '../../components/ui/table/DataTable';
import TableState from '../../components/ui/table/TableState';
import Modal from '../../components/ui/overlays/Modal';
import ConfirmModal from '../../components/ui/overlays/ConfirmModal';
import AlertModal from '../../components/ui/overlays/AlertModal';
import RowActions from '../../components/ui/table/RowActions';
import apiClient from '../../services/api-client';
import ServiceForm from './ServiceForm';

function ServicesPage() {
  const { data, loading, error, refetch } = useFetchList('/services');
  const user = useSelector((state) => state.auth.user);
  const isSuperAdmin = user?.role === 'super_admin';
  const canManage = hasPermission(user, 'services') && isSuperAdmin;

  // formTarget: null = closed, { mode: 'new', isMandatory: boolean } or { mode: 'edit', service: object }
  const [formTarget, setFormTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'workshop' | 'mandatory'
  const [search, setSearch] = useState('');

  const standardServices = useMemo(
    () => (data || []).filter((s) => !s.is_mandatory),
    [data]
  );
  const mandatoryFees = useMemo(
    () => (data || []).filter((s) => s.is_mandatory),
    [data]
  );

  const searchLower = search.toLowerCase().trim();
  const filterFn = (s) =>
    !searchLower ||
    s.name?.toLowerCase().includes(searchLower) ||
    s.description?.toLowerCase().includes(searchLower);

  const filteredStandard = useMemo(
    () => standardServices.filter(filterFn),
    [standardServices, searchLower]
  );
  const filteredMandatory = useMemo(
    () => mandatoryFees.filter(filterFn),
    [mandatoryFees, searchLower]
  );

  const totalVisibleCount =
    (activeTab === 'all' || activeTab === 'workshop' ? filteredStandard.length : 0) +
    (activeTab === 'all' || activeTab === 'mandatory' ? filteredMandatory.length : 0);

  function handleSaved() {
    refetch();
    setFormTarget(null);
  }

  async function handleConfirmDelete() {
    setDeleteError(null);
    try {
      await apiClient.delete(`/services/${deleteTarget.id}`);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      setDeleteError(err.response?.data?.message || err.message);
      setDeleteTarget(null);
    }
  }

  const standardColumns = [
    {
      key: 'name',
      label: 'Service Name',
      render: (row) => (
        <div className="flex items-start gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-800/50 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400 mt-0.5">
            <FiTool className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="font-bold text-slate-900 dark:text-neutral-100 block">
              {row.name}
            </span>
            {row.description && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-neutral-400 line-clamp-1">
                {row.description}
              </p>
            )}
          </div>
        </div>
      ),
    },
    ...(isSuperAdmin
      ? [
          {
            key: 'rate',
            label: 'Standard Rate',
            render: (row) => (
              <span className="font-extrabold font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                £{Number(row.rate || 0).toFixed(2)}
              </span>
            ),
          },
        ]
      : []),
    {
      key: 'active',
      label: 'Status',
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
          <span>{row.active ? 'Active' : 'Disabled'}</span>
        </span>
      ),
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            label: '',
            render: (row) => (
              <RowActions
                onEdit={() => setFormTarget({ mode: 'edit', service: row })}
                onDelete={isSuperAdmin ? () => setDeleteTarget(row) : undefined}
              />
            ),
          },
        ]
      : []),
  ];

  const mandatoryColumns = [
    {
      key: 'name',
      label: 'Mandatory Fee Name',
      render: (row) => (
        <div className="flex items-start gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-800/50 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400 mt-0.5">
            <FiShield className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-slate-900 dark:text-neutral-100">
                {row.name}
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/80 dark:border-amber-700/50">
                Auto-Applied
              </span>
            </div>
            {row.description && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-neutral-400 line-clamp-1">
                {row.description}
              </p>
            )}
          </div>
        </div>
      ),
    },
    ...(isSuperAdmin
      ? [
          {
            key: 'rate',
            label: 'Intake Fee Rate',
            render: (row) => (
              <span className="font-extrabold font-mono text-amber-600 dark:text-amber-400 text-sm">
                £{Number(row.rate || 0).toFixed(2)}
              </span>
            ),
          },
        ]
      : []),
    {
      key: 'active',
      label: 'Status',
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
          <span>{row.active ? 'Active (Auto-Intake)' : 'Disabled'}</span>
        </span>
      ),
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            label: '',
            render: (row) => (
              <RowActions
                onEdit={() => setFormTarget({ mode: 'edit', service: row })}
                onDelete={isSuperAdmin ? () => setDeleteTarget(row) : undefined}
              />
            ),
          },
        ]
      : []),
  ];

  function renderMobileServiceCard(s, idx, isMandatory) {
    return (
      <div
        key={s.id}
        className="rounded-xl border border-slate-200/80 bg-white p-2 sm:p-2.5 shadow-2xs dark:border-white/10 dark:bg-surface-900 transition-all hover:border-slate-300 dark:hover:border-white/20 space-y-1.5"
      >
        {/* Top Header: Avatar + Title & Badges */}
        <div className="flex items-start justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <div
              className={`h-6 w-6 rounded-md flex items-center justify-center shrink-0 border ${
                isMandatory
                  ? 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/50'
                  : 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/50'
              }`}
            >
              {isMandatory ? (
                <FiShield className="h-3 w-3" />
              ) : (
                <FiTool className="h-3 w-3" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold font-mono text-slate-400 dark:text-neutral-500 shrink-0">
                  #{idx + 1}
                </span>
                <span className="font-bold text-xs text-slate-900 dark:text-neutral-100 truncate">
                  {s.name}
                </span>
                {isMandatory && (
                  <span className="rounded bg-amber-100 dark:bg-amber-950/60 px-1 py-0.2 font-mono text-[8.5px] font-bold text-amber-800 dark:text-amber-300">
                    Auto-Applied
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.2 text-[9.5px] font-bold shrink-0 ${
              s.active
                ? 'border border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'border border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-400'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                s.active ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            />
            <span>{s.active ? 'Active' : 'Disabled'}</span>
          </span>
        </div>

        {/* Description text */}
        {s.description ? (
          <p className="text-[10.5px] text-slate-500 dark:text-neutral-400 line-clamp-1 leading-tight">
            {s.description}
          </p>
        ) : null}

        {/* Compact Combined Price & Actions Container */}
        <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-2 py-1 dark:border-white/5 dark:bg-surface-800/60 flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-1 min-w-0">
            <span className="text-[9px] uppercase font-bold text-slate-400 dark:text-neutral-500">
              {isMandatory ? 'Intake Fee:' : 'Rate:'}
            </span>
            <span
              className={`font-mono font-extrabold text-xs leading-none ${
                isMandatory
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              £{Number(s.rate || 0).toFixed(2)}
            </span>
            <span className="text-[9.5px] text-slate-400 dark:text-neutral-500 truncate">
              {isMandatory ? '/ intake' : '/ test'}
            </span>
          </div>

          {/* Compact Actions inside the row */}
          {canManage && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setFormTarget({ mode: 'edit', service: s })}
                className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white hover:bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 transition-colors cursor-pointer shadow-2xs"
              >
                <FiEdit2 className="h-2.5 w-2.5 text-slate-400" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(s)}
                className="inline-flex items-center gap-0.5 rounded border border-rose-200 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/40 dark:text-rose-300 transition-colors cursor-pointer shadow-2xs"
              >
                <FiTrash2 className="h-2.5 w-2.5 text-rose-500" />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 sm:space-y-4 pb-10">
      {/* Executive Header Card — COMPACT */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-neutral-100">
                Services & Pricing
              </h1>
              <span className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:border-blue-800/40 dark:bg-blue-950/40 dark:text-blue-300">
                Workshop & Intake Rates
              </span>
            </div>
            <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500 dark:text-neutral-400">
              Workshop diagnostic testing rates, custom labor pricing, and mandatory intake fees.
            </p>
          </div>

          {canManage && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setFormTarget({ mode: 'new', isMandatory: true })}
                className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300 transition-colors cursor-pointer shadow-2xs"
              >
                <FiShield className="h-3 w-3 text-amber-600" />
                <span>+ Fee</span>
              </button>
              <button
                type="button"
                onClick={() => setFormTarget({ mode: 'new', isMandatory: false })}
                className="inline-flex items-center gap-1 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs transition-colors cursor-pointer"
              >
                <FiPlus className="h-3 w-3" />
                <span>Add Service</span>
              </button>
            </div>
          )}
        </div>

        {/* Live Counters Strip — Ultra-compact Single Line */}
        <div className="mt-2.5 flex items-center gap-2 text-[10.5px] text-slate-500 dark:text-neutral-400 border-t border-slate-100 pt-2 dark:border-white/5 flex-wrap">
          <span>
            Total: <strong className="font-bold text-slate-900 dark:text-neutral-100">{data?.length || 0}</strong>
          </span>
          <span className="text-slate-300 dark:text-neutral-600">•</span>
          <span>
            Workshop: <strong className="font-bold text-blue-700 dark:text-blue-300">{standardServices.length}</strong>
          </span>
          <span className="text-slate-300 dark:text-neutral-600">•</span>
          <span>
            Mandatory: <strong className="font-bold text-amber-700 dark:text-amber-300">{mandatoryFees.length}</strong>
          </span>
        </div>
      </div>

      {/* Toolbar: Search & Tab Chips — COMPACT */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-2 sm:p-2.5 shadow-2xs dark:border-white/10 dark:bg-surface-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        {/* Tab Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 sm:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-300'
            }`}
          >
            <span>All</span>
            <span
              className={`rounded px-1 text-[9.5px] font-extrabold ${
                activeTab === 'all'
                  ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                  : 'bg-slate-200 text-slate-700 dark:bg-surface-700 dark:text-neutral-300'
              }`}
            >
              {data?.length || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('workshop')}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
              activeTab === 'workshop'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800/40 dark:bg-blue-950/40 dark:text-blue-300'
            }`}
          >
            <FiTool className="h-3 w-3" />
            <span>Workshop</span>
            <span
              className={`rounded px-1 text-[9.5px] font-extrabold ${
                activeTab === 'workshop' ? 'bg-white/20 text-white' : 'bg-blue-200 text-blue-800'
              }`}
            >
              {standardServices.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mandatory')}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
              activeTab === 'mandatory'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300'
            }`}
          >
            <FiShield className="h-3 w-3" />
            <span>Mandatory</span>
            <span
              className={`rounded px-1 text-[9.5px] font-extrabold ${
                activeTab === 'mandatory' ? 'bg-white/20 text-white' : 'bg-amber-200 text-amber-800'
              }`}
            >
              {mandatoryFees.length}
            </span>
          </button>
        </div>

        {/* Search Box */}
        <div className="relative min-w-[180px] sm:w-60">
          <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search services…"
            className="w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-8 pr-7 py-1 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-surface-800 dark:text-neutral-100 transition-colors"
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

      {error && <TableState tone="error">{error}</TableState>}

      {loading && !data ? (
        <TableState>Loading services…</TableState>
      ) : (
        <>
          {/* ──────────────── DESKTOP VIEW (>= lg) ──────────────── */}
          <div className="hidden lg:block space-y-5">
            {/* Workshop Services Section */}
            {(activeTab === 'all' || activeTab === 'workshop') && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 dark:bg-blue-950/60 dark:border-blue-800/50 dark:text-blue-300">
                      <FiTool className="h-3 w-3" />
                    </div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-200 flex items-center gap-1.5">
                      <span>Workshop & Testing Services</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                        {filteredStandard.length}
                      </span>
                    </h2>
                  </div>

                  {canManage && (
                    <button
                      type="button"
                      onClick={() => setFormTarget({ mode: 'new', isMandatory: false })}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer"
                    >
                      <FiPlus className="w-3 h-3" />
                      <span>Add Service</span>
                    </button>
                  )}
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs dark:border-white/10 dark:bg-surface-900">
                  <DataTable
                    columns={standardColumns}
                    rows={filteredStandard}
                    emptyMessage={
                      search
                        ? 'No workshop services match your search.'
                        : "No workshop services added yet. Click '+ Add Service' to create one."
                    }
                    showRowNumber
                    headerColor="blue"
                  />
                </div>
              </div>
            )}

            {/* Mandatory Fees Section */}
            {(activeTab === 'all' || activeTab === 'mandatory') && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700 dark:bg-amber-950/60 dark:border-amber-800/50 dark:text-amber-300">
                      <FiShield className="h-3 w-3" />
                    </div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-200 flex items-center gap-1.5">
                        <span>Mandatory Intake Service Fees</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                          {filteredMandatory.length}
                        </span>
                      </h2>
                      <span className="inline-flex px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-200/80 dark:border-amber-700/50">
                        Auto-added to all battery intakes
                      </span>
                    </div>
                  </div>

                  {canManage && (
                    <button
                      type="button"
                      onClick={() => setFormTarget({ mode: 'new', isMandatory: true })}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-400 cursor-pointer"
                    >
                      <FiPlus className="w-3 h-3" />
                      <span>Add Mandatory Fee</span>
                    </button>
                  )}
                </div>

                <div className="overflow-hidden rounded-xl border border-amber-200/80 bg-white shadow-2xs dark:border-amber-900/40 dark:bg-surface-900">
                  <DataTable
                    columns={mandatoryColumns}
                    rows={filteredMandatory}
                    emptyMessage={
                      search
                        ? 'No mandatory intake fees match your search.'
                        : "No mandatory intake fees configured. Click '+ Fee' to create one."
                    }
                    showRowNumber
                    headerColor="amber"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ──────────────── MOBILE CARDS STREAM (< lg) ──────────────── */}
          <div className="block lg:hidden space-y-2">
            {totalVisibleCount === 0 ? (
              <div className="items-center rounded-xl border border-slate-200/90 bg-white p-5 text-center dark:border-white/10 dark:bg-surface-900">
                <FiTool className="mx-auto h-5 w-5 text-slate-400" />
                <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-neutral-200">
                  {search ? 'No services match your search.' : 'No services configured yet.'}
                </p>
              </div>
            ) : (
              <>
                {/* Workshop Services Section */}
                {(activeTab === 'all' || activeTab === 'workshop') &&
                  filteredStandard.length > 0 && (
                    <div className="space-y-1.5">
                      {activeTab === 'all' && (
                        <div className="px-1 pt-0.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <FiTool className="h-2.5 w-2.5 text-blue-500" />
                            <span>Workshop Services ({filteredStandard.length})</span>
                          </span>
                        </div>
                      )}
                      {filteredStandard.map((s, idx) =>
                        renderMobileServiceCard(s, idx, false)
                      )}
                    </div>
                  )}

                {/* Mandatory Fees Section */}
                {(activeTab === 'all' || activeTab === 'mandatory') &&
                  filteredMandatory.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {activeTab === 'all' && (
                        <div className="px-1 pt-0.5">
                          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                            <FiShield className="h-2.5 w-2.5 text-amber-500" />
                            <span>Mandatory Intake Fees ({filteredMandatory.length})</span>
                          </span>
                        </div>
                      )}
                      {filteredMandatory.map((s, idx) =>
                        renderMobileServiceCard(s, idx, true)
                      )}
                    </div>
                  )}
              </>
            )}
          </div>
        </>
      )}

      {/* Create / Edit Modal */}
      {formTarget && (
        <Modal
          title={
            formTarget.mode === 'new'
              ? formTarget.isMandatory
                ? 'New Mandatory Intake Fee'
                : 'New Service'
              : `Edit — ${formTarget.service.name}`
          }
          onClose={() => setFormTarget(null)}
        >
          <ServiceForm
            service={formTarget.mode === 'edit' ? formTarget.service : null}
            defaultIsMandatory={formTarget.mode === 'new' ? formTarget.isMandatory : false}
            onSaved={handleSaved}
            onCancel={() => setFormTarget(null)}
          />
        </Modal>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmModal
          title={deleteTarget.is_mandatory ? 'Delete Mandatory Fee' : 'Delete Service'}
          message={`Are you sure you want to delete "${deleteTarget.name}"? Past batteries with this service logged will retain their history.`}
          confirmLabel="Delete"
          tone="critical"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Delete Error Alert */}
      {deleteError && (
        <AlertModal
          title="Cannot Delete Service"
          message={deleteError}
          onClose={() => setDeleteError(null)}
        />
      )}
    </div>
  );
}

export default ServicesPage;
