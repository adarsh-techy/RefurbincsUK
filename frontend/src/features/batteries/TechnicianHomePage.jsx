import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../services/api-client';
import QrScanner from '../../components/ui/QrScanner';
import extractBatteryCode from '../../utils/extract-battery-code';
import { StatusBadge } from '../../components/ui/Badge';

const SUGGESTION_LIMIT = 8;
const DEBOUNCE_MS = 250;

// A technician's entry point to start work: scan a battery's QR code (with
// the device camera, or a handheld scanner gun typing into the input below)
// and jump straight to its /batteries/:code page. That page validates the
// code itself and shows its own error if nothing matches.
function TechnicianHomePage() {
  const navigate = useNavigate();
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
        const { data } = await apiClient.get('/batteries', {
          params: { q: manualCode.trim(), limit: SUGGESTION_LIMIT },
        });
        setSuggestions(data.data);
      } catch {
        setSuggestions([]);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [manualCode]);

  function goToBattery(raw) {
    const code = extractBatteryCode(raw);
    if (!code) return;
    setCameraOpen(false);
    setSuggestions([]);
    setShowSuggestions(false);
    navigate(`/batteries/${encodeURIComponent(code)}`);
  }

  function handleManualKeyDown(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    goToBattery(manualCode);
    setManualCode('');
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <span className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/30">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="h-10 w-10 text-emerald-400"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 4.5h4.5v4.5h-4.5v-4.5Zm0 10.5h4.5v4.5h-4.5v-4.5Zm10.5-10.5h4.5v4.5h-4.5v-4.5Zm0 6.75h1.5v1.5h-1.5v-1.5Zm3 0h1.5v1.5h-1.5v-1.5Zm-3 3h1.5v1.5h-1.5v-1.5Zm3 0h1.5v1.5h-1.5v-1.5Zm-3 3h1.5v1.5h-1.5v-1.5Zm3 0h1.5v1.5h-1.5v-1.5Z"
          />
        </svg>
      </span>
      <h1 className="text-lg font-semibold text-slate-900">Scan a Battery to Begin</h1>
      <p className="mt-2 max-w-xs text-sm text-slate-500">
        Scan the QR code on a battery to start work, log the parts you changed, and mark it
        complete.
      </p>

      <div className="mt-6 flex w-full max-w-xs flex-col items-center gap-3">
        {cameraOpen ? (
          <QrScanner onScan={goToBattery} onClose={() => setCameraOpen(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            Scan with Camera
          </button>
        )}

        <div className="flex w-full items-center gap-2 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" />
          or use a handheld scanner
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="relative w-full">
          <input
            ref={inputRef}
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={handleManualKeyDown}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Scan or type battery code, then Enter"
            autoComplete="off"
            className="w-full rounded-md border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-center text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30 dark:border-blue-800/40 dark:bg-surface-900 dark:text-white dark:placeholder:text-neutral-500"
          />

          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-blue-200 bg-white py-1 text-left shadow-lg dark:border-surface-700 dark:bg-surface-900">
              {suggestions.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => goToBattery(b.battery_code)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-blue-50 dark:hover:bg-surface-800"
                  >
                    <span className="font-medium text-slate-900 dark:text-white">{b.battery_code}</span>
                    <StatusBadge status={b.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default TechnicianHomePage;
