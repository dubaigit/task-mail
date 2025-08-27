const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const { v4: uuidv4 } = require('uuid');

class AIEmailProcessor {
    constructor() {
        // Initialize Supabase client
        this.supabase = createClient(
            process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
        );

        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        this.isProcessing = false;
        this.batchSize = 10; // Process 10 emails at once for cost optimization
        this.processingInterval = 5000; // 5 second intervals
        this.maxRetries = 3;
        
        // Cost per token for GPT-4 (adjust based on actual model)
        this.costPerInputToken = 0.00003; // $0.03 per 1K tokens
        this.costPerOutputToken = 0.00006; // $0.06 per 1K tokens
    }

    async start() {
        console.log('🤖 AI Email Processor starting...');
        this.processLoop();
    }

    async processLoop() {
        if (this.isProcessing) return;
        
        try {
            this.isProcessing = true;
            await this.processBatch();
        } catch (error) {
            console.error('❌ Processing error:', error);
        } finally {
            this.isProcessing = false;
            setTimeout(() => this.processLoop(), this.processingInterval);
        }
    }

    async processBatch() {
        try {
            // Get unanalyzed emails from Supabase
            const { data: emails, error } = await this.supabase
                .from('emails')
                .select('*')
                .eq('ai_processed', false)
                .limit(this.batchSize);

            if (error) {
                console.error('❌ Failed to fetch emails:', error);
                return;
            }

            if (!emails || emails.length === 0) {
                return; // No emails to process
            }

            const batchId = uuidv4();
            
            console.log(`📧 Processing batch of ${emails.length} emails (Batch ID: ${batchId})`);

            // Process emails in bulk for cost optimization
            const analysisResults = await this.analyzeEmailsBulk(emails, batchId);

            // Save analysis results
            await this.saveAnalysisResults(analysisResults, batchId);

            console.log(`✅ Batch ${batchId} completed successfully`);

        } catch (error) {
            console.error('❌ Batch processing error:', error);
        }
    }

    async analyzeEmailsBulk(emails, batchId) {
        const systemPrompt = `You are an advanced email analysis system. Analyze the following emails and provide structured insights including:
- Classification (DO_MYSELF, DELEGATE_TO_SOMEONE, WAITING_FROM_SOMEONE, READ_AND_ARCHIVE)
- Priority level (critical/urgent/high/medium/low)
- Category (work/personal/promotional/automated)
- Sentiment (positive/negative/neutral)
- Key topics and keywords
- Urgency assessment
- Suggested task title and description if actionable
- Confidence score (0-100)

Respond with a JSON array where each object corresponds to an email in the same order.`;

        const emailPrompts = emails.map((email, index) => 
            `Email ${index + 1}:
Subject: ${email.subject || 'No subject'}
From: ${email.sender || 'Unknown'}
Body: ${(email.body_text || email.snippet || 'No body content').substring(0, 1000)}
---`
        ).join('\n\n');

        try {
            const completion = await this.openai.chat.completions.create({
                model: process.env.OPENAI_MODEL || "gpt-4",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: emailPrompts }
                ],
                temperature: 0.3,
                max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 2000
            });

            const usage = completion.usage;
            const totalCost = this.calculateCost(usage.prompt_tokens, usage.completion_tokens);

            // Parse AI response
            let analysisResults;
            try {
                analysisResults = JSON.parse(completion.choices[0].message.content);
            } catch (parseError) {
                console.error('❌ Failed to parse AI response:', parseError);
                // Fallback: create default analysis for each email
                analysisResults = emails.map(() => ({
                    classification: 'READ_AND_ARCHIVE',
                    priority: 'medium',
                    category: 'general',
                    sentiment: 'neutral',
                    topics: [],
                    urgency: 'MEDIUM',
                    task_title: null,
                    task_description: null,
                    confidence: 50
                }));
            }

