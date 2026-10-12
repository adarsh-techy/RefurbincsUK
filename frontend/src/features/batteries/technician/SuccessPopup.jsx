import { useEffect, useRef } from 'react';

// Small confirmation shown after a workshop action succeeds (start work,
// start testing, password change…). autoCloseMs: closes by itself for steps
// in the middle of a flow, so the technician isn't slowed down.
function SuccessPopup({ open, title, message, onClose, autoCloseMs = 0 }) {
  // the latest onClose, without restarting the countdown: the repair timer
  // re-renders the page every second
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open || !autoCloseMs) return undefined;
    const t = setTimeout(() => closeRef.current?.(), autoCloseMs);
    return () => clearTimeout(t);
  }, [open, autoCloseMs]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-xs rounded-3xl border border-emerald-200 bg-white p-6 text-center shadow-2xl dark:border-emerald-900/60 dark:bg-surface-900 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-live="polite"
      >
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-2xl text-emerald-600 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-400">
          ✓
        </div>
        <h3 className="mb-1 text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
        {message && <p className="mb-4 text-xs leading-relaxed text-slate-500 dark:text-neutral-400">{message}</p>}
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
        >
          OK
        </button>
      </div>
    </div>
  );
}

export default SuccessPopup;
