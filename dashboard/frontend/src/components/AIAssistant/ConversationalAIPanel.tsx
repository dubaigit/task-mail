import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Icons } from '../ui/icons';

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
  content: string;
  confidence: number;
  version: number;
}

interface ConversationMessage {
  id: string;
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: string;
  instruction?: string;
  preview?: string;
  applied?: boolean;
  processing?: boolean;
}

interface SuggestedPrompt {
  id: string;
  text: string;
  description: string;
  icon: React.ReactNode;
  category: 'tone' | 'length' | 'content' | 'style';
}

interface ConversationalAIPanelProps {
  draft: Draft | null;
  email: Email | null;
  onRefinementInstruction: (instruction: string) => Promise<void>;
  isProcessing?: boolean;
  className?: string;
}

const ConversationalAIPanel: React.FC<ConversationalAIPanelProps> = ({
  draft,
  email,
  onRefinementInstruction,
  isProcessing = false,
  className = ''
}) => {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [currentInstruction, setCurrentInstruction] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Suggested prompts for different refinement types
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
      icon: <Icons.rotate className="w-4 h-4" />,
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

  // Initialize conversation when draft changes
  useEffect(() => {
    if (draft && messages.length === 0) {
      const welcomeMessage: ConversationMessage = {
        id: 'welcome',
        type: 'ai',
        content: `I've generated a draft response for "${email?.subject}". How would you like to refine it? You can ask me to adjust the tone, length, add specific content, or make any other changes.`,
        timestamp: new Date().toISOString()
      };
      setMessages([welcomeMessage]);
    }
  }, [draft, email, messages.length]);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Set up speech recognition if available
  useEffect(() => {
    const windowWithSpeech = window as any;
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = windowWithSpeech.webkitSpeechRecognition || windowWithSpeech.SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const handleSendMessage = useCallback(async (instruction?: string) => {
    const messageText = instruction || inputText.trim();
    if (!messageText || isProcessing) return;

    const userMessage: ConversationMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: messageText,
      timestamp: new Date().toISOString(),
      instruction: messageText
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setCurrentInstruction(messageText);

    // Add processing message
    const processingMessage: ConversationMessage = {
      id: `processing-${Date.now()}`,
      type: 'ai',
      content: 'Processing your request...',
      timestamp: new Date().toISOString(),
      processing: true
    };

    setMessages(prev => [...prev, processingMessage]);

    try {
      await onRefinementInstruction(messageText);
      
      // Remove processing message and add success message
      setMessages(prev => {
        const filtered = prev.filter(msg => !msg.processing);
        const successMessage: ConversationMessage = {
          id: `success-${Date.now()}`,
          type: 'ai',
          content: `I've updated the draft based on your request: "${messageText}". The changes have been applied. Is there anything else you'd like me to adjust?`,
          timestamp: new Date().toISOString(),
          applied: true
        };
        return [...filtered, successMessage];
      });
    } catch (error) {
      // Remove processing message and add error message
      setMessages(prev => {
        const filtered = prev.filter(msg => !msg.processing);
        const errorMessage: ConversationMessage = {
          id: `error-${Date.now()}`,
          type: 'ai',
          content: `I encountered an issue processing your request: "${messageText}". Please try rephrasing your instruction or try a different approach.`,
          timestamp: new Date().toISOString()
        };
        return [...filtered, errorMessage];
      });
    }
  }, [inputText, isProcessing, onRefinementInstruction]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getCategoryColor = (category: SuggestedPrompt['category']) => {
    switch (category) {
      case 'tone': return 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100';
      case 'length': return 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100';
      case 'content': return 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100';
      case 'style': return 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100';
      default: return 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100';
    }
  };

  if (!draft) {
    return (
      <div className={`flex items-center justify-center h-full text-muted-foreground ${className}`}>
        <div className="text-center">
          <Icons.messageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">AI Conversation Ready</p>
          <p className="text-sm">Generate a draft first to start refining with natural language</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-background ${className}`}>
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center space-x-2">
          <Icons.sparkles className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Conversational Refinement</h3>
          <span className="text-sm text-muted-foreground">
            Tell me how to improve your draft
          </span>
        </div>
      </div>

      {/* Suggested Prompts */}
      {messages.length <= 1 && (
        <div className="border-b border-border p-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Try these suggestions:</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {suggestedPrompts.slice(0, 4).map((prompt) => (
              <button
                key={prompt.id}
                onClick={() => handleSendMessage(prompt.text)}
                disabled={isProcessing}
                className={`flex items-start space-x-2 p-3 text-left text-sm border rounded-lg transition-colors disabled:opacity-50 ${getCategoryColor(prompt.category)}`}
              >
                {prompt.icon}
                <div>
                  <div className="font-medium">{prompt.text}</div>
                  <div className="text-xs opacity-75">{prompt.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.type === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : message.processing
                  ? 'bg-muted border border-border'
                  : message.applied
                  ? 'bg-green-50 border border-green-200 text-green-800'
                  : 'bg-muted border border-border'
              }`}
            >
              <div className="text-sm">{message.content}</div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs opacity-75">
                  {formatTime(message.timestamp)}
                </span>
                {message.processing && (
                  <Icons.rotate className="w-3 h-3 animate-spin" />
                )}
                {message.applied && (
                  <Icons.checkCircle className="w-3 h-3" />
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border p-4">
        <div className="flex items-end space-x-2">
          <div className="flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Tell me how to improve the draft (e.g., 'make it more formal', 'add a deadline')"
              disabled={isProcessing}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            />
          </div>

          {/* Voice Input Button */}
          {recognitionRef.current && (
            <button
              onClick={toggleListening}
              disabled={isProcessing}
              className={`p-2 rounded-lg border border-border transition-colors disabled:opacity-50 ${
                isListening 
                  ? 'bg-red-50 border-red-200 text-red-600' 
                  : 'bg-background hover:bg-muted'
              }`}
              title={isListening ? 'Stop listening' : 'Start voice input'}
            >
              {isListening ? (
                <Icons.stop className="w-5 h-5" />
              ) : (
                <Icons.mic className="w-5 h-5" />
              )}
            </button>
          )}

          {/* Send Button */}
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || isProcessing}
            className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            title="Send message"
          >
            <Icons.send className="w-5 h-5" />
          </button>
        </div>

        {/* Additional Suggestions */}
        {messages.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {suggestedPrompts.slice(4).map((prompt) => (
              <button
                key={prompt.id}
                onClick={() => handleSendMessage(prompt.text)}
                disabled={isProcessing}
                className="inline-flex items-center space-x-1 px-2 py-1 text-xs bg-muted border border-border rounded-md hover:bg-muted/80 disabled:opacity-50 transition-colors"
              >
                {prompt.icon}
                <span>{prompt.text}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationalAIPanel;
export { ConversationalAIPanel };