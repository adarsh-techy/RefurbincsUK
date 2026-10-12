import { isLikelyRfidTag, normalizeRfidTag, splitScanInput } from './scan-input';

// RFID readers in keyboard mode type the tag into the focused scan box. Most
// end it with Enter, which the pages already handle. Some send no Enter (or
// a space between tags), and those tags would just sit in the box. For any
// input marked data-rfid-scan, a burst typed at reader speed that then goes
// quiet is submitted as if Enter had been pressed — one tag at a time. A
// person typing is far slower than this, so manual typing is untouched.

const QUIET_MS = 700;
const READER_GAP_MS = 90; // average gap between keystrokes of a reader burst (people type slower)
const MIN_TAG_LENGTH = 8;
// UHF EPC-96 tags are 24 hex characters: a run typed with no separator is cut
// into complete tags as it grows, so the box never holds two tag numbers.
const EPC_TAG_LENGTH = 24;

const REPEAT_READ_MS = 2500; // the same tag again this soon is a repeated read

const state = new WeakMap(); // input → { timer, first, last, count }
const recent = new WeakMap(); // input → Map(tag → time last taken)
const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;

function pressEnter(input) {
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
}

function setValue(input, value) {
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function flush(input) {
  const s = state.get(input);
  state.delete(input);
  if (!s || !input.isConnected) return;
  const typedFast = s.count > 1 && (s.last - s.first) / (s.count - 1) <= READER_GAP_MS;
  const value = input.value || '';
  if (!typedFast || normalizeRfidTag(value).length < MIN_TAG_LENGTH) return;
  const pieces = splitScanInput(value);
  if (!pieces.every((p) => isLikelyRfidTag(p))) return;
  feed(input, pieces);
}

// Hands the page one tag at a time (box filled with that tag, then Enter),
// letting it update between tags; repeated reads of a tag just taken are
// dropped and the box is cleared.
function feed(input, pieces) {
  const seen = recent.get(input) || new Map();
  recent.set(input, seen);
  const now = Date.now();
  const fresh = pieces.filter((p) => {
    const key = normalizeRfidTag(p);
    if (now - (seen.get(key) || 0) < REPEAT_READ_MS) return false;
    seen.set(key, now);
    return true;
  });
  if (!fresh.length) {
    setValue(input, '');
    return;
  }
  fresh.forEach((piece, i) => {
    setTimeout(() => {
      if (!input.isConnected) return;
      setValue(input, piece);
      pressEnter(input);
    }, i * 120);
  });
}

// Hands complete tags to the page right away, one at a time (box = that tag,
// then Enter), and leaves only the tag still arriving in the box.
function takeCompleteTags(input) {
  const clean = normalizeRfidTag(input.value || '');
  if (clean.length <= EPC_TAG_LENGTH || !/^[0-9A-F]+$/.test(clean)) return false;
  const pieces = [];
  let rest = clean;
  while (rest.length > EPC_TAG_LENGTH) {
    pieces.push(rest.slice(0, EPC_TAG_LENGTH));
    rest = rest.slice(EPC_TAG_LENGTH);
  }
  const seen = recent.get(input) || new Map();
  recent.set(input, seen);
  const now = Date.now();
  for (const piece of pieces) {
    if (now - (seen.get(piece) || 0) < REPEAT_READ_MS) continue; // repeated read
    seen.set(piece, now);
    setValue(input, piece);
    pressEnter(input);
  }
  setValue(input, rest);
  return true;
}

// ── Reads that land in the wrong field ──────────────────────────────────
// The reader types into whichever field has the cursor. On a page with a scan
// box, a burst of hex typed at reader speed into another field (truck number,
// driver name…) is a tag, not text: the field is put back the way it was and
// the tag goes to the scan box.
const STRAY_GAP_MS = 45; // people type slower than this between keys
const STRAY_MIN_LENGTH = 12;
const stray = new WeakMap(); // field → { before, text, last, captured, timer }

function scanBoxFor(field) {
  const scope = field.closest('form, [role="dialog"], .fixed') || document;
  const box = scope.querySelector('[data-rfid-scan]') || document.querySelector('[data-rfid-scan]');
  return box && box !== field ? box : null;
}

function onStrayInput(field, e) {
  const box = scanBoxFor(field);
  if (!box) return;
  const now = Date.now();
  const typed = e.inputType === 'insertText' || e.inputType === 'insertFromPaste' ? e.data || '' : '';
  let run = stray.get(field);
  if (!typed) {
    stray.delete(field);
    return;
  }
  if (!run || now - run.last > STRAY_GAP_MS) {
    run = { before: field.value.slice(0, Math.max(0, field.value.length - typed.length)), text: '', last: now, captured: false };
  }
  run.text += typed;
  run.last = now;
  stray.set(field, run);
  const clean = normalizeRfidTag(run.text);
  if (!run.captured && !(clean.length >= STRAY_MIN_LENGTH && /^[0-9A-F]+$/.test(clean) && run.text.length > 1)) return;
  run.captured = true;
  setValue(field, run.before); // give the field its text back
  clearTimeout(run.timer);
  run.timer = setTimeout(() => {
    stray.delete(field);
    if (box.disabled || !box.isConnected) return;
    box.focus();
    feed(box, splitScanInput(run.text));
  }, QUIET_MS / 3);
}

function onInput(e) {
  const input = e.target;
  if (!e.isTrusted) return;
  if (input instanceof HTMLInputElement && !input.matches('[data-rfid-scan]') && /^(text|search|tel|)$/.test(input.type)) {
    onStrayInput(input, e);
    return;
  }
  if (!(input instanceof HTMLInputElement) || !input.matches('[data-rfid-scan]')) return;
  if (takeCompleteTags(input)) return;
  const now = Date.now();
  const s = state.get(input) || { first: now, count: 0 };
  clearTimeout(s.timer);
  s.count += 1;
  s.last = now;
  s.timer = setTimeout(() => flush(input), QUIET_MS);
  state.set(input, s);
}

// A real Enter ends the burst: the page handles it, nothing to do later.
// A real Enter ends the burst. Usually the page handles it; but when the box
// holds several tags typed back to back (no separator) or a tag just taken,
// the Enter is taken over and the tags are handed over one by one instead.
function onKeyDown(e) {
  if (e.key !== 'Enter' || !e.isTrusted) return;
  const input = e.target;
  const s = state.get(input);
  if (s) {
    clearTimeout(s.timer);
    state.delete(input);
  }
  if (!(input instanceof HTMLInputElement) || !input.matches('[data-rfid-scan]')) return;
  const pieces = splitScanInput(input.value || '');
  if (!pieces.length || !pieces.every((p) => isLikelyRfidTag(p))) return;
  const seen = recent.get(input);
  const repeated = pieces.length === 1 && seen && Date.now() - (seen.get(normalizeRfidTag(pieces[0])) || 0) < REPEAT_READ_MS;
  if (pieces.length === 1 && !repeated) {
    (seen || recent.set(input, new Map()).get(input)).set(normalizeRfidTag(pieces[0]), Date.now());
    return; // one fresh tag: the page's own Enter handling takes it
  }
  e.preventDefault();
  e.stopPropagation();
  feed(input, pieces);
}

let installed = false;
export function installRfidKeystrokeSupport() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener('input', onInput, true);
  document.addEventListener('keydown', onKeyDown, true);
}
