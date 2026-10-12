import extractBatteryCode from './extract-battery-code';
import apiClient from '../services/api-client';

// Scanners feed every intake/return/sort/verify form the same way: a QR
// link, a typed battery code, or — with an RFID reader — the raw tag ID.
// These helpers make a form accept all three and refuse a tag that nobody
// has assigned yet (so an unregistered tag can never be packed, sorted,
// received or dispatched by mistake).
// Kept identical to frontend/src/utils/scan-input.js.

// Readers may put a symbology id (]Q1, ]C0…) or a label (EPC:, TID:) in
// front of the tag — not part of the tag (same rule as the backend's
// normalizeTag).
export function cleanScanText(value) {
  return String(value ?? '')
    .trim()
    .replace(/^\][A-Za-z][0-9A-Za-z]/, '')
    .replace(/^(?:epc|tid|uii|tag|rfid)\s*[:=#]\s*/i, '');
}

export function normalizeRfidTag(value) {
  return cleanScanText(value).replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

// A tag ID is a run of letters/digits at least 8 long. Battery codes are
// PREFIX-NNNNNNN and serials are short and mixed, so those never count. Long
// reads (16+, e.g. a 24-hex EPC) may arrive grouped with spaces, colons or
// hyphens and still count.
export function isLikelyRfidTag(value) {
  const v = cleanScanText(value);
  const clean = v.replace(/[^0-9A-Za-z]/g, '');
  if (clean.length < 8) return false;
  if (/^[A-Za-z]{1,6}-\d+$/.test(v)) return false; // a battery code
  if (clean.length >= 16) return /^[0-9A-Za-z][0-9A-Za-z\s:.-]*$/.test(v);
  return !/-/.test(v) && /^[0-9A-Za-z]+$/.test(v) && !/^[A-Za-z]{2,4}\d+$/.test(clean);
}

const isHex = (s) => /^[0-9A-F]+$/.test(s);

// A UHF EPC is 96 bits = 24 hex characters. A reader in keyboard mode with no
// separator types back-to-back tags as one long run (48, 72… hex), which
// would never match — cut such a run back into its 24-character tags.
const EPC_HEX_LENGTH = 24;
function splitJoinedTags(value) {
  const clean = normalizeRfidTag(value);
  if (clean.length >= EPC_HEX_LENGTH * 2 && clean.length % EPC_HEX_LENGTH === 0 && isHex(clean)) {
    const out = [];
    for (let i = 0; i < clean.length; i += EPC_HEX_LENGTH) out.push(clean.slice(i, i + EPC_HEX_LENGTH));
    return out;
  }
  return [value];
}

// One trigger pull / keystroke burst can carry several tags separated by
// newlines, tabs, commas or spaces — or none at all. Split only when every
// piece is a tag — "EPC: E280…" or an EPC grouped in 4s stays one value.
// Repeats of the same tag in one burst are dropped.
export function splitScanInput(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return [];
  const parts = text.split(/[\s,;]+/).map((p) => p.trim()).filter(Boolean);
  const pieces = parts.length > 1 && parts.every((p) => isLikelyRfidTag(p) && normalizeRfidTag(p).length >= 8) ? parts : [text];
  const out = pieces.flatMap((p) => splitJoinedTags(p));
  const seen = new Set();
  return out.filter((p) => {
    const key = isLikelyRfidTag(p) ? normalizeRfidTag(p) : p;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Same tag? Exact match, or — for long reads — one containing the other
// (PC bits in front of an EPC, a CRC after it, a longer read of the chip).
export function tagsMatch(stored, read) {
  const a = normalizeRfidTag(stored);
  const b = normalizeRfidTag(read);
  if (!a || !b) return false;
  if (a === b) return true;
  return a.length >= 16 && b.length >= 16 && (a.includes(b) || b.includes(a));
}

export const UNASSIGNED_TAG_MESSAGE =
  'This RFID tag is not assigned to any battery yet. Assign it on the RFID Assignment page first.';

// Unregistered tags are ignored without any popup or message: an RFID
// reader picks up every tag in range, and only tags assigned to a battery
// matter. Scan handlers return a result with this message; the scan box
// drops it silently.
export function isUnassignedTagMessage(message) {
  return /not assigned to any battery/i.test(String(message || ''));
}

// Resolves a scanned/typed value against a list of battery rows (which carry
// rfid_tag). Returns { code, battery, unassignedTag }:
//   - a QR link, code or serial → that code (battery if it's in the list)
//   - a tag that matches a row's rfid_tag → that row's battery_code
//   - a tag-looking value with no match in THIS list → unassignedTag: true
//     (code is the cleaned tag). The list is only what the page holds — use
//     resolveBatteryScan to check the server before ignoring a tag.
export function resolveBatteryInput(raw, batteries = []) {
  const extracted = cleanScanText(extractBatteryCode(String(raw ?? '')) || raw || '');
  if (!extracted) return { code: '', battery: null, unassignedTag: false };
  const upper = extracted.toUpperCase();
  const byCode = batteries.find((b) => (b.battery_code || b.code || '').toUpperCase() === upper);
  if (byCode) return { code: byCode.battery_code || byCode.code, battery: byCode, unassignedTag: false };
  const bySerial = batteries.find((b) => b.serial_number && String(b.serial_number).toUpperCase() === upper);
  if (bySerial) return { code: bySerial.battery_code || bySerial.code, battery: bySerial, unassignedTag: false };
  if (isLikelyRfidTag(extracted)) {
    const tag = normalizeRfidTag(extracted);
    const hits = batteries.filter((b) => b.rfid_tag && tagsMatch(b.rfid_tag, tag));
    const byTag = hits.find((b) => normalizeRfidTag(b.rfid_tag) === tag) || (hits.length === 1 ? hits[0] : null);
    if (byTag) return { code: byTag.battery_code || byTag.code, battery: byTag, unassignedTag: false };
    return { code: tag, battery: null, unassignedTag: true };
  }
  return { code: upper, battery: null, unassignedTag: false };
}

// Server answers are kept briefly: a reader repeats the same tags (including
// unassigned neighbours) many times a second.
// "Unassigned" is kept only a few seconds, and the RFID assignment screens
// clear the cache after saving, so a tag assigned a moment ago is never
// ignored.
const tagCache = new Map(); // tag → { at, code }
const TAG_CACHE_MS = 15000;
const UNASSIGNED_CACHE_MS = 4000;

export function clearTagCache() {
  tagCache.clear();
}

async function lookupTagOnServer(tag) {
  const cached = tagCache.get(tag);
  if (cached && Date.now() - cached.at < (cached.code ? TAG_CACHE_MS : UNASSIGNED_CACHE_MS)) return cached.code;
  try {
    const { data } = await apiClient.get(`/batteries/resolve-tag/${encodeURIComponent(tag)}`);
    const code = data?.battery_code || null;
    tagCache.set(tag, { at: Date.now(), code });
    return code;
  } catch (err) {
    if (err?.response?.status === 404) {
      tagCache.set(tag, { at: Date.now(), code: null });
      return null;
    }
    return undefined; // offline / server error: unknown
  }
}

// resolveBatteryInput + a server check for a tag the page's list doesn't
// have. An assigned tag whose battery isn't in the list (another status, not
// on this shipment…) comes back as that battery's code, so the page shows its
// normal reason instead of silently ignoring it. Only a tag the server says
// is unassigned stays unassignedTag. If the server can't be reached the value
// is passed on as a code, so the page reports a problem rather than dropping it.
export async function resolveBatteryScan(raw, batteries = []) {
  const local = resolveBatteryInput(raw, batteries);
  if (!local.unassignedTag) return local;
  const code = await lookupTagOnServer(local.code);
  if (code) {
    const battery = batteries.find((b) => (b.battery_code || b.code || '').toUpperCase() === code.toUpperCase()) || null;
    return { code, battery, unassignedTag: false };
  }
  if (code === null && (isHex(local.code) || local.code.length >= 16)) return local;
  return { ...local, unassignedTag: false };
}

// For a scan box's onSubmit: resolves the read (server check included), drops
// a truly unassigned tag quietly, and hands the page's own handler a plain
// battery code — so handlers stay synchronous and also work for taps.
export async function scanThen(raw, batteries, handler) {
  const resolved = await resolveBatteryScan(raw, batteries);
  if (resolved.unassignedTag) return { ignore: true };
  return handler(resolved.code || raw);
}

// For synchronous handlers that just dropped a tag as unassigned (their own
// list didn't have it): checks the server in the background and, if the tag
// does belong to a battery, runs the handler again with that battery's code.
export function recheckUnassignedTag(raw, batteries, retry) {
  resolveBatteryScan(raw, batteries).then((r) => {
    if (!r.unassignedTag && r.code && !isLikelyRfidTag(r.code)) retry(r.code);
  });
}
