import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import apiClient from '../../../services/api-client';
import QrScanner from '../../../components/ui/primitives/QrScanner';
import extractBatteryCode from '../../../utils/extract-battery-code';
import { StatusBadge } from '../../../components/ui/primitives/Badge';
import { canTestBatteries, isIntakeUnverified } from '../../../utils/permissions';

const SUGGESTION_LIMIT = 8;
const DEBOUNCE_MS = 250;

// A technician's entry point to start work: scan a battery's QR code (with
// the device camera, or a handheld scanner gun typing into the input below)
// and jump straight to its /batteries/:code page. That page validates the
// code itself and shows its own error if nothing matches.
function TechnicianHomePage() {
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const canTest = canTestBatteries(user);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);

    if (!manualCode.trim()) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const params = {
          q: manualCode.trim(),
          limit: SUGGESTION_LIMIT,
          intakedOnly: 'true',
        };
        if (canTest) {
          params.includeTesting = 'true';
        }
        const { data } = await apiClient.get('/batteries', { params });
        setSuggestions(data.data);
      } catch {
        setSuggestions([]);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [manualCode, canTest]);

  const [checkingScan, setCheckingScan] = useState(false);
  const [unverifiedModalBattery, setUnverifiedModalBattery] = useState(null);

  // "Scan Next Battery" from the repair panel lands here with ?autoScan=1 so
  // the camera is already open — same as the mobile Service tab's autoScan.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('autoScan')) {
      setCameraOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // QrScanner keeps decoding the same code frame after frame; without this
  // lock one physical scan would fire several lookups and navigations.
  const scanInFlightRef = useRef(false);

  async function goToBattery(raw) {
    const code = extractBatteryCode(raw);
    if (!code) return;
    if (scanInFlightRef.current) return;
    scanInFlightRef.current = true;
    setSuggestions([]);
    setShowSuggestions(false);
    setCheckingScan(true);

    try {
      const { data } = await apiClient.get(`/batteries/${encodeURIComponent(code)}`);
      const b = data.battery;
      if (isIntakeUnverified(b)) {
        setCameraOpen(false);
        setUnverifiedModalBattery(b);
        return;
      }
    } catch {
      // If lookup fails or battery does not exist, let detail page handle it
    } finally {
      setCheckingScan(false);
      scanInFlightRef.current = false;
    }

    setCameraOpen(false);
    navigate(`/batteries/${encodeURIComponent(code)}?fromScan=true`);
  }

  function handleManualKeyDown(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    goToBattery(manualCode);
    setManualCode('');
  }

  return (
    <div className="flex min-h-[75vh] flex-col items-center justify-center px-4 py-8 text-center">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#059669"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-8 w-8"
        >
          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
          <circle cx="12" cy="13" r="3" />
        </svg>
      </div>

      <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Scan a Battery to Begin</h1>
      <p className="mt-2 max-w-xs text-center text-sm text-slate-500 dark:text-neutral-400">
        Scan the QR code on a battery to start work, log the parts you changed, and mark it complete.
      </p>

      <div className="mt-6 flex w-full max-w-xs flex-col items-center gap-3">
        {cameraOpen ? (
          <div className="w-full">
            <QrScanner onScan={goToBattery} onClose={() => setCameraOpen(false)} />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            disabled={checkingScan}
            className="w-full rounded-md bg-blue-600 px-4 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors"
          >
            {checkingScan ? 'Checking Battery…' : 'Scan with Camera'}
          </button>
        )}

        <div className="flex w-full items-center gap-2 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200 dark:bg-neutral-800" />
          or search by code
          <div className="h-px flex-1 bg-slate-200 dark:bg-neutral-800" />
        </div>

        <div className="relative w-full">
          <input
            ref={inputRef}
            type="text"
            value={manualCode}
            onChange={(e) => {
              setManualCode(e.target.value);
              setShowSuggestions(true);
            }}
            onKeyDown={handleManualKeyDown}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="Type battery code"
            autoCapitalize="characters"
            autoComplete="off"
            className="w-full rounded-md border border-blue-200 bg-blue-50 px-3.5 py-3 text-center text-base font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-blue-900/40 dark:bg-surface-900 dark:text-white dark:placeholder:text-neutral-500"
          />

          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-md border border-blue-200 bg-white shadow-xl dark:border-surface-700 dark:bg-surface-900 divide-y divide-slate-100 dark:divide-white/5">
              {suggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => goToBattery(item.battery_code)}
                  className="flex w-full items-center justify-between px-3.5 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-surface-800"
                >
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    {item.battery_code}
                  </span>
                  <StatusBadge status={item.status} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Unverified Intake Modal ── */}
      {unverifiedModalBattery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl border border-amber-200 bg-white p-6 shadow-2xl dark:border-amber-900/60 dark:bg-surface-900 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 border border-amber-300 text-amber-700 text-2xl dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-400">
              ⚠️
            </div>

            <div className="mb-2 flex items-center justify-center">
              <span className="rounded-full bg-amber-100 border border-amber-300 px-3 py-1 text-[11px] font-bold text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                Intake Not Verified
              </span>
            </div>

            <h3 className="mb-1 text-lg font-bold text-slate-900 dark:text-white">
              Battery Not Verified at Intake
            </h3>

            <p className="mb-4 text-xs text-slate-500 dark:text-neutral-400 leading-relaxed">
              This battery has not been verified at intake yet. Work or testing cannot begin until the workshop verifies the truck shipment arrival.
            </p>

            {/* Battery & Truck details card */}
            <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-left dark:border-amber-900/40 dark:bg-surface-950 space-y-2">
              <div className="flex items-center justify-between text-xs pb-1.5 border-b border-amber-200/60 dark:border-neutral-800">
                <span className="text-slate-500 dark:text-neutral-400 font-medium">Battery ID</span>
                <span className="font-mono font-bold text-amber-800 dark:text-amber-300">
                  {unverifiedModalBattery.battery_code}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pb-1.5 border-b border-amber-200/60 dark:border-neutral-800">
                <span className="text-slate-500 dark:text-neutral-400 font-medium">Truck Number</span>
                <span className="font-semibold text-slate-800 dark:text-white">
                  {unverifiedModalBattery.intake_truck_number ? `Truck #${unverifiedModalBattery.intake_truck_number}` : 'N/A'}
                </span>
              </div>
              {unverifiedModalBattery.intake_driver_name && (
                <div className="flex items-center justify-between text-xs pb-1.5 border-b border-amber-200/60 dark:border-neutral-800">
                  <span className="text-slate-500 dark:text-neutral-400 font-medium">Driver</span>
                  <span className="font-medium text-slate-700 dark:text-neutral-300">
                    {unverifiedModalBattery.intake_driver_name}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-neutral-400 font-medium">Shipment Status</span>
                <span className="font-bold text-amber-700 dark:text-amber-400">
                  Pending Arrival Verification
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setUnverifiedModalBattery(null);
                  setManualCode('');
                  setCameraOpen(true);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition-colors"
              >
                <span>📷 Scan Another Battery</span>
              </button>
              {unverifiedModalBattery.truck_intake_id && (
                <button
                  type="button"
                  onClick={() => {
                    navigate(`/truck-intakes/${unverifiedModalBattery.truck_intake_id}`);
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 py-2.5 text-xs font-bold text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 transition-colors"
                >
                  <span>Go to Truck Intake Shipment</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const code = unverifiedModalBattery.battery_code;
                  setUnverifiedModalBattery(null);
                  navigate(`/batteries/${encodeURIComponent(code)}`);
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-100 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-300 transition-colors"
              >
                View Battery Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TechnicianHomePage;
