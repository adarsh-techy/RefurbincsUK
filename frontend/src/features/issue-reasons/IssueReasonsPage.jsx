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
import IssueReasonForm from './IssueReasonForm';

// Manages the "can't service this battery" reasons a technician picks from
// in the app (e.g. "Battery is dead") — same CRUD pattern as Parts/Clients.
function IssueReasonsPage() {
  const { data, loading, error, refetch } = useFetchList('/issue-reasons');
  const user = useSelector((state) => state.auth.user);
  const canManage = hasPermission(user, 'issue_reasons');
  const isSuperAdmin = user?.role === 'super_admin';

  // null = closed, 'new' = create form, a reason object = edit form
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
      await apiClient.delete(`/issue-reasons/${deleteTarget.id}`);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      setDeleteError(err.response?.data?.message || err.message);
      setDeleteTarget(null);
    }
  }

  const columns = [
    { key: 'label', label: 'Reason' },
    { key: 'sort_order', label: 'Order' },
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
        title="Issue Reasons"
        description="Reasons a technician can report when a battery cannot be serviced or repaired."
        titleClassName="text-2xl font-bold tracking-tight text-green-600 dark:text-green-400"
      >
        {canManage && <Button variant="darkViolet" onClick={() => setFormTarget('new')}>+ Add Reason</Button>}
      </PageHeader>

      {formTarget && (
        <Modal
          title={formTarget === 'new' ? 'Add Reason' : 'Edit Reason'}
          description={
            formTarget === 'new'
              ? 'Add a new reason technicians can select.'
              : 'Update this reason’s details.'
          }
          onClose={() => setFormTarget(null)}
        >
          <IssueReasonForm
            reason={formTarget === 'new' ? null : formTarget}
            existingReasons={data}
            onSaved={handleSaved}
            onCancel={() => setFormTarget(null)}
          />
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Reason"
          message={`Delete reason "${deleteTarget.label}"? This can't be undone.`}
          requireTyping={false}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {deleteError && (
        <AlertModal title="Cannot Delete Reason" message={deleteError} onClose={() => setDeleteError(null)} />
      )}

      {loading && !data ? (
        <TableState>Loading issue reasons…</TableState>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-surface-700">
          <DataTable
            columns={columns}
            rows={data || []}
            emptyMessage="No issue reasons configured yet. Click '+ Add Reason' to create one."
            showRowNumber
            headerColor="blue"
            maxHeight="calc(100vh - 270px)"
          />
        </div>
      )}
    </div>
  );
}

export default IssueReasonsPage;
