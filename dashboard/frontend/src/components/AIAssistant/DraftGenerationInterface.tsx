import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Icons } from '../ui/icons';
import { DraftEditor } from './DraftEditor';
import { ConversationalAIPanel } from './ConversationalAIPanel';
import { TemplateManager } from './TemplateManager';

interface Email {
  id: number;
  subject: string;
  sender: string;
  senderEmail: string;
  content?: string;
  classification: string;
  urgency: string;
  date: string;
}

interface Draft {
  id: number;
  email_id: number;
  content: string;
  confidence: number;
  created_at: string;
  version: number;
  template_used?: string;
  refinement_history?: RefinementAction[];
}

interface RefinementAction {
  id: string;
  instruction: string;
  timestamp: string;
  applied: boolean;
  preview?: string;
}

interface DraftGenerationState {
  isGenerating: boolean;
  hasGenerated: boolean;
  confidence: number;
  generationTime: number;
  autoGenerate: boolean;
  showConversational: boolean;
  showTemplates: boolean;
}

interface DraftGenerationInterfaceProps {
  selectedEmail: Email | null;
  currentDraft: Draft | null;
  onDraftUpdate: (draft: Draft) => void;
  onDraftGenerate: (emailId: number, options?: DraftOptions) => Promise<Draft>;
  onDraftRefine: (draftId: number, instruction: string) => Promise<Draft>;
  className?: string;
}

interface DraftOptions {
  tone?: 'professional' | 'friendly' | 'formal' | 'casual';
  length?: 'brief' | 'standard' | 'detailed';
  template?: string;
  includeSignature?: boolean;
  urgencyLevel?: 'low' | 'medium' | 'high';
  customInstructions?: string;
}

