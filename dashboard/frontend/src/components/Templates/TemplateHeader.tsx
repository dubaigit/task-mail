import React from 'react';
import {
  DocumentTextIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { TemplateFilters } from './TemplateFilters';
import { TemplateFilters as FiltersType, Draft } from './types';

interface TemplateHeaderProps {
  templatesCount: number;
  currentDraft: Draft | null;
  filters: FiltersType;
  onFiltersChange: (filters: FiltersType) => void;
  onCreateTemplate: () => void;
}

export const TemplateHeader: React.FC<TemplateHeaderProps> = ({
  templatesCount,
  currentDraft,
  filters,
  onFiltersChange,
  onCreateTemplate
}) => {
  return (
    <div className="border-b border-border p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <DocumentTextIcon className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Templates</h3>
          <span className="text-sm text-muted-foreground">
            ({templatesCount} available)
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onCreateTemplate}
            disabled={!currentDraft}
            className="inline-flex items-center space-x-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            title={!currentDraft ? 'Generate a draft first' : 'Create template from current draft'}
          >
            <PlusIcon className="w-4 h-4" />
            <span>Create</span>
          </button>
        </div>
      </div>

      <TemplateFilters
        filters={filters}
        onFiltersChange={onFiltersChange}
      />
    </div>
  );
};