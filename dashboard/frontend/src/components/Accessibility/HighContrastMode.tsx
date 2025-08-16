import React, { useEffect, useState } from 'react';
import { useAccessibility } from './AccessibilityProvider';
import { calculateContrastRatio, type ColorContrastResult } from '../../utils/a11y/a11y-utils';

export interface HighContrastTheme {
  background: string;
  foreground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  border: string;
  accent: string;
  accentForeground: string;
  muted: string;
  mutedForeground: string;
  destructive: string;
  destructiveForeground: string;
  warning: string;
  warningForeground: string;
  success: string;
  successForeground: string;
}

const highContrastThemes: Record<string, HighContrastTheme> = {
  light: {
    background: '#ffffff',
    foreground: '#000000',
    primary: '#000000',
    primaryForeground: '#ffffff',
    secondary: '#e5e5e5',
    secondaryForeground: '#000000',
    border: '#000000',
    accent: '#0066cc',
    accentForeground: '#ffffff',
    muted: '#f5f5f5',
    mutedForeground: '#666666',
    destructive: '#cc0000',
    destructiveForeground: '#ffffff',
    warning: '#cc6600',
    warningForeground: '#ffffff',
    success: '#006600',
    successForeground: '#ffffff'
  },
  dark: {
    background: '#000000',
    foreground: '#ffffff',
    primary: '#ffffff',
    primaryForeground: '#000000',
    secondary: '#333333',
    secondaryForeground: '#ffffff',
    border: '#ffffff',
    accent: '#66aaff',
    accentForeground: '#000000',
    muted: '#1a1a1a',
    mutedForeground: '#cccccc',
    destructive: '#ff6666',
    destructiveForeground: '#000000',
    warning: '#ffaa66',
    warningForeground: '#000000',
    success: '#66ff66',
    successForeground: '#000000'
  },
  yellowOnBlack: {
    background: '#000000',
    foreground: '#ffff00',
    primary: '#ffff00',
    primaryForeground: '#000000',
    secondary: '#333300',
    secondaryForeground: '#ffff00',
    border: '#ffff00',
    accent: '#ffffff',
    accentForeground: '#000000',
    muted: '#1a1a00',
    mutedForeground: '#cccc00',
    destructive: '#ff0000',
    destructiveForeground: '#ffff00',
    warning: '#ff8800',
    warningForeground: '#000000',
    success: '#00ff00',
    successForeground: '#000000'
  },
  whiteOnBlack: {
    background: '#000000',
    foreground: '#ffffff',
    primary: '#ffffff',
    primaryForeground: '#000000',
    secondary: '#404040',
    secondaryForeground: '#ffffff',
    border: '#ffffff',
    accent: '#00ffff',
    accentForeground: '#000000',
    muted: '#202020',
    mutedForeground: '#e0e0e0',
    destructive: '#ff4444',
    destructiveForeground: '#000000',
    warning: '#ffaa00',
    warningForeground: '#000000',
    success: '#44ff44',
    successForeground: '#000000'
  }
};

export interface HighContrastModeProps {
  className?: string;
}

