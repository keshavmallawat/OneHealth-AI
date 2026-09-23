import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { authApi, setAccessToken, getAccessToken, setAuthFailureHandler } from '../services/authApi';
import type { AuthUser } from '../services/authApi';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (token: string, userData: AuthUser) => void;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** The non-secret companion to the HttpOnly refresh cookie. */
function hasSessionHint(): boolean {
  return document.cookie.split('; ').some((entry) => entry.startsWith('oh_session='));
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Restore the session on boot.
   *  1. A stored access token is tried first (survives a page refresh).
   *  2. Otherwise the HttpOnly refresh cookie is used to mint a new one — but
   *     only when the readable `oh_session` hint says a session plausibly
   *     exists. Without that check, every first visit by a signed-out user
   *     fires a refresh that is certain to 401 and logs an error in the
   *     console, which looks like a fault and is not one.
   * Either way a failure just means "signed out" — never a crash.
   */
  const checkSession = useCallback(async () => {
    setLoading(true);
    try {
      const stored = getAccessToken();
      if (stored) {
        setAccessToken(stored);
        const { user: current } = await authApi.me();
        setUser(current);
      } else if (hasSessionHint()) {
        const refreshed = await authApi.refresh();
        setAccessToken(refreshed.accessToken);
        const { user: current } = await authApi.me();
        setUser(current);
      } else {
        setUser(null);
        setAccessToken('');
      }
    } catch {
      setUser(null);
      setAccessToken('');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // If a refresh ever fails mid-session, drop straight back to signed-out state.
  useEffect(() => {
    setAuthFailureHandler(() => {
      setUser(null);
      setAccessToken('');
    });
  }, []);

  const login = useCallback((token: string, userData: AuthUser) => {
    setAccessToken(token);
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Signing out locally must succeed even if the API call does not.
    } finally {
      setUser(null);
      setAccessToken('');
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkSession }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
