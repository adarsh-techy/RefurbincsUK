// Shared rules of the client Battery Sorting screen, the same as the web
// ClientBatterySortPage: what counts as "packed to service", the packed date,
// which fleet batteries can still be sorted, and date/name formatting.

// Away at the workshop: packed on a truck, being repaired or tested.
export function isBatteryPackedForRepair(battery) {
  if (!battery) return false;
  return battery.status === 'in_repair' || battery.status === 'in_progress' || battery.status === 'in_testing';
}

export function getBatteryPackedDate(battery) {
  if (!battery) return null;
  return battery.intake_at || battery.created_at;
}

// Only batteries actually in the client's hands can be sorted — not ones away
// for repair/testing, or unserviceable.
export const NOT_WITH_CLIENT_STATUSES = new Set(['in_repair', 'in_progress', 'in_testing', 'repaired', 'unserviceable']);

export function formatDate(val) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function capitalizeFirstLetter(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

// { total, packed: [{ code, battery }], ready, latestPackedDate } for a group
export function groupStats(group, codeToBattery) {
  const codes = group?.batteries || [];
  const packed = codes
    .map((code) => ({ code, battery: codeToBattery.get(String(code).trim().toUpperCase()) }))
    .filter((item) => isBatteryPackedForRepair(item.battery));
  let latestPackedDate = null;
  packed.forEach((item) => {
    const d = getBatteryPackedDate(item.battery);
    if (d && (!latestPackedDate || new Date(d) > new Date(latestPackedDate))) latestPackedDate = d;
  });
  return { total: codes.length, packed, ready: Math.max(0, codes.length - packed.length), latestPackedDate };
}
