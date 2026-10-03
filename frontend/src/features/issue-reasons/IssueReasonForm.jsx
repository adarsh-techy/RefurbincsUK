import { useState } from 'react';
import apiClient from '../../services/api-client';

const inputClasses =
  'w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-blue-500 dark:focus:ring-blue-500/30';
const labelClasses = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-neutral-200';

// reason: pass an existing issue reason to edit it (PATCH); omit to create
// (POST). existingReasons: the full list from the page above, so a taken
// sort order can be flagged before submitting instead of only after a 409.
function IssueReasonForm({ reason, existingReasons = [], onSaved, onCancel }) {
  const isEdit = Boolean(reason);
  const nextOrder = existingReasons && existingReasons.length > 0
    ? Math.max(...existingReasons.map((r) => Number(r.sort_order) || 0)) + 1
    : 1;

  const [form, setForm] = useState({
    label: reason?.label || '',
    sortOrder: reason ? String(reason.sort_order) : String(nextOrder),
    active: reason ? reason.active : true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const sortOrderTaken = existingReasons.some(
    (r) => r.id !== reason?.id && Number(r.sort_order) === (Number(form.sortOrder) || 0)
  );

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (sortOrderTaken) {
      setError('That order number is already used by another reason — pick a different one.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        label: form.label.trim(),
        sortOrder: Number(form.sortOrder) || 0,
        active: form.active,
      };
      if (isEdit) {
        await apiClient.patch(`/issue-reasons/${reason.id}`, payload);
      } else {
        await apiClient.post('/issue-reasons', payload);
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
          <label className={labelClasses}>Reason *</label>
          <input
            type="text"
            value={form.label}
            onChange={(e) => updateField('label', e.target.value)}
            placeholder="Enter issue reason description"
            className={inputClasses}
            required
          />
        </div>

        <div>
          <label className={labelClasses}>Sort Order</label>
          <input
            type="number"
            value={form.sortOrder}
            onChange={(e) => updateField('sortOrder', e.target.value)}
            className={inputClasses}
          />
          {sortOrderTaken && (
            <p className="mt-1.5 text-xs text-critical-600 dark:text-red-400">
              Another reason already uses this order number.
            </p>
          )}
        </div>

        {isEdit && (
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-neutral-200">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => updateField('active', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 dark:border-surface-600"
            />
            Active (shown to technicians when reporting unserviceable batteries)
          </label>
        )}
      </div>

      {error && <p className="text-sm text-critical-600 dark:text-red-400">{error}</p>}

      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-surface-800 cursor-pointer"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting || sortOrderTaken}
          className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
        >
          {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Reason'}
        </button>
      </div>
    </form>
  );
}

export default IssueReasonForm;
