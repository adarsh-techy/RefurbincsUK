import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import apiClient from '../../../services/api-client';
import QrScanner from '../../../components/ui/primitives/QrScanner';
import extractBatteryCode from '../../../utils/extract-battery-code';
import { StatusBadge } from '../../../components/ui/primitives/Badge';
import { canTestBatteries } from '../../../utils/permissions';

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

  function goToBattery(raw) {
    const code = extractBatteryCode(raw);
    if (!code) return;
    setCameraOpen(false);
    setSuggestions([]);
    setShowSuggestions(false);
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
            className="w-full rounded-md bg-blue-600 px-4 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 transition-colors"
          >
            Scan with Camera
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
    </div>
  );
}

export default TechnicianHomePage;
