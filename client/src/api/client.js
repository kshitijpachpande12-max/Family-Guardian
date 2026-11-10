// ================================================
// Axios API Client with JWT Interceptor
// ================================================

import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor: automatically attaches JWT token if logged in
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('fg_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

// Response interceptor: handle token expiration
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response && error.response.status === 401) {
      // Clear token if invalid or expired
      if (window.location.pathname !== '/login') {
        localStorage.removeItem('fg_token');
        localStorage.removeItem('fg_user');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
