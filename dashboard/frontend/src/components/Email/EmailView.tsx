import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Reply, 
  Forward, 
  Archive,
  Star,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  Mail,
  Paperclip,
  MoreHorizontal
} from 'lucide-react';
import axios from 'axios';

interface EmailData {
  id: string;
  subject: string;
  body: string;
  sender: string;
  received_at: string;
  classification?: string;
  urgency?: string;
  sentiment?: string;
  confidence?: number;
  action_items?: any[];
  deadlines?: any[];
}

const EmailView: React.FC = () => {
  const [emails, setEmails] = useState<EmailData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<EmailData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBy, setFilterBy] = useState('all');

  useEffect(() => {
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    try {
      const response = await axios.get('/api/emails');
      setEmails(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching emails:', error);
      setLoading(false);
    }
  };

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency?.toLowerCase()) {
      case 'critical': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'high': return <TrendingUp className="h-4 w-4 text-orange-500" />;
      case 'medium': return <Minus className="h-4 w-4 text-yellow-500" />;
      case 'low': return <TrendingDown className="h-4 w-4 text-green-500" />;
      default: return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'negative': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'neutral': return <Minus className="h-4 w-4 text-gray-500" />;
      default: return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return "text-gray-500";
    if (confidence >= 0.9) return "text-green-600";
    if (confidence >= 0.7) return "text-yellow-600";
    return "text-red-600";
  };

  const getClassificationBadge = (classification: string) => {
    const badgeClasses = "px-2 py-1 text-xs font-medium rounded-full";
    
    switch (classification) {
      case 'NEEDS_REPLY':
        return <span className={`${badgeClasses} bg-blue-100 text-blue-800`}>Needs Reply</span>;
      case 'APPROVAL_REQUIRED':
        return <span className={`${badgeClasses} bg-purple-100 text-purple-800`}>Approval Required</span>;
      case 'CREATE_TASK':
        return <span className={`${badgeClasses} bg-orange-100 text-orange-800`}>Create Task</span>;
      case 'DELEGATE':
        return <span className={`${badgeClasses} bg-yellow-100 text-yellow-800`}>Delegate</span>;
      case 'FYI_ONLY':
        return <span className={`${badgeClasses} bg-gray-100 text-gray-800`}>FYI Only</span>;
      case 'FOLLOW_UP':
        return <span className={`${badgeClasses} bg-green-100 text-green-800`}>Follow Up</span>;
      default:
        return <span className={`${badgeClasses} bg-gray-100 text-gray-800`}>{classification}</span>;
    }
  };

  const getSenderInitials = (sender: string) => {
    return sender.split('@')[0].substring(0, 2).toUpperCase();
  };

  const getSenderName = (sender: string) => {
    const name = sender.split('@')[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const filteredEmails = emails.filter(email => {
    const matchesSearch = !searchQuery || 
      email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.sender.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.body.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = filterBy === 'all' || 
      (filterBy === 'needs_reply' && email.classification === 'NEEDS_REPLY') ||
      (filterBy === 'urgent' && email.urgency === 'CRITICAL') ||
      (filterBy === 'approval' && email.classification === 'APPROVAL_REQUIRED');

    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Mail className="h-5 w-5 text-gray-500" />
            <h2 className="text-xl font-semibold text-gray-900">Inbox</h2>
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
              {filteredEmails.length} emails
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center space-x-1">
              <Filter className="h-4 w-4" />
              <span>Filter</span>
            </button>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex space-x-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All emails</option>
            <option value="needs_reply">Needs Reply</option>
            <option value="urgent">Urgent</option>
            <option value="approval">Approval Required</option>
          </select>
        </div>
      </div>

      {/* Email List */}
      <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
        {filteredEmails.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No emails found matching your criteria.</p>
          </div>
        ) : (
          filteredEmails.map((email) => (
            <div
              key={email.id}
              className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                selectedEmail?.id === email.id ? 'bg-blue-50' : ''
              }`}
              onClick={() => setSelectedEmail(email)}
            >
              <div className="flex items-start space-x-3">
                {/* Avatar */}
                <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-medium text-sm">
                    {getSenderInitials(email.sender)}
                  </span>
                </div>

                {/* Email Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-sm text-gray-900">
                        {getSenderName(email.sender)}
                      </span>
                      <span className="text-xs text-gray-500">{email.sender}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(email.received_at)}
                      </span>
                    </div>
                  </div>

                  <div className="mb-2">
                    <h3 className="text-sm font-medium text-gray-900 mb-1 line-clamp-1">
                      {email.subject}
                    </h3>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {email.body.substring(0, 150)}...
                    </p>
                  </div>

                  {/* Classification and Analysis */}
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {email.classification && getClassificationBadge(email.classification)}
                  </div>

                  {/* AI Analysis */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-xs">
                      {email.urgency && (
                        <div className="flex items-center space-x-1">
                          {getUrgencyIcon(email.urgency)}
                          <span className="capitalize">{email.urgency.toLowerCase()}</span>
                        </div>
                      )}
                      {email.sentiment && (
                        <div className="flex items-center space-x-1">
                          {getSentimentIcon(email.sentiment)}
                          <span className="capitalize">{email.sentiment.toLowerCase()}</span>
                        </div>
                      )}
                      {email.confidence && (
                        <div className="flex items-center space-x-1">
                          <span className={`font-medium ${getConfidenceColor(email.confidence)}`}>
                            {Math.round(email.confidence * 100)}%
                          </span>
                          <span className="text-gray-500">confidence</span>
                        </div>
                      )}
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1 hover:bg-gray-100 rounded">
                        <Reply className="h-4 w-4 text-gray-500" />
                      </button>
                      <button className="p-1 hover:bg-gray-100 rounded">
                        <Forward className="h-4 w-4 text-gray-500" />
                      </button>
                      <button className="p-1 hover:bg-gray-100 rounded">
                        <Archive className="h-4 w-4 text-gray-500" />
                      </button>
                    </div>
                  </div>

                  {/* Action Items */}
                  {email.action_items && email.action_items.length > 0 && (
                    <div className="mt-2 p-2 bg-yellow-50 rounded text-xs">
                      <strong className="text-yellow-800">Action Items:</strong>
                      <ul className="list-disc list-inside text-yellow-700 mt-1">
                        {email.action_items.slice(0, 2).map((item, index) => (
                          <li key={index}>{item.text}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Deadlines */}
                  {email.deadlines && email.deadlines.length > 0 && (
                    <div className="mt-2 p-2 bg-red-50 rounded text-xs">
                      <strong className="text-red-800">Deadlines:</strong>
                      <ul className="list-disc list-inside text-red-700 mt-1">
                        {email.deadlines.slice(0, 2).map((deadline, index) => (
                          <li key={index}>
                            {new Date(deadline.date).toLocaleDateString()}: {deadline.context}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Showing {filteredEmails.length} of {emails.length} emails</span>
          <div className="flex items-center space-x-2">
            <span>AI-powered insights enabled</span>
            <div className="h-2 w-2 bg-green-500 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailView;