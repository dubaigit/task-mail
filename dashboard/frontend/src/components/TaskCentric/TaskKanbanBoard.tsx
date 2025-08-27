import React, { useState, useEffect, useCallback } from 'react';
import { Icons } from '../ui/icons';
import { 
  TaskCentricEmail, 
  TaskUrgencyLevel, 
  KanbanTask, 
  KanbanTaskItem, 
  KanbanTaskStatus
} from './types';
import { TaskPriority } from '../../types/core';
import {
  AlertTriangle as ExclamationTriangleIcon,
  CheckCircle as CheckCircleIcon,
  Bell as BellIcon,
  Users as UsersIcon,
  MessageSquare as ChatBubbleLeftRightIcon,
  CalendarDays as CalendarDaysIcon,
  User as UserIcon,
  CheckCircle as CheckCircleSolid,
  AlertTriangle as ExclamationTriangleSolid
} from 'lucide-react';


interface ColleagueInfo {
  email: string;
  name: string;
  initials: string;
  status: 'replied' | 'pending' | 'overdue';
  lastResponse?: string;
  avatar?: string;
}

// Colleague detection utilities
const extractColleaguesFromEmail = (email: TaskCentricEmail): ColleagueInfo[] => {
  const colleagues: ColleagueInfo[] = [];
  
  // Extract from sender
  if (email.senderEmail) {
    const senderAddr = email.senderEmail.toLowerCase();
    const name = email.sender || senderAddr.split('@')[0].replace(/[._]/g, ' ');
    colleagues.push({
      email: senderAddr,
      name: name,
      initials: getInitials(name),
      status: getColleagueStatus(senderAddr, email),
      lastResponse: undefined
    });
  }
  
  // Extract from recipient if available
  if (email.recipient) {
    const recipientAddr = email.recipient.toLowerCase();
    const name = recipientAddr.split('@')[0].replace(/[._]/g, ' ');
    colleagues.push({
      email: recipientAddr,
      name: name,
      initials: getInitials(name),
      status: getColleagueStatus(recipientAddr, email),
      lastResponse: undefined
    });
  }

  return colleagues.filter((colleague, index, self) => 
    index === self.findIndex(c => c.email === colleague.email)
  ).slice(0, 3); // Limit to 3 colleagues for UI space
};

const getInitials = (name: string): string => {
  if (!name) return '?';
  return name
    .split(' ')
    .map(part => part.charAt(0).toUpperCase())
    .join('')
    .substring(0, 2);
};

const getColleagueStatus = (email: string, emailData: TaskCentricEmail): 'replied' | 'pending' | 'overdue' => {
  // Mock logic - in real implementation, this would check response history
  const daysSinceReceived = Math.floor(
    (new Date().getTime() - new Date(emailData.date).getTime()) / (1000 * 60 * 60 * 24)
  );
  
  if (daysSinceReceived > 3) return 'overdue';
  if (emailData.classification === 'NEEDS_REPLY') return 'pending';
  return 'replied';
};

const isTaskOverdue = (dueDate?: string): boolean => {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
};

