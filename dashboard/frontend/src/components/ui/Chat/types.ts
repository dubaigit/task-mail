export interface ChatMessage {
  id: string;
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: string;
  sender?: 'user' | 'assistant' | 'ai';
  instruction?: string;
  preview?: string;
  applied?: boolean;
  processing?: boolean;
  metadata?: {
    emailsReferenced?: number;
    queryType?: 'search' | 'analysis' | 'compose' | 'automation';
    executionTime?: number;
    sqlQuery?: string;
    emailIds?: string[];
  };
}

export type MessageType = 'text' | 'command' | 'search' | 'compose';

export interface ChatFeatures {
  ai?: boolean;
  database?: boolean;
  voiceInput?: boolean;
  suggestions?: boolean;
  systemPrompt?: boolean;
  metadata?: boolean;
  accessibility?: boolean;
  connectionStatus?: boolean;
  fileUpload?: boolean;
  quickActions?: boolean;
  typing?: boolean;
}

export interface ChatTheme {
  variant: 'light' | 'dark' | 'system';
  colors?: {
    background?: string;
    border?: string;
    text?: string;
    accent?: string;
    userMessage?: string;
    aiMessage?: string;
    systemMessage?: string;
  };
}

export interface UnifiedChatProps {
  // Core functionality
  messages: ChatMessage[];
  onSendMessage: (message: string, type?: MessageType) => void;
  
  // Configuration
  variant?: 'modal' | 'embedded' | 'panel' | 'widget';
  features?: ChatFeatures;
  theme?: ChatTheme;
  
  // Behavior
  isTyping?: boolean;
  isConnected?: boolean;
  isProcessing?: boolean;
  isLoading?: boolean;
  onReconnect?: () => void;
  onClose?: () => void;
  
  // Refinement specific (for ConversationalAIPanel)
  draft?: any;
  email?: any;
  onRefinementInstruction?: (instruction: string) => Promise<void>;
  
  // Customization
  title?: string;
  placeholder?: string;
  maxMessages?: number;
  disabled?: boolean;
  className?: string;
  showConnectionStatus?: boolean;
  enableFileUpload?: boolean;
  enableVoiceInput?: boolean;
}

export interface SuggestedPrompt {
  id: string;
  text: string;
  description: string;
  icon: React.ReactNode;
  category: 'tone' | 'length' | 'content' | 'style';
}

export interface EmailSuggestion {
  id: string;
  subject: string;
  sender: string;
  preview: string;
  relevanceScore?: number;
}

export interface ChatConfiguration {
  disabled: boolean;
  isConnected: boolean;
  onSendMessage: (message: string, type?: MessageType) => void;
}

export interface ChatHeaderProps {
  title: string;
  isConnected?: boolean;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  onClose?: () => void;
  showConnectionStatus?: boolean;
  messageCount?: number;
  actions?: React.ReactNode;
  variant?: 'light' | 'dark';
}

export interface MessageListProps {
  messages: ChatMessage[];
  variant?: 'light' | 'dark' | 'system';
  showMetadata?: boolean;
  isConnected?: boolean;
  onMessageAction?: (messageId: string, action: string) => void;
  className?: string;
}

export interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (message: string, type?: MessageType) => void;
  placeholder?: string;
  disabled?: boolean;
  enableVoiceInput?: boolean;
  enableFileUpload?: boolean;
  showCharacterCount?: boolean;
  maxLength?: number;
  variant?: 'light' | 'dark';
  className?: string;
}

export interface DatabasePanelProps {
  emailSuggestions?: EmailSuggestion[];
  onQuickAction?: (action: string) => void;
  className?: string;
}

export interface SuggestionsPanelProps {
  suggestions: SuggestedPrompt[];
  onSuggestionClick: (suggestion: SuggestedPrompt) => void;
  isProcessing?: boolean;
  className?: string;
}