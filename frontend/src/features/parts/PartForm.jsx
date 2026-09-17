import { useState } from 'react';
import apiClient from '../../services/api-client';
import useFetchList from '../../utils/use-fetch-list';

const inputClasses =
  'w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/30';
const labelClasses = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-neutral-200';

// part: pass an existing part record to edit it (PATCH); omit to create (POST).
function PartForm({ part, onSaved, onCancel }) {
  const isEdit = Boolean(part);
  const { data: existingParts } = useFetchList('/parts');
  const existingNames = [...new Set((existingParts || []).map((p) => p.name))];
  const [form, setForm] = useState({
    name: part?.name || '',
    sku: part?.sku || '',
    quantity: part ? String(part.quantity) : '0',
    repairCost: part ? String(part.repair_cost) : '0',
    serviceCharge: part ? String(part.service_charge || 0) : '0',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        sku: form.sku || undefined,
        quantity: Number(form.quantity) || 0,
        repairCost: Number(form.repairCost) || 0,
        serviceCharge: Number(form.serviceCharge) || 0,
      };
      if (isEdit) {
        await apiClient.patch(`/parts/${part.id}`, payload);
      } else {
        await apiClient.post('/parts', payload);
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
          <label className={labelClasses}>Part Name</label>
          <input
            type="text"
            list="existing-part-names"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="e.g. 12V Cell Module"
            className={inputClasses}
            required
          />
          <datalist id="existing-part-names">
            {existingNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>

        <div>
          <label className={labelClasses}>SKU (optional)</label>
          <input
            type="text"
            value={form.sku}
            onChange={(e) => updateField('sku', e.target.value)}
            placeholder="e.g. CELL-12V-01"
            className={inputClasses}
          />
        </div>

        <div>
          <label className={labelClasses}>{isEdit ? 'Quantity' : 'Starting Quantity'}</label>
          <input
            type="number"
            min="0"
            value={form.quantity}
            onChange={(e) => updateField('quantity', e.target.value)}
            className={inputClasses}
          />
        </div>

        <div>
          <label className={labelClasses}>Service Charge (optional / £)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.serviceCharge}
            onChange={(e) => updateField('serviceCharge', e.target.value)}
            placeholder="0.00"
            className={inputClasses}
          />
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
          {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Part'}
        </button>
      </div>
    </form>
  );
}

export default PartForm;
