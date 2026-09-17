import { useState } from 'react';
import apiClient from '../../services/api-client';

const inputClasses =
  'w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-blue-500 dark:focus:ring-blue-500/30';
const labelClasses = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-neutral-200';

function ServiceForm({ service, defaultIsMandatory = false, onSaved, onCancel }) {
  const isEdit = Boolean(service);
  const [form, setForm] = useState({
    name: service?.name || '',
    description: service?.description || '',
    rate: service ? String(service.rate) : '',
    active: service ? service.active : true,
    isMandatory: service ? Boolean(service.is_mandatory) : Boolean(defaultIsMandatory),
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const rateNum = parseFloat(form.rate);
    if (isNaN(rateNum) || rateNum < 0) {
      setError('Please enter a valid rate amount.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        rate: rateNum,
        sortOrder: 0,
        active: form.active,
        is_mandatory: form.isMandatory,
      };
      if (isEdit) {
        await apiClient.patch(`/services/${service.id}`, payload);
      } else {
        await apiClient.post('/services', payload);
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
          <label className={labelClasses}>
            {form.isMandatory ? 'Mandatory Fee Name *' : 'Service Name *'}
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder={form.isMandatory ? 'e.g. Mandatory Intake & Diagnostic Fee' : 'e.g. Cell Balancing & Calibration'}
            className={inputClasses}
            required
          />
        </div>

        <div>
          <label className={labelClasses}>
            {form.isMandatory ? 'Mandatory Fee Rate (£) *' : 'Service Rate (£) *'}
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 font-medium">£</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.rate}
              onChange={(e) => updateField('rate', e.target.value)}
              placeholder="0.00"
              className={`${inputClasses} pl-7`}
              required
            />
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
            {form.isMandatory
              ? 'This fixed fee will be automatically attached to every battery received on truck intake.'
              : 'Standard rate charged when this service is applied to a battery during testing or maintenance.'}
          </p>
        </div>

        <div>
          <label className={labelClasses}>Description (Optional)</label>
          <textarea
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder={form.isMandatory ? 'Describe the purpose of this mandatory intake fee...' : 'Describe what this service entails...'}
            rows={3}
            className={inputClasses}
          />
        </div>

        {isEdit && (
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-neutral-200">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => updateField('active', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 dark:border-surface-600"
            />
            Active {form.isMandatory ? '(auto-applied on new battery intakes)' : '(available for technicians during testing)'}
          </label>
        )}
      </div>

      {error && <p className="text-sm text-critical-600 dark:text-red-400">{error}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-surface-800 cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className={`rounded-md px-5 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-50 cursor-pointer ${
            form.isMandatory ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {submitting ? 'Saving…' : isEdit ? 'Save Changes' : form.isMandatory ? 'Create Mandatory Fee' : 'Create Service'}
        </button>
      </div>
    </form>
  );
}

export default ServiceForm;
