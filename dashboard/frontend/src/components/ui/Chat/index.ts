// Main unified chat component
export { UnifiedChat } from './UnifiedChat';

// Types
export type { 
  ChatMessage, 
  UnifiedChatProps, 
  ChatFeatures, 
  ChatTheme, 
  SuggestedPrompt
} from './types';

// Hooks
export { useChatInterface, useVoiceInput } from './hooks/useChatInterface';

// Components
export { ChatHeader, ConnectionStatus } from './components/ChatHeader';
export { MessageList } from './components/MessageList';
export { MessageInput } from './components/MessageInput';
export { TypingIndicator } from './components/TypingIndicator';
export { DatabasePanel } from './components/DatabasePanel';
export { SuggestionsPanel } from './components/SuggestionsPanel';

// Legacy compatibility - all now use UnifiedChat
// Note: Components migrated to UnifiedChat system