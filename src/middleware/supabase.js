/**
 * Supabase Middleware
 * Adds Supabase client to request object
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Middleware to add Supabase client to request object
 */
const addSupabaseToRequest = (req, res, next) => {
  req.supabase = supabase;
  next();
};

module.exports = {
  addSupabaseToRequest,
  supabase
};

