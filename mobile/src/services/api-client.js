import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;

export function getBaseUrl() {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    Constants.manifest?.debuggerHost;

  // Only infer local IP from hostUri if it is a pure numeric IPv4 address
  // When running via Expo tunnel (e.g. *.exp.direct), hostUri is a tunnel domain for Metro only,
  // so we must NOT append :5000 to tunnel domains.
  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (IPV4_REGEX.test(host) && host !== '127.0.0.1' && host !== 'localhost') {
      return `http://${host}:5000/api`;
    }
  }

  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && !envUrl.includes('exp.direct')) return envUrl;

  return 'http://192.168.31.243:5000/api';
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
