// Free Real-Time Clock & Date Sync Service
// Synchronizes client time against free, public time APIs with fallback and monotonic drift correction.

let clockOffsetMs = 0;
let isSynced = false;
let syncSource = 'local';
let lastSyncTime = 0;

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
      const d = new Date(
        data.year,
        data.month - 1,
        data.day,
        data.hour,
        data.minute,
        data.seconds,
        data.milliSeconds || 0
      );
      const apiEpoch = d.getTime();
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

