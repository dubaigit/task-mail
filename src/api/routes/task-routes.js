/**
 * Task management API routes
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../../middleware/auth');
const logger = require('../../utils/logger');

// ============================================================================
// TASK ROUTES
// ============================================================================

/**
 * GET /api/tasks
 * Get all tasks with filtering and pagination
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      status, 
      priority, 
      assignedTo, 
      tags, 
      dueDateFrom, 
      dueDateTo,
      search,
      dateRange = 'all'
    } = req.query;
    
    const offset = (page - 1) * limit;

    // Build base query
    let query = req.supabase
      .from('tasks')
      .select(`
        *,
        emails (
          message_id,
          sender,
          subject,
          snippet
        ),
        users!tasks_assigned_to_fkey (
          id,
          email,
          first_name,
          last_name
        )
      `)
      .order('created_at', { ascending: false });

    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      let startDate;
      
      switch (dateRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }
      
      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
    }

    // Apply filters
    if (status) query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);
    if (assignedTo) query = query.eq('assigned_to', assignedTo);
    if (dueDateFrom) query = query.gte('due_date', dueDateFrom);
    if (dueDateTo) query = query.lte('due_date', dueDateTo);
    
    // Search in title and description
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Get total count
    const { count } = await req.supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true });

    // Get paginated results
    const { data: tasks, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      logger.error('Failed to fetch tasks:', error);
      return res.status(500).json({ error: 'Failed to fetch tasks' });
    }

    res.json({
      tasks: tasks || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    logger.error('Task fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/tasks/:id
 * Get task by ID with full details
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: task, error } = await req.supabase
      .from('tasks')
      .select(`
        *,
        emails (
          message_id,
          sender,
          subject,
          snippet,
          date_received
        ),
        users!tasks_assigned_to_fkey (
          id,
          email,
          first_name,
          last_name
        ),
        users!tasks_created_by_fkey (
          id,
          email,
          first_name,
          last_name
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Task not found' });
      }
      logger.error('Failed to fetch task:', error);
      return res.status(500).json({ error: 'Failed to fetch task' });
    }

    res.json({ task });

  } catch (error) {
    logger.error('Task fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/tasks
 * Create new task
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { 
      title, 
      description, 
      priority, 
      status, 
      dueDate, 
      tags, 
      assignedTo, 
      emailId 
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const taskData = {
      title,
      description: description || '',
      priority: priority || 'medium',
      status: status || 'pending',
      due_date: dueDate,
      tags: tags || [],
      assigned_to: assignedTo,
      email_id: emailId,
      created_by: req.user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: task, error } = await req.supabase
      .from('tasks')
      .insert([taskData])
      .select()
      .single();

    if (error) {
      logger.error('Failed to create task:', error);
      return res.status(500).json({ error: 'Failed to create task' });
    }

    logger.info(`Task created: ${title} by user ${req.user.email}`);
    res.status(201).json({ task });

  } catch (error) {
    logger.error('Task creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/tasks/:id
 * Update task
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Add updated timestamp
    updates.updated_at = new Date().toISOString();

    const { data: task, error } = await req.supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update task:', error);
      return res.status(500).json({ error: 'Failed to update task' });
    }

    logger.info(`Task updated: ${task.title} by user ${req.user.email}`);
    res.json({ task });

  } catch (error) {
    logger.error('Task update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/tasks/:id
 * Delete task
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get task details for logging
    const { data: task } = await req.supabase
      .from('tasks')
      .select('title')
      .eq('id', id)
      .single();

    const { error } = await req.supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Failed to delete task:', error);
      return res.status(500).json({ error: 'Failed to delete task' });
    }

    logger.info(`Task deleted: ${task?.title || id} by user ${req.user.email}`);
    res.json({ message: 'Task deleted successfully' });

  } catch (error) {
    logger.error('Task deletion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/tasks/:id/status
 * Update task status
 */
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const { data: task, error } = await req.supabase
      .from('tasks')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update task status:', error);
      return res.status(500).json({ error: 'Failed to update task status' });
    }

    logger.info(`Task status updated: ${task.title} -> ${status} by user ${req.user.email}`);
    res.json({ task });

  } catch (error) {
    logger.error('Task status update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/tasks/:id/assign
 * Assign task to user
 */
router.put('/:id/assign', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;

    if (!assignedTo) {
      return res.status(400).json({ error: 'Assigned user ID is required' });
    }

    // Verify user exists
    const { data: user, error: userError } = await req.supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .eq('id', assignedTo)
      .single();

    if (userError || !user) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const { data: task, error } = await req.supabase
      .from('tasks')
      .update({ 
        assigned_to: assignedTo,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Failed to assign task:', error);
      return res.status(500).json({ error: 'Failed to assign task' });
    }

    logger.info(`Task assigned: ${task.title} -> ${user.email} by user ${req.user.email}`);
    res.json({ task, assignedUser: user });

  } catch (error) {
    logger.error('Task assignment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/tasks/:id/priority
 * Update task priority
 */
router.put('/:id/priority', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { priority } = req.body;

    if (!priority) {
      return res.status(400).json({ error: 'Priority is required' });
    }

    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority' });
    }

    const { data: task, error } = await req.supabase
      .from('tasks')
      .update({ 
        priority,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update task priority:', error);
      return res.status(500).json({ error: 'Failed to update task priority' });
    }

    logger.info(`Task priority updated: ${task.title} -> ${priority} by user ${req.user.email}`);
    res.json({ task });

  } catch (error) {
    logger.error('Task priority update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/tasks/bulk-update
 * Bulk update multiple tasks
 */
router.post('/bulk-update', authenticateToken, async (req, res) => {
  try {
    const { taskIds, updates } = req.body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ error: 'Task IDs array is required' });
    }

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Updates object is required' });
    }

    // Add updated timestamp
    updates.updated_at = new Date().toISOString();

    const { data: tasks, error } = await req.supabase
      .from('tasks')
      .update(updates)
      .in('id', taskIds)
      .select();

    if (error) {
      logger.error('Failed to bulk update tasks:', error);
      return res.status(500).json({ error: 'Failed to bulk update tasks' });
    }

    logger.info(`Bulk updated ${tasks.length} tasks by user ${req.user.email}`);
    res.json({ tasks, updatedCount: tasks.length });

  } catch (error) {
    logger.error('Bulk task update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/tasks/stats/overview
 * Get task statistics overview
 */
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    // Get task counts by status
    const { data: statusStats, error: statusError } = await req.supabase
      .from('tasks')
      .select('status')
      .in('status', ['pending', 'in_progress', 'completed', 'cancelled']);

    if (statusError) {
      throw statusError;
    }

    // Get task counts by priority
    const { data: priorityStats, error: priorityError } = await req.supabase
      .from('tasks')
      .select('priority')
      .in('priority', ['low', 'medium', 'high', 'urgent']);

    if (priorityError) {
      throw priorityError;
    }

    // Get overdue tasks count
    const { count: overdueCount, error: overdueError } = await req.supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .lt('due_date', new Date().toISOString())
      .neq('status', 'completed');

    if (overdueError) {
      throw overdueError;
    }

    // Get tasks due today
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

    const { count: dueTodayCount, error: dueTodayError } = await req.supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .gte('due_date', todayStart)
      .lt('due_date', todayEnd)
      .neq('status', 'completed');

    if (dueTodayError) {
      throw dueTodayError;
    }

    // Calculate statistics
    const stats = {
      total: statusStats.length,
      byStatus: {
        pending: statusStats.filter(t => t.status === 'pending').length,
        inProgress: statusStats.filter(t => t.status === 'in_progress').length,
        completed: statusStats.filter(t => t.status === 'completed').length,
        cancelled: statusStats.filter(t => t.status === 'cancelled').length
      },
      byPriority: {
        low: priorityStats.filter(t => t.priority === 'low').length,
        medium: priorityStats.filter(t => t.priority === 'medium').length,
        high: priorityStats.filter(t => t.priority === 'high').length,
        urgent: priorityStats.filter(t => t.priority === 'urgent').length
      },
      overdue: overdueCount || 0,
      dueToday: dueTodayCount || 0,
      completionRate: statusStats.length > 0 
        ? Math.round((statusStats.filter(t => t.status === 'completed').length / statusStats.length) * 100)
        : 0
    };

    res.json({ stats });

  } catch (error) {
    logger.error('Task stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/tasks/my-tasks
 * Get tasks assigned to current user
 */
router.get('/my-tasks', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, status, priority } = req.query;
    const offset = (page - 1) * limit;

    // Build query for user's tasks
    let query = req.supabase
      .from('tasks')
      .select(`
        *,
        emails (
          message_id,
          sender,
          subject,
          snippet
        )
      `)
      .eq('assigned_to', req.user.id)
      .order('due_date', { ascending: true })
      .order('priority', { ascending: false });

    // Apply filters
    if (status) query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);

    // Get total count
    const { count } = await req.supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_to', req.user.id);

    // Get paginated results
    const { data: tasks, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      logger.error('Failed to fetch user tasks:', error);
      return res.status(500).json({ error: 'Failed to fetch tasks' });
    }

    res.json({
      tasks: tasks || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    logger.error('User tasks fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * GET /api/tasks/health
 * Health check for task service
 */
router.get('/health', authenticateToken, async (req, res) => {
  try {
    const health = {
      timestamp: new Date().toISOString(),
      service: 'task-management',
      database: 'connected',
      status: 'healthy'
    };

    res.json(health);

  } catch (error) {
    logger.error('Task health check error:', error);
    res.status(500).json({ 
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
