import React, { useState, useEffect } from 'react';
import {
  EnvelopeIcon,
  CheckCircleIcon,
  PencilSquareIcon,
  Cog6ToothIcon,
  MagnifyingGlassIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import {
  EnvelopeIcon as EnvelopeSolidIcon,
  CheckCircleIcon as CheckCircleSolidIcon,
  PencilSquareIcon as PencilSquareSolidIcon,
  Cog6ToothIcon as Cog6ToothSolidIcon,
  MagnifyingGlassIcon as MagnifyingGlassSolidIcon
} from '@heroicons/react/24/solid';

interface BottomNavigationProps {
  currentView: 'emails' | 'tasks' | 'drafts' | 'search' | 'settings';
  onViewChange: (view: 'emails' | 'tasks' | 'drafts' | 'search' | 'settings') => void;
  taskCount?: number;
  unreadCount?: number;
  draftCount?: number;
  onQuickAction?: () => void;
  isOffline?: boolean;
}

interface NavigationItem {
  id: 'emails' | 'tasks' | 'drafts' | 'search' | 'settings';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  solidIcon: React.ComponentType<{ className?: string }>;
  badge?: number;
  isNew?: boolean;
}

const BottomNavigation: React.FC<BottomNavigationProps> = ({
  currentView,
  onViewChange,
  taskCount = 0,
  unreadCount = 0,
  draftCount = 0,
  onQuickAction,
  isOffline = false
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [showQuickActions, setShowQuickActions] = useState(false);

  // Navigation items configuration
  const navigationItems: NavigationItem[] = [
    {
      id: 'emails',
      label: 'Emails',
      icon: EnvelopeIcon,
      solidIcon: EnvelopeSolidIcon,
      badge: unreadCount > 0 ? unreadCount : undefined
    },
    {
      id: 'tasks',
      label: 'Tasks',
      icon: CheckCircleIcon,
      solidIcon: CheckCircleSolidIcon,
      badge: taskCount > 0 ? taskCount : undefined
    },
    {
      id: 'drafts',
      label: 'Drafts',
      icon: PencilSquareIcon,
      solidIcon: PencilSquareSolidIcon,
      badge: draftCount > 0 ? draftCount : undefined
    },
    {
      id: 'search',
      label: 'Search',
      icon: MagnifyingGlassIcon,
      solidIcon: MagnifyingGlassSolidIcon
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Cog6ToothIcon,
      solidIcon: Cog6ToothSolidIcon
    }
  ];

  const quickActions = [
    { label: 'New Email', icon: EnvelopeIcon, action: 'compose' },
    { label: 'Quick Task', icon: CheckCircleIcon, action: 'task' },
    { label: 'Voice Note', icon: PencilSquareIcon, action: 'voice' }
  ];

  // Auto-hide navigation on scroll
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const isScrollingDown = currentScrollY > lastScrollY;
      const scrollThreshold = 10;

      if (Math.abs(currentScrollY - lastScrollY) > scrollThreshold) {
        setIsVisible(!isScrollingDown || currentScrollY < 100);
        setLastScrollY(currentScrollY);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  // Handle tab change with haptic feedback
  const handleTabChange = (viewId: string) => {
    // Trigger haptic feedback if available
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }

    onViewChange(viewId as any);
    setShowQuickActions(false);
  };

  // Handle quick action
  const handleQuickAction = (action: string) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(15);
    }

    setShowQuickActions(false);
    onQuickAction?.();
  };

  // Calculate safe area insets for devices with home indicators
  const safeAreaBottom = 'env(safe-area-inset-bottom, 0px)';

  return (
    <>
      {/* Quick Actions Overlay */}
      {showQuickActions && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 fade-in"
          onClick={() => setShowQuickActions(false)}
        >
          <div className="absolute bottom-20 right-4 space-y-3 slide-in-up">
            {quickActions.map((action, index) => (
              <button
                key={action.action}
                onClick={() => handleQuickAction(action.action)}
                className="flex items-center gap-3 bg-background border border-border rounded-full px-4 py-3 shadow-lg touch-feedback"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <action.icon className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-foreground pr-2">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <nav
        className={`mobile-nav fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-border z-50 transition-transform duration-300 ${
          isVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ paddingBottom: safeAreaBottom }}
        role="tablist"
        aria-label="Main navigation"
      >
        {/* Offline Indicator */}
        {isOffline && (
          <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-orange-500 text-white px-3 py-1 rounded-t-lg text-xs font-medium">
            Offline Mode
          </div>
        )}

        {/* Navigation Items */}
        <div className="flex items-center justify-around px-2 py-2">
          {navigationItems.map((item) => {
            const isActive = currentView === item.id;
            const IconComponent = isActive ? item.solidIcon : item.icon;

            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`relative flex flex-col items-center justify-center min-h-[48px] min-w-[48px] px-3 py-2 rounded-lg touch-feedback transition-colors ${
                  isActive
                    ? 'text-primary bg-primary/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
                role="tab"
                aria-selected={isActive}
                aria-label={`${item.label} tab`}
              >
                {/* Icon */}
                <div className="relative">
                  <IconComponent className="w-6 h-6" />
                  
                  {/* Badge */}
                  {item.badge && item.badge > 0 && (
                    <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {item.badge > 99 ? '99+' : item.badge}
                    </div>
                  )}

                  {/* New Indicator */}
                  {item.isNew && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                  )}
                </div>

                {/* Label */}
                <span className={`text-xs font-medium mt-1 transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}>
                  {item.label}
                </span>

                {/* Active Indicator */}
                {isActive && (
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                )}
              </button>
            );
          })}

          {/* Quick Action Button */}
          <button
            onClick={() => setShowQuickActions(!showQuickActions)}
            className={`relative flex flex-col items-center justify-center min-h-[48px] min-w-[48px] px-3 py-2 rounded-full bg-primary text-primary-foreground touch-feedback transition-all ${
              showQuickActions ? 'rotate-45 scale-110' : 'hover:scale-105'
            }`}
            aria-label="Quick actions"
          >
            <PlusIcon className="w-6 h-6" />
            <span className="text-xs font-medium mt-1">Add</span>
          </button>
        </div>

        {/* Active Tab Indicator */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
      </nav>

      {/* Safe Area Spacer */}
      <div 
        className="h-16 bg-transparent" 
        style={{ height: `calc(64px + ${safeAreaBottom})` }}
        aria-hidden="true"
      />
    </>
  );
};

export default BottomNavigation;