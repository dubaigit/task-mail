/**
 * Async AI Processing Queue - High-performance background AI processing
 * Implements queue-based AI processing with intelligent load balancing
 */

const EventEmitter = require('events');
const winston = require('winston');
const crypto = require('crypto');
const aiService = require('../../ai_service');

// Enhanced logger for AI processing
const logger = winston.createLogger({
  level: process.env.AI_LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'async-ai-processor' },
  transports: [
    new winston.transports.File({ filename: 'logs/ai-processor-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/ai-processor-combined.log' }),
    ...(process.env.NODE_ENV !== 'production' ? [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    ] : [])
  ],
});

/**
 * AI Job Queue - Priority-based job queue for AI processing tasks
 */
class AIJobQueue {
  constructor() {
    this.queues = {
      high: [],
      medium: [],
      low: []
    };
    
    this.processing = new Map();
    this.completed = new Map();
    this.failed = new Map();
    this.maxJobAge = 24 * 60 * 60 * 1000; // 24 hours
    this.maxCompletedJobs = 1000;
    
    this.stats = {
      totalJobs: 0,
      processedJobs: 0,
      failedJobs: 0,
      averageProcessingTime: 0,
      queueSizes: { high: 0, medium: 0, low: 0 }
    };
    
    this.setupCleanupInterval();
  }

  enqueue(job) {
    const priority = job.priority || 'medium';
    const jobId = crypto.randomUUID();
    
    const queueJob = {
      id: jobId,
      ...job,
      priority,
      createdAt: Date.now(),
      attempts: 0,
      maxAttempts: job.maxAttempts || 3
    };

    this.queues[priority].push(queueJob);
    this.stats.totalJobs++;
    this.updateQueueStats();

    logger.info('AI job queued', {
      jobId,
      type: job.type,
      priority,
      queueSize: this.queues[priority].length
    });

    return jobId;
  }

  dequeue() {
    // Process high priority first, then medium, then low
    for (const priority of ['high', 'medium', 'low']) {
      const queue = this.queues[priority];
      if (queue.length > 0) {
        const job = queue.shift();
        this.processing.set(job.id, {
          ...job,
          startedAt: Date.now()
        });
        
        this.updateQueueStats();
        return job;
      }
    }
    
    return null;
  }

  markCompleted(jobId, result) {
    const job = this.processing.get(jobId);
    if (!job) return false;

    const processingTime = Date.now() - job.startedAt;
    
    this.processing.delete(jobId);
    this.completed.set(jobId, {
      ...job,
      result,
      completedAt: Date.now(),
      processingTime
    });

    this.stats.processedJobs++;
    this.updateAverageProcessingTime(processingTime);
    
    // Cleanup old completed jobs
    if (this.completed.size > this.maxCompletedJobs) {
      const oldestKey = this.completed.keys().next().value;
      this.completed.delete(oldestKey);
    }

    logger.info('AI job completed', {
      jobId,
      type: job.type,
      processingTime: `${processingTime}ms`
    });

    return true;
  }

  markFailed(jobId, error, retry = true) {
    const job = this.processing.get(jobId);
    if (!job) return false;

    job.attempts++;
    const processingTime = Date.now() - job.startedAt;

    this.processing.delete(jobId);

    // Retry if attempts haven't exceeded limit and retry is enabled
    if (retry && job.attempts < job.maxAttempts) {
      // Add exponential backoff delay
      const delay = Math.min(1000 * Math.pow(2, job.attempts - 1), 30000);
      
      setTimeout(() => {
        this.queues[job.priority].push({
          ...job,
          retryDelay: delay
        });
        this.updateQueueStats();
        
        logger.info('AI job requeued for retry', {
          jobId,
          attempt: job.attempts,
          maxAttempts: job.maxAttempts,
          delay: `${delay}ms`
        });
      }, delay);

    } else {
      // Mark as permanently failed
      this.failed.set(jobId, {
        ...job,
        error: error.message,
        failedAt: Date.now(),
        processingTime
      });

      this.stats.failedJobs++;
      
      logger.error('AI job failed permanently', {
        jobId,
        type: job.type,
        attempts: job.attempts,
        error: error.message
      });
    }

    return true;
  }

  updateQueueStats() {
    this.stats.queueSizes = {
      high: this.queues.high.length,
      medium: this.queues.medium.length,
      low: this.queues.low.length
    };
  }

