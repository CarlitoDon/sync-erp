import axios, { InternalAxiosRequestConfig } from 'axios';
import { HEADERS } from '@sync-erp/shared';

// Create axios instance with default config
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - adds company context headers
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Get company ID from localStorage or state
  const companyId = localStorage.getItem('currentCompanyId');
  const userId = localStorage.getItem('currentUserId');

  if (companyId) {
    config.headers[HEADERS.COMPANY_ID] = companyId;
  }
  if (userId) {
    config.headers[HEADERS.USER_ID] = userId;
  }

  return config;
});

// Response interceptor - handles errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle common error cases
    if (error.response?.status === 401) {
      // Handle unauthorized - redirect to login
      console.error('Unauthorized access');
    }
    if (error.response?.status === 403) {
      // Handle forbidden
      console.error('Access forbidden');
    }
    return Promise.reject(error);
  }
);

export default api;
