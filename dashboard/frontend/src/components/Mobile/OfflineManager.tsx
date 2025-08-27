import React, { useState, useEffect, useCallback, useContext, createContext } from 'react';
import { Icons } from '../ui/icons';
import {
  AlertTriangle as ExclamationTriangleIcon,
  CheckCircle as CheckCircleIcon,
  CloudUpload as CloudArrowUpIcon
} from 'lucide-react';

interface OfflineData {
  tasks: any[];
  emails: any[];
  drafts: any[];
  lastSync: Date;
  pendingActions: PendingAction[];
}

interface PendingAction {
  id: string;
  type: 'task_complete' | 'task_create' | 'task_update' | 'email_archive' | 'email_delete' | 'draft_save';
  payload: any;
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
}

interface OfflineContextType {
  isOnline: boolean;
  isOfflineMode: boolean;
  enableOfflineMode: () => void;
  disableOfflineMode: () => void;
  syncWhenOnline: () => Promise<void>;
  addPendingAction: (action: Omit<PendingAction, 'id' | 'timestamp' | 'retryCount'>) => void;
  getOfflineData: () => OfflineData | null;
  updateOfflineData: (data: Partial<OfflineData>) => void;
  pendingActionsCount: number;
  lastSyncTime: Date | null;
  syncInProgress: boolean;
}

interface OfflineManagerProps {
  children: React.ReactNode;
  onSync?: (pendingActions: PendingAction[]) => Promise<void>;
  syncInterval?: number; // minutes
  maxRetries?: number;
}

// Create offline context
const OfflineContext = createContext<OfflineContextType | null>(null);

// Custom hook to use offline context
export const useOffline = (): OfflineContextType => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineManager');
  }
  return context;
};

// Storage keys
const STORAGE_KEYS = {
  offlineData: 'email_app_offline_data',
  pendingActions: 'email_app_pending_actions',
  offlineMode: 'email_app_offline_mode_enabled',
  lastSync: 'email_app_last_sync'
};

