import React, { useState, useEffect } from 'react';
import { Badge, Button, Card } from '../ui';
import { useNavigate } from 'react-router-dom';

interface Task {
  id: number;
  title: string;
  task_type: string;
  state: string;
  priority: number;
  due_at: string | null;
  snippet: string;
  sender: string;
  received_at: string;
  has_attachments: boolean;
}

const TaskList: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const navigate = useNavigate();

  useEffect(() => {
    fetchTasks();
    // Poll for new tasks every 15 seconds
    const interval = setInterval(fetchTasks, 15000);
    return () => clearInterval(interval);
  }, [filter]);

  const fetchTasks = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      let url = '/api/tasks';
      if (filter !== 'all') {
        url += `?state=${filter}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        localStorage.clear();
        navigate('/login');
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setTasks(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  };

  const updateTaskState = async (taskId: string, newState: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ state: newState }),
      });

      if (response.ok) {
        // Refresh tasks
        fetchTasks();
      }
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  const getPriorityBadge = (priority: number) => {
    switch (priority) {
      case 1:
        return <Badge variant="danger">High Priority</Badge>;
      case 2:
        return <Badge variant="info">Normal</Badge>;
      case 3:
        return <Badge variant="primary">Low</Badge>;
      default:
        return null;
    }
  };

  // const _getStateBadge = (state: string) => {
  //   const stateColors: Record<string, string> = {
  //     'todo': 'bg-yellow-500',
  //     'in_progress': 'bg-blue-500',
  //     'waiting_on_reply': 'bg-purple-500',
  //     'done': 'bg-green-500',
  //     'snoozed': 'bg-gray-500',
  //     'delegated': 'bg-orange-500',
  //   };

  //   return (
  //     <span className={`px-2 py-1 rounded text-white text-xs ${stateColors[state] || 'bg-gray-500'}`}>
  //       {state.replace('_', ' ').toUpperCase()}
  //     </span>
  //   );
  // };

  const getTaskTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      'reply': '↩️',
      'approve': '✅',
      'reject': '❌',
      'ask_info': '❓',
      'schedule': '📅',
      'delegate': '👥',
      'attach_and_reply': '📎',
      'fyi': 'ℹ️',
    };
    return icons[type] || '📧';
  };

  const groupedTasks = React.useMemo(() => {
    const groups: Record<string, Task[]> = {
      'Todo': tasks.filter(t => t.state === 'todo'),
      'In Progress': tasks.filter(t => t.state === 'in_progress'),
      'Waiting on Reply': tasks.filter(t => t.state === 'waiting_on_reply'),
      'Done': tasks.filter(t => t.state === 'done'),
    };
    return groups;
  }, [tasks]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8 text-muted-foreground">
        Loading tasks...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-destructive p-4 border border-destructive/20 rounded-lg bg-destructive/10">
        <p className="font-semibold">Error loading tasks:</p>
        <p>{error}</p>
        <Button onClick={fetchTasks} className="mt-2" variant="danger">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">Tasks</h1>
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'primary' : 'outline'}
            onClick={() => setFilter('all')}
          >
            All Tasks
          </Button>
          <Button
            variant={filter === 'todo' ? 'primary' : 'outline'}
            onClick={() => setFilter('todo')}
          >
            Todo
          </Button>
          <Button
            variant={filter === 'waiting_on_reply' ? 'primary' : 'outline'}
            onClick={() => setFilter('waiting_on_reply')}
          >
            Waiting
          </Button>
          <Button onClick={fetchTasks}>Refresh</Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(groupedTasks).map(([status, statusTasks]) => (
          <div key={status} className="space-y-3">
            <h2 className="font-semibold text-lg text-foreground flex items-center justify-between">
              {status}
              <span className="text-sm text-muted-foreground">({statusTasks.length})</span>
            </h2>
            <div className="space-y-2">
              {statusTasks.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground border-2 border-dashed border-border rounded-lg">
                  No tasks
                </div>
              ) : (
                statusTasks.map((task) => (
                  <Card key={task.id} className="p-4 hover:shadow-lg transition-shadow cursor-pointer">
                    <div className="space-y-3">
                      {/* Task Header */}
                      <div className="flex items-start justify-between">
                        <span className="text-2xl" title={task.task_type}>
                          {getTaskTypeIcon(task.task_type)}
                        </span>
                        {getPriorityBadge(task.priority)}
                      </div>

                      {/* Task Title */}
                      <h3 className="font-medium text-foreground line-clamp-2">
                        {task.title}
                      </h3>

                      {/* Task Meta */}
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>From: {task.sender}</div>
                        <div>{new Date(task.received_at).toLocaleDateString()}</div>
                        {task.due_at && (
                          <div className="text-orange-600">
                            Due: {new Date(task.due_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>

                      {/* Task Snippet */}
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {task.snippet}
                      </p>

                      {/* Task Actions */}
                      <div className="flex flex-wrap gap-1 pt-2">
                        {task.state === 'todo' && (
                          <>
                            <Button
                              
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/tasks/${task.id}`);
                              }}
                            >
                              Open
                            </Button>
                            <Button
                              
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateTaskState(String(task.id), 'in_progress');
                              }}
                            >
                              Start
                            </Button>
                          </>
                        )}
                        {task.state === 'in_progress' && (
                          <>
                            <Button
                              
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/tasks/${task.id}`);
                              }}
                            >
                              Continue
                            </Button>
                            <Button
                              
                              variant="success"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateTaskState(String(task.id), 'done');
                              }}
                            >
                              Complete
                            </Button>
                          </>
                        )}
                        {task.state === 'waiting_on_reply' && (
                          <Button
                            
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/tasks/${task.id}`);
                            }}
                          >
                            View
                          </Button>
                        )}
                        {task.has_attachments && (
                          <span className="text-xs text-orange-600">📎</span>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-foreground">{tasks.length}</div>
          <div className="text-sm text-muted-foreground">Total Tasks</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">
            {tasks.filter(t => t.state === 'todo').length}
          </div>
          <div className="text-sm text-muted-foreground">To Do</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">
            {tasks.filter(t => t.state === 'in_progress').length}
          </div>
          <div className="text-sm text-muted-foreground">In Progress</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {tasks.filter(t => t.state === 'done').length}
          </div>
          <div className="text-sm text-muted-foreground">Completed</div>
        </Card>
      </div>
    </div>
  );
};

export default TaskList;