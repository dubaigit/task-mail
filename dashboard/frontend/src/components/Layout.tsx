import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../App';
import { 
  EnvelopeIcon, 
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  ChartBarIcon,
  SunIcon,
  MoonIcon,
  MagnifyingGlassIcon,
  BellIcon,
  UserCircleIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  HomeIcon,
  FunnelIcon,
  CalendarDaysIcon,
  ClockIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
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
    { name: 'Dashboard', href: '/', icon: HomeIcon, count: null },
    { name: 'Emails', href: '/emails', icon: EnvelopeIcon, count: 24 },
    { name: 'Tasks', href: '/tasks', icon: ClipboardDocumentListIcon, count: 8 },
    { name: 'Drafts', href: '/drafts', icon: DocumentTextIcon, count: 3 },
    { name: 'Analytics', href: '/analytics', icon: ChartBarIcon, count: null },
  ];

  const quickActions = [
    { name: 'Filter High Priority', icon: FunnelIcon, action: () => console.log('Filter high priority') },
    { name: 'Schedule Review', icon: CalendarDaysIcon, action: () => console.log('Schedule review') },
    { name: 'Recent Activity', icon: ClockIcon, action: () => console.log('Recent activity') },
  ];

  const userMenuItems = [
    { name: 'Profile Settings', icon: UserCircleIcon, action: () => console.log('Profile') },
    { name: 'App Preferences', icon: Cog6ToothIcon, action: () => console.log('Settings') },
    { name: 'Sign Out', icon: ArrowRightOnRectangleIcon, action: () => console.log('Sign out') },
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
      console.log('Searching for:', searchQuery);
      // Implement search functionality
    }
  };

  const unreadNotifications = notifications.filter(n => n.unread).length;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-overlay bg-black/50 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-sidebar w-72 bg-card border-r border-border transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 lg:translate-x-0 -translate-x-full data-[state=open]:translate-x-0">
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
            <XMarkIcon className="w-5 h-5" />
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
                    size="sm"
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
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navigation */}
        <header className="bg-card border-b border-border shadow-sm sticky top-0 z-sticky">
          <div className="flex items-center justify-between px-4 lg:px-6 py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <Bars3Icon className="w-5 h-5" />
              </button>

              <form onSubmit={handleSearchSubmit} className="hidden sm:block">
                <Input
                  type="search"
                  placeholder="Search emails, tasks, drafts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-80"
                  leftIcon={<MagnifyingGlassIcon className="w-4 h-4" />}
                />
              </form>
            </div>

            <div className="flex items-center gap-3">
              <Tooltip content={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors duration-200"
                >
                  {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
                </button>
              </Tooltip>

              <div className="relative" ref={notificationRef}>
                <Tooltip content="Notifications">
                  <button
                    onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                    className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors duration-200"
                  >
                    <BellIcon className="w-5 h-5" />
                    {unreadNotifications > 0 && (
                      <Badge
                        variant="danger"
                        size="sm"
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
                  <ChevronDownIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 container-adaptive py-6">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
