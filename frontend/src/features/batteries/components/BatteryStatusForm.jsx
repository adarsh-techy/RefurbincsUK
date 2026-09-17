import { useState } from 'react';
import apiClient from '../../../services/api-client';

const STATUS_OPTIONS = [
  { value: 'in_repair', label: 'Awaiting Repair' },
  { value: 'in_progress', label: 'Repair In Progress' },
  { value: 'in_testing', label: 'In Testing' },
  { value: 'repaired', label: 'Repair Completed' },
  { value: 'returned', label: 'Returned to Client' },
  { value: 'unserviceable', label: 'Unserviceable' },
  { value: 'tested_parts_removed', label: 'Unserviceable (Test Failed)' },
  { value: 'recycled', label: 'Recycled' },
];

// Manual status correction for a battery — code and originating intake stay
// fixed, only the status can be changed here.
function BatteryStatusForm({ battery, onSaved, onCancel }) {
  const [status, setStatus] = useState(battery.status);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.patch(`/batteries/${battery.id}`, { status });
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
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-neutral-200">Battery ID</label>
          <p className="rounded-md border border-dashed border-slate-200 px-3.5 py-2.5 text-sm text-slate-500 dark:border-surface-700 dark:text-neutral-400">
            {battery.battery_code}
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-neutral-200">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/30"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
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

export default BatteryStatusForm;
