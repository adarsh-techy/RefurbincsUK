import { io } from 'socket.io-client';

// Same origin as the REST API (VITE_API_URL is "<origin>/api") minus the
// "/api" path — Socket.IO listens at its own default path on that origin.
// Falls back to the page's own origin when the variable is missing or
// malformed: `new URL(undefined)` throws at module load, which blanked the
// entire app (login page included) instead of just losing live updates.
function resolveSocketUrl() {
  try {
    return new URL(import.meta.env.VITE_API_URL).origin;
  } catch {
    console.error('VITE_API_URL is missing or invalid — live updates are disabled.');
    return window.location.origin;
  }
}
const SOCKET_URL = resolveSocketUrl();

// One shared connection for the whole app (NotificationBell, RepeatIntakeAlert,
// LowStockAlert all listen on it) instead of each component opening its own.
// Starts disconnected — DashboardLayout connects it once a token exists and
// disconnects it on logout/unmount.
export const socket = io(SOCKET_URL, {
  autoConnect: false,
  auth: (cb) => cb({ token: localStorage.getItem('token') }),
});

export function connectSocket() {
  if (socket.connected) return;
  socket.connect();
}

export function disconnectSocket() {
  if (socket.connected || socket.active) socket.disconnect();
}
