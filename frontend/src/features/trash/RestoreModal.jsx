import { useState } from 'react';
import Modal from '../../components/ui/overlays/Modal';
import apiClient from '../../services/api-client';

// Confirm → POST /trash/:id/restore → result. Shared by the Trash list and
// the Trash detail page. onRestored runs after a successful restore once the
// user closes the result (so the list refreshes / the detail page leaves).
function RestoreModal({ item, onClose, onRestored }) {
  const [state, setState] = useState('confirm'); // confirm | working | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleRestore() {
    setState('working');
    setError(null);
    try {
      const res = await apiClient.post(`/trash/${item.id}/restore`);
      setResult(res.data);
      setState('done');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to restore item');
      setState('error');
    }
  }

  function handleClose() {
    if (state === 'working') return;
    if (state === 'done' && onRestored) onRestored(result);
    else onClose();
  }

  return (
    <Modal title={state === 'done' ? 'Item Restored' : 'Restore Item?'} onClose={handleClose}>
      <div className="flex flex-col gap-5">
        {state === 'done' ? (
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
              ✓
            </span>
            <div className="pt-1.5 text-sm text-slate-600 dark:text-neutral-300">
              <p className="font-semibold text-slate-800 dark:text-white">{result?.message || `"${item.title}" was restored.`}</p>
              <p className="mt-1">It has been put back and removed from the trash bin.</p>
              {result?.notes?.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-amber-700 dark:text-amber-400">
                  {result.notes.map((n) => <li key={n}>{n}</li>)}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </span>
            <div className="pt-1.5 text-sm text-slate-600 dark:text-neutral-300">
              <p>
                Put <span className="font-semibold text-slate-800 dark:text-white">"{item.title}"</span> back where it came from?
              </p>
              {item.restore_note && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{item.restore_note}</p>
              )}
              {state === 'error' && (
                <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
                  {error}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-surface-700">
          {state === 'done' ? (
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
            >
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-surface-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRestore}
                disabled={state === 'working'}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {state === 'working' ? 'Restoring…' : state === 'error' ? 'Try Again' : 'Restore'}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default RestoreModal;