export function HighContrastMode({ className = '' }: HighContrastModeProps) {
  const { settings, updateSettings, announce, userPreferences } = useAccessibility();
  const [selectedTheme, setSelectedTheme] = useState<string>('light');
  const [customColors, setCustomColors] = useState<Partial<HighContrastTheme>>({});
  const [contrastResults, setContrastResults] = useState<Record<string, ColorContrastResult>>({});

  useEffect(() => {
    // Auto-detect theme based on system preferences
    if (userPreferences.forcedColors) {
      // Use system forced colors
      updateSettings({ highContrast: true });
    } else if (userPreferences.highContrast) {
      // Use high contrast mode
      updateSettings({ highContrast: true });
      setSelectedTheme('dark');
    }
  }, [userPreferences, updateSettings]);

  useEffect(() => {
    if (settings.highContrast) {
      applyHighContrastTheme(selectedTheme);
      validateContrast(selectedTheme);
    } else {
      removeHighContrastTheme();
    }
  }, [settings.highContrast, selectedTheme, customColors]);

  const applyHighContrastTheme = (themeName: string) => {
    const theme = highContrastThemes[themeName];
    if (!theme) return;

    const mergedTheme = { ...theme, ...customColors };
    const root = document.documentElement;

    // Apply CSS custom properties
    Object.entries(mergedTheme).forEach(([key, value]) => {
      root.style.setProperty(`--hc-${key}`, value);
    });

    // Apply high contrast class
    root.classList.add('high-contrast-mode');
    root.classList.add(`high-contrast-${themeName}`);

    // Announce theme change
    announce({
      message: `High contrast mode enabled with ${themeName} theme`,
      priority: 'polite'
    });
  };

  const removeHighContrastTheme = () => {
    const root = document.documentElement;
    
    // Remove custom properties
    Object.keys(highContrastThemes.light).forEach(key => {
      root.style.removeProperty(`--hc-${key}`);
    });

    // Remove classes
    root.classList.remove('high-contrast-mode');
    Object.keys(highContrastThemes).forEach(themeName => {
      root.classList.remove(`high-contrast-${themeName}`);
    });

    announce({
      message: 'High contrast mode disabled',
      priority: 'polite'
    });
  };

  const validateContrast = (themeName: string) => {
    const theme = { ...highContrastThemes[themeName], ...customColors };
    const results: Record<string, ColorContrastResult> = {};

    // Test key color combinations
    const combinations = [
      { name: 'Primary', fg: theme.primaryForeground, bg: theme.primary },
      { name: 'Secondary', fg: theme.secondaryForeground, bg: theme.secondary },
      { name: 'Background', fg: theme.foreground, bg: theme.background },
      { name: 'Accent', fg: theme.accentForeground, bg: theme.accent },
      { name: 'Destructive', fg: theme.destructiveForeground, bg: theme.destructive },
      { name: 'Warning', fg: theme.warningForeground, bg: theme.warning },
      { name: 'Success', fg: theme.successForeground, bg: theme.success }
    ];

    combinations.forEach(combo => {
      results[combo.name] = calculateContrastRatio(combo.fg, combo.bg);
    });

    setContrastResults(results);
  };

  const toggleHighContrast = () => {
    updateSettings({ highContrast: !settings.highContrast });
  };

  const handleThemeChange = (themeName: string) => {
    setSelectedTheme(themeName);
    announce({
      message: `Switched to ${themeName} high contrast theme`,
      priority: 'polite'
    });
  };

  const handleCustomColorChange = (colorKey: keyof HighContrastTheme, value: string) => {
    setCustomColors(prev => ({
      ...prev,
      [colorKey]: value
    }));
  };

  // Inject high contrast CSS
  useEffect(() => {
    const styleId = 'high-contrast-styles';
    let existingStyles = document.getElementById(styleId);
    
    if (!existingStyles) {
      existingStyles = document.createElement('style');
      existingStyles.id = styleId;
      document.head.appendChild(existingStyles);
    }

    existingStyles.textContent = `
      /* High contrast mode styles */
      .high-contrast-mode {
        --background: var(--hc-background, #000);
        --foreground: var(--hc-foreground, #fff);
        --primary: var(--hc-primary, #fff);
        --primary-foreground: var(--hc-primaryForeground, #000);
        --secondary: var(--hc-secondary, #333);
        --secondary-foreground: var(--hc-secondaryForeground, #fff);
        --border: var(--hc-border, #fff);
        --accent: var(--hc-accent, #66aaff);
        --accent-foreground: var(--hc-accentForeground, #000);
        --muted: var(--hc-muted, #1a1a1a);
        --muted-foreground: var(--hc-mutedForeground, #ccc);
        --destructive: var(--hc-destructive, #ff6666);
        --destructive-foreground: var(--hc-destructiveForeground, #000);
        --warning: var(--hc-warning, #ffaa66);
        --warning-foreground: var(--hc-warningForeground, #000);
        --success: var(--hc-success, #66ff66);
        --success-foreground: var(--hc-successForeground, #000);
      }

      .high-contrast-mode * {
        /* Remove shadows and subtle effects */
        box-shadow: none !important;
        text-shadow: none !important;
      }

      .high-contrast-mode img:not([alt]) {
        /* Hide decorative images */
        opacity: 0.1;
      }

      .high-contrast-mode .decorative {
        /* Hide decorative elements */
        display: none !important;
      }

      /* Focus indicators in high contrast */
      .high-contrast-mode *:focus-visible {
        outline: 3px solid var(--accent) !important;
        outline-offset: 2px !important;
      }

      /* Button styles in high contrast */
      .high-contrast-mode button {
        border: 2px solid var(--border) !important;
        background: var(--primary) !important;
        color: var(--primary-foreground) !important;
      }

      .high-contrast-mode button:hover {
        background: var(--accent) !important;
        color: var(--accent-foreground) !important;
      }

      /* Link styles in high contrast */
      .high-contrast-mode a {
        color: var(--accent) !important;
        text-decoration: underline !important;
      }

      .high-contrast-mode a:visited {
        color: var(--muted-foreground) !important;
      }

      /* Form control styles */
      .high-contrast-mode input,
      .high-contrast-mode textarea,
      .high-contrast-mode select {
        border: 2px solid var(--border) !important;
        background: var(--background) !important;
        color: var(--foreground) !important;
      }

      /* High contrast specific themes */
      .high-contrast-yellowOnBlack {
        filter: none !important;
      }

      .high-contrast-whiteOnBlack {
        filter: none !important;
      }

      /* Windows High Contrast support */
      @media (forced-colors: active) {
        .high-contrast-mode {
          forced-color-adjust: none;
        }
      }
    `;

    return () => {
      if (existingStyles && existingStyles.parentNode) {
        existingStyles.parentNode.removeChild(existingStyles);
      }
    };
  }, []);

  return (
    <div className={`high-contrast-controls ${className}`}>
      <div className="contrast-toggle" style={{ marginBottom: '16px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.highContrast}
            onChange={toggleHighContrast}
            aria-describedby="high-contrast-description"
          />
          <span>Enable High Contrast Mode</span>
        </label>
        <p id="high-contrast-description" style={{ 
          fontSize: '14px', 
          color: '#666', 
          margin: '4px 0 0 0' 
        }}>
          Improves readability with higher color contrast ratios
        </p>
      </div>

      {settings.highContrast && (
        <div className="contrast-options">
          <div className="theme-selector" style={{ marginBottom: '16px' }}>
            <label htmlFor="theme-select" style={{ display: 'block', marginBottom: '8px' }}>
              High Contrast Theme:
            </label>
            <select
              id="theme-select"
              value={selectedTheme}
              onChange={(e) => handleThemeChange(e.target.value)}
              style={{
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                background: '#fff'
              }}
            >
              <option value="light">Light Theme</option>
              <option value="dark">Dark Theme</option>
              <option value="yellowOnBlack">Yellow on Black</option>
              <option value="whiteOnBlack">White on Black</option>
            </select>
          </div>

          <div className="contrast-validation" style={{ marginBottom: '16px' }}>
            <h4 style={{ marginBottom: '8px' }}>Contrast Ratios:</h4>
            <div style={{ fontSize: '14px' }}>
              {Object.entries(contrastResults).map(([name, result]) => (
                <div
                  key={name}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '4px 0',
                    borderBottom: '1px solid #eee'
                  }}
                >
                  <span>{name}:</span>
                  <span style={{
                    color: result.isAACompliant ? '#006600' : '#cc0000',
                    fontWeight: '600'
                  }}>
                    {result.ratio}:1 ({result.score.toUpperCase()})
                  </span>
                </div>
              ))}
            </div>
          </div>

          <details className="custom-colors" style={{ marginTop: '16px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: '600' }}>
              Custom Color Overrides
            </summary>
            <div style={{ marginTop: '12px', display: 'grid', gap: '8px' }}>
              {Object.keys(highContrastThemes.light).map(colorKey => (
                <label
                  key={colorKey}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span style={{ textTransform: 'capitalize' }}>
                    {colorKey.replace(/([A-Z])/g, ' $1').trim()}:
                  </span>
                  <input
                    type="color"
                    value={customColors[colorKey as keyof HighContrastTheme] || 
                           highContrastThemes[selectedTheme][colorKey as keyof HighContrastTheme]}
                    onChange={(e) => handleCustomColorChange(
                      colorKey as keyof HighContrastTheme,
                      e.target.value
                    )}
                    style={{ width: '50px', height: '30px' }}
                  />
                </label>
              ))}
            </div>
          </details>
        </div>
      )}

      <div className="contrast-info" style={{ 
        marginTop: '16px', 
        padding: '12px', 
        background: '#f9f9f9', 
        borderRadius: '4px',
        fontSize: '14px'
      }}>
        <h4 style={{ margin: '0 0 8px 0' }}>Accessibility Information:</h4>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li>WCAG AA requires a contrast ratio of at least 4.5:1 for normal text</li>
          <li>WCAG AAA requires a contrast ratio of at least 7:1 for normal text</li>
          <li>Large text (18pt+ or 14pt+ bold) requires lower ratios</li>
          <li>Use Tab key to navigate, Enter to activate controls</li>
        </ul>
      </div>
    </div>
  );
}