/**
 * User Experience Metrics Collection System
 * 
 * Tracks comprehensive user experience metrics including interaction patterns,
 * usability metrics, accessibility compliance, and user satisfaction indicators.
 */

export interface UserInteraction {
  type: 'click' | 'scroll' | 'keyboard' | 'touch' | 'hover' | 'focus' | 'resize';
  element: string;
  timestamp: number;
  position?: { x: number; y: number };
  duration?: number;
  metadata?: Record<string, any>;
}

export interface UsabilityMetrics {
  taskCompletionRate: number; // Percentage of completed user flows
  timeToTask: number; // Average time to complete primary tasks
  errorRate: number; // Percentage of user errors
  clickDepth: number; // Average clicks to reach goals
  bounceRate: number; // Percentage of single-page sessions
  sessionDuration: number; // Average session length
  interactionRate: number; // Interactions per minute
  scrollDepth: number; // Average scroll depth percentage
}

export interface AccessibilityMetrics {
  keyboardNavigation: {
    success: boolean;
    tabStops: number;
    missingTabIndex: number;
    trapsFocus: boolean;
  };
  screenReaderSupport: {
    ariaLabels: number;
    missingAltText: number;
    headingStructure: boolean;
    landmarkUsage: number;
  };
  colorContrast: {
    passCount: number;
    failCount: number;
    averageRatio: number;
    worstRatio: number;
  };
  textScaling: {
    supportsZoom: boolean;
    respondsToUserSettings: boolean;
    readableAt200Percent: boolean;
  };
}

export interface PerformancePerception {
  perceivedLoadTime: number; // User-perceived load time
  interactionResponsiveness: number; // Response time feeling (1-10 scale)
  smoothness: number; // Animation/scroll smoothness (1-10 scale)
  reliability: number; // Error frequency perception (1-10 scale)
}

export interface UserFeedback {
  satisfactionScore: number; // 1-10 scale
  difficultyScore: number; // 1-10 scale (1 = very easy)
  completionSuccess: boolean;
  frustrationEvents: string[];
  positiveEvents: string[];
  suggestions: string[];
}

export interface UXMetricsReport {
  timestamp: number;
  sessionId: string;
  userId?: string;
  pageUrl: string;
  userAgent: string;
  viewport: { width: number; height: number };
  interactions: UserInteraction[];
  usability: UsabilityMetrics;
  accessibility: AccessibilityMetrics;
  performance: PerformancePerception;
  feedback?: UserFeedback;
  heatmapData: HeatmapPoint[];
  userJourney: UserJourneyStep[];
}

export interface HeatmapPoint {
  x: number;
  y: number;
  intensity: number;
  type: 'click' | 'hover' | 'scroll';
  element: string;
}

export interface UserJourneyStep {
  timestamp: number;
  action: string;
  element: string;
  context: string;
  success: boolean;
  timeSpent: number;
}

class UserExperienceTracker {
  private sessionId: string;
  private interactions: UserInteraction[] = [];
  private heatmapData: HeatmapPoint[] = [];
  private userJourney: UserJourneyStep[] = [];
  private sessionStartTime: number;
  private lastInteractionTime: number;
  private errorCount: number = 0;
  private completedTasks: number = 0;
  private totalTasks: number = 0;
  private isTracking: boolean = false;
  private callbacks: Map<string, Function> = new Map();

  constructor() {
    this.sessionId = this.generateSessionId();
    this.sessionStartTime = Date.now();
    this.lastInteractionTime = Date.now();
  }

  /**
   * Start UX tracking
   */
  startTracking(): void {
    if (this.isTracking) return;
    
    this.isTracking = true;
    this.setupEventListeners();
    this.startPeriodicReporting();
    this.trackInitialPageState();
  }

  /**
   * Stop UX tracking
   */
  stopTracking(): void {
    this.isTracking = false;
    this.removeEventListeners();
  }

