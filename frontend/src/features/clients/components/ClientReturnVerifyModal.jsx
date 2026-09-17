import { useEffect, useMemo, useRef, useState } from 'react';
import apiClient from '../../../services/api-client';
import Modal from '../../../components/ui/overlays/Modal';
import QrScanner from '../../../components/ui/primitives/QrScanner';
import TableState from '../../../components/ui/table/TableState';
import extractBatteryCode from '../../../utils/extract-battery-code';

function ClientReturnVerifyModal({ returnId, batchData = null, onClose, onSuccess }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
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
    let cancelled = false;
    setLoading(true);
    setError(null);

    // If batchData already has batteries list, we can use it or fetch full details
    if (returnId) {
      apiClient
        .get(`/returns/${returnId}`)
        .then((res) => {
          if (!cancelled) setData(res.data);
        })
        .catch((err) => {
          if (!cancelled) {
            if (batchData) {
              setData({
                returnRecord: {
                  id: returnId,
                  truck_number: batchData.truckNumber,
                  driver_name: batchData.driverName,
                  returned_at: batchData.intakeAt,
                  status: batchData.intakeStatus,
                },
                batteries: batchData.batteries || [],
              });
            } else {
              setError(err.response?.data?.message || err.message);
            }
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else if (batchData) {
      setData({
        returnRecord: {
          id: batchData.intakeId || batchData.key,
          truck_number: batchData.truckNumber,
          driver_name: batchData.driverName,
          returned_at: batchData.intakeAt,
          status: batchData.intakeStatus,
        },
        batteries: batchData.batteries || [],
      });
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [returnId, batchData]);

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

  // Remaining unscanned batteries in this return shipment
  const remainingBatteries = useMemo(
    () => batteriesList.filter((b) => !scannedSet.has(b.battery_code.toUpperCase())),
    [batteriesList, scannedSet]
  );

  // Suggestions filtered by what the client types (matches battery_code or serial_number)
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
      flashFeedback('bad', `"${rawVal}" is not in this return shipment.`);
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

  async function handleConfirmReceipt() {
    setConfirming(true);
    try {
      const activeId = returnId || data?.returnRecord?.id;
      const res = await apiClient.patch(`/returns/${activeId}/verify-receipt`);
      if (onSuccess) {
        onSuccess(res.data, data?.batteries || batchData?.batteries || []);
      }
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setConfirming(false);
    }
  }

  const returnRecord = data?.returnRecord;
  const progressPercent = expectedCodes.length > 0 ? Math.round((scannedCodes.length / expectedCodes.length) * 100) : 0;

  return (
    <Modal
      title="Scan to Verify Battery Receipt"
      description={
        returnRecord
          ? `Truck: ${returnRecord.truck_number || 'Return Dispatch'} · Driver: ${returnRecord.driver_name || 'Workshop Driver'} · Dispatched on ${returnRecord.returned_at ? new Date(returnRecord.returned_at).toLocaleDateString() : '—'}`
          : 'Verifying return shipment batteries'
      }
      onClose={onClose}
      size="4xl"
      className="h-[88vh] max-h-[92vh]"
    >
      {loading ? (
        <TableState>Loading return shipment details…</TableState>
      ) : error ? (
        <TableState tone="error">{error}</TableState>
      ) : (
        <div className="flex h-full flex-col justify-between space-y-4">
          {/* Progress Header */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-800/40 dark:bg-blue-950/20">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white shadow-xs">
                  {scannedCodes.length}
                </span>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300">
                    Verification Progress
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-neutral-300">
                    {scannedCodes.length} of {expectedCodes.length} batteries verified ({progressPercent}%)
                  </p>
                </div>
              </div>

              {allScanned ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-xs">
                  ✓ All Batteries Verified
                </span>
              ) : (
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                  {expectedCodes.length - scannedCodes.length} remaining to scan
                </span>
              )}
            </div>

            {/* Progress Bar */}
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-blue-200 dark:bg-blue-900/50">
              <div
                className={`h-full transition-all duration-300 ${
                  allScanned ? 'bg-emerald-500' : 'bg-blue-600'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Scan Input & Camera Controls */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  ref={scanInputRef}
                  type="text"
                  value={scanInput}
                  onChange={(e) => {
                    setScanInput(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => {
                    suggestionsBlurTimeoutRef.current = setTimeout(() => setShowSuggestions(false), 200);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleScan(scanInput);
                    }
                  }}
                  placeholder="Scan QR / barcode or type battery code, then press Enter"
                  autoComplete="off"
                  className="w-full rounded-xl border border-blue-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 dark:border-blue-800/60 dark:bg-surface-900 dark:text-white dark:placeholder:text-neutral-500"
                />

                {/* Suggestions dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-blue-200 bg-white p-1.5 shadow-xl dark:border-blue-800/60 dark:bg-surface-900">
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                      Remaining Batteries in this Shipment ({remainingBatteries.length})
                    </div>
                    {suggestions.map((b) => (
                      <button
                        key={b.id || b.battery_code}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleScan(b.battery_code)}
                        className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs text-slate-800 transition-colors hover:bg-blue-50 dark:text-neutral-100 dark:hover:bg-blue-900/30"
                      >
                        <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                          {b.battery_code}
                        </span>
                        {b.serial_number && (
                          <span className="text-[11px] text-slate-500 dark:text-neutral-400 font-mono">
                            SN: {b.serial_number}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleScan(scanInput)}
                disabled={!scanInput.trim()}
                className="shrink-0 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
              >
                Verify
              </button>

              <button
                type="button"
                onClick={() => setCameraOpen((prev) => !prev)}
                className="shrink-0 rounded-xl border border-blue-300 bg-blue-50 px-3.5 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/40"
              >
                {cameraOpen ? 'Close Camera' : '📷 Use Camera'}
              </button>
            </div>

            {/* Live Scan Feedback Toast */}
            {scanFeedback && (
              <div
                className={`flex items-center gap-2 rounded-xl p-3 text-xs font-bold transition-all ${
                  scanFeedback.tone === 'good'
                    ? 'border border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/50 dark:text-emerald-300'
                    : scanFeedback.tone === 'warn'
                    ? 'border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/50 dark:text-amber-300'
                    : 'border border-red-300 bg-red-50 text-red-800 dark:border-red-800/40 dark:bg-red-950/50 dark:text-red-300'
                }`}
              >
                <span>
                  {scanFeedback.tone === 'good' ? '✅' : scanFeedback.tone === 'warn' ? '⚠️' : '❌'}
                </span>
                <span>{scanFeedback.message}</span>
              </div>
            )}

            {/* Optional Camera Scanner */}
            {cameraOpen && (
              <div className="rounded-2xl border border-blue-200 bg-slate-900 p-2 shadow-inner">
                <QrScanner onScan={handleScan} onClose={() => setCameraOpen(false)} />
              </div>
            )}
          </div>

          {/* Verified vs Remaining Lists */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 flex-1 min-h-0">
            {/* Verified List */}
            <div className="flex flex-col rounded-2xl border border-emerald-200 bg-emerald-50/30 p-3.5 dark:border-emerald-900/30 dark:bg-emerald-950/10">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  ✓ Verified ({scannedCodes.length})
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                  Ready to receive
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 max-h-52 pr-1">
                {scannedCodes.length === 0 ? (
                  <div className="flex h-full min-h-24 items-center justify-center text-center text-xs text-slate-400 dark:text-neutral-500">
                    No batteries verified yet. Scan or type codes above.
                  </div>
                ) : (
                  scannedCodes.map((code) => {
                    const match = batteriesList.find((b) => b.battery_code.toUpperCase() === code);
                    const time = scannedAt[code];
                    return (
                      <div
                        key={code}
                        className="flex items-center justify-between rounded-xl border border-emerald-200/80 bg-white px-3 py-2 text-xs shadow-2xs dark:border-emerald-900/40 dark:bg-surface-900"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                            {code}
                          </span>
                          {match?.serial_number && (
                            <span className="text-[11px] text-slate-500 dark:text-neutral-400 truncate">
                              (SN: {match.serial_number})
                            </span>
                          )}
                          {time && (
                            <span className="text-[10px] text-slate-400 dark:text-neutral-500">
                              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUnverify(code)}
                          title="Undo verification"
                          className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Remaining List */}
            <div className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-white/10 dark:bg-surface-850/50">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-400">
                  Awaiting Scan ({remainingBatteries.length})
                </span>
                <span className="text-[10px] text-slate-400">
                  Off truck list
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 max-h-52 pr-1">
                {remainingBatteries.length === 0 ? (
                  <div className="flex h-full min-h-24 items-center justify-center text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    🎉 All shipment batteries have been scanned!
                  </div>
                ) : (
                  remainingBatteries.map((b) => (
                    <button
                      key={b.id || b.battery_code}
                      type="button"
                      onClick={() => handleScan(b.battery_code)}
                      className="flex w-full items-center justify-between rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs text-left shadow-2xs hover:border-blue-400 hover:bg-blue-50/50 dark:border-white/5 dark:bg-surface-900 dark:hover:border-blue-600"
                    >
                      <span className="font-mono font-bold text-slate-800 dark:text-neutral-200">
                        {b.battery_code}
                      </span>
                      {b.serial_number && (
                        <span className="text-[11px] text-slate-500 dark:text-neutral-400 font-mono">
                          SN: {b.serial_number}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between border-t border-slate-200/80 pt-3 dark:border-white/10">
            <div className="text-xs text-slate-500 dark:text-neutral-400">
              {scannedCodes.length > 0
                ? `${scannedCodes.length} of ${expectedCodes.length} verified`
                : 'Scan batteries off the truck to verify'}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-neutral-200 dark:hover:bg-surface-800"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={scannedCodes.length === 0 || confirming}
                onClick={handleConfirmReceipt}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {confirming ? (
                  <span>Saving Receipt…</span>
                ) : (
                  <span>
                    ✓ Confirm Receipt ({scannedCodes.length}/{expectedCodes.length})
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default ClientReturnVerifyModal;
