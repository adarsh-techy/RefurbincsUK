import { useEffect, useState } from 'react';
import apiClient from '../../services/api-client';
import useFetchList from '../../utils/use-fetch-list';
import QrScanner from '../../components/ui/primitives/QrScanner';
import extractBatteryCode from '../../utils/extract-battery-code';

const inputClasses =
  'w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/30';
const labelClasses = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-neutral-200';

// Same flow as Add Truck Intake: pick a client first, then scan/add that
// client's own batteries — here scoped to work-completed ('repaired')
// batteries only, since a return means handing finished work back.
function ReturnForm({ onCreated, onCancel }) {
  const { data: rawClients } = useFetchList('/clients');
  const clients = (rawClients || []).filter((c) => c.user_role !== 'recycle_client');

  const [form, setForm] = useState({ truckNumber: '', driverName: '', clientId: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [scanInput, setScanInput] = useState('');
  const [addedBatteries, setAddedBatteries] = useState([]);
  const [scanError, setScanError] = useState(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [clientBatteryCodes, setClientBatteryCodes] = useState([]);
  const [showScanSuggestions, setShowScanSuggestions] = useState(false);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);

  const selectedClient = (clients || []).find((c) => String(c.id) === form.clientId);

  // Once a client is picked, load that client's repaired-and-ready-to-return
  // batteries so the scan box can be restricted to just those codes.
  useEffect(() => {
    if (!form.clientId || !selectedClient) {
      setClientBatteryCodes([]);
      return;
    }
    let cancelled = false;
    apiClient
      .get('/batteries', { params: { clientName: selectedClient.name, status: 'repaired', limit: 100 } })
      .then(({ data }) => {
        if (!cancelled) setClientBatteryCodes((data.data || []).map((b) => b.battery_code));
      })
      .catch(() => {
        if (!cancelled) setClientBatteryCodes([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.clientId]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function selectClient(id) {
    updateField('clientId', id);
    setAddedBatteries([]);
    setShowClientSuggestions(false);
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
      if (battery.status !== 'repaired') {
        setScanError(`${battery.battery_code} isn't ready to return yet (still ${battery.status.replace('_', ' ')}).`);
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
  const availableClientBatteryCodes = clientBatteryCodes.filter((code) => !addedCodes.has(code));

  const scanInputIsAvailable = availableClientBatteryCodes.some(
    (code) => code.toLowerCase() === scanInput.trim().toLowerCase()
  );
  const scanSuggestions = availableClientBatteryCodes.filter((code) =>
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
    if (!form.clientId) {
      setError('Select a client.');
      return;
    }
    if (addedBatteries.length === 0) {
      setError('Scan at least one repaired battery to return.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post('/returns', {
        truckNumber: form.truckNumber,
        driverName: form.driverName,
        clientId: form.clientId,
        batteryIds: addedBatteries.map((b) => b.id),
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
        {/* Top Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClasses}>Truck Number</label>
            <input
              type="text"
              value={form.truckNumber}
              onChange={(e) => updateField('truckNumber', e.target.value)}
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

          <div className="relative">
            <label className={labelClasses}>Client</label>
            <input
              type="text"
              value={selectedClient ? selectedClient.name : ''}
              onFocus={() => setShowClientSuggestions(true)}
              onBlur={() => setTimeout(() => setShowClientSuggestions(false), 150)}
              placeholder="Click to choose a client"
              readOnly
              className={`${inputClasses} cursor-pointer`}
              required
            />

            {showClientSuggestions && (clients || []).length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-blue-200 bg-white py-1 shadow-lg dark:border-blue-800/40 dark:bg-black">
                {(clients || []).map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectClient(String(c.id))}
                      className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-blue-50 dark:text-neutral-100 dark:hover:bg-blue-900/30"
                    >
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Scan & Select Batteries Card */}
        <div className="rounded-xl border border-blue-300 bg-slate-50 p-4 dark:border-blue-800/40 dark:bg-surface-950">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-neutral-100">Scan Batteries (returning)</h3>
            <span className="rounded-full bg-blue-100 px-3 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
              {addedBatteries.length} added
            </span>
          </div>
          <p className="mb-3 text-xs text-slate-500 dark:text-neutral-400">
            {form.clientId
              ? 'Only this client\'s work-completed batteries can be added — scan, type, or pick from the list below.'
              : 'Select a client above first, then scan or search that client’s work-completed batteries here.'}
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
                disabled={scanLoading || !form.clientId}
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
                  Not a work-completed battery for this client.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={submitScanInput}
              disabled={scanLoading || !form.clientId || !scanInputIsAvailable}
              className="shrink-0 rounded-md bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setCameraOpen((prev) => !prev)}
              disabled={!form.clientId}
              className="shrink-0 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700"
            >
              {cameraOpen ? 'Close Camera' : '📷 Use Camera'}
            </button>
          </div>

          {scanError && <p className="mt-2 text-xs text-critical-600 dark:text-red-400">{scanError}</p>}

          {cameraOpen && form.clientId && (
            <div className="mt-3">
              <QrScanner onScan={(value) => handleScanValue(value)} onClose={() => setCameraOpen(false)} />
            </div>
          )}

          {addedBatteries.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-neutral-300">
                Batteries in this return shipment:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto pr-1">
                {addedBatteries.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-xs dark:border-surface-700 dark:bg-surface-900"
                  >
                    <span className="text-xs font-mono font-bold text-slate-800 dark:text-neutral-100 truncate">
                      {b.battery_code}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAdded(b.id)}
                      className="rounded-md p-1 text-slate-400 hover:bg-critical-50 hover:text-critical-600 dark:text-neutral-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
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
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3 dark:border-surface-700 dark:bg-surface-950/50">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-neutral-200">Total Returning Batteries</label>
            <p className="text-[11px] text-slate-500 dark:text-neutral-400">
              Scanned work-completed batteries ready to return.
            </p>
          </div>
          <span className="rounded-lg bg-pink-100 px-3 py-1 text-sm font-bold text-pink-700 dark:bg-pink-900/40 dark:text-pink-300">
            {addedBatteries.length}
          </span>
        </div>
      </div>

      {error && <p className="text-sm text-critical-600 dark:text-red-400">{error}</p>}

      <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4 dark:border-surface-700">
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
          className="rounded-md bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          {submitting ? 'Recording…' : `Record Return (${addedBatteries.length} batteries)`}
        </button>
      </div>
    </form>
  );
}

export default ReturnForm;