  updateAverageProcessingTime(processingTime) {
    const totalTime = this.stats.averageProcessingTime * (this.stats.processedJobs - 1) + processingTime;
    this.stats.averageProcessingTime = totalTime / this.stats.processedJobs;
  }

  setupCleanupInterval() {
    // Clean up old jobs every hour
    setInterval(() => {
      const now = Date.now();
      
      // Clean completed jobs older than maxJobAge
      for (const [jobId, job] of this.completed.entries()) {
        if (now - job.completedAt > this.maxJobAge) {
          this.completed.delete(jobId);
        }
      }
      
      // Clean failed jobs older than maxJobAge
      for (const [jobId, job] of this.failed.entries()) {
        if (now - job.failedAt > this.maxJobAge) {
          this.failed.delete(jobId);
        }
      }
      
      logger.debug('Job cleanup completed', {
        completedJobs: this.completed.size,
        failedJobs: this.failed.size
      });
    }, 60 * 60 * 1000); // Every hour
  }

  getJob(jobId) {
    return this.processing.get(jobId) || 
           this.completed.get(jobId) || 
           this.failed.get(jobId) ||
           null;
  }

  getStats() {
    return {
      ...this.stats,
      processingJobs: this.processing.size,
      completedJobs: this.completed.size,
      failedJobs: this.failed.size,
      totalQueued: this.stats.queueSizes.high + this.stats.queueSizes.medium + this.stats.queueSizes.low
    };
  }
}

/**
 * AI Worker - Individual worker for processing AI jobs
 */
class AIWorker extends EventEmitter {
  constructor(id, options = {}) {
    super();
    this.id = id;
    this.isRunning = false;
    this.currentJob = null;
    this.processedJobs = 0;
    this.options = {
      maxJobsPerWorker: options.maxJobsPerWorker || 100,
      idleTimeout: options.idleTimeout || 30000, // 30 seconds
      ...options
    };
    
    this.lastActivity = Date.now();
    this.createdAt = Date.now();
  }

  async start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.lastActivity = Date.now();
    
