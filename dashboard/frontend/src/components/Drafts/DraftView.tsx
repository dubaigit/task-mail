import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Send, 
  Edit3, 
  Trash2, 
  Mail,
  Clock,
  User,
  Search,
  Filter,
  Plus,
  Eye,
  Copy,
  ExternalLink
} from 'lucide-react';
import axios from 'axios';

interface DraftData {
  id: string;
  subject: string;
  body: string;
  to_email: string;
  generated_for: string;
  created_at: string;
  is_sent: boolean;
}

const DraftView: React.FC = () => {
  const [drafts, setDrafts] = useState<DraftData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDraft, setSelectedDraft] = useState<DraftData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetchDrafts();
  }, []);

  const fetchDrafts = async () => {
    try {
      const response = await axios.get('/api/drafts');
      setDrafts(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching drafts:', error);
      setLoading(false);
    }
  };

  const sendDraft = async (draftId: string) => {
    try {
      await axios.put(`/api/drafts/${draftId}/send`);
      setDrafts(prev => prev.map(draft => 
        draft.id === draftId ? { ...draft, is_sent: true } : draft
      ));
      alert('Draft marked as sent!');
    } catch (error) {
      console.error('Error sending draft:', error);
      alert('Error sending draft');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const getRecipientName = (email: string) => {
    return email.split('@')[0];
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const filteredDrafts = drafts.filter(draft => {
    if (!searchQuery) return true;
    
    return draft.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
           draft.to_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
           draft.body.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const unsentDrafts = drafts.filter(d => !d.is_sent);
  const sentDrafts = drafts.filter(d => d.is_sent);

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
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 mr-4">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{unsentDrafts.length}</p>
              <p className="text-sm text-gray-600">Unsent Drafts</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 mr-4">
              <Send className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{sentDrafts.length}</p>
              <p className="text-sm text-gray-600">Sent Drafts</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100 mr-4">
              <Mail className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{drafts.length}</p>
              <p className="text-sm text-gray-600">Total Drafts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Draft List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-gray-500" />
              <h2 className="text-xl font-semibold text-gray-900">Draft Emails</h2>
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                {filteredDrafts.length} drafts
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>New Draft</span>
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search drafts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Draft List */}
        <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
          {filteredDrafts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No drafts found matching your search.</p>
            </div>
          ) : (
            filteredDrafts.map((draft) => (
              <div
                key={draft.id}
                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                  selectedDraft?.id === draft.id ? 'bg-blue-50' : ''
                } ${draft.is_sent ? 'opacity-75' : ''}`}
                onClick={() => setSelectedDraft(draft)}
              >
                <div className="flex items-start space-x-3">
                  {/* Status Icon */}
                  <div className="flex-shrink-0 mt-1">
                    {draft.is_sent ? (
                      <div className="p-2 bg-green-100 rounded-full">
                        <Send className="h-4 w-4 text-green-600" />
                      </div>
                    ) : (
                      <div className="p-2 bg-blue-100 rounded-full">
                        <Edit3 className="h-4 w-4 text-blue-600" />
                      </div>
                    )}
                  </div>

                  {/* Draft Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900">
                          To: {getRecipientName(draft.to_email)}
                        </span>
                        <span className="text-xs text-gray-500">
                          ({draft.to_email})
                        </span>
                        {draft.is_sent && (
                          <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
                            Sent
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        <span>{formatTimestamp(draft.created_at)}</span>
                      </div>
                    </div>

                    <h3 className="text-sm font-medium text-gray-900 mb-2">
                      {draft.subject}
                    </h3>

                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                      {draft.body.substring(0, 200)}...
                    </p>

                    {/* Generated Context */}
                    <div className="mb-3 p-2 bg-purple-50 rounded text-xs">
                      <div className="flex items-center space-x-1 text-purple-700">
                        <Mail className="h-3 w-3" />
                        <span>AI-generated response for email ID: {draft.generated_for}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowPreview(true);
                          }}
                          className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center space-x-1"
                        >
                          <Eye className="h-3 w-3" />
                          <span>Preview</span>
                        </button>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(draft.body);
                          }}
                          className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center space-x-1"
                        >
                          <Copy className="h-3 w-3" />
                          <span>Copy</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Navigate to related email
                            console.log('View related email:', draft.generated_for);
                          }}
                          className="px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 flex items-center space-x-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>View Email</span>
                        </button>
                      </div>

                      {!draft.is_sent && (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Edit draft functionality
                              console.log('Edit draft:', draft.id);
                            }}
                            className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center space-x-1"
                          >
                            <Edit3 className="h-3 w-3" />
                            <span>Edit</span>
                          </button>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm('Mark this draft as sent?')) {
                                sendDraft(draft.id);
                              }
                            }}
                            className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 flex items-center space-x-1"
                          >
                            <Send className="h-3 w-3" />
                            <span>Send</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Showing {filteredDrafts.length} of {drafts.length} drafts</span>
            <div className="flex items-center space-x-2">
              <span>AI-generated responses</span>
              <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && selectedDraft && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Draft Preview</h3>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <div className="text-sm text-gray-600 mb-2">
                  <strong>To:</strong> {selectedDraft.to_email}
                </div>
                <div className="text-sm text-gray-600 mb-4">
                  <strong>Subject:</strong> {selectedDraft.subject}
                </div>
              </div>
              
              <div className="border-t border-gray-200 pt-4">
                <div className="whitespace-pre-wrap text-sm text-gray-900">
                  {selectedDraft.body}
                </div>
              </div>
            </div>
            
            <div className="border-t border-gray-200 p-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Close
              </button>
              {!selectedDraft.is_sent && (
                <button
                  onClick={() => {
                    if (window.confirm('Mark this draft as sent?')) {
                      sendDraft(selectedDraft.id);
                      setShowPreview(false);
                    }
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center space-x-2"
                >
                  <Send className="h-4 w-4" />
                  <span>Send</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DraftView;