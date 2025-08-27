import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import api, { endpoints } from '../services/api';
import { createStoreErrorHandler } from '../utils/errorHandler';

export interface RefinementAction {
  id: string;
  instruction: string;
  timestamp: string;
  applied: boolean;
  preview?: string;
}

export interface Draft {
  id: number;
  email_id: number;
  content: string;
  confidence: number;
  created_at: string;
  version: number;
  template_used?: string;
  refinement_history?: RefinementAction[];
}

export interface DraftOptions {
  tone: 'professional' | 'friendly' | 'formal' | 'casual' | 'assertive';
  length: 'brief' | 'standard' | 'detailed';
  includeSignature: boolean;
  urgencyLevel: 'critical' | 'high' | 'medium' | 'low';
  customInstructions?: string;
}

export interface ViewModeAnalysis {
  suggestedView: 'email' | 'task' | 'draft' | 'info' | 'colleagues';
  confidence: number;
  reasoning: string;
  taskCount: number;
  draftCount: number;
  actionableItemCount: number;
}

interface AIState {
  aiMetrics: any;
  isGeneratingDraft: boolean;
  conversationHistory: any[];
  usageStats: any;
  // State
  drafts: Draft[];
  currentDraft: Draft | null;
  isGenerating: boolean;
  isRefining: boolean;
  error: string | null;
  draftOptions: DraftOptions;
  viewModeAnalysis: ViewModeAnalysis | null;
  draftVersionHistory: Array<{
    version: number;
    content: string;
    timestamp: string;
    changes: string;
  }>;
  
  // Actions
  setDrafts: (drafts: Draft[]) => void;
  setCurrentDraft: (draft: Draft | null) => void;
  addDraft: (draft: Draft) => void;
  updateDraft: (id: number, updates: Partial<Draft>) => void;
  deleteDraft: (id: number) => void;
  setDraftOptions: (options: Partial<DraftOptions>) => void;
  setViewModeAnalysis: (analysis: ViewModeAnalysis | null) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  setIsRefining: (isRefining: boolean) => void;
  setError: (error: string | null) => void;
  addVersionToHistory: (version: {
    version: number;
    content: string;
    timestamp: string;
    changes: string;
  }) => void;
  
  // Async actions
  generateDraft: (emailId: number, options?: Partial<DraftOptions>) => Promise<Draft | null>;
  refineDraft: (draftId: number, instruction: string) => Promise<Draft | null>;
  sendDraft: (draftId: number) => Promise<void>;
  analyzeViewMode: (emailId: number) => Promise<ViewModeAnalysis | null>;
}

const handleError = createStoreErrorHandler('aiStore');

