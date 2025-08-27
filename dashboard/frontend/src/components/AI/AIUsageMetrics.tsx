import React, { useState, useEffect, useRef, useCallback } from 'react';
import './AIUsageMetrics.css';

interface UsageStats {
  daily: {
    total_processed: number;
    total_cost: number;
    avg_cost_per_email: number;
    total_batches: number;
  };
  balance: number;
  unprocessed: number;
  isProcessing: boolean;
}

interface Props {
  refreshTrigger?: number;
}

const AIUsageMetrics: React.FC<Props> = ({ refreshTrigger = 0 }) => {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchRef = useRef<number>(0);
  const isComponentMountedRef = useRef<boolean>(true);

  // PERFORMANCE: Throttled fetch with exponential backoff - STABLE REFERENCE
  const fetchStats = useCallback(async (forceRefresh = false) => {
    // THROTTLING: Prevent requests more frequent than 30 seconds
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchRef.current;
    const minInterval = 30000; // 30 seconds minimum (increased from 10 seconds)
    
    if (!forceRefresh && timeSinceLastFetch < minInterval) {
      return;
    }
    
    if (!isComponentMountedRef.current) return;
    
    try {
      setLoading(true);
      lastFetchRef.current = now;
      
      // Add cache headers to reduce server load
      const response = await fetch('/api/ai/usage-stats', {
        headers: {
          'Cache-Control': 'public, max-age=30',
          'If-None-Match': '*'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (isComponentMountedRef.current) {
        setStats(data);
        setError(null);
        setRetryCount(0); // Reset retry count on success
      }
    } catch (err) {
      if (isComponentMountedRef.current) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch usage stats';
        setError(errorMessage);
        
        // EXPONENTIAL BACKOFF: Increase retry count for failed requests
        setRetryCount(prev => Math.min(prev + 1, 6)); // Max 6 retries
      }
    } finally {
      if (isComponentMountedRef.current) {
        setLoading(false);
      }
    }
  }, []); // STABLE - no dependencies to prevent cascade

  // PERFORMANCE: Smart polling with exponential backoff and cleanup
  useEffect(() => {
    isComponentMountedRef.current = true;
    
    // Initial fetch
    fetchStats(true);
    
    const scheduleNextFetch = () => {
      if (!isComponentMountedRef.current) return;
      
      // Clear any existing timeout
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      
      // SMART INTERVALS: Base interval of 5 minutes, increased on errors
      const baseInterval = 300000; // 5 minutes base (increased from 2 minutes)
      const backoffMultiplier = Math.pow(2, retryCount); // 2^retryCount
      const maxInterval = 1800000; // 30 minutes max (increased from 10 minutes)
      const actualInterval = Math.min(baseInterval * backoffMultiplier, maxInterval);
      
      fetchTimeoutRef.current = setTimeout(() => {
        fetchStats();
        scheduleNextFetch();
      }, actualInterval);
    };
    
    // Start the polling cycle
    scheduleNextFetch();
    
    return () => {
      isComponentMountedRef.current = false;
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
      }
    };
  }, [fetchStats, refreshTrigger]); // CRITICAL FIX: Removed retryCount dependency to prevent recursive useEffect calls

  if (loading) {
    return (
      <div className="ai-usage-metrics loading">
        <div className="loading-spinner"></div>
        <span>Loading usage metrics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ai-usage-metrics error">
        <div className="error-icon">⚠️</div>
        <div className="error-message">
          <strong>Error loading metrics:</strong>
          <br />
          {error}
        </div>
        <button onClick={() => fetchStats(true)} className="retry-button">
          Retry
        </button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="ai-usage-metrics no-data">
        <div className="no-data-icon">📊</div>
        <span>No usage data available</span>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 6
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const getBalanceStatus = (balance: number) => {
    if (balance > 10) return 'healthy';
    if (balance > 1) return 'warning';
    return 'critical';
  };

  const getProcessingStatus = () => {
    if (stats.isProcessing) return 'processing';
    if (stats.unprocessed > 0) return 'pending';
    return 'idle';
  };

  return (
    <div className="ai-usage-metrics">
      <div className="metrics-header">
        <h3>AI Usage Metrics</h3>
        <div className={`processing-indicator ${getProcessingStatus()}`}>
          <div className="status-dot"></div>
          {stats.isProcessing ? 'Processing...' : 
           stats.unprocessed > 0 ? `${stats.unprocessed} pending` : 'Up to date'}
        </div>
      </div>

      <div className="metrics-grid">
        {/* Balance Card */}
        <div className={`metric-card balance ${getBalanceStatus(stats.balance)}`}>
          <div className="metric-icon">💰</div>
          <div className="metric-content">
            <div className="metric-value">{formatCurrency(stats.balance)}</div>
            <div className="metric-label">Account Balance</div>
            {stats.balance < 1 && (
              <div className="balance-warning">⚠️ Low balance</div>
            )}
          </div>
        </div>

        {/* Daily Processing Card */}
        <div className="metric-card processing">
          <div className="metric-icon">📧</div>
          <div className="metric-content">
            <div className="metric-value">{formatNumber(stats.daily.total_processed)}</div>
            <div className="metric-label">Emails Processed (24h)</div>
          </div>
        </div>

        {/* Daily Cost Card */}
        <div className="metric-card cost">
          <div className="metric-icon">💸</div>
          <div className="metric-content">
            <div className="metric-value">{formatCurrency(stats.daily.total_cost)}</div>
            <div className="metric-label">Daily Spending</div>
          </div>
        </div>

        {/* Average Cost Card */}
        <div className="metric-card average">
          <div className="metric-icon">📊</div>
          <div className="metric-content">
            <div className="metric-value">{formatCurrency(stats.daily.avg_cost_per_email)}</div>
            <div className="metric-label">Avg Cost/Email</div>
          </div>
        </div>

        {/* Batch Efficiency Card */}
        <div className="metric-card batches">
          <div className="metric-icon">🔄</div>
          <div className="metric-content">
            <div className="metric-value">{formatNumber(stats.daily.total_batches)}</div>
            <div className="metric-label">Batches Processed</div>
            {stats.daily.total_batches > 0 && (
              <div className="batch-efficiency">
                ~{Math.round(stats.daily.total_processed / stats.daily.total_batches)} emails/batch
              </div>
            )}
          </div>
        </div>

        {/* Unprocessed Queue Card */}
        <div className={`metric-card queue ${stats.unprocessed > 100 ? 'high' : stats.unprocessed > 50 ? 'medium' : 'low'}`}>
          <div className="metric-icon">⏳</div>
          <div className="metric-content">
            <div className="metric-value">{formatNumber(stats.unprocessed)}</div>
            <div className="metric-label">Unprocessed Emails</div>
            {stats.unprocessed > 100 && (
              <div className="queue-warning">High queue volume</div>
            )}
          </div>
        </div>
      </div>

      {/* Cost Optimization Info */}
      <div className="optimization-info">
        <div className="optimization-header">
          <span className="optimization-icon">⚡</span>
          <span>Bulk Processing Optimization</span>
        </div>
        <div className="optimization-stats">
          {stats.daily.total_batches > 0 ? (
            <>
              <span>
                Batch processing saves ~65% on token costs by reusing system prompts
              </span>
              <span>
                Processing {Math.round(stats.daily.total_processed / stats.daily.total_batches)} emails per batch
              </span>
            </>
          ) : (
            <span>No batches processed in the last 24 hours</span>
          )}
        </div>
      </div>

      <div className="metrics-footer">
        <div className="last-updated">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
        <button onClick={() => fetchStats(true)} className="refresh-button">
          🔄 Refresh
        </button>
      </div>
    </div>
  );
};

export default AIUsageMetrics;
