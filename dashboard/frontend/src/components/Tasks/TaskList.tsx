import React, { useState, useEffect } from 'react';
import { Icons, ExclamationTriangleIcon, PencilIcon, TrashIcon, UserIcon, CalendarDaysIcon, ArrowPathIcon } from '../ui/icons';
import { Card, Button, Badge, Input, Select, Skeleton, Alert, Tooltip } from '../ui';

interface Task {
  id: number;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'waiting_for_reply' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignee?: string;
  dueDate?: string;
  tags?: string[];
  emailId?: number;
  emailSubject?: string;
  createdAt: string;
  estimatedTime?: string;
  completedAt?: string;
}

interface Column {
  id: string;
  title: string;
  status: Task['status'];
  color: string;
  limit?: number;
}

const TaskList: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [filterStatus, setFilterStatus] = useState<'all' | Task['status']>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | Task['priority']>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTasks, setSelectedTasks] = useState<number[]>([]);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  const columns: Column[] = [
    { id: 'todo', title: 'To Do', status: 'todo', color: 'bg-gray-100 border-gray-300', limit: 10 },
    { id: 'in_progress', title: 'In Progress', status: 'in_progress', color: 'bg-blue-100 border-blue-300', limit: 5 },
    { id: 'waiting_for_reply', title: 'Waiting for Reply', status: 'waiting_for_reply', color: 'bg-orange-100 border-orange-300', limit: 8 },
    { id: 'done', title: 'Done', status: 'done', color: 'bg-green-100 border-green-300' }
  ];

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/tasks');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error('Invalid API response format');
      }
      setTasks(data);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'info';
      default: return 'success';
    }
  };

  const getPriorityIcon = (priority: Task['priority']) => {
    switch (priority) {
      case 'critical':
      case 'high':
        return <ExclamationTriangleIcon className="w-4 h-4" />;
      default:
        return <Icons.checkCircle className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'todo': return 'default';
      case 'in_progress': return 'info';
      case 'waiting_for_reply': return 'warning';
      case 'done': return 'success';
    }
  };

  const handleTaskAction = (taskId: string, action: string) => {
    console.log(`Action ${action} on task ${taskId}`);
    // Implement task actions
  };

  const handleStatusChange = (taskId: string, newStatus: Task['status']) => {
    setTasks(prev => 
      prev.map(task => 
        task.id === Number(taskId) ? { ...task, status: newStatus } : task
      )
    );
  };

  const toggleTaskSelection = (taskId: string) => {
    const taskIdNum = Number(taskId);
    setSelectedTasks(prev => 
      prev.includes(taskIdNum) 
        ? prev.filter(id => id !== taskIdNum)
        : [...prev, taskIdNum]
    );
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         task.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getTasksByStatus = (status: Task['status']) => {
    return filteredTasks.filter(task => task.status === status);
  };

  const handleDragStart = (task: Task) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, status: Task['status']) => {
    e.preventDefault();
    if (draggedTask && draggedTask.status !== status) {
      handleStatusChange(String(draggedTask.id), status);
    }
    setDraggedTask(null);
  };

  const TaskCard = ({ task }: { task: Task }) => (
    <div
      key={task.id}
      className={`cursor-pointer transition-all duration-200 hover:shadow-md group ${
        selectedTasks.includes(task.id) ? 'ring-2 ring-primary/50 bg-primary/5' : ''
      }`}
      draggable
      onDragStart={() => handleDragStart(task)}
    >
      <Card padding="md">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={selectedTasks.includes(task.id)}
              onChange={() => toggleTaskSelection(String(task.id))}
              className="mt-1 rounded border-border text-primary focus:ring-primary"
            />
            <div className="flex-1">
              <h4 className="font-medium text-foreground line-clamp-2">{task.title}</h4>
              {task.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Tooltip content="Edit task">
              <Button
                variant="secondary"
                size="xs"
                onClick={() => handleTaskAction(String(task.id), 'edit')}
              >
                <PencilIcon className="w-3 h-3" />
              </Button>
            </Tooltip>
            <Tooltip content="Delete task">
              <Button
                variant="secondary"
                size="xs"
                onClick={() => handleTaskAction(String(task.id), 'delete')}
              >
                <Icons.trash className="w-3 h-3" />
              </Button>
            </Tooltip>
          </div>
        </div>

        {/* Metadata */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={getPriorityColor(task.priority)} >
            {getPriorityIcon(task.priority)}
            {task.priority.toUpperCase()}
          </Badge>
          
          {task.estimatedTime && (
            <Badge variant="outline" >
              <Icons.clock className="w-3 h-3 mr-1" />
              {task.estimatedTime}
            </Badge>
          )}
          
          {task.tags?.map(tag => (
            <Badge key={tag} variant="secondary" >
              <Icons.tag className="w-3 h-3 mr-1" />
              {tag}
            </Badge>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            {task.assignee && (
              <div className="flex items-center gap-1">
                <UserIcon className="w-3 h-3" />
                <span>{task.assignee}</span>
              </div>
            )}
          </div>
          
          {task.dueDate && (
            <div className="flex items-center gap-1">
              <CalendarDaysIcon className="w-3 h-3" />
              <span>{new Date(task.dueDate).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* Email Link */}
        {task.emailId && (
          <div className="pt-2 border-t border-border">
            <Button
              variant="secondary"
              
              className="w-full justify-start text-xs"
              onClick={() => handleTaskAction(String(task.id), 'view_email')}
            >
              <Icons.eye className="w-3 h-3 mr-1" />
              View related email
            </Button>
          </div>
        )}
      </div>
      </Card>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton height="2.5rem" width="8rem" />
          <Skeleton height="2.25rem" width="6rem" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton height="2rem" width="100%" />
              {[...Array(3)].map((_, j) => (
                <Card key={j} padding="md">
                  <div className="space-y-3">
                    <Skeleton height="1.5rem" width="80%" />
                    <Skeleton height="1rem" width="100%" />
                    <div className="flex gap-2">
                      <Skeleton height="1.25rem" width="3rem" />
                      <Skeleton height="1.25rem" width="4rem" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger" title="Error loading tasks" dismissible>
        <p className="mb-3">{error}</p>
        <Button onClick={fetchTasks} variant="danger" >
          Try Again
        </Button>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tasks</h1>
          <p className="text-muted-foreground mt-1">
            {filteredTasks.length} tasks • {filteredTasks.filter(t => t.status !== 'done').length} active
          </p>
        </div>
        
        <div className="flex gap-3">
          <Button 
            onClick={fetchTasks} 
            variant="outline" 
            leftIcon={<ArrowPathIcon className="w-4 h-4" />}
          >
            Refresh
          </Button>
          <Button 
            variant="primary" 
            leftIcon={<Icons.plus className="w-4 h-4" />}
          >
            New Task
          </Button>
        </div>
      </div>

      {/* Filters and Controls */}
      <Card padding="lg" variant="elevated">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
          <Input
            type="search"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Icons.filter className="w-4 h-4" />}
          />
          
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            options={[
              { value: 'all', label: 'All statuses' },
              { value: 'todo', label: 'To Do' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'waiting_for_reply', label: 'Waiting for Reply' },
              { value: 'done', label: 'Done' }
            ]}
          />

          <Select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as any)}
            options={[
              { value: 'all', label: 'All priorities' },
              { value: 'critical', label: 'Critical' },
              { value: 'high', label: 'High' },
              { value: 'medium', label: 'Medium' },
              { value: 'low', label: 'Low' }
            ]}
          />

          <div className="flex gap-2">
            <Button
              variant={viewMode === 'kanban' ? 'primary' : 'outline'}
              
              onClick={() => setViewMode('kanban')}
            >
              <Icons.grid className="w-4 h-4" />
              Kanban
            </Button>
            <Button
              variant={viewMode === 'list' ? 'primary' : 'outline'}
              
              onClick={() => setViewMode('list')}
            >
              <Icons.list className="w-4 h-4" />
              List
            </Button>
          </div>

          <div className="text-sm text-muted-foreground">
            {selectedTasks.length > 0 && `${selectedTasks.length} selected`}
          </div>
        </div>
      </Card>

      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {columns.map(column => {
            const columnTasks = getTasksByStatus(column.status);
            const isOverLimit = column.limit && columnTasks.length > column.limit;
            
            return (
              <div key={column.id} className="space-y-4">
                {/* Column Header */}
                <div className={`p-4 rounded-lg border-2 border-dashed ${column.color}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">{column.title}</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" >
                        {columnTasks.length}
                        {column.limit && `/${column.limit}`}
                      </Badge>
                      {isOverLimit && (
                        <Tooltip content="Column is over limit">
                          <ExclamationTriangleIcon className="w-4 h-4 text-amber-500" />
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </div>

                {/* Task Cards */}
                <div
                  className={`space-y-3 min-h-[200px] p-2 rounded-lg transition-colors ${
                    draggedTask && draggedTask.status !== column.status
                      ? 'bg-primary/5 border-2 border-dashed border-primary/30'
                      : ''
                  }`}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, column.status)}
                >
                  {columnTasks.map(task => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                  
                  {columnTasks.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <div className="text-sm">No tasks in {column.title.toLowerCase()}</div>
                    </div>
                  )}
                  
                  {/* Add Task Button */}
                  <Button
                    variant="secondary"
                    className="w-full border-2 border-dashed border-border hover:border-primary/50"
                    onClick={() => console.log(`Add task to ${column.status}`)}
                  >
                    <Icons.plus className="w-4 h-4 mr-2" />
                    Add Task
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {filteredTasks.length > 0 ? (
            filteredTasks.map(task => (
              <Card key={task.id} padding="lg" hover>
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={selectedTasks.includes(task.id)}
                    onChange={() => toggleTaskSelection(String(task.id))}
                    className="mt-1 rounded border-border text-primary focus:ring-primary"
                  />
                  
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-foreground">{task.title}</h4>
                        {task.description && (
                          <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusColor(task.status)} >
                          {task.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                        <Badge variant={getPriorityColor(task.priority)} >
                          {task.priority.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-4">
                        {task.assignee && (
                          <div className="flex items-center gap-1">
                            <UserIcon className="w-4 h-4" />
                            <span>{task.assignee}</span>
                          </div>
                        )}
                        
                        {task.estimatedTime && (
                          <div className="flex items-center gap-1">
                            <Icons.clock className="w-4 h-4" />
                            <span>{task.estimatedTime}</span>
                          </div>
                        )}
                        
                        {task.tags && task.tags.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Icons.tag className="w-4 h-4" />
                            <span>{task.tags.join(', ')}</span>
                          </div>
                        )}
                      </div>
                      
                      {task.dueDate && (
                        <div className="flex items-center gap-1">
                          <CalendarDaysIcon className="w-4 h-4" />
                          <span>Due {new Date(task.dueDate).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-1">
                    <Button variant="secondary"  onClick={() => handleTaskAction(String(task.id), 'edit')}>
                      <PencilIcon className="w-4 h-4" />
                    </Button>
                    <Button variant="secondary"  onClick={() => handleTaskAction(String(task.id), 'view')}>
                      <Icons.eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <Card padding="xl" className="text-center">
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto bg-secondary rounded-full flex items-center justify-center">
                  <Icons.checkCircle className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">No tasks found</h3>
                  <p className="text-muted-foreground">
                    {searchQuery || filterStatus !== 'all' || filterPriority !== 'all'
                      ? 'Try adjusting your filters'
                      : 'Create your first task to get started'}
                  </p>
                </div>
                <Button variant="primary" leftIcon={<Icons.plus className="w-4 h-4" />}>
                  Create Task
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default TaskList;
