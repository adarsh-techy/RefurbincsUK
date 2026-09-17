import apiClient from '../services/api-client';

export function logoUrl(logoPath) {
  if (!logoPath) return null;
  const apiRoot = (apiClient.defaults.baseURL || '').replace(/\/api\/?$/, '');
  return `${apiRoot}/uploads/client-logos/${logoPath}`;
}

export const getLogoUrl = logoUrl;
export default logoUrl;
