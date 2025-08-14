import React, { useState, useEffect } from 'react';
import { Badge, Button, Card, TextArea } from '../ui';
// import { PaperAirplaneIcon, PencilIcon } from '@heroicons/react/24/outline'; // Temporarily disabled

interface Draft {
  id: number;
  email_id: number;
  content: string;
  confidence: number;
  created_at: string;
}

const DraftList: React.FC = () => {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editedContent, setEditedContent] = useState<string>('');

  useEffect(() => {
    fetchDrafts();
  }, []);

  const fetchDrafts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('http://localhost:8000/drafts/');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Defensive programming: ensure data is an array
      if (!Array.isArray(data)) {
        console.error('API response is not an array:', data);
        throw new Error('Invalid API response format');
      }
      
      setDrafts(data);
    } catch (err) {
      console.error('Failed to fetch drafts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch drafts');
      setDrafts([]); // Ensure drafts is always an array
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (draft: Draft) => {
    setEditingId(draft.id);
    setEditedContent(draft.content);
  };

  const saveEdit = (draftId: number) => {
    const updatedDrafts = drafts.map(draft => 
      draft.id === draftId 
        ? { ...draft, content: editedContent }
        : draft
    );
    setDrafts(updatedDrafts);
    setEditingId(null);
  };

  const sendDraft = async (draftId: number) => {
    // TODO: Implement sending draft through Apple Mail
    console.log('Sending draft:', draftId);
  };

  if (loading) return <div className="flex justify-center items-center py-8">Loading drafts...</div>;
  if (error) return (
    <div className="text-red-500 p-4 border border-red-300 rounded-lg bg-red-50">
      <p className="font-semibold">Error loading drafts:</p>
      <p>{error}</p>
      <Button onClick={fetchDrafts} className="mt-2">
        Try Again
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Draft Replies</h1>
        <Button onClick={fetchDrafts}>Refresh</Button>
      </div>

      <div className="grid gap-4">
        {drafts && drafts.length > 0 ? (
          drafts.map((draft) => (
          <Card key={draft.id} className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge className="bg-blue-100 text-blue-800">
                  {Math.round(draft.confidence * 100)}% confidence
                </Badge>
                <span className="text-sm text-gray-500">
                  Created: {new Date(draft.created_at).toLocaleString()}
                </span>
              </div>

              {editingId === draft.id ? (
                <div className="space-y-2">
                  <TextArea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    rows={6}
                    className="w-full"
                  />
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={() => saveEdit(draft.id)}>
                      Save Changes
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <pre className="whitespace-pre-wrap font-sans">
                    {draft.content}
                  </pre>
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => startEditing(draft)}
                    >
                      <span className="w-5 h-5 mr-2 font-bold">✏</span>
                      Edit
                    </Button>
                    <Button onClick={() => sendDraft(draft.id)}>
                      <span className="w-5 h-5 mr-2 font-bold">➤</span>
                      Send
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p className="text-lg">No draft replies found</p>
            <p className="text-sm">Draft replies will appear here when AI generates responses</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DraftList;