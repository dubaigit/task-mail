import React, { useState, ReactNode, useEffect } from 'react';
import { useAccessibility } from './AccessibilityProvider';

export interface SimplifiedModeProps {
  className?: string;
}

export interface SimplifiedLayoutProps {
  children: ReactNode;
  showAdvancedControls?: boolean;
  maxItemsPerView?: number;
  enableBreadcrumbs?: boolean;
  className?: string;
}

export interface ContextualHelpProps {
  content: string | ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  trigger?: 'hover' | 'click' | 'focus';
  className?: string;
}

/**
 * Simplified mode toggle and settings
 */
export function SimplifiedMode({ className = '' }: SimplifiedModeProps) {
  const { settings, updateSettings, announce } = useAccessibility();
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  const toggleSimplifiedMode = () => {
    const newValue = !settings.simplifiedMode;
    updateSettings({ simplifiedMode: newValue });
    
    announce({
      message: newValue ? 'Simplified mode enabled. Interface complexity reduced.' : 'Simplified mode disabled. All features restored.',
      priority: 'polite'
    });
  };

  const handleFontScaleChange = (scale: number) => {
    updateSettings({ fontScale: scale });
    announce({
      message: `Font size ${scale > 1 ? 'increased' : scale < 1 ? 'decreased' : 'reset'} to ${Math.round(scale * 100)}%`,
      priority: 'polite'
    });
  };

  return (
    <div className={`simplified-mode-controls ${className}`}>
      <div className="simplified-toggle" style={{ marginBottom: '16px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.simplifiedMode}
            onChange={toggleSimplifiedMode}
            aria-describedby="simplified-mode-description"
          />
          <span style={{ fontWeight: '500' }}>Enable Simplified Interface</span>
        </label>
        <p id="simplified-mode-description" style={{ 
          fontSize: '14px', 
          color: '#666', 
          margin: '4px 0 0 0' 
        }}>
          Reduces interface complexity and visual distractions for easier navigation
        </p>
      </div>

      {settings.simplifiedMode && (
        <div className="simplified-options" style={{ 
          padding: '16px', 
          background: '#f9f9f9', 
          borderRadius: '8px',
          border: '1px solid #e0e0e0'
        }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>Simplified Mode Options</h4>
          
          <div className="font-scale-control" style={{ marginBottom: '16px' }}>
            <label htmlFor="font-scale" style={{ display: 'block', marginBottom: '8px' }}>
              Text Size: {Math.round(settings.fontScale * 100)}%
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={() => handleFontScaleChange(Math.max(0.8, settings.fontScale - 0.1))}
                aria-label="Decrease text size"
                style={{
                  padding: '4px 8px',
                  border: '1px solid #ccc',
                  background: '#fff',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                A-
              </button>
              <input
                id="font-scale"
                type="range"
                min="0.8"
                max="2"
                step="0.1"
                value={settings.fontScale}
                onChange={(e) => handleFontScaleChange(parseFloat(e.target.value))}
                aria-label="Text size scale"
                style={{ flex: 1 }}
              />
              <button
                onClick={() => handleFontScaleChange(Math.min(2, settings.fontScale + 0.1))}
                aria-label="Increase text size"
                style={{
                  padding: '4px 8px',
                  border: '1px solid #ccc',
                  background: '#fff',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                A+
              </button>
            </div>
          </div>

          <button
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            aria-expanded={showAdvancedSettings}
            style={{
              background: 'none',
              border: 'none',
              color: '#0066cc',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            {showAdvancedSettings ? 'Hide' : 'Show'} Advanced Options
          </button>

          {showAdvancedSettings && (
            <div className="advanced-options" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e0e0e0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <input
                  type="checkbox"
                  checked={settings.reducedMotion}
                  onChange={(e) => updateSettings({ reducedMotion: e.target.checked })}
                />
                <span>Reduce animations and motion</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <input
                  type="checkbox"
                  checked={settings.focusIndicatorsEnhanced}
                  onChange={(e) => updateSettings({ focusIndicatorsEnhanced: e.target.checked })}
                />
                <span>Enhanced focus indicators</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={settings.screenReaderOptimized}
                  onChange={(e) => updateSettings({ screenReaderOptimized: e.target.checked })}
                />
                <span>Screen reader optimizations</span>
              </label>
            </div>
          )}
        </div>
      )}

      <div className="cognitive-aids" style={{ marginTop: '16px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>Cognitive Accessibility Features</h4>
        <ul style={{ fontSize: '14px', color: '#666', paddingLeft: '20px' }}>
          <li>Simplified navigation removes complex menus</li>
          <li>Reduced visual clutter and distractions</li>
          <li>Clear, consistent interaction patterns</li>
          <li>Contextual help available on demand</li>
          <li>Larger touch targets for easier interaction</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Simplified layout wrapper that conditionally shows/hides complex elements
 */
export function SimplifiedLayout({
  children,
  showAdvancedControls = false,
  maxItemsPerView = 10,
  enableBreadcrumbs = true,
  className = ''
}: SimplifiedLayoutProps) {
  const { settings } = useAccessibility();
  const [currentPage, setCurrentPage] = useState(1);

  const isSimplified = settings.simplifiedMode;

  // Apply simplified styles
  useEffect(() => {
    if (isSimplified) {
      const styleId = 'simplified-layout-styles';
      let existingStyles = document.getElementById(styleId);
      
      if (!existingStyles) {
        existingStyles = document.createElement('style');
        existingStyles.id = styleId;
        document.head.appendChild(existingStyles);
      }

      existingStyles.textContent = `
        .simplified-layout {
          --border-radius: 0;
          --shadow: none;
          --animation-duration: 0.01ms;
        }

        .simplified-layout * {
          border-radius: 0 !important;
          box-shadow: none !important;
        }

        .simplified-layout .advanced-control {
          display: ${showAdvancedControls ? 'block' : 'none'} !important;
        }

        .simplified-layout .decorative-element {
          display: none !important;
        }

        .simplified-layout .complex-animation {
          animation: none !important;
          transition: none !important;
        }

        .simplified-layout button,
        .simplified-layout a,
        .simplified-layout [role="button"] {
          min-height: 44px !important;
          min-width: 44px !important;
          padding: 12px 16px !important;
          font-size: 16px !important;
          line-height: 1.4 !important;
        }

        .simplified-layout .simplified-text {
          font-size: 16px !important;
          line-height: 1.6 !important;
          max-width: 65ch !important;
        }

        .simplified-layout .simplified-spacing > * + * {
          margin-top: 16px !important;
        }
      `;

      return () => {
        if (existingStyles && existingStyles.parentNode) {
          existingStyles.parentNode.removeChild(existingStyles);
        }
      };
    }
  }, [isSimplified, showAdvancedControls]);

  return (
    <div 
      className={`simplified-layout ${isSimplified ? 'is-simplified' : ''} ${className}`}
      data-simplified={isSimplified}
    >
      {isSimplified && enableBreadcrumbs && (
        <nav aria-label="Current page" style={{ marginBottom: '16px' }}>
          <p style={{ 
            fontSize: '14px', 
            color: '#666',
            margin: 0,
            padding: '8px',
            background: '#f0f0f0',
            borderRadius: '4px'
          }}>
            You are in simplified mode. Some advanced features are hidden for easier navigation.
          </p>
        </nav>
      )}
      
      <div className="simplified-content simplified-spacing">
        {children}
      </div>

      {isSimplified && (
        <div className="simplified-navigation" style={{ 
          marginTop: '24px',
          padding: '16px',
          background: '#f9f9f9',
          borderRadius: '8px'
        }}>
          <h4 style={{ margin: '0 0 8px 0' }}>Need Help?</h4>
          <p style={{ fontSize: '14px', margin: '0 0 8px 0' }}>
            If you need to access advanced features, you can disable simplified mode in accessibility settings.
          </p>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('show-help'))}
            style={{
              background: '#0066cc',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Show Help
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Contextual help component for on-demand assistance
 */
export function ContextualHelp({
  content,
  position = 'bottom',
  trigger = 'click',
  className = ''
}: ContextualHelpProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const { announce } = useAccessibility();

  const showHelp = () => {
    setIsVisible(true);
    announce({
      message: 'Help information displayed',
      priority: 'polite'
    });
  };

  const hideHelp = () => {
    setIsVisible(false);
  };

  const handleMouseEnter = () => {
    if (trigger === 'hover') {
      if (timeoutId) clearTimeout(timeoutId);
      showHelp();
    }
  };

  const handleMouseLeave = () => {
    if (trigger === 'hover') {
      const id = setTimeout(hideHelp, 300);
      setTimeoutId(id);
    }
  };

  const handleClick = () => {
    if (trigger === 'click') {
      setIsVisible(!isVisible);
    }
  };

  const handleFocus = () => {
    if (trigger === 'focus') {
      showHelp();
    }
  };

  const handleBlur = () => {
    if (trigger === 'focus') {
      hideHelp();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && isVisible) {
      hideHelp();
    }
  };

  return (
    <div 
      className={`contextual-help ${className}`}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <button
        className="help-trigger"
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        aria-label="Show help information"
        aria-expanded={isVisible}
        aria-describedby={isVisible ? 'help-content' : undefined}
        style={{
          background: '#f0f0f0',
          border: '1px solid #ccc',
          borderRadius: '50%',
          width: '24px',
          height: '24px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
          color: '#666'
        }}
      >
        ?
      </button>

      {isVisible && (
        <div
          id="help-content"
          role="tooltip"
          className={`help-content help-content--${position}`}
          style={{
            position: 'absolute',
            zIndex: 1000,
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: '4px',
            padding: '12px',
            maxWidth: '300px',
            fontSize: '14px',
            lineHeight: '1.4',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            ...(position === 'bottom' && { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '4px' }),
            ...(position === 'top' && { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '4px' }),
            ...(position === 'right' && { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: '4px' }),
            ...(position === 'left' && { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: '4px' })
          }}
        >
          {typeof content === 'string' ? <p style={{ margin: 0 }}>{content}</p> : content}
        </div>
      )}
    </div>
  );
}

/**
 * Error-friendly interface component
 */
export interface ErrorFriendlyMessageProps {
  error: string;
  suggestion?: string;
  canRetry?: boolean;
  onRetry?: () => void;
  className?: string;
}

export function ErrorFriendlyMessage({
  error,
  suggestion,
  canRetry = false,
  onRetry,
  className = ''
}: ErrorFriendlyMessageProps) {
  const { announce } = useAccessibility();

  useEffect(() => {
    announce({
      message: `Error occurred: ${error}${suggestion ? ` Suggestion: ${suggestion}` : ''}`,
      priority: 'assertive'
    });
  }, [error, suggestion, announce]);

  // Convert technical errors to user-friendly messages
  const getFriendlyError = (error: string): string => {
    const errorMap: Record<string, string> = {
      '404': 'The page or item you\'re looking for couldn\'t be found.',
      '500': 'Something went wrong on our end. Please try again later.',
      'network': 'There seems to be a connection problem. Please check your internet connection.',
      'timeout': 'The request took too long. Please try again.',
      'unauthorized': 'You don\'t have permission to access this. Please sign in.',
      'validation': 'Please check your input and try again.'
    };

    const key = Object.keys(errorMap).find(k => error.toLowerCase().includes(k));
    return key ? errorMap[key] : error;
  };

  return (
    <div 
      className={`error-friendly-message ${className}`}
      role="alert"
      style={{
        padding: '16px',
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '8px',
        color: '#991b1b'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <span style={{ fontSize: '24px' }} aria-hidden="true">⚠️</span>
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>Something went wrong</h4>
          <p style={{ margin: '0 0 8px 0', fontSize: '14px' }}>
            {getFriendlyError(error)}
          </p>
          {suggestion && (
            <p style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '500' }}>
              💡 Suggestion: {suggestion}
            </p>
          )}
          {canRetry && onRetry && (
            <button
              onClick={onRetry}
              style={{
                background: '#dc2626',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Information hierarchy component for clear content structure
 */
export interface InformationHierarchyProps {
  children: ReactNode;
  level: 1 | 2 | 3 | 4;
  priority?: 'high' | 'medium' | 'low';
  className?: string;
}

export function InformationHierarchy({
  children,
  level,
  priority = 'medium',
  className = ''
}: InformationHierarchyProps) {
  const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
  
  const styles = {
    1: { fontSize: '28px', fontWeight: '700', marginBottom: '16px' },
    2: { fontSize: '24px', fontWeight: '600', marginBottom: '14px' },
    3: { fontSize: '20px', fontWeight: '600', marginBottom: '12px' },
    4: { fontSize: '18px', fontWeight: '500', marginBottom: '10px' }
  };

  const priorityStyles = {
    high: { color: '#1f2937' },
    medium: { color: '#374151' },
    low: { color: '#6b7280' }
  };

  return (
    <HeadingTag
      className={`information-hierarchy information-hierarchy--level-${level} information-hierarchy--${priority} ${className}`}
      style={{
        ...styles[level],
        ...priorityStyles[priority],
        margin: '0 0 16px 0'
      }}
    >
      {children}
    </HeadingTag>
  );
}