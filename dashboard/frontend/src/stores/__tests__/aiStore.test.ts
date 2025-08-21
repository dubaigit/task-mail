/**
 * AI Store Tests
 * Critical test coverage for AI state management and draft generation
 */

import { act, renderHook } from '@testing-library/react';
import { useAIStore } from '../aiStore';

// Mock API client
jest.mock('../../utils/apiClient', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn()
}));

import { get, post, put, delete as deleteRequest } from '../../utils/apiClient';
const mockGet = get as jest.MockedFunction<typeof get>;
const mockPost = post as jest.MockedFunction<typeof post>;
const mockPut = put as jest.MockedFunction<typeof put>;
const mockDelete = deleteRequest as jest.MockedFunction<typeof deleteRequest>;

// Mock draft data
const mockDrafts = [
  {
    id: '1',
    emailId: 'email-123',
    subject: 'Re: Quarterly Report Review',
    content: 'Thank you for sending the quarterly report. I have reviewed the documents and have the following feedback:\n\n1. The financial projections look accurate\n2. Please include more details on Q4 initiatives\n3. The timeline seems reasonable\n\nLet me know if you need any clarification.',
    tone: 'professional' as const,
    length: 'medium' as const,
    urgency: 'normal' as const,
    includeContext: true,
    customInstructions: 'Be constructive with feedback',
    status: 'completed' as const,
    confidence: 0.92,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z'
  },
  {
    id: '2',
    emailId: 'email-456',
    subject: 'Re: Meeting Reschedule',
    content: 'Hi Sarah,\n\nI understand you need to reschedule our meeting. I\'m available on Thursday at 2 PM or Friday at 10 AM. Please let me know what works best for you.\n\nThanks!',
    tone: 'friendly' as const,
    length: 'short' as const,
    urgency: 'normal' as const,
    includeContext: true,
    customInstructions: '',
    status: 'draft' as const,
    confidence: 0.85,
    createdAt: '2024-01-14T15:30:00Z',
    updatedAt: '2024-01-14T16:00:00Z'
  }
];

const mockTemplates = [
  {
    id: '1',
    name: 'Meeting Follow-up',
    description: 'Template for following up after meetings',
    content: 'Thank you for taking the time to meet with me today. Here are the key points we discussed:\n\n[MEETING_POINTS]\n\nNext steps:\n[NEXT_STEPS]\n\nPlease let me know if I missed anything.',
    category: 'meetings' as const,
    isPublic: true,
    usageCount: 45,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-10T12:00:00Z'
  },
  {
    id: '2',
    name: 'Quick Acknowledgment',
    description: 'Short response to acknowledge receipt',
    content: 'Thanks for sending this. I\'ll review and get back to you by [DEADLINE].',
    category: 'responses' as const,
    isPublic: true,
    usageCount: 78,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-12T09:30:00Z'
  }
];

