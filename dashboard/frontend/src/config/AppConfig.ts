export interface PerformanceBudget {
  [key: string]: {
    lcp: number; // Largest Contentful Paint (ms)
    fid: number; // First Input Delay (ms)
    cls: number; // Cumulative Layout Shift
    fcp: number; // First Contentful Paint (ms)
    ttfb: number; // Time to First Byte (ms)
  };
}

export interface PerformanceThresholds {
  warning: number;
  critical: number;
  memoryUsage: number; // MB
  bundleSize: number; // KB
}

export interface APIConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
  rateLimit: {
    requests: number;
    window: number; // ms
  };
}

export interface CacheConfig {
  ttl: number; // seconds
  maxSize: number; // entries
  strategies: {
    tasks: 'memory' | 'localStorage' | 'sessionStorage';
    emails: 'memory' | 'localStorage' | 'sessionStorage';
    user: 'memory' | 'localStorage' | 'sessionStorage';
  };
}

export interface UIConfig {
  pagination: {
    defaultPageSize: number;
    maxPageSize: number;
    pageSizes: number[];
  };
  debounce: {
    searchDelay: number;
    filterDelay: number;
    autoSaveDelay: number;
  };
  animation: {
    duration: number;
    easing: string;
    reduceMotion: boolean;
  };
  accessibility: {
    announceDelay: number;
    focusTimeout: number;
    highContrast: boolean;
  };
}

export interface SecurityConfig {
  jwt: {
    expiry: number; // seconds
    refreshThreshold: number; // seconds before expiry
  };
  session: {
    timeout: number; // seconds
    warningTime: number; // seconds before timeout
  };
  rateLimit: {
    maxRequests: number;
    windowMs: number;
  };
}

export interface FeatureFlags {
  enablePerformanceMonitoring: boolean;
  enableAdvancedCaching: boolean;
  enableA11yEnhancements: boolean;
  enableExperimentalFeatures: boolean;
  enableDarkMode: boolean;
  enableOfflineMode: boolean;
  enablePushNotifications: boolean;
}

export interface AppConfig {
  api: APIConfig;
  performance: {
    budgets: PerformanceBudget;
    thresholds: PerformanceThresholds;
    monitoring: {
      enabled: boolean;
      sampleRate: number;
      reportInterval: number; // ms
    };
  };
  cache: CacheConfig;
  ui: UIConfig;
  security: SecurityConfig;
  features: FeatureFlags;
  environment: 'development' | 'staging' | 'production';
  version: string;
}

// Default configuration
export const defaultConfig: AppConfig = {
  api: {
    baseUrl: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api',
    timeout: 30000, // 30 seconds
    retries: 3,
    rateLimit: {
      requests: 100,
      window: 60000 // 1 minute
    }
  },
  performance: {
    budgets: {
      '/': {
        lcp: 2500,
        fid: 100,
        cls: 0.1,
        fcp: 1800,
        ttfb: 800
      },
      '/tasks': {
        lcp: 3000,
        fid: 100,
        cls: 0.1,
        fcp: 2000,
        ttfb: 800
      },
      '/emails': {
        lcp: 3500,
        fid: 100,
        cls: 0.1,
        fcp: 2200,
        ttfb: 800
      }
    },
    thresholds: {
      warning: 0.8, // 80% of budget
      critical: 1.2, // 120% of budget
      memoryUsage: 100, // 100MB
      bundleSize: 500 // 500KB
    },
    monitoring: {
      enabled: true,
      sampleRate: 0.1, // 10% of sessions
      reportInterval: 30000 // 30 seconds
    }
  },
  cache: {
    ttl: 300, // 5 minutes
    maxSize: 1000,
    strategies: {
      tasks: 'memory',
      emails: 'localStorage',
      user: 'sessionStorage'
    }
  },
  ui: {
    pagination: {
      defaultPageSize: 20,
      maxPageSize: 100,
      pageSizes: [10, 20, 50, 100]
    },
    debounce: {
      searchDelay: 300,
      filterDelay: 200,
      autoSaveDelay: 1000
    },
    animation: {
      duration: 200,
      easing: 'ease-in-out',
      reduceMotion: false
    },
    accessibility: {
      announceDelay: 150,
      focusTimeout: 100,
      highContrast: false
    }
  },
  security: {
    jwt: {
      expiry: 3600, // 1 hour
      refreshThreshold: 300 // 5 minutes
    },
    session: {
      timeout: 3600, // 1 hour
      warningTime: 300 // 5 minutes
    },
    rateLimit: {
      maxRequests: 100,
      windowMs: 900000 // 15 minutes
    }
  },
  features: {
    enablePerformanceMonitoring: true,
    enableAdvancedCaching: true,
    enableA11yEnhancements: true,
    enableExperimentalFeatures: false,
    enableDarkMode: true,
    enableOfflineMode: false,
    enablePushNotifications: false
  },
  environment: (process.env.NODE_ENV as any) || 'development',
  version: process.env.REACT_APP_VERSION || '1.0.0'
};

// Environment-specific overrides
export const getConfig = (env: string = 'development'): AppConfig => {
  const config = { ...defaultConfig };

  switch (env) {
    case 'production':
      return {
        ...config,
        api: {
          ...config.api,
          timeout: 15000, // Shorter timeout in production
          retries: 2
        },
        performance: {
          ...config.performance,
          monitoring: {
            ...config.performance.monitoring,
            sampleRate: 0.05 // 5% in production
          }
        },
        features: {
          ...config.features,
          enableExperimentalFeatures: false,
          enablePerformanceMonitoring: true
        }
      };

    case 'staging':
      return {
        ...config,
        api: {
          ...config.api,
          timeout: 20000
        },
        performance: {
          ...config.performance,
          monitoring: {
            ...config.performance.monitoring,
            sampleRate: 0.2 // 20% in staging
          }
        },
        features: {
          ...config.features,
          enableExperimentalFeatures: true
        }
      };

    case 'development':
    default:
      return {
        ...config,
        performance: {
          ...config.performance,
          monitoring: {
            ...config.performance.monitoring,
            sampleRate: 1.0 // 100% in development
          }
        },
        features: {
          ...config.features,
          enableExperimentalFeatures: true
        }
      };
  }
};

// Configuration validation
export const validateConfig = (config: AppConfig): string[] => {
  const errors: string[] = [];

  // Validate API configuration
  if (!config.api.baseUrl) {
    errors.push('API base URL is required');
  }
  if (config.api.timeout < 1000) {
    errors.push('API timeout must be at least 1000ms');
  }
  if (config.api.retries < 0 || config.api.retries > 10) {
    errors.push('API retries must be between 0 and 10');
  }

  // Validate performance budgets
  for (const [route, budget] of Object.entries(config.performance.budgets)) {
    if (budget.lcp <= 0 || budget.lcp > 10000) {
      errors.push(`Invalid LCP budget for route ${route}: must be between 1 and 10000ms`);
    }
    if (budget.cls < 0 || budget.cls > 1) {
      errors.push(`Invalid CLS budget for route ${route}: must be between 0 and 1`);
    }
  }

  // Validate cache configuration
  if (config.cache.ttl < 0) {
    errors.push('Cache TTL must be non-negative');
  }
  if (config.cache.maxSize < 1) {
    errors.push('Cache max size must be at least 1');
  }

  // Validate UI configuration
  if (config.ui.pagination.defaultPageSize < 1) {
    errors.push('Default page size must be at least 1');
  }
  if (config.ui.pagination.maxPageSize < config.ui.pagination.defaultPageSize) {
    errors.push('Max page size must be at least the default page size');
  }

  return errors;
};

export default defaultConfig;