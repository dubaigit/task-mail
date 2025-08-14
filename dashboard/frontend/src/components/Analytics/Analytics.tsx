import React, { useState, useEffect } from 'react';
import { Card } from '../ui';
// import { ChartBarIcon, EnvelopeIcon, ClockIcon } from '@heroicons/react/24/outline'; // Temporarily disabled

interface Stats {
  total_emails: number;
  unread_emails: number;
  classifications: Record<string, number>;
  urgencies: Record<string, number>;
  processing_stats: {
    accuracy_estimates: {
      critical_classes: string;
      general_classification: string;
      urgency_detection: string;
      sentiment_analysis: string;
    };
  };
}

const Analytics: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('http://localhost:8002/analytics/dashboard');
      const data = await response.json();
      setStats(data);
      setLoading(false);
    } catch (err) {
      setError('Failed to fetch analytics');
      setLoading(false);
    }
  };

  if (loading) return <div>Loading analytics...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (!stats) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics Dashboard</h1>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <span className="w-8 h-8 text-blue-500 text-2xl font-bold">📧</span>
            <div>
              <h3 className="text-lg font-semibold">Total Emails</h3>
              <p className="text-2xl font-bold">{stats.total_emails}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <span className="w-8 h-8 text-orange-500 text-2xl font-bold">📉</span>
            <div>
              <h3 className="text-lg font-semibold">Unread</h3>
              <p className="text-2xl font-bold">{stats.unread_emails}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <span className="w-8 h-8 text-green-500 text-2xl font-bold">⏱</span>
            <div>
              <h3 className="text-lg font-semibold">Processing Speed</h3>
              <p className="text-2xl font-bold">&lt;100ms</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Classification Distribution */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Email Classifications</h2>
        <div className="space-y-3">
          {Object.entries(stats.classifications).map(([type, count]) => (
            <div key={type} className="flex items-center">
              <div className="w-32 font-medium">{type}</div>
              <div className="flex-1">
                <div className="bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-blue-500 rounded-full h-4"
                    style={{
                      width: `${(count / stats.total_emails) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <div className="w-16 text-right">{count}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Urgency Distribution */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Urgency Levels</h2>
        <div className="space-y-3">
          {Object.entries(stats.urgencies).map(([level, count]) => (
            <div key={level} className="flex items-center">
              <div className="w-32 font-medium">{level}</div>
              <div className="flex-1">
                <div className="bg-gray-200 rounded-full h-4">
                  <div
                    className={`rounded-full h-4 ${
                      level === 'CRITICAL'
                        ? 'bg-red-500'
                        : level === 'HIGH'
                        ? 'bg-orange-500'
                        : 'bg-green-500'
                    }`}
                    style={{
                      width: `${(count / stats.total_emails) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <div className="w-16 text-right">{count}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* AI Performance */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">AI Performance Metrics</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="font-medium mb-2">Critical Classes</h3>
            <p className="text-2xl font-bold text-blue-600">
              {stats.processing_stats.accuracy_estimates.critical_classes}
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-2">General Classification</h3>
            <p className="text-2xl font-bold text-blue-600">
              {stats.processing_stats.accuracy_estimates.general_classification}
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-2">Urgency Detection</h3>
            <p className="text-2xl font-bold text-blue-600">
              {stats.processing_stats.accuracy_estimates.urgency_detection}
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-2">Sentiment Analysis</h3>
            <p className="text-2xl font-bold text-blue-600">
              {stats.processing_stats.accuracy_estimates.sentiment_analysis}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Analytics;