import { useState } from 'react';
import { useSelector } from 'react-redux';
import useFetchList from '../../utils/use-fetch-list';
import DataTable from '../../components/ui/table/DataTable';
import TableState from '../../components/ui/table/TableState';
import PageHeader from '../../components/ui/primitives/PageHeader';
import Button from '../../components/ui/primitives/Button';
import Modal from '../../components/ui/overlays/Modal';
import ConfirmModal from '../../components/ui/overlays/ConfirmModal';
import Badge from '../../components/ui/primitives/Badge';
import RowActions from '../../components/ui/table/RowActions';
import apiClient from '../../services/api-client';
import UserForm from './UserForm';
import { PERMISSIONS } from '../../utils/permissions';

function UsersPage() {
  const { data, loading, error, refetch } = useFetchList('/users');
  const currentUser = useSelector((state) => state.auth.user);

  // null = closed, 'new' = create form, a user object = edit form
  const [formTarget, setFormTarget] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

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

  // Reactivating just restores login access, so it fires immediately.
  // Deactivating blocks login, so it goes through a confirm step first.
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
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    {
      key: 'role',
      label: 'Role',
      render: (row) => (
        <Badge tone={row.role === 'super_admin' ? 'info' : 'neutral'}>
          {row.role === 'super_admin' ? 'Super Admin' : 'Admin'}
        </Badge>
      ),
    },
    {
      key: 'permissions',
      label: 'Permissions',
      render: (row) => (
        <div className="max-w-[180px] whitespace-normal">
          {row.role === 'super_admin'
            ? 'All'
            : PERMISSIONS.filter((p) => (row.permissions || []).includes(p.key))
                .map((p) => p.label)
                .join(', ') || '—'}
        </div>
      ),
    },
    {
      key: 'active',
      label: 'Status',
      render: (row) => <Badge tone={row.active ? 'good' : 'neutral'}>{row.active ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="flex items-center gap-1">
          <RowActions
            onEdit={() => setFormTarget(row)}
            onDelete={row.id === currentUser?.id ? undefined : () => setDeleteTarget(row)}
          />
          {row.id !== currentUser?.id &&
            (row.active ? (
              <button
                type="button"
                onClick={() => setDeactivateTarget(row)}
                className="rounded-md px-2.5 py-1 text-xs font-medium text-critical-600 hover:bg-critical-50 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                Deactivate
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleActivate(row)}
                className="rounded-md px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
              >
                Activate
              </button>
            ))}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Admin Users"
        description="Super admin only: manage admin accounts and role permissions."
        titleClassName="text-2xl font-bold tracking-tight text-green-600 dark:text-green-400"
      >
        <Button variant="darkViolet" onClick={() => setFormTarget('new')}>+ Add Admin</Button>
      </PageHeader>

      {formTarget && (
        <Modal
          title={formTarget === 'new' ? 'Add Admin' : 'Edit Admin'}
          description={
            formTarget === 'new'
              ? 'Create an admin account and choose what it can access.'
              : 'Update this admin’s role, permissions, or status.'
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

      {deleteTarget && (
        <ConfirmModal
          title="Delete Admin"
          message={`Delete "${deleteTarget.name}"? Accounts with any activity history can't be deleted — deactivate them instead.`}
          requireTyping={false}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {deleteError && <p className="mb-4 text-sm text-critical-600 dark:text-red-400">{deleteError}</p>}

      {loading && <TableState>Loading…</TableState>}
      {error && <TableState tone="error">{error}</TableState>}
      {!loading && !error && <DataTable columns={columns} rows={data} headerColor="blue" showRowNumber />}
    </div>
  );
}

export default UsersPage;
