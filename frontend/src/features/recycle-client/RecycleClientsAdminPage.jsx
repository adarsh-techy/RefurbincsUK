import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import useFetchList from '../../utils/use-fetch-list';
import DataTable from '../../components/ui/table/DataTable';
import TableState from '../../components/ui/table/TableState';
import PageHeader from '../../components/ui/primitives/PageHeader';
import Modal from '../../components/ui/overlays/Modal';
import ConfirmModal from '../../components/ui/overlays/ConfirmModal';
import AlertModal from '../../components/ui/overlays/AlertModal';
import RowActions from '../../components/ui/table/RowActions';
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
  const [search, setSearch] = useState('');

  // Filter clients that belong to recycle_client role
  const recycleClients = (clients || []).filter((c) => {
    if (c.user_role !== 'recycle_client') return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.login_email?.toLowerCase().includes(q)
    );
  });

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
        <Link
          to={`/recycle-clients/${row.id}`}
          className="font-bold text-blue-700 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
        >
          {row.name}
        </Link>
      ),
    },
    {
      key: 'login_email',
      label: 'Login Email',
      render: (row) =>
        row.login_email ? (
          <span className="font-mono text-xs sm:text-sm text-slate-600 dark:text-neutral-300">
            {row.login_email}
          </span>
        ) : (
          <span className="text-slate-400 dark:text-neutral-500 text-xs">No login</span>
        ),
    },
    {
      key: 'created_at',
      label: 'Added Date',
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
          className="self-start sm:self-auto rounded-xl bg-brand-600 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-brand-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 transition-colors cursor-pointer"
        >
          + Add Recycle Client
        </button>
      </div>

      {deleteError && (
        <AlertModal title="Delete Failed" message={deleteError} onClose={() => setDeleteError(null)} />
      )}

      <div className="mb-4 sm:mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-blue-200 p-3 shadow-xs dark:border-blue-800/40">
        <div className="min-w-[16rem] flex-1 sm:flex-none">
          <label htmlFor="recycle-client-search" className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider">
            Search Partner / Email
          </label>
          <input
            id="recycle-client-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="e.g. EcoBattery or recycle@gmail.com"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-100 sm:w-72"
          />
        </div>

        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 cursor-pointer transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {loading && <TableState>Loading recycle clients…</TableState>}
      {error && <TableState tone="error">{error}</TableState>}

      {!loading && !error && (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-surface-700">
          <DataTable
            columns={columns}
            rows={recycleClients}
            showRowNumber
            headerColor="blue"
            maxHeight="calc(100vh - 320px)"
            emptyMessage="No recycle client partners match these filters. Click '+ Add Recycle Client' above to create one."
          />
        </div>
      )}

      {formTarget && (
        <Modal
          title={formTarget === 'new' ? 'Add Recycle Client' : `Edit ${formTarget.name}`}
          size="3xl"
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
