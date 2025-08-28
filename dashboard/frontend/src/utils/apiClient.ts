import { API_BASE_URL, API_ENDPOINTS, ERROR_MESSAGES, TIMEOUTS } from './constants';

interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
}

interface RequestOptions extends RequestInit {
  timeout?: number;
}

/**
 * Centralized API client for making HTTP requests
 */
class ApiClient {
  private baseUrl: string;
  private defaultHeaders: HeadersInit;

  constructor() {
    this.baseUrl = API_BASE_URL;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string) {
    this.defaultHeaders = {
      ...this.defaultHeaders,
      'Authorization': `Bearer ${token}`,
    };
  }

  /**
   * Clear authentication token
   */
  clearAuthToken() {
    const headers = { ...this.defaultHeaders };
    delete (headers as any)['Authorization'];
    this.defaultHeaders = headers;
  }

  /**
   * Make a request with timeout support
   */
  private async requestWithTimeout<T>(
    url: string,
    options: RequestOptions = {}
  ): Promise<Response> {
    const { timeout = TIMEOUTS.API_REQUEST, ...fetchOptions } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  /**
   * Generic request method
   */
  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await this.requestWithTimeout(url, {
        ...options,
        headers: {
          ...this.defaultHeaders,
          ...options.headers,
        },
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        return {
          error: data?.message || ERROR_MESSAGES.SERVER_ERROR,
          status: response.status,
        };
      }

      return {
        data,
        status: response.status,
      };
    } catch (error) {
      // API request error: ${error}
      
      if (error instanceof Error) {
        if (error.message === 'Request timeout') {
          return {
            error: 'Request timed out. Please try again.',
            status: 408,
          };
        }
        return {
          error: error.message || ERROR_MESSAGES.NETWORK_ERROR,
          status: 0,
        };
      }
      
      return {
        error: ERROR_MESSAGES.GENERIC_ERROR,
        status: 0,
      };
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'GET',
    });
  }

  /**
   * POST request
   */
  async post<T>(
    endpoint: string,
    body?: any,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T>(
    endpoint: string,
    body?: any,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * PATCH request
   */
  async patch<T>(
    endpoint: string,
    body?: any,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'DELETE',
    });
  }
}

// Create singleton instance
const apiClient = new ApiClient();

// Export specific API methods for email operations
export const emailApi = {
  /**
   * Fetch all emails
   */
  async getEmails() {
    return apiClient.get(API_ENDPOINTS.EMAILS);
  },

  /**
   * Archive an email
   */
  async archiveEmail(id: number) {
    return apiClient.post(API_ENDPOINTS.ARCHIVE_EMAIL.replace(':id', id.toString()));
  },

  /**
   * Delete an email
   */
  async deleteEmail(id: number) {
    return apiClient.delete(API_ENDPOINTS.DELETE_EMAIL.replace(':id', id.toString()));
  },

  /**
   * Mark email as read
   */
  async markEmailAsRead(id: number) {
    return apiClient.patch(API_ENDPOINTS.MARK_READ.replace(':id', id.toString()));
  },

  /**
   * Generate tasks from email
   */
  async generateTasks(emailId: number) {
    return apiClient.post(API_ENDPOINTS.GENERATE_TASKS, { email_id: emailId });
  },

  /**
   * Generate draft response
   */
  async generateDraft(emailId: number, options?: any) {
    return apiClient.post(API_ENDPOINTS.GENERATE_DRAFT, {
      email_id: emailId,
      ...options,
    });
  },

  /**
   * Refine draft
   */
  async refineDraft(draftId: number, instruction: string) {
    return apiClient.post(API_ENDPOINTS.REFINE_DRAFT, {
      draft_id: draftId,
      instruction,
    });
  },

  /**
   * Send draft
   */
  async sendDraft(draftId: number) {
    return apiClient.post(API_ENDPOINTS.SEND_DRAFT, { draft_id: draftId });
  },

  /**
   * Search emails
   */
  async searchEmails(query: string) {
    return apiClient.get(`${API_ENDPOINTS.SEARCH}?q=${encodeURIComponent(query)}`);
  },
};

export default apiClient;