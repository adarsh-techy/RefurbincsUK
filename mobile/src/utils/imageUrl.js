import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient, { getBaseUrl } from '../services/api-client';

let cachedToken = null;

// Preload token into memory
AsyncStorage.getItem('token')
  .then((t) => {
    cachedToken = t;
  })
  .catch(() => {});

export function setCachedImageToken(token) {
  cachedToken = token;
}

export function getCachedImageToken() {
  return cachedToken;
}

/**
 * Resolves an image path (relative or absolute) to a full reachable URL for React Native.
 * Appends the auth token query parameter if the resource is protected (e.g. /uploads/issue-photos).
 */
export function resolveImageUrl(path, explicitToken = null) {
  if (!path) return '';
  if (path.startsWith('data:image/') || path.startsWith('file://')) {
    return path;
  }

  const token = explicitToken || cachedToken;
  const baseUrl = (apiClient.defaults?.baseURL || getBaseUrl() || '').replace(/\/api\/?$/, '');

  let fullUrl =
    path.startsWith('http://') || path.startsWith('https://')
      ? path
      : `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  // If path is an authenticated upload and token is present, append token
  if (
    token &&
    (fullUrl.includes('/uploads/issue-photos') ||
      fullUrl.includes('/uploads/staff-docs') ||
      fullUrl.includes('/uploads/return-docs'))
  ) {
    if (!fullUrl.includes('token=')) {
      const separator = fullUrl.includes('?') ? '&' : '?';
      fullUrl = `${fullUrl}${separator}token=${encodeURIComponent(token)}`;
    }
  }

  return fullUrl;
}

export default resolveImageUrl;
