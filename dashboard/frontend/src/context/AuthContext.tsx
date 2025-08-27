import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import api, { setupInterceptors } from '../services/api';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start with loading true

  const logout = useCallback(() => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      api.post('/api/auth/logout', { refreshToken }).catch(_err => {
        // Failed to revoke token on server
      });
    }
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem('refreshToken');
    delete api.defaults.headers.common['Authorization'];
  }, []);

  useEffect(() => {
    // Setup interceptors on component mount
    setupInterceptors({ setAccessToken, setUser, logout });

    // Try to restore session on initial load
    const restoreSession = async () => {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await api.post('/api/auth/refresh', { refreshToken });
          setAccessToken(data.accessToken);
          setUser(data.user);
        } catch (error) {
          // Could not refresh session. User needs to log in.
          logout(); // Clear any invalid tokens
        }
      }
      setIsLoading(false);
    };

    restoreSession();
  }, [logout]);
  
  useEffect(() => {
    // Update axios header whenever the access token changes
    if (accessToken) {
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    }
  }, [accessToken]);

  const login = async (email: string, password: string) => {
    try {
      const { data } = await api.post('/api/auth/login', { email, password });
      const { accessToken, refreshToken, user } = data;
      
      setAccessToken(accessToken);
      setUser(user);
      localStorage.setItem('refreshToken', refreshToken);
    } catch (error) {
      // Re-throw the error so the login component can handle it
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated: !!accessToken && !!user, 
      user, 
      isLoading, 
      login, 
      logout 
    }}>
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