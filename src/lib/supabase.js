/**
 * Supabase Client Wrapper - Modern database layer replacement
 * Replaces complex PostgreSQL + Redis setup with Supabase
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.supabase' });

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:8000';
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Public client for frontend
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: { 'x-application-name': 'apple-mail-task-manager' }
  }
});

// Admin client for backend operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Supabase Database Operations Wrapper
 * Provides high-level methods for all database operations
 */
class SupabaseDB {
  constructor() {
    this.client = supabase;
    this.admin = supabaseAdmin;
  }

  // ===================
  // PROFILES
  // ===================
  async getProfile(userId) {
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error && error.code !== 'PGRST116') throw error; // Ignore not found
    return data;
  }

  async createProfile(profileData) {
    const { data, error } = await this.client
      .from('profiles')
      .insert(profileData)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateProfile(userId, updates) {
    const { data, error } = await this.client
      .from('profiles')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // ===================
  // EMAILS
  // ===================
  async getEmails(userId, filters = {}) {
    let query = this.client
      .from('emails')
      .select('*')
      .eq('user_id', userId)
      .order('date_received', { ascending: false });

    // Apply filters
    if (filters.folder) query = query.eq('folder', filters.folder);
    if (filters.isRead !== undefined) query = query.eq('is_read', filters.isRead);
    if (filters.isFlagged !== undefined) query = query.eq('is_flagged', filters.isFlagged);
    if (filters.sender) query = query.ilike('sender', `%${filters.sender}%`);
    if (filters.subject) query = query.ilike('subject', `%${filters.subject}%`);
    if (filters.dateFrom) query = query.gte('date_received', filters.dateFrom);
    if (filters.dateTo) query = query.lte('date_received', filters.dateTo);
    if (filters.limit) query = query.limit(filters.limit);
    if (filters.offset) query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async getEmailById(id, userId) {
    const { data, error } = await this.client
      .from('emails')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    if (error) throw error;
    return data;
  }

  async createEmail(emailData) {
    const { data, error } = await this.client
      .from('emails')
      .insert(emailData)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateEmail(id, updates, userId) {
    const { data, error } = await this.client
      .from('emails')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deleteEmail(id, userId) {
    const { error } = await this.client
      .from('emails')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
    return true;
  }

  async searchEmails(userId, searchTerm, filters = {}) {
    let query = this.client
      .from('emails')
      .select('*')
      .eq('user_id', userId);

    // Full-text search across subject, content, and sender
    if (searchTerm) {
      query = query.or(`subject.ilike.%${searchTerm}%, content.ilike.%${searchTerm}%, sender.ilike.%${searchTerm}%`);
    }

    // Apply additional filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    });

    query = query
      .order('date_received', { ascending: false })
      .limit(filters.limit || 100);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  // ===================
  // TASKS
  // ===================
  async getTasks(userId, filters = {}) {
    let query = this.client
      .from('tasks')
      .select('*, email:emails(subject, sender)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.priority) query = query.eq('priority', filters.priority);
    if (filters.assignee) query = query.eq('assignee', filters.assignee);
    if (filters.dueDateFrom) query = query.gte('due_date', filters.dueDateFrom);
    if (filters.dueDateTo) query = query.lte('due_date', filters.dueDateTo);
    if (filters.tags && filters.tags.length) query = query.contains('tags', filters.tags);
    if (filters.limit) query = query.limit(filters.limit);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async getTaskById(id, userId) {
    const { data, error } = await this.client
      .from('tasks')
      .select('*, email:emails(subject, sender, content)')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    if (error) throw error;
    return data;
  }

  async createTask(taskData) {
    const { data, error } = await this.client
      .from('tasks')
      .insert(taskData)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateTask(id, updates, userId) {
    // Handle completion timestamp
    if (updates.status === 'completed' && !updates.completed_at) {
      updates.completed_at = new Date().toISOString();
    }

    const { data, error } = await this.client
      .from('tasks')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deleteTask(id, userId) {
    const { error } = await this.client
      .from('tasks')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
    return true;
  }

  // Task analytics
  async getTaskStats(userId, timeframe = '30d') {
    const startDate = new Date();
    if (timeframe === '30d') startDate.setDate(startDate.getDate() - 30);
    else if (timeframe === '7d') startDate.setDate(startDate.getDate() - 7);
    else if (timeframe === '24h') startDate.setHours(startDate.getHours() - 24);

    const { data, error } = await this.client
      .from('tasks')
      .select('status, priority, completed_at, created_at')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString());

    if (error) throw error;

    return {
      total: data.length,
      completed: data.filter(t => t.status === 'completed').length,
      pending: data.filter(t => t.status === 'pending').length,
      in_progress: data.filter(t => t.status === 'in_progress').length,
      by_priority: {
        urgent: data.filter(t => t.priority === 'urgent').length,
        high: data.filter(t => t.priority === 'high').length,
        medium: data.filter(t => t.priority === 'medium').length,
        low: data.filter(t => t.priority === 'low').length
      }
    };
  }

  // ===================
  // CATEGORIES
  // ===================
  async getCategories(userId) {
    const { data, error } = await this.client
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order');
    if (error) throw error;
    return data;
  }

  async createCategory(categoryData) {
    const { data, error } = await this.client
      .from('categories')
      .insert(categoryData)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateCategory(id, updates, userId) {
    const { data, error } = await this.client
      .from('categories')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deleteCategory(id, userId) {
    const { error } = await this.client
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
    return true;
  }

  // ===================
  // DRAFTS
  // ===================
  async getDrafts(userId) {
    const { data, error } = await this.client
      .from('drafts')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async getDraftById(id, userId) {
    const { data, error } = await this.client
      .from('drafts')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    if (error) throw error;
    return data;
  }

  async createDraft(draftData) {
    const { data, error } = await this.client
      .from('drafts')
      .insert(draftData)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateDraft(id, updates, userId) {
    const { data, error } = await this.client
      .from('drafts')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deleteDraft(id, userId) {
    const { error } = await this.client
      .from('drafts')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
    return true;
  }

  // ===================
  // AI INTERACTIONS
  // ===================
  async logAIInteraction(interaction) {
    const { data, error } = await this.client
      .from('ai_interactions')
      .insert(interaction)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getAIUsage(userId, timeframe = '30d') {
    const startDate = new Date();
    if (timeframe === '30d') startDate.setDate(startDate.getDate() - 30);
    else if (timeframe === '7d') startDate.setDate(startDate.getDate() - 7);
    else if (timeframe === '24h') startDate.setHours(startDate.getHours() - 24);

    const { data, error } = await this.client
      .from('ai_interactions')
      .select('tokens_used, cost, created_at, model')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString());
    
    if (error) throw error;
    
    return {
      total_tokens: data.reduce((sum, i) => sum + (i.tokens_used || 0), 0),
      total_cost: data.reduce((sum, i) => sum + (i.cost || 0), 0),
      interactions: data.length,
      models_used: [...new Set(data.map(i => i.model).filter(Boolean))]
    };
  }

  // ===================
  // REAL-TIME SUBSCRIPTIONS
  // ===================
  subscribeToEmails(userId, callback) {
    return this.client
      .channel('emails-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'emails',
          filter: `user_id=eq.${userId}`
        },
        callback
      )
      .subscribe();
  }

  subscribeToTasks(userId, callback) {
    return this.client
      .channel('tasks-changes')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${userId}`
        },
        callback
      )
      .subscribe();
  }

  subscribeToTable(tableName, userId, callback) {
    return this.client
      .channel(`${tableName}-changes`)
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName,
          filter: userId ? `user_id=eq.${userId}` : undefined
        },
        callback
      )
      .subscribe();
  }

  // ===================
  // BATCH OPERATIONS
  // ===================
  async batchCreateEmails(emails) {
    const { data, error } = await this.client
      .from('emails')
      .insert(emails)
      .select();
    if (error) throw error;
    return data;
  }

  async batchUpdateTasks(updates) {
    const results = await Promise.all(
      updates.map(({ id, data, userId }) => 
        this.updateTask(id, data, userId)
      )
    );
    return results;
  }

  // ===================
  // HEALTH & UTILITIES
  // ===================
  async healthCheck() {
    try {
      const { data, error } = await this.client
        .from('profiles')
        .select('count')
        .limit(1);
      return { healthy: !error, timestamp: new Date().toISOString() };
    } catch (error) {
      return { healthy: false, error: error.message, timestamp: new Date().toISOString() };
    }
  }

  async cleanup() {
    await this.client.removeAllChannels();
  }

  // Migration helper - execute raw SQL for complex migrations
  async executeSQL(sql, params = []) {
    const { data, error } = await this.admin.rpc('execute_sql', {
      query: sql,
      params
    });
    if (error) throw error;
    return data;
  }
}

// Export singleton instance and clients
const db = new SupabaseDB();

module.exports = {
  supabase,
  supabaseAdmin,
  db,
  SupabaseDB
};