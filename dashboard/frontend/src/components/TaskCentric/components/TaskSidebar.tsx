import React from 'react';
import { 
  Brain, 
  Users, 
  FileText, 
  X,
  Star,
  AlertCircle 
} from 'lucide-react';
import { EnhancedAIStatus } from '../../AI/EnhancedAIStatus';
import { AIPromptViewer } from '../../AI/AIPromptViewer';
import AIUsageMetrics from '../../AI/AIUsageMetrics';
import { TaskDetailsStats } from '../../TaskManagement/TaskDetailsStats';
import AnalyticsDashboard from '../../Analytics/AnalyticsDashboard';
import { UnifiedChat } from '../../ui/Chat/UnifiedChat';
import { GlassCard } from '../../ui/DarkModeSystem';

interface TaskSidebarProps {
  selectedEmail: any | null;
  isEmailPopupOpen: boolean;
  setIsEmailPopupOpen: (open: boolean) => void;
  showAIPrompts: boolean;
  setShowAIPrompts: (show: boolean) => void;
  showAIChat: boolean;
  setShowAIChat: (show: boolean) => void;
  relatedItems: any[];
  suggestions: Array<{ title: string; description: string }>;
  stats: any;
  syncStatus: any;
}

export const TaskSidebar: React.FC<TaskSidebarProps> = ({
  selectedEmail,
  isEmailPopupOpen,
  setIsEmailPopupOpen,
  showAIPrompts,
  setShowAIPrompts,
  showAIChat,
  setShowAIChat,
  relatedItems,
  suggestions,
  stats,
  syncStatus
}) => {
  const handleUnifiedTaskClick = (task: any) => {
    setIsEmailPopupOpen(true);
  };

  return (
    <div className="w-80 space-y-6 overflow-y-auto">
      {/* AI Status Section */}
      <GlassCard className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-medium flex items-center gap-2">
            <Brain className="w-4 h-4" />
            AI Status
          </h3>
          <button
            onClick={() => setShowAIPrompts(!showAIPrompts)}
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            {showAIPrompts ? <X className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
          </button>
        </div>
        <EnhancedAIStatus 
          onSync={() => console.log('Sync requested')}
          onResync={() => console.log('Resync requested')}
          onForceReanalyze={() => console.log('Force reanalyze requested')}
          showPrompts={showAIPrompts}
          onTogglePrompts={() => setShowAIPrompts(!showAIPrompts)}
        />
        {showAIPrompts && (
          <div className="mt-4 border-t border-white/10 pt-4">
            <AIPromptViewer 
              visible={showAIPrompts}
              onClose={() => setShowAIPrompts(false)}
            />
          </div>
        )}
      </GlassCard>

      {/* AI Usage Metrics */}
      <GlassCard className="p-4">
        <AIUsageMetrics />
      </GlassCard>

      {/* Task Details & Stats */}
      {selectedEmail && (
        <GlassCard className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-medium">Task Details</h3>
            <button
              onClick={() => setIsEmailPopupOpen(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <TaskDetailsStats
            userProfile={null}
            syncStatus={null}
            tasks={[selectedEmail]}
            categoryFilter="all"
            categoryCounts={{}}
            onSettingsClick={() => console.log('Settings clicked')}
            onCategoryFilterChange={(filter) => console.log('Category filter changed:', filter)}
          />
        </GlassCard>
      )}

      {/* Analytics Dashboard */}
      <GlassCard className="p-4">
        <h3 className="text-white font-medium mb-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          Analytics
        </h3>
        <AnalyticsDashboard 
          tasks={[]}
          syncStatus={syncStatus}
          categoryCounts={{}}
        />
      </GlassCard>

      {/* AI Chat */}
      <GlassCard className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-medium flex items-center gap-2">
            <Brain className="w-4 h-4" />
            AI Assistant
          </h3>
          <button
            onClick={() => setShowAIChat(!showAIChat)}
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            {showAIChat ? <X className="w-4 h-4" /> : <Users className="w-4 h-4" />}
          </button>
        </div>
        {showAIChat && (
          <div className="h-96">
            <UnifiedChat 
              messages={[]}
              onSendMessage={(message) => console.log('Send message:', message)}
            />
          </div>
        )}
      </GlassCard>

      {/* Related Items */}
      {relatedItems.length > 0 && (
        <GlassCard className="p-4">
          <h3 className="text-white font-medium mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Related Items
          </h3>
          <div className="space-y-2">
            {relatedItems.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-white truncate">
                    {item.title}
                  </h4>
                  <Star className={`w-3 h-3 ${item.relevance > 0.8 ? 'text-yellow-400' : 'text-gray-400'}`} />
                </div>
                <p className="text-xs text-gray-400 mt-1 truncate">
                  {item.description}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-blue-400 capitalize">{item.type}</span>
                  <span className="text-xs text-gray-500">
                    {Math.round(item.relevance * 100)}% match
                  </span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* AI Suggestions */}
      {suggestions.length > 0 && (
        <GlassCard className="p-4">
          <h3 className="text-white font-medium mb-3 flex items-center gap-2">
            <Brain className="w-4 h-4" />
            AI Suggestions
          </h3>
          <div className="space-y-3">
            {suggestions.slice(0, 3).map((suggestion, index) => (
              <div
                key={index}
                className="p-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20"
              >
                <h4 className="text-sm font-medium text-white mb-1">
                  {suggestion.title}
                </h4>
                <p className="text-xs text-gray-300">
                  {suggestion.description}
                </p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
};