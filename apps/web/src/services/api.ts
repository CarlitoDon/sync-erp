import axios, { InternalAxiosRequestConfig, AxiosError } from 'axios';
import { HEADERS } from '@sync-erp/shared';
import toast from 'react-hot-toast';

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

// Helper to extract error message from API response
function getErrorMessage(
  error: AxiosError<{ error?: { message?: string }; message?: string }>
): string {
  const data = error.response?.data;

  // Handle our API error format: { success: false, error: { message: '...' } }
  if (data?.error?.message) {
    return data.error.message;
  }

  // Handle simple message format
  if (data?.message) {
    return data.message;
  }

  // Fallback to generic message based on status
  const status = error.response?.status;
  switch (status) {
    case 400:
      return 'Invalid request';
    case 401:
      return 'Please login to continue';
    case 403:
      return 'Access forbidden';
    case 404:
      return 'Resource not found';
    case 500:
      return 'Server error';
    default:
      return 'An error occurred';
  }
}

// Response interceptor - handles errors globally
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: { message?: string }; message?: string }>) => {
    // Show toast for all API errors
    const message = getErrorMessage(error);
    toast.error(message);

    // Handle specific status codes
    if (error.response?.status === 401) {
      // Could trigger logout or redirect here
      console.error('Unauthorized access');
    }

    return Promise.reject(error);
  }
);

export default api;
