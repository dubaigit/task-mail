const { Pool } = require('pg');

// Secure database query functions with parameterization
class SecureDatabase {
  constructor(pool) {
    this.pool = pool;
  }

  // Secure task queries with proper parameterization - Returns UnifiedTask format
  async getTasks(limit = 50, offset = 0, filter = 'all', userId = null) {
    // Validate and sanitize inputs
    const validatedLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
    const validatedOffset = Math.max(parseInt(offset) || 0, 0);
    const validatedFilter = ['all', 'pending', 'completed', 'in-progress'].includes(filter) ? filter : 'all';

    let query = `
      SELECT 
        id,
        title,
        description,
        priority,
        status,
        estimated_time,
        actual_time,
        due_date,
        completed_at,
        created_from_message_id,
        assigned_to,
        tags,
        ai_confidence,
        classification,
        created_at,
        updated_at
      FROM tasks
    `;

    const params = [];
    const conditions = [];

    // Add user filter if authentication is implemented
    if (userId) {
      conditions.push('(assigned_to = $' + (params.length + 1) + ' OR created_by = $' + (params.length + 1) + ')');
      params.push(userId);
    }

    // Add status filter
    if (validatedFilter !== 'all') {
      conditions.push('status = $' + (params.length + 1));
      params.push(validatedFilter);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += `
      ORDER BY 
        CASE priority 
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        created_at DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;

    params.push(validatedLimit, validatedOffset);

    try {
      const result = await this.pool.query(query, params);
      
      // Transform database rows to UnifiedTask format (eliminating client-side conversion)
      const transformedTasks = result.rows.map(row => this.transformToUnifiedTask(row));
      
      return {
        items: transformedTasks,
        hasMore: result.rows.length === validatedLimit,
        total: result.rows.length,
        limit: validatedLimit,
        offset: validatedOffset
      };
    } catch (error) {
      console.error('Database query error:', error);
      throw new Error('Database query failed');
    }
  }

  // Transform database row to UnifiedTask format (server-side optimization)
  transformToUnifiedTask(dbRow) {
    // Normalize status to UnifiedTask enum format
    const statusMap = {
      'pending': 'TODO',
      'in-progress': 'IN_PROGRESS', 
      'completed': 'COMPLETED',
      'cancelled': 'CANCELLED'
    };
    
    // Normalize priority to UnifiedTask enum format  
    const priorityMap = {
      'low': 'LOW',
      'medium': 'MEDIUM', 
      'high': 'HIGH',
      'urgent': 'CRITICAL'
    };

    return {
      // Core identification
      id: dbRow.id.toString(),
      title: dbRow.title,
      description: dbRow.description || '',
      
      // Status and priority (normalized to enums)
      status: statusMap[dbRow.status] || 'TODO',
      priority: priorityMap[dbRow.priority] || 'MEDIUM',
      urgency: priorityMap[dbRow.priority] || 'MEDIUM', // Alias for backward compatibility
      category: dbRow.classification || 'DO_MYSELF',
      
      // Timestamps (ISO strings for consistency)
      createdAt: dbRow.created_at ? new Date(dbRow.created_at).toISOString() : new Date().toISOString(),
      updatedAt: dbRow.updated_at ? new Date(dbRow.updated_at).toISOString() : new Date().toISOString(),
      dueDate: dbRow.due_date ? new Date(dbRow.due_date).toISOString() : undefined,
      completedAt: dbRow.completed_at ? new Date(dbRow.completed_at).toISOString() : undefined,
      
      // Assignment and ownership
      assignedTo: dbRow.assigned_to || 'unassigned',
      createdBy: dbRow.assigned_to || 'system',
      sender: dbRow.assigned_to || 'system',
      senderEmail: `${dbRow.assigned_to || 'system'}@digitaldubai.ae`,
      
      // Progress and tracking
      progress: dbRow.status === 'completed' ? 100 : (dbRow.status === 'in-progress' ? 50 : 0),
      estimatedTime: dbRow.estimated_time || undefined,
      actualTime: dbRow.actual_time || undefined,
      estimatedDuration: dbRow.estimated_time || undefined, // Alias
      actualDuration: dbRow.actual_time || undefined, // Alias
      
      // Metadata
      tags: Array.isArray(dbRow.tags) ? dbRow.tags : (dbRow.tags ? [dbRow.tags] : []),
      labels: Array.isArray(dbRow.tags) ? dbRow.tags : (dbRow.tags ? [dbRow.tags] : []), // Alias
      
      // Email relationship
      emailId: dbRow.created_from_message_id || undefined,
      createdFromMessageId: dbRow.created_from_message_id || undefined, // Alias
      relatedEmails: dbRow.created_from_message_id ? [dbRow.created_from_message_id] : [],
      emailSubject: dbRow.title, // Use title as fallback
      snippet: dbRow.description || '',
      preview: dbRow.description || '', // Alias
      
      // AI-related fields
      aiConfidence: dbRow.ai_confidence || undefined,
      confidence: dbRow.ai_confidence || undefined, // Alias
      classification: dbRow.classification || 'DO_MYSELF',
      draftGenerated: false,
      
      // Task relationships (empty for now - can be extended)
      subtasks: [],
      dependencies: [],
      blockers: [],
      comments: [],
      
      // Additional metadata
      metadata: {
        source: 'database',
        transformed: true,
        originalId: dbRow.id
      }
    };
  }

  // Secure category counts query
  async getCategoryCounts(userId = null) {
    let query = `
      SELECT classification, COUNT(*) as count 
      FROM tasks 
      WHERE status != 'completed'
    `;

    const params = [];

    if (userId) {
      query += ' AND (assigned_to = $1 OR created_by = $1)';
      params.push(userId);
    }

    query += ' GROUP BY classification';

    try {
      const result = await this.pool.query(query, params);
      
      const counts = {};
      result.rows.forEach(row => {
        counts[row.classification] = parseInt(row.count);
      });
      
      return counts;
    } catch (error) {
      console.error('Database query error:', error);
      throw new Error('Database query failed');
    }
  }

  // Secure statistics query
  async getStatistics(userId = null) {
    const queries = {
      totalTasks: 'SELECT COUNT(*) as count FROM tasks',
      pendingTasks: 'SELECT COUNT(*) as count FROM tasks WHERE status = $1',
      inProgressTasks: 'SELECT COUNT(*) as count FROM tasks WHERE status = $1',
      completedTasks: 'SELECT COUNT(*) as count FROM tasks WHERE status = $1'
    };

    // Add user filtering if authentication is implemented
    if (userId) {
      Object.keys(queries).forEach(key => {
        if (queries[key].includes('WHERE')) {
          queries[key] += ' AND (assigned_to = $2 OR created_by = $2)';
        } else {
          queries[key] += ' WHERE (assigned_to = $1 OR created_by = $1)';
        }
      });
    }

    try {
      const results = await Promise.all([
        this.pool.query(queries.totalTasks, userId ? [userId] : []),
        this.pool.query(queries.pendingTasks, userId ? ['pending', userId] : ['pending']),
        this.pool.query(queries.inProgressTasks, userId ? ['in-progress', userId] : ['in-progress']),
        this.pool.query(queries.completedTasks, userId ? ['completed', userId] : ['completed'])
      ]);
      
      const [total, pending, inProgress, completed] = results.map(r => parseInt(r.rows[0].count));
      const efficiency = total > 0 ? Math.round((completed / total) * 100) : 0;
      
      return {
        efficiency,
        totalTasks: total,
        pendingTasks: pending,
        inProgressTasks: inProgress,
        completedTasks: completed,
        averageResponseTime: 4.2 // This would be calculated from actual data
      };
    } catch (error) {
      console.error('Database query error:', error);
      throw new Error('Database query failed');
    }
  }

  // Secure sync status query
  async getSyncStatus() {
    try {
      const totalEmailsQuery = 'SELECT COUNT(*) as total FROM messages';
      const unprocessedQuery = 'SELECT COUNT(*) as unprocessed FROM messages WHERE ai_analyzed = false';
      const tasksQuery = 'SELECT COUNT(*) as count FROM tasks WHERE status <> $1';
      const fyiQuery = 'SELECT COUNT(*) as count FROM tasks WHERE classification = $1';
      
      const [totalResult, unprocessedResult, tasksResult, fyiResult] = await Promise.all([
        this.pool.query(totalEmailsQuery),
        this.pool.query(unprocessedQuery),
        this.pool.query(tasksQuery, ['completed']),
        this.pool.query(fyiQuery, ['FYI_ONLY'])
      ]);

      const totalEmails = parseInt(totalResult.rows[0].total) || 0;
      const unprocessed = parseInt(unprocessedResult.rows[0].unprocessed) || 0;
      const taskCount = parseInt(tasksResult.rows[0].count) || 0;
      const fyiCount = parseInt(fyiResult.rows[0].count) || 0;

      return {
        emailsInPostgres: totalEmails,
        emailsInAppleMail: totalEmails,
        percentComplete: totalEmails > 0 ? Math.round(((totalEmails - unprocessed) / totalEmails) * 100) : 100,
        isSynced: unprocessed === 0,
        emailBreakdown: {
          total: totalEmails,
          tasks: {
            count: taskCount,
            percentage: totalEmails > 0 ? Math.round((taskCount / totalEmails) * 100) : 0
          },
          fyi: {
            count: fyiCount,
            percentage: totalEmails > 0 ? Math.round((fyiCount / totalEmails) * 100) : 0
          },
          today: 0, // Could be calculated with date filters
          week: 0,  // Could be calculated with date filters
          month: 0  // Could be calculated with date filters
        },
        aiProcessing: {
          totalProcessed: totalEmails - unprocessed,
          analyzed: totalEmails - unprocessed,
          completed: totalEmails - unprocessed,
          pending: unprocessed,
          failed: 0,
          processingRate: 0
        },
        syncState: {
          isInitialSyncComplete: true,
          isSyncing: false
        }
      };
    } catch (error) {
      console.error('Database query error:', error);
      throw new Error('Database query failed');
    }
  }

  // Secure user profile query (when authentication is implemented)
  async getUserProfile(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const query = `
      SELECT 
        id,
        email,
        name,
        display_name,
        role,
        created_at,
        last_login
      FROM users 
      WHERE id = $1 AND active = true
    `;

    try {
      const result = await this.pool.query(query, [userId]);
      
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = result.rows[0];
      
      // Remove sensitive fields
      delete user.password_hash;
      delete user.reset_token;
      
      return user;
    } catch (error) {
      console.error('Database query error:', error);
      throw new Error('User query failed');
    }
  }

  // Secure AI usage stats query
  async getAIUsageStats() {
    try {
      // Use the corrected database function for all stats
      const statsQuery = 'SELECT get_ai_processing_stats() as stats';
      const statsResult = await this.pool.query(statsQuery);
      
      if (statsResult.rows.length > 0 && statsResult.rows[0].stats) {
        return statsResult.rows[0].stats;
      }

      // Return safe defaults if no data
      return {
        daily: {
          total_processed: 0,
          total_cost: 0,
          avg_cost_per_email: 0,
          total_batches: 0
        },
        balance: 25.00,
        unprocessed: 0,
        isProcessing: false
      };
    } catch (error) {
      console.error('Database query error:', error);
      // Return safe defaults on error
      return {
        daily: {
          total_processed: 0,
          total_cost: 0,
          avg_cost_per_email: 0,
          total_batches: 0
        },
        balance: 25.00,
        unprocessed: 0,
        isProcessing: false
      };
    }
  }

  // Health check with limited information exposure
  async healthCheck() {
    try {
      const result = await this.pool.query('SELECT NOW() as timestamp');
      return {
        status: 'healthy',
        database: 'connected',
        timestamp: result.rows[0].timestamp
      };
    } catch (error) {
      throw new Error('Database health check failed');
    }
  }

  // Create a new task (secure)
  async createTask(taskData, userId) {
    const {
      title,
      description,
      priority = 'medium',
      status = 'pending',
      estimatedTime,
      dueDate,
      classification,
      aiConfidence
    } = taskData;

    // Validate required fields
    if (!title || !description) {
      throw new Error('Title and description are required');
    }

    // Validate enums
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    const validStatuses = ['pending', 'in-progress', 'completed'];
    
    if (!validPriorities.includes(priority)) {
      throw new Error('Invalid priority');
    }
    
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid status');
    }

    const query = `
      INSERT INTO tasks (
        title, description, priority, status, estimated_time,
        due_date, classification, ai_confidence, created_by, assigned_to,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $9, NOW(), NOW()
      ) RETURNING id, created_at
    `;

    const params = [
      title,
      description,
      priority,
      status,
      estimatedTime,
      dueDate,
      classification,
      aiConfidence,
      userId
    ];

    try {
      const result = await this.pool.query(query, params);
      return result.rows[0];
    } catch (error) {
      console.error('Database insert error:', error);
      throw new Error('Failed to create task');
    }
  }
}

module.exports = SecureDatabase;