import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
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
