/**
 * Design System Migration Examples
 * Before and after examples showing how to migrate from current styling chaos to unified design system
 */

import React from 'react';
import { UnifiedTaskCard } from '../../components/ui/UnifiedTaskCard';
import { Task, TaskStatus, TaskPriority, TaskCategory } from '../../types/core';
import { getThemeManager } from './theme';

// Example task data
const exampleTask: Task = {
  id: '1',
  title: 'Implement comprehensive design system foundation',
  description: 'Create unified design token system, color schemes, and component styling standards to replace the current chaotic mix of 4 different styling approaches.',
  status: TaskStatus.IN_PROGRESS,
  priority: TaskPriority.HIGH,
  category: TaskCategory.DO_MYSELF,
  urgency: TaskPriority.HIGH,
  createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: 'Claude Code',
  sender: 'Claude Code',
  senderEmail: 'claude@anthropic.com',
  progress: 60,
  dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // Due in 2 days
  tags: ['design-system', 'frontend', 'priority-3'],
  assignedTo: 'Claude Code',
  draftGenerated: false
};

// BEFORE: Current styling chaos examples
const BeforeExamples = () => {
  return (
    <div className="migration-examples__before">
      <h2>BEFORE: Current Styling Chaos</h2>
      
      {/* Example 1: Traditional Tailwind */}
      <div className="bg-gray-50 text-gray-900 border-gray-200 p-4 mb-4 rounded-lg border">
        <h3 className="text-lg font-medium mb-2">Traditional Tailwind Approach</h3>
        <p className="text-sm text-gray-600">Using hardcoded Tailwind classes</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">In Progress</span>
          <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs">High Priority</span>
        </div>
      </div>
      
      {/* Example 2: Dark Slate Theme */}
      <div className="bg-slate-900 text-slate-300 border-slate-700 p-4 mb-4 rounded-lg border">
        <h3 className="text-lg font-medium mb-2 text-slate-100">Dark Slate Theme Approach</h3>
        <p className="text-sm text-slate-400">Using slate color variants</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs">In Progress</span>
          <span className="px-2 py-1 bg-slate-600 text-slate-200 rounded text-xs">High Priority</span>
        </div>
      </div>
      
      {/* Example 3: CSS Variables */}
      <div style={{
        backgroundColor: 'var(--background)',
        color: 'var(--foreground)',
        border: '1px solid var(--border)',
        padding: '16px',
        marginBottom: '16px',
        borderRadius: '8px'
      }}>
        <h3 style={{ fontSize: '18px', fontWeight: '500', marginBottom: '8px' }}>CSS Variables Approach</h3>
        <p style={{ fontSize: '14px', color: 'var(--muted-foreground)' }}>Using CSS custom properties</p>
        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ 
            padding: '4px 8px', 
            backgroundColor: 'var(--primary)', 
            color: 'var(--primary-foreground)', 
            borderRadius: '4px', 
            fontSize: '12px' 
          }}>In Progress</span>
          <span style={{ 
            padding: '4px 8px', 
            backgroundColor: 'var(--destructive)', 
            color: 'var(--destructive-foreground)', 
            borderRadius: '4px', 
            fontSize: '12px' 
          }}>High Priority</span>
        </div>
      </div>
      
      {/* Example 4: Hardcoded Colors */}
      <div style={{
        backgroundColor: '#ffffff',
        color: '#111827',
        border: '1px solid #e5e7eb',
        padding: '16px',
        marginBottom: '16px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)'
      }}>
        <h3 style={{ 
          fontSize: '18px', 
          fontWeight: '500', 
          marginBottom: '8px', 
          color: '#1f2937' 
        }}>Hardcoded Colors Approach</h3>
        <p style={{ 
          fontSize: '14px', 
          color: '#6b7280' 
        }}>Using hardcoded hex values</p>
        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ 
            padding: '4px 8px', 
            backgroundColor: '#2563EB', 
            color: '#ffffff', 
            borderRadius: '4px', 
            fontSize: '12px' 
          }}>In Progress</span>
          <span style={{ 
            padding: '4px 8px', 
            backgroundColor: '#EA580C', 
            color: '#ffffff', 
            borderRadius: '4px', 
            fontSize: '12px' 
          }}>High Priority</span>
        </div>
      </div>
    </div>
  );
};