            // Combine emails with their analysis and usage data
            return emails.map((email, index) => ({
                email,
                analysis: analysisResults[index] || {
                    classification: 'READ_AND_ARCHIVE',
                    priority: 'medium',
                    category: 'general',
                    sentiment: 'neutral',
                    topics: [],
                    urgency: 'MEDIUM',
                    task_title: null,
                    task_description: null,
                    confidence: 50
                },
                usage: {
                    batchId,
                    promptTokens: Math.floor(usage.prompt_tokens / emails.length),
                    completionTokens: Math.floor(usage.completion_tokens / emails.length),
                    totalTokens: Math.floor(usage.total_tokens / emails.length),
                    cost: totalCost / emails.length,
                    batchSize: emails.length,
                    model: process.env.OPENAI_MODEL || 'gpt-4'
                }
            }));

        } catch (error) {
            console.error('❌ OpenAI API error:', error);
            
            // Return default analysis for all emails
            return emails.map(email => ({
                email,
                analysis: {
                    classification: 'READ_AND_ARCHIVE',
                    priority: 'medium',
                    category: 'general',
                    sentiment: 'neutral',
                    topics: [],
                    urgency: 'MEDIUM',
                    task_title: null,
                    task_description: null,
                    confidence: 0,
                    error: error.message
                },
                usage: {
                    batchId,
                    promptTokens: 0,
                    completionTokens: 0,
                    totalTokens: 0,
                    cost: 0,
                    batchSize: emails.length,
                    model: process.env.OPENAI_MODEL || 'gpt-4'
                }
            }));
        }
    }

    async saveAnalysisResults(results, batchId) {
        for (const result of results) {
            const { email, analysis, usage } = result;

            try {
                // Update email with AI processing flag
                const { error: updateError } = await this.supabase
                    .from('emails')
                    .update({ 
                        ai_processed: true,
                        ai_processed_at: new Date().toISOString()
                    })
                    .eq('id', email.id);

                if (updateError) {
                    console.error(`❌ Failed to update email ${email.id}:`, updateError);
                    continue;
                }

                // Save AI analysis
                const { error: analysisError } = await this.supabase
                    .from('ai_analysis')
                    .insert({
                        message_id: email.id,
                        classification: analysis.classification,
                        urgency: analysis.urgency,
                        confidence: analysis.confidence || 50,
                        suggested_action: analysis.task_title ? 'CREATE_TASK' : 'ARCHIVE',
                        task_title: analysis.task_title,
                        task_description: analysis.task_description,
                        tags: analysis.topics || [],
                        model_used: usage.model,
                        model_version: '1.0',
                        processing_time: 1000, // milliseconds
                        tokens_used: usage.totalTokens,
                        cost_usd: usage.cost,
                        batch_id: batchId,
                        processing_status: 'completed'
                    });

                if (analysisError) {
                    console.error(`❌ Failed to save analysis for email ${email.id}:`, analysisError);
                    continue;
                }

                // Create task if actionable
                if (analysis.task_title && analysis.confidence > 60) {
                    const { error: taskError } = await this.supabase
                        .from('tasks')
                        .insert({
                            title: analysis.task_title,
                            description: analysis.task_description,
                            priority: analysis.priority,
                            status: 'pending',
                            category: analysis.classification,
                            urgency: analysis.urgency,
                            created_from_message_id: email.id,
                            ai_confidence: analysis.confidence,
                            classification: analysis.classification,
                            tags: analysis.topics || []
                        });

                    if (taskError) {
                        console.error(`❌ Failed to create task for email ${email.id}:`, taskError);
                    }
                }

                // Update AI usage stats
                await this.updateUsageStats(usage);

            } catch (error) {
                console.error(`❌ Failed to save analysis for email ${email.id}:`, error);
            }
        }
    }

    async updateUsageStats(usage) {
        const today = new Date().toISOString().split('T')[0];
        
        try {
            // Get existing stats for today
            const { data: existing, error: fetchError } = await this.supabase
                .from('ai_usage_stats')
                .select('*')
                .eq('date_processed', today)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = not found
                console.error('❌ Failed to fetch usage stats:', fetchError);
                return;
            }

            if (existing) {
                // Update existing record
                const { error: updateError } = await this.supabase
                    .from('ai_usage_stats')
                    .update({
                        total_processed: existing.total_processed + 1,
                        total_cost: existing.total_cost + usage.cost,
                        total_tokens: existing.total_tokens + usage.totalTokens,
                        total_batches: existing.total_batches + (1 / usage.batchSize),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);

                if (updateError) {
                    console.error('❌ Failed to update usage stats:', updateError);
                }
            } else {
                // Create new record for today
                const { error: insertError } = await this.supabase
                    .from('ai_usage_stats')
                    .insert({
                        date_processed: today,
                        total_processed: 1,
                        total_cost: usage.cost,
                        total_tokens: usage.totalTokens,
                        total_batches: 1 / usage.batchSize,
                        model_usage: { [usage.model]: 1 }
                    });

                if (insertError) {
                    console.error('❌ Failed to insert usage stats:', insertError);
                }
            }
        } catch (error) {
            console.error('❌ Failed to update usage stats:', error);
        }
    }

    calculateCost(promptTokens, completionTokens) {
        return (promptTokens * this.costPerInputToken) + (completionTokens * this.costPerOutputToken);
    }

    async getProcessingStats() {
        try {
            const today = new Date().toISOString().split('T')[0];
            
            // Get today's stats
            const { data: dailyStats, error: statsError } = await this.supabase
                .from('ai_usage_stats')
                .select('*')
                .eq('date_processed', today)
                .single();

            // Get unprocessed count
            const { count: unprocessedCount, error: countError } = await this.supabase
                .from('emails')
                .select('*', { count: 'exact', head: true })
                .eq('ai_processed', false);

            // Get total processed count
            const { count: processedCount, error: processedError } = await this.supabase
                .from('emails')
                .select('*', { count: 'exact', head: true })
                .eq('ai_processed', true);

            return {
                daily: dailyStats || {
                    total_processed: 0,
                    total_cost: 0,
                    total_tokens: 0,
                    total_batches: 0
                },
                unprocessed: unprocessedCount || 0,
                processed: processedCount || 0,
                isProcessing: this.isProcessing
            };
        } catch (error) {
            console.error('❌ Failed to get processing stats:', error);
            return {
                daily: {
                    total_processed: 0,
                    total_cost: 0,
                    total_tokens: 0,
                    total_batches: 0
                },
                unprocessed: 0,
                processed: 0,
                isProcessing: this.isProcessing
            };
        }
    }

    async stop() {
        console.log('🛑 AI Email Processor stopping...');
        this.isProcessing = false;
    }
}

module.exports = AIEmailProcessor;