import React, { useEffect, useState } from 'react';
import { Icons } from '../icons';

import { UnifiedChatProps, SuggestedPrompt } from './types';
import { useChatInterface } from './hooks/useChatInterface';
import { ChatHeader } from './components/ChatHeader';
import { MessageList } from './components/MessageList';
import { MessageInput } from './components/MessageInput';
import { TypingIndicator } from './components/TypingIndicator';
import { DatabasePanel } from './components/DatabasePanel';
import { SuggestionsPanel } from './components/SuggestionsPanel';

export const UnifiedChat: React.FC<UnifiedChatProps> = ({
  messages,
  onSendMessage,
  variant = 'embedded',
  features = {},
  theme = { variant: 'light' },
  isTyping = false,
  isConnected = true,
  isProcessing = false,
  isLoading = false,
  onReconnect,
  onClose,
  draft,
  email,
  onRefinementInstruction,
  title,
  placeholder = "Type your message...",
  maxMessages = 1000,
  disabled = false,
  className = '',
  showConnectionStatus = true,
  enableFileUpload = false,
  enableVoiceInput = false
}) => {
  const [emailSuggestions] = useState<any[]>([]);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [editingPrompt, setEditingPrompt] = useState(false);

  const chatConfig = {
    disabled,
    isConnected,
    onSendMessage
  };
  
  const {
    inputValue,
    setInputValue,
    isExpanded,
    setIsExpanded,
    messagesEndRef,
    handleSendMessage,
    handleKeyboardShortcut
  } = useChatInterface(chatConfig);

  // Suggested prompts for refinement mode
  const suggestedPrompts: SuggestedPrompt[] = [
    {
      id: 'make-formal',
      text: 'Make this more formal',
      description: 'Increase formality and professionalism',
      icon: <Icons.lightbulb className="w-4 h-4" />,
      category: 'tone'
    },
    {
      id: 'make-friendly',
      text: 'Make this warmer and friendlier',
      description: 'Add warmth and personal touch',
      icon: <Icons.sparkles className="w-4 h-4" />,
      category: 'tone'
    },
    {
      id: 'make-shorter',
      text: 'Make this shorter and more concise',
      description: 'Reduce length while keeping key points',
      icon: <Icons.refresh className="w-4 h-4" />,
      category: 'length'
    },
    {
      id: 'add-deadline',
      text: 'Add a deadline request',
      description: 'Include urgency and timeline',
      icon: <Icons.clock className="w-4 h-4" />,
      category: 'content'
    },
    {
      id: 'add-technical',
      text: 'Add more technical details',
      description: 'Include specific technical information',
      icon: <Icons.alertCircle className="w-4 h-4" />,
      category: 'content'
    },
    {
      id: 'soften-tone',
      text: 'Soften the tone',
      description: 'Make the message less direct',
      icon: <Icons.messageSquare className="w-4 h-4" />,
      category: 'tone'
    }
  ];

  // Handle refinement suggestions
  const handleSuggestionClick = async (suggestion: SuggestedPrompt) => {
    if (onRefinementInstruction) {
      await handleRefinementMessage(suggestion.text);
    } else {
      handleSendMessage(suggestion.text);
    }
  };

  // Handle refinement-specific message sending
  const handleRefinementMessage = async (instruction: string) => {
    if (!instruction.trim() || isProcessing || !onRefinementInstruction) return;

    // const _userMessage: ChatMessage = {
    //   id: Date.now().toString(),
    //   type: 'user',
    //   content: instruction.trim(),
    //   timestamp: new Date().toISOString(),
    //   instruction: instruction.trim()
    // };

    // Add user message
    // Note: This would need to be coordinated with parent component
    
    try {
      await onRefinementInstruction(instruction.trim());
    } catch (error) {
      console.error('Refinement error:', error);
    }
  };

  // Initialize conversation for refinement mode
  useEffect(() => {
    if (draft && messages.length === 0 && onRefinementInstruction) {
      // const _welcomeMessage: ChatMessage = {
      //   id: 'welcome',
      //   type: 'ai',
      //   content: `I've generated a draft response for "${email?.subject}". How would you like to refine it? You can ask me to adjust the tone, length, add specific content, or make any other changes.`,
      //   timestamp: new Date().toISOString()
      // };
      // This would need to be handled by parent component
    }
  }, [draft, email, messages.length, onRefinementInstruction]);

  // Get computed title
  const computedTitle = title || 
    (features.ai ? "AI Assistant" : 
     onRefinementInstruction ? "Conversational Refinement" : 
     "Chat");

  // Get computed placeholder
  const computedPlaceholder = placeholder ||
    (onRefinementInstruction ? "Tell me how to improve the draft (e.g., 'make it more formal', 'add a deadline')" :
     features.ai ? "Ask me about your emails, request drafts, or create automation rules..." :
     "Type your message...");

  const isDark = theme.variant === 'dark';

  // Render based on variant
  const renderContent = () => {
    const content = (
      <>
        <ChatHeader 
          title={computedTitle}
          isConnected={isConnected}
          isExpanded={isExpanded}
          onToggleExpanded={variant === 'embedded' ? () => setIsExpanded(!isExpanded) : undefined}
          onClose={onClose}
          showConnectionStatus={features.connectionStatus ?? showConnectionStatus}
          messageCount={messages.length}
          variant={theme.variant === 'system' ? 'light' : theme.variant}
          actions={features.systemPrompt && (
            <button
              onClick={() => setEditingPrompt(!editingPrompt)}
              className={`p-2 rounded-lg transition-colors ${
                editingPrompt 
                  ? 'bg-green-500/20 text-green-300' 
                  : isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-gray-200 text-gray-500'
              }`}
              title="Edit system prompt"
            >
              <Icons.sparkles className="w-4 h-4" />
            </button>
          )}
        />
        
        {/* System Prompt Editor */}
        {features.systemPrompt && editingPrompt && (
          <div className="unified-system-prompt-editor u-p-4 u-border-b u-border-primary u-bg-surface-secondary">
            <div className="u-flex u-items-center u-gap-2 u-mb-2">
              <Icons.sparkles className="u-w-4 u-h-4 u-text-success" />
              <span className="u-text-sm u-font-medium u-text-success">System Prompt</span>
            </div>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="unified-system-prompt-textarea u-w-full u-border u-border-primary u-rounded-lg u-p-3 u-text-sm u-font-mono u-resize-none u-bg-card u-text-primary"
              rows={4}
              placeholder="Define how the AI should behave and what capabilities it has..."
            />
            <div className="u-flex u-justify-end u-gap-2 u-mt-2">
              <button
                onClick={() => setEditingPrompt(false)}
                className="unified-button-secondary u-px-3 u-py-1.5 u-text-xs u-transition-colors u-text-secondary hover:u-text-primary"
              >
                Cancel
              </button>
              <button
                className="unified-button-primary u-px-3 u-py-1.5 u-text-xs u-bg-success-light u-text-success u-rounded-lg hover:u-bg-success-hover u-transition-colors"
              >
                Save Prompt
              </button>
            </div>
          </div>
        )}
        
        <div className="unified-chat-content u-flex u-flex-1 u-min-h-0">
          <div className="u-flex-1 u-flex u-flex-col">
            {/* Suggestions Panel for refinement mode */}
            {onRefinementInstruction && features.suggestions && messages.length <= 1 && (
              <SuggestionsPanel
                suggestions={suggestedPrompts}
                onSuggestionClick={handleSuggestionClick}
                isProcessing={isProcessing}
              />
            )}
            
            <MessageList
              messages={messages.slice(-maxMessages)}
              variant={theme.variant === 'system' ? 'light' : theme.variant}
              showMetadata={features.metadata}
              isConnected={isConnected}
            />
            
            {/* Typing Indicator */}
            {(isTyping || isLoading) && (
              <TypingIndicator 
                isVisible={true} 
                variant={theme.variant === 'system' ? 'light' : theme.variant}
              />
            )}
            
            <div ref={messagesEndRef} />
            
            {/* Input Section */}
            <div className="unified-input-section u-flex-shrink-0 u-p-4 u-border-t u-border-primary">
              <MessageInput
                value={inputValue}
                onChange={setInputValue}
                onSend={onRefinementInstruction ? handleRefinementMessage : handleSendMessage}
                placeholder={computedPlaceholder}
                disabled={disabled || !isConnected}
                enableVoiceInput={features.voiceInput ?? enableVoiceInput}
                enableFileUpload={features.fileUpload ?? enableFileUpload}
                variant={theme.variant === 'system' ? 'light' : theme.variant}
                maxLength={1000}
                showCharacterCount={true}
              />
              
              {/* Connection Status Message */}
              {!isConnected && (
                <div className="unified-connection-status u-mt-2 u-flex u-items-center u-justify-center">
                  <span className="u-text-xs u-px-2 u-py-1 u-rounded u-text-error u-bg-error-light">
                    Disconnected - Messages cannot be sent
                  </span>
                  {onReconnect && (
                    <button
                      onClick={onReconnect}
                      className="u-ml-2 u-text-xs u-text-primary hover:u-text-primary-hover u-underline focus:u-outline-none"
                    >
                      Reconnect
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Database Panel */}
          {features.database && (
            <DatabasePanel 
              emailSuggestions={emailSuggestions}
            />
          )}
        </div>
      </>
    );

    switch (variant) {
      case 'modal':
        return (
          <div className="unified-chat-modal u-fixed u-inset-0 u-bg-black/50 u-backdrop-blur-sm u-z-50 u-flex u-items-center u-justify-center u-p-4">
            <div className="unified-chat-modal-content u-rounded-xl u-border u-border-primary u-w-full u-max-w-4xl u-h-[80vh] u-flex u-flex-col u-bg-surface">
              {content}
            </div>
          </div>
        );
      
      case 'panel':
        return (
          <div className="unified-chat-panel u-flex u-flex-col u-h-full u-bg-surface u-text-primary">
            {content}
          </div>
        );
      
      case 'widget':
        return (
          <div className={`unified-chat-widget u-w-80 u-h-96 u-rounded-lg u-border u-border-primary u-shadow-card u-flex u-flex-col u-bg-surface ${className}`}>
            {content}
          </div>
        );
      
      default: // embedded
        return (
          <div
            className={`unified-chat-embedded u-border u-border-primary u-rounded-lg u-shadow-card u-transition-all u-duration-300 u-ease-in-out u-flex u-flex-col u-bg-surface ${
              isExpanded ? 'u-h-96' : 'u-h-64'
            } ${className}`}
            onKeyDown={handleKeyboardShortcut}
            role="region"
            aria-label="Chat interface"
          >
            {content}
          </div>
        );
    }
  };

  // Handle case where no draft is provided for refinement mode
  if (onRefinementInstruction && !draft) {
    return (
      <div className={`unified-chat-empty u-flex u-items-center u-justify-center u-h-full u-text-secondary ${className}`}>
        <div className="u-text-center">
          <Icons.messageSquare className="u-w-16 u-h-16 u-mx-auto u-mb-4 u-opacity-50" />
          <p className="u-text-lg u-font-medium">AI Conversation Ready</p>
          <p className="u-text-sm">Generate a draft first to start refining with natural language</p>
        </div>
      </div>
    );
  }

  return renderContent();
};