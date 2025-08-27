import React from 'react';
import { Icons } from '../ui/icons';
import { EmailTemplate } from './types';
import { TemplateCard } from './TemplateCard';

interface TemplateListProps {
  templates: EmailTemplate[];
  isLoading: boolean;
  onStarToggle: (templateId: string) => void;
  onTemplateSelect: (template: EmailTemplate) => void;
  onTemplateApply: (template: EmailTemplate) => void;
}

export const TemplateList: React.FC<TemplateListProps> = ({
  templates,
  isLoading,
  onStarToggle,
  onTemplateSelect,
  onTemplateApply
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading templates...</p>
        </div>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center">
          <Icons.document className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No templates found</p>
          <p className="text-sm">Try adjusting your filters or create a new template</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {templates.map((template) => (
        <TemplateCard
          key={template.id}
          template={template}
          onStarToggle={onStarToggle}
          onPreview={onTemplateSelect}
          onApply={onTemplateApply}
        />
      ))}
    </div>
  );
};