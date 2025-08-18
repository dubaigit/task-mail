import React, { useEffect, useState } from "react";

interface Email {
  id: number;
  subject: string;
  sender: string;
  recipients: string;
  date: string;
  body: string;
}

const EmailDirectory: React.FC = () => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchEmails = async () => {
      try {
        const response = await fetch("http://localhost:8000/emails?limit=100");
        const data = await response.json();
        setEmails(data);
      } catch (error) {
        console.error("Failed to fetch emails", error);
      } finally {
        setLoading(false);
      }
    };
    fetchEmails();
  }, []);

  if (loading) {
    return <div className="p-4 text-gray-500">Loading emails...</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Email Directory</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300 dark:border-gray-700">
          <thead className="bg-gray-100 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-2 border">Subject</th>
              <th className="px-4 py-2 border">Sender</th>
              <th className="px-4 py-2 border">Recipients</th>
              <th className="px-4 py-2 border">Date</th>
            </tr>
          </thead>
          <tbody>
            {emails.map((email) => (
              <tr key={email.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                <td className="px-4 py-2 border">{email.subject}</td>
                <td className="px-4 py-2 border">{email.sender}</td>
                <td className="px-4 py-2 border">{email.recipients}</td>
                <td className="px-4 py-2 border">{new Date(email.date).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EmailDirectory;
