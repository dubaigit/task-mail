import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Eye, 
  EyeOff, 
  Copy, 
  RefreshCw, 
  Clock,
  User,
  Bot,
  Zap,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

interface AIPrompt {
  id: string;
  type: 'classification' | 'analysis' | 'draft' | 'chat';
  timestamp: string;
  emailId?: string;
  emailSubject?: string;
  systemPrompt: string;
  userPrompt: string;
  response: string;
  model: string;
  tokensUsed: number;
  responseTime: number;
  success: boolean;
}

interface AIPromptViewerProps {
  visible: boolean;
  onClose: () => void;
}

export const AIPromptViewer: React.FC<AIPromptViewerProps> = ({ visible, onClose }) => {
  const [prompts, setPrompts] = useState<AIPrompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<AIPrompt | null>(null);
  const [filter, setFilter] = useState<'all' | 'classification' | 'analysis' | 'draft' | 'chat'>('all');
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set());

  // Mock data - replace with actual API calls
  useEffect(() => {
    if (visible) {
      // Simulate fetching recent prompts
      const mockPrompts: AIPrompt[] = [
        {
          id: '1',
          type: 'classification',
          timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          emailId: 'email_123',
          emailSubject: 'Project Update Meeting',
          systemPrompt: `You are an email classification AI. Analyze the email and classify it into one of these categories:
CREATE_TASK, FYI_ONLY, URGENT_RESPONSE, CALENDAR_EVENT, APPROVAL_REQUIRED, DOCUMENT_REVIEW, MEETING_REQUEST, NEEDS_REPLY, ESCALATION, INFORMATION_ONLY, ACTION_REQUIRED

Consider urgency (LOW, MEDIUM, HIGH, CRITICAL) and provide a confidence score (0-100).`,
          userPrompt: `Classify this email:
Subject: Project Update Meeting
From: sarah@company.com
Body: Hi team, let's schedule our weekly project update for this Friday at 2 PM. Please confirm your availability.`,
          response: `{
  "classification": "MEETING_REQUEST",
  "urgency": "MEDIUM", 
  "confidence": 92,
  "suggested_action": "Check calendar availability and respond with confirmation"
}`,
          model: 'GPT-5 Nano',
          tokensUsed: 156,
          responseTime: 234,
          success: true
        },
        {
          id: '2', 
          type: 'analysis',
          timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          emailId: 'email_124',
          emailSubject: 'Budget Approval Request',
          systemPrompt: `Analyze this email for key action items, deadlines, and important details. Extract:
1. Action items with responsible parties
2. Deadlines and dates
3. Key decisions needed
4. Priority level
5. Follow-up requirements`,
          userPrompt: `Analyze this email:
Subject: Budget Approval Request
From: finance@company.com
Body: The Q4 budget proposal needs approval by end of week. Key items include 20% increase in marketing spend and new hire approvals. Please review the attached spreadsheet and provide feedback by Thursday EOD.`,
          response: `**Action Items:**
1. Review attached budget spreadsheet (You)
2. Provide feedback on budget proposal (You) 
3. Approve/deny marketing spend increase (You)
4. Approve/deny new hire requests (You)

**Deadlines:**
- Feedback required: Thursday EOD
- Final approval: End of week

**Key Decisions:**
- 20% marketing spend increase approval
- New hire approvals

**Priority:** HIGH - Time sensitive with firm deadline`,
          model: 'GPT-5 Mini',
          tokensUsed: 342,
          responseTime: 567,
          success: true
        },
        {
          id: '3',
          type: 'chat',
          timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
          systemPrompt: `You are an AI assistant with access to the user's email database. Help them manage tasks, find information, and compose emails. You can:
1. Search and analyze emails
2. Create drafts and responses
3. Suggest task priorities
4. Extract insights from email patterns`,
          userPrompt: `Show me all high-priority emails from this week that need responses`,
          response: `I found 3 high-priority emails requiring responses this week:

1. **Budget Approval Request** (Finance Dept)
   - Deadline: Thursday EOD
   - Status: Needs review and approval

2. **Client Proposal Feedback** (ABC Corp)
   - Deadline: Tomorrow 5 PM
   - Status: Awaiting your input on pricing

3. **Team Performance Review** (HR)
   - Deadline: Friday
   - Status: Manager feedback required

Would you like me to help draft responses for any of these?`,
          model: 'GPT-5 Mini',
          tokensUsed: 198,
          responseTime: 412,
          success: true
        }
      ];
      setPrompts(mockPrompts);
    }
  }, [visible]);

  const filteredPrompts = filter === 'all' 
    ? prompts 
    : prompts.filter(p => p.type === filter);

  const togglePromptExpansion = (promptId: string) => {
    const newExpanded = new Set(expandedPrompts);
    if (newExpanded.has(promptId)) {
      newExpanded.delete(promptId);
    } else {
      newExpanded.add(promptId);
    }
    setExpandedPrompts(newExpanded);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffMinutes < 1440) {
      return `${Math.floor(diffMinutes / 60)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'classification': return 'text-blue-400 bg-blue-500/20';
      case 'analysis': return 'text-purple-400 bg-purple-500/20';
      case 'draft': return 'text-green-400 bg-green-500/20';
      case 'chat': return 'text-orange-400 bg-orange-500/20';
      default: return 'text-slate-400 bg-slate-500/20';
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">AI Prompt History</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPrompts([])}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 text-slate-400" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <EyeOff className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex gap-2">
            {['all', 'classification', 'analysis', 'draft', 'chat'].map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === type
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'bg-slate-700/30 text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
                {type !== 'all' && (
                  <span className="ml-1 text-xs opacity-60">
                    ({prompts.filter(p => p.type === type).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Prompt List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredPrompts.map((prompt) => {
            const isExpanded = expandedPrompts.has(prompt.id);
            return (
              <div
                key={prompt.id}
                className="bg-slate-800/30 rounded-lg border border-slate-700/50 overflow-hidden"
              >
                {/* Prompt Header */}
                <div 
                  className="p-3 cursor-pointer hover:bg-slate-700/20 transition-colors"
                  onClick={() => togglePromptExpansion(prompt.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(prompt.type)}`}>
                        {prompt.type}
                      </span>
                      {prompt.emailSubject && (
                        <span className="text-sm text-white font-medium">
                          {prompt.emailSubject}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>{prompt.model}</span>
                      <span>{prompt.tokensUsed} tokens</span>
                      <span>{prompt.responseTime}ms</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(prompt.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-slate-700/50 p-4 space-y-4">
                    {/* System Prompt */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bot className="w-4 h-4 text-blue-400" />
                          <span className="text-sm font-medium text-blue-300">System Prompt</span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(prompt.systemPrompt)}
                          className="p-1 hover:bg-slate-700 rounded transition-colors"
                        >
                          <Copy className="w-3 h-3 text-slate-400" />
                        </button>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-3 text-xs text-slate-300 font-mono whitespace-pre-wrap">
                        {prompt.systemPrompt}
                      </div>
                    </div>

                    {/* User Prompt */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-green-400" />
                          <span className="text-sm font-medium text-green-300">User Prompt</span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(prompt.userPrompt)}
                          className="p-1 hover:bg-slate-700 rounded transition-colors"
                        >
                          <Copy className="w-3 h-3 text-slate-400" />
                        </button>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-3 text-xs text-slate-300 font-mono whitespace-pre-wrap">
                        {prompt.userPrompt}
                      </div>
                    </div>

                    {/* AI Response */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-purple-400" />
                          <span className="text-sm font-medium text-purple-300">AI Response</span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(prompt.response)}
                          className="p-1 hover:bg-slate-700 rounded transition-colors"
                        >
                          <Copy className="w-3 h-3 text-slate-400" />
                        </button>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-3 text-xs text-slate-300 whitespace-pre-wrap">
                        {prompt.response}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filteredPrompts.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No prompts found for the selected filter</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};