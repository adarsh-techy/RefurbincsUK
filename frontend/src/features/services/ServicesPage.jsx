import { useState } from 'react';
import { useSelector } from 'react-redux';
import { FiTool, FiShield, FiPlus, FiAlertCircle } from 'react-icons/fi';
import useFetchList from '../../utils/use-fetch-list';
import { hasPermission } from '../../utils/permissions';
import DataTable from '../../components/ui/table/DataTable';
import TableState from '../../components/ui/table/TableState';
import PageHeader from '../../components/ui/primitives/PageHeader';
import Button from '../../components/ui/primitives/Button';
import Modal from '../../components/ui/overlays/Modal';
import ConfirmModal from '../../components/ui/overlays/ConfirmModal';
import AlertModal from '../../components/ui/overlays/AlertModal';
import Badge from '../../components/ui/primitives/Badge';
import RowActions from '../../components/ui/table/RowActions';
import apiClient from '../../services/api-client';
import ServiceForm from './ServiceForm';

function ServicesPage() {
  const { data, loading, error, refetch } = useFetchList('/services');
  const user = useSelector((state) => state.auth.user);
  const canManage = hasPermission(user, 'services');
  const isSuperAdmin = user?.role === 'super_admin';

  // formTarget: null = closed, { mode: 'new', isMandatory: boolean } or { mode: 'edit', service: object }
  const [formTarget, setFormTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  const standardServices = (data || []).filter((s) => !s.is_mandatory);
  const mandatoryFees = (data || []).filter((s) => s.is_mandatory);

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
        <div>
          <span className="font-semibold text-slate-900 dark:text-neutral-100">{row.name}</span>
          {row.description && (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-neutral-400 line-clamp-1">
              {row.description}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'rate',
      label: 'Standard Rate',
      render: (row) => (
        <span className="font-bold text-emerald-600 dark:text-emerald-400">
          £{Number(row.rate || 0).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'active',
      label: 'Status',
      render: (row) => (
        <Badge tone={row.active ? 'good' : 'neutral'}>{row.active ? 'Active' : 'Disabled'}</Badge>
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
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900 dark:text-neutral-100">{row.name}</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              Auto-Applied
            </span>
          </div>
          {row.description && (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-neutral-400 line-clamp-1">
              {row.description}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'rate',
      label: 'Intake Fee Rate',
      render: (row) => (
        <span className="font-bold text-amber-600 dark:text-amber-400">
          £{Number(row.rate || 0).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'active',
      label: 'Status',
      render: (row) => (
        <Badge tone={row.active ? 'good' : 'neutral'}>
          {row.active ? 'Active (Auto-Intake)' : 'Disabled'}
        </Badge>
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

  return (
    <div className="space-y-8 pb-10">
      <PageHeader
        title="Services & Pricing"
        description="Configure workshop testing rates, custom labor pricing, and mandatory battery intake fees."
        titleClassName="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400"
      >
        {canManage && (
          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              onClick={() => setFormTarget({ mode: 'new', isMandatory: true })}
            >
              <span className="text-amber-600 dark:text-amber-400 font-semibold">+ Add Mandatory Fee</span>
            </Button>
            <Button
              variant="primary"
              onClick={() => setFormTarget({ mode: 'new', isMandatory: false })}
            >
              + Add Service
            </Button>
          </div>
        )}
      </PageHeader>

      {error && <TableState tone="error">{error}</TableState>}

      {loading && !data ? (
        <TableState>Loading services…</TableState>
      ) : (
        <>
          {/* Section 1: Workshop & Testing Services */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FiTool className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Workshop & Testing Services</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                    {standardServices.length}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
                  Optional diagnostic and refurbishment services selectable by technicians during testing and repairs.
                </p>
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setFormTarget({ mode: 'new', isMandatory: false })}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer self-start sm:self-auto"
                >
                  <FiPlus className="w-3.5 h-3.5" />
                  <span>Add Service</span>
                </button>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-surface-700 shadow-2xs">
              <DataTable
                columns={standardColumns}
                rows={standardServices}
                emptyMessage="No workshop services added yet. Click '+ Add Service' to create one."
                showRowNumber
                headerColor="blue"
              />
            </div>
          </div>

          {/* Section 2: Mandatory Intake Service Fees */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FiShield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Mandatory Intake Service Fees</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                      {mandatoryFees.length}
                    </span>
                  </h2>
                  <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-200/80 dark:border-amber-700/50">
                    Auto-added to all battery intakes
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
                  Mandatory baseline fees automatically logged and charged against every battery entering the workshop (Truck Intake, Excel import, and client dispatch).
                </p>
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setFormTarget({ mode: 'new', isMandatory: true })}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-400 cursor-pointer self-start sm:self-auto"
                >
                  <FiPlus className="w-3.5 h-3.5" />
                  <span>Add Mandatory Fee</span>
                </button>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border border-amber-200/80 dark:border-amber-900/40 shadow-2xs">
              <DataTable
                columns={mandatoryColumns}
                rows={mandatoryFees}
                emptyMessage="No mandatory intake fees configured. Click '+ Add Mandatory Fee' to create one."
                showRowNumber
                headerColor="amber"
              />
            </div>
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
