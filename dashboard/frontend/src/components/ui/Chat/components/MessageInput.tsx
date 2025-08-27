import React, { useState, useRef, useCallback } from 'react';
import { Icons } from '../../icons';
import { useVoiceInput } from '../hooks/useChatInterface';

export interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
  enableVoiceInput?: boolean;
  enableFileUpload?: boolean;
  variant?: 'light' | 'dark';
  maxLength?: number;
  showCharacterCount?: boolean;
  onFileUpload?: (files: FileList) => void;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  value,
  onChange,
  onSend,
  placeholder = "Type your message...",
  disabled = false,
  enableVoiceInput = false,
  enableFileUpload = false,
  variant: _variant = 'light',
  maxLength = 1000,
  showCharacterCount = false,
  onFileUpload
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // const _isDark = variant === 'dark'; // Currently unused
  
  // Voice input hook
  const {
    startListening,
    stopListening,
    isSupported: isVoiceSupported,
    isListening
  } = useVoiceInput();

  // Handle form submission
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !disabled) {
      onSend(value.trim());
      onChange('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  }, [value, disabled, onSend, onChange]);

  // Handle key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }, [handleSubmit]);

  // Auto-resize textarea
  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    onChange(textarea.value);
  }, [onChange]);

  // Handle voice input toggle
  const handleVoiceToggle = useCallback(() => {
    if (isRecording || isListening) {
      stopListening();
      setIsRecording(false);
    } else {
      try {
        startListening((transcript) => {
          onChange(value + ' ' + transcript);
        });
        setIsRecording(true);
      } catch (error) {
        console.error('Failed to start recording:', error);
        setIsRecording(false);
      }
    }
  }, [isRecording, isListening, startListening, stopListening, onChange, value]);

  // Handle file upload
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && onFileUpload) {
      onFileUpload(files);
    }
    // Reset input
    e.target.value = '';
  }, [onFileUpload]);

  // Character count and validation
  const characterCount = value.length;
  const isOverLimit = characterCount > maxLength;
  const isNearLimit = characterCount > maxLength * 0.8;

  return (
    <form onSubmit={handleSubmit} className="unified-message-input-form u-relative">
      <div className={`unified-message-input-container u-relative u-rounded-lg u-border u-border-primary u-transition-all u-duration-200 ${
        disabled 
          ? 'u-bg-surface-secondary u-opacity-50'
          : 'u-bg-card focus-within:u-border-primary-focus focus-within:u-ring-1 focus-within:u-ring-primary-focus'
      }`}>
        {/* File input (hidden) */}
        {enableFileUpload && (
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileUpload}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.txt"
            disabled={disabled}
          />
        )}
        
        {/* Main textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyPress}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          rows={1}
          className={`unified-message-textarea u-block u-w-full u-resize-none u-border-0 u-bg-transparent u-px-4 u-py-3 u-pr-20 u-text-sm u-placeholder-secondary focus:u-ring-0 ${
            isOverLimit ? 'u-text-error' : 'u-text-primary'
          }`}
          style={{ 
            minHeight: '48px',
            maxHeight: '120px'
          }}
          aria-label="Message input"
          aria-describedby={showCharacterCount ? 'char-count' : undefined}
        />
        
        {/* Action buttons */}
        <div className="unified-message-actions u-absolute u-right-2 u-bottom-2 u-flex u-items-center u-gap-1">
          {/* File upload button */}
          {enableFileUpload && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className={`unified-icon-button u-p-2 u-rounded-md u-transition-colors ${
                disabled 
                  ? 'u-opacity-50 u-cursor-not-allowed'
                  : 'u-text-secondary hover:u-text-primary hover:u-bg-surface-secondary'
              }`}
              title="Upload file"
            >
              <Icons.paperclip className="u-w-4 u-h-4" />
            </button>
          )}
          
          {/* Voice input button */}
          {enableVoiceInput && isVoiceSupported && (
            <button
              type="button"
              onClick={handleVoiceToggle}
              disabled={disabled}
              className={`unified-voice-button u-p-2 u-rounded-md u-transition-colors ${
                isRecording || isListening
                  ? 'u-text-error u-bg-error-light hover:u-bg-error-hover'
                  : disabled 
                    ? 'u-opacity-50 u-cursor-not-allowed'
                    : 'u-text-secondary hover:u-text-primary hover:u-bg-surface-secondary'
              }`}
              title={isRecording ? "Stop recording" : "Start voice input"}
            >
              {isRecording || isListening ? (
                <Icons.square className="u-w-4 u-h-4" />
              ) : (
                <Icons.mic className="u-w-4 u-h-4" />
              )}
            </button>
          )}
          
          {/* Send button */}
          <button
            type="submit"
            disabled={disabled || !value.trim() || isOverLimit}
            className={`unified-send-button u-p-2 u-rounded-md u-transition-colors ${
              disabled || !value.trim() || isOverLimit
                ? 'u-opacity-50 u-cursor-not-allowed u-text-secondary'
                : 'u-text-primary u-bg-primary-light hover:u-text-primary-hover hover:u-bg-primary-hover focus:u-outline-none focus:u-ring-2 focus:u-ring-primary focus:u-ring-offset-1'
            }`}
            title="Send message"
          >
            <Icons.send className="u-w-4 u-h-4" />
          </button>
        </div>
        
        {/* Voice recording indicator */}
        {(isRecording || isListening) && (
          <div className="unified-recording-indicator u-absolute u-left-4 u-bottom-2 u-flex u-items-center u-gap-2">
            <div className="u-flex u-items-center u-gap-1">
              <div className="u-w-2 u-h-2 u-bg-error u-rounded-full u-animate-pulse" />
              <span className="u-text-xs u-text-error">
                Recording...
              </span>
            </div>
          </div>
        )}
      </div>
      
      {/* Character count */}
      {showCharacterCount && (
        <div className="unified-character-count u-flex u-justify-between u-items-center u-mt-2 u-px-1">
          <div className="u-flex u-items-center u-gap-2 u-text-xs">
            {/* Voice input status handled by recording indicator */}
          </div>
          <div
            id="char-count"
            className={`u-text-xs ${
              isOverLimit 
                ? 'u-text-error u-font-medium' 
                : isNearLimit 
                  ? 'u-text-warning'
                  : 'u-text-secondary'
            }`}
          >
            {characterCount}/{maxLength}
          </div>
        </div>
      )}
      
      {/* Error message for over limit */}
      {isOverLimit && (
        <p className="unified-error-message u-mt-1 u-text-xs u-text-error">
          Message is too long. Please reduce by {characterCount - maxLength} characters.
        </p>
      )}
    </form>
  );
};