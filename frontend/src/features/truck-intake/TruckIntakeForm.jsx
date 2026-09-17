import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FiTruck,
  FiUser,
  FiBriefcase,
  FiPackage,
  FiCheckCircle,
  FiAlertCircle,
  FiShield,
  FiSearch,
} from 'react-icons/fi';
import apiClient from '../../services/api-client';
import useFetchList from '../../utils/use-fetch-list';
import AlertModal from '../../components/ui/overlays/AlertModal';
import QrScanner from '../../components/ui/primitives/QrScanner';
import extractBatteryCode from '../../utils/extract-battery-code';

const inputClasses =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-surface-900 dark:text-neutral-100 shadow-2xs transition-colors';
const labelClasses = 'mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300';

function TruckIntakeForm({ intake, onSaved, onCancel }) {
  const isEdit = Boolean(intake);
  const { data: rawClients } = useFetchList('/clients');
  const clients = useMemo(
    () => (rawClients || []).filter((c) => c.user_role !== 'recycle_client'),
    [rawClients]
  );

  const { data: pastIntakes } = useFetchList('/truck-intakes');
  const existingTruckNumbers = useMemo(
    () => [...new Set((pastIntakes || []).map((i) => i.truck_number).filter(Boolean))],
    [pastIntakes]
  );

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
  const [scanFeedback, setScanFeedback] = useState(null); // { tone: 'good'|'warn'|'bad', message }
  const [scanLoading, setScanLoading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [clientBatteryCodes, setClientBatteryCodes] = useState([]);
  const [showScanSuggestions, setShowScanSuggestions] = useState(false);
  const [repeatIntakeAlert, setRepeatIntakeAlert] = useState(null);
  const [unserviceableAlert, setUnserviceableAlert] = useState(null);

  const scanInputRef = useRef(null);
  const feedbackTimeoutRef = useRef(null);

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
      .get('/batteries', { params: { search: client.name, limit: 200 } })
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

  useEffect(() => () => clearTimeout(feedbackTimeoutRef.current), []);

  function flashFeedback(tone, message) {
    clearTimeout(feedbackTimeoutRef.current);
    setScanFeedback({ tone, message });
    feedbackTimeoutRef.current = setTimeout(() => setScanFeedback(null), 4000);
  }

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleScanValue(rawValue) {
    const code = extractBatteryCode(rawValue);
    if (!code) return;

    setScanLoading(true);
    try {
      const { data } = await apiClient.get(`/batteries/${encodeURIComponent(code)}`);
      const battery = data.battery;

      if (scannedBatteries.some((b) => b.id === battery.id)) {
        flashFeedback('warn', `${battery.battery_code} has already been scanned in.`);
        return;
      }
      if (battery.status === 'unserviceable') {
        setUnserviceableAlert(battery.battery_code);
        return;
      }
      if (['in_repair', 'in_progress', 'in_testing', 'repaired'].includes(battery.status)) {
        flashFeedback(
          'bad',
          `${battery.battery_code} hasn't been returned to the client yet (status: ${battery.status.replace('_', ' ')}).`
        );
        return;
      }

      setScannedBatteries((prev) => [...prev, battery]);
      flashFeedback(
        'good',
        `✓ ${battery.battery_code}${battery.serial_number ? ` (SN: ${battery.serial_number})` : ''} added to intake.`
      );
      setScanInput('');
      setShowScanSuggestions(false);

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
      flashFeedback(
        'bad',
        err.response?.status === 404
          ? `No battery found for code "${code}".`
          : err.response?.data?.message || err.message
      );
    } finally {
      setScanLoading(false);
    }
  }

  const scannedCodes = useMemo(
    () => new Set(scannedBatteries.map((b) => b.battery_code)),
    [scannedBatteries]
  );

  const NOT_RETURNABLE_STATUSES = useMemo(
    () => new Set(['in_repair', 'in_progress', 'in_testing', 'repaired', 'unserviceable']),
    []
  );

  const availableClientBatteries = useMemo(
    () =>
      clientBatteryCodes.filter(
        (b) => !scannedCodes.has(b.battery_code) && !NOT_RETURNABLE_STATUSES.has(b.status)
      ),
    [clientBatteryCodes, scannedCodes, NOT_RETURNABLE_STATUSES]
  );

  const scanSuggestions = useMemo(() => {
    const q = scanInput.trim().toLowerCase();
    if (!q) return availableClientBatteries.slice(0, 15);
    return availableClientBatteries.filter(
      (b) =>
        b.battery_code.toLowerCase().includes(q) ||
        (b.serial_number && b.serial_number.toLowerCase().includes(q))
    );
  }, [availableClientBatteries, scanInput]);

  function removeScanned(id) {
    const item = scannedBatteries.find((b) => b.id === id);
    setScannedBatteries((prev) => prev.filter((b) => b.id !== id));
    if (item) {
      flashFeedback('warn', `${item.battery_code} removed from intake.`);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.clientId) {
      setError('Please select a client.');
      return;
    }
    if (!isEdit && scannedBatteries.length === 0) {
      setError('Please scan or select at least one battery.');
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
      <form onSubmit={handleSubmit} className="flex flex-col min-h-[580px] max-h-[75vh]">
        {/* 1. Top Logistics Details Header Card */}
        <div className="shrink-0 mb-4 rounded-2xl border border-slate-200/90 bg-gradient-to-r from-slate-50 via-white to-slate-50 p-4 dark:border-white/10 dark:from-surface-800/80 dark:via-surface-900 dark:to-surface-800/80 shadow-2xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div>
              <label className={labelClasses}>
                <span className="flex items-center gap-1.5">
                  <FiTruck className="w-3.5 h-3.5 text-blue-500" />
                  <span>Truck / Vehicle Number</span>
                </span>
              </label>
              <input
                type="text"
                list="intake-truck-numbers"
                value={form.truckNumber}
                onChange={(e) => updateField('truckNumber', e.target.value.toUpperCase())}
                placeholder="e.g. GB21 XYZ"
                autoComplete="off"
                className={`${inputClasses} font-mono uppercase`}
                required
              />
              <datalist id="intake-truck-numbers">
                {existingTruckNumbers.map((num) => (
                  <option key={num} value={num} />
                ))}
              </datalist>
            </div>

            <div>
              <label className={labelClasses}>
                <span className="flex items-center gap-1.5">
                  <FiUser className="w-3.5 h-3.5 text-purple-500" />
                  <span>Driver Name</span>
                </span>
              </label>
              <input
                type="text"
                value={form.driverName}
                onChange={(e) => updateField('driverName', e.target.value)}
                placeholder="e.g. George Davies"
                className={inputClasses}
                required
              />
            </div>

            <div>
              <label className={labelClasses}>
                <span className="flex items-center gap-1.5">
                  <FiBriefcase className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Client / Customer</span>
                </span>
              </label>
              <select
                value={form.clientId}
                onChange={(e) => updateField('clientId', e.target.value)}
                className={inputClasses}
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
          </div>
        </div>

        {/* 2. Middle Area */}
        {isEdit ? (
          /* Edit Mode: Simple summary view */
          <div className="flex-1 overflow-y-auto pr-1 pb-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-surface-900 shadow-2xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                  <FiPackage className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                    Shipment Battery Allocation
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-neutral-400">
                    Battery count is fixed to the existing generated battery records.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 dark:border-white/10 dark:bg-surface-800/50">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                  Total Batteries in Intake
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-1">
                  {form.batteryCount} units
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Create Mode: 2-Column Work Area */
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-y-auto pr-1 pb-4 lg:grid-cols-12">
            {/* Left Column: Battery Scanning & Selection (7 cols) */}
            <div className="flex min-h-0 flex-col space-y-4 lg:col-span-7">
              <div className="relative">
                <div className="flex items-center justify-between mb-1.5">
                  <label className={labelClasses}>
                    Scan / Pick Returning Batteries
                  </label>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-neutral-400">
                    {form.clientId
                      ? `${availableClientBatteries.length} eligible packs`
                      : 'Select client first'}
                  </span>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      ref={scanInputRef}
                      type="text"
                      value={scanInput}
                      onChange={(e) => {
                        setScanInput(e.target.value.toUpperCase());
                        setShowScanSuggestions(true);
                      }}
                      onFocus={() => setShowScanSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowScanSuggestions(false), 250)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (scanInput.trim()) {
                            handleScanValue(scanInput);
                          }
                        } else if (e.key === 'Escape') {
                          setShowScanSuggestions(false);
                        }
                      }}
                      placeholder={
                        form.clientId
                          ? 'Scan QR or enter returning battery code…'
                          : 'Select a client above to enable scanning…'
                      }
                      autoComplete="off"
                      disabled={scanLoading || !form.clientId}
                      className={`${inputClasses} font-mono disabled:cursor-not-allowed disabled:opacity-50`}
                    />

                    {/* Suggestions Dropdown */}
                    {showScanSuggestions && form.clientId && scanSuggestions.length > 0 && (
                      <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-surface-800">
                        <li className="border-b border-slate-100 px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:border-white/10 dark:text-neutral-400 bg-slate-50/50 dark:bg-surface-900/50">
                          {scanInput.trim()
                            ? `Matching Client Units (${scanSuggestions.length})`
                            : `Available For Intake (${availableClientBatteries.length})`}
                        </li>
                        {scanSuggestions.map((b) => (
                          <li key={b.id || b.battery_code}>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleScanValue(b.battery_code)}
                              className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs font-medium text-slate-800 hover:bg-emerald-50 hover:text-emerald-900 dark:text-neutral-100 dark:hover:bg-surface-700 dark:hover:text-emerald-300 transition-colors border-b border-slate-100/60 dark:border-white/5 last:border-b-0 cursor-pointer"
                            >
                              <div className="flex flex-col min-w-0 pr-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                                    {b.battery_code}
                                  </span>
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-surface-800 dark:text-neutral-300">
                                    {b.status?.replace('_', ' ') || 'Returned'}
                                  </span>
                                </div>
                                {b.serial_number && (
                                  <span className="text-[11px] text-slate-500 dark:text-neutral-400 font-mono mt-0.5">
                                    SN: {b.serial_number}
                                  </span>
                                )}
                              </div>
                              <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/40 shrink-0">
                                + Add
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleScanValue(scanInput)}
                    disabled={scanLoading || !scanInput.trim() || !form.clientId}
                    className="shrink-0 inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setCameraOpen((v) => !v)}
                    disabled={!form.clientId}
                    className={`shrink-0 inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-bold shadow-2xs transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                      cameraOpen
                        ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-300'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700'
                    }`}
                  >
                    <span>{cameraOpen ? '✕ Close Camera' : '📷 Camera'}</span>
                  </button>
                </div>
              </div>

              {/* Feedback Toast */}
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

              {/* Camera Scanner View */}
              {cameraOpen && (
                <div className="rounded-2xl border border-slate-200 bg-slate-900 p-3 text-white overflow-hidden shadow-sm dark:border-white/10">
                  <div className="mb-2 flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Ready to Scan Battery Barcode / QR</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setCameraOpen(false)}
                      className="text-slate-400 hover:text-white text-xs cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                  <QrScanner onScan={(value) => handleScanValue(value)} />
                </div>
              )}

              {/* Intake Guidelines Notice */}
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 text-xs text-slate-600 dark:border-white/10 dark:bg-surface-800/60 dark:text-neutral-300">
                <span className="font-bold text-slate-800 dark:text-white uppercase tracking-wider text-[10px] block mb-1 flex items-center gap-1.5">
                  <FiShield className="w-3.5 h-3.5 text-blue-600" />
                  <span>Incoming Inspection & Intake Policy</span>
                </span>
                <p className="text-[11px] leading-relaxed text-slate-500 dark:text-neutral-400">
                  Returning batteries must be scanned to establish chain of custody. Batteries previously marked as unserviceable cannot be received on repair intakes.
                </p>
              </div>
            </div>

            {/* Right Column: Added Batteries Manifest (5 cols) */}
            <div className="flex min-h-0 flex-col space-y-2 lg:col-span-5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300">
                  Intake Manifest ({scannedBatteries.length})
                </h4>
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                  {scannedBatteries.length} batteries staged
                </span>
              </div>

              <div className="min-h-[220px] flex-1 divide-y divide-slate-100 overflow-y-auto rounded-2xl border border-slate-200 bg-white dark:divide-white/5 dark:border-white/10 dark:bg-surface-900 shadow-2xs">
                {scannedBatteries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center h-full min-h-[200px]">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-surface-800 dark:text-neutral-500 mb-2">
                      <FiPackage className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-slate-700 dark:text-neutral-200">
                      No batteries scanned for intake yet
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-neutral-500 mt-1 max-w-xs">
                      {form.clientId
                        ? 'Scan QR codes or pick from the client suggestions on the left.'
                        : 'Select a client first to view and scan returning packs.'}
                    </p>
                  </div>
                ) : (
                  scannedBatteries.map((b, idx) => (
                    <div
                      key={b.id || idx}
                      className="flex items-center justify-between px-3.5 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-surface-800/60 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          {idx + 1}
                        </span>
                        <div className="flex flex-col min-w-0">
                          <span className="font-mono font-bold text-slate-900 dark:text-white truncate">
                            {b.battery_code}
                          </span>
                          {b.serial_number && (
                            <span className="text-[11px] text-slate-500 dark:text-neutral-400 font-mono">
                              SN: {b.serial_number}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
                          {b.status?.replace('_', ' ') || 'Intake'}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeScanned(b.id)}
                          className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:text-neutral-500 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors cursor-pointer"
                          title="Remove from intake"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-semibold text-red-700 dark:bg-red-950/30 dark:border-red-900/40 dark:text-red-300 flex items-center gap-2">
            <FiAlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 3. FIXED BOTTOM RIGHT ACTIONS FOOTER */}
        <div className="sticky bottom-0 z-20 -mx-4 -mb-4 sm:-mx-6 sm:-mb-5 mt-auto flex shrink-0 flex-col gap-3 border-t border-slate-200/90 bg-white/95 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-white/10 dark:bg-surface-900/95 backdrop-blur-md">
          <div className="flex items-center gap-2">
            {!isEdit ? (
              scannedBatteries.length > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  <FiCheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{scannedBatteries.length} batteries staged for intake</span>
                </span>
              ) : (
                <span className="text-xs font-medium text-slate-500 dark:text-neutral-400">
                  {form.clientId
                    ? 'Scan or pick returning batteries to create intake'
                    : 'Select a client above to begin scanning'}
                </span>
              )
            ) : (
              <span className="text-xs font-medium text-slate-500 dark:text-neutral-400">
                Updating logistics details for intake #{intake?.id}
              </span>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-300 dark:hover:bg-surface-700 shadow-2xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              disabled={submitting || (!isEdit && scannedBatteries.length === 0)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              <span>✓</span>
              <span>
                {submitting
                  ? 'Saving…'
                  : isEdit
                    ? 'Save Changes'
                    : `Add Intake (${scannedBatteries.length} ${scannedBatteries.length === 1 ? 'battery' : 'batteries'})`}
              </span>
            </button>
          </div>
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
          message={`${unserviceableAlert} was declared unserviceable and cannot be received on a repair intake.`}
          onClose={() => setUnserviceableAlert(null)}
        />
      )}
    </>
  );
}

export default TruckIntakeForm;
