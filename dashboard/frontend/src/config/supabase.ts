import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

// Create Supabase client for frontend use
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: { 
      'x-application-name': 'apple-mail-task-manager-frontend',
      'x-client-version': '1.0.0'
    }
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Authentication helpers
export const auth = {
  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { data, error };
  },

  signUp: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });
    return { data, error };
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  getCurrentUser: async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
  },

  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    return supabase.auth.onAuthStateChange(callback);
  }
};

// Database helpers
export const db = {
  // Emails
  getEmails: async (filters: any = {}) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    let query = supabase
      .from('emails')
      .select('*')
      .eq('user_id', user.id)
      .order('date_received', { ascending: false });

    // Apply filters
    if (filters.folder) query = query.eq('folder', filters.folder);
    if (filters.is_read !== undefined) query = query.eq('is_read', filters.is_read);
    if (filters.limit) query = query.limit(filters.limit);

    const { data, error } = await query;
    return { data, error };
  },

  // Tasks
  getTasks: async (filters: any = {}) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    let query = supabase
      .from('tasks')
      .select('*, email:emails(subject, sender)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.priority) query = query.eq('priority', filters.priority);
    if (filters.limit) query = query.limit(filters.limit);

    const { data, error } = await query;
    return { data, error };
  },

  // Profile
  getProfile: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    return { data, error };
  },

  // Real-time subscriptions
  subscribeToEmails: (callback: (payload: any) => void) => {
    return supabase
      .channel('emails-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'emails'
      }, callback)
      .subscribe();
  },

  subscribeToTasks: (callback: (payload: any) => void) => {
    return supabase
      .channel('tasks-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tasks'
      }, callback)
      .subscribe();
  }
};

// Connection status helper
export const getConnectionStatus = async () => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);
    
    return { 
      connected: !error, 
      timestamp: new Date().toISOString(),
      error: error?.message 
    };
  } catch (err) {
    return { 
      connected: false, 
      timestamp: new Date().toISOString(),
      error: (err as Error).message 
    };
  }
};

export default supabase;