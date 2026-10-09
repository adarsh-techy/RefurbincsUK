import { useEffect, useRef, useState } from 'react';

// "Scan RFID tag" button for any scan box. An RFID reader in keyboard mode
// types the tag ID into whichever field has the cursor and presses Enter, so
// the button's whole job is to put the cursor in the right box and show that
// the page is waiting for a tag. `target` is the data-rfid-scan value on the
// input it controls.
function RfidScanButton({ target, className = '' }) {
  const [waiting, setWaiting] = useState(false);
  const timer = useRef(null);

  function findInput() {
    return document.querySelector(`[data-rfid-scan="${target}"]`);
  }

  function start() {
    const input = findInput();
    if (!input) return;
    input.focus();
    input.select?.();
    setWaiting(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setWaiting(false), 8000);
  }

  // stop "waiting" as soon as something arrives in the box or it loses focus
  useEffect(() => {
    if (!waiting) return undefined;
    const input = findInput();
    if (!input) return undefined;
    const done = () => { setWaiting(false); clearTimeout(timer.current); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(); });
    input.addEventListener('blur', done);
    return () => {
      input.removeEventListener('blur', done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className={`mt-1.5 flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={start}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors ${
          waiting
            ? 'border-violet-400 bg-violet-600 text-white'
            : 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-800/50 dark:bg-violet-950/40 dark:text-violet-300'
        }`}
        title="Puts the cursor in the box so your RFID reader can type the tag"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-3.5 w-3.5 ${waiting ? 'animate-pulse' : ''}`}>
          <path d="M4.9 19.1a10 10 0 0 1 0-14.2" /><path d="M7.8 16.2a6 6 0 0 1 0-8.4" /><circle cx="12" cy="12" r="2" /><path d="M16.2 7.8a6 6 0 0 1 0 8.4" /><path d="M19.1 4.9a10 10 0 0 1 0 14.2" />
        </svg>
        {waiting ? 'Waiting for tag… tap it on the reader' : 'Scan RFID tag'}
      </button>
      {!waiting && (
        <span className="text-[11px] text-slate-400 dark:text-neutral-500">QR, battery code or RFID tag all work here</span>
      )}
    </div>
  );
}

export default RfidScanButton;
