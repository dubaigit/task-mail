import React, { useState, useCallback, useEffect } from 'react';
import { TemplateManagerProps, EmailTemplate } from './types';
import { TemplateHeader } from './TemplateHeader';
import { SuggestedTemplatesSection } from './SuggestedTemplatesSection';
import { TemplateList } from './TemplateList';
import { TemplatePreviewModal } from './TemplatePreviewModal';
import { CreateTemplateModal } from './CreateTemplateModal';
import { useTemplateManager } from './useTemplateManager';

export const TemplateManager: React.FC<TemplateManagerProps> = ({
  selectedEmail,
  currentDraft,
  onTemplateApply,
  onTemplateCreate,
  className = ''
}) => {
  const {
    filteredTemplates,
    filters,
    setFilters,
    isLoading,
    suggestedTemplates,
    generateSuggestions,
    updateUsageCount,
    toggleStar
  } = useTemplateManager();

  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Generate AI suggestions when selected email changes
  useEffect(() => {
    generateSuggestions(selectedEmail);
  }, [selectedEmail, generateSuggestions]);

  const handleTemplateSelect = useCallback((template: EmailTemplate) => {
    setSelectedTemplate(template);
    setShowPreview(true);
  }, []);

  const handleTemplateApply = useCallback((template: EmailTemplate) => {
    // Update usage count
    updateUsageCount(template.id);
    
    onTemplateApply(template);
    setShowPreview(false);
    setSelectedTemplate(null);
  }, [onTemplateApply, updateUsageCount]);

  const handleCreateFromDraft = useCallback(() => {
    if (!currentDraft) return;
    
    const metadata: Partial<EmailTemplate> = {
      name: `Draft Template ${new Date().toLocaleDateString()}`,
      description: 'Template created from current draft',
      category: 'custom',
      tags: ['custom', 'user-created'],
      author: 'User',
      is_public: false
    };
    
    onTemplateCreate(currentDraft.content, metadata);
    setShowCreateModal(false);
  }, [currentDraft, onTemplateCreate]);

  return (
    <div className={`flex flex-col h-full bg-background ${className}`}>
      <TemplateHeader
        templatesCount={filteredTemplates.length}
        currentDraft={currentDraft}
        filters={filters}
        onFiltersChange={setFilters}
        onCreateTemplate={() => setShowCreateModal(true)}
      />

      <SuggestedTemplatesSection
        suggestedTemplates={suggestedTemplates}
        selectedEmail={selectedEmail}
        onTemplateSelect={handleTemplateSelect}
      />

      <div className="flex-1 overflow-y-auto">
        <TemplateList
          templates={filteredTemplates}
          isLoading={isLoading}
          onStarToggle={toggleStar}
          onTemplateSelect={handleTemplateSelect}
          onTemplateApply={handleTemplateApply}
        />
      </div>

      <TemplatePreviewModal
        template={selectedTemplate}
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        onApply={handleTemplateApply}
      />

      <CreateTemplateModal
        currentDraft={currentDraft}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateFromDraft={handleCreateFromDraft}
      />
    </div>
  );
};