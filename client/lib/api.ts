import axios from 'axios';

export const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    // In browser, use current origin so Next.js proxies to backend without needing a second tunnel
    return `${window.location.origin}/api`;
  }
  // During SSR
  return process.env.INTERNAL_BACKEND_URL ? `${process.env.INTERNAL_BACKEND_URL}/api` : 'http://localhost:5000/api';
};

const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
    'bypass-tunnel-reminder': 'true',
    'ngrok-skip-browser-warning': 'true',
  },
  timeout: 15000,
});

// Attach base URL and JWT token to every request
api.interceptors.request.use((config) => {
  if (!config.baseURL) {
    config.baseURL = getApiBaseUrl();
  }
  config.headers = config.headers || {};
  config.headers['bypass-tunnel-reminder'] = 'true';
  config.headers['ngrok-skip-browser-warning'] = 'true';

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('rl_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== 'undefined') {
      const status = error.response?.status;
      const data = error.response?.data;
      if (status === 401) {
        localStorage.removeItem('rl_token');
        localStorage.removeItem('rl_user');
        window.location.href = '/login';
      } else if (status === 403 && data?.is_blacklisted) {
        localStorage.removeItem('rl_token');
        localStorage.removeItem('rl_user');
        sessionStorage.setItem(
          'rl_barred',
          data.blacklist_reason || data.error || 'You are barred from using the service'
        );
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
