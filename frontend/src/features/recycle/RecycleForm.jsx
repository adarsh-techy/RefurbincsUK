import { useEffect, useState } from 'react';
import apiClient from '../../services/api-client';
import useFetchList from '../../utils/use-fetch-list';
import QrScanner from '../../components/ui/primitives/QrScanner';
import extractBatteryCode from '../../utils/extract-battery-code';

const inputClasses =
  'w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/30';
const labelClasses = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-neutral-200';

// Same scan-to-add flow as Record Return, scoped to 'unserviceable' batteries
// instead of a single client's 'repaired' ones — a recycle shipment can carry
// batteries from any client, since they're all terminal/dead either way.
function RecycleForm({ onCreated, onCancel }) {
  const [form, setForm] = useState({ vehicleNumber: '', driverName: '' });
  const [recycleClientId, setRecycleClientId] = useState('');
  const { data: clients } = useFetchList('/clients');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [scanInput, setScanInput] = useState('');
  const [addedBatteries, setAddedBatteries] = useState([]);
  const [scanError, setScanError] = useState(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [unserviceableCodes, setUnserviceableCodes] = useState([]);
  const [showScanSuggestions, setShowScanSuggestions] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get('/batteries', { params: { status: 'unserviceable', limit: 100 } })
      .then(({ data }) => {
        if (!cancelled) setUnserviceableCodes((data.data || []).map((b) => b.battery_code));
      })
      .catch(() => {
        if (!cancelled) setUnserviceableCodes([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleScanValue(rawValue) {
    const code = extractBatteryCode(rawValue);
    if (!code) return;

    setScanError(null);
    setScanLoading(true);
    try {
      const { data } = await apiClient.get(`/batteries/${encodeURIComponent(code)}`);
      const battery = data.battery;
      if (addedBatteries.some((b) => b.id === battery.id)) {
        setScanError(`${battery.battery_code} has already been added.`);
        return;
      }
      if (battery.status !== 'unserviceable') {
        setScanError(`${battery.battery_code} isn't marked unserviceable (currently ${battery.status.replace('_', ' ')}).`);
        return;
      }
      if (data.pendingPartsRemoval?.length > 0) {
        setScanError(
          `${battery.battery_code} still has ${data.pendingPartsRemoval.length} part(s) fitted that need to be removed and restocked first.`
        );
        return;
      }
      setAddedBatteries((prev) => [...prev, battery]);
    } catch (err) {
      setScanError(
        err.response?.status === 404
          ? `No battery found for code "${code}".`
          : err.response?.data?.message || err.message
      );
    } finally {
      setScanLoading(false);
    }
  }

  function removeAdded(id) {
    setAddedBatteries((prev) => prev.filter((b) => b.id !== id));
  }

  // Once added, a battery drops out of the pool — one battery, one add.
  const addedCodes = new Set(addedBatteries.map((b) => b.battery_code));
  const availableCodes = unserviceableCodes.filter((code) => !addedCodes.has(code));

  const scanInputIsAvailable = availableCodes.some(
    (code) => code.toLowerCase() === scanInput.trim().toLowerCase()
  );
  const scanSuggestions = availableCodes.filter((code) =>
    code.toLowerCase().includes(scanInput.trim().toLowerCase())
  );

  function selectScanCode(code) {
    setScanInput(code);
    setShowScanSuggestions(false);
  }

  function submitScanInput() {
    if (!scanInput.trim() || !scanInputIsAvailable) return;
    handleScanValue(scanInput);
    setScanInput('');
  }

  function handleScanKeyDown(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    submitScanInput();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (addedBatteries.length === 0) {
      setError('Scan at least one unserviceable battery to recycle.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post('/recycle', {
        vehicleNumber: form.vehicleNumber,
        driverName: form.driverName,
        batteryIds: addedBatteries.map((b) => b.id),
        recycleClientId: recycleClientId || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClasses}>Vehicle Number</label>
            <input
              type="text"
              value={form.vehicleNumber}
              onChange={(e) => updateField('vehicleNumber', e.target.value)}
              placeholder="e.g. GB21 XYZ"
              className={inputClasses}
              required
            />
          </div>

          <div>
            <label className={labelClasses}>Driver Name</label>
            <input
              type="text"
              value={form.driverName}
              onChange={(e) => updateField('driverName', e.target.value)}
              placeholder="e.g. George Davies"
              className={inputClasses}
              required
            />
          </div>
        </div>

        <div>
          <label className={labelClasses}>Assign Recycle Client (Optional)</label>
          <select
            value={recycleClientId}
            onChange={(e) => setRecycleClientId(e.target.value)}
            className={inputClasses}
          >
            <option value="">None (General Recycling)</option>
            {(clients || [])
              .filter((c) => c.user_role === 'recycle_client')
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
            If assigned, this shipment will be visible on that partner's recycle portal.
          </p>
        </div>

        <div className="rounded-xl border border-blue-300 bg-slate-50 p-4 dark:border-blue-800/40 dark:bg-surface-950">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-neutral-100">Scan Batteries (recycling)</h3>
            <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-slate-500 dark:bg-surface-800 dark:text-neutral-400">
              {addedBatteries.length} added
            </span>
          </div>
          <p className="mb-3 text-xs text-slate-500 dark:text-neutral-400">
            Only batteries marked unserviceable can be added — scan, type, or pick from the list below.
          </p>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={handleScanKeyDown}
                onFocus={() => setShowScanSuggestions(true)}
                onBlur={() => setTimeout(() => setShowScanSuggestions(false), 150)}
                placeholder="Scan or type a battery code, then press Enter"
                autoComplete="off"
                disabled={scanLoading}
                className={`${inputClasses} disabled:cursor-not-allowed disabled:opacity-50`}
              />

              {showScanSuggestions && scanSuggestions.length > 0 && (
                <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-blue-200 bg-white py-1 shadow-lg dark:border-blue-800/40 dark:bg-black">
                  {scanSuggestions.map((code) => (
                    <li key={code}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectScanCode(code)}
                        className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-blue-50 dark:text-neutral-100 dark:hover:bg-blue-900/30"
                      >
                        {code}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {scanInput.trim() && !scanInputIsAvailable && (
                <p className="mt-1.5 text-xs text-critical-600 dark:text-red-400">
                  Not an unserviceable battery.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={submitScanInput}
              disabled={scanLoading || !scanInputIsAvailable}
              className="shrink-0 rounded-md bg-brand-600 px-3.5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setCameraOpen((prev) => !prev)}
              className="shrink-0 rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700"
            >
              {cameraOpen ? 'Close Camera' : 'Use Camera'}
            </button>
          </div>

          {scanError && <p className="mt-2 text-xs text-critical-600 dark:text-red-400">{scanError}</p>}

          {cameraOpen && (
            <div className="mt-3">
              <QrScanner onScan={(value) => handleScanValue(value)} onClose={() => setCameraOpen(false)} />
            </div>
          )}

          {addedBatteries.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {addedBatteries.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-2.5 dark:border-surface-700 dark:bg-surface-900"
                >
                  <span className="text-sm font-medium text-slate-800 dark:text-neutral-100">{b.battery_code}</span>
                  <button
                    type="button"
                    onClick={() => removeAdded(b.id)}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-critical-50 hover:text-critical-600 dark:text-neutral-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                    aria-label={`Remove ${b.battery_code}`}
                    title="Remove"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.36-9.36a.75.75 0 0 0-1.06-1.06L10 9.94 7.7 7.64a.75.75 0 0 0-1.06 1.06L8.94 11l-2.3 2.3a.75.75 0 1 0 1.06 1.06L10 12.06l2.3 2.3a.75.75 0 0 0 1.06-1.06L11.06 11l2.3-2.3Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label className={labelClasses}>Total Batteries</label>
          <p className="rounded-md border border-dashed border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-pink-700 dark:border-surface-700 dark:text-pink-400">
            {addedBatteries.length}
          </p>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-neutral-400">
            Scanned unserviceable batteries, added automatically.
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
          {submitting ? 'Recording…' : `Record Recycle (${addedBatteries.length})`}
        </button>
      </div>
    </form>
  );
}

export default RecycleForm;
