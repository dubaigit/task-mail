import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../App';
import { Icons } from './ui/icons';
import { Badge, Button, Input, Tooltip } from './ui';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications] = useState([
    { id: 1, message: 'New high priority email received', time: '2 min ago', unread: true },
    { id: 2, message: 'Draft ready for review', time: '1 hour ago', unread: true },
    { id: 3, message: 'Weekly analytics report generated', time: '3 hours ago', unread: false }
  ]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  
  const navigation = [
    { name: 'Dashboard', href: '/', icon: Icons.home, count: null },
    { name: 'Emails', href: '/emails', icon: Icons.mail, count: 24 },
    { name: 'Tasks', href: '/tasks', icon: Icons.list, count: 8 },
    { name: 'Drafts', href: '/drafts', icon: Icons.document, count: 3 },
    { name: 'Analytics', href: '/analytics', icon: Icons.barChart, count: null },
  ];

  const quickActions = [
    { name: 'Filter High Priority', icon: Icons.filter, action: () => {} },
    { name: 'Schedule Review', icon: Icons.calendar, action: () => {} },
    { name: 'Recent Activity', icon: Icons.clock, action: () => {} },
  ];

  const userMenuItems = [
    { name: 'Profile Settings', icon: Icons.user, action: () => {} },
    { name: 'App Preferences', icon: Icons.settings, action: () => {} },
    { name: 'Sign Out', icon: Icons.external, action: () => {} },
  ];

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle search
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Implement search functionality
    }
  };

  const unreadNotifications = notifications.filter(n => n.unread).length;

  return (
    <div className="layout-container layout-grid">
      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-overlay bg-black/50 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className="sidebar layout-sidebar">
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center text-white font-bold text-lg">
              EI
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Email Intelligence</h1>
              <p className="text-xs text-muted-foreground">Smart Email Management</p>
            </div>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <Icons.close className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="group flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 bg-primary text-primary-foreground shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span>{item.name}</span>
                </div>
                {item.count && (
                  <Badge
                    variant={isActive ? 'secondary' : 'default'}
                    
                    className="ml-auto"
                  >
                    {item.count}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="main-content" style={{
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0
      }}>
        {/* Top Navigation */}
        <header className="bg-card border-b border-border shadow-sm sticky top-0 z-sticky">
          <div className="flex items-center justify-between px-4 lg:px-6 py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <Icons.menu className="w-5 h-5" />
              </button>

              <form onSubmit={handleSearchSubmit} className="hidden sm:block" role="search">
                <div className="relative">
                  <Input
                    id="main-search-input"
                    type="search"
                    placeholder="Search emails, tasks, drafts..."
                    aria-label="Search emails, tasks, and drafts"
                    aria-describedby="search-description"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-80"
                    leftIcon={<Icons.search className="w-4 h-4" aria-hidden="true" />}
                    autoComplete="off"
                    role="searchbox"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setSearchQuery('');
                        e.currentTarget.blur();
                      }
                    }}
                  />
                  <div id="search-description" className="sr-only">
                    Use this search box to find emails, tasks, and drafts. Press Enter to search or Escape to clear.
                  </div>
                </div>
              </form>
            </div>

            <div className="flex items-center gap-3">
              <Tooltip content={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors duration-200"
                >
                  {isDark ? <Icons.lightbulb className="w-5 h-5" /> : <Icons.moon className="w-5 h-5" />}
                </button>
              </Tooltip>

              <div className="relative" ref={notificationRef}>
                <Tooltip content="Notifications">
                  <button
                    onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                    className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors duration-200"
                  >
                    <Icons.bell className="w-5 h-5" />
                    {unreadNotifications > 0 && (
                      <Badge
                        variant="danger"
                        
                        className="absolute -top-1 -right-1 px-1.5 min-w-[1.25rem] h-5 text-xs flex items-center justify-center"
                      >
                        {unreadNotifications}
                      </Badge>
                    )}
                  </button>
                </Tooltip>
              </div>

              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors duration-200"
                >
                  <div className="w-8 h-8 bg-gradient-primary rounded-full flex items-center justify-center text-white text-sm font-medium">
                    JD
                  </div>
                  <Icons.chevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto py-6" style={{
          maxWidth: '100%',
          overflow: 'auto'
        }}>
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
