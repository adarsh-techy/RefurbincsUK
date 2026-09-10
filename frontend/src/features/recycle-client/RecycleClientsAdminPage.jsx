import { useState } from 'react';
import { useSelector } from 'react-redux';
import useFetchList from '../../utils/use-fetch-list';
import DataTable from '../../components/ui/DataTable';
import TableState from '../../components/ui/TableState';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import ConfirmModal from '../../components/ui/ConfirmModal';
import AlertModal from '../../components/ui/AlertModal';
import RowActions from '../../components/ui/RowActions';
import apiClient from '../../services/api-client';
import RecycleClientForm from './RecycleClientForm';

function RecycleClientsAdminPage() {
  const { data: clients, loading, error, refetch } = useFetchList('/clients');
  const user = useSelector((state) => state.auth.user);
  const isSuperAdmin = user?.role === 'super_admin';

  // null = closed, 'new' = create form, a client object = edit form
  const [formTarget, setFormTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  // Filter clients that belong to recycle_client role
  const recycleClients = (clients || []).filter((c) => c.user_role === 'recycle_client');

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

  const columns = [
    {
      key: 'name',
      label: 'Recycle Client',
      render: (row) => (
        <span className="font-semibold text-slate-800 dark:text-neutral-100">{row.name}</span>
      ),
    },
    {
      key: 'login_email',
      label: 'Login Email',
      render: (row) =>
        row.login_email ? (
          <span className="font-mono text-sm text-slate-600 dark:text-neutral-300">
            {row.login_email}
          </span>
        ) : (
          <span className="text-slate-400 dark:text-neutral-500">No login</span>
        ),
    },
    {
      key: 'created_at',
      label: 'Added',
      render: (row) => new Date(row.created_at).toLocaleDateString(),
    },
    ...(isSuperAdmin
      ? [
          {
            key: 'actions',
            label: '',
            render: (row) => (
              <div className="-mr-2 flex justify-end">
                <RowActions
                  onEdit={() => setFormTarget(row)}
                  onDelete={() => setDeleteTarget(row)}
                />
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Recycle Clients"
          description="Manage recycling partner accounts that receive unserviceable battery shipments."
        />
        <button
          type="button"
          onClick={() => setFormTarget('new')}
          className="self-start sm:self-auto rounded-md bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          + Add Recycle Client
        </button>
      </div>

      {deleteError && (
        <AlertModal title="Delete Failed" message={deleteError} onClose={() => setDeleteError(null)} />
      )}

      {loading && <TableState>Loading recycle clients…</TableState>}
      {error && <TableState tone="error">{error}</TableState>}

      {!loading && !error && (
        <DataTable
          columns={columns}
          rows={recycleClients}
          showRowNumber
          emptyMessage="No recycle client partners added yet. Click '+ Add Recycle Client' above to create one."
        />
      )}

      {formTarget && (
        <Modal
          title={formTarget === 'new' ? 'Add Recycle Client' : `Edit ${formTarget.name}`}
          onClose={() => setFormTarget(null)}
        >
          <RecycleClientForm
            client={formTarget === 'new' ? null : formTarget}
            onSaved={handleSaved}
            onCancel={() => setFormTarget(null)}
          />
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Recycle Client"
          message={`Delete "${deleteTarget.name}"? If this client is tagged on existing shipments, deactivating their account is recommended instead.`}
          requireTyping={false}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

export default RecycleClientsAdminPage;
