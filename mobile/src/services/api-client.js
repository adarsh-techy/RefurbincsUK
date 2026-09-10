import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

function getBaseUrl() {
  // In Expo Go / a dev client, hostUri is the address the phone actually
  // used to reach this machine's Metro server moments ago — so it tracks
  // the dev machine's current LAN IP even after it changes (new Wi-Fi,
  // DHCP lease renewal, etc.), unlike a hand-edited .env value that goes
  // stale silently. Prefer it whenever it's available; EXPO_PUBLIC_API_URL
  // remains the source of truth for production/standalone builds, where
  // there's no Metro connection to infer an address from.
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    Constants.manifest?.debuggerHost;

  if (hostUri && !hostUri.includes('localhost') && !hostUri.includes('127.0.0.1')) {
    const ip = hostUri.split(':')[0];
    if (ip) {
      return `http://${ip}:5000/api`;
    }
  }

  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) return envUrl;

  return 'http://192.168.31.244:5000/api';
}

const apiClient = axios.create({
  baseURL: getBaseUrl(),
  timeout: 15000,
});

apiClient.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Set once by store.js after the store is created — kept as an injected ref
// (rather than a top-level import of the store/auth-slice) since auth-slice
// itself imports this file to make its own requests, and a top-level
// circular import is fragile under Metro's module system.
let storeRef = null;
export function injectStore(store) {
  storeRef = store;
}

// If a token expires or is rejected mid-session, drop the stale session so
// the navigator falls back to the login screen instead of leaving a
// half-authenticated UI up.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && storeRef) {
      const { logout } = require('../store/auth-slice');
      storeRef.dispatch(logout());
    }
    return Promise.reject(error);
  }
);

export default apiClient;
