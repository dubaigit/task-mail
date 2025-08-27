import * as React from "react";
import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { 
   
  Inbox, 
  CheckSquare, 
  FileText, 
  BarChart3, 
  Bell, 
  Search, 
  Menu, 
  X, 
  ChevronLeft, 
  ChevronRight,
  
  
  
  Plus
} from "lucide-react";

interface NavigationItem {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: string;
}

const navigationItems: NavigationItem[] = [
  { id: "inbox", name: "Inbox", icon: Inbox, href: "/inbox", badge: "12" },
  { id: "tasks", name: "Tasks", icon: CheckSquare, href: "/tasks", badge: "5" },
  { id: "drafts", name: "Drafts", icon: FileText, href: "/drafts", badge: "3" },
  { id: "analytics", name: "Analytics", icon: BarChart3, href: "/analytics" },
];

const DashboardLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Get active item from current path
  const getActiveItem = () => {
    const path = location.pathname;
    if (path === '/' || path === '/inbox') return 'inbox';
    return path.substring(1); // Remove leading slash
  };

  const activeItem = getActiveItem();

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const toggleCollapse = () => setIsSidebarCollapsed(!isSidebarCollapsed);

  const handleItemClick = (item: NavigationItem) => {
    navigate(item.href);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile hamburger button */}
      <button
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-white shadow-md border md:hidden hover:bg-gray-50 transition-all duration-200"
        aria-label="Toggle sidebar"
      >
        {isSidebarOpen ? 
          <X className="h-5 w-5 text-gray-700" /> : 
          <Menu className="h-5 w-5 text-gray-700" />
        }
      </button>

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden transition-opacity duration-300" 
          onClick={toggleSidebar} 
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed top-0 left-0 h-full bg-white border-r border-gray-200 z-40 transition-all duration-300 ease-in-out flex flex-col
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
          ${isSidebarCollapsed ? "w-20" : "w-72"}
          md:translate-x-0 md:static md:z-auto
        `}
      >
        {/* Header with logo and collapse button */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50/50">
          {!isSidebarCollapsed && (
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">E</span>
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-gray-900 text-sm">Email Intelligence</span>
                <span className="text-xs text-gray-500">Dashboard</span>
              </div>
            </div>
          )}

          {isSidebarCollapsed && (
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mx-auto">
              <span className="text-white font-bold text-sm">E</span>
            </div>
          )}

          <button
            onClick={toggleCollapse}
            className="hidden md:flex p-1.5 rounded-md hover:bg-gray-100 transition-all duration-200"
            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronLeft className="h-4 w-4 text-gray-400" />
            )}
          </button>
        </div>

        {/* Search Bar */}
        {!isSidebarCollapsed && (
          <div className="px-3 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto">
          <ul className="space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeItem === item.id;

              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleItemClick(item)}
                    className={`
                      w-full flex items-center space-x-3 px-3 py-2.5 rounded-md text-left transition-all duration-200 group relative
                      ${isActive
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }
                      ${isSidebarCollapsed ? "justify-center px-2" : ""}
                    `}
                    title={isSidebarCollapsed ? item.name : undefined}
                  >
                    <div className="flex items-center justify-center min-w-[20px]">
                      <Icon
                        className={`
                          h-5 w-5 flex-shrink-0
                          ${isActive 
                            ? "text-blue-600" 
                            : "text-gray-400 group-hover:text-gray-600"
                          }
                        `}
                      />
                    </div>
                    
                    {!isSidebarCollapsed && (
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-sm ${isActive ? "font-medium" : "font-normal"}`}>
                          {item.name}
                        </span>
                        {item.badge && (
                          <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}

                    {isSidebarCollapsed && item.badge && (
                      <div className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center rounded-full bg-blue-600 text-white border border-white">
                        <span className="text-[10px] font-medium">
                          {parseInt(item.badge) > 9 ? '9+' : item.badge}
                        </span>
                      </div>
                    )}

                    {isSidebarCollapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                        {item.name}
                        {item.badge && (
                          <span className="ml-1.5 px-1 py-0.5 bg-gray-700 rounded-full text-[10px]">
                            {item.badge}
                          </span>
                        )}
                        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-1.5 h-1.5 bg-gray-900 rotate-45" />
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Profile Section */}
        <div className="mt-auto border-t border-gray-200 p-3">
          {!isSidebarCollapsed ? (
            <div className="flex items-center space-x-3 px-3 py-2 rounded-md bg-gray-50">
              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-medium text-sm">JD</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">John Doe</p>
                <p className="text-xs text-gray-500 truncate">john@company.com</p>
              </div>
              <div className="w-2 h-2 bg-green-500 rounded-full" title="Online" />
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="relative">
                <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-medium text-sm">JD</span>
                </div>
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-semibold text-gray-900 capitalize">
              {activeItem}
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <button className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>New</span>
            </button>
            
            <button className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center">
                3
              </span>
            </button>

            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-medium text-sm">JD</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto bg-gray-50 p-6">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;