/**
 * Chat Integration Example
 * Demonstrates unified design system integration with existing Chat components
 * This example shows the elimination of the 4 different styling approaches
 */

import React, { useState } from 'react';
import { UnifiedChat } from '../../components/ui/Chat';
import { ChatMessage } from '../../components/ui/Chat/types';
import { setupDesignSystem } from './setup';

// Initialize the design system
setupDesignSystem();

// BEFORE: The chaotic mix of 4 different styling approaches
const ChaoticChatExample: React.FC = () => {
  return (
    <div>
      {/* Approach 1: Traditional Tailwind */}
      <div className="bg-gray-50 text-gray-900 p-4 rounded-lg border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Traditional Tailwind</h3>
        <p className="text-sm text-gray-600">Hardcoded color values that don't adapt to themes</p>
      </div>
      
      {/* Approach 2: Dark Slate Theme */}
      <div className="bg-slate-900 text-slate-300 p-4 rounded-lg border border-slate-700">
        <h3 className="text-lg font-medium text-white mb-2">Dark Slate Theme</h3>
        <p className="text-sm text-slate-400">Different color system, inconsistent with app</p>
      </div>
      
      {/* Approach 3: CSS Variables (partial) */}
      <div style={{ 
        background: 'var(--background)', 
        color: 'var(--foreground)',
        padding: '16px',
        borderRadius: '8px',
        border: '1px solid #ccc' // Still mixing with hardcoded colors!
      }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: '500', marginBottom: '8px' }}>CSS Variables</h3>
        <p style={{ fontSize: '0.875rem', color: '#666' }}>Inconsistent implementation</p>
      </div>
      
      {/* Approach 4: Hardcoded Colors */}
      <div style={{
        background: '#ffffff',
        color: '#DC2626', // Hardcoded red
        padding: '16px',
        borderRadius: '8px',
        border: '1px solid #EA580C' // Hardcoded orange
      }}>
        <h3 style={{ color: '#111827', fontSize: '1.125rem', fontWeight: '500' }}>Hardcoded</h3>
        <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>No theme support, accessibility issues</p>
      </div>
    </div>
  );
};

