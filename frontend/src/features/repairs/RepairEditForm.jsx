import { useState } from 'react';
import apiClient from '../../services/api-client';

const inputClasses =
  'w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/30';
const labelClasses = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-neutral-200';
const readOnlyClasses =
  'rounded-md border border-dashed border-slate-200 px-3.5 py-2.5 text-sm text-slate-500 dark:border-surface-700 dark:text-neutral-400';

// Only notes are editable here — battery, staff, and part stay fixed
// (changing them would really be logging a different repair). Every repair
// is always exactly one unit of one part, so there's no quantity to adjust.
// `repair` may bundle several parts logged in the same submission
// (repair_ids has one entry per part) — notes get applied to all of them.
function RepairEditForm({ repair, onSaved, onCancel }) {
  const [notes, setNotes] = useState(repair.notes || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      for (const id of repair.repair_ids) {
        await apiClient.patch(`/repairs/${id}`, {
          notes: notes || undefined,
        });
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-4">
        <div>
          <label className={labelClasses}>Battery</label>
          <p className={readOnlyClasses}>{repair.battery_code}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClasses}>Staff</label>
            <p className={readOnlyClasses}>{repair.staff_name}</p>
          </div>
          <div>
            <label className={labelClasses}>{repair.repair_ids.length > 1 ? 'Parts' : 'Part'}</label>
            <p className={readOnlyClasses}>{repair.part_name}</p>
          </div>
        </div>

        <div>
          <label className={labelClasses}>Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputClasses}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg bg-brand-50 px-4 py-3 dark:bg-emerald-500/10">
          <span className="text-sm font-medium text-slate-700 dark:text-neutral-200">Price</span>
          <span className="text-base font-semibold text-brand-700 dark:text-emerald-400">
            £{Number(repair.price).toFixed(2)}
          </span>
        </div>
      </div>

      {error && <p className="text-sm text-critical-600 dark:text-red-400">{error}</p>}

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-surface-700">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-surface-800"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          {submitting ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

export default RepairEditForm;
