import { useState } from 'react';
import { FiCalendar, FiUploadCloud, FiFileText, FiTrash2 } from 'react-icons/fi';
import apiClient from '../../services/api-client';
import useFetchList from '../../utils/use-fetch-list';

const inputClasses =
  'w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/30';
const labelClasses = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-neutral-200';

function toLocalIso(dateStr) {
  if (!dateStr) return '';
  const dt = new Date(dateStr);
  const offset = dt.getTimezoneOffset();
  return new Date(dt.getTime() - offset * 60000).toISOString().slice(0, 16);
}

// truck_number/driver_name/client/returned_at/docFile are editable — which batteries were
// returned is fixed here (use delete + re-record if that needs to change).
function ReturnEditForm({ returnRecord, onSaved, onCancel }) {
  const { data: rawClients } = useFetchList('/clients');
  const clients = (rawClients || []).filter((c) => c.user_role !== 'recycle_client');
  const [truckNumber, setTruckNumber] = useState(returnRecord.truck_number);
  const [driverName, setDriverName] = useState(returnRecord.driver_name);
  const [clientId, setClientId] = useState(returnRecord.client_id ? String(returnRecord.client_id) : '');
  const [returnedAt, setReturnedAt] = useState(toLocalIso(returnRecord.returned_at));
  const [docFile, setDocFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!clientId) {
      setError('Select a client.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('truckNumber', truckNumber);
      formData.append('driverName', driverName);
      formData.append('clientId', clientId);
      if (returnedAt) {
        formData.append('returnedAt', new Date(returnedAt).toISOString());
      }
      if (docFile) {
        formData.append('docFile', docFile);
      }
      await apiClient.patch(`/returns/${returnRecord.id}`, formData);
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
          <label className={labelClasses}>Truck Number</label>
          <input
            type="text"
            value={truckNumber}
            onChange={(e) => setTruckNumber(e.target.value.toUpperCase())}
            className={`${inputClasses} font-mono uppercase`}
            required
          />
        </div>

        <div>
          <label className={labelClasses}>Driver Name</label>
          <input
            type="text"
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
            className={inputClasses}
            required
          />
        </div>

        <div>
          <label className={labelClasses}>Client</label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className={inputClasses}
            required
          >
            <option value="">Select a client</option>
            {(clients || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClasses}>Return Date & Time</label>
          <input
            type="datetime-local"
            value={returnedAt}
            onChange={(e) => setReturnedAt(e.target.value)}
            className={inputClasses}
            required
          />
        </div>

        <div>
          <label className={labelClasses}>Dispatch Document / Receipt File</label>
          {!docFile ? (
            <label className="group flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3.5 py-2.5 text-center transition-all hover:border-emerald-500 hover:bg-emerald-50/20 dark:border-white/15 dark:bg-surface-800 dark:hover:border-emerald-400 cursor-pointer shadow-2xs">
              <FiUploadCloud className="h-4 w-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
              <span className="text-xs font-semibold text-slate-700 dark:text-neutral-300">
                {returnRecord.document_name ? 'Replace Document File' : 'Upload Delivery Note / Photo'}
              </span>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          ) : (
            <div className="flex items-center justify-between rounded-xl bg-emerald-50/80 px-3.5 py-2 text-xs font-semibold text-emerald-900 border border-emerald-200/80 dark:bg-emerald-950/40 dark:border-emerald-800/40 dark:text-emerald-300 shadow-2xs">
              <span className="flex items-center gap-2 truncate">
                <FiFileText className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="truncate">{docFile.name}</span>
                <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80">
                  ({(docFile.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </span>
              <button
                type="button"
                onClick={() => setDocFile(null)}
                className="flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700 dark:text-red-400 cursor-pointer ml-2 shrink-0"
              >
                <FiTrash2 className="h-3.5 w-3.5" />
                <span>Remove</span>
              </button>
            </div>
          )}
          {returnRecord.document_url && !docFile && (
            <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
              Current file: <strong>{returnRecord.document_name || 'Attached document'}</strong>
            </p>
          )}
        </div>

        <div>
          <label className={labelClasses}>Batteries</label>
          <p className="rounded-md border border-dashed border-slate-200 px-3.5 py-2.5 text-sm text-slate-500 dark:border-surface-700 dark:text-neutral-400">
            {returnRecord.battery_count} (fixed — delete and re-record to change)
          </p>
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

export default ReturnEditForm;
