import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, UserRole, AuthState } from '@/types';
import { getUsers, verifyUserPassword, setUserPassword } from '@/lib/storage';

interface AuthContextType extends AuthState {
  login: (userId: string, password: string, role: UserRole) => boolean;
  logout: () => void;
  changePassword: (currentPassword: string, newPassword: string) => boolean;
  isAdmin: boolean;
  isEmployee: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'pos_auth_state';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>(() => {
    // Try to restore session from localStorage
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          loginTime: parsed.loginTime ? new Date(parsed.loginTime) : null,
        };
      }
    } catch {
      // Ignore parse errors
    }
    return {
      isAuthenticated: false,
      user: null,
      loginTime: null,
    };
  });

  // Persist auth state
  useEffect(() => {
    if (authState.isAuthenticated) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authState));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [authState]);

  const login = useCallback((userId: string, password: string, role: UserRole): boolean => {
    const users = getUsers();

    if (role === 'admin') {
      // Find admin user by name or id
      const adminUser = users.find(
        u => u.role === 'admin' &&
          (u.name.toLowerCase() === userId.toLowerCase() ||
           u.id === userId ||
           userId.toLowerCase() === 'admin')
      ) || {
        id: 'user-admin',
        name: 'Admin',
        role: 'admin' as UserRole,
        createdAt: new Date(),
        isActive: true,
      };

      // Verify password (fallback to 'admin123' if none set)
      const ok = verifyUserPassword(adminUser.id, password, 'admin123');
      if (ok) {
        setAuthState({ isAuthenticated: true, user: adminUser, loginTime: new Date() });
        return true;
      }
    } else {
      // Employee login — match by barcode, id, or name
      const employee = users.find(
        u => u.role === 'employee' &&
          u.isActive &&
          (u.barcode === userId || u.id === userId || u.name.toLowerCase() === userId.toLowerCase())
      );

      // Fallback password is 'emp123' if user never set one
      if (employee && verifyUserPassword(employee.id, password, 'emp123')) {
        setAuthState({ isAuthenticated: true, user: employee, loginTime: new Date() });
        return true;
      }
    }

    return false;
  }, []);

  const logout = useCallback(() => {
    setAuthState({ isAuthenticated: false, user: null, loginTime: null });
  }, []);

  // Change the currently-logged-in user's own password
  const changePassword = useCallback((currentPassword: string, newPassword: string): boolean => {
    const currentUser = authState.user;
    if (!currentUser) return false;

    const fallback = currentUser.role === 'admin' ? 'admin123' : 'emp123';
    const valid = verifyUserPassword(currentUser.id, currentPassword, fallback);
    if (!valid) return false;

    setUserPassword(currentUser.id, newPassword);
    return true;
  }, [authState.user]);

  const value: AuthContextType = {
    ...authState,
    login,
    logout,
    changePassword,
    isAdmin: authState.user?.role === 'admin',
    isEmployee: authState.user?.role === 'employee',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
