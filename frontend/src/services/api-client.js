import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If a token expires or is rejected mid-session, drop the stale session and
// send the user back to login instead of leaving a half-authenticated UI up.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    // The account is on a temporary password: the API only allows the
    // password change until it's done (see ProtectedRoute).
    if (error.response?.status === 403 && error.response.data?.code === 'MUST_CHANGE_PASSWORD') {
      try {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        if (user) localStorage.setItem('user', JSON.stringify({ ...user, must_change_password: true }));
      } catch {
        // unreadable stored user — the login screen will sort it out
      }
      if (window.location.pathname !== '/set-password') {
        window.location.href = '/set-password';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
