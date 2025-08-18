import React from 'react';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { EmailTemplate, Email } from './types';
import { getCategoryIcon, getCategoryColor } from './templateUtils';

interface SuggestedTemplatesSectionProps {
  suggestedTemplates: EmailTemplate[];
  selectedEmail: Email | null;
  onTemplateSelect: (template: EmailTemplate) => void;
}

export const SuggestedTemplatesSection: React.FC<SuggestedTemplatesSectionProps> = ({
  suggestedTemplates,
  selectedEmail,
  onTemplateSelect
}) => {
  if (suggestedTemplates.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-border p-4 bg-muted/30">
      <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center">
        <SparklesIcon className="w-4 h-4 mr-2" />
        AI Suggested for "{selectedEmail?.classification}"
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {suggestedTemplates.map((template) => {
          const CategoryIcon = getCategoryIcon(template.category);
          
          return (
            <button
              key={template.id}
              onClick={() => onTemplateSelect(template)}
              className="text-left p-3 bg-background border border-border rounded-lg hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center space-x-2 mb-1">
                <CategoryIcon className="w-4 h-4" />
                <span className="text-sm font-medium truncate">{template.name}</span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{template.description}</p>
              <div className="flex items-center space-x-2 mt-2">
                <span className={`text-xs px-1.5 py-0.5 rounded border ${getCategoryColor(template.category)}`}>
                  {template.category}
                </span>
                <span className="text-xs text-muted-foreground">
                  {template.usage_count} uses
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};