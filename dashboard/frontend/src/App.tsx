import React, { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ModernEmailInterface from './components/Email/ModernEmailInterface';

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
    // Default to system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const toggleTheme = () => {
    setIsDark(prev => {
      const newTheme = !prev;
      localStorage.setItem('theme', newTheme ? 'dark' : 'light');
      return newTheme;
    });
  };

  useEffect(() => {
    // Apply theme class to document root
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Cache-busting and deployment confirmation
  useEffect(() => {
    const timestamp = new Date().toISOString();
    console.log(`🚀 ModernEmailInterface App loaded at ${timestamp}`);
    console.log('✅ Task-centric design deployed with Email/Task/Draft toggle system');
    console.log('📊 Features: Virtual scrolling, auto-view switching, performance monitoring');
    
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
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      <div className="app-container h-screen overflow-hidden" data-testid="modern-email-app">
        <Router>
          <Routes>
            <Route path="/" element={<ModernEmailInterface />} />
          </Routes>
        </Router>
      </div>
    </ThemeContext.Provider>
  );
}

export default App;