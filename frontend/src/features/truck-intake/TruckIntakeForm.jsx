import { useEffect, useState } from 'react';
import apiClient from '../../services/api-client';
import useFetchList from '../../utils/use-fetch-list';
import AlertModal from '../../components/ui/AlertModal';
import QrScanner from '../../components/ui/QrScanner';
import extractBatteryCode from '../../utils/extract-battery-code';

const inputClasses =
  'w-full rounded-md border border-blue-300 bg-blue-50 px-3.5 py-2.5 text-sm text-green-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-blue-800/40 dark:bg-blue-900/20 dark:text-green-400 dark:placeholder:text-neutral-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/30';
const labelClasses = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-neutral-200';

// intake: pass an existing truck intake to edit it (PATCH, truck/driver/
// client only — battery_count is fixed since it's tied to already-generated
// battery rows); omit to create a new one (POST). Scanning existing
// batteries back in is create-only.
function TruckIntakeForm({ intake, onSaved, onCancel }) {
  const isEdit = Boolean(intake);
  const { data: clients } = useFetchList('/clients');
  const { data: pastIntakes } = useFetchList('/truck-intakes');
  const existingTruckNumbers = [...new Set((pastIntakes || []).map((i) => i.truck_number))];

  const [form, setForm] = useState({
    truckNumber: intake?.truck_number || '',
    driverName: intake?.driver_name || '',
    batteryCount: intake ? String(intake.battery_count) : '',
    clientId: intake?.client_id ? String(intake.client_id) : '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [scanInput, setScanInput] = useState('');
  const [scannedBatteries, setScannedBatteries] = useState([]);
  const [scanError, setScanError] = useState(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [clientBatteryCodes, setClientBatteryCodes] = useState([]);
  const [showScanSuggestions, setShowScanSuggestions] = useState(false);
  const [repeatIntakeAlert, setRepeatIntakeAlert] = useState(null);
  const [unserviceableAlert, setUnserviceableAlert] = useState(null);

  // Once a client is picked, suggest that client's own batteries in the scan
  // box's datalist so the front desk can pick from a short list instead of
  // typing/scanning blind.
  useEffect(() => {
    if (isEdit || !form.clientId) {
      setClientBatteryCodes([]);
      return;
    }
    const client = clients.find((c) => String(c.id) === form.clientId);
    if (!client) {
      setClientBatteryCodes([]);
      return;
    }
    let cancelled = false;
    apiClient
      .get('/batteries', { params: { search: client.name, limit: 50 } })
      .then(({ data }) => {
        if (!cancelled) setClientBatteryCodes(data.data || []);
      })
      .catch(() => {
        if (!cancelled) setClientBatteryCodes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [form.clientId, clients, isEdit]);

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
      if (scannedBatteries.some((b) => b.id === battery.id)) {
        setScanError(`${battery.battery_code} has already been scanned in.`);
        return;
      }
      if (battery.status === 'unserviceable') {
        setUnserviceableAlert(battery.battery_code);
        return;
      }
      if (['in_repair', 'in_progress', 'in_testing', 'repaired'].includes(battery.status)) {
        setScanError(`${battery.battery_code} hasn't been returned to the client yet.`);
        return;
      }
      setScannedBatteries((prev) => [...prev, battery]);

      // Flag it if this new intake would be its 2nd+ trip this calendar
      // month — same "keeps coming back" signal as the navbar's repeat
      // alert, but surfaced right when it's being added instead of only
      // passively in a badge count.
      const now = new Date();
      const visitsThisMonth = (data.visits || []).filter((v) => {
        const d = new Date(v.intake_at);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      });
      if (visitsThisMonth.length > 0) {
        setRepeatIntakeAlert({
          batteryCode: battery.battery_code,
          count: visitsThisMonth.length + 1,
          dates: visitsThisMonth.map((v) => new Date(v.intake_at)),
        });
      }
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

  // Only a battery that's actually back with the client (status 'returned')
  // can be "returning" on a new truck — one that's still Pending/In
  // Progress/In Testing/Completed hasn't gone anywhere yet, and one marked
  // Unserviceable never will (it's a dead end, blocked with its own popup in
  // handleScanValue rather than silently offered here) — so both kinds are
  // excluded from the suggestion pool entirely. Once a battery's been added
  // it also drops out of the pool — one battery, one add, so it can't be
  // picked (or typed) again.
  const scannedCodes = new Set(scannedBatteries.map((b) => b.battery_code));
  const NOT_RETURNABLE_STATUSES = new Set([
    'in_repair',
    'in_progress',
    'in_testing',
    'repaired',
    'unserviceable',
  ]);
  const availableClientBatteries = clientBatteryCodes.filter(
    (b) => !scannedCodes.has(b.battery_code) && !NOT_RETURNABLE_STATUSES.has(b.status)
  );

  // Only an exact match against this client's own registered, not-yet-added
  // battery codes can be submitted — typing a number that isn't one of
  // their registered QR codes just won't go anywhere, instead of
  // round-tripping to the API to find out.
  const scanInputIsRegistered = availableClientBatteries.some(
    (b) => b.battery_code.toLowerCase() === scanInput.trim().toLowerCase()
  );
  const scanSuggestions = availableClientBatteries.filter((b) =>
    b.battery_code.toLowerCase().includes(scanInput.trim().toLowerCase())
  );

  function selectScanCode(code) {
    setScanInput(code);
    setShowScanSuggestions(false);
  }

  function submitScanInput() {
    if (!scanInput.trim() || !scanInputIsRegistered) return;
    handleScanValue(scanInput);
    setScanInput('');
  }

  function handleScanKeyDown(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    submitScanInput();
  }

  function removeScanned(id) {
    setScannedBatteries((prev) => prev.filter((b) => b.id !== id));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.clientId) {
      setError('Select a client.');
      return;
    }
    if (!isEdit && scannedBatteries.length === 0) {
      setError('Scan at least one battery.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (isEdit) {
        await apiClient.patch(`/truck-intakes/${intake.id}`, {
          truckNumber: form.truckNumber,
          driverName: form.driverName,
          clientId: form.clientId,
        });
      } else {
        await apiClient.post('/truck-intakes', {
          truckNumber: form.truckNumber,
          driverName: form.driverName,
          batteryCount: 0,
          clientId: form.clientId,
          scannedBatteryIds: scannedBatteries.map((b) => b.id),
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
    <>
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-4">
        <div>
          <label className={labelClasses}>Truck Number</label>
          <input
            type="text"
            list="existing-truck-numbers"
            value={form.truckNumber}
            onChange={(e) => updateField('truckNumber', e.target.value)}
            placeholder="e.g. GB21 XYZ"
            autoComplete="off"
            className={inputClasses}
            required
          />
          <datalist id="existing-truck-numbers">
            {existingTruckNumbers.map((num) => (
              <option key={num} value={num} />
            ))}
          </datalist>
        </div>

        <div>
          <label className={labelClasses}>Driver Name</label>
          <input
            type="text"
            value={form.driverName}
            onChange={(e) => {
              const value = e.target.value;
              updateField('driverName', value.charAt(0).toUpperCase() + value.slice(1));
            }}
            placeholder="e.g. George Davies"
            className={inputClasses}
            required
          />
        </div>

        <div>
          <label className={labelClasses}>Client</label>
          <select
            value={form.clientId}
            onChange={(e) => updateField('clientId', e.target.value)}
            className="w-full rounded-md border border-blue-300 bg-blue-50 px-3.5 py-2.5 text-sm text-green-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-blue-800/40 dark:bg-black dark:text-green-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/30"
            required
          >
            <option value="">Select a client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {!isEdit && (
          <div className="rounded-xl border border-blue-300 bg-slate-50 p-4 dark:border-blue-800/40 dark:bg-surface-950">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-neutral-100">Scan Batteries (returning)</h3>
              <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-slate-500 dark:bg-surface-800 dark:text-neutral-400">
                {scannedBatteries.length} scanned
              </span>
            </div>
            <p className="mb-3 text-xs text-slate-500 dark:text-neutral-400">
              {form.clientId
                ? "For batteries that already have a QR code from a past visit. A handheld scanner types straight into the box below — or use the camera to test on your phone."
                : 'Select a client above first, then scan or search that client’s batteries here.'}
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
                    {scanSuggestions.map((b) => (
                      <li key={b.battery_code}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectScanCode(b.battery_code)}
                          className="flex w-full items-center px-3 py-2 text-left text-sm text-slate-700 hover:bg-blue-50 dark:text-neutral-100 dark:hover:bg-blue-900/30"
                        >
                          <span>{b.battery_code}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {scanInput.trim() && !scanInputIsRegistered && (
                  <p className="mt-1.5 text-xs text-critical-600 dark:text-red-400">
                    Not a registered QR code for this client.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={submitScanInput}
                disabled={scanLoading || !form.clientId || !scanInputIsRegistered}
                className="shrink-0 rounded-md bg-brand-600 px-3.5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setCameraOpen((prev) => !prev)}
                disabled={!form.clientId}
                className="shrink-0 rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700"
              >
                {cameraOpen ? 'Close Camera' : 'Use Camera'}
              </button>
            </div>

            {scanError && <p className="mt-2 text-xs text-critical-600 dark:text-red-400">{scanError}</p>}

            {cameraOpen && form.clientId && (
              <div className="mt-3">
                <QrScanner
                  onScan={(value) => handleScanValue(value)}
                  onClose={() => setCameraOpen(false)}
                />
              </div>
            )}

            {scannedBatteries.length > 0 && (
              <ul className="mt-3 flex flex-col gap-2">
                {scannedBatteries.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-2.5 dark:border-surface-700 dark:bg-surface-900"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800 dark:text-neutral-100">{b.battery_code}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeScanned(b.id)}
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
        )}

        {isEdit && (
          <div>
            <label className={labelClasses}>Battery Count</label>
            <p className="rounded-md border border-dashed border-slate-200 px-3.5 py-2.5 text-sm text-slate-500 dark:border-surface-700 dark:text-neutral-400">
              {form.batteryCount} (fixed — set by the batteries already generated)
            </p>
          </div>
        )}

        <div className="mt-4">
          <label className={labelClasses}>Total Batteries</label>
          <p className="rounded-md border border-dashed border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-pink-700 dark:border-surface-700 dark:text-pink-400">
            {isEdit ? Number(form.batteryCount) || 0 : scannedBatteries.length}
          </p>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-neutral-400">
            {isEdit ? 'Fixed — set by the batteries already generated.' : 'Scanned returning batteries, added automatically.'}
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
          {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Intake'}
        </button>
      </div>
    </form>

    {repeatIntakeAlert && (
      <AlertModal
        title="Repeat Intake This Month"
        message={`${repeatIntakeAlert.batteryCode} has now come in ${repeatIntakeAlert.count} times this month (previously: ${repeatIntakeAlert.dates
          .map((d) => d.toLocaleDateString())
          .join(', ')}). It's been added — worth a quick look at what keeps bringing it back.`}
        onClose={() => setRepeatIntakeAlert(null)}
      />
    )}

    {unserviceableAlert && (
      <AlertModal
        title="Battery Marked Unserviceable"
        message={`${unserviceableAlert} was declared unserviceable and can't be brought back in on a new intake.`}
        onClose={() => setUnserviceableAlert(null)}
      />
    )}
    </>
  );
}

export default TruckIntakeForm;
