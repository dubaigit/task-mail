// Test Supabase connection from Node.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
    try {
        console.log('Testing Supabase connection...');
        
        // Test basic connection
        const { data, error } = await supabase
            .from('emails')
            .select('id, subject, sender')
            .limit(5);
            
        if (error) {
            console.error('Error querying emails:', error);
            return;
        }
        
        console.log('✅ Successfully connected to Supabase!');
        console.log(`Found ${data.length} email records (showing first 5)`);
        console.log('Sample emails:', data);
        
        // Test tasks table
        const { data: tasks, error: taskError } = await supabase
            .from('tasks')
            .select('*')
            .limit(5);
            
        if (taskError) {
            console.error('Error querying tasks:', taskError);
        } else {
            console.log(`Found ${tasks.length} task records`);
        }
        
    } catch (err) {
        console.error('Connection test failed:', err.message);
    }
}

testConnection();