// AFTER: Unified design system examples
const AfterExamples = () => {
  const handleTaskSelect = (task: Task) => {
    console.log('Task selected:', task.title);
  };

  const handleStatusChange = (taskId: string, status: Task['status']) => {
    console.log('Status changed:', taskId, status);
  };

  const handleEdit = (task: Task) => {
    console.log('Edit task:', task.title);
  };

  const handleDelete = (taskId: string) => {
    console.log('Delete task:', taskId);
  };

  return (
    <div className="migration-examples__after">
      <h2>AFTER: Unified Design System</h2>
      
      {/* Default variant */}
      <div className="u-mb-4">
        <h3 className="u-text-heading-sm u-mb-2">Default TaskCard</h3>
        <UnifiedTaskCard
          task={exampleTask}
          onSelect={handleTaskSelect}
          onStatusChange={handleStatusChange}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>
      
      {/* Compact variant */}
      <div className="u-mb-4">
        <h3 className="u-text-heading-sm u-mb-2">Compact TaskCard</h3>
        <UnifiedTaskCard
          task={exampleTask}
          variant="compact"
          onSelect={handleTaskSelect}
          onStatusChange={handleStatusChange}
        />
      </div>
      
      {/* Spacious variant */}
      <div className="u-mb-4">
        <h3 className="u-text-heading-sm u-mb-2">Spacious TaskCard</h3>
        <UnifiedTaskCard
          task={exampleTask}
          variant="spacious"
          onSelect={handleTaskSelect}
          onStatusChange={handleStatusChange}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>
      
      {/* Different priorities */}
      <div className="u-mb-4">
        <h3 className="u-text-heading-sm u-mb-2">Priority Variations</h3>
        <div className="u-space-y-2">
          <UnifiedTaskCard
            task={{ ...exampleTask, priority: TaskPriority.LOW, urgency: TaskPriority.LOW, title: 'Low priority task' }}
            variant="compact"
            showActions={false}
          />
          <UnifiedTaskCard
            task={{ ...exampleTask, priority: TaskPriority.MEDIUM, urgency: TaskPriority.MEDIUM, title: 'Medium priority task' }}
            variant="compact"
            showActions={false}
          />
          <UnifiedTaskCard
            task={{ ...exampleTask, priority: TaskPriority.HIGH, urgency: TaskPriority.HIGH, title: 'High priority task' }}
            variant="compact"
            showActions={false}
          />
          <UnifiedTaskCard
            task={{ ...exampleTask, priority: TaskPriority.CRITICAL, urgency: TaskPriority.CRITICAL, title: 'Critical priority task' }}
            variant="compact"
            showActions={false}
          />
        </div>
      </div>
    </div>
  );
};

