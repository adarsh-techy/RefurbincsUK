import { useEffect, useState } from 'react';
import apiClient from '../../../services/api-client';
import { socket } from '../../../services/socket-client';
import Modal from '../../ui/overlays/Modal';

const ACK_STORAGE_KEY = 'lowStockAckSignature';

function signatureOf(parts) {
  return parts
    .map((p) => p.id)
    .sort((a, b) => a - b)
    .join(',');
}

// Reminds whoever's logged in about low-stock parts (5 or fewer left).
// Clicking "OK, Noted" silences it for that exact set of parts — stored in
// localStorage so it survives a refresh — until stock changes: a restock
// clears the flag, and a newly-low part changes the set, so either one makes
// the popup reappear even if an old set was acknowledged. Kept live by the
// server pushing a fresh list over the socket whenever stock changes (see
// backend/src/realtime) instead of polling.
function LowStockAlert() {
  const [lowStockParts, setLowStockParts] = useState([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    function applyStock(data) {
      if (cancelled) return;

      const low = data.filter((p) => !p.in_stock);
      if (low.length === 0) {
        localStorage.removeItem(ACK_STORAGE_KEY);
        setLowStockParts([]);
        setVisible(false);
        return;
      }

      const signature = signatureOf(low);
      const ackedSignature = localStorage.getItem(ACK_STORAGE_KEY) || '';
      setLowStockParts(low);
      setVisible(signature !== ackedSignature);
    }

    async function checkStock() {
      try {
        const { data } = await apiClient.get('/parts');
        applyStock(data);
      } catch {
        // Skip this check; the next socket push or reconnect will retry.
      }
    }

    checkStock();
    socket.on('connect', checkStock);
    socket.on('parts:out-of-stock', applyStock);
    return () => {
      cancelled = true;
      socket.off('connect', checkStock);
      socket.off('parts:out-of-stock', applyStock);
    };
  }, []);

  function handleAcknowledge() {
    localStorage.setItem(ACK_STORAGE_KEY, signatureOf(lowStockParts));
    setVisible(false);
  }

  if (!visible) return null;

  const title = (
    <span className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-critical-100 dark:bg-red-500/15">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-5 w-5 text-critical-600 dark:text-red-400"
        >
          <path
            fillRule="evenodd"
            d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
            clipRule="evenodd"
          />
        </svg>
      </span>
      Low Stock Alert
    </span>
  );

  return (
    <Modal
      title={title}
      description={`${lowStockParts.length} part${lowStockParts.length === 1 ? '' : 's'} at 5 units or fewer — restock soon.`}
      onClose={() => setVisible(false)}
    >
      <ul className="mb-5 flex max-h-72 flex-col gap-2.5 overflow-y-auto">
        {lowStockParts.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-3 rounded-lg border border-critical-100 bg-critical-50/60 px-4 py-3 dark:border-red-900/50 dark:bg-red-500/10"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800 dark:text-neutral-100">{p.name}</p>
              {p.sku && <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-neutral-400">{p.sku}</p>}
            </div>
            <span className="shrink-0 rounded-full bg-critical-100 px-3 py-1 text-xs font-semibold text-critical-700 dark:bg-red-500/15 dark:text-red-300">
              {p.quantity} left
            </span>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-surface-700">
        <p className="text-xs text-slate-400 dark:text-neutral-500">You'll be reminded every 10 minutes until noted.</p>
        <button
          type="button"
          onClick={handleAcknowledge}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path
              fillRule="evenodd"
              d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
              clipRule="evenodd"
            />
          </svg>
          OK, Noted
        </button>
      </div>
    </Modal>
  );
}

export default LowStockAlert;
