import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
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
import { resolveImageUrl } from '../../utils/image-url';
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
      key: 'email',
      label: 'Email / Login',
      render: (row) =>
        row.email || row.login_email ? (
          <span className="text-slate-600 dark:text-neutral-300 font-mono text-xs">
            {row.email || row.login_email}
          </span>
        ) : (
          <span className="text-slate-400 dark:text-neutral-500 text-xs">No email</span>
        ),
    },
    {
      key: 'ni_number',
      label: 'NI / Passport',
      render: (row) => (
        <div className="flex flex-col text-xs">
          {row.ni_number && (
            <span className="font-mono font-bold text-slate-800 dark:text-neutral-200">
              NI: {row.ni_number}
            </span>
          )}
          {row.passport_number && (
            <span className="font-mono text-slate-500 dark:text-neutral-400">
              Pass: {row.passport_number}
            </span>
          )}
          {!row.ni_number && !row.passport_number && (
            <span className="text-slate-400 dark:text-neutral-500">—</span>
          )}
        </div>
      ),
    },
    {
      key: 'document_path',
      label: 'Doc',
      render: (row) => {
        if (!row.document_path) return <span className="text-slate-400 text-xs">—</span>;
        return (
          <a
            href={resolveImageUrl(`/uploads/staff-docs/${row.document_path}`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline dark:text-blue-400"
            title={row.document_name || 'View Document'}
          >
            <span>View Doc</span>
          </a>
        );
      },
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
          size="3xl"
          title={formTarget === 'new' ? 'Add Staff Member' : 'Edit Staff Details'}
          description={
            formTarget === 'new'
              ? 'Enroll a new technician or workshop employee with role permissions and compliance docs.'
              : 'Update this staff member’s profile, compliance credentials, and salary details.'
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
