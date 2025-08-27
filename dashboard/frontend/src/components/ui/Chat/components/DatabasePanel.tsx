import React from 'react';
import {
  DatabaseIcon,
  MagnifyingGlassIcon,
  ExclamationCircleIcon,
  EnvelopeIcon,
  CogIcon
} from '../../icons';
import { DatabasePanelProps } from '../types';

export const DatabasePanel: React.FC<DatabasePanelProps> = ({
  emailSuggestions = [],
  onQuickAction,
  className = ''
}) => {
  const quickActions = [
    { id: 'unread', label: 'Show unread emails', icon: EnvelopeIcon },
    { id: 'urgent', label: 'Find urgent tasks', icon: ExclamationCircleIcon },
    { id: 'drafts', label: 'Draft responses', icon: MagnifyingGlassIcon },
    { id: 'automation', label: 'Create automation', icon: CogIcon }
  ];

  const handleQuickAction = (actionId: string) => {
    if (onQuickAction) {
      onQuickAction(actionId);
    }
  };

  return (
    <div className={`w-80 border-l border-slate-700 bg-slate-800/20 p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <DatabaseIcon className="w-4 h-4 text-blue-400" />
        <h3 className="font-medium text-white">Database Access</h3>
      </div>
      
      {/* Email Suggestions */}
      {emailSuggestions.length > 0 && (
        <div className="space-y-2 mb-4">
          <h4 className="text-sm font-medium text-slate-300">Referenced Emails</h4>
          {emailSuggestions.map((email) => (
            <div key={email.id} className="bg-slate-700/30 rounded-lg p-2 border border-slate-600/30">
              <div className="text-xs font-medium text-white truncate">{email.subject}</div>
              <div className="text-xs text-slate-400 truncate">{email.sender}</div>
              <div className="text-xs text-slate-500 mt-1 line-clamp-2">{email.preview}</div>
              {email.relevanceScore && (
                <div className="text-xs text-blue-400 mt-1">
                  Relevance: {Math.round(email.relevanceScore * 100)}%
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-slate-300">Quick Actions</h4>
        <div className="space-y-1">
          {quickActions.map((action) => {
            const IconComponent = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action.id)}
                className="w-full text-left text-xs bg-slate-700/30 hover:bg-slate-700/50 rounded-lg p-2 transition-colors flex items-center gap-2"
              >
                <IconComponent className="w-3 h-3 text-slate-400" />
                <span className="text-slate-300">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Database Stats */}
      <div className="mt-4 pt-4 border-t border-slate-600/30">
        <h4 className="text-sm font-medium text-slate-300 mb-2">Database Stats</h4>
        <div className="space-y-1 text-xs text-slate-400">
          <div className="flex justify-between">
            <span>Total Emails:</span>
            <span className="text-slate-300">1,247</span>
          </div>
          <div className="flex justify-between">
            <span>Unread:</span>
            <span className="text-blue-300">23</span>
          </div>
          <div className="flex justify-between">
            <span>Urgent:</span>
            <span className="text-red-300">3</span>
          </div>
        </div>
      </div>
    </div>
  );
};