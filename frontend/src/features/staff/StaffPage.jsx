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
import Badge from '../../components/ui/Badge';
import RowActions from '../../components/ui/RowActions';
import apiClient from '../../services/api-client';
import StaffForm from './StaffForm';

function StaffPage() {
  const { data, loading, error, refetch } = useFetchList('/staff');
  const user = useSelector((state) => state.auth.user);
  const isSuperAdmin = user?.role === 'super_admin';

  // null = closed, 'new' = create form, a staff object = edit form
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
      await apiClient.delete(`/staff/${deleteTarget.id}`);
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
      label: 'Name',
      render: (row) => (
        <Link to={`/staff/${row.id}`} className="font-medium text-blue-700 hover:underline dark:text-blue-400">
          {row.name}
        </Link>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (row) => {
        const role = row.role ? row.role.charAt(0).toUpperCase() + row.role.slice(1) : 'Technician';
        return (
          <span className="font-medium text-slate-800 dark:text-neutral-200">
            {role}
          </span>
        );
      },
    },
    {
      key: 'login_email',
      label: 'Login',
      render: (row) =>
        row.login_email ? (
          <span className="text-slate-600 dark:text-neutral-300">{row.login_email}</span>
        ) : (
          <span className="text-slate-400 dark:text-neutral-500">No login</span>
        ),
    },
    {
      key: 'salary',
      label: 'Monthly Salary',
      render: (row) => `£${Number(row.salary).toFixed(2)}`,
    },
    {
      key: 'active',
      label: 'Status',
      render: (row) => <Badge tone={row.active ? 'good' : 'neutral'}>{row.active ? 'Active' : 'Inactive'}</Badge>,
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
        title="Repair Staff"
        description="Technicians who repair batteries."
        titleClassName="text-2xl font-bold tracking-tight text-green-600 dark:text-green-400"
      >
        <Button variant="darkViolet" onClick={() => setFormTarget('new')}>+ Add Staff</Button>
      </PageHeader>

      {formTarget && (
        <Modal
          title={formTarget === 'new' ? 'Add Staff' : 'Edit Staff'}
          description={
            formTarget === 'new'
              ? 'Add a new repair technician.'
              : 'Update this technician’s details.'
          }
          onClose={() => setFormTarget(null)}
        >
          <StaffForm
            staff={formTarget === 'new' ? null : formTarget}
            onSaved={handleSaved}
            onCancel={() => setFormTarget(null)}
          />
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Staff"
          message={`Delete staff member "${deleteTarget.name}"?`}
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

export default StaffPage;
