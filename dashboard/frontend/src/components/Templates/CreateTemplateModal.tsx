import React from 'react';
import { Draft } from './types';

interface CreateTemplateModalProps {
  currentDraft: Draft | null;
  isOpen: boolean;
  onClose: () => void;
  onCreateFromDraft: () => void;
}

export const CreateTemplateModal: React.FC<CreateTemplateModalProps> = ({
  currentDraft,
  isOpen,
  onClose,
  onCreateFromDraft
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-lg max-w-md w-full">
        <div className="border-b border-border p-4">
          <h3 className="text-lg font-semibold">Create Template from Draft</h3>
        </div>
        
        <div className="p-4">
          <p className="text-sm text-muted-foreground mb-4">
            This will create a new template using your current draft content.
          </p>
          {currentDraft && (
            <div className="bg-muted p-3 rounded-lg text-sm">
              <strong>Preview:</strong>
              <div className="mt-2 text-muted-foreground">
                {currentDraft.content.substring(0, 200)}...
              </div>
            </div>
          )}
        </div>
        
        <div className="border-t border-border p-4 flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={onCreateFromDraft}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Create Template
          </button>
        </div>
      </div>
    </div>
  );
};