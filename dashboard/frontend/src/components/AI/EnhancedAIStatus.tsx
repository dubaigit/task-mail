import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  AlertTriangle, 
  Activity,
  Server,
  Eye,
  Play,
  MessageSquare
} from 'lucide-react';

interface AIModel {
  name: string;
  type: 'nano' | 'mini' | 'standard';
  status: 'active' | 'inactive' | 'error';
  tokensUsed: number;
  requestCount: number;
  avgResponseTime: number;
}

interface AIProcessingMetrics {
  pending: number;
  analyzed: number;
  failed: number;
  failureReasons: { reason: string; count: number; lastOccurred: string }[];
  processing: boolean;
  currentBatch: number;
  totalBatches: number;
}

interface AIConnectivityStatus {
  connected: boolean;
  lastHealthCheck: string;
  responseTime: number;
  apiQuotaRemaining: number;
  apiQuotaLimit: number;
  rateLimitRemaining: number;
  rateLimitReset: string;
}

interface EnhancedAIStatusProps {
  syncStatus?: any;
  onSync: () => void;
  onResync: () => void;
  onForceReanalyze: () => void;
  showPrompts: boolean;
  onTogglePrompts: () => void;
  showChat?: boolean;
  onToggleChat?: () => void;
}

const EnhancedAIStatus: React.FC<EnhancedAIStatusProps> = ({
  syncStatus,
  onSync,
  onResync,
  onForceReanalyze,
  showPrompts,
  onTogglePrompts,
  showChat = false,
  onToggleChat = () => {}
}) => {
  const [aiConnectivity, setAiConnectivity] = useState<AIConnectivityStatus>({
    connected: true,
    lastHealthCheck: new Date().toISOString(),
    responseTime: 234,
    apiQuotaRemaining: 850,
    apiQuotaLimit: 1000,
    rateLimitRemaining: 98,
    rateLimitReset: new Date(Date.now() + 3600000).toISOString()
  });

  const [aiModels, setAiModels] = useState<AIModel[]>([
    {
      name: 'GPT-5 Nano',
      type: 'nano',
      status: 'active',
      tokensUsed: 125430,
      requestCount: 342,
      avgResponseTime: 180
    },
    {
      name: 'GPT-5 Mini',
      type: 'mini', 
      status: 'active',
      tokensUsed: 89250,
      requestCount: 156,
      avgResponseTime: 420
    }
  ]);

  const [processingMetrics] = useState<AIProcessingMetrics>({
    pending: syncStatus?.aiProcessing?.pending || 0,
    analyzed: syncStatus?.aiProcessing?.analyzed || 0,
    failed: syncStatus?.aiProcessing?.failed || 0,
    failureReasons: [
      { reason: 'API Quota Exceeded', count: 12, lastOccurred: '2 hours ago' },
      { reason: 'Rate Limit Hit', count: 3, lastOccurred: '15 minutes ago' },
      { reason: 'Network Timeout', count: 1, lastOccurred: '1 hour ago' }
    ],
    processing: (syncStatus?.aiProcessing?.pending || 0) > 0,
    currentBatch: 1,
    totalBatches: 3
  });

  const [autoSync, setAutoSync] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  // PERFORMANCE FIX: Simulate real-time updates with proper throttling
  useEffect(() => {
    const interval = setInterval(() => {
      // Update connectivity status
      setAiConnectivity(prev => ({
        ...prev,
        lastHealthCheck: new Date().toISOString(),
        responseTime: Math.floor(Math.random() * 200) + 150,
        apiQuotaRemaining: Math.max(0, prev.apiQuotaRemaining - Math.floor(Math.random() * 5))
      }));

      // Update model metrics
      setAiModels(prev => prev.map(model => ({
        ...model,
        tokensUsed: model.tokensUsed + Math.floor(Math.random() * 100),
        requestCount: model.requestCount + Math.floor(Math.random() * 3),
        avgResponseTime: Math.floor(Math.random() * 100) + 150
      })));
    }, 60000); // FIXED: Changed from 5 seconds to 60 seconds (1 minute)

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': case 'connected': case 'ready': return 'text-emerald-400';
      case 'processing': case 'indexing': return 'text-blue-400';
      case 'error': case 'failed': case 'disconnected': return 'text-red-400';
      case 'warning': return 'text-yellow-400';
      default: return 'text-slate-400';
    }
  };

  const getQuotaPercentage = () => {
    return (aiConnectivity.apiQuotaRemaining / aiConnectivity.apiQuotaLimit) * 100;
  };

  const handleAutoResync = async () => {
    if (processingMetrics.failed > 0 && autoSync) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      onResync();
    }
  };

  useEffect(() => {
    handleAutoResync();
  }, [processingMetrics.failed, autoSync]);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">AI Control Center</h3>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-slate-400 hover:text-white transition-colors"
        >
          {showDetails ? 'Less' : 'More'}
        </button>
      </div>

      <div className="bg-slate-800/20 rounded-xl p-4 border border-slate-700/30 space-y-4">
        {/* Connectivity Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {aiConnectivity.connected ? (
              <Wifi className="w-4 h-4 text-emerald-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-400" />
            )}
            <span className="text-sm font-medium text-white">
              {aiConnectivity.connected ? 'AI Connected' : 'AI Disconnected'}
            </span>
            <span className="text-xs text-slate-400">
              ({aiConnectivity.responseTime}ms)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onSync}
              className="p-1.5 hover:bg-slate-700/50 rounded-lg transition-colors"
              title="Manual Sync"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-400 hover:text-white" />
            </button>
            <button
              onClick={onResync}
              className="p-1.5 hover:bg-slate-700/50 rounded-lg transition-colors"
              title="Force Resync"
            >
              <Play className="w-3.5 h-3.5 text-blue-400 hover:text-blue-300" />
            </button>
            <button
              onClick={onTogglePrompts}
              className={`p-1.5 hover:bg-slate-700/50 rounded-lg transition-colors ${showPrompts ? 'bg-purple-500/20' : ''}`}
              title="Show AI Prompts"
            >
              <Eye className="w-3.5 h-3.5 text-purple-400 hover:text-purple-300" />
            </button>
            <button
              onClick={onToggleChat}
              className={`p-1.5 hover:bg-slate-700/50 rounded-lg transition-colors ${showChat ? 'bg-emerald-500/20' : ''}`}
              title="AI Chat"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400 hover:text-emerald-300" />
            </button>
          </div>
        </div>

        {/* API Quota Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">API Quota</span>
            <span className="text-slate-300">
              {aiConnectivity.apiQuotaRemaining}/{aiConnectivity.apiQuotaLimit}
            </span>
          </div>
          <div className="w-full bg-slate-700/50 rounded-full h-1.5">
            <div 
              className={`h-1.5 rounded-full transition-all duration-300 ${
                getQuotaPercentage() > 20 ? 'bg-emerald-500' : 'bg-red-500'
              }`}
              style={{ width: `${getQuotaPercentage()}%` }}
            ></div>
          </div>
        </div>

        {/* Active Models */}
        <div className="space-y-2">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <Server className="w-3 h-3" />
            Active Models
          </div>
          <div className="flex gap-2">
            {aiModels.map((model, index) => (
              <div 
                key={index}
                className="flex-1 bg-slate-700/30 rounded-lg p-2 border border-slate-600/30"
              >
                <div className="flex items-center gap-1 mb-1">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(model.status)} bg-current`}></div>
                  <span className="text-xs font-medium text-white">{model.name}</span>
                </div>
                <div className="text-xs text-slate-400 space-y-0.5">
                  <div>{model.requestCount} reqs</div>
                  <div>{model.avgResponseTime}ms avg</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Processing Status */}
        {processingMetrics.processing && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Activity className="w-3 h-3 text-blue-400 animate-pulse" />
              <span className="text-xs text-blue-400">
                Processing batch {processingMetrics.currentBatch} of {processingMetrics.totalBatches}
              </span>
            </div>
            <div className="w-full bg-slate-700/50 rounded-full h-1.5">
              <div 
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-300 animate-pulse"
                style={{ 
                  width: `${(processingMetrics.currentBatch / processingMetrics.totalBatches) * 100}%` 
                }}
              ></div>
            </div>
          </div>
        )}

        {/* Auto-sync Toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-700/30">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Auto-sync failures</span>
            <button
              onClick={() => setAutoSync(!autoSync)}
              className={`relative inline-flex h-4 w-7 rounded-full transition-colors ${
                autoSync ? 'bg-emerald-500' : 'bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                  autoSync ? 'translate-x-3.5' : 'translate-x-0.5'
                } mt-0.5`}
              />
            </button>
          </div>
          <div className="text-xs text-slate-400">
            {processingMetrics.failed > 0 && (
              <span className="text-red-400">
                {processingMetrics.failed} failed
              </span>
            )}
          </div>
        </div>

        {/* Detailed View */}
        {showDetails && (
          <div className="pt-3 border-t border-slate-700/30 space-y-3">
            {/* Processing Stats */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-slate-700/20 rounded-lg p-2">
                <div className="text-lg font-bold text-emerald-400">
                  {processingMetrics.analyzed.toLocaleString()}
                </div>
                <div className="text-xs text-slate-400">Analyzed</div>
              </div>
              <div className="bg-slate-700/20 rounded-lg p-2">
                <div className="text-lg font-bold text-blue-400">
                  {processingMetrics.pending}
                </div>
                <div className="text-xs text-slate-400">Pending</div>
              </div>
              <div className="bg-slate-700/20 rounded-lg p-2">
                <div className="text-lg font-bold text-red-400">
                  {processingMetrics.failed}
                </div>
                <div className="text-xs text-slate-400">Failed</div>
              </div>
            </div>

            {/* Failure Analysis */}
            {processingMetrics.failureReasons.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-slate-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Failure Analysis
                </div>
                <div className="space-y-1">
                  {processingMetrics.failureReasons.map((failure, index) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-2"
                    >
                      <span className="text-red-300">{failure.reason}</span>
                      <div className="flex items-center gap-2 text-red-400">
                        <span>{failure.count}x</span>
                        <span className="text-slate-400">{failure.lastOccurred}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={onForceReanalyze}
                  className="w-full bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg p-2 text-xs text-blue-300 transition-colors"
                >
                  Force Reanalyze Failed Items
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedAIStatus;
export { EnhancedAIStatus };