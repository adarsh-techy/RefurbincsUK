import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../../services/api-client';
import { socket } from '../../../services/socket-client';
import Modal from '../../ui/overlays/Modal';

const THRESHOLD = 100;
const ACK_STORAGE_KEY = 'unserviceableAckCount';

// Pops up once the unserviceable-battery count reaches 100, same spirit as
// LowStockAlert: "OK, Noted" silences it for that exact count — stored in
// localStorage so it survives a refresh — until the count changes again
// (climbs further, or drops back under 100 and later re-crosses).
function UnserviceableBatteriesAlert() {
  const navigate = useNavigate();
  const [count, setCount] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    function applyCount(value) {
      if (cancelled) return;
      setCount(value);

      if (value < THRESHOLD) {
        localStorage.removeItem(ACK_STORAGE_KEY);
        setVisible(false);
        return;
      }

      const ackedCount = localStorage.getItem(ACK_STORAGE_KEY) || '';
      setVisible(String(value) !== ackedCount);
    }

    async function checkCount() {
      try {
        const { data } = await apiClient.get('/batteries/unserviceable-count');
        applyCount(data.count);
      } catch {
        // Skip this check; the next socket push or reconnect will retry.
      }
    }

    checkCount();
    socket.on('connect', checkCount);
    socket.on('batteries:unserviceable-count', applyCount);
    return () => {
      cancelled = true;
      socket.off('connect', checkCount);
      socket.off('batteries:unserviceable-count', applyCount);
    };
  }, []);

  function handleAcknowledge() {
    localStorage.setItem(ACK_STORAGE_KEY, String(count));
    setVisible(false);
  }

  function goToPage() {
    setVisible(false);
    navigate('/batteries/unserviceable');
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
      Unserviceable Batteries Alert
    </span>
  );

  return (
    <Modal
      title={title}
      description={`${count} batteries have been marked unserviceable — review them when you get a chance.`}
      onClose={() => setVisible(false)}
    >
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-surface-700">
        <button
          type="button"
          onClick={goToPage}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-200 dark:bg-white/5 dark:text-neutral-200 dark:hover:bg-white/10"
        >
          View Unserviceable
        </button>
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

export default UnserviceableBatteriesAlert;