export const useAIStore = create<AIState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        aiMetrics: null,
        isGeneratingDraft: false,
        conversationHistory: [],
        usageStats: null,
        drafts: [],
        currentDraft: null,
        isGenerating: false,
        isRefining: false,
        error: null,
        draftOptions: {
          tone: 'professional',
          length: 'standard',
          includeSignature: true,
          urgencyLevel: 'medium',
        },
        viewModeAnalysis: null,
        draftVersionHistory: [],
        
        // Actions
        setDrafts: (drafts) => set({ drafts }),
        
        setCurrentDraft: (draft) => set({ currentDraft: draft }),
        
        addDraft: (draft) => set((state) => ({
          drafts: [...state.drafts, draft],
          currentDraft: draft,
        })),
        
        updateDraft: (id, updates) => set((state) => ({
          drafts: state.drafts.map(draft =>
            draft.id === id ? { ...draft, ...updates } : draft
          ),
          currentDraft: state.currentDraft?.id === id
            ? { ...state.currentDraft, ...updates }
            : state.currentDraft,
        })),
        
        deleteDraft: (id) => set((state) => ({
          drafts: state.drafts.filter(draft => draft.id !== id),
          currentDraft: state.currentDraft?.id === id ? null : state.currentDraft,
        })),
        
        setDraftOptions: (options) => set((state) => ({
          draftOptions: { ...state.draftOptions, ...options },
        })),
        
        setViewModeAnalysis: (analysis) => set({ viewModeAnalysis: analysis }),
        
        setIsGenerating: (isGenerating) => set({ isGenerating }),
        
        setIsRefining: (isRefining) => set({ isRefining }),
        
        setError: (error) => set({ error }),
        
        addVersionToHistory: (version) => set((state) => ({
          draftVersionHistory: [...state.draftVersionHistory, version],
        })),
        
        // Async actions
        generateDraft: async (emailId, options) => {
          const { setIsGenerating, setError, addDraft, draftOptions } = get();
          setIsGenerating(true);
          setError(null);
          
          try {
            const mergedOptions = { ...draftOptions, ...options };
            const response = await api.post(endpoints.ai.generateDraft, {
              email: { id: emailId },
              context: mergedOptions
            });
            
                  if (response.data?.error) {
        throw new Error(response.data.error);
      }
            
            if (response.data) {
              const responseData = response.data as any;
              const draft: Draft = {
                id: responseData.id || Date.now(),
                email_id: emailId,
                content: responseData.content || '',
                confidence: responseData.confidence || 0.8,
                created_at: responseData.created_at || new Date().toISOString(),
                version: responseData.version || 1,
                template_used: responseData.template_used,
                refinement_history: responseData.refinement_history || [],
              };
              
              addDraft(draft);
              return draft;
            }
            
            return null;
          } catch (error) {
            setError(handleError(error, 'generateDraft'));
            return null;
          } finally {
            setIsGenerating(false);
          }
        },
        
        refineDraft: async (draftId, instruction) => {
          const { setIsRefining, setError, updateDraft, addVersionToHistory, drafts } = get();
          setIsRefining(true);
          setError(null);
          
          try {
            const currentDraft = drafts.find(d => d.id === draftId);
            if (!currentDraft) {
              throw new Error('Draft not found');
            }
            
            // Save current version to history
            addVersionToHistory({
              version: currentDraft.version,
              content: currentDraft.content,
              timestamp: new Date().toISOString(),
              changes: instruction,
            });
            
            const response = await api.post(`/drafts/${draftId}/refine`, { instruction });
            
                  if (response.data?.error) {
        throw new Error(response.data.error);
      }
            
            if (response.data) {
              const responseData = response.data as any;
              const refinedDraft: Partial<Draft> = {
                content: responseData.content || currentDraft.content,
                version: currentDraft.version + 1,
                refinement_history: [
                  ...(currentDraft.refinement_history || []),
                  {
                    id: Date.now().toString(),
                    instruction,
                    timestamp: new Date().toISOString(),
                    applied: true,
                    preview: responseData.content,
                  },
                ],
              };
              
              updateDraft(draftId, refinedDraft);
              return { ...currentDraft, ...refinedDraft };
            }
            
            return null;
          } catch (error) {
            setError(handleError(error, 'refineDraft'));
            return null;
          } finally {
            setIsRefining(false);
          }
        },
        
        sendDraft: async (draftId) => {
          const { setError } = get();
          
          try {
            const response = await api.post(`/drafts/${draftId}/send`);
            
                  if (response.data?.error) {
        throw new Error(response.data.error);
      }
            
            // Clear the current draft after sending
            set({ currentDraft: null });
          } catch (error) {
            setError(handleError(error, 'sendDraft'));
            throw error;
          }
        },
        
        analyzeViewMode: async (emailId) => {
          const { setViewModeAnalysis, setError } = get();
          
          try {
            // Simulate AI analysis (in real app, this would be an API call)
            const analysis: ViewModeAnalysis = {
              suggestedView: 'task',
              confidence: 0.85,
              reasoning: 'Email contains multiple actionable items',
              taskCount: 3,
              draftCount: 1,
              actionableItemCount: 4,
            };
            
            setViewModeAnalysis(analysis);
            return analysis;
          } catch (error) {
            setError(handleError(error, 'analyzeViewMode'));
            return null;
          }
        },
      }),
      {
        name: 'ai-store',
        partialize: (state) => ({
          draftOptions: state.draftOptions,
        }),
      }
    )
  )
);