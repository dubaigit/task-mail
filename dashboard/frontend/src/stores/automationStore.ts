import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import api, { endpoints } from '../services/api';

export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  conditions: {
    operator: 'AND' | 'OR';
    conditions: Array<{
      field: string;
      operator: string;
      value: any;
    }>;
  };
  actions: Array<{
    type: string;
    [key: string]: any;
  }>;
  priority: number;
  enabled: boolean;
  created_at: string;
  updated_at?: string;
}

export interface AutomationTemplate {
  name: string;
  description: string;
  conditions: AutomationRule['conditions'];
  actions: AutomationRule['actions'];
  priority: number;
}

interface AutomationState {
  // State
  rules: AutomationRule[];
  templates: AutomationTemplate[];
  selectedRule: AutomationRule | null;
  isLoading: boolean;
  error: string | null;
  stats: {
    totalRules: number;
    activeRules: number;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    lastExecutionTime: string | null;
  };

  // Actions
  setRules: (rules: AutomationRule[]) => void;
  setTemplates: (templates: AutomationTemplate[]) => void;
  selectRule: (rule: AutomationRule | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setStats: (stats: any) => void;

  // Async Actions
  fetchRules: () => Promise<void>;
  fetchTemplates: () => Promise<void>;
  fetchStats: () => Promise<void>;
  createRule: (rule: Partial<AutomationRule>) => Promise<void>;
  updateRule: (id: string, updates: Partial<AutomationRule>) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  toggleRule: (id: string) => Promise<void>;
  testRule: (rule: Partial<AutomationRule>, email: any) => Promise<any>;
  processEmail: (email: any) => Promise<any>;
}

export const useAutomationStore = create<AutomationState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        rules: [],
        templates: [],
        selectedRule: null,
        isLoading: false,
        error: null,
        stats: {
          totalRules: 0,
          activeRules: 0,
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          lastExecutionTime: null,
        },

        // Actions
        setRules: (rules) => set({ rules }),
        setTemplates: (templates) => set({ templates }),
        selectRule: (rule) => set({ selectedRule: rule }),
        setLoading: (loading) => set({ isLoading: loading }),
        setError: (error) => set({ error }),
        setStats: (stats) => set({ stats }),

        // Async Actions
        fetchRules: async () => {
          const { setLoading, setError, setRules } = get();
          setLoading(true);
          setError(null);

          try {
            const response = await api.get(endpoints.automation.rules);
            const rules = response.data.rules || [];
            setRules(rules);
          } catch (error: any) {
            setError(error.response?.data?.message || 'Failed to fetch automation rules');
            console.error('Failed to fetch rules:', error);
          } finally {
            setLoading(false);
          }
        },

        fetchTemplates: async () => {
          const { setLoading, setError, setTemplates } = get();
          setLoading(true);
          setError(null);

          try {
            const response = await api.get(endpoints.automation.templates);
            const templates = response.data.templates || [];
            setTemplates(templates);
          } catch (error: any) {
            setError(error.response?.data?.message || 'Failed to fetch templates');
            console.error('Failed to fetch templates:', error);
          } finally {
            setLoading(false);
          }
        },

        fetchStats: async () => {
          const { setError, setStats } = get();
          
          try {
            const response = await api.get(endpoints.automation.stats);
            const stats = response.data.stats || {};
            setStats({
              totalRules: stats.totalRules || 0,
              activeRules: stats.activeRules || 0,
              totalExecutions: stats.totalExecutions || 0,
              successfulExecutions: stats.successfulExecutions || 0,
              failedExecutions: stats.failedExecutions || 0,
              lastExecutionTime: stats.lastExecutionTime || null,
            });
          } catch (error: any) {
            setError(error.response?.data?.message || 'Failed to fetch stats');
            console.error('Failed to fetch stats:', error);
          }
        },

        createRule: async (ruleData) => {
          const { setLoading, setError, fetchRules } = get();
          setLoading(true);
          setError(null);

          try {
            await api.post(endpoints.automation.createRule, ruleData);
            await fetchRules(); // Refresh rules list
          } catch (error: any) {
            setError(error.response?.data?.message || 'Failed to create rule');
            console.error('Failed to create rule:', error);
            throw error;
          } finally {
            setLoading(false);
          }
        },

        updateRule: async (id, updates) => {
          const { setLoading, setError, fetchRules } = get();
          setLoading(true);
          setError(null);

          try {
            await api.put(endpoints.automation.updateRule(id), updates);
            await fetchRules(); // Refresh rules list
          } catch (error: any) {
            setError(error.response?.data?.message || 'Failed to update rule');
            console.error('Failed to update rule:', error);
            throw error;
          } finally {
            setLoading(false);
          }
        },

        deleteRule: async (id) => {
          const { setLoading, setError, fetchRules } = get();
          setLoading(true);
          setError(null);

          try {
            await api.delete(endpoints.automation.deleteRule(id));
            await fetchRules(); // Refresh rules list
          } catch (error: any) {
            setError(error.response?.data?.message || 'Failed to delete rule');
            console.error('Failed to delete rule:', error);
            throw error;
          } finally {
            setLoading(false);
          }
        },

        toggleRule: async (id) => {
          const { setLoading, setError, fetchRules } = get();
          setLoading(true);
          setError(null);

          try {
            await api.patch(endpoints.automation.toggleRule(id));
            await fetchRules(); // Refresh rules list
          } catch (error: any) {
            setError(error.response?.data?.message || 'Failed to toggle rule');
            console.error('Failed to toggle rule:', error);
            throw error;
          } finally {
            setLoading(false);
          }
        },

        testRule: async (rule, email) => {
          const { setLoading, setError } = get();
          setLoading(true);
          setError(null);

          try {
            const response = await api.post(endpoints.automation.testRule, {
              rule,
              email
            });
            return response.data;
          } catch (error: any) {
            setError(error.response?.data?.message || 'Failed to test rule');
            console.error('Failed to test rule:', error);
            throw error;
          } finally {
            setLoading(false);
          }
        },

        processEmail: async (email) => {
          const { setLoading, setError } = get();
          setLoading(true);
          setError(null);

          try {
            const response = await api.post(endpoints.automation.processEmail, {
              email
            });
            return response.data;
          } catch (error: any) {
            setError(error.response?.data?.message || 'Failed to process email');
            console.error('Failed to process email:', error);
            throw error;
          } finally {
            setLoading(false);
          }
        },
      }),
      {
        name: 'automation-store',
        partialize: (state) => ({
          rules: state.rules,
          selectedRule: state.selectedRule,
        }),
      }
    )
  )
);

