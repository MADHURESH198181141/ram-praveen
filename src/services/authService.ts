/**
 * Authentication service for handling login, logout, and token management.
 */

import { apiRequest } from './api';

export interface User {
  id: number;
  user_id: string;
  username: string;
  email?: string;
  role: 'admin' | 'employee';
  store_id: number;
}

export interface LoginRequest {
  username: string;
  password: string;
  store_id: number;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

class AuthService {
  /**
   * Login user with credentials
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await apiRequest<LoginResponse>(
      'POST',
      '/api/auth/login',
      credentials
    );

    if (response.access_token) {
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('user', JSON.stringify(response.user));
      localStorage.setItem('store_id', response.user.store_id.toString());
    }

    return response;
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      await apiRequest('POST', '/api/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    }

    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('store_id');
  }

  /**
   * Get current user from localStorage
   */
  getCurrentUser(): User | null {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  /**
   * Get access token
   */
  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  /**
   * Get store ID
   */
  getStoreId(): number | null {
    const storeId = localStorage.getItem('store_id');
    return storeId ? parseInt(storeId, 10) : null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getAccessToken() && !!this.getCurrentUser();
  }

  /**
   * Check if user is admin
   */
  isAdmin(): boolean {
    const user = this.getCurrentUser();
    return user?.role === 'admin';
  }

  /**
   * Check if user is employee
   */
  isEmployee(): boolean {
    const user = this.getCurrentUser();
    return user?.role === 'employee' || user?.role === 'admin';
  }

  /**
   * Verify token validity
   */
  async verifyToken(): Promise<boolean> {
    try {
      const token = this.getAccessToken();
      if (!token) return false;

      await apiRequest('POST', '/api/auth/verify-token', { token });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(): Promise<string> {
    const currentToken = this.getAccessToken();
    if (!currentToken) {
      throw new Error('No token to refresh');
    }

    const response = await apiRequest<{ access_token: string }>(
      'POST',
      '/api/auth/refresh',
      { current_token: currentToken }
    );

    localStorage.setItem('access_token', response.access_token);
    return response.access_token;
  }
}

export default new AuthService();
