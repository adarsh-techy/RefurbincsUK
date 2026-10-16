import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import apiClient from '../../../services/api-client';
import QrScanner from '../../../components/ui/primitives/QrScanner';
import { isLikelyRfidTag } from '../../../utils/scan-input';
import extractBatteryCode from '../../../utils/extract-battery-code';
import { StatusBadge } from '../../../components/ui/primitives/Badge';
import { canTestBatteries, isIntakeUnverified } from '../../../utils/permissions';
import { FiCamera, FiSearch, FiArrowRight, FiCpu, FiX } from 'react-icons/fi';

const SUGGESTION_LIMIT = 20;
const DEBOUNCE_MS = 250;

// A technician's entry point to start work: scan a battery's QR code (with
// the device camera, or a handheld scanner gun typing into the input below)
// and jump straight to its /batteries/:code page. That page validates the
// code itself and shows its own error if nothing matches.
function TechnicianHomePage() {
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const [liveStaffRole, setLiveStaffRole] = useState(user?.staff_role || user?.staffRole || null);

  useEffect(() => {
    let cancelled = false;
    if (user && user.role !== 'client' && user.role !== 'recycle_client') {
      apiClient
        .get('/auth/me')
        .then((res) => {
          if (!cancelled && res.data?.user?.staff_role) {
            setLiveStaffRole(res.data.user.staff_role);
          }
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [user]);

  const effectiveUser = {
    ...user,
    staff_role: liveStaffRole || user?.staff_role,
  };
  const canTest = canTestBatteries(effectiveUser);
  // /truck-intakes is an admin page (see AppRoutes): a technician following
  // this link was bounced straight back to "/".
  const canOpenIntake = user?.role === 'super_admin' || user?.role === 'admin';

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

    let openCode = code;
    try {
      const { data } = await apiClient.get(`/batteries/${encodeURIComponent(code)}`);
      const b = data.battery;
      openCode = b?.battery_code || code; // a scanned tag opens its battery
      if (isIntakeUnverified(b)) {
        setCameraOpen(false);
        setUnverifiedModalBattery(b);
        setCheckingScan(false);
        scanInFlightRef.current = false; // staying on this page — accept new scans
        return;
      }
    } catch (err) {
      // an RFID tag that isn't assigned to any battery is ignored quietly;
      // anything else goes on to the detail page, which shows the error
      if (err?.response?.status === 404 && isLikelyRfidTag(code)) {
        setCheckingScan(false);
        scanInFlightRef.current = false;
        return;
      }
    }

    // Navigating away: keep the lock held so a late decode from the same QR
    // frame burst can't push a second /batteries/:code entry before unmount.
    setCheckingScan(false);
    setCameraOpen(false);
    navigate(`/batteries/${encodeURIComponent(openCode)}?fromScan=true`);
  }

  function handleManualKeyDown(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    goToBattery(manualCode);
    setManualCode('');
  }

  const roleName = effectiveUser?.staff_role === 'supervisor' ? 'Supervisor' : 'Technician';

  return (
    <div className="min-h-[calc(100dvh-4rem)] flex flex-col items-center justify-center px-4 py-6 bg-slate-50/60 dark:bg-surface-950">
      <div className="w-full max-w-sm sm:max-w-md mx-auto my-auto">
        {/* ── Main Scan Hero Card ── */}
        <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm dark:border-white/10 dark:bg-surface-900 text-center">
          {/* Emblem Icon */}
          <div className="mx-auto mb-4 flex h-16 w-16 sm:h-18 sm:w-18 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-400">
            <FiCamera className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Scan a Battery to Begin
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-slate-500 dark:text-neutral-400 max-w-xs mx-auto leading-relaxed">
            Scan the QR code on a battery, tap an RFID reader, or enter the ID below to start work.
          </p>

          <div className="mt-6 flex flex-col items-center gap-3 w-full">
            {cameraOpen ? (
              <div className="w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
                <QrScanner onScan={goToBattery} onClose={() => setCameraOpen(false)} />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCameraOpen(true)}
                disabled={checkingScan}
                className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-semibold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                <FiCamera className="h-5 w-5" />
                <span>{checkingScan ? 'Checking Battery…' : 'Scan with Camera'}</span>
              </button>
            )}

            <div className="flex w-full items-center gap-3 text-xs font-medium text-slate-400 dark:text-neutral-500 my-2">
              <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
              <span>or search by code</span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
            </div>

            {/* Manual input & Quick submit */}
            <div className="relative w-full text-left">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <FiSearch className="h-4 w-4" />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={manualCode}
                onChange={(e) => {
                  setManualCode(e.target.value.toUpperCase());
                  setShowSuggestions(true);
                }}
                onKeyDown={handleManualKeyDown}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="Type battery code"
                autoCapitalize="characters"
                autoComplete="off"
                className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50/70 pl-11 pr-20 text-left text-xs sm:text-sm font-semibold tracking-wide text-slate-900 placeholder:text-left placeholder:normal-case placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-surface-700 dark:bg-surface-800 dark:text-white dark:placeholder:text-neutral-500 transition-all uppercase"
              />
              {manualCode.trim() && (
                <button
                  type="button"
                  onClick={() => setManualCode('')}
                  className="absolute right-12 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 cursor-pointer"
                >
                  <FiX className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (manualCode.trim()) {
                    goToBattery(manualCode);
                    setManualCode('');
                  }
                }}
                disabled={!manualCode.trim()}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-30 disabled:hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
              >
                <span>Go</span>
                <FiArrowRight className="h-3.5 w-3.5" />
              </button>

              {/* Suggestions Dropdown (Longer & Richer) */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 z-30 mt-1.5 max-h-80 sm:max-h-96 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-white/10 dark:bg-surface-900 divide-y divide-slate-100 dark:divide-white/5">
                  {suggestions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => goToBattery(item.battery_code)}
                      className="flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-left transition-colors hover:bg-emerald-50/60 dark:hover:bg-surface-800 cursor-pointer"
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="text-xs sm:text-sm font-bold tracking-wide text-slate-900 dark:text-white">
                          {item.battery_code}
                        </span>
                        {item.client_name ? (
                          <span className="text-[11px] text-slate-400 dark:text-neutral-400 truncate">
                            {item.client_name}
                          </span>
                        ) : null}
                      </div>
                      <StatusBadge status={item.status} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Handheld & RFID hardware scan hint */}
            <div className="mt-1 flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-400 dark:text-neutral-500">
              <FiCpu className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Handheld scanners &amp; RFID readers type directly</span>
            </div>
          </div>
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
              {unverifiedModalBattery.truck_intake_id && canOpenIntake && (
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
