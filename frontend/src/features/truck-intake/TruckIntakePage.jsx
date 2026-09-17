import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import useInfiniteList from '../../utils/use-infinite-list';
import DataTable from '../../components/ui/table/DataTable';
import TableState from '../../components/ui/table/TableState';
import InfiniteScrollTrigger from '../../components/ui/table/InfiniteScrollTrigger';
import PageHeader from '../../components/ui/primitives/PageHeader';
import Button from '../../components/ui/primitives/Button';
import Modal from '../../components/ui/overlays/Modal';
import ConfirmModal from '../../components/ui/overlays/ConfirmModal';
import AlertModal from '../../components/ui/overlays/AlertModal';
import RowActions from '../../components/ui/table/RowActions';
import apiClient from '../../services/api-client';
import TruckIntakeForm from './TruckIntakeForm';
import TruckVerifyModal from './TruckVerifyModal';

const PAGE_SIZE = 15;

function TruckIntakePage() {
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');

  const { items, loading, hasMore, error, loadMore, refetch } = useInfiniteList(
    '/truck-intakes',
    PAGE_SIZE,
    {
      search: search.trim() || undefined,
      date: date || undefined,
    }
  );

  const user = useSelector((state) => state.auth.user);
  const isSuperAdmin = user?.role === 'super_admin';

  // null = closed, 'new' = create form, an intake object = edit form
  const [formTarget, setFormTarget] = useState(null);
  const [verifyTarget, setVerifyTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  function handleSaved() {
    refetch();
    setFormTarget(null);
  }

  async function handleConfirmDelete() {
    setDeleteError(null);
    try {
      await apiClient.delete(`/truck-intakes/${deleteTarget.id}`);
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
      label: 'Truck',
      render: (row) => (
        <Link
          to={`/truck-intakes/${row.id}`}
          className="font-medium text-blue-700 hover:underline dark:text-blue-400 font-mono"
        >
          {row.truck_number}
        </Link>
      ),
    },
    { key: 'driver_name', label: 'Driver' },
    { key: 'client_name', label: 'Client', render: (row) => row.client_name || '—' },
    { key: 'battery_count', label: 'Batteries' },
    {
      key: 'status',
      label: 'Arrival Status',
      render: (row) => {
        const isPending = row.status === 'pending_arrival';
        if (isPending) {
          return (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                Pending Arrival
              </span>
              <button
                type="button"
                onClick={() => setVerifyTarget(row)}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 active:scale-95 transition-all dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                Scan to Verify →
              </button>
            </div>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
            </svg>
            Arrived & Verified
          </span>
        );
      },
    },
    {
      key: 'intake_at',
      label: 'Date/Time',
      render: (row) => new Date(row.intake_at).toLocaleString(),
    },
    ...(isSuperAdmin
      ? [
          {
            key: 'actions',
            label: '',
            render: (row) => (
              <RowActions
                onEdit={() => setFormTarget(row)}
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
        title="Intake Battery"
        description="Batteries delivered by truck for repair."
        titleClassName="text-2xl font-bold tracking-tight text-green-600 dark:text-green-400"
      >
        <Button variant="darkViolet" onClick={() => setFormTarget('new')}>
          + Add Intake
        </Button>
      </PageHeader>

      {formTarget && (
        <Modal
          title={formTarget === 'new' ? 'Add Truck Intake' : 'Edit Truck Intake'}
          description={
            formTarget === 'new'
              ? 'Record a truck delivering batteries for repair.'
              : 'Update the truck/driver details for this intake.'
          }
          size="5xl"
          className="max-h-[92vh] flex flex-col"
          onClose={() => setFormTarget(null)}
        >
          <TruckIntakeForm
            intake={formTarget === 'new' ? null : formTarget}
            onSaved={handleSaved}
            onCancel={() => setFormTarget(null)}
          />
        </Modal>
      )}

      <div className="mb-4 sm:mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-blue-200 p-3 shadow-xs dark:border-blue-800/40">
        <div className="min-w-[16rem] flex-1 sm:flex-none">
          <label htmlFor="intake-search" className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider">
            Search driver / truck
          </label>
          <input
            id="intake-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="e.g. John or TRK-102"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-100 sm:w-64"
          />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="intake-date-filter" className="text-xs font-bold text-slate-600 dark:text-neutral-300 uppercase tracking-wider">
            Intake date
          </label>
          <input
            id="intake-date-filter"
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

      {deleteError && (
        <AlertModal title="Cannot Delete Intake" message={deleteError} onClose={() => setDeleteError(null)} />
      )}

      {error && <TableState tone="error">{error}</TableState>}

      {items.length === 0 && loading ? (
        <TableState>Loading…</TableState>
      ) : (
        !error && (
          <div className="overflow-hidden rounded-xl">
            <DataTable
              columns={columns}
              rows={items}
              showRowNumber
              headerColor="blue"
              maxHeight="calc(100vh - 320px)"
              onScrollBottom={hasMore && !loading ? loadMore : null}
              emptyMessage="No intakes match these filters."
            />
            <InfiniteScrollTrigger hasMore={hasMore} loading={loading} onVisible={loadMore} />
          </div>
        )
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Truck Intake"
          message={`Delete truck intake "${deleteTarget.truck_number}"?`}
          requireTyping={false}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {verifyTarget && (
        <TruckVerifyModal
          intakeId={verifyTarget.id}
          onClose={() => setVerifyTarget(null)}
          onSuccess={() => {
            setVerifyTarget(null);
            refetch();
          }}
        />
      )}

    </div>
  );
}

export default TruckIntakePage;
