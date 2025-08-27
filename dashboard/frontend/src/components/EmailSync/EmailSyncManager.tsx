import { TaskStatus, TaskPriority, TaskCategory } from '../../types';
import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Play, Pause, Square, AlertCircle, CheckCircle, Clock, Database } from 'lucide-react';
import api, { endpoints } from '../../services/api';
import './EmailSyncManager.css';

// Types for sync operations
interface SyncOperation {
  operation_id: string;
  sync_type: string;
  status: string;
  progress: {
    total: number;
    processed: number;
    failed: number;
    percentage: number;
  };
  start_time: string | null;
  end_time: string | null;
  error_message: string | null;
  retry_count: number;
}

interface SyncStatistics {
  email_statistics: {
    total_emails: number;
    unread_emails: number;
    flagged_emails: number;
    today_emails: number;
    week_emails: number;
  };
  sync_statistics: {
    completed_operations: number;
    failed_operations: number;
    running_operations: number;
    total_operations: number;
    last_auto_sync: string | null;
  };
  service_status: {
    is_running: boolean;
    websocket_clients: number;
    queued_operations: number;
  };
}

interface EmailSyncManagerProps {
  className?: string;
}

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const EmailSyncManager: React.FC<EmailSyncManagerProps> = ({ className }) => {
  const [operations, setOperations] = useState<SyncOperation[]>([]);
  const [statistics, setStatistics] = useState<SyncStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSyncType, setSelectedSyncType] = useState<'full' | 'incremental' | 'selective'>('incremental');
  const [hoursBack, setHoursBack] = useState(24);
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);

  // Fetch operations and statistics
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [operationsResponse, statisticsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/sync/operations`),
        fetch(`${API_BASE_URL}/api/sync/statistics`)
      ]);

      if (operationsResponse.ok) {
        const operationsData = await operationsResponse.json();
        setOperations(operationsData);
      }

      if (statisticsResponse.ok) {
        const statisticsData = await statisticsResponse.json();
        setStatistics(statisticsData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Setup WebSocket for real-time updates
  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8000/ws/sync-updates`);
    
    ws.onopen = () => {
      setWebsocket(ws);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'sync_status') {
          const updatedOperation = message.data;
          setOperations(prev => 
            prev.map(op => 
              op.operation_id === updatedOperation.operation_id 
                ? { ...op, ...updatedOperation }
                : op
            )
          );
          // Refresh statistics when operations update
          fetchData();
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      setWebsocket(null);
    };

    ws.onerror = (error) => {
      console.error('📡 WebSocket error:', error);
    };

    return () => {
      ws.close();
    };
  }, [fetchData]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Schedule sync operation
  const scheduleSync = async () => {
    try {
      setLoading(true);
      setError(null);

      const request = {
        sync_type: selectedSyncType,
        mailbox: 'INBOX',
        hours_back: hoursBack
      };

      const response = await fetch(`${API_BASE_URL}/api/sync/operations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Failed to schedule sync: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Refresh data to show new operation
      setTimeout(fetchData, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule sync');
    } finally {
      setLoading(false);
    }
  };

  // Control operation (cancel, pause, resume)
  const controlOperation = async (operationId: string, action: 'cancel' | 'pause' | 'resume') => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/sync/operations/${operationId}/${action}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} operation`);
      }

      const result = await response.json();
      
      // Refresh data
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} operation`);
    }
  };

  // Get status icon and color
  const getStatusIndicator = (status: string) => {
    switch (status) {
      case TaskStatus.COMPLETED:
        return { icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100' };
      case 'running':
        return { icon: RefreshCw, color: 'text-blue-600', bgColor: 'bg-blue-100' };
      case 'failed':
        return { icon: AlertCircle, color: 'text-red-600', bgColor: 'bg-red-100' };
      case 'paused':
        return { icon: Pause, color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
      case 'cancelled':
        return { icon: Square, color: 'text-gray-600', bgColor: 'bg-gray-100' };
      default:
        return { icon: Clock, color: 'text-gray-600', bgColor: 'bg-gray-100' };
    }
  };

  // Format time
  const formatTime = (timeString: string | null) => {
    if (!timeString) return 'N/A';
    return new Date(timeString).toLocaleString();
  };

  // Format duration
  const formatDuration = (startTime: string | null, endTime: string | null) => {
    if (!startTime) return 'N/A';
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const durationMs = end.getTime() - start.getTime();
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  return (
    <div className={`email-sync-manager ${className || ''}`}>
      <div className="sync-header">
        <div className="header-title">
          <Database className="header-icon" />
          <h2>Email Synchronization</h2>
          <div className={`sync-status ${websocket ? 'connected' : 'disconnected'}`}>
            <div className="status-indicator"></div>
            {websocket ? 'Connected' : 'Disconnected'}
          </div>
        </div>
        
        <button 
          className="refresh-button"
          onClick={fetchData}
          disabled={loading}
        >
          <RefreshCw className={`refresh-icon ${loading ? 'spinning' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="error-message">
          <AlertCircle className="error-icon" />
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Statistics Section */}
      {statistics && (
        <div className="statistics-grid">
          <div className="stat-card">
            <h3>Email Statistics</h3>
            <div className="stat-items">
              <div className="stat-item">
                <span className="stat-label">Total Emails:</span>
                <span className="stat-value">{statistics.email_statistics.total_emails.toLocaleString()}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Unread:</span>
                <span className="stat-value">{statistics.email_statistics.unread_emails.toLocaleString()}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Today:</span>
                <span className="stat-value">{statistics.email_statistics.today_emails.toLocaleString()}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">This Week:</span>
                <span className="stat-value">{statistics.email_statistics.week_emails.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <h3>Sync Statistics</h3>
            <div className="stat-items">
              <div className="stat-item">
                <span className="stat-label">Completed:</span>
                <span className="stat-value text-green-600">{statistics.sync_statistics.completed_operations}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Failed:</span>
                <span className="stat-value text-red-600">{statistics.sync_statistics.failed_operations}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Running:</span>
                <span className="stat-value text-blue-600">{statistics.sync_statistics.running_operations}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Service Status:</span>
                <span className={`stat-value ${statistics.service_status.is_running ? 'text-green-600' : 'text-red-600'}`}>
                  {statistics.service_status.is_running ? 'Running' : 'Stopped'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sync Controls */}
      <div className="sync-controls">
        <h3>Schedule New Sync</h3>
        <div className="controls-grid">
          <div className="control-group">
            <label htmlFor="sync-type">Sync Type:</label>
            <select 
              id="sync-type"
              value={selectedSyncType}
              onChange={(e) => setSelectedSyncType(e.target.value as any)}
            >
              <option value="incremental">Incremental (Recent emails)</option>
              <option value="full">Full (All emails)</option>
              <option value="selective">Selective (Custom criteria)</option>
            </select>
          </div>

          {selectedSyncType === 'incremental' && (
            <div className="control-group">
              <label htmlFor="hours-back">Hours Back:</label>
              <input
                id="hours-back"
                type="number"
                min="1"
                max="168"
                value={hoursBack}
                onChange={(e) => setHoursBack(parseInt(e.target.value))}
              />
            </div>
          )}

          <button 
            className="sync-button"
            onClick={scheduleSync}
            disabled={loading}
          >
            <Play className="button-icon" />
            Start Sync
          </button>
        </div>
      </div>

      {/* Operations List */}
      <div className="operations-section">
        <h3>Sync Operations</h3>
        {operations.length === 0 ? (
          <div className="no-operations">
            <Clock className="no-ops-icon" />
            <p>No sync operations found</p>
          </div>
        ) : (
          <div className="operations-list">
            {operations.map((operation) => {
              const statusInfo = getStatusIndicator(operation.status);
              const StatusIcon = statusInfo.icon;
              
              return (
                <div key={operation.operation_id} className="operation-card">
                  <div className="operation-header">
                    <div className="operation-info">
                      <div className={`status-badge ${statusInfo.bgColor}`}>
                        <StatusIcon className={`status-icon ${statusInfo.color}`} />
                        <span className={statusInfo.color}>{operation.status.toUpperCase()}</span>
                      </div>
                      <div className="operation-details">
                        <span className="operation-id">{operation.operation_id}</span>
                        <span className="operation-type">{operation.sync_type.toUpperCase()} SYNC</span>
                      </div>
                    </div>
                    
                    <div className="operation-controls">
                      {operation.status === 'running' && (
                        <button 
                          className="control-btn pause-btn"
                          onClick={() => controlOperation(operation.operation_id, 'pause')}
                        >
                          <Pause className="control-icon" />
                        </button>
                      )}
                      {operation.status === 'paused' && (
                        <button 
                          className="control-btn resume-btn"
                          onClick={() => controlOperation(operation.operation_id, 'resume')}
                        >
                          <Play className="control-icon" />
                        </button>
                      )}
                      {['running', 'paused', 'pending'].includes(operation.status) && (
                        <button 
                          className="control-btn cancel-btn"
                          onClick={() => controlOperation(operation.operation_id, 'cancel')}
                        >
                          <Square className="control-icon" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {operation.progress.total > 0 && (
                    <div className="progress-section">
                      <div className="progress-bar">
                        <div 
                          className="progress-fill"
                          style={{ width: `${operation.progress.percentage}%` }}
                        ></div>
                      </div>
                      <div className="progress-text">
                        {operation.progress.processed} / {operation.progress.total} emails 
                        ({operation.progress.percentage.toFixed(1)}%)
                        {operation.progress.failed > 0 && (
                          <span className="failed-count"> • {operation.progress.failed} failed</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Operation Metadata */}
                  <div className="operation-metadata">
                    <div className="metadata-row">
                      <span className="metadata-label">Started:</span>
                      <span className="metadata-value">{formatTime(operation.start_time)}</span>
                    </div>
                    {operation.end_time && (
                      <div className="metadata-row">
                        <span className="metadata-label">Completed:</span>
                        <span className="metadata-value">{formatTime(operation.end_time)}</span>
                      </div>
                    )}
                    <div className="metadata-row">
                      <span className="metadata-label">Duration:</span>
                      <span className="metadata-value">
                        {formatDuration(operation.start_time, operation.end_time)}
                      </span>
                    </div>
                    {operation.retry_count > 0 && (
                      <div className="metadata-row">
                        <span className="metadata-label">Retries:</span>
                        <span className="metadata-value">{operation.retry_count}</span>
                      </div>
                    )}
                  </div>

                  {/* Error Message */}
                  {operation.error_message && (
                    <div className="error-section">
                      <AlertCircle className="error-icon" />
                      <span className="error-text">{operation.error_message}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailSyncManager;
