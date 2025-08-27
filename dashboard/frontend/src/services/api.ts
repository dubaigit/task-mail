import axios from 'axios';

// Create an Axios instance
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Interceptor to add the Authorization header to every request.
 * The token is retrieved from memory (managed by AuthContext).
 */
api.interceptors.request.use(
  (config) => {
    // This is a placeholder. The actual token will be set by AuthContext.
    // We're defining the structure here.
    return config;
  },
  (error) => Promise.reject(error)
);

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