    logger.info('AI worker started', { workerId: this.id });
    this.emit('started', this.id);
  }

  async stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    // Wait for current job to complete
    if (this.currentJob) {
      logger.info('AI worker stopping - waiting for current job', {
        workerId: this.id,
        currentJobId: this.currentJob.id
      });
      
      // Give current job up to 30 seconds to complete
      let waitTime = 0;
      while (this.currentJob && waitTime < 30000) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        waitTime += 1000;
      }
    }
    
    logger.info('AI worker stopped', {
      workerId: this.id,
      processedJobs: this.processedJobs
    });
    
    this.emit('stopped', this.id);
  }

  async processJob(job) {
    if (!this.isRunning) return false;
    
    this.currentJob = job;
    this.lastActivity = Date.now();
    
    logger.debug('AI worker processing job', {
      workerId: this.id,
      jobId: job.id,
      type: job.type
    });

    try {
      let result;
      
      switch (job.type) {
        case 'email_classification':
          result = await this.processEmailClassification(job);
          break;
        case 'draft_generation':
          result = await this.processDraftGeneration(job);
          break;
        case 'chat_response':
          result = await this.processChatResponse(job);
          break;
        case 'batch_analysis':
          result = await this.processBatchAnalysis(job);
          break;
        case 'content_summarization':
          result = await this.processContentSummarization(job);
          break;
        default:
          throw new Error(`Unknown AI job type: ${job.type}`);
      }

      this.processedJobs++;
      this.currentJob = null;
      this.lastActivity = Date.now();
      
      this.emit('job_completed', { job, result });
      
      return result;
      
    } catch (error) {
      this.currentJob = null;
      this.lastActivity = Date.now();
      
      logger.error('AI worker job failed', {
        workerId: this.id,
        jobId: job.id,
        error: error.message
      });
      
      this.emit('job_failed', { job, error });
      throw error;
    }
  }

  async processEmailClassification(job) {
    const { emailContent, subject, sender } = job.data;
    
    const classification = await aiService.classifyEmail(
      emailContent, 
      subject, 
      sender
    );

    return {
      type: 'email_classification',
      classification,
      processedAt: new Date().toISOString(),
      confidence: classification.confidence
    };
  }

  async processDraftGeneration(job) {
    const { emailContent, subject, sender, context } = job.data;
    
    const draft = await aiService.generateDraftReply(
      emailContent,
      subject,
      sender,
      context
    );

    return {
      type: 'draft_generation',
      draft,
      processedAt: new Date().toISOString()
    };
  }

  async processChatResponse(job) {
    const { userInput, context } = job.data;
    
    const response = await aiService.generateChatResponse(
      userInput,
      context
    );

    return {
      type: 'chat_response',
      response,
      processedAt: new Date().toISOString()
    };
  }

  async processBatchAnalysis(job) {
    const { items, analysisType } = job.data;
    const results = [];
    
    // Process items in smaller chunks to avoid overwhelming the AI service
    const chunkSize = 5;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      
      const chunkPromises = chunk.map(async (item) => {
        try {
          let analysis;
          
          if (analysisType === 'email_classification') {
            analysis = await aiService.classifyEmail(
              item.content,
              item.subject,
              item.sender
            );
          } else if (analysisType === 'content_summarization') {
            analysis = await this.summarizeContent(item.content);
          }
          
          return {
            itemId: item.id,
            analysis,
            success: true,
            processedAt: new Date().toISOString()
          };
        } catch (error) {
          logger.error('Batch analysis item failed', {
            workerId: this.id,
            itemId: item.id,
            error: error.message
          });
          
          return {
            itemId: item.id,
            error: error.message,
            success: false,
            processedAt: new Date().toISOString()
          };
        }
      });
      
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    return {
      type: 'batch_analysis',
      results,
      totalItems: items.length,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length,
      processedAt: new Date().toISOString()
    };
  }

  async processContentSummarization(job) {
    const { content, maxLength } = job.data;
    
    const summary = await this.summarizeContent(content, maxLength);
    
    return {
      type: 'content_summarization',
      summary,
      originalLength: content.length,
      summaryLength: summary.length,
      processedAt: new Date().toISOString()
    };
  }

  async summarizeContent(content, maxLength = 500) {
    // Use the AI service to generate a summary
    const prompt = `Summarize the following content in ${maxLength} characters or less:\n\n${content}`;
    
    const response = await aiService.generateChatResponse(prompt, {
      context: 'summarization',
      maxTokens: Math.ceil(maxLength / 4) // Approximate token count
    });
    
    return response.substring(0, maxLength);
  }

  shouldRestart() {
    // Restart worker if it has processed too many jobs
    if (this.processedJobs >= this.options.maxJobsPerWorker) {
      return true;
    }
    
    // Restart if worker has been idle too long
    if (Date.now() - this.lastActivity > this.options.idleTimeout) {
      return true;
    }
    
    return false;
  }

  getStats() {
    return {
      id: this.id,
      isRunning: this.isRunning,
      processedJobs: this.processedJobs,
      currentJob: this.currentJob ? {
        id: this.currentJob.id,
        type: this.currentJob.type,
        startedAt: this.currentJob.startedAt
      } : null,
      lastActivity: this.lastActivity,
      uptime: Date.now() - this.createdAt,
      shouldRestart: this.shouldRestart()
    };
  }
}

/**
 * Async AI Processor - Main coordinator for AI processing
 */
