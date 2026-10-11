// Free Real-Time Clock & Date Sync Service
// Synchronizes client time against free, public time APIs with fallback and monotonic drift correction.

let clockOffsetMs = 0;
let isSynced = false;
let syncSource = 'local';
let lastSyncTime = 0;

// Europe/London's UTC offset (0 in winter, +1h in summer) at an instant.
function londonOffsetMs(epochMs) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(epochMs));
  const get = (t) => Number(parts.find((p) => p.type === t)?.value);
  const londonWallAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return londonWallAsUtc - Math.floor(epochMs / 1000) * 1000;
}

async function fetchFromTimeApiIo() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);
  try {
    const startTime = performance.now();
    const res = await fetch('https://timeapi.io/api/time/current/zone?timeZone=Europe/London', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    const roundTrip = (performance.now() - startTime) / 2;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    
    if (data.dateTime) {
      // timeapi.io returns London *wall-clock* fields. Turn them into a real
      // UTC instant: read them as UTC, then subtract London's offset at that
      // moment. (new Date(y, m, d, …) read them as the browser's local time,
      // so the header clock was off by the browser's distance from UK time.)
      const wallAsUtc = Date.UTC(
        data.year,
        data.month - 1,
        data.day,
        data.hour,
        data.minute,
        data.seconds,
        data.milliSeconds || 0
      );
      const apiEpoch = wallAsUtc - londonOffsetMs(wallAsUtc);
      const localNow = Date.now();
      clockOffsetMs = (apiEpoch + roundTrip) - localNow;
      isSynced = true;
      syncSource = 'TimeAPI.io';
      lastSyncTime = Date.now();
      return true;
    }
    throw new Error('Invalid format from timeapi.io');
  } catch (err) {
    if (err.name === 'AbortError') return false;
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchFromWorldTimeApi() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);
  try {
    const startTime = performance.now();
    const res = await fetch('https://worldtimeapi.org/api/timezone/Europe/London', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    const roundTrip = (performance.now() - startTime) / 2;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    
    if (data.unixtime) {
      const apiEpoch = data.unixtime * 1000;
      const localNow = Date.now();
      clockOffsetMs = (apiEpoch + roundTrip) - localNow;
      isSynced = true;
      syncSource = 'WorldTimeAPI';
      lastSyncTime = Date.now();
      return true;
    }
    throw new Error('Invalid format from WorldTimeAPI');
  } catch (err) {
    if (err.name === 'AbortError') return false;
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function syncRealTime() {
  // Avoid re-syncing if done very recently
  if (isSynced && Date.now() - lastSyncTime < 30000) {
    return { isSynced, syncSource, offsetMs: clockOffsetMs };
  }

  const okTimeApi = await fetchFromTimeApiIo();
  if (okTimeApi) return { isSynced, syncSource, offsetMs: clockOffsetMs };

  const okWorldTime = await fetchFromWorldTimeApi();
  if (okWorldTime) return { isSynced, syncSource, offsetMs: clockOffsetMs };

  // Fallback to local clock
  isSynced = true;
  syncSource = 'Local Device';
  lastSyncTime = Date.now();
  return { isSynced, syncSource, offsetMs: clockOffsetMs };
}

export function getSyncedDate() {
  return new Date(Date.now() + clockOffsetMs);
}

export function getSyncStatus() {
  return { isSynced, syncSource, clockOffsetMs, lastSyncTime };
}