  /**
   * Set up event listeners for user interactions
   */
  private setupEventListeners(): void {
    // Click tracking
    document.addEventListener('click', (event) => {
      this.trackInteraction({
        type: 'click',
        element: this.getElementSelector(event.target as Element),
        timestamp: Date.now(),
        position: { x: event.clientX, y: event.clientY },
        metadata: {
          button: event.button,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey
        }
      });

      this.trackHeatmapPoint({
        x: event.clientX,
        y: event.clientY,
        intensity: 1,
        type: 'click',
        element: this.getElementSelector(event.target as Element)
      });
    }, { passive: true });

    // Scroll tracking
    let scrollTimeout: number;
    document.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = window.setTimeout(() => {
        this.trackInteraction({
          type: 'scroll',
          element: 'window',
          timestamp: Date.now(),
          position: { x: window.scrollX, y: window.scrollY },
          metadata: {
            scrollDepth: this.calculateScrollDepth(),
            direction: this.getScrollDirection()
          }
        });
      }, 100);
    }, { passive: true });

    // Keyboard tracking
    document.addEventListener('keydown', (event) => {
      this.trackInteraction({
        type: 'keyboard',
        element: this.getElementSelector(event.target as Element),
        timestamp: Date.now(),
        metadata: {
          key: event.key,
          code: event.code,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey
        }
      });
    }, { passive: true });

    // Touch tracking (mobile)
    document.addEventListener('touchstart', (event) => {
      const touch = event.touches[0];
      this.trackInteraction({
        type: 'touch',
        element: this.getElementSelector(event.target as Element),
        timestamp: Date.now(),
        position: { x: touch.clientX, y: touch.clientY },
        metadata: {
          touchCount: event.touches.length
        }
      });
    }, { passive: true });

    // Focus tracking (accessibility)
    document.addEventListener('focusin', (event) => {
      this.trackInteraction({
        type: 'focus',
        element: this.getElementSelector(event.target as Element),
        timestamp: Date.now(),
        metadata: {
          focusMethod: 'tab' // Could be enhanced to detect mouse vs keyboard
        }
      });
    }, { passive: true });

    // Hover tracking (for heatmap)
    let hoverTimeout: number;
    document.addEventListener('mousemove', (event) => {
      clearTimeout(hoverTimeout);
      hoverTimeout = window.setTimeout(() => {
        this.trackHeatmapPoint({
          x: event.clientX,
          y: event.clientY,
          intensity: 0.3,
          type: 'hover',
          element: this.getElementSelector(event.target as Element)
        });
      }, 500);
    }, { passive: true });

    // Resize tracking
    window.addEventListener('resize', () => {
      this.trackInteraction({
        type: 'resize',
        element: 'window',
        timestamp: Date.now(),
        metadata: {
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          }
        }
      });
    }, { passive: true });

    // Error tracking
    window.addEventListener('error', (event) => {
      this.errorCount++;
      this.trackJourneyStep({
        timestamp: Date.now(),
        action: 'error',
        element: 'global',
        context: event.message || 'Unknown error',
        success: false,
        timeSpent: 0
      });
    });

    // Unload tracking
    window.addEventListener('beforeunload', () => {
      this.generateReport();
    });
  }

  /**
   * Remove event listeners
   */
  private removeEventListeners(): void {
    // In a real implementation, we'd store references to the handlers
    // and remove them properly
  }

  /**
   * Track individual interaction
   */
  private trackInteraction(interaction: UserInteraction): void {
    this.interactions.push(interaction);
    this.lastInteractionTime = interaction.timestamp;

    // Keep only recent interactions to prevent memory bloat
    if (this.interactions.length > 1000) {
      this.interactions = this.interactions.slice(-1000);
    }

    // Notify callbacks
    const callback = this.callbacks.get('interaction');
    if (callback) callback(interaction);
  }

  /**
   * Track heatmap data point
   */
  private trackHeatmapPoint(point: HeatmapPoint): void {
    this.heatmapData.push(point);

    // Keep only recent heatmap data
    if (this.heatmapData.length > 5000) {
      this.heatmapData = this.heatmapData.slice(-5000);
    }
  }

  /**
   * Track user journey step
   */
  trackJourneyStep(step: UserJourneyStep): void {
    this.userJourney.push(step);

    if (step.success) {
      this.completedTasks++;
    }

    // Keep journey manageable
    if (this.userJourney.length > 500) {
      this.userJourney = this.userJourney.slice(-500);
    }
  }

  /**
   * Track task completion
   */
  trackTaskCompletion(taskName: string, success: boolean, timeSpent: number): void {
    this.totalTasks++;
    if (success) {
      this.completedTasks++;
    }

    this.trackJourneyStep({
      timestamp: Date.now(),
      action: success ? 'task_completed' : 'task_failed',
      element: 'task',
      context: taskName,
      success,
      timeSpent
    });
  }

  /**
   * Get element selector for tracking
   */
  private getElementSelector(element: Element): string {
    if (!element) return 'unknown';

    // Try to get a meaningful selector
    if (element.id) return `#${element.id}`;
    if (element.className) return `.${element.className.split(' ')[0]}`;
    
    const tagName = element.tagName.toLowerCase();
    const parent = element.parentElement;
    
    if (parent) {
      const index = Array.from(parent.children).indexOf(element);
      return `${tagName}:nth-child(${index + 1})`;
    }
    
    return tagName;
  }

  /**
   * Calculate scroll depth percentage
   */
  private calculateScrollDepth(): number {
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const scrollTop = window.scrollY;
    
    return Math.round((scrollTop + windowHeight) / documentHeight * 100);
  }

  /**
   * Get scroll direction
   */
  private getScrollDirection(): 'up' | 'down' | 'none' {
    // This would require storing previous scroll position
    // Simplified implementation
    return 'down';
  }

  /**
   * Track initial page state
   */
  private trackInitialPageState(): void {
    this.trackJourneyStep({
      timestamp: Date.now(),
      action: 'page_load',
      element: 'page',
      context: window.location.pathname,
      success: true,
      timeSpent: 0
    });
  }

  /**
   * Calculate usability metrics
   */
  private calculateUsabilityMetrics(): UsabilityMetrics {
    const sessionDuration = Date.now() - this.sessionStartTime;
    const interactionCount = this.interactions.length;
    
    return {
      taskCompletionRate: this.totalTasks > 0 ? (this.completedTasks / this.totalTasks) * 100 : 0,
      timeToTask: this.calculateAverageTimeToTask(),
      errorRate: this.totalTasks > 0 ? (this.errorCount / this.totalTasks) * 100 : 0,
      clickDepth: this.calculateAverageClickDepth(),
      bounceRate: this.calculateBounceRate(),
      sessionDuration: sessionDuration / 1000, // Convert to seconds
      interactionRate: interactionCount / (sessionDuration / 60000), // Interactions per minute
      scrollDepth: this.calculateMaxScrollDepth()
    };
  }

  /**
   * Calculate accessibility metrics
   */
  private calculateAccessibilityMetrics(): AccessibilityMetrics {
    return {
      keyboardNavigation: this.assessKeyboardNavigation(),
      screenReaderSupport: this.assessScreenReaderSupport(),
      colorContrast: this.assessColorContrast(),
      textScaling: this.assessTextScaling()
    };
  }

  /**
   * Assess keyboard navigation
   */
  private assessKeyboardNavigation(): any {
    const focusableElements = document.querySelectorAll(
      'a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
    );
    
    const missingTabIndex = Array.from(focusableElements).filter(el => 
      !el.hasAttribute('tabindex') && 
      !['A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
    ).length;

    return {
      success: missingTabIndex === 0,
      tabStops: focusableElements.length,
      missingTabIndex,
      trapsFocus: this.checkFocusTrap()
    };
  }

  /**
   * Assess screen reader support
   */
  private assessScreenReaderSupport(): any {
    const ariaLabels = document.querySelectorAll('[aria-label], [aria-labelledby]').length;
    const images = document.querySelectorAll('img');
    const missingAltText = Array.from(images).filter(img => !img.alt).length;
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const landmarks = document.querySelectorAll('[role], main, nav, aside, section').length;

    return {
      ariaLabels,
      missingAltText,
      headingStructure: this.checkHeadingStructure(headings),
      landmarkUsage: landmarks
    };
  }

  /**
   * Assess color contrast
   */
  private assessColorContrast(): any {
    // This would require actual contrast calculation
    // Simplified implementation
    return {
      passCount: 0,
      failCount: 0,
      averageRatio: 0,
      worstRatio: 0
    };
  }

  /**
   * Assess text scaling
   */
  private assessTextScaling(): any {
    return {
      supportsZoom: true, // Most modern browsers support this
      respondsToUserSettings: this.checkUserSettings(),
      readableAt200Percent: true // Would need actual testing
    };
  }

  /**
   * Helper methods for accessibility assessment
   */
  private checkFocusTrap(): boolean {
    // Simplified check for modals/dialogs
    return document.querySelector('[role="dialog"], .modal') !== null;
  }

  private checkHeadingStructure(headings: NodeListOf<Element>): boolean {
    // Check if headings follow proper hierarchy
    let lastLevel = 0;
    for (const heading of Array.from(headings)) {
      const level = parseInt(heading.tagName.charAt(1));
      if (level > lastLevel + 1) return false;
      lastLevel = level;
    }
    return true;
  }

  private checkUserSettings(): boolean {
    // Check if page respects user's font-size preferences
    const computedFontSize = window.getComputedStyle(document.body).fontSize;
    return computedFontSize !== '16px'; // Indicates custom sizing
  }

  /**
   * Calculate average time to task completion
   */
  private calculateAverageTimeToTask(): number {
    const completedTasks = this.userJourney.filter(step => 
      step.action === 'task_completed'
    );
    
    if (completedTasks.length === 0) return 0;
    
    const totalTime = completedTasks.reduce((sum, task) => sum + task.timeSpent, 0);
    return totalTime / completedTasks.length / 1000; // Convert to seconds
  }

  /**
   * Calculate average click depth
   */
  private calculateAverageClickDepth(): number {
    const clickInteractions = this.interactions.filter(i => i.type === 'click');
    return clickInteractions.length / Math.max(this.completedTasks, 1);
  }

  /**
   * Calculate bounce rate
   */
  private calculateBounceRate(): number {
    const sessionDuration = Date.now() - this.sessionStartTime;
    const hasInteracted = this.interactions.length > 2; // More than just load interactions
    
    // Bounce if session is very short and has minimal interaction
    return (sessionDuration < 10000 && !hasInteracted) ? 100 : 0;
  }

  /**
   * Calculate maximum scroll depth reached
   */
  private calculateMaxScrollDepth(): number {
    const scrollInteractions = this.interactions.filter(i => 
      i.type === 'scroll' && i.metadata?.scrollDepth
    );
    
    if (scrollInteractions.length === 0) return 0;
    
    return Math.max(...scrollInteractions.map(i => i.metadata?.scrollDepth || 0));
  }

  /**
   * Generate comprehensive UX report
   */
  generateReport(): UXMetricsReport {
    const report: UXMetricsReport = {
      timestamp: Date.now(),
      sessionId: this.sessionId,
      pageUrl: window.location.href,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      interactions: [...this.interactions],
      usability: this.calculateUsabilityMetrics(),
      accessibility: this.calculateAccessibilityMetrics(),
      performance: this.calculatePerformancePerception(),
      heatmapData: [...this.heatmapData],
      userJourney: [...this.userJourney]
    };

    // Notify callbacks
    const callback = this.callbacks.get('report-generated');
    if (callback) callback(report);

    return report;
  }

  /**
   * Calculate performance perception metrics
   */
  private calculatePerformancePerception(): PerformancePerception {
    // This would be enhanced with user surveys or behavioral analysis
    const sessionDuration = Date.now() - this.sessionStartTime;
    const interactionResponsiveness = this.calculateInteractionResponsiveness();
    
    return {
      perceivedLoadTime: this.calculatePerceivedLoadTime(),
      interactionResponsiveness,
      smoothness: this.calculateSmoothnessScore(),
      reliability: Math.max(1, 10 - this.errorCount)
    };
  }

  /**
   * Calculate perceived load time
   */
  private calculatePerceivedLoadTime(): number {
    // Time to first meaningful interaction
    const firstInteraction = this.interactions.find(i => i.type === 'click' || i.type === 'keyboard');
    return firstInteraction ? firstInteraction.timestamp - this.sessionStartTime : 0;
  }

  /**
   * Calculate interaction responsiveness score
   */
  private calculateInteractionResponsiveness(): number {
    // Based on delay between interactions and visual feedback
    // Simplified scoring (1-10 scale)
    const avgInteractionDelay = 50; // Would be calculated from actual measurements
    
    if (avgInteractionDelay <= 100) return 10;
    if (avgInteractionDelay <= 200) return 8;
    if (avgInteractionDelay <= 500) return 6;
    if (avgInteractionDelay <= 1000) return 4;
    return 2;
  }

  /**
   * Calculate smoothness score
   */
  private calculateSmoothnessScore(): number {
    // Based on scroll performance and animation smoothness
    // Would be enhanced with frame rate monitoring
    return 8; // Placeholder
  }

  /**
   * Start periodic reporting
   */
  private startPeriodicReporting(): void {
    setInterval(() => {
      if (this.isTracking) {
        const callback = this.callbacks.get('periodic-update');
        if (callback) callback(this.generateReport());
      }
    }, 30000); // Report every 30 seconds
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `ux_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set user feedback
   */
  setUserFeedback(feedback: UserFeedback): void {
    const callback = this.callbacks.get('user-feedback');
    if (callback) callback(feedback);
  }

  /**
   * Register callbacks
   */
  onInteraction(callback: (interaction: UserInteraction) => void): void {
    this.callbacks.set('interaction', callback);
  }

  onReportGenerated(callback: (report: UXMetricsReport) => void): void {
    this.callbacks.set('report-generated', callback);
  }

  onPeriodicUpdate(callback: (report: UXMetricsReport) => void): void {
    this.callbacks.set('periodic-update', callback);
  }

  onUserFeedback(callback: (feedback: UserFeedback) => void): void {
    this.callbacks.set('user-feedback', callback);
  }

  /**
   * Get current session metrics
   */
  getCurrentMetrics(): Partial<UXMetricsReport> {
    return {
      sessionId: this.sessionId,
      interactions: this.interactions,
      usability: this.calculateUsabilityMetrics(),
      accessibility: this.calculateAccessibilityMetrics(),
      performance: this.calculatePerformancePerception()
    };
  }
}

// Export singleton instance
export const uxTracker = new UserExperienceTracker();

// React hook for UX tracking
export function useUserExperienceTracking() {
  return {
    tracker: uxTracker,
    startTracking: () => uxTracker.startTracking(),
    stopTracking: () => uxTracker.stopTracking(),
    trackTask: (name: string, success: boolean, time: number) => 
      uxTracker.trackTaskCompletion(name, success, time),
    generateReport: () => uxTracker.generateReport(),
    getCurrentMetrics: () => uxTracker.getCurrentMetrics()
  };
}

export default UserExperienceTracker;