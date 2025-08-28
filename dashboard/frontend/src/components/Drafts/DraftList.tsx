import React, { useState, useEffect } from 'react';
import { Badge, Button, Card, TextArea } from '../ui';
// import { PaperAirplaneIcon, PencilIcon } from '../ui/icons';

interface Draft {
  id: number;
  task_id: number;
  content: string;
  version: number;
  created_at: string;
  updated_at: string;
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
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await fetch('/api/drafts', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.status === 401) {
        localStorage.clear();
        window.location.href = '/login';
        return;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Defensive programming: ensure data is an array
      if (!Array.isArray(data)) {
        throw new Error('Invalid API response format');
      }
      
      setDrafts(data);
    } catch (err) {
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
    try {
      setError(null);
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await fetch(`/api/drafts/${draftId}/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.status === 401) {
        localStorage.clear();
        window.location.href = '/login';
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Show success message
      alert(`Email sent successfully to ${result.recipient}!\nSubject: ${result.subject}`);
      
      // Optionally refresh drafts list to reflect sent status
      fetchDrafts();
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send draft';
      setError(`Failed to send draft: ${errorMessage}`);
      alert(`Failed to send draft: ${errorMessage}`);
    }
  };

  if (loading) return <div className="flex justify-center items-center py-8 text-muted-foreground">Loading drafts...</div>;
  if (error) return (
    <div className="text-destructive p-4 border border-destructive/20 rounded-lg bg-destructive/10">
      <p className="font-semibold">Error loading drafts:</p>
      <p>{error}</p>
      <Button onClick={fetchDrafts} className="mt-2" variant="danger">
        Try Again
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-foreground">Draft Replies</h1>
        <Button onClick={fetchDrafts}>Refresh</Button>
      </div>

      <div className="grid gap-4">
        {drafts && drafts.length > 0 ? (
          drafts.map((draft) => (
          <Card key={draft.id} className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="info">
                  Version {draft.version}
                </Badge>
                <div className="text-sm text-muted-foreground">
                  <div>Created: {new Date(draft.created_at).toLocaleString()}</div>
                  <div>Updated: {new Date(draft.updated_at).toLocaleString()}</div>
                </div>
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
                  <pre className="whitespace-pre-wrap font-sans text-foreground">
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
                    <Button 
                      onClick={() => sendDraft(draft.id)}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <span className="w-5 h-5 mr-2 font-bold">➤</span>
                      Send via Apple Mail
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-lg">No draft replies found</p>
            <p className="text-sm">Draft replies will appear here when AI generates responses</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DraftList;
