// Test Supabase real-time subscriptions
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testRealtimeSubscription() {
    console.log('Testing Supabase real-time subscription...');
    
    // Subscribe to changes in tasks table
    const subscription = supabase
        .channel('tasks-changes')
        .on('postgres_changes', 
            { 
                event: '*', 
                schema: 'public', 
                table: 'tasks' 
            }, 
            (payload) => {
                console.log('📦 Real-time update received:', payload);
            }
        )
        .subscribe((status) => {
            console.log('Subscription status:', status);
            if (status === 'SUBSCRIBED') {
                console.log('✅ Real-time subscription active!');
                console.log('Listening for changes to the tasks table...');
                
                // Test by inserting a sample task after 2 seconds
                setTimeout(async () => {
                    try {
                        console.log('🚀 Inserting test task...');
                        const { data, error } = await supabase
                            .from('tasks')
                            .insert([
                                {
                                    title: 'Test Task from Real-time Test',
                                    description: 'Testing real-time functionality',
                                    status: 'pending',
                                    priority: 'medium',
                                    created_at: new Date().toISOString()
                                }
                            ])
                            .select();
                            
                        if (error) {
                            console.error('Error inserting test task:', error);
                        } else {
                            console.log('✅ Test task inserted:', data);
                        }
                    } catch (err) {
                        console.error('Failed to insert test task:', err);
                    }
                }, 2000);
                
                // Close after 5 seconds
                setTimeout(() => {
                    console.log('🔌 Closing subscription...');
                    subscription.unsubscribe();
                    process.exit(0);
                }, 5000);
            }
        });
}

testRealtimeSubscription();