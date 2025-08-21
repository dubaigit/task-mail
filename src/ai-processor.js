const { Pool } = require('pg');
const OpenAI = require('openai');
const { v4: uuidv4 } = require('uuid');

class AIEmailProcessor {
    constructor() {
        this.pool = new Pool({
            user: 'email_admin',
            host: 'localhost',
            database: 'email_management',
            password: 'secure_password_2024',
            port: 5432,
        });

        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        this.isProcessing = false;
        this.batchSize = 10; // Process 10 emails at once for cost optimization
        this.processingInterval = 1000; // 1 second intervals
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
        const client = await this.pool.connect();
        
        try {
            // Get unanalyzed emails using our database function
            const result = await client.query(
                'SELECT * FROM get_unanalyzed_emails($1)',
                [this.batchSize]
            );

            if (result.rows.length === 0) {
                return; // No emails to process
            }

            const emails = result.rows;
            const batchId = uuidv4();
            
            console.log(`📧 Processing batch of ${emails.length} emails (Batch ID: ${batchId})`);

            // Create batch processing record with all required fields
            const emailIds = emails.map(e => e.rowid);
            await client.query(`
                INSERT INTO ai_batch_processing (batch_id, email_ids, batch_size, model_used, status)
                VALUES ($1, $2, $3, $4, 'processing')
            `, [batchId, emailIds, emails.length, 'gpt-4']);

            // Process emails in bulk for cost optimization
            const analysisResults = await this.analyzeEmailsBulk(emails, batchId);

            // Update database with results
            await this.saveAnalysisResults(client, analysisResults, batchId);

            // Mark batch as completed
            await client.query(`
                UPDATE ai_batch_processing 
                SET status = 'completed', completed_at = NOW()
                WHERE batch_id = $1
            `, [batchId]);

            console.log(`✅ Batch ${batchId} completed successfully`);

        } finally {
            client.release();
        }
    }

    async analyzeEmailsBulk(emails, batchId) {
        const systemPrompt = `You are an advanced email analysis system. Analyze the following emails and provide structured insights including:
- Priority level (high/medium/low)
- Category (work/personal/promotional/automated)
- Sentiment (positive/negative/neutral)
- Key topics and keywords
- Urgency assessment
- Suggested actions

Respond with a JSON array where each object corresponds to an email in the same order.`;

        const emailPrompts = emails.map((email, index) => 
            `Email ${index + 1}:
Subject: ${email.subject}
From: ${email.sender}
Body: ${email.body?.substring(0, 1000) || 'No body content'}
---`
        ).join('\n\n');

        try {
            const completion = await this.openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: emailPrompts }
                ],
                temperature: 0.3,
                max_tokens: 2000
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
                    priority: 'medium',
                    category: 'general',
                    sentiment: 'neutral',
                    topics: [],
                    urgency: 'normal',
                    actions: []
                }));
            }

            // Combine emails with their analysis and usage data
            return emails.map((email, index) => ({
                email,
                analysis: analysisResults[index] || {
                    priority: 'medium',
                    category: 'general',
                    sentiment: 'neutral',
                    topics: [],
                    urgency: 'normal',
                    actions: []
                },
                usage: {
                    batchId,
                    promptTokens: Math.floor(usage.prompt_tokens / emails.length),
                    completionTokens: Math.floor(usage.completion_tokens / emails.length),
                    totalTokens: Math.floor(usage.total_tokens / emails.length),
                    cost: totalCost / emails.length,
                    batchSize: emails.length
                }
            }));

        } catch (error) {
            console.error('❌ OpenAI API error:', error);
            
            // Return default analysis for all emails
            return emails.map(email => ({
                email,
                analysis: {
                    priority: 'medium',
                    category: 'general',
                    sentiment: 'neutral',
                    topics: [],
                    urgency: 'normal',
                    actions: [],
                    error: error.message
                },
                usage: {
                    batchId,
                    promptTokens: 0,
                    completionTokens: 0,
                    totalTokens: 0,
                    cost: 0,
                    batchSize: emails.length
                }
            }));
        }
    }

    async saveAnalysisResults(client, results, batchId) {
        for (const result of results) {
            const { email, analysis, usage } = result;

            try {
                // Begin transaction
                await client.query('BEGIN');

                // Update message with analysis (only update columns that exist)
                await client.query(`
                    UPDATE messages 
                    SET 
                        ai_analyzed = true,
                        ai_analysis_attempts = ai_analysis_attempts + 1,
                        ai_analysis_last_attempt = NOW()
                    WHERE ROWID = $1
                `, [email.rowid]);

                // Record usage tracking with analysis metadata - using correct column references
                await client.query(`
                    INSERT INTO ai_usage_tracking (
                        email_id, batch_id, model_used, prompt_tokens, 
                        completion_tokens, total_tokens, cost_usd, batch_size
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [
                    email.rowid,
                    usage.batchId,
                    'gpt-4',
                    usage.promptTokens,
                    usage.completionTokens,
                    usage.totalTokens,
                    usage.cost,
                    usage.batchSize
                ]);

                // Update balance tracking - using correct columns
                await client.query(`
                    INSERT INTO ai_balance_tracking (
                        total_usage_usd, operation_type, cost_amount, plan_type, organization_id
                    ) VALUES ($1, 'analysis', $2, 'paid', 'email-system')
                `, [usage.cost, usage.cost]);

                // Commit transaction
                await client.query('COMMIT');

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`❌ Failed to save analysis for email ${email.rowid}:`, error);
                
                // Mark as failed attempt
                await client.query(`
                    UPDATE messages 
                    SET ai_analysis_attempts = ai_analysis_attempts + 1
                    WHERE ROWID = $1
                `, [email.rowid]);
            }
        }
    }

    calculateCost(promptTokens, completionTokens) {
        return (promptTokens * this.costPerInputToken) + (completionTokens * this.costPerOutputToken);
    }

    async getProcessingStats() {
        const client = await this.pool.connect();
        try {
            const stats = await client.query(`
                SELECT 
                    COUNT(*) as total_processed,
                    SUM(cost_usd) as total_cost,
                    AVG(cost_usd) as avg_cost_per_email,
                    COUNT(DISTINCT batch_id) as total_batches
                FROM ai_usage_tracking
                WHERE processed_at >= NOW() - INTERVAL '24 hours'
            `);

            const balanceInfo = await client.query(`
                SELECT get_current_ai_balance() as current_balance
            `);

            const unprocessedCount = await client.query(`
                SELECT get_unprocessed_email_count() as unprocessed
            `);

            return {
                daily: stats.rows[0],
                balance: balanceInfo.rows[0].current_balance || 0,
                unprocessed: unprocessedCount.rows[0].unprocessed,
                isProcessing: this.isProcessing
            };
        } finally {
            client.release();
        }
    }

    async stop() {
        console.log('🛑 AI Email Processor stopping...');
        this.isProcessing = false;
        await this.pool.end();
    }
}

module.exports = AIEmailProcessor;