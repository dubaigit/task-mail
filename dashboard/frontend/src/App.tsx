import React, { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './components/Layout/DashboardLayout';
import EmailList from './components/Email/EmailList';
import TaskList from './components/Tasks/TaskListUpdated';
import DraftList from './components/Drafts/DraftList';
import Analytics from './components/Analytics/Analytics';
import TaskDashboard from './components/TaskCentric/TaskDashboard';
import MainDashboard from './components/MainDashboard';
import Login from './components/Auth/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { CacheBustingProvider } from './components/CacheBustingProvider';
import DarkModeSystem from './components/ui/DarkModeSystem';
import './styles/design-system/unified-design-tokens.css';
import './styles/layout-fixes.css';

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

function App() {
  const [isDark, setIsDark] = useState(() => {
    // Check localStorage for saved theme preference
    const saved = localStorage.getItem('theme');
    if (saved) {
      return saved === 'dark';
    }
    // Default to DARK MODE (user preference)
    return true;
  });

  const toggleTheme = () => {
    setIsDark(prev => {
      const newTheme = !prev;
      localStorage.setItem('theme', newTheme ? 'dark' : 'light');
      return newTheme;
    });
  };


  useEffect(() => {
    // Apply standardized data-theme attribute for consistent theming
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    
    // Legacy support: maintain .dark class for existing components during transition
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Cache-busting, deployment confirmation, and 2025 design system
  useEffect(() => {
    const timestamp = new Date().toISOString();
    
    // Force cache invalidation on mount
    const cacheKey = `app-cache-${Date.now()}`;
    localStorage.setItem('app-deployment-key', cacheKey);
    
    // Add deployment timestamp to document for debugging
    document.documentElement.setAttribute('data-deployment-timestamp', timestamp);
    document.documentElement.setAttribute('data-modern-interface', 'true');
    document.documentElement.setAttribute('data-design-system', '2025');
    
    // Add 2025 design system classes
    document.body.classList.add('design-system-2025', 'gpu-accelerated');
    
    return () => {
      // Cleanup on unmount
      document.documentElement.removeAttribute('data-deployment-timestamp');
      document.documentElement.removeAttribute('data-modern-interface');
      document.documentElement.removeAttribute('data-design-system');
      document.body.classList.remove('design-system-2025', 'gpu-accelerated');
    };
  }, []);

  // Show main app with proper authentication
  return (
    <AuthProvider>
      <CacheBustingProvider 
        enableServiceWorker={process.env.NODE_ENV === 'production'}
        enableUpdateChecks={true}
        updateCheckInterval={60000}
      >
        <ThemeContext.Provider value={{ isDark, toggleTheme }}>
          <DarkModeSystem enableAnimations={true}>
            <div className="app-container dm-surface-0 stagger-children" style={{ 
              minHeight: '100vh',
              overflow: 'hidden',
              position: 'relative',
              backgroundColor: 'var(--dm-base)',
              color: 'var(--dm-text-high)'
            }} data-testid="task-centric-app" data-scroll-animation="fadeInUp">
              <Router>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/login" element={<Login />} />
                  
                  {/* Protected Routes */}
                  <Route element={<ProtectedRoute />}>
                    <Route path="/" element={<MainDashboard />} />
                    <Route path="/taskmail" element={<MainDashboard />} />
                    <Route path="/original" element={<TaskDashboard />} />
                    <Route path="/dashboard" element={<DashboardLayout />}>
                      <Route index element={<Navigate to="/" replace />} />
                      <Route path="tasks" element={<TaskList />} />
                      <Route path="drafts" element={<DraftList />} />
                      <Route path="inbox" element={<EmailList />} />
                      <Route path="analytics" element={<Analytics />} />
                    </Route>
                  </Route>
                  
                  {/* Fallback for unknown routes */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Router>
            </div>
          </DarkModeSystem>
        </ThemeContext.Provider>
      </CacheBustingProvider>
    </AuthProvider>
  );
}

export default App;