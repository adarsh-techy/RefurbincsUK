import apiClient from '../services/api-client';

export function resolveImageUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  const apiRoot = (apiClient.defaults.baseURL || '').replace(/\/api\/?$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  // staff-docs and issue-photos are served behind requireAuth, which accepts
  // the token as a query param since <img src> can't carry an Authorization header.
  const needsAuth = cleanPath.startsWith('/uploads/staff-docs') || cleanPath.startsWith('/uploads/issue-photos');
  if (!needsAuth) return `${apiRoot}${cleanPath}`;
  const token = localStorage.getItem('token');
  if (!token) return `${apiRoot}${cleanPath}`;
  const separator = cleanPath.includes('?') ? '&' : '?';
  return `${apiRoot}${cleanPath}${separator}token=${encodeURIComponent(token)}`;
}

export default resolveImageUrl;