const OfflineManager: React.FC<OfflineManagerProps> = ({
  children,
  onSync,
  syncInterval = 5, // 5 minutes default
  maxRetries = 3
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [showOfflineIndicator, setShowOfflineIndicator] = useState(false);

  // Initialize offline manager
  useEffect(() => {
    // Load offline mode preference
    const offlineModeEnabled = localStorage.getItem(STORAGE_KEYS.offlineMode) === 'true';
    setIsOfflineMode(offlineModeEnabled);

    // Load pending actions
    const storedActions = localStorage.getItem(STORAGE_KEYS.pendingActions);
    if (storedActions) {
      try {
        const actions = JSON.parse(storedActions).map((action: any) => ({
          ...action,
          timestamp: new Date(action.timestamp)
        }));
        setPendingActions(actions);
      } catch (error) {
        localStorage.removeItem(STORAGE_KEYS.pendingActions);
      }
    }

    // Load last sync time
    const lastSync = localStorage.getItem(STORAGE_KEYS.lastSync);
    if (lastSync) {
      setLastSyncTime(new Date(lastSync));
    }
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineIndicator(false);
      // Auto-sync when coming back online if offline mode is enabled
      if (isOfflineMode && pendingActions.length > 0) {
        syncWhenOnline();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineIndicator(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOfflineMode, pendingActions.length]);

  // Auto-sync interval
  useEffect(() => {
    if (!isOfflineMode || !isOnline || pendingActions.length === 0) return;

    const interval = setInterval(() => {
      syncWhenOnline();
    }, syncInterval * 60 * 1000);

    return () => clearInterval(interval);
  }, [isOfflineMode, isOnline, pendingActions.length, syncInterval]);

  // Save pending actions to storage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.pendingActions, JSON.stringify(pendingActions));
  }, [pendingActions]);

  // Enable offline mode
  const enableOfflineMode = useCallback(() => {
    setIsOfflineMode(true);
    localStorage.setItem(STORAGE_KEYS.offlineMode, 'true');
  }, []);

  // Disable offline mode
  const disableOfflineMode = useCallback(() => {
    setIsOfflineMode(false);
    localStorage.setItem(STORAGE_KEYS.offlineMode, 'false');
    // Clear offline data when disabling
    localStorage.removeItem(STORAGE_KEYS.offlineData);
    localStorage.removeItem(STORAGE_KEYS.pendingActions);
    setPendingActions([]);
  }, []);

  // Add pending action
  const addPendingAction = useCallback((action: Omit<PendingAction, 'id' | 'timestamp' | 'retryCount'>) => {
    if (!isOfflineMode) return;

    const newAction: PendingAction = {
      ...action,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: action.maxRetries || maxRetries
    };

    setPendingActions(prev => [...prev, newAction]);
  }, [isOfflineMode, maxRetries]);

  // Sync pending actions when online
  const syncWhenOnline = useCallback(async () => {
    if (!isOnline || syncInProgress || pendingActions.length === 0 || !onSync) return;

    setSyncInProgress(true);
    
    try {
      // Sort actions by timestamp to maintain order
      const sortedActions = [...pendingActions].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      await onSync(sortedActions);
      
      // Clear successful actions
      setPendingActions([]);
      setLastSyncTime(new Date());
      localStorage.setItem(STORAGE_KEYS.lastSync, new Date().toISOString());
      
      // Show success notification
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
    } catch (error) {
      // Increment retry count for failed actions
      setPendingActions(prev => prev.map(action => {
        if (action.retryCount < action.maxRetries) {
          return { ...action, retryCount: action.retryCount + 1 };
        }
        return action;
      }).filter(action => action.retryCount < action.maxRetries));
      
      // Show error notification
      if ('vibrate' in navigator) {
        navigator.vibrate(200);
      }
    } finally {
      setSyncInProgress(false);
    }
  }, [isOnline, syncInProgress, pendingActions, onSync]);

  // Get offline data
  const getOfflineData = useCallback((): OfflineData | null => {
    const data = localStorage.getItem(STORAGE_KEYS.offlineData);
    if (!data) return null;

    try {
      const parsed = JSON.parse(data);
      return {
        ...parsed,
        lastSync: new Date(parsed.lastSync)
      };
    } catch (error) {
      return null;
    }
  }, []);

  // Update offline data
  const updateOfflineData = useCallback((data: Partial<OfflineData>) => {
    if (!isOfflineMode) return;

    const existingData = getOfflineData();
    const updatedData = {
      ...existingData,
      ...data,
      lastSync: new Date()
    };

    localStorage.setItem(STORAGE_KEYS.offlineData, JSON.stringify(updatedData));
  }, [isOfflineMode, getOfflineData]);

  // Context value
  const contextValue: OfflineContextType = {
    isOnline,
    isOfflineMode,
    enableOfflineMode,
    disableOfflineMode,
    syncWhenOnline,
    addPendingAction,
    getOfflineData,
    updateOfflineData,
    pendingActionsCount: pendingActions.length,
    lastSyncTime,
    syncInProgress
  };

  return (
    <OfflineContext.Provider value={contextValue}>
      {children}
      
      {/* Offline Indicator */}
      {(showOfflineIndicator || (!isOnline && isOfflineMode)) && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-orange-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 slide-in-down">
            <ExclamationTriangleIcon className="w-4 h-4" />
            <span className="text-sm font-medium">
              {isOfflineMode ? 'Offline Mode' : 'Connection Lost'}
            </span>
          </div>
        </div>
      )}

      {/* Sync Status */}
      {pendingActions.length > 0 && (
        <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-blue-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            {syncInProgress ? (
              <>
                <CloudArrowUpIcon className="w-4 h-4 animate-pulse" />
                <span className="text-sm font-medium">Syncing...</span>
              </>
            ) : (
              <>
                <Icons.clock className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {pendingActions.length} pending {pendingActions.length === 1 ? 'action' : 'actions'}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Sync Success */}
      {lastSyncTime && isOnline && pendingActions.length === 0 && (
        <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-50 opacity-0 animate-fade-in">
          <div className="bg-green-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            <CheckCircleIcon className="w-4 h-4" />
            <span className="text-sm font-medium">Synced</span>
          </div>
        </div>
      )}
    </OfflineContext.Provider>
  );
};

// Offline Settings Component
interface OfflineSettingsProps {
  className?: string;
}

export const OfflineSettings: React.FC<OfflineSettingsProps> = ({ className = '' }) => {
  const {
    isOnline,
    isOfflineMode,
    enableOfflineMode,
    disableOfflineMode,
    syncWhenOnline,
    pendingActionsCount,
    lastSyncTime,
    syncInProgress
  } = useOffline();

  const formatLastSync = (date: Date | null): string => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <h3 className="text-lg font-semibold text-foreground">Offline Mode</h3>
      
      {/* Online Status */}
      <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg">
        <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-sm font-medium text-foreground">
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* Offline Mode Toggle */}
      <div className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
        <div>
          <div className="text-sm font-medium text-foreground">Enable Offline Mode</div>
          <div className="text-xs text-muted-foreground">
            Work offline and sync when connection is restored
          </div>
        </div>
        <button
          onClick={isOfflineMode ? disableOfflineMode : enableOfflineMode}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
            isOfflineMode ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-600'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              isOfflineMode ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Sync Status */}
      {isOfflineMode && (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
            <div>
              <div className="text-sm font-medium text-foreground">Pending Actions</div>
              <div className="text-xs text-muted-foreground">
                Actions waiting to sync
              </div>
            </div>
            <span className="text-sm font-semibold text-foreground">
              {pendingActionsCount}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
            <div>
              <div className="text-sm font-medium text-foreground">Last Sync</div>
              <div className="text-xs text-muted-foreground">
                {formatLastSync(lastSyncTime)}
              </div>
            </div>
            <button
              onClick={syncWhenOnline}
              disabled={!isOnline || syncInProgress || pendingActionsCount === 0}
              className="px-3 py-1 text-xs font-medium text-primary-foreground bg-primary rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncInProgress ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfflineManager;
