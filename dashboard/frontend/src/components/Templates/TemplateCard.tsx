import React from 'react';
import {
  StarIcon,
  TagIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { EmailTemplate } from './types';
import { getCategoryIcon, getCategoryColor, formatTimeAgo } from './templateUtils';

interface TemplateCardProps {
  template: EmailTemplate;
  onStarToggle: (templateId: string) => void;
  onPreview: (template: EmailTemplate) => void;
  onApply: (template: EmailTemplate) => void;
}

export const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  onStarToggle,
  onPreview,
  onApply
}) => {
  const CategoryIcon = getCategoryIcon(template.category);

  return (
    <div className="border border-border rounded-lg p-4 hover:shadow-sm transition-shadow bg-background">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <CategoryIcon className="w-4 h-4" />
            <h4 className="font-medium">{template.name}</h4>
            {template.isStarred && (
              <StarSolidIcon className="w-4 h-4 text-yellow-500" />
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-2">{template.description}</p>
          
          {/* Tags */}
          <div className="flex items-center space-x-1 mb-2">
            {template.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center space-x-1 text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded"
              >
                <TagIcon className="w-3 h-3" />
                <span>{tag}</span>
              </span>
            ))}
            {template.tags.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{template.tags.length - 3} more
              </span>
            )}
          </div>

          {/* Metadata */}
          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
            <span>{template.usage_count} uses</span>
            <span>Updated {formatTimeAgo(template.updated_at)}</span>
            <span className={`px-1.5 py-0.5 rounded border ${getCategoryColor(template.category)}`}>
              {template.category}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-1 ml-4">
          <button
            onClick={() => onStarToggle(template.id)}
            className="p-1.5 text-muted-foreground hover:text-foreground"
            title={template.isStarred ? 'Remove from favorites' : 'Add to favorites'}
          >
            {template.isStarred ? (
              <StarSolidIcon className="w-4 h-4 text-yellow-500" />
            ) : (
              <StarIcon className="w-4 h-4" />
            )}
          </button>
          
          <button
            onClick={() => onPreview(template)}
            className="p-1.5 text-muted-foreground hover:text-foreground"
            title="Preview template"
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => onApply(template)}
            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Use
          </button>
        </div>
      </div>
    </div>
  );
};