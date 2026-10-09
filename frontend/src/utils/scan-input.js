import extractBatteryCode from './extract-battery-code';

// Scanners feed every intake/return/sort/verify form the same way: a QR
// link, a typed battery code, or — with an RFID reader — the raw tag ID.
// These helpers make a form accept all three and refuse a tag that nobody
// has assigned yet (so an unregistered tag can never be packed, sorted,
// received or dispatched by mistake).

// A tag ID is a run of letters/digits with no hyphen, at least 8 long
// (battery codes are PREFIX-NNNNNNN; serials are short and mixed).
export function isLikelyRfidTag(value) {
  const v = String(value || '').replace(/[^0-9A-Za-z]/g, '');
  return v.length >= 8 && !/-/.test(String(value || '')) && /^[0-9A-Za-z]+$/.test(v) && !/^[A-Za-z]{2,4}\d+$/.test(v);
}

export function normalizeRfidTag(value) {
  return String(value || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

export const UNASSIGNED_TAG_MESSAGE =
  'This RFID tag is not assigned to any battery yet. Assign it on the RFID Assignment page first.';

// Resolves a scanned/typed value against a list of battery rows (which carry
// rfid_tag). Returns { code, battery, unassignedTag }:
//   - a QR link or code → that code (battery if it's in the list)
//   - a tag that matches a row's rfid_tag → that row's battery_code
//   - a tag-looking value with no match → unassignedTag: true (code is the
//     raw tag, so callers can show it in the message)
export function resolveBatteryInput(raw, batteries = []) {
  const extracted = (extractBatteryCode(raw) || raw || '').trim();
  if (!extracted) return { code: '', battery: null, unassignedTag: false };
  const upper = extracted.toUpperCase();
  const byCode = batteries.find((b) => (b.battery_code || b.code || '').toUpperCase() === upper);
  if (byCode) return { code: byCode.battery_code || byCode.code, battery: byCode, unassignedTag: false };
  if (isLikelyRfidTag(extracted)) {
    const tag = normalizeRfidTag(extracted);
    const byTag = batteries.find((b) => b.rfid_tag && String(b.rfid_tag).toUpperCase() === tag);
    if (byTag) return { code: byTag.battery_code || byTag.code, battery: byTag, unassignedTag: false };
    return { code: upper, battery: null, unassignedTag: true };
  }
  return { code: upper, battery: null, unassignedTag: false };
}
