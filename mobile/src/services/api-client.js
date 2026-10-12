import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;
const PRODUCTION_API_URL = 'https://refurbincsuk.onrender.com/api';

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
      return `http://${host}:5001/api`;
    }
  }

  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && !envUrl.includes('exp.direct')) return envUrl;

  // A release build without EXPO_PUBLIC_API_URL must still reach the live
  // API; the LAN address is only useful while developing.
  return __DEV__ ? 'http://192.168.31.154:5001/api' : PRODUCTION_API_URL;
}

const apiClient = axios.create({
  baseURL: getBaseUrl(),
  // Generous on purpose: the hosted backend can take ~50s to wake from sleep
  // on the first request, and a 15s limit made that look like a broken app.
  timeout: 60000,
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
    // Temporary password: the API only allows the change until it's done,
    // and RootNavigator shows SetPassword while this flag is set.
    if (error.response?.status === 403 && error.response.data?.code === 'MUST_CHANGE_PASSWORD' && storeRef) {
      const user = storeRef.getState().auth?.user;
      if (user && !user.must_change_password) {
        const { setUser } = require('../store/auth-slice');
        storeRef.dispatch(setUser({ ...user, must_change_password: true }));
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
