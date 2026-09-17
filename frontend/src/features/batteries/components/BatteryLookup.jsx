import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../../services/api-client';
import Button from '../../../components/ui/primitives/Button';
import { StatusBadge } from '../../../components/ui/primitives/Badge';

const SUGGESTION_LIMIT = 8;
const DEBOUNCE_MS = 250;

// Spec requirement: typing a battery's unique code shows its full repair
// history. Typing any letters/numbers live-searches matching battery codes
// below the input; picking one (or pressing Enter) opens that battery's
// detail page, which shows the full history.
function BatteryLookup() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);

    if (!code.trim()) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await apiClient.get('/batteries', {
          params: { q: code.trim(), limit: SUGGESTION_LIMIT },
        });
        setSuggestions(data.data);
      } catch {
        setSuggestions([]);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [code]);

  function goToBattery(batteryCode) {
    setShowSuggestions(false);
    navigate(`/batteries/${encodeURIComponent(batteryCode)}`);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!code.trim()) return;
    goToBattery(code.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="relative min-w-[16rem] flex-1 sm:flex-none">
        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-neutral-200">
          Look Up Battery by ID
        </label>
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder="e.g. BAT-12-001"
          autoComplete="off"
          className="w-full rounded-md border border-blue-200 bg-blue-50/60 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-blue-800/40 dark:bg-blue-900/10 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/30 sm:w-64"
        />

        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-surface-700 dark:bg-surface-900 sm:w-64">
            {suggestions.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => goToBattery(b.battery_code)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-brand-50 dark:hover:bg-surface-800"
                >
                  <span className="font-medium text-slate-800 dark:text-neutral-100">{b.battery_code}</span>
                  <StatusBadge status={b.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Button type="submit" variant="darkViolet">View Battery</Button>
    </form>
  );
}

export default BatteryLookup;
