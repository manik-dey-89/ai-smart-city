import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthState } from '../types';

// VITE_API_BASE_URL should be set to the bare backend origin on Render, e.g.:
//   https://ai-smart-city-api.onrender.com
// Do NOT include a trailing slash or /api — we add paths ourselves.
// Leave unset for Docker/local where nginx proxies /api on the same origin.
const _raw = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') || '';

// API_BASE_URL is used by direct fetch() calls in auth (login, register, etc.)
// These paths do NOT start with /api — they use /auth/login etc.
// So we append /api here to match the backend router prefix.
const API_BASE_URL = _raw ? `${_raw}/api` : '/api';

// BACKEND_ORIGIN is used by authFetch() which receives full paths like /api/citizen/...
// We strip /api from the base so paths are not doubled.
const BACKEND_ORIGIN = _raw; // e.g. "https://backend.onrender.com" or "" for local

interface AuthContextType {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (username: string, email: string, password: string, fullName: string, role?: string) => Promise<void>;
  refreshAccessToken: () => Promise<void>;
  refreshUser: () => Promise<void>;
  loading: boolean;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    refreshToken: null,
    isAuthenticated: false,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const refreshToken = localStorage.getItem('refresh_token');
    const user = localStorage.getItem('user');
    if (token && user) {
      setAuthState({
        token,
        refreshToken: refreshToken || null,
        user: JSON.parse(user),
        isAuthenticated: true,
      });
    }
  }, []);

  const login = async (username: string, password: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Login failed');
      }

      const data = await response.json();
      const userResponse = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      const user = await userResponse.json();

      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.setItem('user', JSON.stringify(user));

      setAuthState({
        token: data.access_token,
        refreshToken: data.refresh_token,
        user,
        isAuthenticated: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const register = async (
    username: string,
    email: string,
    password: string,
    fullName: string,
    role: string = 'citizen'
  ) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, full_name: fullName, role_name: role }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Registration failed');
      }

      // Auto-login after registration
      await login(username, password);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (authState.token) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${authState.token}` },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      setAuthState({
        token: null,
        refreshToken: null,
        user: null,
        isAuthenticated: false,
      });
    }
  };

  const authFetch = async (url: string, options: RequestInit = {}) => {
    // Resolve URL: if we have a backend origin and the path is relative (starts with /)
    // prepend it so the request reaches the deployed backend, not the frontend's nginx.
    const resolvedUrl = BACKEND_ORIGIN && url.startsWith('/') ? `${BACKEND_ORIGIN}${url}` : url;

    // Helper to add auth header
    const addAuthHeader = (headers: HeadersInit = {}) => {
      const newHeaders = new Headers(headers);
      if (authState.token) {
        newHeaders.set('Authorization', `Bearer ${authState.token}`);
      }
      return newHeaders;
    };

    // First attempt
    let response = await fetch(resolvedUrl, {
      ...options,
      headers: addAuthHeader(options.headers),
    });

    // If 401, try to refresh token and retry once
    if (response.status === 401) {
      try {
        await refreshAccessToken();
        response = await fetch(resolvedUrl, {
          ...options,
          headers: addAuthHeader(options.headers),
        });
      } catch (refreshError) {
        await logout();
        throw refreshError;
      }
    }

    return response;
  };

  const refreshAccessToken = async () => {
    if (!authState.refreshToken) {
      await logout();
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: authState.refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);

      setAuthState({
        ...authState,
        token: data.access_token,
        refreshToken: data.refresh_token,
      });
    } catch (error) {
      await logout();
      throw error;
    }
  };

  const refreshUser = async () => {
    if (!authState.token) return;
    try {
      const r = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${authState.token}` },
      });
      if (!r.ok) return;
      const freshUser = await r.json();
      localStorage.setItem('user', JSON.stringify(freshUser));
      setAuthState(prev => ({ ...prev, user: freshUser }));
    } catch { /* silent */ }
  };

  return (
    <AuthContext.Provider value={{ ...authState, login, logout, register, refreshAccessToken, refreshUser, loading, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
