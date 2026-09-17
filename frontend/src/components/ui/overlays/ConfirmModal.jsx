import { useState } from 'react';
import Modal from './Modal';

// A destructive-action confirmation, styled consistently with the rest of
// the app instead of the browser's native window.confirm. With
// requireTyping (the default), the button stays disabled until the user
// types a confirm word — set it to false for a plain one-click Cancel/
// Confirm pair when that extra friction isn't wanted.
function ConfirmModal({
  title = 'Confirm Deletion',
  message,
  confirmWord = 'yes',
  confirmLabel = 'Delete',
  requireTyping = true,
  onConfirm,
  onCancel,
}) {
  const [typed, setTyped] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isMatch = !requireTyping || typed.trim().toLowerCase() === confirmWord.toLowerCase();

  async function handleConfirm() {
    if (!isMatch || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={title} onClose={onCancel}>
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-critical-100 dark:bg-red-500/15">
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
          <p className="pt-1.5 text-sm text-slate-600 dark:text-neutral-300">{message}</p>
        </div>

        {requireTyping && (
          <div>
            <label htmlFor="confirm-word" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-neutral-200">
              Type <span className="font-semibold text-critical-600 dark:text-red-400">{confirmWord}</span> to
              confirm
            </label>
            <input
              id="confirm-word"
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={confirmWord}
              autoComplete="off"
              autoFocus
              className="w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-critical-500 focus:outline-none focus:ring-2 focus:ring-critical-500/30 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-100 dark:focus:border-red-500 dark:focus:ring-red-500/30"
            />
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-surface-700">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-surface-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isMatch || submitting}
            className="rounded-md bg-critical-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-critical-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-red-600 dark:hover:bg-red-500"
          >
            {submitting ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default ConfirmModal;
