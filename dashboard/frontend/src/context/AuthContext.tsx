import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import api, { setupInterceptors, setAuthToken, clearAuthToken } from '../services/api';

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
      api.post('/auth/logout', { refreshToken }).catch(_err => {
        // Failed to revoke token on server
      });
    }
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem('accessToken'); // Clear access token
    localStorage.removeItem('refreshToken'); // Clear refresh token
    clearAuthToken(); // Use the new clearAuthToken function
  }, []);

  useEffect(() => {
    // Setup interceptors on component mount
    setupInterceptors({ setAccessToken, setUser, logout });

    // Try to restore session on initial load
    const restoreSession = async () => {
      const refreshToken = localStorage.getItem('refreshToken');
      const storedAccessToken = localStorage.getItem('accessToken');
      
      // If we have both tokens, try to restore session
      if (refreshToken && storedAccessToken) {
        try {
          // First try to use the stored access token
          setAuthToken(storedAccessToken);
          
          // Verify the token is still valid by making a simple request
          const { data } = await api.get('/auth/me');
          setAccessToken(storedAccessToken);
          setUser(data.user);
        } catch (error) {
          // Access token invalid, try refresh
          try {
            const { data } = await api.post('/auth/refresh', { refreshToken });
            setAccessToken(data.accessToken);
            setUser(data.user);
            setAuthToken(data.accessToken);
            localStorage.setItem('accessToken', data.accessToken);
          } catch (refreshError) {
            // Refresh failed, clear everything
            logout();
          }
        }
      } else {
        // No tokens available, ensure we're logged out
        logout();
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
      const { data } = await api.post('/auth/login', { email, password });
      const { accessToken, refreshToken, user } = data.data; // Note: response has nested data
      
      setAccessToken(accessToken);
      setUser(user);
      localStorage.setItem('accessToken', accessToken); // Store access token
      localStorage.setItem('refreshToken', refreshToken);
      setAuthToken(accessToken); // Use the new setAuthToken function
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