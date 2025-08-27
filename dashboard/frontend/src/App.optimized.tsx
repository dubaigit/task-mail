import React, { createContext, useContext, useEffect, useState, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LoadingSpinner } from './components/LazyComponents';

// Lazy load heavy components to reduce initial bundle size
const DashboardLayout = React.lazy(() => import('./components/Layout/DashboardLayout'));
const EmailList = React.lazy(() => import('./components/Email/EmailList'));
const TaskList = React.lazy(() => import('./components/Tasks/TaskListUpdated'));
const DraftList = React.lazy(() => import('./components/Drafts/DraftList'));
const Analytics = React.lazy(() => import('./components/Analytics/Analytics'));
const EmailTaskDashboard = React.lazy(() => import('./components/TaskCentric/EmailTaskDashboard'));

// Lightweight cache provider - remove heavy CacheBustingProvider
const SimpleCacheProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    // Simple cache busting on page load
    const cacheKey = `app-${Date.now()}`;
    sessionStorage.setItem('app-session', cacheKey);
  }, []);
  
  return <>{children}</>;
};

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
  
  // Remove authentication requirement
  const [isAuthenticated] = useState(true); // Always authenticated
  
  const [userEmail] = useState('user@example.com'); // Default user

  const toggleTheme = () => {
    setIsDark(prev => {
      const newTheme = !prev;
      localStorage.setItem('theme', newTheme ? 'dark' : 'light');
      return newTheme;
    });
  };

  useEffect(() => {
    // Apply theme class and data attribute to document root
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, [isDark]);

  // Minimal deployment confirmation - remove heavy logging
  useEffect(() => {
    console.log('🚀 Task-Centric App loaded');
    document.documentElement.setAttribute('data-modern-interface', 'true');
    
    return () => {
      document.documentElement.removeAttribute('data-modern-interface');
    };
  }, []);

  return (
    <SimpleCacheProvider>
      <ThemeContext.Provider value={{ isDark, toggleTheme }}>
        <div className="app-container min-h-screen overflow-x-hidden" data-testid="task-centric-app">
          <Router>
            <Routes>
              {/* Direct access to EmailTaskDashboard - no login required */}
              <Route path="/" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <EmailTaskDashboard />
                </Suspense>
              } />
              <Route path="/taskmail" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <EmailTaskDashboard />
                </Suspense>
              } />
              <Route path="/dashboard" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <DashboardLayout />
                </Suspense>
              }>
                {/* Legacy routes */}
                <Route index element={<Navigate to="/" replace />} />
                <Route path="tasks" element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <TaskList />
                  </Suspense>
                } />
                <Route path="drafts" element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <DraftList />
                  </Suspense>
                } />
                <Route path="inbox" element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <EmailList />
                  </Suspense>
                } />
                <Route path="analytics" element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <Analytics />
                  </Suspense>
                } />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </div>
      </ThemeContext.Provider>
    </SimpleCacheProvider>
  );
}

export default App;