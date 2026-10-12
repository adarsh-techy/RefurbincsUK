import { useRef } from 'react';
import { normalizeRfidTag } from './scan-input';

// In keyboard (HID / DataWedge keystroke) mode the RFID reader types into
// whichever field has the cursor. Wrap a form field's onChangeText with this
// so a tag typed there at reader speed is taken back out of the field and
// handed to the scan box instead (onTag). People type far slower than a
// reader, and tags are hex, so normal typing is untouched.
const GAP_MS = 45;
const MIN_LENGTH = 12;
const SETTLE_MS = 230;

export function useReaderGuard(value, setValue, onTag) {
  const run = useRef(null); // { before, text, last, captured, timer }
  const latest = useRef({ value, setValue, onTag });
  latest.current = { value, setValue, onTag };

  return (next) => {
    const { value: prev, setValue: set } = latest.current;
    const now = Date.now();
    const appended = typeof next === 'string' && next.startsWith(prev) ? next.slice(prev.length) : null;
    if (!appended) {
      run.current = null;
      set(next);
      return;
    }
    let r = run.current;
    if (!r || now - r.last > GAP_MS) r = { before: prev, text: '', last: now, captured: false };
    r.text += appended;
    r.last = now;
    run.current = r;
    const clean = normalizeRfidTag(r.text);
    if (!r.captured && !(clean.length >= MIN_LENGTH && /^[0-9A-F]+$/.test(clean) && r.text.length > 1)) {
      set(next);
      return;
    }
    r.captured = true;
    set(r.before); // the field keeps what the person typed
    clearTimeout(r.timer);
    r.timer = setTimeout(() => {
      if (run.current === r) run.current = null;
      latest.current.onTag?.(r.text);
    }, SETTLE_MS);
  };
}
