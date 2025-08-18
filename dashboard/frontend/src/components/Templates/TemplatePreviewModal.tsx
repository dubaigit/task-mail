import React from 'react';
import { EmailTemplate } from './types';

interface TemplatePreviewModalProps {
  template: EmailTemplate | null;
  isOpen: boolean;
  onClose: () => void;
  onApply: (template: EmailTemplate) => void;
}

export const TemplatePreviewModal: React.FC<TemplatePreviewModalProps> = ({
  template,
  isOpen,
  onClose,
  onApply
}) => {
  if (!isOpen || !template) {
    return null;
  }

  const handleApply = () => {
    onApply(template);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="border-b border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">{template.name}</h3>
              <p className="text-sm text-muted-foreground">{template.description}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          </div>
        </div>
        
        <div className="p-4 overflow-y-auto max-h-96">
          <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-4 rounded-lg">
            {template.content}
          </pre>
        </div>
        
        <div className="border-t border-border p-4 flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Use Template
          </button>
        </div>
      </div>
    </div>
  );
};