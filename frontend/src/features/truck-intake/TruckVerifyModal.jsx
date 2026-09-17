import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiCpu,
  FiExternalLink,
  FiRepeat,
  FiTruck,
  FiUser,
} from 'react-icons/fi';
import apiClient from '../../services/api-client';
import Modal from '../../components/ui/overlays/Modal';
import QrScanner from '../../components/ui/primitives/QrScanner';
import TableState from '../../components/ui/table/TableState';
import extractBatteryCode from '../../utils/extract-battery-code';

function formatDateTime(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getMonthName(date = new Date()) {
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

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

  // ⚠️ State for 2nd+ time in current month popup alert
  const [repeatAlertData, setRepeatAlertData] = useState(null);

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
    // Auto-focus input when modal opens or when repeat alert closes
    if (!loading && !repeatAlertData && scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, [loading, repeatAlertData]);

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

  // Check if a scanned battery is arriving for 2nd (or N-th) time this month and trigger popup
  async function triggerRepeatIntakeAlertIfApplicable(matchedBattery, code) {
    const currentIntakeId = Number(intakeId || data?.intake?.id);
    let count = matchedBattery?.intake_count_this_month || 0;
    let visits = matchedBattery?.visits_this_month || [];
    let repairs = matchedBattery?.repairs_this_month || [];
    let lastParts = matchedBattery?.last_repaired_parts || '';

    // If repeat data wasn't already attached to matchedBattery, fetch from battery details endpoint
    if (count === 0 && (!visits || visits.length === 0)) {
      try {
        const res = await apiClient.get(`/batteries/${encodeURIComponent(code)}`);
        const allVisits = res.data?.visits || [];
        const now = new Date();
        const thisMonthVisits = allVisits.filter((v) => {
          const d = new Date(v.intake_at || v.created_at);
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        });
        if (thisMonthVisits.length > 1) {
          count = thisMonthVisits.length;
          visits = thisMonthVisits;
          repairs = res.data?.history || [];
        }
      } catch {
        // Safe fallback
      }
    }

    if (count > 1 || visits.length > 1) {
      setRepeatAlertData({
        battery: matchedBattery || { battery_code: code },
        currentIntakeId,
        count: Math.max(count, visits.length),
        visits,
        repairs,
        lastParts,
      });
    }
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

    // Trigger popup if this battery came in for the 2nd (or multiple) time this month
    triggerRepeatIntakeAlertIfApplicable(match, code);

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
    <>
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
            <div className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-surface-800/80">
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
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-medium text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 dark:border-white/10 dark:bg-surface-900 dark:text-neutral-100"
                      />
                      {showSuggestions && suggestions.length > 0 && (
                        <ul className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-surface-800">
                          <li className="border-b border-slate-100 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:border-white/10 dark:text-neutral-400">
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
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-base">{item.battery_code}</span>
                                    {item.intake_count_this_month > 1 && (
                                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800/60">
                                        <FiRepeat className="w-2.5 h-2.5" />
                                        <span>{item.intake_count_this_month}x this month</span>
                                      </span>
                                    )}
                                  </div>
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
                            <li className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400 dark:border-white/10 dark:text-neutral-500">
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
                      className="shrink-0 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700"
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
                  <div className="overflow-hidden rounded-2xl border border-slate-200 p-2 dark:border-white/10">
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
                <div className="max-h-[48vh] min-h-[220px] flex-1 divide-y divide-slate-100 overflow-y-auto rounded-2xl border border-slate-200 dark:divide-white/5 dark:border-white/10">
                  {batteriesList.map((b) => {
                    const code = b.battery_code.toUpperCase();
                    const isScanned = scannedSet.has(code);
                    const at = scannedAt[code];
                    const isRepeat = b.intake_count_this_month > 1;

                    return (
                      <div
                        key={code}
                        className={`flex items-center justify-between px-4 py-2.5 text-xs transition-colors ${
                          isScanned
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/30'
                            : 'hover:bg-slate-50 dark:hover:bg-surface-800'
                        }`}
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-slate-800 dark:text-neutral-200">
                              {code}
                            </span>
                            {isRepeat && (
                              <span
                                className="inline-flex items-center gap-0.5 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800/60"
                                title={`This battery has ${b.intake_count_this_month} intakes in ${getMonthName()}`}
                              >
                                <span>⚠️</span>
                                <span>{b.intake_count_this_month}x this mo</span>
                              </span>
                            )}
                          </div>
                          {b.serial_number && (
                            <span className="text-[11px] text-slate-400 dark:text-neutral-500 font-mono">
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
                          <div className="flex items-center gap-1.5 shrink-0">
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
                            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-white/10 dark:bg-surface-700 dark:text-neutral-300 dark:hover:bg-surface-600 shrink-0"
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
            <div className="flex shrink-0 flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end dark:border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-300 px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-neutral-300 dark:hover:bg-surface-800"
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

      {/* ═══════════════════════════════════════════════════════════════════
          2ND TIME / REPEAT INTAKE THIS MONTH ALERT POPUP MODAL
          ═══════════════════════════════════════════════════════════════════ */}
      {repeatAlertData && (
        <Modal
          title=""
          size="lg"
          onClose={() => {
            setRepeatAlertData(null);
            setTimeout(() => scanInputRef.current?.focus(), 50);
          }}
        >
          <div className="space-y-4">
            {/* Alert Header Banner */}
            <div className="flex items-start gap-3.5 rounded-2xl border border-amber-300/90 bg-amber-50/90 p-4 dark:border-amber-700/60 dark:bg-amber-950/40">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs dark:bg-amber-600">
                <FiAlertTriangle className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-amber-200/90 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-900 dark:bg-amber-900/80 dark:text-amber-200">
                    Repeat Intake Flag
                  </span>
                  <span className="font-mono text-xs font-bold text-amber-800 dark:text-amber-300">
                    {getMonthName()}
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                  {repeatAlertData.count === 2
                    ? '2nd Time Intake in Current Month'
                    : `${repeatAlertData.count}th Time Intake in Current Month`}
                </h3>
                <p className="text-xs text-slate-600 dark:text-neutral-300 mt-0.5 leading-relaxed">
                  Battery <strong className="font-mono font-bold text-slate-900 dark:text-white">{repeatAlertData.battery?.battery_code}</strong> has arrived at the workshop facility <strong>{repeatAlertData.count} times</strong> during <strong>{getMonthName()}</strong>.
                </p>
              </div>
            </div>

            {/* Battery Profile Meta Card */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs dark:border-white/10 dark:bg-surface-800">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500 block">
                  Battery ID
                </span>
                <span className="font-mono font-black text-sm text-blue-600 dark:text-blue-400">
                  {repeatAlertData.battery?.battery_code}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500 block">
                  Physical Serial Number
                </span>
                <span className="font-mono font-bold text-slate-700 dark:text-neutral-200">
                  {repeatAlertData.battery?.serial_number || '—'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500 block">
                  Fleet Client
                </span>
                <span className="font-bold text-slate-800 dark:text-neutral-200 truncate block">
                  {repeatAlertData.battery?.client_name || intake?.client_name || 'Fleet Client'}
                </span>
              </div>
            </div>

            {/* Chronological Intake History in this Month */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 flex items-center gap-1.5">
                <FiClock className="w-3.5 h-3.5 text-blue-500" />
                <span>Intake Trips Recorded in {getMonthName()} ({repeatAlertData.visits?.length || repeatAlertData.count})</span>
              </h4>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {(repeatAlertData.visits || []).map((v, idx) => {
                  const isCurrent = v.truck_intake_id === Number(intakeId || data?.intake?.id) || v.is_current_intake;
                  return (
                    <div
                      key={v.visit_id || v.truck_intake_id || idx}
                      className={`rounded-xl border p-3 text-xs transition-all ${
                        isCurrent
                          ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-800/60 dark:bg-emerald-950/30'
                          : 'border-slate-200 bg-white dark:border-white/10 dark:bg-surface-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-lg px-2 py-0.5 font-bold text-[10px] uppercase ${
                              isCurrent
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-200 text-slate-700 dark:bg-surface-700 dark:text-neutral-200'
                            }`}
                          >
                            Trip #{idx + 1} {isCurrent ? '(Current)' : '(Previous)'}
                          </span>
                          <span className="font-bold text-slate-800 dark:text-neutral-200 flex items-center gap-1">
                            <FiTruck className="w-3 h-3 text-slate-400" />
                            <span>Truck {v.truck_number || '—'}</span>
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-slate-500 dark:text-neutral-400">
                          {formatDateTime(v.intake_at || v.created_at)}
                        </span>
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-neutral-400">
                        <span>
                          Driver: <strong className="text-slate-800 dark:text-neutral-200">{v.driver_name || '—'}</strong>
                        </span>
                        {isCurrent ? (
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <FiCheckCircle className="w-3 h-3" />
                            <span>Verified on Arrival</span>
                          </span>
                        ) : (
                          <span className="text-slate-500 dark:text-neutral-400">
                            Previous workshop cycle
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* If no detailed visits array but count > 1, show fallback rows */}
                {(!repeatAlertData.visits || repeatAlertData.visits.length === 0) && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-xs text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300">
                    This battery has <strong>{repeatAlertData.count} recorded intakes</strong> in {getMonthName()}. Please inspect previous service history to check if the battery experiences recurring faults.
                  </div>
                )}
              </div>
            </div>

            {/* Quality & Maintenance Advisory */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 text-xs dark:border-blue-900/40 dark:bg-blue-950/20 text-blue-900 dark:text-blue-300 flex items-start gap-2">
              <FiCpu className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
              <p className="leading-snug">
                <strong>Workshop Advisory:</strong> Repeat intakes within the same month may indicate recurring cell imbalances, intermittent BMS communication errors, or rapid fleet rotation. Thorough diagnostic capacity testing is recommended.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
              <a
                href={`/batteries/${encodeURIComponent(repeatAlertData.battery?.battery_code)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer"
              >
                <span>Inspect Full Battery History</span>
                <FiExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                type="button"
                autoFocus
                onClick={() => {
                  setRepeatAlertData(null);
                  setTimeout(() => scanInputRef.current?.focus(), 50);
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
              >
                <span>Acknowledge & Continue Scanning</span>
                <span className="rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-mono">Enter ↵</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export default TruckVerifyModal;
