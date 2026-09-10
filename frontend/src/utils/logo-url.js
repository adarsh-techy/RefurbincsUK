// A client logo is served as a plain public static file (see
// backend/src/app.js) at the API server's root, not under the /api prefix
// that apiClient's baseURL carries — so the URL has to be built by hand
// rather than just calling apiClient.get(...).
import apiClient from '../services/api-client';

const API_ROOT = (apiClient.defaults.baseURL || '').replace(/\/api\/?$/, '');

export function logoUrl(logoPath) {
  return logoPath ? `${API_ROOT}/uploads/client-logos/${logoPath}` : null;
}

export const getLogoUrl = logoUrl;
export default logoUrl;