class AsyncAIProcessor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      maxWorkers: options.maxWorkers || 4,
      minWorkers: options.minWorkers || 2,
      workerOptions: options.workerOptions || {},
      processingInterval: options.processingInterval || 1000,
      autoScale: options.autoScale !== false,
      ...options
    };
    
    this.queue = new AIJobQueue();
    this.workers = new Map();
    this.isRunning = false;
    this.processingInterval = null;
    this.nextWorkerId = 1;
    
    this.stats = {
      startedAt: null,
      totalJobsProcessed: 0,
      totalJobsFailed: 0,
      activeWorkers: 0,
      peakWorkers: 0
    };
  }

  async start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.stats.startedAt = Date.now();
    
    // Start minimum number of workers
    for (let i = 0; i < this.options.minWorkers; i++) {
      await this.createWorker();
    }
    
    // Start processing loop
    this.processingInterval = setInterval(() => {
      this.processJobs();
    }, this.options.processingInterval);
    
    logger.info('Async AI Processor started', {
      minWorkers: this.options.minWorkers,
      maxWorkers: this.options.maxWorkers,
      autoScale: this.options.autoScale
    });
    
    this.emit('started');
  }

  async stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    // Stop processing interval
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    // Stop all workers
    const stopPromises = Array.from(this.workers.values()).map(worker => worker.stop());
    await Promise.all(stopPromises);
    
    this.workers.clear();
    
    logger.info('Async AI Processor stopped');
    this.emit('stopped');
  }

  async createWorker() {
    const workerId = this.nextWorkerId++;
    const worker = new AIWorker(workerId, this.options.workerOptions);
    
    worker.on('job_completed', ({ job, result }) => {
      this.queue.markCompleted(job.id, result);
      this.stats.totalJobsProcessed++;
      this.emit('job_completed', { job, result });
    });
    
    worker.on('job_failed', ({ job, error }) => {
      this.queue.markFailed(job.id, error);
      this.stats.totalJobsFailed++;
      this.emit('job_failed', { job, error });
    });
    
    await worker.start();
    this.workers.set(workerId, worker);
    
    this.stats.activeWorkers = this.workers.size;
    this.stats.peakWorkers = Math.max(this.stats.peakWorkers, this.workers.size);
    
    logger.info('AI worker created', { workerId, totalWorkers: this.workers.size });
    
    return worker;
  }

  async removeWorker(workerId) {
    const worker = this.workers.get(workerId);
    if (!worker) return;
    
    await worker.stop();
    this.workers.delete(workerId);
    
    this.stats.activeWorkers = this.workers.size;
    
    logger.info('AI worker removed', { workerId, totalWorkers: this.workers.size });
  }

  async processJobs() {
    if (!this.isRunning) return;
    
    // Auto-scaling logic
    if (this.options.autoScale) {
      await this.autoScale();
    }
    
    // Assign jobs to available workers
    const availableWorkers = Array.from(this.workers.values()).filter(
      worker => worker.isRunning && !worker.currentJob
    );
    
    for (const worker of availableWorkers) {
      const job = this.queue.dequeue();
      if (!job) break;
      
      // Process job asynchronously
      worker.processJob(job).catch(error => {
        logger.error('Worker job processing failed', {
          workerId: worker.id,
          jobId: job.id,
          error: error.message
        });
      });
    }
  }

  async autoScale() {
    const queueStats = this.queue.getStats();
    const totalQueuedJobs = queueStats.totalQueued;
    const activeWorkers = this.workers.size;
    
    // Scale up if queue is growing
    if (totalQueuedJobs > activeWorkers * 2 && activeWorkers < this.options.maxWorkers) {
      await this.createWorker();
      logger.info('Scaled up workers due to queue size', {
        queueSize: totalQueuedJobs,
        workers: this.workers.size
      });
    }
    
    // Scale down if queue is empty and workers are idle
    if (totalQueuedJobs === 0 && activeWorkers > this.options.minWorkers) {
      // Find workers that should restart (idle too long)
      const workersToRemove = Array.from(this.workers.values())
        .filter(worker => worker.shouldRestart() && !worker.currentJob)
        .slice(0, activeWorkers - this.options.minWorkers);
      
      for (const worker of workersToRemove) {
        await this.removeWorker(worker.id);
        logger.info('Scaled down idle worker', { workerId: worker.id });
      }
    }
  }

  // Public API methods
  async submitJob(jobData) {
    if (!this.isRunning) {
      throw new Error('AI Processor is not running');
    }
    
    const jobId = this.queue.enqueue(jobData);
    
    logger.info('AI job submitted', {
      jobId,
      type: jobData.type,
      priority: jobData.priority || 'medium'
    });
    
    return jobId;
  }

  getJobStatus(jobId) {
    const job = this.queue.getJob(jobId);
    if (!job) return null;
    
    let status;
    if (this.queue.processing.has(jobId)) {
      status = 'processing';
    } else if (this.queue.completed.has(jobId)) {
      status = 'completed';
    } else if (this.queue.failed.has(jobId)) {
      status = 'failed';
    } else {
      status = 'queued';
    }
    
    return {
      id: jobId,
      status,
      type: job.type,
      priority: job.priority,
      createdAt: job.createdAt,
      attempts: job.attempts || 0,
      ...(job.result && { result: job.result }),
      ...(job.error && { error: job.error })
    };
  }

  getStats() {
    const queueStats = this.queue.getStats();
    const workerStats = Array.from(this.workers.values()).map(w => w.getStats());
    
    return {
      ...this.stats,
      queue: queueStats,
      workers: workerStats,
      uptime: this.stats.startedAt ? Date.now() - this.stats.startedAt : 0
    };
  }
}

module.exports = { AsyncAIProcessor, AIWorker, AIJobQueue };