import React, { useState, useEffect } from 'react';
import { Badge, Button, Card } from '../ui';
// Temporarily removed heroicons import

interface Email {
  id: number;
  subject: string;
  sender: string;
  date: string;
  classification: string;
  urgency: string;
  confidence: number;
  has_draft: boolean;
}

const EmailList: React.FC = () => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('http://localhost:8000/emails/');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Defensive programming: ensure data is an array
      if (!Array.isArray(data)) {
        console.error('API response is not an array:', data);
        throw new Error('Invalid API response format');
      }
      
      setEmails(data);
    } catch (err) {
      console.error('Failed to fetch emails:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch emails');
      setEmails([]); // Ensure emails is always an array
    } finally {
      setLoading(false);
    }
  };

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'NEEDS_REPLY':
        return 'bg-blue-100 text-blue-800';
      case 'APPROVAL_REQUIRED':
        return 'bg-red-100 text-red-800';
      case 'CREATE_TASK':
        return 'bg-purple-100 text-purple-800';
      case 'DELEGATE':
        return 'bg-orange-100 text-orange-800';
      case 'FYI_ONLY':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case 'CRITICAL':
        return <span className="w-5 h-5 text-red-500 font-bold">!</span>;
      case 'HIGH':
        return <span className="w-5 h-5 text-orange-500 font-bold">★</span>;
      default:
        return null;
    }
  };

  if (loading) return <div className="flex justify-center items-center py-8">Loading emails...</div>;
  if (error) return (
    <div className="text-red-500 p-4 border border-red-300 rounded-lg bg-red-50">
      <p className="font-semibold">Error loading emails:</p>
      <p>{error}</p>
      <Button onClick={fetchEmails} className="mt-2">
        Try Again
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Inbox</h1>
        <Button onClick={fetchEmails}>Refresh</Button>
      </div>

      <div className="grid gap-4">
        {emails && emails.length > 0 ? (
          emails.map((email) => (
            <Card key={email.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    {getUrgencyIcon(email.urgency)}
                    <h2 className="text-lg font-semibold">{email.subject}</h2>
                  </div>
                  <p className="text-gray-600">{email.sender}</p>
                  <div className="flex items-center space-x-2">
                    <Badge className={getClassificationColor(email.classification)}>
                      {email.classification}
                    </Badge>
                    <Badge className="bg-gray-100">
                      {Math.round(email.confidence * 100)}% confidence
                    </Badge>
                    {email.has_draft && (
                      <Badge className="bg-green-100 text-green-800">
                        <span className="w-4 h-4 mr-1 text-green-600 font-bold">✓</span>
                        Draft Ready
                      </Badge>
                    )}
                  </div>
                </div>
                <span className="text-sm text-gray-500">
                  {new Date(email.date).toLocaleString()}
                </span>
              </div>
            </Card>
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p className="text-lg">No emails found</p>
            <p className="text-sm">Try refreshing or check your email configuration</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailList;