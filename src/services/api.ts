/**
 * Base API client for communicating with FastAPI backend.
 * Handles authentication, interceptors, and error handling.
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Create axios instance
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor - Add JWT token to headers
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle token expiration and errors
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }

    // Handle errors
    if (error.response?.status === 403) {
      console.error('Access denied:', error.response.data);
    }

    if (error.response?.status === 500) {
      console.error('Server error:', error.response.data);
    }

    return Promise.reject(error);
  }
);

/**
 * Make API request with error handling
 */
export async function apiRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  data?: any,
  params?: Record<string, any>
): Promise<T> {
  try {
    const config: any = { params };
    
    if (method === 'GET') {
      const response = await apiClient.get<T>(endpoint, config);
      return response.data;
    } else if (method === 'POST') {
      const response = await apiClient.post<T>(endpoint, data, config);
      return response.data;
    } else if (method === 'PUT') {
      const response = await apiClient.put<T>(endpoint, data, config);
      return response.data;
    } else if (method === 'DELETE') {
      const response = await apiClient.delete<T>(endpoint, config);
      return response.data;
    }

    throw new Error(`Unsupported HTTP method: ${method}`);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw {
        status: error.response?.status,
        message: error.response?.data?.detail || error.message,
        data: error.response?.data,
      };
    }
    throw error;
  }
}

export default apiClient;