const DraftGenerationInterface: React.FC<DraftGenerationInterfaceProps> = ({
  selectedEmail,
  currentDraft,
  onDraftUpdate,
  onDraftGenerate,
  onDraftRefine,
  className = ''
}) => {
  const [state, setState] = useState<DraftGenerationState>({
    isGenerating: false,
    hasGenerated: false,
    confidence: 0,
    generationTime: 0,
    autoGenerate: true,
    showConversational: false,
    showTemplates: false
  });

  const [draftOptions, setDraftOptions] = useState<DraftOptions>({
    tone: 'professional',
    length: 'standard',
    includeSignature: true,
    urgencyLevel: 'medium'
  });

  const [versionHistory, setVersionHistory] = useState<Draft[]>([]);
  const [activePanel, setActivePanel] = useState<'editor' | 'chat' | 'templates'>('editor');
  const generationStartTime = useRef<number>(0);

  // Auto-generate draft when email is selected
  useEffect(() => {
    if (selectedEmail && state.autoGenerate && !currentDraft) {
      handleAutoGenerate();
    }
  }, [selectedEmail, state.autoGenerate]);

  // Update confidence and generation time when draft changes
  useEffect(() => {
    if (currentDraft) {
      setState(prev => ({
        ...prev,
        hasGenerated: true,
        confidence: currentDraft.confidence
      }));
    }
  }, [currentDraft]);

  const handleAutoGenerate = useCallback(async () => {
    if (!selectedEmail || state.isGenerating) return;

    setState(prev => ({ ...prev, isGenerating: true }));
    generationStartTime.current = Date.now();

    try {
      // Determine auto-generation options based on email context
      const autoOptions: DraftOptions = {
        ...draftOptions,
        tone: getRecommendedTone(selectedEmail),
        length: getRecommendedLength(selectedEmail),
        urgencyLevel: selectedEmail.urgency.toLowerCase() as 'low' | 'medium' | 'high'
      };

      const newDraft = await onDraftGenerate(selectedEmail.id, autoOptions);
      
      if (newDraft) {
        setVersionHistory(prev => [...prev, newDraft]);
        setState(prev => ({
          ...prev,
          generationTime: Date.now() - generationStartTime.current,
          hasGenerated: true
        }));
        onDraftUpdate(newDraft);
      }
    } catch (error) {
      console.error('Auto-generation failed:', error);
    } finally {
      setState(prev => ({ ...prev, isGenerating: false }));
    }
  }, [selectedEmail, draftOptions, onDraftGenerate, onDraftUpdate, state.isGenerating]);

  const handleManualGenerate = useCallback(async () => {
    if (!selectedEmail) return;

    setState(prev => ({ ...prev, isGenerating: true }));
    generationStartTime.current = Date.now();

    try {
      const newDraft = await onDraftGenerate(selectedEmail.id, draftOptions);
      
      if (newDraft) {
        setVersionHistory(prev => [...prev, newDraft]);
        setState(prev => ({
          ...prev,
          generationTime: Date.now() - generationStartTime.current,
          hasGenerated: true
        }));
        onDraftUpdate(newDraft);
      }
    } catch (error) {
      console.error('Manual generation failed:', error);
    } finally {
      setState(prev => ({ ...prev, isGenerating: false }));
    }
  }, [selectedEmail, draftOptions, onDraftGenerate, onDraftUpdate]);

  const handleRefinementInstruction = useCallback(async (instruction: string) => {
    if (!currentDraft) return;

    try {
      const refinedDraft = await onDraftRefine(currentDraft.id, instruction);
      if (refinedDraft) {
        setVersionHistory(prev => [...prev, refinedDraft]);
        onDraftUpdate(refinedDraft);
      }
    } catch (error) {
      console.error('Refinement failed:', error);
    }
  }, [currentDraft, onDraftRefine, onDraftUpdate]);

  const handleVersionRevert = useCallback((version: Draft) => {
    setVersionHistory(prev => [...prev, version]);
    onDraftUpdate(version);
  }, [onDraftUpdate]);

  // Helper functions for auto-generation logic
  const getRecommendedTone = (email: Email): DraftOptions['tone'] => {
    if (email.classification === 'APPROVAL_REQUIRED') return 'formal';
    if (email.urgency === 'HIGH') return 'professional';
    if (email.sender.includes('team') || email.sender.includes('colleague')) return 'friendly';
    return 'professional';
  };

  const getRecommendedLength = (email: Email): DraftOptions['length'] => {
    if (email.urgency === 'HIGH') return 'brief';
    if (email.classification === 'APPROVAL_REQUIRED') return 'detailed';
    return 'standard';
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.85) return 'text-green-600 bg-green-50 border-green-200';
    if (confidence >= 0.65) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getConfidenceLabel = (confidence: number): string => {
    if (confidence >= 0.85) return 'High Confidence';
    if (confidence >= 0.65) return 'Medium Confidence';
    return 'Low Confidence';
  };

  if (!selectedEmail) {
    return (
      <div className={`flex items-center justify-center h-64 text-muted-foreground ${className}`}>
        <div className="text-center">
          <Icons.document className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Select an email to generate a draft</p>
          <p className="text-sm">AI-powered draft generation will start automatically</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-background ${className}`}>
      {/* Header with Controls */}
      <div className="border-b border-border p-4 space-y-4">
        {/* Generation Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Icons.sparkles className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">AI Draft Generation</h3>
            
            {state.isGenerating && (
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Icons.rotate className="w-4 h-4 animate-spin" />
                <span>Generating...</span>
              </div>
            )}
            
            {state.hasGenerated && !state.isGenerating && (
              <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs border ${getConfidenceColor(state.confidence)}`}>
                <Icons.checkCircle className="w-3 h-3" />
                <span>{getConfidenceLabel(state.confidence)}</span>
                <span className="text-xs opacity-75">({(state.confidence * 100).toFixed(0)}%)</span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {/* Auto-generate toggle */}
            <label className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={state.autoGenerate}
                onChange={(e) => setState(prev => ({ ...prev, autoGenerate: e.target.checked }))}
                className="rounded border-gray-300"
              />
              <span>Auto-generate</span>
            </label>

            {/* Manual generate button */}
            <button
              onClick={handleManualGenerate}
              disabled={state.isGenerating}
              className="inline-flex items-center space-x-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              <Icons.sparkles className="w-4 h-4" />
              <span>Generate</span>
            </button>
          </div>
        </div>

        {/* Panel Navigation */}
        <div className="flex space-x-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => setActivePanel('editor')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activePanel === 'editor' 
                ? 'bg-background text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icons.edit className="w-4 h-4" />
            <span>Editor</span>
          </button>
          
          <button
            onClick={() => setActivePanel('chat')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activePanel === 'chat' 
                ? 'bg-background text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icons.messageSquare className="w-4 h-4" />
            <span>Refine</span>
          </button>
          
          <button
            onClick={() => setActivePanel('templates')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activePanel === 'templates' 
                ? 'bg-background text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icons.document className="w-4 h-4" />
            <span>Templates</span>
          </button>
        </div>

        {/* Generation Options */}
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <Icons.settings className="w-4 h-4 text-muted-foreground" />
            <select
              value={draftOptions.tone}
              onChange={(e) => setDraftOptions(prev => ({ ...prev, tone: e.target.value as DraftOptions['tone'] }))}
              className="rounded border-border bg-background text-foreground"
            >
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="formal">Formal</option>
              <option value="casual">Casual</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-muted-foreground">Length:</span>
            <select
              value={draftOptions.length}
              onChange={(e) => setDraftOptions(prev => ({ ...prev, length: e.target.value as DraftOptions['length'] }))}
              className="rounded border-border bg-background text-foreground"
            >
              <option value="brief">Brief</option>
              <option value="standard">Standard</option>
              <option value="detailed">Detailed</option>
            </select>
          </div>

          {state.hasGenerated && (
            <div className="flex items-center space-x-1 text-muted-foreground">
              <Icons.clock className="w-4 h-4" />
              <span>{state.generationTime}ms</span>
            </div>
          )}
        </div>
      </div>

      {/* Content Panels */}
      <div className="flex-1 overflow-hidden">
        {activePanel === 'editor' && (
          <DraftEditor
            draft={currentDraft}
            email={selectedEmail}
            onDraftUpdate={onDraftUpdate}
            versionHistory={versionHistory}
            onVersionRevert={handleVersionRevert}
            className="h-full"
          />
        )}

        {activePanel === 'chat' && (
          <ConversationalAIPanel
            draft={currentDraft}
            email={selectedEmail}
            onRefinementInstruction={handleRefinementInstruction}
            isProcessing={state.isGenerating}
            className="h-full"
          />
        )}

        {activePanel === 'templates' && (
          <TemplateManager
            selectedEmail={selectedEmail}
            currentDraft={currentDraft}
            onTemplateApply={(template) => {
              setDraftOptions(prev => ({ ...prev, template: template.id }));
              handleManualGenerate();
            }}
            onTemplateCreate={(content) => {
              // Handle template creation
              console.log('Creating template from:', content);
            }}
            className="h-full"
          />
        )}
      </div>
    </div>
  );
};

export default DraftGenerationInterface;
export { DraftGenerationInterface };