interface TaskCardProps {
  task: KanbanTask;
  onTaskUpdate: (taskId: string, updates: Partial<KanbanTask>) => void;
  onEmailView: (email: TaskCentricEmail) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onTaskUpdate, onEmailView }) => {
  const colleagues = extractColleaguesFromEmail(task.email);
  const isOverdue = isTaskOverdue(task.dueDate);
  
  const getPriorityColor = (priority: TaskUrgencyLevel) => {
    const baseColors: Record<TaskPriority, string> = {
      [TaskPriority.CRITICAL]: 'border-red-500 bg-red-50 dark:bg-red-950/30',
      [TaskPriority.URGENT]: 'border-red-500 bg-red-50 dark:bg-red-950/30',
      [TaskPriority.HIGH]: 'border-orange-500 bg-orange-50 dark:bg-orange-950/30',
      [TaskPriority.MEDIUM]: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30',
      [TaskPriority.LOW]: 'border-green-500 bg-green-50 dark:bg-green-950/30'
    };
    
    // Add overdue styling overlay
    if (isOverdue) {
      return `${baseColors[priority] || 'border-gray-300 bg-gray-50 dark:bg-gray-950/30'} ring-2 ring-red-400 ring-opacity-50`;
    }
    
    return baseColors[priority] || 'border-gray-300 bg-gray-50 dark:bg-gray-950/30';
  };

  const getPriorityIcon = (priority: TaskUrgencyLevel) => {
    switch (priority) {
      case TaskPriority.CRITICAL:
      case 'URGENT':
        return <ExclamationTriangleIcon className="w-4 h-4 text-red-600" />;
      case 'HIGH':
        return <ExclamationTriangleIcon className="w-4 h-4 text-orange-600" />;
      case 'MEDIUM':
        return <Icons.clock className="w-4 h-4 text-yellow-600" />;
      case 'LOW':
        return <Icons.checkCircle className="w-4 h-4 text-green-600" />;
      default:
        return <Icons.clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getColleagueStatusIcon = (status: 'replied' | 'pending' | 'overdue') => {
    switch (status) {
      case 'replied':
        return <CheckCircleSolid className="w-3 h-3 text-green-600" aria-label="Replied" />;
      case 'pending':
        return <Icons.clock className="w-3 h-3 text-yellow-600" aria-label="Pending response" />;
      case 'overdue':
        return <ExclamationTriangleSolid className="w-3 h-3 text-red-600" aria-label="Overdue" />;
      default:
        return <Icons.clock className="w-3 h-3 text-gray-600" aria-label="Unknown status" />;
    }
  };

  const getColleagueStatusColor = (status: 'replied' | 'pending' | 'overdue') => {
    switch (status) {
      case 'replied':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200';
      case 'overdue':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const ColleagueAvatar: React.FC<{ colleague: ColleagueInfo; index: number }> = ({ colleague, index }) => (
    <div 
      className={`relative inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium border ${getColleagueStatusColor(colleague.status)} ${index > 0 ? '-ml-1' : ''}`}
      title={`${colleague.name} (${colleague.email}) - ${colleague.status}`}
      aria-label={`Colleague ${colleague.name}, status: ${colleague.status}`}
    >
      <span className="text-xs font-semibold">{colleague.initials}</span>
      <div className="absolute -top-1 -right-1">
        {getColleagueStatusIcon(colleague.status)}
      </div>
    </div>
  );

  return (
    <div 
      className={`task-card p-4 rounded-lg border-l-4 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer ${getPriorityColor(task.priority)}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      {/* Task Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {getPriorityIcon(task.priority)}
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {task.priority}
          </span>
          {isOverdue && (
            <div className="flex items-center gap-1 text-xs text-red-600 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded-full">
              <Icons.clock className="w-3 h-3" aria-label="Overdue task" />
              <span>Overdue</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {Math.round(task.confidenceScore * 100)}% confidence
          </span>
          {colleagues.length > 0 && (
            <div className="flex items-center gap-1" aria-label="Task colleagues">
              <BellIcon className="w-3 h-3 text-muted-foreground" aria-label="Notifications" />
              <span className="text-xs text-muted-foreground">{colleagues.length}</span>
            </div>
          )}
        </div>
      </div>

      {/* Task Title */}
      <h4 className="font-semibold text-sm mb-2 line-clamp-2 text-foreground">
        {task.title}
      </h4>

      {/* Task Description */}
      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
        {task.description}
      </p>

      {/* Email Context */}
      <div className="bg-background/50 rounded-md p-2 mb-3 border">
        <div className="flex items-center gap-2 mb-1">
          <Icons.mail className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">From: {task.email.sender}</span>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-1">
          {task.email.subject}
        </p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEmailView(task.email);
          }}
          className="text-xs text-primary hover:text-primary/80 mt-1"
        >
          View full email →
        </button>
      </div>

      {/* Colleague Tracking Section */}
      {colleagues.length > 0 && (
        <div className="bg-background/50 rounded-md p-2 mb-3 border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1">
              <UsersIcon className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">Colleagues</span>
            </div>
            <div className="flex items-center gap-1">
              <ChatBubbleLeftRightIcon className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {colleagues.filter(c => c.status === 'replied').length}/{colleagues.length} replied
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-1 mb-2">
            {colleagues.map((colleague, index) => (
              <ColleagueAvatar key={colleague.email} colleague={colleague} index={index} />
            ))}
            {colleagues.length === 3 && (
              <span className="text-xs text-muted-foreground ml-1">+more</span>
            )}
          </div>
          
          {/* Response Status Summary */}
          <div className="flex items-center gap-2 text-xs">
            {colleagues.some(c => c.status === 'overdue') && (
              <div className="flex items-center gap-1 text-red-600">
                <ExclamationTriangleSolid className="w-3 h-3" />
                <span>{colleagues.filter(c => c.status === 'overdue').length} overdue</span>
              </div>
            )}
            {colleagues.some(c => c.status === 'pending') && (
              <div className="flex items-center gap-1 text-yellow-600">
                <Icons.clock className="w-3 h-3" />
                <span>{colleagues.filter(c => c.status === 'pending').length} pending</span>
              </div>
            )}
            {colleagues.some(c => c.status === 'replied') && (
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircleSolid className="w-3 h-3" />
                <span>{colleagues.filter(c => c.status === 'replied').length} replied</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Task Meta */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <CalendarDaysIcon className="w-3 h-3" />
          <span>{formatDate(task.email.date)}</span>
          {task.dueDate && (
            <>
              <span className="mx-1">•</span>
              <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                Due: {formatDate(task.dueDate)}
              </span>
            </>
          )}
        </div>
        {task.assignee && (
          <div className="flex items-center gap-1">
            <UserIcon className="w-3 h-3" />
            <span>{task.assignee}</span>
          </div>
        )}
      </div>

      {/* Task Tags */}
      {task.email.tags && task.email.tags.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border">
          <p className="text-xs font-medium text-foreground mb-1">Tags:</p>
          <div className="flex flex-wrap gap-1">
            {task.email.tags?.slice(0, 3).map((tag: string, index: number) => (
              <span key={index} className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface KanbanColumnProps {
  title: string;
  status: KanbanTaskStatus;
  tasks: KanbanTaskItem[];
  onTaskUpdate: (taskId: string, updates: Partial<KanbanTaskItem>) => void;
  onEmailView: (email: TaskCentricEmail) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ 
  title, 
  status, 
  tasks, 
  onTaskUpdate, 
  onEmailView 
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const taskId = e.dataTransfer.getData('text/plain');
    onTaskUpdate(taskId, { status });
  };

  const getColumnColor = (status: KanbanTaskStatus) => {
    switch (status) {
      case 'TODO':
        return 'border-sky-400 bg-sky-100 dark:border-sky-600 dark:bg-sky-900/40';
      case 'IN_PROGRESS':
        return 'border-amber-400 bg-amber-100 dark:border-amber-600 dark:bg-amber-900/40';
      case 'WAITING_FOR_REPLY':
        return 'border-violet-400 bg-violet-100 dark:border-violet-600 dark:bg-violet-900/40';
      case 'DONE':
        return 'border-emerald-400 bg-emerald-100 dark:border-emerald-600 dark:bg-emerald-900/40';
      default:
        return 'border-gray-300 bg-gray-100 dark:border-gray-700 dark:bg-gray-900/40';
    }
  };

  return (
    <div className={`kanban-column flex-1 min-w-0`}>
      {/* Column Header */}
      <div className={`column-header p-4 rounded-t-lg border-2 ${getColumnColor(status)}`}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <span className="text-sm text-muted-foreground bg-background px-2 py-1 rounded-full">
            {tasks.length}
          </span>
        </div>
      </div>

      {/* Column Content */}
      <div 
        className={`column-content min-h-[600px] p-2 border-2 border-t-0 rounded-b-lg transition-all duration-200 ${
          getColumnColor(status)
        } ${isDragOver ? 'border-primary border-dashed bg-primary/10' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onTaskUpdate={onTaskUpdate}
              onEmailView={onEmailView}
            />
          ))}
          
          {tasks.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarDaysIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No tasks in this column</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface TaskKanbanBoardProps {
  emails: TaskCentricEmail[];
  onEmailView: (email: TaskCentricEmail) => void;
  onTaskCreate?: (email: TaskCentricEmail) => void;
}

export const TaskKanbanBoard: React.FC<TaskKanbanBoardProps> = ({ 
  emails, 
  onEmailView,
  onTaskCreate 
}) => {
  const [tasks, setTasks] = useState<KanbanTask[]>([]);

  // Convert emails to tasks based on classification
  const convertEmailsToTasks = useCallback((emails: TaskCentricEmail[]) => {
    const taskList: KanbanTask[] = [];
    
    emails.forEach((email) => {
      // Only create tasks for actionable emails
      if (email.classification === 'FYI_ONLY') return;
      
      const task: KanbanTask = {
        id: `task-${email.id}`,
        title: getTaskTitle(email),
        description: getTaskDescription(email),
        status: getTaskStatus(email.classification),
        urgency: email.urgency,
        priority: email.urgency, // Alias
        assignee: email.assignedTo?.[0], // Alias
        email: email,
        confidence: email.confidence,
        confidenceScore: email.confidence, // Alias
        progress: 0,
        tags: email.tags || [],
        createdAt: email.date
      };
      
      taskList.push(task);
    });
    
    return taskList;
  }, []);

  const getTaskTitle = (email: TaskCentricEmail): string => {
    // Extract actionable title from email subject
    const subject = email.subject;
    
    if (email.classification === 'NEEDS_REPLY') {
      return `Reply to: ${subject}`;
    } else if (email.classification === 'APPROVAL_REQUIRED') {
      return `Approve: ${subject}`;
    } else if (email.classification === 'CREATE_TASK') {
      return `Task: ${subject}`;
    } else {
      return subject;
    }
  };

  const getTaskDescription = (email: TaskCentricEmail): string => {
    return email.preview || email.content?.substring(0, 150) || `Email from ${email.sender}`;
  };

  const getTaskStatus = (classification: string): KanbanTaskStatus => {
    switch (classification) {
      case 'NEEDS_REPLY':
      case 'CREATE_TASK':
        return 'TODO';
      case 'APPROVAL_REQUIRED':
        return 'WAITING_FOR_REPLY';
      default:
        return 'TODO';
    }
  };

  const handleTaskUpdate = useCallback((taskId: string, updates: Partial<KanbanTaskItem>) => {
    setTasks(prevTasks => 
      prevTasks.map(task => 
        task.id === String(taskId) ? { ...task, ...updates } : task
      )
    );
  }, []);

  // Convert emails to tasks when emails change
  useEffect(() => {
    const convertedTasks = convertEmailsToTasks(emails);
    setTasks(convertedTasks);
  }, [emails, convertEmailsToTasks]);

  // Group tasks by status
  const tasksByStatus = {
    TODO: tasks.filter(t => t.status === 'TODO'),
    IN_PROGRESS: tasks.filter(t => t.status === 'IN_PROGRESS'),
    WAITING_FOR_REPLY: tasks.filter(t => t.status === 'WAITING_FOR_REPLY'),
    DONE: tasks.filter(t => t.status === 'DONE')
  };

  return (
    <div className="task-kanban-board h-full flex flex-col">
      {/* Board Header */}
      <div className="board-header p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Task Board</h2>
            <p className="text-sm text-muted-foreground">
              {tasks.length} active tasks from {emails.length} emails
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-2 h-2 bg-blue-500 rounded-full" />
            <span>AI-Generated Tasks</span>
          </div>
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="board-content flex-1 p-4 overflow-x-auto">
        <div className="flex gap-4 min-w-max">
          <KanbanColumn
            title="To Do"
            status="TODO"
            tasks={tasksByStatus.TODO}
            onTaskUpdate={handleTaskUpdate}
            onEmailView={onEmailView}
          />
          <KanbanColumn
            title="In Progress"
            status="IN_PROGRESS"
            tasks={tasksByStatus.IN_PROGRESS}
            onTaskUpdate={handleTaskUpdate}
            onEmailView={onEmailView}
          />
          <KanbanColumn
            title="Waiting for Reply"
            status="WAITING_FOR_REPLY"
            tasks={tasksByStatus.WAITING_FOR_REPLY}
            onTaskUpdate={handleTaskUpdate}
            onEmailView={onEmailView}
          />
          <KanbanColumn
            title="Done"
            status="DONE"
            tasks={tasksByStatus.DONE}
            onTaskUpdate={handleTaskUpdate}
            onEmailView={onEmailView}
          />
        </div>
      </div>
    </div>
  );
};

export default TaskKanbanBoard;
