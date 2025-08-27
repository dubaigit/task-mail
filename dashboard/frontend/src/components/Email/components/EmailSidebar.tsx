import React from 'react';
import { Icons } from '../../ui/icons';

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number | null;
}

interface EmailSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  selectedCategory: string;
  onCategorySelect: (category: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  user?: {
    name: string;
    email: string;
    initials: string;
  };
  onCompose?: () => void;
}

const defaultSidebarItems: SidebarItem[] = [
  { id: 'inbox', label: 'Inbox', icon: Icons.inbox, count: 24 },
  { id: 'starred', label: 'Starred', icon: Icons.star, count: 5 },
  { id: 'sent', label: 'Sent', icon: Icons.send, count: null },
  { id: 'scheduled', label: 'Scheduled', icon: Icons.clock, count: 2 },
  { id: 'archive', label: 'Archive', icon: Icons.archive, count: null },
  { id: 'trash', label: 'Trash', icon: Icons.trash, count: 1 },
];

export const EmailSidebar: React.FC<EmailSidebarProps> = ({
  collapsed,
  onToggleCollapse,
  selectedCategory,
  onCategorySelect,
  isDark,
  onToggleTheme,
  user = { name: 'John Doe', email: 'john.doe@company.com', initials: 'JD' },
  onCompose,
}) => {
  return (
    <nav 
      className={`${collapsed ? 'w-16' : 'w-60'} email-sidebar border-r border-border flex flex-col transition-all duration-300 flex-shrink-0`} 
      role="navigation" 
      aria-label="Main navigation"
    >
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Icons.mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground">Email Intelligence</h1>
              <p className="text-xs text-muted-foreground">Modern Interface</p>
            </div>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-2 hover:bg-secondary rounded-lg transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Icons.menu className="w-5 h-5" />
        </button>
      </div>

      {/* Compose Button */}
      <div className="p-4">
        <button 
          onClick={onCompose}
          className={`${collapsed ? 'w-10 h-10' : 'w-full'} compose-button text-primary-foreground rounded-lg flex items-center justify-center gap-2 py-3 font-medium`}
          aria-label="Compose new email"
        >
          <Icons.plus className="w-5 h-5" />
          {!collapsed && <span>Compose</span>}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2">
        {defaultSidebarItems.map((item) => {
          const Icon = item.icon;
          const isActive = selectedCategory === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onCategorySelect(item.id)}
              className={`sidebar-nav-item w-full flex items-center gap-3 px-3 py-2.5 mb-1 ${
                isActive 
                  ? 'active bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-label={`${item.label}${item.count ? ` (${item.count})` : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && (
                <>
                  <span className="font-medium">{item.label}</span>
                  {item.count !== null && (
                    <span className={`ml-auto text-xs px-2 py-1 rounded-full ${
                      isActive ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground'
                    }`}>
                      {item.count}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Menu */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-medium">{user.initials}</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          )}
          <button
            onClick={onToggleTheme}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Icons.sun className="w-4 h-4" /> : <Icons.moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </nav>
  );
};