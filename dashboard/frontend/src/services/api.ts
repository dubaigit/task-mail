import axios from 'axios';

// Create an Axios instance
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// API Endpoints matching new backend services
export const endpoints = {
  // Email endpoints
  emails: {
    list: '/emails',
    get: (id: string) => `/emails/${id}`,
    search: '/emails/search',
    markAsRead: (id: string) => `/emails/${id}/read`,
    classify: '/ai/classify-email',
    generateDraft: '/ai/generate-draft',
    searchWithAI: '/ai/search-emails',
  },
  
  // Task endpoints
  tasks: {
    list: '/tasks',
    create: '/tasks',
    update: (id: string) => `/tasks/${id}`,
    delete: (id: string) => `/tasks/${id}`,
    generateFromEmail: '/ai/generate-tasks',
  },
  
  // Sync endpoints (Enhanced)
  sync: {
    status: '/sync/status',
    trigger: '/sync/trigger',
    start: '/sync/start',
    stop: '/sync/stop',
    history: '/sync/history',
  },
  
  // Automation endpoints (NEW)
  automation: {
    rules: '/automation/rules',
    getRule: (id: string) => `/automation/rules/${id}`,
    createRule: '/automation/rules',
    updateRule: (id: string) => `/automation/rules/${id}`,
    deleteRule: (id: string) => `/automation/rules/${id}`,
    toggleRule: (id: string) => `/automation/rules/${id}/toggle`,
    testRule: '/automation/test',
    processEmail: '/automation/process-email',
    templates: '/automation/templates',
    stats: '/automation/stats',
  },
  
  // AI endpoints (Enhanced with GPTService)
  ai: {
    classifyEmail: '/ai/classify-email',
    generateDraft: '/ai/generate-draft',
    searchEmails: '/ai/search-emails',
    generateTasks: '/ai/generate-tasks',
    processAutomation: '/ai/process-automation',
    usageStats: '/ai/usage-stats',
  },
  
  // Auth endpoints
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    refresh: '/auth/refresh',
    profile: '/user/profile',
  },
  
  // Health & Stats
  health: '/health',
  stats: '/statistics/dashboard',
};

/**
 * Interceptor to add the Authorization header to every request.
 * The token is retrieved from localStorage and managed by AuthContext.
 */
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Function to set auth token (called from AuthContext)
export const setAuthToken = (token: string) => {
  localStorage.setItem('accessToken', token);
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};

// Function to clear auth token
export const clearAuthToken = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  delete api.defaults.headers.common['Authorization'];
};

/**
 * Sets up the response interceptor to handle 401 errors (expired tokens).
 * This function needs access to the auth context's state setters and logout function.
 * @param {object} authContext - An object with functions to manage auth state.
 */
export const setupInterceptors = (authContext: {
  setAccessToken: (token: string | null) => void;
  setUser: (user: any) => void;
  logout: () => void;
}) => {
  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      // If the error is 401 and it's not a retry request
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true; // Mark as a retry to prevent infinite loops

        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          authContext.logout();
          return Promise.reject(error);
        }

        try {
          // Request a new access token using the refresh token
          const { data } = await api.post('/auth/refresh', { refreshToken });
          
          const { accessToken: newAccessToken, user } = data.data;

          // Update the auth context and local storage
          authContext.setAccessToken(newAccessToken);
          authContext.setUser(user);
          
          // Update the Authorization header for the original request and retry it
          api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
          originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
          
          return api(originalRequest);
        } catch (refreshError) {
          // If refresh fails, the refresh token is invalid. Logout the user.
          console.error("Token refresh failed:", refreshError);
          authContext.logout();
          return Promise.reject(refreshError);
        }
      }
      return Promise.reject(error);
    }
  );
};

export default api;