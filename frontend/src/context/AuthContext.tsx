import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import authApi, { setAccessToken } from '../services/authApi';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (token: string, userData: User) => void;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkSession = async () => {
    try {
      setLoading(true);
      // Let's assume the backend has a way to use the refresh token
      // If we don't have access token, we could call refresh first
      // But let's first check if there's a stored access token.
      const storedToken = localStorage.getItem('accessToken');
      if (storedToken) {
        setAccessToken(storedToken);
        const response = await authApi.get('/me');
        setUser(response.data.user);
      } else {
        // Try refreshing
        const refreshRes = await authApi.post('/refresh');
        const newToken = refreshRes.data.accessToken;
        setAccessToken(newToken);
        localStorage.setItem('accessToken', newToken);
        
        const userRes = await authApi.get('/me');
        setUser(userRes.data.user);
      }
    } catch (error) {
      console.log('Session check failed', error);
      setUser(null);
      setAccessToken('');
      localStorage.removeItem('accessToken');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const login = (token: string, userData: User) => {
    setAccessToken(token);
    localStorage.setItem('accessToken', token);
    setUser(userData);
  };

  const logout = async () => {
    try {
      await authApi.post('/logout');
    } catch (error) {
      console.error('Logout API failed', error);
    } finally {
      setUser(null);
      setAccessToken('');
      localStorage.removeItem('accessToken');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkSession }}>
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