describe('AI Store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store state
    useAIStore.setState({
      drafts: [],
      templates: [],
      selectedDraft: null,
      selectedTemplate: null,
      isGenerating: false,
      isRefining: false,
      error: null,
      draftOptions: {
        tone: 'professional',
        length: 'medium',
        urgency: 'normal',
        includeContext: true,
        customInstructions: ''
      }
    });
  });

  describe('Initial State', () => {
    it('has correct initial state', () => {
      const { result } = renderHook(() => useAIStore());
      
      expect(result.current.drafts).toEqual([]);
      expect(result.current.templates).toEqual([]);
      expect(result.current.selectedDraft).toBeNull();
      expect(result.current.selectedTemplate).toBeNull();
      expect(result.current.isGenerating).toBe(false);
      expect(result.current.isRefining).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.draftOptions).toEqual({
        tone: 'professional',
        length: 'medium',
        urgency: 'normal',
        includeContext: true,
        customInstructions: ''
      });
    });

    it('calculates computed values correctly on empty state', () => {
      const { result } = renderHook(() => useAIStore());
      
      expect(result.current.completedDrafts).toEqual([]);
      expect(result.current.draftCount).toBe(0);
      expect(result.current.templateCount).toBe(0);
      expect(result.current.isProcessing).toBe(false);
    });
  });

  describe('Draft Generation', () => {
    it('generates draft successfully', async () => {
      mockPost.mockResolvedValueOnce({ data: mockDrafts[0] });
      
      const { result } = renderHook(() => useAIStore());
      
      await act(async () => {
        await result.current.generateDraft('email-123');
      });
      
      expect(mockPost).toHaveBeenCalledWith('/api/ai/generate-draft', {
        emailId: 'email-123',
        options: {
          tone: 'professional',
          length: 'medium',
          urgency: 'normal',
          includeContext: true,
          customInstructions: ''
        }
      });
      
      expect(result.current.drafts).toHaveLength(1);
      expect(result.current.drafts[0]).toEqual(mockDrafts[0]);
      expect(result.current.isGenerating).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('handles draft generation errors', async () => {
      const errorMessage = 'Failed to generate draft';
      mockPost.mockRejectedValueOnce(new Error(errorMessage));
      
      const { result } = renderHook(() => useAIStore());
      
      await act(async () => {
        await result.current.generateDraft('email-123');
      });
      
      expect(result.current.drafts).toEqual([]);
      expect(result.current.isGenerating).toBe(false);
      expect(result.current.error).toBe(errorMessage);
    });

    it('sets loading state during generation', async () => {
      let resolvePromise: (value: any) => void;
      const generatePromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockPost.mockReturnValueOnce(generatePromise);
      
      const { result } = renderHook(() => useAIStore());
      
      act(() => {
        result.current.generateDraft('email-123');
      });
      
      expect(result.current.isGenerating).toBe(true);
      expect(result.current.isProcessing).toBe(true);
      
      await act(async () => {
        resolvePromise({ data: mockDrafts[0] });
        await generatePromise;
      });
      
      expect(result.current.isGenerating).toBe(false);
      expect(result.current.isProcessing).toBe(false);
    });

    it('generates draft with custom options', async () => {
      mockPost.mockResolvedValueOnce({ data: mockDrafts[1] });
      
      const { result } = renderHook(() => useAIStore());
      
      const customOptions = {
        tone: 'friendly' as const,
        length: 'short' as const,
        urgency: 'high' as const,
        includeContext: false,
        customInstructions: 'Keep it brief'
      };
      
      await act(async () => {
        await result.current.generateDraft('email-456', customOptions);
      });
      
      expect(mockPost).toHaveBeenCalledWith('/api/ai/generate-draft', {
        emailId: 'email-456',
        options: customOptions
      });
    });
  });

  describe('Draft Refinement', () => {
    beforeEach(() => {
      useAIStore.setState({ drafts: mockDrafts });
    });

    it('refines draft successfully', async () => {
      const refinedDraft = {
        ...mockDrafts[0],
        content: 'Refined content with better clarity and structure.',
        updatedAt: '2024-01-15T11:00:00Z'
      };
      mockPut.mockResolvedValueOnce({ data: refinedDraft });
      
      const { result } = renderHook(() => useAIStore());
      
      await act(async () => {
        await result.current.refineDraft('1', 'Make it more concise');
      });
      
      expect(mockPut).toHaveBeenCalledWith('/api/ai/refine-draft/1', {
        instruction: 'Make it more concise'
      });
      
      const updatedDraft = result.current.drafts.find(d => d.id === '1');
      expect(updatedDraft?.content).toBe('Refined content with better clarity and structure.');
      expect(result.current.isRefining).toBe(false);
    });

    it('handles refinement errors', async () => {
      const errorMessage = 'Failed to refine draft';
      mockPut.mockRejectedValueOnce(new Error(errorMessage));
      
      const { result } = renderHook(() => useAIStore());
      
      await act(async () => {
        await result.current.refineDraft('1', 'Make it better');
      });
      
      expect(result.current.error).toBe(errorMessage);
      expect(result.current.isRefining).toBe(false);
    });

    it('sets loading state during refinement', async () => {
      let resolvePromise: (value: any) => void;
      const refinePromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockPut.mockReturnValueOnce(refinePromise);
      
      const { result } = renderHook(() => useAIStore());
      
      act(() => {
        result.current.refineDraft('1', 'Improve tone');
      });
      
      expect(result.current.isRefining).toBe(true);
      expect(result.current.isProcessing).toBe(true);
      
      await act(async () => {
        resolvePromise({ data: mockDrafts[0] });
        await refinePromise;
      });
      
      expect(result.current.isRefining).toBe(false);
    });
  });

  describe('Template Management', () => {
    it('fetches templates successfully', async () => {
      mockGet.mockResolvedValueOnce({ data: mockTemplates });
      
      const { result } = renderHook(() => useAIStore());
      
      await act(async () => {
        await result.current.fetchTemplates();
      });
      
      expect(mockGet).toHaveBeenCalledWith('/api/ai/templates');
      expect(result.current.templates).toEqual(mockTemplates);
    });

    it('creates new template', async () => {
      const newTemplate = {
        id: '3',
        name: 'Project Update',
        description: 'Template for project status updates',
        content: 'Project Status Update:\n\nCompleted: [COMPLETED_ITEMS]\nIn Progress: [IN_PROGRESS_ITEMS]\nUpcoming: [UPCOMING_ITEMS]',
        category: 'updates' as const,
        isPublic: false,
        usageCount: 0,
        createdAt: '2024-01-15T12:00:00Z',
        updatedAt: '2024-01-15T12:00:00Z'
      };
      
      mockPost.mockResolvedValueOnce({ data: newTemplate });
      
      const { result } = renderHook(() => useAIStore());
      
      await act(async () => {
        await result.current.createTemplate({
          name: 'Project Update',
          description: 'Template for project status updates',
          content: 'Project Status Update:\n\nCompleted: [COMPLETED_ITEMS]\nIn Progress: [IN_PROGRESS_ITEMS]\nUpcoming: [UPCOMING_ITEMS]',
          category: 'updates',
          isPublic: false
        });
      });
      
      expect(mockPost).toHaveBeenCalledWith('/api/ai/templates', {
        name: 'Project Update',
        description: 'Template for project status updates',
        content: 'Project Status Update:\n\nCompleted: [COMPLETED_ITEMS]\nIn Progress: [IN_PROGRESS_ITEMS]\nUpcoming: [UPCOMING_ITEMS]',
        category: 'updates',
        isPublic: false
      });
      
      expect(result.current.templates).toHaveLength(1);
      expect(result.current.templates[0]).toEqual(newTemplate);
    });

    it('applies template to draft', async () => {
      useAIStore.setState({ 
        templates: mockTemplates,
        selectedTemplate: mockTemplates[0]
      });
      
      const draftFromTemplate = {
        ...mockDrafts[0],
        content: mockTemplates[0].content,
        id: 'new-draft'
      };
      
      mockPost.mockResolvedValueOnce({ data: draftFromTemplate });
      
      const { result } = renderHook(() => useAIStore());
      
      await act(async () => {
        await result.current.applyTemplate('email-123', '1');
      });
      
      expect(mockPost).toHaveBeenCalledWith('/api/ai/apply-template', {
        emailId: 'email-123',
        templateId: '1'
      });
      
      expect(result.current.drafts).toHaveLength(1);
      expect(result.current.drafts[0].content).toBe(mockTemplates[0].content);
    });

    it('deletes template', async () => {
      useAIStore.setState({ templates: mockTemplates });
      mockDelete.mockResolvedValueOnce({ success: true });
      
      const { result } = renderHook(() => useAIStore());
      
      await act(async () => {
        await result.current.deleteTemplate('1');
      });
      
      expect(mockDelete).toHaveBeenCalledWith('/api/ai/templates/1');
      expect(result.current.templates).toHaveLength(1);
      expect(result.current.templates[0].id).toBe('2');
    });
  });

  describe('Draft Management', () => {
    beforeEach(() => {
      useAIStore.setState({ drafts: mockDrafts });
    });

    it('selects draft', () => {
      const { result } = renderHook(() => useAIStore());
      
      act(() => {
        result.current.selectDraft('1');
      });
      
      expect(result.current.selectedDraft).toEqual(mockDrafts[0]);
    });

    it('handles selection of non-existent draft', () => {
      const { result } = renderHook(() => useAIStore());
      
      act(() => {
        result.current.selectDraft('non-existent');
      });
      
      expect(result.current.selectedDraft).toBeNull();
    });

    it('saves draft', async () => {
      const savedDraft = {
        ...mockDrafts[0],
        status: 'completed' as const,
        updatedAt: '2024-01-15T12:00:00Z'
      };
      mockPut.mockResolvedValueOnce({ data: savedDraft });
      
      const { result } = renderHook(() => useAIStore());
      
      await act(async () => {
        await result.current.saveDraft('1');
      });
      
      expect(mockPut).toHaveBeenCalledWith('/api/ai/drafts/1/save');
      
      const updatedDraft = result.current.drafts.find(d => d.id === '1');
      expect(updatedDraft?.status).toBe('completed');
    });

    it('deletes draft', async () => {
      mockDelete.mockResolvedValueOnce({ success: true });
      
      const { result } = renderHook(() => useAIStore());
      
      await act(async () => {
        await result.current.deleteDraft('1');
      });
      
      expect(mockDelete).toHaveBeenCalledWith('/api/ai/drafts/1');
      expect(result.current.drafts).toHaveLength(1);
      expect(result.current.drafts[0].id).toBe('2');
    });

    it('updates draft options', () => {
      const { result } = renderHook(() => useAIStore());
      
      act(() => {
        result.current.updateDraftOptions({
          tone: 'casual',
          length: 'long',
          customInstructions: 'Be more detailed'
        });
      });
      
      expect(result.current.draftOptions).toEqual({
        tone: 'casual',
        length: 'long',
        urgency: 'normal',
        includeContext: true,
        customInstructions: 'Be more detailed'
      });
    });
  });

  describe('Computed Values', () => {
    beforeEach(() => {
      useAIStore.setState({ 
        drafts: mockDrafts,
        templates: mockTemplates 
      });
    });

    it('calculates completed drafts correctly', () => {
      const { result } = renderHook(() => useAIStore());
      
      expect(result.current.completedDrafts).toHaveLength(1);
      expect(result.current.completedDrafts[0].status).toBe('completed');
    });

    it('calculates draft count correctly', () => {
      const { result } = renderHook(() => useAIStore());
      
      expect(result.current.draftCount).toBe(2);
    });

    it('calculates template count correctly', () => {
      const { result } = renderHook(() => useAIStore());
      
      expect(result.current.templateCount).toBe(2);
    });

    it('calculates processing state correctly', () => {
      const { result } = renderHook(() => useAIStore());
      
      // Initially not processing
      expect(result.current.isProcessing).toBe(false);
      
      // Set generating state
      act(() => {
        useAIStore.setState({ isGenerating: true });
      });
      expect(result.current.isProcessing).toBe(true);
      
      // Set refining state
      act(() => {
        useAIStore.setState({ isGenerating: false, isRefining: true });
      });
      expect(result.current.isProcessing).toBe(true);
    });

    it('gets drafts by email ID', () => {
      const { result } = renderHook(() => useAIStore());
      
      const emailDrafts = result.current.getDraftsByEmail('email-123');
      expect(emailDrafts).toHaveLength(1);
      expect(emailDrafts[0].emailId).toBe('email-123');
    });

    it('gets templates by category', () => {
      const { result } = renderHook(() => useAIStore());
      
      const meetingTemplates = result.current.getTemplatesByCategory('meetings');
      expect(meetingTemplates).toHaveLength(1);
      expect(meetingTemplates[0].category).toBe('meetings');
    });
  });

  describe('Error Handling', () => {
    it('clears error state', () => {
      const { result } = renderHook(() => useAIStore());
      
      act(() => {
        useAIStore.setState({ error: 'Test error' });
      });
      
      expect(result.current.error).toBe('Test error');
      
      act(() => {
        result.current.clearError();
      });
      
      expect(result.current.error).toBeNull();
    });

    it('handles network errors in generation', async () => {
      mockPost.mockRejectedValueOnce(new Error('Network error'));
      
      const { result } = renderHook(() => useAIStore());
      
      await act(async () => {
        await result.current.generateDraft('email-123');
      });
      
      expect(result.current.error).toBe('Network error');
      expect(result.current.drafts).toEqual([]);
    });

    it('handles server errors gracefully', async () => {
      mockPost.mockRejectedValueOnce({
        response: { 
          status: 500, 
          data: { message: 'AI service unavailable' } 
        }
      });
      
      const { result } = renderHook(() => useAIStore());
      
      await act(async () => {
        await result.current.generateDraft('email-123');
      });
      
      expect(result.current.error).toContain('AI service unavailable');
    });
  });

  describe('Performance', () => {
    it('handles large numbers of drafts efficiently', () => {
      const largeDraftList = Array.from({ length: 1000 }, (_, i) => ({
        ...mockDrafts[0],
        id: `draft-${i}`,
        content: `Draft content ${i}`
      }));
      
      const { result } = renderHook(() => useAIStore());
      
      const startTime = performance.now();
      
      act(() => {
        useAIStore.setState({ drafts: largeDraftList });
      });
      
      const endTime = performance.now();
      
      // Should handle large lists efficiently (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);
      expect(result.current.drafts).toHaveLength(1000);
    });

    it('memoizes computed values', () => {
      const { result } = renderHook(() => useAIStore());
      useAIStore.setState({ drafts: mockDrafts });
      
      const firstCall = result.current.completedDrafts;
      const secondCall = result.current.completedDrafts;
      
      // Should return same reference for memoized values
      expect(firstCall).toBe(secondCall);
    });
  });

  describe('Persistence', () => {
    it('persists draft options to localStorage', () => {
      const { result } = renderHook(() => useAIStore());
      
      act(() => {
        result.current.updateDraftOptions({
          tone: 'friendly',
          length: 'short'
        });
      });
      
      // Should persist options
      const persistedState = JSON.parse(localStorage.getItem('ai-store') || '{}');
      expect(persistedState.state.draftOptions.tone).toBe('friendly');
      expect(persistedState.state.draftOptions.length).toBe('short');
    });

    it('restores options from localStorage', () => {
      // Set up localStorage with saved options
      localStorage.setItem('ai-store', JSON.stringify({
        state: {
          draftOptions: {
            tone: 'casual',
            length: 'long',
            urgency: 'high',
            includeContext: false,
            customInstructions: 'Restored instructions'
          }
        }
      }));
      
      const { result } = renderHook(() => useAIStore());
      
      expect(result.current.draftOptions.tone).toBe('casual');
      expect(result.current.draftOptions.length).toBe('long');
      expect(result.current.draftOptions.customInstructions).toBe('Restored instructions');
    });
  });
});