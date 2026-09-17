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
import RowActions from '../../components/ui/table/RowActions';
import apiClient from '../../services/api-client';
import ReturnForm from './ReturnForm';
import ReturnEditForm from './ReturnEditForm';

// Converts to a YYYY-MM-DD string in the browser's local timezone, so a date
// picked in the filter matches returns recorded that same calendar day —
// toISOString() alone would shift the date near midnight in non-UTC zones.
function toLocalDateValue(value) {
  const dt = new Date(value);
  const offset = dt.getTimezoneOffset();
  return new Date(dt.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function ReturnsPage() {
  const { data, loading, error, refetch } = useFetchList('/returns');
  const user = useSelector((state) => state.auth.user);
  const isSuperAdmin = user?.role === 'super_admin';

  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');

  const filtered = (data || []).filter((row) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      row.driver_name?.toLowerCase().includes(q) ||
      row.truck_number?.toLowerCase().includes(q);
    const matchesDate = !date || toLocalDateValue(row.returned_at) === date;
    return matchesSearch && matchesDate;
  });

  function handleCreated() {
    refetch();
    setShowForm(false);
  }

  function handleSaved() {
    refetch();
    setEditTarget(null);
  }

  async function handleConfirmDelete() {
    setDeleteError(null);
    try {
      await apiClient.delete(`/returns/${deleteTarget.id}`);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      setDeleteError(err.response?.data?.message || err.message);
      setDeleteTarget(null);
    }
  }

  const columns = [
    {
      key: 'truck_number',
      label: 'Truck #',
      render: (row) => (
        <Link to={`/returns/${row.id}`} className="font-medium text-blue-700 hover:underline dark:text-blue-400">
          {row.truck_number}
        </Link>
      ),
    },
    { key: 'driver_name', label: 'Driver' },
    { key: 'client_name', label: 'Client', render: (row) => row.client_name || '—' },
    { key: 'battery_count', label: 'Batteries' },
    {
      key: 'returned_at',
      label: 'Date/Time',
      render: (row) => new Date(row.returned_at).toLocaleString(),
    },
    ...(isSuperAdmin
      ? [
          {
            key: 'actions',
            label: '',
            render: (row) => (
              <RowActions
                onEdit={() => setEditTarget(row)}
                onDelete={() => setDeleteTarget(row)}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Return Battery"
        description="Repaired batteries dispatched back to the customer."
        titleClassName="text-2xl font-bold tracking-tight text-green-600 dark:text-green-400"
      >
        <Button variant="darkViolet" onClick={() => setShowForm(true)}>+ Record Return</Button>
      </PageHeader>

      {showForm && (
        <Modal
          title="Record a Return"
          description="Dispatch repaired batteries back to the customer."
          size="5xl"
          className="max-h-[92vh] flex flex-col"
          onClose={() => setShowForm(false)}
        >
          <ReturnForm onCreated={handleCreated} onCancel={() => setShowForm(false)} />
        </Modal>
      )}

      {editTarget && (
        <Modal
          title="Edit Return"
          description="Update the truck/driver details for this return."
          size="2xl"
          onClose={() => setEditTarget(null)}
        >
          <ReturnEditForm
            returnRecord={editTarget}
            onSaved={handleSaved}
            onCancel={() => setEditTarget(null)}
          />
        </Modal>
      )}

      <div className="mb-4 sm:mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-blue-200 p-3 shadow-xs dark:border-blue-800/40">
        <div className="min-w-[16rem] flex-1 sm:flex-none">
          <label htmlFor="return-search" className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider">
            Search driver / truck
          </label>
          <input
            id="return-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="e.g. John or TRK-102"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-100 sm:w-64"
          />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="return-date-filter" className="text-xs font-bold text-slate-600 dark:text-neutral-300 uppercase tracking-wider">
            Return date
          </label>
          <input
            id="return-date-filter"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-200"
          />
        </div>

        {(search || date) && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setDate('');
            }}
            className="text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 cursor-pointer transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {deleteError && <p className="mb-4 text-sm text-critical-600 dark:text-red-400">{deleteError}</p>}

      {loading && <TableState>Loading…</TableState>}
      {error && <TableState tone="error">{error}</TableState>}
      {!loading && !error && (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-surface-700">
          <DataTable
            columns={columns}
            rows={filtered}
            emptyMessage="No returns match these filters."
            headerColor="blue"
            showRowNumber
            maxHeight="calc(100vh - 320px)"
          />
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Return"
          message={`Delete return "${deleteTarget.truck_number}"? Its batteries will go back to "Repaired" status.`}
          requireTyping={false}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

export default ReturnsPage;
