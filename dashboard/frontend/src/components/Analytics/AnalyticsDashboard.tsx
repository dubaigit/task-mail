import { TaskStatus } from '../../types';

import React, { memo, useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Mail,
  CheckCircle,
  AlertCircle,
  Zap,
  Brain,
  Activity,
  PieChart,
  Users,
  Calendar,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
// "use client";

// TypeScript Interfaces
interface Task {
  id: string;
  title?: string;
  taskTitle?: string;
  subject?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in-progress' | TaskStatus.COMPLETED;
  aiConfidence?: number;
  confidence?: number;
  draftGenerated: boolean;
  sender: string;
  senderEmail: string;
  estimatedTime: string;
  tags: string[];
  relatedEmails: number;
  createdAt?: Date;
}

interface SyncStatus {
  emailsInPostgres: number;
  emailsInAppleMail: number;
  percentComplete: number;
  isSynced: boolean;
  emailBreakdown: {
    total: number;
    tasks: {
      count: number;
      percentage: number;
    };
    fyi: {
      count: number;
      percentage: number;
    };
    today?: number;
    week?: number;
    month?: number;
  };
  aiProcessing?: {
    totalProcessed: number;
    analyzed: number;
    completed: number;
    pending: number;
    failed: number;
    processingRate: number;
  };
  syncState: {
    isInitialSyncComplete: boolean;
    isSyncing: boolean;
  };
}

interface CategoryCounts {
  NEEDS_REPLY?: number;
  APPROVAL_REQUIRED?: number;
  DELEGATE?: number;
  FOLLOW_UP?: number;
  MEETING_REQUEST?: number;
  MEETING_CANCELLED?: number;
  FYI_ONLY?: number;
}

interface AnalyticsDashboardProps {
  tasks: Task[];
  syncStatus: SyncStatus | null;
  categoryCounts: CategoryCounts;
  className?: string;
}

// Utility Functions
const cn = (...classes: (string | undefined | boolean)[]) => {
  return classes.filter(Boolean).join(' ');
};

const formatNumber = (num: number | undefined): string => {
  if (num === undefined || num === null || isNaN(num)) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

const formatPercentage = (num: number | undefined): string => {
  if (num === undefined || num === null || isNaN(num)) return '0.0%';
  return `${num.toFixed(1)}%`;
};


// Analytics Dashboard Component
const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = memo(({
  tasks,
  syncStatus,
  categoryCounts,
  className
}) => {
  const [stats, setStats] = useState({
    efficiency: 0,
    totalTasks: 0,
    pendingTasks: 0,
    completedTasks: 0,
    averageResponseTime: 0,
    aiUsage: {
      totalProcessed: 0,
      analyzed: 0,
      pendingAnalysis: 0,
      processingRate: 0,
      totalCost: 0.0,
      avgCostPerEmail: 0.0
    }
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchRef = useRef<number>(0);
  const isComponentMountedRef = useRef<boolean>(true);

  // PERFORMANCE: Throttled fetch with exponential backoff
  const fetchDetailedStats = useCallback(async (forceRefresh = false) => {
    // THROTTLING: Prevent requests more frequent than 15 seconds
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchRef.current;
    const minInterval = 15000; // 15 seconds minimum
    
    if (!forceRefresh && timeSinceLastFetch < minInterval) {
      return;
    }
    
    if (!isComponentMountedRef.current) return;
    if (loading) return;
    
    try {
      setLoading(true);
      setError(null);
      lastFetchRef.current = now;
      
      // OPTIMIZED: Use cache headers and only fetch AI stats if needed
      const statsResponse = fetch('/api/statistics', {
        headers: {
          'Cache-Control': 'public, max-age=60'
        }
      });
      
      // DISABLE AI STATS FETCH - Let AIUsageMetrics handle this endpoint exclusively
      const aiResponse = Promise.resolve(null);
      
      const [statsRes] = await Promise.all([statsResponse, aiResponse]);
      
      if (!isComponentMountedRef.current) return;
      
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        const aiData: any = null;
        
        // aiRes is null by design (disabled AI fetch)
        // if (aiRes?.ok) {
        //   aiData = await aiRes.json();
        // }
        
        setStats(prev => ({
          ...prev,
          efficiency: statsData.efficiency || 0,
          totalTasks: statsData.totalTasks || tasks.length,
          averageResponseTime: statsData.averageResponseTime || 0,
          aiUsage: {
            totalProcessed: aiData?.daily?.total_processed || prev.aiUsage.totalProcessed || syncStatus?.aiProcessing?.totalProcessed || 0,
            analyzed: aiData?.daily?.analyzed || prev.aiUsage.analyzed || syncStatus?.aiProcessing?.analyzed || 0,
            pendingAnalysis: aiData?.unprocessed || prev.aiUsage.pendingAnalysis || syncStatus?.aiProcessing?.pending || 0,
            processingRate: aiData?.daily?.processing_rate || prev.aiUsage.processingRate || syncStatus?.aiProcessing?.processingRate || 0,
            totalCost: aiData?.daily?.total_cost || prev.aiUsage.totalCost || 0.0,
            avgCostPerEmail: aiData?.daily?.avg_cost_per_email || prev.aiUsage.avgCostPerEmail || 0.0
          }
        }));
        setRetryCount(0); // Reset retry count on success
      }
    } catch (error) {
      if (isComponentMountedRef.current) {
        setError('Failed to fetch analytics data');
        setRetryCount(prev => Math.min(prev + 1, 5)); // Max 5 retries
      }
    } finally {
      if (isComponentMountedRef.current) {
        setLoading(false);
      }
    }
  }, [loading, tasks?.length, syncStatus, stats.aiUsage.totalProcessed]);

  // Calculate derived metrics
  const safeTasks = tasks || [];
  const completedTasks = safeTasks.filter(task => task.status === TaskStatus.COMPLETED);
  const pendingTasks = safeTasks.filter(task => task.status === 'pending');
  const inProgressTasks = safeTasks.filter(task => task.status === 'in-progress');
  const urgentTasks = safeTasks.filter(task => task.priority === 'urgent');
  const highPriorityTasks = safeTasks.filter(task => task.priority === 'high');
  const tasksWithDrafts = safeTasks.filter(task => task.draftGenerated);

  const totalTaskCount = syncStatus?.emailBreakdown?.tasks?.count ?? tasks?.length ?? 0;
  const completionRate = totalTaskCount > 0 ? ((completedTasks?.length ?? 0) / totalTaskCount) * 100 : 0;
  const urgencyRate = totalTaskCount > 0 ? (((urgentTasks?.length ?? 0) + (highPriorityTasks?.length ?? 0)) / totalTaskCount) * 100 : 0;
  const draftGenerationRate = totalTaskCount > 0 ? ((tasksWithDrafts?.length ?? 0) / totalTaskCount) * 100 : 0;

  // PERFORMANCE: Smart loading and polling with cleanup
  useEffect(() => {
    isComponentMountedRef.current = true;
    
    // Initial fetch
    fetchDetailedStats(true);
    
    const scheduleNextFetch = () => {
      if (!isComponentMountedRef.current) return;
      
      // Clear any existing timeout
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      
      // SMART INTERVALS: Base interval of 5 minutes, increased on errors to reduce load
      const baseInterval = 300000; // 5 minutes base (further reduced to minimize API calls)
      const backoffMultiplier = Math.pow(2, retryCount); // 2^retryCount
      const maxInterval = 600000; // 10 minutes max
      const actualInterval = Math.min(baseInterval * backoffMultiplier, maxInterval);
      
      fetchTimeoutRef.current = setTimeout(() => {
        fetchDetailedStats();
        scheduleNextFetch();
      }, actualInterval);
    };
    
    // Start the polling cycle after initial fetch
    scheduleNextFetch();
    
    return () => {
      isComponentMountedRef.current = false;
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
      }
    };
  }, [fetchDetailedStats, retryCount]);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            Analytics Dashboard
          </h2>
          <p className="text-xs text-slate-400 mt-1">Real-time insights and performance metrics</p>
        </div>
        
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Activity className="w-3 h-3" />
          <span>Live</span>
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-400/30 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        </div>
      )}

      {/* Key Performance Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tasks */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Mail className="w-4 h-4 text-blue-400" />
            </div>
            <TrendingUp className="w-3 h-3 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">{formatNumber(totalTaskCount)}</div>
          <div className="text-xs text-slate-400">Total Tasks</div>
          <div className="flex items-center gap-1 mt-1 text-xs">
            <ArrowUpRight className="w-3 h-3 text-emerald-400" />
            <span className="text-emerald-400">+12%</span>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <TrendingUp className="w-3 h-3 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">{formatPercentage(completionRate)}</div>
          <div className="text-xs text-slate-400">Completion Rate</div>
          <div className="flex items-center gap-1 mt-1 text-xs">
            <ArrowUpRight className="w-3 h-3 text-emerald-400" />
            <span className="text-emerald-400">+3.2%</span>
          </div>
        </div>

        {/* Urgent Tasks */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-amber-400" />
            </div>
            {urgencyRate > 20 ? 
              <TrendingUp className="w-3 h-3 text-red-400" /> : 
              <TrendingDown className="w-3 h-3 text-emerald-400" />
            }
          </div>
          <div className="text-2xl font-bold text-white">{formatPercentage(urgencyRate)}</div>
          <div className="text-xs text-slate-400">High Priority</div>
          <div className="flex items-center gap-1 mt-1 text-xs">
            {urgencyRate > 20 ? (
              <>
                <ArrowUpRight className="w-3 h-3 text-red-400" />
                <span className="text-red-400">+5.1%</span>
              </>
            ) : (
              <>
                <ArrowDownRight className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">-2.3%</span>
              </>
            )}
          </div>
        </div>

        {/* AI Efficiency */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Brain className="w-4 h-4 text-purple-400" />
            </div>
            <TrendingUp className="w-3 h-3 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">{formatPercentage(draftGenerationRate)}</div>
          <div className="text-xs text-slate-400">AI Draft Rate</div>
          <div className="flex items-center gap-1 mt-1 text-xs">
            <ArrowUpRight className="w-3 h-3 text-emerald-400" />
            <span className="text-emerald-400">+18%</span>
          </div>
        </div>
      </div>

      {/* Task Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Status Distribution */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-slate-200 mb-4 flex items-center gap-2">
            <PieChart className="w-4 h-4" />
            Task Status Distribution
          </h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-amber-400 rounded-full"></div>
                <span className="text-sm text-slate-300">Pending</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-white">{pendingTasks.length + inProgressTasks.length}</div>
                <div className="text-xs text-slate-400">
                  {formatPercentage(((pendingTasks.length + inProgressTasks.length) / totalTaskCount) * 100)}
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-400 rounded-full"></div>
                <span className="text-sm text-slate-300">Completed</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-white">{completedTasks.length}</div>
                <div className="text-xs text-slate-400">{formatPercentage(completionRate)}</div>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                <span className="text-sm text-slate-300">With AI Drafts</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-white">{tasksWithDrafts.length}</div>
                <div className="text-xs text-slate-400">{formatPercentage(draftGenerationRate)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Processing Stats */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-slate-200 mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            AI Processing Insights
          </h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Total Processed (24h)</span>
              <span className="text-sm font-medium text-white">{formatNumber(stats.aiUsage.totalProcessed)}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Analyzed</span>
              <span className="text-sm font-medium text-white">{formatNumber(stats.aiUsage.analyzed)}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Pending Analysis</span>
              <span className="text-sm font-medium text-white">{formatNumber(stats.aiUsage.pendingAnalysis)}</span>
            </div>
            
            {stats.aiUsage.totalCost > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
                <span className="text-sm text-slate-300">Daily Cost</span>
                <span className="text-sm font-medium text-green-400">
                  ${stats.aiUsage.totalCost.toFixed(4)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Category Distribution */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-slate-200 mb-4 flex items-center gap-2">
          <Users className="w-4 h-4" />
          Task Categories
        </h3>
        
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex items-center justify-between p-2 bg-red-500/10 rounded border border-red-400/30">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-400 rounded-full"></div>
              <span className="text-xs text-red-200">Needs Reply</span>
            </div>
            <span className="text-xs font-medium text-red-300">{categoryCounts.NEEDS_REPLY || 0}</span>
          </div>
          
          <div className="flex items-center justify-between p-2 bg-purple-500/10 rounded border border-purple-400/30">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
              <span className="text-xs text-purple-200">Approval</span>
            </div>
            <span className="text-xs font-medium text-purple-300">{categoryCounts.APPROVAL_REQUIRED || 0}</span>
          </div>
          
          <div className="flex items-center justify-between p-2 bg-indigo-500/10 rounded border border-indigo-400/30">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-indigo-400 rounded-full"></div>
              <span className="text-xs text-indigo-200">Delegate</span>
            </div>
            <span className="text-xs font-medium text-indigo-300">{categoryCounts.DELEGATE || 0}</span>
          </div>
          
          <div className="flex items-center justify-between p-2 bg-teal-500/10 rounded border border-teal-400/30">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-teal-400 rounded-full"></div>
              <span className="text-xs text-teal-200">Follow Up</span>
            </div>
            <span className="text-xs font-medium text-teal-300">{categoryCounts.FOLLOW_UP || 0}</span>
          </div>
          
          <div className="flex items-center justify-between p-2 bg-cyan-500/10 rounded border border-cyan-400/30">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
              <span className="text-xs text-cyan-200">Meetings</span>
            </div>
            <span className="text-xs font-medium text-cyan-300">
              {(categoryCounts.MEETING_REQUEST || 0) + (categoryCounts.MEETING_CANCELLED || 0)}
            </span>
          </div>
          
          <div className="flex items-center justify-between p-2 bg-emerald-500/10 rounded border border-emerald-400/30">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
              <span className="text-xs text-emerald-200">FYI Only</span>
            </div>
            <span className="text-xs font-medium text-emerald-300">
              {syncStatus?.emailBreakdown?.fyi?.count || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Email Sync Health */}
      {syncStatus && (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-slate-200 mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Email Sync Health
          </h3>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-500/10 rounded border border-blue-400/30">
              <div className="text-lg font-bold text-blue-300">{formatNumber(syncStatus?.emailsInPostgres)}</div>
              <div className="text-xs text-blue-200/70">In Database</div>
            </div>
            
            <div className="text-center p-3 bg-emerald-500/10 rounded border border-emerald-400/30">
              <div className="text-lg font-bold text-emerald-300">{formatNumber(syncStatus?.emailBreakdown?.total)}</div>
              <div className="text-xs text-emerald-200/70">Total Emails</div>
            </div>
            
            <div className="text-center p-3 bg-purple-500/10 rounded border border-purple-400/30">
              <div className="text-lg font-bold text-purple-300">{formatPercentage(syncStatus?.percentComplete)}</div>
              <div className="text-xs text-purple-200/70">Sync Complete</div>
            </div>
            
            <div className="text-center p-3 bg-amber-500/10 rounded border border-amber-400/30">
              <div className="text-lg font-bold text-amber-300">
                {syncStatus?.syncState?.isSyncing ? 'Active' : 'Idle'}
              </div>
              <div className="text-xs text-amber-200/70">Sync Status</div>
            </div>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-xs text-slate-400">Refreshing analytics...</span>
        </div>
      )}
    </div>
  );
});

AnalyticsDashboard.displayName = 'AnalyticsDashboard';

export default AnalyticsDashboard;
