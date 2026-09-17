import { useState } from 'react';
import { useSelector } from 'react-redux';
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

  // null = closed, 'new' = create form, a service object = edit form
  const [formTarget, setFormTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

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

  const columns = [
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
                onEdit={() => setFormTarget(row)}
                onDelete={isSuperAdmin ? () => setDeleteTarget(row) : undefined}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Services & Pricing"
        description="Configure workshop and testing services, customizable labor pricing, and standard billable rates."
        titleClassName="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400"
      >
        {canManage && (
          <Button variant="primary" onClick={() => setFormTarget('new')}>
            + Add Service
          </Button>
        )}
      </PageHeader>

      {error && <TableState tone="error">{error}</TableState>}

      {loading && !data ? (
        <TableState>Loading services…</TableState>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-surface-700">
          <DataTable
            columns={columns}
            rows={data || []}
            emptyMessage="No services added yet. Click '+ Add Service' to create one."
            showRowNumber
            headerColor="blue"
            maxHeight="calc(100vh - 270px)"
          />
        </div>
      )}

      {formTarget && (
        <Modal
          title={formTarget === 'new' ? 'New Service' : `Edit — ${formTarget.name}`}
          onClose={() => setFormTarget(null)}
        >
          <ServiceForm
            service={formTarget === 'new' ? null : formTarget}
            onSaved={handleSaved}
            onCancel={() => setFormTarget(null)}
          />
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Service"
          message={`Are you sure you want to delete "${deleteTarget.name}"? Past batteries with this service logged will retain their history.`}
          confirmLabel="Delete"
          tone="critical"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

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
