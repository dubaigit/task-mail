import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  Clock, 
  User, 
  Mail, 
  AlertCircle,
  Plus,
  Filter,
  Search,
  Calendar,
  Flag,
  ExternalLink
} from 'lucide-react';
import axios from 'axios';

interface TaskData {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: string;
  due_date?: string;
  created_from_email?: string;
  assignee?: string;
}

const TaskView: React.FC = () => {
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBy, setFilterBy] = useState('all');

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await axios.get('/api/tasks');
      setTasks(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setLoading(false);
    }
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    try {
      await axios.put(`/api/tasks/${taskId}/status`, { status });
      setTasks(prev => prev.map(task => 
        task.id === taskId ? { ...task, status: status as any } : task
      ));
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'critical':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'high':
        return <Flag className="h-4 w-4 text-orange-500" />;
      case 'medium':
        return <Flag className="h-4 w-4 text-yellow-500" />;
      case 'low':
        return <Flag className="h-4 w-4 text-green-500" />;
      default:
        return <Flag className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const badgeClasses = "px-2 py-1 text-xs font-medium rounded-full";
    
    switch (status) {
      case 'pending':
        return <span className={`${badgeClasses} bg-yellow-100 text-yellow-800`}>Pending</span>;
      case 'in_progress':
        return <span className={`${badgeClasses} bg-blue-100 text-blue-800`}>In Progress</span>;
      case 'completed':
        return <span className={`${badgeClasses} bg-green-100 text-green-800`}>Completed</span>;
      case 'cancelled':
        return <span className={`${badgeClasses} bg-gray-100 text-gray-800`}>Cancelled</span>;
      default:
        return <span className={`${badgeClasses} bg-gray-100 text-gray-800`}>{status}</span>;
    }
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = !searchQuery || 
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = filterBy === 'all' || 
      (filterBy === 'pending' && task.status === 'pending') ||
      (filterBy === 'in_progress' && task.status === 'in_progress') ||
      (filterBy === 'completed' && task.status === 'completed') ||
      (filterBy === 'from_email' && task.created_from_email);

    return matchesSearch && matchesFilter;
  });

  const taskStats = {
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    from_email: tasks.filter(t => t.created_from_email).length
  };

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100 mr-4">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{taskStats.pending}</p>
              <p className="text-sm text-gray-600">Pending Tasks</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 mr-4">
              <CheckSquare className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{taskStats.in_progress}</p>
              <p className="text-sm text-gray-600">In Progress</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 mr-4">
              <CheckSquare className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{taskStats.completed}</p>
              <p className="text-sm text-gray-600">Completed</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100 mr-4">
              <Mail className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{taskStats.from_email}</p>
              <p className="text-sm text-gray-600">From Emails</p>
            </div>
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <CheckSquare className="h-5 w-5 text-gray-500" />
              <h2 className="text-xl font-semibold text-gray-900">Tasks</h2>
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                {filteredTasks.length} tasks
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>New Task</span>
              </button>
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
                placeholder="Search tasks..."
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
              <option value="all">All tasks</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="from_email">From Email</option>
            </select>
          </div>
        </div>

        {/* Task List */}
        <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
          {filteredTasks.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <CheckSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No tasks found matching your criteria.</p>
            </div>
          ) : (
            filteredTasks.map((task) => (
              <div
                key={task.id}
                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                  selectedTask?.id === task.id ? 'bg-blue-50' : ''
                }`}
                onClick={() => setSelectedTask(task)}
              >
                <div className="flex items-start space-x-3">
                  {/* Task Checkbox */}
                  <div className="flex items-center pt-1">
                    <input
                      type="checkbox"
                      checked={task.status === 'completed'}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateTaskStatus(task.id, e.target.checked ? 'completed' : 'pending');
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </div>

                  {/* Task Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <h3 className={`text-sm font-medium ${
                          task.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'
                        }`}>
                          {task.title}
                        </h3>
                        {task.created_from_email && (
                          <Mail className="h-4 w-4 text-purple-500" />
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {getPriorityIcon(task.priority)}
                        {getStatusBadge(task.status)}
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 mb-2">
                      {task.description}
                    </p>

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center space-x-4">
                        {task.assignee && (
                          <div className="flex items-center space-x-1">
                            <User className="h-3 w-3" />
                            <span>{task.assignee}</span>
                          </div>
                        )}
                        {task.due_date && (
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3" />
                            <span>{new Date(task.due_date).toLocaleDateString()}</span>
                          </div>
                        )}
                        <span className="capitalize">
                          Priority: {task.priority}
                        </span>
                      </div>

                      {task.created_from_email && (
                        <button 
                          className="flex items-center space-x-1 text-blue-600 hover:text-blue-800"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Navigate to email or show email details
                            console.log('View related email:', task.created_from_email);
                          }}
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>View Email</span>
                        </button>
                      )}
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center space-x-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {task.status === 'pending' && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            updateTaskStatus(task.id, 'in_progress');
                          }}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                        >
                          Start
                        </button>
                      )}
                      {task.status === 'in_progress' && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            updateTaskStatus(task.id, 'completed');
                          }}
                          className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200"
                        >
                          Complete
                        </button>
                      )}
                      <button className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded hover:bg-gray-200">
                        Edit
                      </button>
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
            <span>Showing {filteredTasks.length} of {tasks.length} tasks</span>
            <div className="flex items-center space-x-2">
              <span>Auto-generated from emails</span>
              <div className="h-2 w-2 bg-purple-500 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskView;