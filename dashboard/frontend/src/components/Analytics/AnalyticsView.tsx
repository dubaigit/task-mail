import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Mail,
  CheckSquare,
  FileText,
  Clock,
  AlertCircle,
  Users,
  Target,
  Activity
} from 'lucide-react';
import axios from 'axios';

interface AnalyticsData {
  total_emails: number;
  pending_tasks: number;
  unsent_drafts: number;
  classification_breakdown: { [key: string]: number };
  urgency_breakdown: { [key: string]: number };
}

const AnalyticsView: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      const response = await axios.get('/api/statistics');
      setAnalytics(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setLoading(false);
    }
  };

  const getClassificationColor = (classification: string) => {
    const colors: { [key: string]: string } = {
      'NEEDS_REPLY': 'bg-blue-500',
      'APPROVAL_REQUIRED': 'bg-purple-500',
      'CREATE_TASK': 'bg-orange-500',
      'DELEGATE': 'bg-yellow-500',
      'FYI_ONLY': 'bg-gray-500',
      'FOLLOW_UP': 'bg-green-500'
    };
    return colors[classification] || 'bg-gray-500';
  };

  const getUrgencyColor = (urgency: string) => {
    const colors: { [key: string]: string } = {
      'CRITICAL': 'bg-red-500',
      'HIGH': 'bg-orange-500',
      'MEDIUM': 'bg-yellow-500',
      'LOW': 'bg-green-500'
    };
    return colors[urgency] || 'bg-gray-500';
  };

  const formatClassificationName = (classification: string) => {
    return classification.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <p className="text-gray-500">No analytics data available</p>
      </div>
    );
  }

  const totalClassifications = Object.values(analytics.classification_breakdown).reduce((a, b) => a + b, 0);
  const totalUrgencies = Object.values(analytics.urgency_breakdown).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600">Email intelligence and performance insights</p>
        </div>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="1d">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 mr-4">
              <Mail className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{analytics.total_emails}</p>
              <p className="text-sm text-gray-600">Total Emails</p>
              <div className="flex items-center mt-1">
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-xs text-green-600">+12% vs last period</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-orange-100 mr-4">
              <CheckSquare className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{analytics.pending_tasks}</p>
              <p className="text-sm text-gray-600">Pending Tasks</p>
              <div className="flex items-center mt-1">
                <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                <span className="text-xs text-red-600">-5% vs last period</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100 mr-4">
              <FileText className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{analytics.unsent_drafts}</p>
              <p className="text-sm text-gray-600">Unsent Drafts</p>
              <div className="flex items-center mt-1">
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-xs text-green-600">+8% vs last period</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 mr-4">
              <Activity className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">94%</p>
              <p className="text-sm text-gray-600">AI Accuracy</p>
              <div className="flex items-center mt-1">
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-xs text-green-600">+2% vs last period</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Email Classification Breakdown */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Email Classification Breakdown</h3>
          <div className="space-y-3">
            {Object.entries(analytics.classification_breakdown).map(([classification, count]) => {
              const percentage = totalClassifications ? (count / totalClassifications * 100) : 0;
              return (
                <div key={classification} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-4 h-4 rounded ${getClassificationColor(classification)}`}></div>
                    <span className="text-sm font-medium text-gray-900">
                      {formatClassificationName(classification)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${getClassificationColor(classification)}`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-600 w-12 text-right">
                      {count} ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Urgency Breakdown */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Urgency Level Distribution</h3>
          <div className="space-y-3">
            {Object.entries(analytics.urgency_breakdown).map(([urgency, count]) => {
              const percentage = totalUrgencies ? (count / totalUrgencies * 100) : 0;
              return (
                <div key={urgency} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-4 h-4 rounded ${getUrgencyColor(urgency)}`}></div>
                    <span className="text-sm font-medium text-gray-900 capitalize">
                      {urgency.toLowerCase()}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${getUrgencyColor(urgency)}`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-600 w-12 text-right">
                      {count} ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Response Time</h3>
            <Clock className="h-5 w-5 text-gray-500" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Average Response Time</span>
              <span className="font-medium">2.4 hours</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Fastest Response</span>
              <span className="font-medium">12 minutes</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Response Rate</span>
              <span className="font-medium">87%</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Task Efficiency</h3>
            <Target className="h-5 w-5 text-gray-500" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Tasks Completed</span>
              <span className="font-medium">156</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Completion Rate</span>
              <span className="font-medium">78%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Avg. Task Duration</span>
              <span className="font-medium">3.2 days</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">AI Performance</h3>
            <Activity className="h-5 w-5 text-gray-500" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Classification Accuracy</span>
              <span className="font-medium">94%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Sentiment Accuracy</span>
              <span className="font-medium">89%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Processing Time</span>
              <span className="font-medium">45ms</span>
            </div>
          </div>
        </div>
      </div>

      {/* Insights and Recommendations */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Insights & Recommendations</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-start space-x-3">
                <div className="p-1 bg-blue-100 rounded">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-medium text-blue-900">High Priority Emails Increasing</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    You've received 23% more urgent emails this week. Consider setting up automated responses for common queries.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-start space-x-3">
                <div className="p-1 bg-green-100 rounded">
                  <CheckSquare className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <h4 className="font-medium text-green-900">Task Completion Improved</h4>
                  <p className="text-sm text-green-700 mt-1">
                    Your task completion rate has improved by 15% since using AI-powered email insights.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-orange-50 rounded-lg">
              <div className="flex items-start space-x-3">
                <div className="p-1 bg-orange-100 rounded">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                </div>
                <div>
                  <h4 className="font-medium text-orange-900">Draft Response Optimization</h4>
                  <p className="text-sm text-orange-700 mt-1">
                    Consider reviewing your draft templates. Some responses could be more concise and effective.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="flex items-start space-x-3">
                <div className="p-1 bg-purple-100 rounded">
                  <Users className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-medium text-purple-900">Delegation Opportunities</h4>
                  <p className="text-sm text-purple-700 mt-1">
                    42% of your emails could be delegated to team members. This could save you 6 hours per week.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsView;