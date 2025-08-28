import React, { useState } from 'react';
import { UnifiedChat } from '../UnifiedChat';
import { ChatMessage, MessageType } from '../types';

/**
 * Usage examples for the UnifiedChat component
 * Demonstrates different variants and configurations
 */

// Example 1: Basic embedded chat
export const BasicChatExample = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'ai',
      content: 'Hello! I\'m your AI assistant. How can I help you today?',
      timestamp: new Date().toISOString()
    }
  ]);

  const handleSendMessage = (message: string, type?: MessageType) => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);

    // Simulate AI response
    setTimeout(() => {
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: `I received your message: "${message}". How else can I assist you?`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, aiMessage]);
    }, 1000);
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4">Basic Chat Example</h3>
      <UnifiedChat
        messages={messages}
        onSendMessage={handleSendMessage}
        variant="embedded"
        theme={{ variant: 'light' }}
        features={{
          accessibility: true,
          connectionStatus: true
        }}
      />
    </div>
  );
};

// Example 2: AI Chat with Database Panel (Dark Theme)
export const AIChatExample = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'ai',
      content: '👋 Welcome to AI Email Assistant! I have access to your email database and can help you with various tasks.',
      timestamp: new Date().toISOString(),
      metadata: {
        queryType: 'analysis',
        emailsReferenced: 0
      }
    }
  ]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSendMessage = (message: string, type?: MessageType) => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);

    // Simulate AI response with metadata
    setTimeout(() => {
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: `I found 3 emails matching your query. Let me help you analyze them.`,
        timestamp: new Date().toISOString(),
        metadata: {
          queryType: 'search',
          emailsReferenced: 3,
          executionTime: 234
        }
      };
      setMessages(prev => [...prev, aiMessage]);
    }, 1500);
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4">AI Chat with Database Panel</h3>
      <button
        onClick={() => setIsModalOpen(true)}
        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
      >
        Open AI Chat
      </button>
      
      {isModalOpen && (
        <UnifiedChat
          messages={messages}
          onSendMessage={handleSendMessage}
          variant="modal"
          theme={{ variant: 'dark' }}
          features={{
            ai: true,
            database: true,
            systemPrompt: true,
            metadata: true
          }}
          title="AI Email Assistant"
          placeholder="Ask me about your emails, request drafts, or create automation rules..."
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
};

// Example 3: Conversational Refinement Panel
export const RefinementPanelExample = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const draft = {
    id: 1,
    content: 'Dear John, I hope this email finds you well...',
    confidence: 0.85,
    version: 1
  };
  const email = {
    id: 1,
    subject: 'Budget Proposal Discussion',
    sender: 'john@company.com',
    classification: 'business',
    urgency: 'medium'
  };

  const handleRefinementInstruction = async (instruction: string) => {
    // Simulate refinement processing
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 1000);
    });
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4">Conversational Refinement Panel</h3>
      <div className="h-96 border rounded-lg">
        <UnifiedChat
          messages={messages}
          onSendMessage={() => {}}
          variant="panel"
          theme={{ variant: 'system' }}
          features={{
            voiceInput: true,
            suggestions: true,
            ai: true
          }}
          title="Conversational Refinement"
          draft={draft}
          email={email}
          onRefinementInstruction={handleRefinementInstruction}
          placeholder="Tell me how to improve the draft"
          enableVoiceInput={true}
        />
      </div>
    </div>
  );
};

// Example 4: Chat Widget
export const ChatWidgetExample = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const handleSendMessage = (message: string) => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4">Chat Widget</h3>
      <div className="flex justify-center">
        <UnifiedChat
          messages={messages}
          onSendMessage={handleSendMessage}
          variant="widget"
          theme={{ variant: 'light' }}
          title="Help Chat"
          placeholder="Ask a question..."
        />
      </div>
    </div>
  );
};

// Example 5: Feature Showcase
export const FeatureShowcaseExample = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'ai',
      content: 'This chat demonstrates all available features including voice input, file upload, and rich metadata display.',
      timestamp: new Date().toISOString(),
      metadata: {
        queryType: 'analysis',
        emailsReferenced: 5,
        executionTime: 120
      }
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);

  const handleSendMessage = (message: string, type?: MessageType) => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      setIsTyping(false);
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: `Feature demonstration: Your ${type || 'text'} message "${message}" was processed successfully.`,
        timestamp: new Date().toISOString(),
        metadata: {
          queryType: type === 'search' ? 'search' : 'analysis',
          emailsReferenced: Math.floor(Math.random() * 10),
          executionTime: Math.floor(Math.random() * 500) + 100
        }
      };
      setMessages(prev => [...prev, aiMessage]);
    }, 2000);
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4">Feature Showcase</h3>
      <UnifiedChat
        messages={messages}
        onSendMessage={handleSendMessage}
        variant="embedded"
        theme={{ variant: 'light' }}
        features={{
          ai: true,
          voiceInput: true,
          fileUpload: true,
          metadata: true,
          connectionStatus: true,
          accessibility: true,
          typing: true
        }}
        title="Feature Demo"
        isTyping={isTyping}
        placeholder="Try voice input, file upload, or type a message..."
        enableVoiceInput={true}
        enableFileUpload={true}
        className="h-96"
      />
    </div>
  );
};

// Complete examples component
export const UnifiedChatExamples = () => {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">UnifiedChat Examples</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Explore different configurations and use cases for the unified chat system.
          Each example demonstrates specific features and variants.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <BasicChatExample />
        <ChatWidgetExample />
      </div>

      <AIChatExample />
      <RefinementPanelExample />
      <FeatureShowcaseExample />
    </div>
  );
};
