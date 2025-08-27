import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AppConfig, getConfig, validateConfig, defaultConfig } from '../config/AppConfig';
import { useAccessibility } from '../hooks/useAccessibility';

interface ConfigContextType {
  config: AppConfig;
  updateConfig: (updates: Partial<AppConfig>) => void;
  resetConfig: () => void;
  isLoading: boolean;
  errors: string[];
  reloadConfig: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

interface ConfigProviderProps {
  children: React.ReactNode;
  initialConfig?: Partial<AppConfig>;
  configUrl?: string; // URL to fetch remote config
}

export const ConfigProvider: React.FC<ConfigProviderProps> = ({
  children,
  initialConfig,
  configUrl
}) => {
  const [config, setConfig] = useState<AppConfig>(() => {
    const envConfig = getConfig(process.env.NODE_ENV);
    return initialConfig ? { ...envConfig, ...initialConfig } : envConfig;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const { announceToScreenReader } = useAccessibility();

  // Load configuration from remote source
  const loadRemoteConfig = useCallback(async () => {
    if (!configUrl) return;

    try {
      setIsLoading(true);
      const response = await fetch(configUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.status} ${response.statusText}`);
      }

      const remoteConfig = await response.json();
      const mergedConfig = { ...config, ...remoteConfig };
      
      // Validate the merged configuration
      const validationErrors = validateConfig(mergedConfig);
      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        // Configuration validation failed: ${validationErrors}
        announceToScreenReader('Configuration loaded with warnings');
      } else {
        setConfig(mergedConfig);
        setErrors([]);
        announceToScreenReader('Configuration updated successfully');
      }
    } catch (error) {
      // Failed to load remote configuration: ${error}
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setErrors([`Failed to load remote configuration: ${errorMessage}`]);
      announceToScreenReader('Failed to load configuration');
    } finally {
      setIsLoading(false);
    }
  }, [configUrl, config, announceToScreenReader]);

  // Load configuration from localStorage
  const loadStoredConfig = useCallback(() => {
    try {
      const stored = localStorage.getItem('appConfig');
      if (stored) {
        const parsedConfig = JSON.parse(stored);
        const validationErrors = validateConfig(parsedConfig);
        
        if (validationErrors.length === 0) {
          setConfig(parsedConfig);
        } else {
          // Stored configuration is invalid, using default: ${validationErrors}
          setErrors(validationErrors);
        }
      }
    } catch (error) {
      // Failed to load stored configuration: ${error}
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setErrors([`Failed to load stored configuration: ${errorMessage}`]);
    }
  }, []);

  // Save configuration to localStorage
  const saveConfig = useCallback((newConfig: AppConfig) => {
    try {
      localStorage.setItem('appConfig', JSON.stringify(newConfig));
    } catch (error) {
      // Failed to save configuration: ${error}
    }
  }, []);

  // Update configuration
  const updateConfig = useCallback((updates: Partial<AppConfig>) => {
    const newConfig = { ...config, ...updates };
    const validationErrors = validateConfig(newConfig);
    
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      announceToScreenReader('Configuration update failed: validation errors');
      return;
    }

    setConfig(newConfig);
    setErrors([]);
    saveConfig(newConfig);
    announceToScreenReader('Configuration updated');
  }, [config, saveConfig, announceToScreenReader]);

  // Reset configuration to defaults
  const resetConfig = useCallback(() => {
    const envConfig = getConfig(process.env.NODE_ENV);
    setConfig(envConfig);
    setErrors([]);
    
    try {
      localStorage.removeItem('appConfig');
      announceToScreenReader('Configuration reset to defaults');
    } catch (error) {
      // Failed to clear stored configuration: ${error}
    }
  }, [announceToScreenReader]);

  // Reload configuration
  const reloadConfig = useCallback(async () => {
    setErrors([]);
    await loadRemoteConfig();
    loadStoredConfig();
  }, [loadRemoteConfig, loadStoredConfig]);

  // Initialize configuration on mount
  useEffect(() => {
    const initialize = async () => {
      loadStoredConfig();
      
      if (configUrl) {
        await loadRemoteConfig();
      }
    };

    initialize();
  }, []); // Run only once on mount

  // Apply configuration changes to document
  useEffect(() => {
    // Apply dark mode
    if (config.features.enableDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Apply high contrast
    if (config.ui.accessibility.highContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }

    // Apply reduced motion preference
    if (config.ui.animation.reduceMotion) {
      document.documentElement.style.setProperty('--animation-duration', '0ms');
    } else {
      document.documentElement.style.setProperty('--animation-duration', `${config.ui.animation.duration}ms`);
    }

    // Set CSS custom properties for theming
    document.documentElement.style.setProperty('--animation-easing', config.ui.animation.easing);
    document.documentElement.style.setProperty('--debounce-search', `${config.ui.debounce.searchDelay}ms`);
    document.documentElement.style.setProperty('--debounce-filter', `${config.ui.debounce.filterDelay}ms`);
  }, [config]);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (e: MediaQueryListEvent) => {
      updateConfig({
        ui: {
          ...config.ui,
          animation: {
            ...config.ui.animation,
            reduceMotion: e.matches
          }
        }
      });
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [config.ui, updateConfig]);

  // Monitor for configuration changes in other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'appConfig' && e.newValue) {
        try {
          const newConfig = JSON.parse(e.newValue);
          const validationErrors = validateConfig(newConfig);
          
          if (validationErrors.length === 0) {
            setConfig(newConfig);
            setErrors([]);
            announceToScreenReader('Configuration synchronized from another tab');
          }
        } catch (error) {
          // Failed to sync configuration from storage: ${error}
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [announceToScreenReader]);

  const contextValue: ConfigContextType = {
    config,
    updateConfig,
    resetConfig,
    isLoading,
    errors,
    reloadConfig
  };

  return (
    <ConfigContext.Provider value={contextValue}>
      {children}
      
      {/* Error Display */}
      {errors.length > 0 && (
        <div 
          className="fixed bottom-4 right-4 max-w-sm bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg z-50"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Configuration Errors</h3>
              <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
              <button
                onClick={resetConfig}
                className="mt-2 text-sm text-red-800 hover:text-red-900 underline focus:outline-none"
              >
                Reset to defaults
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div 
          className="fixed top-4 right-4 bg-blue-50 border border-blue-200 rounded-lg p-3 shadow-lg z-50"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2" />
            <span className="text-sm text-blue-800">Loading configuration...</span>
          </div>
        </div>
      )}
    </ConfigContext.Provider>
  );
};

// Hook to use configuration
export const useConfig = (): ConfigContextType => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};

// Hook to get specific config sections
export const useAPIConfig = () => {
  const { config } = useConfig();
  return config.api;
};

export const usePerformanceConfig = () => {
  const { config } = useConfig();
  return config.performance;
};

export const useUIConfig = () => {
  const { config } = useConfig();
  return config.ui;
};

export const useFeatureFlags = () => {
  const { config } = useConfig();
  return config.features;
};

export const useCacheConfig = () => {
  const { config } = useConfig();
  return config.cache;
};

export const useSecurityConfig = () => {
  const { config } = useConfig();
  return config.security;
};

export default ConfigProvider;