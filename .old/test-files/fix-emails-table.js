const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkJXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
);

async function fixEmailsTable() {
  try {
    // Test if column exists by trying to select it
    const { data, error } = await supabase
      .from('emails')
      .select('id, ai_processed')
      .limit(1);
    
    if (error && error.code === '42703') {
      console.log('❌ ai_processed column is missing');
      console.log('ℹ️  To fix this, run this SQL in your Supabase dashboard:');
      console.log('\nALTER TABLE emails ADD COLUMN IF NOT EXISTS ai_processed BOOLEAN DEFAULT false;');
      console.log('\nOr you can add it via the Supabase Studio UI');
    } else if (!error) {
      console.log('✅ ai_processed column already exists');
      
      // Update any null values to false
      const { error: updateError } = await supabase
        .from('emails')
        .update({ ai_processed: false })
        .is('ai_processed', null);
      
      if (!updateError) {
        console.log('✅ Updated null ai_processed values to false');
      }
    }
    
    // Check email count
    const { count } = await supabase
      .from('emails')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 Total emails in database: ${count}`);
    
  } catch (err) {
    console.error('Error:', err.message);
  }
  
  process.exit(0);
}

fixEmailsTable();