import React, { useState, useEffect } from 'react';
import { Search, Settings, Filter, MessageSquare, Calendar, CheckCircle, Edit3, Clock, Zap, Users } from 'lucide-react';

interface TaskEmail {
  id: number;
  subject: string;
  sender: string;
  senderAvatar?: string;
  priority: 'high' | 'medium' | 'low';
  aiConfidence: number;
  taskSummary: string;
  timeEstimate: string;
  dueDate?: Date;
  hasDraft: boolean;
  draftPreview?: string;
  classification: string;
  relationships: string[];
}

const PerfectTaskDashboard: React.FC = () => {
  const [filter, setFilter] = useState<'tasks' | 'all' | 'non-tasks'>('tasks');
  const [searchQuery, setSearchQuery] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [selectedTask, setSelectedTask] = useState<number | null>(null);
  const [taskEmails, setTaskEmails] = useState<TaskEmail[]>([]);

  // Mock data - replace with API call
  useEffect(() => {
    const mockTasks: TaskEmail[] = [
      {
        id: 1,
        subject: "Budget proposal review needed",
        sender: "John Smith",
        priority: 'high',
        aiConfidence: 94,
        taskSummary: "Review Q4 budget proposal and provide feedback",
        timeEstimate: "15 min",
        dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000),
        hasDraft: true,
        draftPreview: "Thanks for sending the budget proposal. I'll review it and get back to you with feedback by...",
        classification: "NEEDS_REPLY",
        relationships: ["Finance Team", "Sarah Wilson"]
      },
      {
        id: 2,
        subject: "Project Phoenix timeline update",
        sender: "Sarah Wilson",
        priority: 'medium',
        aiConfidence: 87,
        taskSummary: "Schedule follow-up meeting about Project Phoenix delays",
        timeEstimate: "5 min",
        hasDraft: true,
        draftPreview: "Hi Sarah, I see the timeline has shifted. Let's schedule a quick call to discuss...",
        classification: "CREATE_TASK",
        relationships: ["Dev Team", "John Smith"]
      },
      {
        id: 3,
        subject: "Vendor pricing inquiry",
        sender: "Mike Johnson",
        priority: 'low',
        aiConfidence: 76,
        taskSummary: "Get pricing details from vendor for new equipment",
        timeEstimate: "10 min",
        hasDraft: true,
        draftPreview: "Hi Mike, thanks for reaching out. Could you provide more details about...",
        classification: "INFORMATIONAL",
        relationships: ["Procurement Team"]
      }
    ];
    setTaskEmails(mockTasks);
  }, []);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-400 bg-red-900/20';
      case 'medium': return 'text-yellow-400 bg-yellow-900/20';
      case 'low': return 'text-green-400 bg-green-900/20';
      default: return 'text-gray-400 bg-gray-900/20';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return '🔥';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Process chat command
    console.log('Chat command:', chatMessage);
    setChatMessage('');
  };

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold text-blue-400">🎯 TaskMail</h1>
          
          {/* Filter Dropdown */}
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value as any)}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="tasks">📋 Task Emails ({taskEmails.length})</option>
            <option value="all">📧 All Emails</option>
            <option value="non-tasks">📄 Non-Task Emails</option>
          </select>
        </div>

        {/* Search */}
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search emails, tasks, people..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded-lg pl-10 pr-4 py-2 w-80 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button className="p-2 hover:bg-gray-700 rounded-lg">
            <Settings className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
            JD
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Task List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {taskEmails.map((task) => (
            <div
              key={task.id}
              onClick={() => setSelectedTask(task.id)}
              className={`
                bg-gray-800 border border-gray-700 rounded-lg p-4 cursor-pointer transition-all duration-200
                hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/20
                ${selectedTask === task.id ? 'border-blue-500 shadow-lg shadow-blue-500/20' : ''}
              `}
            >
              {/* Task Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <span className="text-lg">{getPriorityIcon(task.priority)}</span>
                  <div>
                    <h3 className="font-semibold text-white text-sm leading-tight">
                      {task.taskSummary}
                    </h3>
                    <p className="text-gray-400 text-xs mt-1">
                      From: {task.sender} • {task.subject}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                    {task.priority.toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-400">
                    AI: {task.aiConfidence}%
                  </span>
                </div>
              </div>

              {/* Task Details */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 text-xs text-gray-400">
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{task.timeEstimate}</span>
                  </span>
                  {task.dueDate && (
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3" />
                      <span>Due: {task.dueDate.toLocaleDateString()}</span>
                    </span>
                  )}
                  <span className="flex items-center space-x-1">
                    <Users className="w-3 h-3" />
                    <span>{task.relationships.join(', ')}</span>
                  </span>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center space-x-2">
                  {task.hasDraft && (
                    <button className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-medium transition-colors">
                      💬 Draft Ready
                    </button>
                  )}
                  <button className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors">
                    <Edit3 className="w-3 h-3" />
                  </button>
                  <button className="px-3 py-1 bg-green-700 hover:bg-green-600 rounded text-xs transition-colors">
                    <CheckCircle className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Draft Preview (if expanded) */}
              {selectedTask === task.id && task.draftPreview && (
                <div className="mt-4 p-3 bg-gray-900 border border-gray-600 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-blue-400">AI Generated Draft:</span>
                    <button className="text-xs text-gray-400 hover:text-white">Edit in Chat ↓</button>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    {task.draftPreview}
                  </p>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex space-x-2">
                      <button className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-medium">
                        Send Now
                      </button>
                      <button className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs">
                        Schedule
                      </button>
                    </div>
                    <span className="text-xs text-gray-400">Confidence: {task.aiConfidence}%</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Context Sidebar (when task selected) */}
        {selectedTask && (
          <div className="w-80 bg-gray-800 border-l border-gray-700 p-6 overflow-y-auto">
            <h3 className="font-semibold mb-4 text-blue-400">Task Context</h3>
            
            {/* Relationship Map */}
            <div className="mb-6">
              <h4 className="text-sm font-medium mb-2 text-gray-300">People Involved</h4>
              <div className="flex flex-wrap gap-2">
                {['John Smith', 'Sarah Wilson', 'Finance Team'].map((person) => (
                  <div key={person} className="flex items-center space-x-2 bg-gray-700 rounded-full px-3 py-1">
                    <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-xs">
                      {person.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="text-xs">{person}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Email Thread History */}
            <div className="mb-6">
              <h4 className="text-sm font-medium mb-2 text-gray-300">Thread History</h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-xs">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-400">2h ago</span>
                  <span>John sent budget proposal</span>
                </div>
                <div className="flex items-center space-x-2 text-xs">
                  <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                  <span className="text-gray-400">1d ago</span>
                  <span>You requested budget update</span>
                </div>
              </div>
            </div>

            {/* AI Suggestions */}
            <div>
              <h4 className="text-sm font-medium mb-2 text-gray-300">AI Suggestions</h4>
              <div className="space-y-2">
                <div className="bg-gray-700 rounded-lg p-3 text-xs">
                  <div className="flex items-center space-x-2 mb-1">
                    <Zap className="w-3 h-3 text-yellow-400" />
                    <span className="font-medium">Smart Action</span>
                  </div>
                  <p className="text-gray-300">Schedule budget review meeting for next week</p>
                </div>
                <div className="bg-gray-700 rounded-lg p-3 text-xs">
                  <div className="flex items-center space-x-2 mb-1">
                    <MessageSquare className="w-3 h-3 text-blue-400" />
                    <span className="font-medium">Template Match</span>
                  </div>
                  <p className="text-gray-300">Similar to "Budget Review Template #3"</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Universal Chat Interface */}
      <div className="bg-gray-800 border-t border-gray-700 p-4">
        <form onSubmit={handleChatSubmit} className="flex items-center space-x-3">
          <div className="flex-1 relative">
            <MessageSquare className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="💬 Chat: 'Edit John's budget draft to be more formal' or 'Search emails about Phoenix project'"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-10 pr-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            Send
          </button>
          <div className="flex space-x-2">
            <button className="px-3 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs transition-colors">
              🎯 Quick Actions
            </button>
            <button className="px-3 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs transition-colors">
              📝 Templates
            </button>
          </div>
        </form>
        
        {/* Quick Action Suggestions */}
        <div className="flex items-center space-x-2 mt-2">
          <span className="text-xs text-gray-400">Quick:</span>
          {['Reply to all urgent', 'Schedule meetings', 'Mark done: completed tasks', 'Show me: project updates'].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => setChatMessage(suggestion)}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PerfectTaskDashboard;

