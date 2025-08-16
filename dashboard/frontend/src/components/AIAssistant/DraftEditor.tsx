import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  DocumentTextIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  ClockIcon,
  EyeIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  BookmarkIcon,
  ClipboardDocumentIcon,
  PaperAirplaneIcon,
  PencilIcon,
  LightBulbIcon
} from '@heroicons/react/24/outline';

interface Email {
  id: number;
  subject: string;
  sender: string;
  content?: string;
  classification: string;
  urgency: string;
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

interface EditorState {
  content: string;
  originalContent: string;
  hasUnsavedChanges: boolean;
  wordCount: number;
  characterCount: number;
  readingTime: number;
  isPreview: boolean;
  cursorPosition: number;
  selectionRange: { start: number; end: number } | null;
}

interface AIHighlight {
  start: number;
  end: number;
  type: 'suggestion' | 'improvement' | 'tone' | 'grammar';
  message: string;
  confidence: number;
}

interface DraftEditorProps {
  draft: Draft | null;
  email: Email | null;
  onDraftUpdate: (draft: Draft) => void;
  versionHistory: Draft[];
  onVersionRevert: (version: Draft) => void;
  className?: string;
}

export const DraftEditor: React.FC<DraftEditorProps> = ({
  draft,
  email,
  onDraftUpdate,
  versionHistory,
  onVersionRevert,
  className = ''
}) => {
  const [editorState, setEditorState] = useState<EditorState>({
    content: '',
    originalContent: '',
    hasUnsavedChanges: false,
    wordCount: 0,
    characterCount: 0,
    readingTime: 0,
    isPreview: false,
    cursorPosition: 0,
    selectionRange: null
  });

  const [aiHighlights, setAiHighlights] = useState<AIHighlight[]>([]);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [isAISuggestionsEnabled, setIsAISuggestionsEnabled] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Update editor when draft changes
  useEffect(() => {
    if (draft) {
      const content = draft.content || '';
      setEditorState(prev => ({
        ...prev,
        content,
        originalContent: content,
        hasUnsavedChanges: false,
        wordCount: countWords(content),
        characterCount: content.length,
        readingTime: calculateReadingTime(content)
      }));

      // Generate AI highlights
      if (isAISuggestionsEnabled) {
        generateAIHighlights(content);
      }
    }
  }, [draft, isAISuggestionsEnabled]);

  // Auto-save changes
  useEffect(() => {
    if (editorState.hasUnsavedChanges && draft) {
      const timeoutId = setTimeout(() => {
        handleSave();
      }, 2000); // Auto-save after 2 seconds of inactivity

      return () => clearTimeout(timeoutId);
    }
  }, [editorState.hasUnsavedChanges, editorState.content]);

  const countWords = useCallback((text: string): number => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }, []);

  const calculateReadingTime = useCallback((text: string): number => {
    const wordsPerMinute = 200;
    const words = countWords(text);
    return Math.ceil(words / wordsPerMinute);
  }, [countWords]);

  const generateAIHighlights = useCallback(async (content: string) => {
    if (!content.trim()) {
      setAiHighlights([]);
      return;
    }

    // Simulate AI analysis for highlights
    // In a real implementation, this would call the backend AI service
    const highlights: AIHighlight[] = [];

    // Look for potential improvements
    const sentences = content.split(/[.!?]+/);
    let currentIndex = 0;

    sentences.forEach((sentence, index) => {
      const trimmed = sentence.trim();
      if (!trimmed) return;

      const start = content.indexOf(trimmed, currentIndex);
      const end = start + trimmed.length;
      currentIndex = end;

      // Detect overly long sentences
      if (trimmed.split(' ').length > 25) {
        highlights.push({
          start,
          end,
          type: 'suggestion',
          message: 'Consider breaking this long sentence into shorter ones for better readability.',
          confidence: 0.8
        });
      }

      // Detect passive voice (simple detection)
      if (/\b(was|were|is|are|been|being)\s+\w+ed\b/.test(trimmed)) {
        highlights.push({
          start,
          end,
          type: 'improvement',
          message: 'Consider using active voice for more direct communication.',
          confidence: 0.6
        });
      }

      // Detect formal tone opportunities
      if (/\b(really|very|quite|pretty)\s+/.test(trimmed)) {
        highlights.push({
          start,
          end,
          type: 'tone',
          message: 'Consider removing qualifiers for more confident tone.',
          confidence: 0.7
        });
      }
    });

    setAiHighlights(highlights);
  }, []);

  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setEditorState(prev => ({
      ...prev,
      content: newContent,
      hasUnsavedChanges: newContent !== prev.originalContent,
      wordCount: countWords(newContent),
      characterCount: newContent.length,
      readingTime: calculateReadingTime(newContent),
      cursorPosition: e.target.selectionStart
    }));

    // Update highlights with debounce
    if (isAISuggestionsEnabled) {
      setTimeout(() => generateAIHighlights(newContent), 500);
    }
  }, [countWords, calculateReadingTime, isAISuggestionsEnabled, generateAIHighlights]);

  const handleSave = useCallback(() => {
    if (!draft || !editorState.hasUnsavedChanges) return;

    const updatedDraft: Draft = {
      ...draft,
      content: editorState.content,
      version: draft.version + 1
    };

    onDraftUpdate(updatedDraft);
    setEditorState(prev => ({
      ...prev,
      originalContent: prev.content,
      hasUnsavedChanges: false
    }));
  }, [draft, editorState.hasUnsavedChanges, editorState.content, onDraftUpdate]);

  const handleUndo = useCallback(() => {
    if (versionHistory.length > 1) {
      const previousVersion = versionHistory[versionHistory.length - 2];
      onVersionRevert(previousVersion);
    }
  }, [versionHistory, onVersionRevert]);

  const insertAtCursor = useCallback((text: string) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentContent = editorState.content;
    
    const newContent = currentContent.substring(0, start) + text + currentContent.substring(end);
    
    setEditorState(prev => ({
      ...prev,
      content: newContent,
      hasUnsavedChanges: true,
      wordCount: countWords(newContent),
      characterCount: newContent.length,
      readingTime: calculateReadingTime(newContent)
    }));

    // Focus and set cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  }, [editorState.content, countWords, calculateReadingTime]);

  const handleCopyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(editorState.content);
  }, [editorState.content]);

  const formatPreviewContent = useCallback((content: string): string => {
    return content
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
  }, []);

  const getHighlightStyle = (type: AIHighlight['type']): string => {
    switch (type) {
      case 'suggestion': return 'bg-blue-100 border-b-2 border-blue-300';
      case 'improvement': return 'bg-yellow-100 border-b-2 border-yellow-300';
      case 'tone': return 'bg-purple-100 border-b-2 border-purple-300';
      case 'grammar': return 'bg-red-100 border-b-2 border-red-300';
      default: return '';
    }
  };

  if (!draft) {
    return (
      <div className={`flex items-center justify-center h-full text-muted-foreground ${className}`}>
        <div className="text-center">
          <PencilIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No draft to edit</p>
          <p className="text-sm">Generate a draft first to start editing</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-background ${className}`}>
      {/* Editor Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Editor Mode Toggle */}
            <div className="flex space-x-1 bg-muted rounded-lg p-1">
              <button
                onClick={() => setEditorState(prev => ({ ...prev, isPreview: false }))}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  !editorState.isPreview
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <PencilIcon className="w-4 h-4 inline mr-1" />
                Edit
              </button>
              <button
                onClick={() => setEditorState(prev => ({ ...prev, isPreview: true }))}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  editorState.isPreview
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <EyeIcon className="w-4 h-4 inline mr-1" />
                Preview
              </button>
            </div>

            {/* AI Suggestions Toggle */}
            <label className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={isAISuggestionsEnabled}
                onChange={(e) => setIsAISuggestionsEnabled(e.target.checked)}
                className="rounded border-gray-300"
              />
              <SparklesIcon className="w-4 h-4" />
              <span>AI Suggestions</span>
            </label>
          </div>

          <div className="flex items-center space-x-2">
            {/* Stats */}
            <div className="text-sm text-muted-foreground space-x-4">
              <span>{editorState.wordCount} words</span>
              <span>{editorState.characterCount} chars</span>
              <span>{editorState.readingTime}min read</span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center space-x-1">
              <button
                onClick={handleUndo}
                disabled={versionHistory.length <= 1}
                className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
                title="Undo"
              >
                <ArrowUturnLeftIcon className="w-4 h-4" />
              </button>

              <button
                onClick={() => setShowVersionHistory(!showVersionHistory)}
                className="p-1.5 text-muted-foreground hover:text-foreground"
                title="Version History"
              >
                <ClockIcon className="w-4 h-4" />
              </button>

              <button
                onClick={handleCopyToClipboard}
                className="p-1.5 text-muted-foreground hover:text-foreground"
                title="Copy to Clipboard"
              >
                <ClipboardDocumentIcon className="w-4 h-4" />
              </button>

              {editorState.hasUnsavedChanges && (
                <button
                  onClick={handleSave}
                  className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                >
                  Save
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Draft Confidence */}
        <div className="mt-2 flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Confidence:</span>
          <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs ${
            draft.confidence >= 0.8 
              ? 'bg-green-50 text-green-700 border border-green-200'
              : draft.confidence >= 0.6
              ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            <CheckCircleIcon className="w-3 h-3" />
            <span>{(draft.confidence * 100).toFixed(0)}%</span>
          </div>
          {editorState.hasUnsavedChanges && (
            <span className="text-xs text-amber-600">• Unsaved changes</span>
          )}
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Editor/Preview */}
        <div className="flex-1 relative">
          {editorState.isPreview ? (
            /* Preview Mode */
            <div
              ref={previewRef}
              className="h-full p-6 overflow-y-auto prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{
                __html: formatPreviewContent(editorState.content)
              }}
            />
          ) : (
            /* Edit Mode */
            <div className="h-full relative">
              <textarea
                ref={textareaRef}
                value={editorState.content}
                onChange={handleContentChange}
                placeholder="Start writing your draft response..."
                className="w-full h-full p-6 border-0 resize-none focus:outline-none bg-background text-foreground font-mono text-sm leading-relaxed"
                spellCheck
              />

              {/* AI Highlights Overlay */}
              {isAISuggestionsEnabled && aiHighlights.length > 0 && (
                <div className="absolute inset-0 p-6 pointer-events-none font-mono text-sm leading-relaxed">
                  {aiHighlights.map((highlight, index) => {
                    const beforeText = editorState.content.substring(0, highlight.start);
                    const highlightText = editorState.content.substring(highlight.start, highlight.end);
                    const afterText = editorState.content.substring(highlight.end);

                    return (
                      <div key={index} className="absolute inset-0">
                        <span className="invisible whitespace-pre-wrap">{beforeText}</span>
                        <span
                          className={`${getHighlightStyle(highlight.type)} whitespace-pre-wrap`}
                          title={highlight.message}
                        >
                          {highlightText}
                        </span>
                        <span className="invisible whitespace-pre-wrap">{afterText}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* AI Suggestions Sidebar */}
        {isAISuggestionsEnabled && aiHighlights.length > 0 && !editorState.isPreview && (
          <div className="w-80 border-l border-border bg-muted/30 overflow-y-auto">
            <div className="p-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center">
                <LightBulbIcon className="w-4 h-4 mr-2" />
                AI Suggestions ({aiHighlights.length})
              </h4>
              <div className="space-y-3">
                {aiHighlights.map((highlight, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-shadow ${
                      highlight.type === 'suggestion' ? 'bg-blue-50 border-blue-200' :
                      highlight.type === 'improvement' ? 'bg-yellow-50 border-yellow-200' :
                      highlight.type === 'tone' ? 'bg-purple-50 border-purple-200' :
                      'bg-red-50 border-red-200'
                    }`}
                    onClick={() => {
                      if (textareaRef.current) {
                        textareaRef.current.focus();
                        textareaRef.current.setSelectionRange(highlight.start, highlight.end);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        highlight.type === 'suggestion' ? 'bg-blue-100 text-blue-700' :
                        highlight.type === 'improvement' ? 'bg-yellow-100 text-yellow-700' :
                        highlight.type === 'tone' ? 'bg-purple-100 text-purple-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {highlight.type}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {(highlight.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-sm text-foreground">{highlight.message}</p>
                    <div className="mt-2 text-xs text-muted-foreground font-mono bg-background/50 p-2 rounded">
                      "{editorState.content.substring(highlight.start, Math.min(highlight.end, highlight.start + 50))}..."
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Version History Sidebar */}
        {showVersionHistory && (
          <div className="w-80 border-l border-border bg-muted/30 overflow-y-auto">
            <div className="p-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center">
                <ClockIcon className="w-4 h-4 mr-2" />
                Version History ({versionHistory.length})
              </h4>
              <div className="space-y-2">
                {versionHistory.slice().reverse().map((version, index) => (
                  <div
                    key={version.version}
                    className={`p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-shadow ${
                      version.id === draft.id 
                        ? 'bg-primary/10 border-primary/20' 
                        : 'bg-background border-border hover:bg-muted/50'
                    }`}
                    onClick={() => onVersionRevert(version)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">
                        Version {version.version}
                        {version.id === draft.id && (
                          <span className="ml-2 text-xs text-primary">(current)</span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(version.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {version.content.substring(0, 100)}...
                    </p>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {countWords(version.content)} words • {(version.confidence * 100).toFixed(0)}% confidence
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Insert Bar */}
      <div className="border-t border-border p-3 bg-muted/30">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Quick insert:</span>
          <button
            onClick={() => insertAtCursor('Best regards,\n[Your name]')}
            className="px-2 py-1 text-xs bg-background border border-border rounded hover:bg-muted transition-colors"
          >
            Signature
          </button>
          <button
            onClick={() => insertAtCursor('Please let me know if you need any further information.')}
            className="px-2 py-1 text-xs bg-background border border-border rounded hover:bg-muted transition-colors"
          >
            Follow-up
          </button>
          <button
            onClick={() => insertAtCursor('Thank you for your time and consideration.')}
            className="px-2 py-1 text-xs bg-background border border-border rounded hover:bg-muted transition-colors"
          >
            Thanks
          </button>
          <button
            onClick={() => insertAtCursor('I look forward to hearing from you soon.')}
            className="px-2 py-1 text-xs bg-background border border-border rounded hover:bg-muted transition-colors"
          >
            Closing
          </button>
        </div>
      </div>
    </div>
  );
};