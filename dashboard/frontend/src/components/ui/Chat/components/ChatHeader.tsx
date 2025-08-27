import React from 'react';
import { 
  ChevronUpIcon, 
  XMarkIcon,
  WifiIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon
} from '../../icons';
import { ChatHeaderProps } from '../types';

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  title,
  isConnected = true,
  isExpanded = false,
  onToggleExpanded,
  onClose,
  showConnectionStatus = false,
  messageCount = 0,
  actions,
  variant: _variant = 'light'
}) => {
  // const _isDark = variant === 'dark'; // Currently unused
  
  return (
    <div className="unified-chat-header u-flex u-items-center u-justify-between u-p-3 u-border-b u-border-primary u-bg-surface u-text-primary u-rounded-t-lg">
      <div className="u-flex u-items-center u-gap-2">
        <h3 className="u-font-medium u-text-primary">
          {title}
        </h3>
        
        {showConnectionStatus && (
          <div className="u-flex u-items-center u-gap-1">
            {isConnected ? (
              <>
                <WifiIcon className="u-w-4 u-h-4 u-text-success" />
                <span className="u-text-xs u-text-success">Connected</span>
              </>
            ) : (
              <>
                <ExclamationTriangleIcon className="u-w-4 u-h-4 u-text-error" />
                <span className="u-text-xs u-text-error">Disconnected</span>
              </>
            )}
          </div>
        )}
      </div>
      
      <div className="u-flex u-items-center u-gap-2">
        {/* Message Count */}
        {messageCount > 0 && (
          <span className="u-text-xs u-text-secondary">
            {messageCount} message{messageCount !== 1 ? 's' : ''}
          </span>
        )}
        
        {/* Custom Actions */}
        {actions}
        
        {/* Expand/Collapse Button */}
        {onToggleExpanded && (
          <button
            onClick={onToggleExpanded}
            className={`unified-icon-button u-p-1 u-rounded-md u-transition-colors u-text-secondary hover:u-bg-surface-secondary focus:u-bg-surface-secondary`}
            aria-label={isExpanded ? 'Collapse chat' : 'Expand chat'}
            aria-expanded={isExpanded}
          >
            <ChevronUpIcon 
              className={`u-w-4 u-h-4 u-transition-transform u-duration-200 ${isExpanded ? 'u-rotate-180' : ''}`}
            />
          </button>
        )}
        
        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="unified-icon-button u-p-1 u-rounded-md u-transition-colors u-text-secondary hover:u-bg-surface-secondary focus:u-bg-surface-secondary"
            aria-label="Close chat"
          >
            <XMarkIcon className="u-w-4 u-h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export const ConnectionStatus: React.FC<{
  isConnected: boolean;
  onReconnect?: () => void;
}> = ({ isConnected, onReconnect }) => {
  if (isConnected) {
    return (
      <div className="u-flex u-items-center u-gap-1">
        <div className="u-w-2 u-h-2 u-bg-success u-rounded-full"></div>
        <span className="u-text-xs u-text-success">Online</span>
      </div>
    );
  }

  return (
    <div className="u-flex u-items-center u-gap-1">
      <div className="u-w-2 u-h-2 u-bg-error u-rounded-full"></div>
      <span className="u-text-xs u-text-error">Offline</span>
      {onReconnect && (
        <button
          onClick={onReconnect}
          className="u-ml-1 u-text-xs u-text-primary hover:u-text-primary-hover u-underline focus:u-outline-none"
          title="Reconnect"
        >
          <ArrowPathIcon className="u-w-3 u-h-3" />
        </button>
      )}
    </div>
  );
};