// Theme Controls Example
const ThemeControls = () => {
  const themeManager = getThemeManager();
  const [currentTheme, setCurrentTheme] = React.useState(themeManager.getTheme());

  React.useEffect(() => {
    const unsubscribe = themeManager.subscribe(setCurrentTheme);
    return unsubscribe;
  }, [themeManager]);

  const handleModeChange = (mode: 'light' | 'dark' | 'system') => {
    themeManager.updateTheme({ mode });
  };

  const handleDensityChange = (density: 'compact' | 'comfortable' | 'spacious') => {
    themeManager.updateTheme({ density });
  };

  const handlePresetApply = (presetName: string) => {
    themeManager.applyPreset(presetName);
  };

  return (
    <div className="u-bg-card u-p-6 u-rounded-card u-border u-border-primary">
      <h3 className="u-text-heading-sm u-mb-4">Theme Controls</h3>
      
      <div className="u-space-y-4">
        <div>
          <label className="u-text-form-label u-font-medium u-mb-2 u-block">Theme Mode</label>
          <div className="u-flex u-gap-2">
            {['light', 'dark', 'system'].map((mode) => (
              <button
                key={mode}
                className={`u-px-3 u-py-2 u-text-sm u-rounded-md u-border u-capitalize ${
                  currentTheme.mode === mode
                    ? 'u-bg-primary u-text-white u-border-primary'
                    : 'u-bg-surface u-border-primary u-text-primary hover:u-bg-hover'
                }`}
                onClick={() => handleModeChange(mode as any)}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
        
        <div>
          <label className="u-text-form-label u-font-medium u-mb-2 u-block">Density</label>
          <div className="u-flex u-gap-2">
            {['compact', 'comfortable', 'spacious'].map((density) => (
              <button
                key={density}
                className={`u-px-3 u-py-2 u-text-sm u-rounded-md u-border u-capitalize ${
                  currentTheme.density === density
                    ? 'u-bg-primary u-text-white u-border-primary'
                    : 'u-bg-surface u-border-primary u-text-primary hover:u-bg-hover'
                }`}
                onClick={() => handleDensityChange(density as any)}
              >
                {density}
              </button>
            ))}
          </div>
        </div>
        
        <div>
          <label className="u-text-form-label u-font-medium u-mb-2 u-block">Theme Presets</label>
          <div className="u-grid u-grid-cols-2 u-gap-2">
            {['default', 'compact', 'spacious', 'minimal', 'dark-focus', 'accessibility'].map((preset) => (
              <button
                key={preset}
                className="u-px-3 u-py-2 u-text-sm u-rounded-md u-border u-capitalize u-bg-surface u-border-primary u-text-primary hover:u-bg-hover"
                onClick={() => handlePresetApply(preset)}
              >
                {preset.replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Migration comparison component
export const MigrationExamples = () => {
  return (
    <div className="migration-examples u-p-6 u-space-y-8">
      <header className="u-text-center u-mb-8">
        <h1 className="u-text-display u-font-bold u-text-primary u-mb-4">
          Design System Migration Examples
        </h1>
        <p className="u-text-body-lg u-text-secondary u-max-w-3xl u-mx-auto">
          Compare the current styling chaos with the new unified design system approach. 
          The design system eliminates inconsistencies and provides a scalable, maintainable foundation.
        </p>
      </header>
      
      <div className="u-grid u-grid-cols-1 lg:u-grid-cols-2 u-gap-8">
        <section className="u-bg-error u-bg-opacity-5 u-p-6 u-rounded-lg u-border u-border-error">
          <BeforeExamples />
        </section>
        
        <section className="u-bg-success u-bg-opacity-5 u-p-6 u-rounded-lg u-border u-border-success">
          <AfterExamples />
        </section>
      </div>
      
      <section className="u-mt-8">
        <ThemeControls />
      </section>
      
      <footer className="u-text-center u-mt-12 u-p-6 u-bg-surface-secondary u-rounded-lg">
        <h3 className="u-text-heading-sm u-mb-4">Benefits of the Unified Design System</h3>
        <div className="u-grid u-grid-cols-1 md:u-grid-cols-3 u-gap-6">
          <div className="u-text-center">
            <div className="u-w-12 u-h-12 u-bg-primary u-text-white u-rounded-full u-flex u-items-center u-justify-center u-mx-auto u-mb-3">
              <span className="u-font-bold">1</span>
            </div>
            <h4 className="u-font-semibold u-mb-2">Consistency</h4>
            <p className="u-text-sm u-text-secondary">Unified visual language across all components</p>
          </div>
          
          <div className="u-text-center">
            <div className="u-w-12 u-h-12 u-bg-primary u-text-white u-rounded-full u-flex u-items-center u-justify-center u-mx-auto u-mb-3">
              <span className="u-font-bold">2</span>
            </div>
            <h4 className="u-font-semibold u-mb-2">Maintainability</h4>
            <p className="u-text-sm u-text-secondary">Centralized design decisions and easy updates</p>
          </div>
          
          <div className="u-text-center">
            <div className="u-w-12 u-h-12 u-bg-primary u-text-white u-rounded-full u-flex u-items-center u-justify-center u-mx-auto u-mb-3">
              <span className="u-font-bold">3</span>
            </div>
            <h4 className="u-font-semibold u-mb-2">Developer Experience</h4>
            <p className="u-text-sm u-text-secondary">Clear patterns and helpful tooling</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MigrationExamples;