// AFTER: Unified design system approach
const UnifiedChatExample: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'ai',
      content: 'Hello! I\'m your AI assistant. I can help you with email management, task creation, and workflow automation. All styled with our unified design system!',
      timestamp: new Date().toISOString()
    },
    {
      id: '2', 
      type: 'user',
      content: 'Great! Show me how the unified styling works across different themes.',
      timestamp: new Date().toISOString()
    },
    {
      id: '3',
      type: 'ai',
      content: 'Perfect! Notice how all components use semantic color tokens like `u-text-primary`, `u-bg-surface`, and `u-border-primary`. This ensures consistent theming across light, dark, and high-contrast modes.',
      timestamp: new Date().toISOString(),
      metadata: {
        queryType: 'compose',
        executionTime: 150
      }
    }
  ]);

  const handleSendMessage = (message: string) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, newMessage]);
    
    // Simulate AI response
    setTimeout(() => {
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: `You said: "${message}". This response is styled using unified design tokens - notice the consistent spacing, colors, and typography that adapts to your theme preference!`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, aiResponse]);
    }, 1000);
  };

  return (
    <div className="unified-chat-examples u-p-6 u-gap-6">
      <div className="u-mb-6">
        <h2 className="u-text-2xl u-font-bold u-text-primary u-mb-2">
          Unified Chat Interface
        </h2>
        <p className="u-text-secondary u-mb-4">
          All components now use the unified design system with semantic tokens.
          Switch between light/dark modes to see consistent theming.
        </p>
      </div>

      {/* Different Chat Variants - All Using Unified System */}
      <div className="u-grid u-grid-cols-1 u-lg:grid-cols-2 u-gap-6">
        
        {/* Embedded Chat */}
        <div>
          <h3 className="u-text-lg u-font-semibold u-text-primary u-mb-3">
            Embedded Chat (Unified)
          </h3>
          <UnifiedChat
            messages={messages}
            onSendMessage={handleSendMessage}
            variant="embedded"
            title="AI Assistant"
            placeholder="Ask about emails, tasks, or automation..."
            features={{
              ai: true,
              metadata: true,
              voiceInput: true,
              fileUpload: true,
              connectionStatus: true
            }}
            theme={{ variant: 'light' }}
          />
        </div>

        {/* Widget Chat */}
        <div>
          <h3 className="u-text-lg u-font-semibold u-text-primary u-mb-3">
            Widget Chat (Unified)
          </h3>
          <UnifiedChat
            messages={messages.slice(0, 2)}
            onSendMessage={handleSendMessage}
            variant="widget"
            title="Quick Help"
            features={{
              ai: true,
              connectionStatus: false
            }}
            theme={{ variant: 'light' }}
          />
        </div>
      </div>

      {/* Theme Controls */}
      <div className="u-mt-8 u-p-4 u-bg-card u-border u-border-primary u-rounded-lg">
        <h3 className="u-text-lg u-font-semibold u-text-primary u-mb-3">
          Theme Controls
        </h3>
        <div className="u-flex u-gap-2 u-flex-wrap">
          <button
            onClick={() => document.documentElement.setAttribute('data-theme', 'light')}
            className="u-px-3 u-py-2 u-text-sm u-bg-surface-secondary u-text-primary u-border u-border-primary u-rounded-md hover:u-bg-primary-light u-transition-colors"
          >
            Light Mode
          </button>
          <button
            onClick={() => document.documentElement.setAttribute('data-theme', 'dark')}
            className="u-px-3 u-py-2 u-text-sm u-bg-surface-secondary u-text-primary u-border u-border-primary u-rounded-md hover:u-bg-primary-light u-transition-colors"
          >
            Dark Mode
          </button>
          <button
            onClick={() => document.documentElement.setAttribute('data-theme', 'high-contrast')}
            className="u-px-3 u-py-2 u-text-sm u-bg-surface-secondary u-text-primary u-border u-border-primary u-rounded-md hover:u-bg-primary-light u-transition-colors"
          >
            High Contrast
          </button>
        </div>
        <p className="u-text-xs u-text-secondary u-mt-2">
          Notice how all components adapt their colors automatically when you switch themes.
          This is the power of the unified design system!
        </p>
      </div>

      {/* Benefits Summary */}
      <div className="u-mt-8 u-p-6 u-bg-success-light u-border u-border-success u-rounded-lg">
        <h3 className="u-text-lg u-font-semibold u-text-success u-mb-3">
          ✅ Design System Benefits Achieved
        </h3>
        <div className="u-grid u-grid-cols-1 u-md:grid-cols-2 u-gap-4">
          <div>
            <h4 className="u-font-medium u-text-success u-mb-2">Before (Chaotic)</h4>
            <ul className="u-text-sm u-text-secondary u-gap-1">
              <li>❌ 4 different color systems</li>
              <li>❌ Hardcoded values everywhere</li>
              <li>❌ No theme consistency</li>
              <li>❌ Manual dark mode implementation</li>
              <li>❌ Inconsistent spacing and typography</li>
              <li>❌ Poor accessibility</li>
            </ul>
          </div>
          <div>
            <h4 className="u-font-medium u-text-success u-mb-2">After (Unified)</h4>
            <ul className="u-text-sm u-text-secondary u-gap-1">
              <li>✅ Single semantic token system</li>
              <li>✅ Runtime theme switching</li>
              <li>✅ Automatic dark/light/high-contrast support</li>
              <li>✅ Consistent spacing and typography</li>
              <li>✅ Component-based patterns</li>
              <li>✅ Built-in accessibility features</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

// Complete integration demo
export const ChatIntegrationDemo: React.FC = () => {
  const [showBefore, setShowBefore] = useState(false);

  return (
    <div className="u-min-h-screen u-bg-surface u-p-6">
      <div className="u-max-w-6xl u-mx-auto">
        <header className="u-text-center u-mb-8">
          <h1 className="u-text-3xl u-font-bold u-text-primary u-mb-4">
            Chat Components: Design System Integration
          </h1>
          <p className="u-text-lg u-text-secondary u-mb-6">
            Demonstration of how the unified design system eliminates styling chaos
            and provides consistent, themeable, accessible components.
          </p>
          
          <div className="u-flex u-justify-center u-gap-4 u-mb-8">
            <button
              onClick={() => setShowBefore(false)}
              className={`u-px-4 u-py-2 u-text-sm u-font-medium u-border u-rounded-md u-transition-colors ${
                !showBefore
                  ? 'u-bg-primary u-text-white u-border-primary'
                  : 'u-bg-surface u-text-secondary u-border-primary hover:u-bg-surface-secondary'
              }`}
            >
              ✅ After: Unified System
            </button>
            <button
              onClick={() => setShowBefore(true)}
              className={`u-px-4 u-py-2 u-text-sm u-font-medium u-border u-rounded-md u-transition-colors ${
                showBefore
                  ? 'u-bg-error u-text-white u-border-error'
                  : 'u-bg-surface u-text-secondary u-border-primary hover:u-bg-surface-secondary'
              }`}
            >
              ❌ Before: Chaotic Mix
            </button>
          </div>
        </header>

        {showBefore ? (
          <div>
            <div className="u-mb-6 u-p-4 u-bg-error-light u-border u-border-error u-rounded-lg">
              <h2 className="u-text-xl u-font-semibold u-text-error u-mb-2">
                ❌ Before: The Chaotic Mix
              </h2>
              <p className="u-text-error">
                This shows the problematic approach with 4 different styling methods that caused
                inconsistency, poor maintainability, and accessibility issues.
              </p>
            </div>
            <ChaoticChatExample />
          </div>
        ) : (
          <div>
            <div className="u-mb-6 u-p-4 u-bg-success-light u-border u-border-success u-rounded-lg">
              <h2 className="u-text-xl u-font-semibold u-text-success u-mb-2">
                ✅ After: Unified Design System
              </h2>
              <p className="u-text-success">
                All components now use semantic design tokens, providing consistent theming,
                better accessibility, and easier maintenance.
              </p>
            </div>
            <UnifiedChatExample />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatIntegrationDemo;