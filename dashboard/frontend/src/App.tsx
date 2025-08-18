import React, { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './components/Layout/DashboardLayout';
import EmailList from './components/Email/EmailList';
import TaskList from './components/Tasks/TaskListUpdated';
// Remove old TaskCentricApp import to avoid conflicts
import DraftList from './components/Drafts/DraftList';
import Analytics from './components/Analytics/Analytics';
// Removed Login import - no authentication required
import EmailTaskDashboard from './components/TaskCentric/EmailTaskDashboard';
import { CacheBustingProvider, CacheDebugInfo } from './components/CacheBustingProvider';

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
  
  // Remove login/logout handlers since no auth required

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

  // Cache-busting and deployment confirmation
  useEffect(() => {
    const timestamp = new Date().toISOString();
    console.log(`🚀 Task-Centric App loaded at ${timestamp}`);
    console.log('✅ Task-centric Kanban interface deployed');
    console.log('📊 Features: Task management, colleague tracking, draft generation');
    
    // Force cache invalidation on mount
    const cacheKey = `app-cache-${Date.now()}`;
    localStorage.setItem('app-deployment-key', cacheKey);
    
    // Add deployment timestamp to document for debugging
    document.documentElement.setAttribute('data-deployment-timestamp', timestamp);
    document.documentElement.setAttribute('data-modern-interface', 'true');
    
    return () => {
      // Cleanup on unmount
      document.documentElement.removeAttribute('data-deployment-timestamp');
      document.documentElement.removeAttribute('data-modern-interface');
    };
  }, []);

  return (
    <CacheBustingProvider 
      enableServiceWorker={process.env.NODE_ENV === 'production'}
      enableUpdateChecks={true}
      updateCheckInterval={60000}
    >
      <ThemeContext.Provider value={{ isDark, toggleTheme }}>
        <div className="app-container h-screen overflow-hidden" data-testid="task-centric-app">
          <Router>
            <Routes>
              {/* Direct access to EmailTaskDashboard - no login required */}
              <Route path="/" element={<EmailTaskDashboard />} />
              <Route path="/taskmail" element={<EmailTaskDashboard />} />
              <Route path="/dashboard" element={<DashboardLayout />}>
                {/* Legacy routes */}
                <Route index element={<Navigate to="/" replace />} />
                <Route path="tasks" element={<TaskList />} />
                <Route path="drafts" element={<DraftList />} />
                <Route path="inbox" element={<EmailList />} />
                <Route path="analytics" element={<Analytics />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </div>
      </ThemeContext.Provider>
    </CacheBustingProvider>
  );
}

export default App;
