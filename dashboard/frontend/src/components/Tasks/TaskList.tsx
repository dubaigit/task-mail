import React, { useState, useEffect } from 'react';
import { Badge, Button, Card } from '../ui';
// import { CalendarIcon, ArrowPathIcon } from '@heroicons/react/24/outline'; // Temporarily disabled

interface Task {
  id: number;
  task_id: string;
  subject: string;
  description: string;
  task_type: string;
  priority: string;
  assignee: string;
  due_date: string | null;
  status: string;
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
      
      const response = await fetch('http://localhost:8002/tasks/');
      
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
        return 'warning';
      case 'in_progress':
        return 'info';
      case 'completed':
        return 'success';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return 'danger';
      case 'normal':
        return 'info';
      case 'low':
        return 'success';
      default:
        return 'default';
    }
  };

  if (loading) return <div className="flex justify-center items-center py-8 text-muted-foreground">Loading tasks...</div>;
  if (error) return (
    <div className="text-destructive p-4 border border-destructive/20 rounded-lg bg-destructive/10">
      <p className="font-semibold">Error loading tasks:</p>
      <p>{error}</p>
      <Button onClick={fetchTasks} className="mt-2" variant="danger">
        Try Again
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-foreground">Tasks</h1>
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
                  <h2 className="text-lg font-semibold text-foreground">{task.subject}</h2>
                  <div className="flex items-center space-x-2">
                    <Badge variant={getStatusColor(task.status)}>
                      {task.status}
                    </Badge>
                    <Badge variant={getPriorityColor(task.priority)}>
                      {task.priority} priority
                    </Badge>
                  </div>
                </div>

                <p className="text-muted-foreground">{task.description}</p>

                <div className="flex items-center justify-between">
                  {task.due_date && (
                    <div className="flex items-center text-muted-foreground">
                      <span className="w-5 h-5 mr-1 font-bold">📅</span>
                      Due: {new Date(task.due_date).toLocaleDateString()}
                    </div>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => window.location.href = `/?task=${task.task_id}`}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-lg">No tasks found</p>
            <p className="text-sm">Tasks will appear here when emails require action</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskList;