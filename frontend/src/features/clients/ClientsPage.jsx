import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import useFetchList from '../../utils/use-fetch-list';
import DataTable from '../../components/ui/DataTable';
import TableState from '../../components/ui/TableState';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import ConfirmModal from '../../components/ui/ConfirmModal';
import AlertModal from '../../components/ui/AlertModal';
import RowActions from '../../components/ui/RowActions';
import apiClient from '../../services/api-client';
import ClientForm from './ClientForm';

function ClientsPage() {
  const { data, loading, error, refetch } = useFetchList('/clients');
  const user = useSelector((state) => state.auth.user);
  const isSuperAdmin = user?.role === 'super_admin';

  // null = closed, 'new' = create form, a client object = edit form
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
      label: 'Client',
      render: (row) => (
        <Link to={`/clients/${row.id}`} className="font-medium text-blue-700 hover:underline dark:text-blue-400">
          {row.name}
        </Link>
      ),
    },
    {
      key: 'login_email',
      label: 'Login Account',
      render: (row) =>
        row.login_email ? (
          <span className="text-slate-600 dark:text-neutral-300">{row.login_email}</span>
        ) : (
          <span className="text-slate-400 dark:text-neutral-500">No login</span>
        ),
    },
    {
      key: 'invoice_email',
      label: 'Invoice / Billing Email',
      render: (row) =>
        row.invoice_email ? (
          <span className="font-medium text-emerald-600 dark:text-emerald-400 text-xs">{row.invoice_email}</span>
        ) : (
          <span className="text-slate-400 dark:text-neutral-500 text-xs">Same as login</span>
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
              <RowActions onEdit={() => setFormTarget(row)} onDelete={() => setDeleteTarget(row)} />
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Clients batteries are repaired for."
        titleClassName="text-2xl font-bold tracking-tight text-green-600 dark:text-green-400"
      >
        <Button variant="darkViolet" onClick={() => setFormTarget('new')}>+ Add Client</Button>
      </PageHeader>

      {formTarget && (
        <Modal
          title={formTarget === 'new' ? 'Add Client' : 'Edit Client'}
          description={
            formTarget === 'new' ? 'Add a new client.' : 'Update this client’s details.'
          }
          size="3xl"
          className="min-h-[580px] md:min-h-[640px]"
          onClose={() => setFormTarget(null)}
        >
          <ClientForm
            client={formTarget === 'new' ? null : formTarget}
            onSaved={handleSaved}
            onCancel={() => setFormTarget(null)}
          />
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Client"
          message={`Delete client "${deleteTarget.name}"? This can't be undone.`}
          requireTyping={false}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {deleteError && (
        <AlertModal title="Cannot Delete Client" message={deleteError} onClose={() => setDeleteError(null)} />
      )}

      {loading && <TableState>Loading…</TableState>}
      {error && <TableState tone="error">{error}</TableState>}
      {!loading && !error && <DataTable columns={columns} rows={data} headerColor="blue" showRowNumber />}
    </div>
  );
}

export default ClientsPage;
