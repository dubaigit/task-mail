export interface ChatMessage {
  id: string;
  content: string;
  timestamp: Date;
  sender: 'user' | 'assistant';
  type: MessageType;
  metadata?: {
    confidence?: number;
    tokens?: number;
    model?: string;
  };
}

export type MessageType = 'text' | 'command' | 'response' | 'error' | 'system' | 'typing';

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  title?: string;
}

export interface ChatState {
  currentSession: ChatSession | null;
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
}