import React from 'react';
import { Mail, Brain, FileText, Clock } from 'lucide-react';
import { TaskCardConfig } from '../types';

interface BusinessMetricsProps {
  task: any; // Extended task with business fields
  config: TaskCardConfig;
}

export const BusinessMetrics: React.FC<BusinessMetricsProps> = ({ task, config }) => {
  const confidence = task.confidence || task.aiConfidence || 50;
  
  return (
    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-700/40">
      <div className="flex items-center gap-3">
        {/* Related Emails Count */}
        {config.features.relatedEmailsCount && (
          <div className="flex items-center gap-1">
            <Mail className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-400">{task.relatedEmails || 0}</span>
          </div>
        )}
        
        {/* AI Confidence */}
        {config.features.aiConfidence && (
          <div className="flex items-center gap-1">
            <Brain className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-400">{confidence}%</span>
          </div>
        )}
        
        {/* Draft Status */}
        {config.features.draftStatus && task.draftGenerated && (
          <div className="flex items-center gap-1">
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs text-emerald-400">Draft</span>
          </div>
        )}
      </div>
      
      {/* Time Estimate */}
      {config.features.estimatedTime && (
        <div className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs text-slate-500">{task.estimatedTime || '5m'}</span>
        </div>
      )}
    </div>
  );
};

BusinessMetrics.displayName = 'BusinessMetrics';