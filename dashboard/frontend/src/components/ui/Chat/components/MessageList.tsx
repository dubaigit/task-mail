import React from 'react';
import { Icons, MagnifyingGlassIcon, EnvelopeIcon, CogIcon, DatabaseIcon, SparklesIcon, ArrowPathIcon, CheckCircleIcon, CopyIcon, UserIcon } from '../../icons';
import { MessageListProps, ChatMessage } from '../types';

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  variant: _variant = 'light',
  showMetadata = false,
  isConnected = true,
  onMessageAction,
  className = ''
}) => {
  // const _isDark = variant === 'dark'; // Currently unused
  
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const copyMessage = (content: string, messageId: string) => {
    navigator.clipboard.writeText(content);
    if (onMessageAction) {
      onMessageAction(messageId, 'copied');
    }
  };

  const getQueryTypeIcon = (type?: string) => {
    switch (type) {
      case 'search': return <MagnifyingGlassIcon className="w-3 h-3" />;
      case 'compose': return <EnvelopeIcon className="w-3 h-3" />;
      case 'automation': return <CogIcon className="w-3 h-3" />;
      default: return <DatabaseIcon className="w-3 h-3" />;
    }
  };

  const getQueryTypeColor = (type?: string) => {
    switch (type) {
      case 'search': return 'u-text-primary';
      case 'compose': return 'u-text-success';
      case 'automation': return 'u-text-warning';
      default: return 'u-text-secondary';
    }
  };

  const renderMessage = (message: ChatMessage) => {
    const isUser = message.type === 'user' || message.sender === 'user';
    const isAI = message.type === 'ai' || message.sender === 'assistant';
    // const _isSystem = message.type === 'system'; // Currently unused

    return (
      <div
        key={message.id}
        className={`u-flex u-gap-3 ${isUser ? 'u-justify-end' : 'u-justify-start'}`}
      >
        {/* Avatar - AI/System */}
        {!isUser && (
          <div className={`unified-avatar u-flex-shrink-0 u-w-8 u-h-8 u-rounded-full u-flex u-items-center u-justify-center ${
            isAI 
              ? 'u-bg-primary-light' 
              : 'u-bg-surface-secondary'
          }`}>
            {isAI ? (
              <SparklesIcon className="u-w-4 u-h-4 u-text-primary" />
            ) : (
              <CogIcon className="u-w-4 u-h-4 u-text-secondary" />
            )}
          </div>
        )}
        
        <div className={`unified-message-content u-max-w-[80%] ${isUser ? 'u-order-last' : ''}`}>
          {/* Message Bubble */}
          <div
            className={`unified-message-bubble u-rounded-lg u-p-3 u-border u-border-primary ${
              isUser
                ? 'u-bg-primary u-text-white'
                : message.processing
                ? 'u-bg-surface-secondary u-text-secondary'
                : message.applied
                ? 'u-bg-success-light u-text-success'
                : 'u-bg-card u-text-primary'
            }`}
          >
            <div className={`u-text-sm u-whitespace-pre-wrap ${
              isUser 
                ? 'u-text-white'
                : 'u-text-primary'
            }`}>
              {message.content}
            </div>
            
            {/* Metadata */}
            {showMetadata && message.metadata && (
              <div className="u-flex u-items-center u-gap-3 u-mt-2 u-pt-2 u-border-t u-border-primary u-text-xs u-text-secondary">
                <div className={`flex items-center gap-1 ${getQueryTypeColor(message.metadata.queryType)}`}>
                  {getQueryTypeIcon(message.metadata.queryType)}
                  <span>{message.metadata.queryType}</span>
                </div>
                {message.metadata.emailsReferenced && message.metadata.emailsReferenced > 0 && (
                  <span>{message.metadata.emailsReferenced} emails</span>
                )}
                {message.metadata.executionTime && (
                  <span>{message.metadata.executionTime}ms</span>
                )}
              </div>
            )}
            
            {/* Processing/Applied Status */}
            <div className="u-flex u-items-center u-justify-between u-mt-2">
              <span className="u-text-xs u-text-secondary">
                {formatTime(message.timestamp)}
              </span>
              <div className="u-flex u-items-center u-gap-1">
                {message.processing && (
                  <ArrowPathIcon className="u-w-3 u-h-3 u-animate-spin" />
                )}
                {message.applied && (
                  <CheckCircleIcon className="u-w-3 u-h-3 u-text-success" />
                )}
              </div>
            </div>
          </div>
          
          {/* Actions */}
          <div className="u-flex u-items-center u-gap-2 u-mt-1 u-text-xs u-text-secondary">
            <Icons.clock className="u-w-3 u-h-3" />
            <span>{formatTime(message.timestamp)}</span>
            <button
              onClick={() => copyMessage(message.content, message.id)}
              className="unified-icon-button u-p-1 u-rounded-md u-transition-colors hover:u-bg-surface-secondary"
              title="Copy message"
            >
              <CopyIcon className="u-w-3 u-h-3" />
            </button>
          </div>
        </div>

        {/* Avatar - User */}
        {isUser && (
          <div className="unified-avatar u-flex-shrink-0 u-w-8 u-h-8 u-rounded-full u-flex u-items-center u-justify-center u-bg-primary-light">
            <UserIcon className="u-w-4 u-h-4 u-text-primary" />
          </div>
        )}
      </div>
    );
  };

  if (messages.length === 0) {
    return (
      <div className={`unified-message-empty u-flex-1 u-flex u-items-center u-justify-center u-text-secondary ${className}`}>
        <div className="u-text-center">
          <SparklesIcon className="u-w-12 u-h-12 u-mx-auto u-mb-2 u-opacity-50" />
          <p>Start a conversation</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`unified-message-list u-flex-1 u-overflow-y-auto u-p-4 u-gap-4 ${className}`}>
      {messages.map(renderMessage)}
      
      {!isConnected && (
        <div className="unified-connection-warning u-text-center u-p-3 u-rounded-lg u-bg-error-light u-text-error">
          <div className="u-text-sm u-font-medium">Connection Lost</div>
          <div className="u-text-xs u-mt-1">Messages may not be delivered</div>
        </div>
      )}
    </div>
  );
};