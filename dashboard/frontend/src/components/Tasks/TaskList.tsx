import React, { useState, useEffect } from 'react';
import { Badge, Button, Card } from '../ui';
// import { CalendarIcon, ArrowPathIcon } from '@heroicons/react/24/outline'; // Temporarily disabled

interface Task {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string | null;
  email_id: number | null;
}

const TaskList: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('http://localhost:8000/tasks/');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Defensive programming: ensure data is an array
      if (!Array.isArray(data)) {
        console.error('API response is not an array:', data);
        throw new Error('Invalid API response format');
      }
      
      setTasks(data);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
      setTasks([]); // Ensure tasks is always an array
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'normal':
        return 'bg-blue-100 text-blue-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) return <div className="flex justify-center items-center py-8">Loading tasks...</div>;
  if (error) return (
    <div className="text-red-500 p-4 border border-red-300 rounded-lg bg-red-50">
      <p className="font-semibold">Error loading tasks:</p>
      <p>{error}</p>
      <Button onClick={fetchTasks} className="mt-2">
        Try Again
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <Button onClick={fetchTasks}>
          <span className="w-5 h-5 mr-2 font-bold">↻</span>
          Refresh
        </Button>
      </div>

      <div className="grid gap-4">
        {tasks && tasks.length > 0 ? (
          tasks.map((task) => (
            <Card key={task.id} className="p-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <h2 className="text-lg font-semibold">{task.title}</h2>
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(task.status)}>
                      {task.status}
                    </Badge>
                    <Badge className={getPriorityColor(task.priority)}>
                      {task.priority} priority
                    </Badge>
                  </div>
                </div>

                <p className="text-gray-600">{task.description}</p>

                <div className="flex items-center justify-between">
                  {task.due_date && (
                    <div className="flex items-center text-gray-500">
                      <span className="w-5 h-5 mr-1 font-bold">📅</span>
                      Due: {new Date(task.due_date).toLocaleDateString()}
                    </div>
                  )}
                  {task.email_id && (
                    <Button
                      variant="outline"
                      onClick={() => window.location.href = `/?email=${task.email_id}`}
                    >
                      View Email
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p className="text-lg">No tasks found</p>
            <p className="text-sm">Tasks will appear here when emails require action</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskList;