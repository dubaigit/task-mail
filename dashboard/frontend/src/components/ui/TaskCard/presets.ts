import { TaskCardConfig } from './types';

export const TaskCardPresets: Record<string, TaskCardConfig> = {
  centric: {
    layout: 'detailed',
    features: {
      urgencyIndicator: true,
      progressBar: true,
      quickActions: true,
      expandableActions: true,
      avatar: true,
      tags: true,
      dueDate: true,
      assignee: true,
      metadata: true,
      relatedEmailLink: true,
      statusBadge: true,
      aiConfidence: false,
      relatedEmailsCount: false,
      estimatedTime: false,
      draftStatus: false,
    },
    visual: {
      urgencySystem: 'four-tier',
      colorScheme: 'urgency-based',
      pulseAnimation: true,
      hoverEffects: true,
      darkMode: false,
      compactSpacing: false,
      centerAlignment: false,
    },
    behavior: {
      expandedByDefault: false,
      enableKeyboardShortcuts: true,
      enableDragDrop: true,
      clickToExpand: false,
      showActionsOnHover: true,
    },
    limits: {
      maxPreviewLength: 150,
      maxTagsShown: 3,
      characterLimit: 500,
    }
  },
  
  management: {
    layout: 'detailed',
    features: {
      urgencyIndicator: true,
      progressBar: false,
      quickActions: true,
      expandableActions: false,
      inlineEditing: true,
      avatar: false,
      tags: true,
      dueDate: true,
      assignee: true,
      metadata: false,
      relatedEmailLink: false,
      statusBadge: true,
      aiConfidence: false,
      relatedEmailsCount: false,
      estimatedTime: false,
      draftStatus: false,
    },
    visual: {
      urgencySystem: 'three-tier',
      colorScheme: 'category-based',
      pulseAnimation: false,
      hoverEffects: true,
      darkMode: false,
      compactSpacing: false,
      centerAlignment: false,
    },
    behavior: {
      expandedByDefault: false,
      enableKeyboardShortcuts: true,
      enableDragDrop: false,
      clickToExpand: true,
      showActionsOnHover: true,
    },
    limits: {
      maxPreviewLength: 200,
      maxTagsShown: 2,
      characterLimit: 300,
    }
  },
  
  business: {
    layout: 'business',
    features: {
      urgencyIndicator: true,
      progressBar: false,
      quickActions: false,
      expandableActions: false,
      inlineEditing: false,
      importanceScore: true,
      avatar: true,
      tags: true,
      dueDate: true,
      assignee: false,
      metadata: true,
      relatedEmailLink: false,
      statusBadge: true,
      aiConfidence: true,
      relatedEmailsCount: true,
      estimatedTime: true,
      draftStatus: true,
    },
    visual: {
      urgencySystem: 'four-tier',
      colorScheme: 'professional',
      pulseAnimation: false,
      hoverEffects: true,
      darkMode: true,
      compactSpacing: true,
      centerAlignment: true,
    },
    behavior: {
      expandedByDefault: false,
      enableKeyboardShortcuts: false,
      enableDragDrop: false,
      clickToExpand: false,
      showActionsOnHover: false,
    },
    limits: {
      maxPreviewLength: 100,
      maxTagsShown: 1,
      characterLimit: 200,
    }
  },
  
  compact: {
    layout: 'compact',
    features: {
      urgencyIndicator: true,
      progressBar: false,
      quickActions: false,
      expandableActions: false,
      inlineEditing: false,
      importanceScore: false,
      avatar: false,
      tags: false,
      dueDate: true,
      assignee: false,
      metadata: false,
      relatedEmailLink: false,
      statusBadge: true,
      aiConfidence: false,
      relatedEmailsCount: false,
      estimatedTime: false,
      draftStatus: false,
    },
    visual: {
      urgencySystem: 'three-tier',
      colorScheme: 'urgency-based',
      pulseAnimation: false,
      hoverEffects: true,
      darkMode: false,
      compactSpacing: true,
      centerAlignment: false,
    },
    behavior: {
      expandedByDefault: false,
      enableKeyboardShortcuts: true,
      enableDragDrop: false,
      clickToExpand: false,
      showActionsOnHover: false,
    },
    limits: {
      maxPreviewLength: 50,
      maxTagsShown: 0,
      characterLimit: 100,
    }
  }
};

export const getPresetConfig = (variant: string): TaskCardConfig => {
  return TaskCardPresets[variant] || TaskCardPresets.centric;
};