import { useEffect, useMemo, useRef, useState } from 'react';
import apiClient from '../../services/api-client';
import Modal from '../../components/ui/Modal';
import QrScanner from '../../components/ui/QrScanner';
import TableState from '../../components/ui/TableState';
import extractBatteryCode from '../../utils/extract-battery-code';

function TruckVerifyModal({ intakeId, initialData = null, onClose, onSuccess }) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState(null);

  const [scannedCodes, setScannedCodes] = useState([]);
  const [scannedAt, setScannedAt] = useState({}); // { [code]: Date }
  const [scanInput, setScanInput] = useState('');
  const [scanFeedback, setScanFeedback] = useState(null); // { tone: 'good'|'warn'|'bad', message }
  const [cameraOpen, setCameraOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const feedbackTimeoutRef = useRef(null);
  const suggestionsBlurTimeoutRef = useRef(null);
  const scanInputRef = useRef(null);

  useEffect(() => {
    if (!initialData && intakeId) {
      setLoading(true);
      setError(null);
      apiClient
        .get(`/truck-intakes/${intakeId}`)
        .then((res) => setData(res.data))
        .catch((err) => setError(err.response?.data?.message || err.message))
        .finally(() => setLoading(false));
    } else if (initialData) {
      setData(initialData);
      setLoading(false);
    }
  }, [intakeId, initialData]);

  useEffect(() => () => clearTimeout(feedbackTimeoutRef.current), []);
  useEffect(() => () => clearTimeout(suggestionsBlurTimeoutRef.current), []);

  useEffect(() => {
    // Auto-focus input when modal opens and data is ready
    if (!loading && scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, [loading]);

  const batteriesList = useMemo(() => data?.batteries || [], [data]);

  const expectedCodes = useMemo(
    () => batteriesList.map((b) => b.battery_code.toUpperCase()),
    [batteriesList]
  );
  const scannedSet = useMemo(() => new Set(scannedCodes), [scannedCodes]);
  const allScanned = expectedCodes.length > 0 && expectedCodes.every((c) => scannedSet.has(c));

  // Remaining unscanned batteries on this truck
  const remainingBatteries = useMemo(
    () => batteriesList.filter((b) => !scannedSet.has(b.battery_code.toUpperCase())),
    [batteriesList, scannedSet]
  );

  const remainingCodes = useMemo(
    () => remainingBatteries.map((b) => b.battery_code.toUpperCase()),
    [remainingBatteries]
  );

  // Suggestions filtered by what the admin types (matches battery_code or serial_number)
  const suggestions = useMemo(() => {
    const q = scanInput.trim().toUpperCase();
    if (!q) return remainingBatteries.slice(0, 15);
    return remainingBatteries
      .filter((b) => {
        const code = (b.battery_code || '').toUpperCase();
        const serial = (b.serial_number || '').toUpperCase();
        return code.includes(q) || serial.includes(q);
      })
      .slice(0, 10);
  }, [scanInput, remainingBatteries]);

  function flashFeedback(tone, message) {
    clearTimeout(feedbackTimeoutRef.current);
    setScanFeedback({ tone, message });
    feedbackTimeoutRef.current = setTimeout(() => setScanFeedback(null), 3500);
  }

  function handleScan(raw) {
    const rawVal = (extractBatteryCode(raw) || raw || '').trim();
    if (!rawVal) return;
    const query = rawVal.toUpperCase();
    setScanInput('');
    setShowSuggestions(false);

    // Find if input matches battery_code or serial_number
    const match = batteriesList.find(
      (b) =>
        b.battery_code.toUpperCase() === query ||
        (b.serial_number && b.serial_number.toUpperCase() === query)
    );

    const code = match ? match.battery_code.toUpperCase() : query;

    if (scannedSet.has(code)) {
      flashFeedback('warn', `${code} was already verified.`);
      return;
    }
    if (!expectedCodes.includes(code)) {
      flashFeedback('bad', `"${rawVal}" is not in this truck shipment.`);
      return;
    }
    const now = new Date();
    setScannedCodes((prev) => [...prev, code]);
    setScannedAt((prev) => ({ ...prev, [code]: now }));
    flashFeedback(
      'good',
      `✓ ${code}${match?.serial_number ? ` (SN: ${match.serial_number})` : ''} verified at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.`
    );

    if (scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }

  function handleUnverify(code) {
    setScannedCodes((prev) => prev.filter((c) => c !== code));
    setScannedAt((prev) => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
    flashFeedback('warn', `${code} verification undone.`);
    if (scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }

  async function handleConfirmArrival() {
    setConfirming(true);
    try {
      const activeId = intakeId || data?.intake?.id;
      const res = await apiClient.patch(`/truck-intakes/${activeId}/verify-arrival`);
      if (onSuccess) {
        onSuccess(res.data);
      }
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setConfirming(false);
    }
  }

  const intake = data?.intake;

  return (
    <Modal
      title="Scan to Verify Shipment Arrival"
      description={
        intake
          ? `Truck: ${intake.truck_number} · Driver: ${intake.driver_name}${intake.client_name ? ` · Client: ${intake.client_name}` : ''}`
          : 'Verifying truck batteries'
      }
      onClose={onClose}
      size="4xl"
      className="h-[88vh] max-h-[92vh]"
    >
      {loading ? (
        <TableState>Loading truck shipment details…</TableState>
      ) : error ? (
        <TableState tone="error">{error}</TableState>
      ) : (
        <div className="flex h-full flex-col justify-between space-y-4">
          {/* Progress Header */}
          <div className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-surface-700 dark:bg-surface-800/80">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
              <span className="text-slate-700 dark:text-neutral-200">Verification Progress</span>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-500 dark:text-neutral-400">
                  {remainingBatteries.length} remaining
                </span>
                <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {scannedSet.size} / {expectedCodes.length} verified (
                  {expectedCodes.length > 0 ? Math.round((scannedSet.size / expectedCodes.length) * 100) : 0}%)
                </span>
              </div>
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-surface-700">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{
                  width: `${expectedCodes.length > 0 ? (scannedSet.size / expectedCodes.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          <div className="grid flex-1 grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Left Column: Scanning & Suggestions (7 cols) */}
            <div className="flex flex-col space-y-4 lg:col-span-7">
              {/* Input with Auto-Suggestions */}
              <div className="relative">
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300">
                    Scan or Type Battery Code / Serial
                  </label>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      ref={scanInputRef}
                      type="text"
                      value={scanInput}
                      onChange={(e) => {
                        setScanInput(e.target.value.toUpperCase());
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => {
                        suggestionsBlurTimeoutRef.current = setTimeout(() => setShowSuggestions(false), 250);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleScan(scanInput);
                        } else if (e.key === 'Escape') {
                          setShowSuggestions(false);
                        }
                      }}
                      placeholder="Type battery code or serial number…"
                      autoComplete="off"
                      autoFocus
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-medium text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 dark:border-surface-600 dark:bg-surface-900 dark:text-neutral-100"
                    />
                    {showSuggestions && suggestions.length > 0 && (
                      <ul className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-surface-700 dark:bg-surface-800">
                        <li className="border-b border-slate-100 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:border-surface-700 dark:text-neutral-400">
                          {scanInput.trim()
                            ? `Matching Batteries On Truck (${suggestions.length})`
                            : `Still On Truck (${remainingBatteries.length})`}
                        </li>
                        {suggestions.map((item) => (
                          <li key={item.battery_code}>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleScan(item.battery_code)}
                              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-800 hover:bg-brand-50 hover:text-brand-800 dark:text-neutral-100 dark:hover:bg-surface-700 dark:hover:text-emerald-300"
                            >
                              <div className="flex flex-col">
                                <span className="font-mono font-bold text-base">{item.battery_code}</span>
                                {item.serial_number && (
                                  <span className="text-xs text-slate-500 dark:text-neutral-400">
                                    SN: {item.serial_number}
                                  </span>
                                )}
                              </div>
                              <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                                + Verify Now
                              </span>
                            </button>
                          </li>
                        ))}
                        {remainingBatteries.length > suggestions.length && (
                          <li className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400 dark:border-surface-700 dark:text-neutral-500">
                            +{remainingBatteries.length - suggestions.length} more batteries — type to filter
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleScan(scanInput)}
                    disabled={!scanInput.trim()}
                    className="shrink-0 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white shadow-xs hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                  >
                    Verify
                  </button>
                  <button
                    type="button"
                    onClick={() => setCameraOpen((v) => !v)}
                    className="shrink-0 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-200"
                  >
                    {cameraOpen ? 'Close Camera' : '📷 Camera'}
                  </button>
                </div>
              </div>

              {/* Scan Feedback */}
              {scanFeedback && (
                <div
                  className={`rounded-xl px-4 py-3 text-sm font-bold ${
                    scanFeedback.tone === 'good'
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : scanFeedback.tone === 'warn'
                        ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                        : 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300'
                  }`}
                >
                  {scanFeedback.message}
                </div>
              )}

              {/* Camera Component */}
              {cameraOpen && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 p-2 dark:border-surface-700">
                  <QrScanner onScan={handleScan} onClose={() => setCameraOpen(false)} />
                </div>
              )}
            </div>

            {/* Right Column: Manifest Checklist (5 cols) */}
            <div className="flex flex-col space-y-2 lg:col-span-5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-300">
                  Shipment Manifest ({batteriesList.length})
                </h4>
                <span className="text-xs font-semibold text-slate-400 dark:text-neutral-500">
                  {scannedSet.size} scanned
                </span>
              </div>
              <div className="max-h-[48vh] min-h-[220px] flex-1 divide-y divide-slate-100 overflow-y-auto rounded-2xl border border-slate-200 dark:divide-surface-700/60 dark:border-surface-700">
                {batteriesList.map((b) => {
                  const code = b.battery_code.toUpperCase();
                  const isScanned = scannedSet.has(code);
                  const at = scannedAt[code];
                  return (
                    <div
                      key={code}
                      className={`flex items-center justify-between px-4 py-2.5 text-xs transition-colors ${
                        isScanned
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-surface-800'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="font-mono font-bold text-slate-800 dark:text-neutral-200">
                          {code}
                        </span>
                        {b.serial_number && (
                          <span className="text-[11px] text-slate-400 dark:text-neutral-500">
                            SN: {b.serial_number}
                          </span>
                        )}
                        {at && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                            {at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        )}
                      </div>
                      {isScanned ? (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                            ✓ Verified
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUnverify(code)}
                            title="Remove verification"
                            aria-label={`Remove verification for ${code}`}
                            className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 dark:text-neutral-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleScan(code)}
                          className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-surface-600 dark:bg-surface-700 dark:text-neutral-300 dark:hover:bg-surface-600"
                        >
                          Mark Scanned
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Modal Actions Footer */}
          <div className="flex shrink-0 flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end dark:border-surface-700">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-surface-700 dark:text-neutral-300 dark:hover:bg-surface-800"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleConfirmArrival}
              disabled={!allScanned || confirming}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-xs transition-all hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>✓</span>
              <span>
                {confirming
                  ? 'Confirming…'
                  : allScanned
                    ? 'Confirm Truck Arrived & Verified'
                    : `Scan all ${expectedCodes.length} batteries (${remainingCodes.length} left)`}
              </span>
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default TruckVerifyModal;
