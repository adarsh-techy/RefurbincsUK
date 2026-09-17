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

  const activeIntakeId = intakeId || data?.intake?.id || initialData?.intake?.id;
  const storageKey = activeIntakeId ? `truck_verify_scanned_${activeIntakeId}` : null;
  const storageTimeKey = activeIntakeId ? `truck_verify_scanned_at_${activeIntakeId}` : null;

  // Initialize scannedCodes from sessionStorage so navigating to inspect battery and clicking back preserves progress
  const [scannedCodes, setScannedCodes] = useState(() => {
    if (!activeIntakeId) return [];
    try {
      const saved = sessionStorage.getItem(`truck_verify_scanned_${activeIntakeId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [scannedAt, setScannedAt] = useState(() => {
    if (!activeIntakeId) return {};
    try {
      const saved = sessionStorage.getItem(`truck_verify_scanned_at_${activeIntakeId}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

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

  // Sync to sessionStorage on each scan
  useEffect(() => {
    if (storageKey && scannedCodes.length > 0) {
      sessionStorage.setItem(storageKey, JSON.stringify(scannedCodes));
    }
    if (storageTimeKey && Object.keys(scannedAt).length > 0) {
      sessionStorage.setItem(storageTimeKey, JSON.stringify(scannedAt));
    }
  }, [storageKey, storageTimeKey, scannedCodes, scannedAt]);

  // Global Enter listener to acknowledge repeat intake alert
  useEffect(() => {
    if (!repeatAlertData) return;
    function handleKeyDown(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        setRepeatAlertData(null);
        setTimeout(() => scanInputRef.current?.focus(), 60);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [repeatAlertData]);

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
      if (storageKey) {
        sessionStorage.removeItem(storageKey);
      }
      if (storageTimeKey) {
        sessionStorage.removeItem(storageTimeKey);
      }
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
            ? `Truck: ${intake.truck_number || '—'} · Driver: ${intake.driver_name || '—'}${intake.client_name ? ` · Client: ${intake.client_name}` : ''}`
            : 'Verifying truck shipment batteries'
        }
        onClose={onClose}
        size="6xl"
        className="max-h-[94vh] flex flex-col"
      >
        {loading ? (
          <TableState>Loading truck shipment details…</TableState>
        ) : error ? (
          <TableState tone="error">{error}</TableState>
        ) : (
          <div className="flex flex-col min-h-[580px] max-h-[75vh]">
            {/* 1. Top Metadata & Progress Banner */}
            <div className="shrink-0 mb-4 rounded-2xl border border-slate-200/90 bg-gradient-to-r from-slate-50 via-white to-slate-50 p-4 dark:border-white/10 dark:from-surface-800/80 dark:via-surface-900 dark:to-surface-800/80 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1 text-xs font-black text-white dark:bg-white dark:text-slate-900">
                    <FiTruck className="w-3.5 h-3.5" />
                    <span>{intake?.truck_number || 'TRUCK'}</span>
                  </span>
                  {intake?.driver_name && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-neutral-300">
                      <FiUser className="w-3.5 h-3.5 text-slate-400" />
                      <span>{intake.driver_name}</span>
                    </span>
                  )}
                  {intake?.client_name && (
                    <span className="rounded-lg bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 border border-blue-200/80 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/40">
                      {intake.client_name}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-neutral-400">
                    {remainingBatteries.length > 0 ? (
                      <span className="text-amber-600 dark:text-amber-400 font-bold">
                        {remainingBatteries.length} remaining
                      </span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        All scanned
                      </span>
                    )}
                  </span>
                  <span className="rounded-xl bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/50">
                    {scannedSet.size} / {expectedCodes.length} verified ({expectedCodes.length > 0 ? Math.round((scannedSet.size / expectedCodes.length) * 100) : 0}%)
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-surface-700">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300 rounded-full"
                  style={{
                    width: `${expectedCodes.length > 0 ? (scannedSet.size / expectedCodes.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* 2. Middle 2-Column Work Area (Scrollable) */}
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-y-auto pr-1 pb-4 lg:grid-cols-12">
              {/* Left Column: Input & Live Controls (7 cols) */}
              <div className="flex min-h-0 flex-col space-y-4 lg:col-span-7">
                {/* Search / Scan Input */}
                <div className="relative">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300 mb-1.5">
                    Scan Barcode / QR or Type Battery ID
                  </label>
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
                        placeholder="Scan QR or enter battery ID / serial…"
                        autoComplete="off"
                        autoFocus
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-surface-900 dark:text-neutral-100 shadow-2xs font-mono"
                      />

                      {/* Dropdown Suggestions */}
                      {showSuggestions && suggestions.length > 0 && (
                        <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-surface-800">
                          <li className="border-b border-slate-100 px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:border-white/10 dark:text-neutral-400 bg-slate-50/50 dark:bg-surface-900/50">
                            {scanInput.trim()
                              ? `Matching Batteries On Truck (${suggestions.length})`
                              : `Unscanned On Truck (${remainingBatteries.length})`}
                          </li>
                          {suggestions.map((item) => (
                            <li key={item.battery_code}>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleScan(item.battery_code)}
                                className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs font-medium text-slate-800 hover:bg-emerald-50 hover:text-emerald-900 dark:text-neutral-100 dark:hover:bg-surface-700 dark:hover:text-emerald-300 transition-colors border-b border-slate-100/60 dark:border-white/5 last:border-b-0 cursor-pointer"
                              >
                                <div className="flex flex-col min-w-0 pr-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                                      {item.battery_code}
                                    </span>
                                    {item.intake_count_this_month > 1 && (
                                      <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/80">
                                        <FiRepeat className="w-2.5 h-2.5" />
                                        <span>{item.intake_count_this_month}x this mo</span>
                                      </span>
                                    )}
                                  </div>
                                  {item.serial_number && (
                                    <span className="text-[11px] text-slate-500 dark:text-neutral-400 font-mono mt-0.5">
                                      SN: {item.serial_number}
                                    </span>
                                  )}
                                </div>
                                <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/40 shrink-0">
                                  + Verify
                                </span>
                              </button>
                            </li>
                          ))}
                          {remainingBatteries.length > suggestions.length && (
                            <li className="border-t border-slate-100 px-3.5 py-2 text-[11px] text-slate-400 dark:border-white/10 dark:text-neutral-500">
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
                      className="shrink-0 inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      Verify
                    </button>
                    <button
                      type="button"
                      onClick={() => setCameraOpen((v) => !v)}
                      className={`shrink-0 inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-bold shadow-2xs transition-colors cursor-pointer ${
                        cameraOpen
                          ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-300'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700'
                      }`}
                    >
                      <span>{cameraOpen ? '✕ Close Camera' : '📷 Camera'}</span>
                    </button>
                  </div>
                </div>

                {/* Scan Feedback Banner */}
                {scanFeedback && (
                  <div
                    className={`rounded-xl px-4 py-2.5 text-xs font-bold flex items-center gap-2 border transition-all ${
                      scanFeedback.tone === 'good'
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40'
                        : scanFeedback.tone === 'warn'
                          ? 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40'
                          : 'bg-red-50 text-red-900 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/40'
                    }`}
                  >
                    <span>{scanFeedback.tone === 'good' ? '✅' : scanFeedback.tone === 'warn' ? '⚠️' : '❌'}</span>
                    <span className="flex-1">{scanFeedback.message}</span>
                  </div>
                )}

                {/* Camera Scanner Container */}
                {cameraOpen && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-900 p-3 text-white overflow-hidden shadow-sm dark:border-white/10">
                    <div className="mb-2 flex items-center justify-between text-xs font-bold">
                      <span className="flex items-center gap-1.5 text-emerald-400">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Live Scanner Ready</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setCameraOpen(false)}
                        className="text-slate-400 hover:text-white text-xs"
                      >
                        Done
                      </button>
                    </div>
                    <QrScanner
                      onScan={(value) => {
                        handleScan(value);
                      }}
                    />
                  </div>
                )}

                {/* Quick Info & Verification Guide Card */}
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 text-xs text-slate-600 dark:border-white/10 dark:bg-surface-800/60 dark:text-neutral-300">
                  <span className="font-bold text-slate-800 dark:text-white uppercase tracking-wider text-[10px] block mb-1">
                    Shipment Verification Protocol
                  </span>
                  <p className="text-[11px] leading-relaxed text-slate-500 dark:text-neutral-400">
                    Verify each battery physical code upon offloading the truck. Once all <strong>{expectedCodes.length} batteries</strong> are verified, the confirmation button below will unlock.
                  </p>
                </div>
              </div>

              {/* Right Column: Manifest Checklist (5 cols) */}
              <div className="flex min-h-0 flex-col space-y-2 lg:col-span-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300">
                    Shipment Manifest ({batteriesList.length})
                  </h4>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-neutral-400">
                    {scannedSet.size} of {batteriesList.length} scanned
                  </span>
                </div>

                <div className="min-h-[220px] flex-1 divide-y divide-slate-100 overflow-y-auto rounded-2xl border border-slate-200 bg-white dark:divide-white/5 dark:border-white/10 dark:bg-surface-900 shadow-2xs">
                  {batteriesList.map((b) => {
                    const code = b.battery_code.toUpperCase();
                    const isScanned = scannedSet.has(code);
                    const at = scannedAt[code];
                    const isRepeat = b.intake_count_this_month > 1;

                    return (
                      <div
                        key={code}
                        className={`flex items-center justify-between px-3.5 py-2.5 text-xs transition-colors ${
                          isScanned
                            ? 'bg-emerald-50/60 dark:bg-emerald-950/20'
                            : 'hover:bg-slate-50 dark:hover:bg-surface-800'
                        }`}
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-slate-900 dark:text-white">
                              {code}
                            </span>
                            {isRepeat && (
                              <span
                                className="inline-flex items-center gap-0.5 rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800/60"
                                title={`This battery has ${b.intake_count_this_month} intakes in ${getMonthName()}`}
                              >
                                <span>⚠️</span>
                                <span>{b.intake_count_this_month}x this mo</span>
                              </span>
                            )}
                          </div>
                          {b.serial_number && (
                            <span className="text-[11px] text-slate-500 dark:text-neutral-400 font-mono">
                              SN: {b.serial_number}
                            </span>
                          )}
                          {at && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                              Scanned at {at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          )}
                        </div>

                        {isScanned ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                              ✓ Verified
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUnverify(code)}
                              title="Undo verification"
                              aria-label={`Undo verification for ${code}`}
                              className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:text-neutral-500 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleScan(code)}
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-white/10 dark:bg-surface-700 dark:text-neutral-300 dark:hover:bg-surface-600 shrink-0 shadow-2xs transition-colors cursor-pointer"
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

            {/* 3. FIXED BOTTOM RIGHT ACTIONS FOOTER */}
            <div className="sticky bottom-0 z-20 -mx-4 -mb-4 sm:-mx-6 sm:-mb-5 mt-auto flex shrink-0 flex-col gap-3 border-t border-slate-200/90 bg-white/95 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-white/10 dark:bg-surface-900/95 backdrop-blur-md">
              <div className="flex items-center gap-2">
                {allScanned ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    <FiCheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>All {expectedCodes.length} batteries verified · Ready to confirm arrival</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-neutral-400">
                    <FiClock className="w-3.5 h-3.5 text-amber-500" />
                    <span>{remainingCodes.length} of {expectedCodes.length} batteries remaining to scan</span>
                  </span>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-300 dark:hover:bg-surface-700 shadow-2xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmArrival}
                  disabled={!allScanned || confirming}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  <span>✓</span>
                  <span>
                    {confirming
                      ? 'Confirming Arrival…'
                      : allScanned
                        ? 'Confirm Truck Arrived & Verified'
                        : `Scan Remaining (${remainingCodes.length} left)`}
                  </span>
                </button>
              </div>
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
          size="2xl"
          onClose={() => {
            setRepeatAlertData(null);
            setTimeout(() => scanInputRef.current?.focus(), 50);
          }}
        >
          <div className="space-y-4">
            {/* Alert Header Banner */}
            <div className="relative overflow-hidden rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 via-amber-50/80 to-amber-100/50 p-4.5 dark:border-amber-700/60 dark:from-amber-950/50 dark:via-amber-950/30 dark:to-surface-900 shadow-sm">
              <div className="flex items-start gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/20">
                  <FiAlertTriangle className="h-6 w-6 stroke-[2.5]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-200/90 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-950 dark:bg-amber-900/90 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700">
                      <FiRepeat className="w-3 h-3" />
                      <span>Repeat Intake Flag</span>
                    </span>
                    <span className="font-mono text-xs font-bold text-amber-800 dark:text-amber-300">
                      {getMonthName()}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1 tracking-tight">
                    {repeatAlertData.count === 2
                      ? '2nd Time Intake in Current Month'
                      : `${repeatAlertData.count}th Time Intake in Current Month`}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-neutral-300 mt-1 leading-relaxed">
                    Battery <strong className="font-mono font-black text-slate-950 dark:text-white px-1.5 py-0.5 rounded bg-amber-200/60 dark:bg-amber-900/60 border border-amber-300/50">{repeatAlertData.battery?.battery_code}</strong> has arrived at the workshop facility <strong className="text-amber-950 dark:text-amber-200 font-bold">{repeatAlertData.count} times</strong> during <strong>{getMonthName()}</strong>.
                  </p>
                </div>
              </div>
            </div>

            {/* Battery Profile Meta Card */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-2xl border border-slate-200/90 bg-slate-50/70 p-3.5 text-xs dark:border-white/10 dark:bg-surface-800/80 shadow-2xs">
              <div className="rounded-xl bg-white p-2.5 dark:bg-surface-900 border border-slate-100 dark:border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400 block mb-0.5">
                  Battery ID
                </span>
                <span className="font-mono font-black text-sm text-blue-600 dark:text-blue-400">
                  {repeatAlertData.battery?.battery_code}
                </span>
              </div>
              <div className="rounded-xl bg-white p-2.5 dark:bg-surface-900 border border-slate-100 dark:border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400 block mb-0.5">
                  Physical Serial Number
                </span>
                <span className="font-mono font-bold text-slate-800 dark:text-neutral-200 truncate block">
                  {repeatAlertData.battery?.serial_number || '—'}
                </span>
              </div>
              <div className="rounded-xl bg-white p-2.5 dark:bg-surface-900 border border-slate-100 dark:border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400 block mb-0.5">
                  Fleet Client
                </span>
                <span className="font-bold text-slate-900 dark:text-white truncate block">
                  {repeatAlertData.battery?.client_name || intake?.client_name || 'Fleet Client'}
                </span>
              </div>
            </div>

            {/* Chronological Intake History in this Month */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 flex items-center gap-1.5">
                  <FiClock className="w-3.5 h-3.5 text-blue-500" />
                  <span>Intake Trips Recorded in {getMonthName()} ({repeatAlertData.visits?.length || repeatAlertData.count})</span>
                </h4>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {(repeatAlertData.visits || []).map((v, idx) => {
                  const isCurrent = v.truck_intake_id === Number(intakeId || data?.intake?.id) || v.is_current_intake;
                  return (
                    <div
                      key={v.visit_id || v.truck_intake_id || idx}
                      className={`rounded-xl border p-3 text-xs transition-all ${
                        isCurrent
                          ? 'border-emerald-300 bg-emerald-50/70 dark:border-emerald-800/60 dark:bg-emerald-950/40 shadow-2xs'
                          : 'border-slate-200 bg-white dark:border-white/10 dark:bg-surface-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-lg px-2.5 py-0.5 font-bold text-[10px] uppercase tracking-wide ${
                              isCurrent
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-200 text-slate-700 dark:bg-surface-700 dark:text-neutral-200'
                            }`}
                          >
                            Trip #{idx + 1} {isCurrent ? '(Current)' : '(Previous)'}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                            <FiTruck className="w-3.5 h-3.5 text-slate-400" />
                            <span>Truck {v.truck_number || '—'}</span>
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-slate-500 dark:text-neutral-400">
                          {formatDateTime(v.intake_at || v.created_at)}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-neutral-400">
                        <span>
                          Driver: <strong className="text-slate-800 dark:text-neutral-200">{v.driver_name || '—'}</strong>
                        </span>
                        {isCurrent ? (
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-100/60 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                            <FiCheckCircle className="w-3.5 h-3.5 text-emerald-600" />
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
                  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 text-xs text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300">
                    This battery has <strong>{repeatAlertData.count} recorded intakes</strong> in {getMonthName()}. Please inspect previous service history to check if the battery experiences recurring faults.
                  </div>
                )}
              </div>
            </div>

            {/* Quality & Maintenance Advisory */}
            <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/80 via-blue-50/50 to-indigo-50/40 p-3.5 text-xs dark:border-blue-900/40 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200 flex items-start gap-2.5 shadow-2xs">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300">
                <FiCpu className="w-4 h-4" />
              </div>
              <p className="leading-relaxed">
                <strong className="font-bold">Workshop Advisory:</strong> Repeat intakes within the same month may indicate recurring cell imbalances, intermittent BMS communication errors, or rapid fleet rotation. Thorough diagnostic capacity testing is recommended.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3.5 border-t border-slate-200/80 dark:border-white/10">
              <a
                href={`/batteries/${encodeURIComponent(repeatAlertData.battery?.battery_code)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer transition-colors"
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
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-2.5 text-xs font-bold text-white hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <span>Acknowledge &amp; Continue Scanning</span>
                <span className="rounded-md bg-white/25 px-1.5 py-0.5 text-[10px] font-mono font-bold">Enter ↵</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export default TruckVerifyModal;
