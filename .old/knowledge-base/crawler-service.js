#!/usr/bin/env node

/**
 * Apple MCP Knowledge Base - Smart Crawler Service
 * 
 * Intelligent multi-source content crawler with rate limiting,
 * change detection, and respectful crawling practices.
 */

const express = require('express');
const Bull = require('bull');
const axios = require('axios');
const cheerio = require('cheerio');
const robotsParser = require('robots-parser');
const crypto = require('crypto');
const { Pool } = require('pg');
const Redis = require('redis');
const winston = require('winston');

// Initialize services
const app = express();
const port = process.env.CRAWLER_PORT || 8081;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

// Redis connection for caching and queues
const redis = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Queue for crawl jobs
const crawlQueue = new Bull('crawl queue', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  }
});

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'crawler-service' },
  transports: [
    new winston.transports.File({ filename: 'logs/crawler-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/crawler-combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiter for respectful crawling
class RateLimiter {
  constructor(requestsPerSecond = 1) {
    this.interval = 1000 / requestsPerSecond;
    this.lastRequest = 0;
  }

  async waitForSlot() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    
    if (timeSinceLastRequest < this.interval) {
      const waitTime = this.interval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequest = Date.now();
  }
}

// Smart crawler implementation
class SmartCrawler {
  constructor(source) {
    this.source = source;
    this.rateLimiter = new RateLimiter(source.crawlConfig?.rateLimitDelay ? 1000 / source.crawlConfig.rateLimitDelay : 1);
    this.userAgent = source.crawlConfig?.userAgent || 'AppleMCP-KnowledgeBot/1.0 (+https://apple-mcp.com/bot)';
    this.respectRobotsTxt = source.crawlConfig?.respectRobotsTxt !== false;
    this.maxDepth = source.crawlConfig?.maxDepth || 5;
    this.visitedUrls = new Set();
    this.robotsCache = new Map();
  }

  async crawl() {
    const jobId = crypto.randomUUID();
    logger.info(`Starting crawl job ${jobId} for source ${this.source.name}`);

    try {
      // Create crawl job record
      await this.createCrawlJob(jobId);

      // Get robots.txt if respecting it
      if (this.respectRobotsTxt) {
        await this.loadRobotsTxt();
      }

      // Discover and crawl URLs
      const urls = await this.discoverUrls();
      const results = [];

      for (const url of urls) {
        try {
          if (await this.shouldCrawl(url)) {
            await this.rateLimiter.waitForSlot();
            const content = await this.fetchContent(url);
            
            if (content) {
              const processed = await this.processContent(content, url);
              results.push(processed);
              
              // Update progress
              await this.updateProgress(jobId, results.length, urls.length);
            }
          }
        } catch (error) {
          logger.error(`Error crawling URL ${url}:`, error);
          await this.logError(jobId, url, error.message);
        }
      }

      // Complete job
      await this.completeCrawlJob(jobId, results);
      return { jobId, results: results.length, status: 'completed' };

    } catch (error) {
      logger.error(`Crawl job ${jobId} failed:`, error);
      await this.failCrawlJob(jobId, error.message);
      throw error;
    }
  }

  async loadRobotsTxt() {
    try {
      const robotsUrl = new URL('/robots.txt', this.source.baseUrl).href;
      const response = await axios.get(robotsUrl, {
        timeout: 10000,
        headers: { 'User-Agent': this.userAgent }
      });
      
      const robots = robotsParser(robotsUrl, response.data);
      this.robotsCache.set(this.source.baseUrl, robots);
      
      logger.info(`Loaded robots.txt for ${this.source.baseUrl}`);
    } catch (error) {
      logger.warn(`Could not load robots.txt for ${this.source.baseUrl}:`, error.message);
    }
  }

  async shouldCrawl(url) {
    // Check if already visited
    if (this.visitedUrls.has(url)) {
      return false;
    }

    // Check robots.txt
    if (this.respectRobotsTxt) {
      const robots = this.robotsCache.get(this.source.baseUrl);
      if (robots && !robots.isAllowed(url, this.userAgent)) {
        logger.debug(`Robots.txt disallows crawling ${url}`);
        return false;
      }
    }

    // Check include/exclude patterns
    const config = this.source.crawlConfig;
    
    if (config?.includePatterns?.length > 0) {
      const included = config.includePatterns.some(pattern => 
        new RegExp(pattern).test(url)
      );
      if (!included) return false;
    }

    if (config?.excludePatterns?.length > 0) {
      const excluded = config.excludePatterns.some(pattern => 
        new RegExp(pattern).test(url)
      );
      if (excluded) return false;
    }

    return true;
  }

  async discoverUrls() {
    const urls = new Set();
    const queue = [{ url: this.source.baseUrl, depth: 0 }];
    
    while (queue.length > 0) {
      const { url, depth } = queue.shift();
      
      if (depth > this.maxDepth || this.visitedUrls.has(url)) {
        continue;
      }

      this.visitedUrls.add(url);
      urls.add(url);

      try {
        // Fetch page to discover more URLs
        const response = await axios.get(url, {
          timeout: 30000,
          headers: {
            'User-Agent': this.userAgent,
            ...this.source.crawlConfig?.customHeaders
          }
        });

        const $ = cheerio.load(response.data);
        
        // Extract links
        $('a[href]').each((_, element) => {
          const href = $(element).attr('href');
          const absoluteUrl = new URL(href, url).href;
          
          // Only add URLs from the same domain
          if (new URL(absoluteUrl).origin === new URL(this.source.baseUrl).origin) {
            queue.push({ url: absoluteUrl, depth: depth + 1 });
          }
        });

      } catch (error) {
        logger.warn(`Error discovering URLs from ${url}:`, error.message);
      }
    }

    return Array.from(urls);
  }

  async fetchContent(url) {
    try {
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          ...this.source.crawlConfig?.customHeaders
        },
        maxRedirects: 5
      });

      return {
        url,
        statusCode: response.status,
        headers: response.headers,
        content: response.data,
        fetchedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`Failed to fetch content from ${url}:`, error.message);
      return null;
    }
  }

  async processContent(fetchedContent, url) {
    const { content } = fetchedContent;
    const $ = cheerio.load(content);

    // Remove unwanted elements
    $('script, style, nav, footer, .advertisement, .ads').remove();

    // Extract title
    const title = $('title').text().trim() || 
                 $('h1').first().text().trim() || 
                 'Untitled Document';

    // Extract main content
    const mainContent = this.extractMainContent($);

    // Extract metadata
    const metadata = this.extractMetadata($, url);

    // Check for changes using content hash
    const contentHash = crypto
      .createHash('sha256')
      .update(mainContent)
      .digest('hex');

    const existingDoc = await this.checkExistingDocument(url);
    
    if (existingDoc && existingDoc.content_hash === contentHash) {
      logger.debug(`No changes detected for ${url}`);
      return null; // No changes
    }

    // Prepare document for storage
    const document = {
      sourceId: this.source.id,
      title,
      content: mainContent,
      url,
      contentType: this.detectContentType($, url),
      metadata: {
        ...metadata,
        wordCount: this.countWords(mainContent),
        lastModified: fetchedContent.headers['last-modified'],
        contentLength: mainContent.length,
        extractedAt: new Date().toISOString()
      },
      contentHash
    };

    // Store document
    await this.storeDocument(document);
    
    return document;
  }

  extractMainContent($) {
    // Try different content selectors in order of preference
    const contentSelectors = [
      'main',
      'article',
      '[role="main"]',
      '.content',
      '.main-content',
      '#content',
      '#main'
    ];

    for (const selector of contentSelectors) {
      const content = $(selector);
      if (content.length > 0) {
        return content.text().trim();
      }
    }

    // Fallback to body content
    return $('body').text().trim();
  }

  extractMetadata($, url) {
    const metadata = {};

    // Open Graph metadata
    $('meta[property^="og:"]').each((_, element) => {
      const property = $(element).attr('property').replace('og:', '');
      const content = $(element).attr('content');
      if (content) metadata[property] = content;
    });

    // Standard meta tags
    $('meta[name]').each((_, element) => {
      const name = $(element).attr('name');
      const content = $(element).attr('content');
      if (content) metadata[name] = content;
    });

    // Extract headings structure
    const headings = [];
    $('h1, h2, h3, h4, h5, h6').each((_, element) => {
      headings.push({
        level: parseInt(element.tagName.slice(1)),
        text: $(element).text().trim()
      });
    });
    metadata.headings = headings;

    // Extract code blocks
    const codeBlocks = [];
    $('pre code, .highlight code').each((_, element) => {
      const code = $(element).text().trim();
      const language = this.detectCodeLanguage($(element));
      if (code) {
        codeBlocks.push({ code, language });
      }
    });
    metadata.codeBlocks = codeBlocks;

    return metadata;
  }

  detectContentType($, url) {
    // Check for API documentation patterns
    if (url.includes('/api/') || url.includes('/docs/api') || $('code').length > 10) {
      return 'api-docs';
    }

    // Check for tutorial patterns
    if (url.includes('/tutorial') || url.includes('/guide') || 
        $('h1, h2').text().toLowerCase().includes('tutorial')) {
      return 'tutorial';
    }

    // Check for reference documentation
    if (url.includes('/reference') || url.includes('/docs')) {
      return 'reference';
    }

    return 'documentation';
  }

  detectCodeLanguage($element) {
    const classNames = $element.attr('class') || '';
    const languageMatch = classNames.match(/language-(\w+)/);
    
    if (languageMatch) {
      return languageMatch[1];
    }

    // Check parent element
    const parentClass = $element.parent().attr('class') || '';
    const parentMatch = parentClass.match(/language-(\w+)/);
    
    return parentMatch ? parentMatch[1] : 'text';
  }

  countWords(text) {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  async checkExistingDocument(url) {
    const query = 'SELECT content_hash FROM documents WHERE url = $1';
    const result = await pool.query(query, [url]);
    return result.rows[0] || null;
  }

  async storeDocument(document) {
    const query = `
      INSERT INTO documents (
        source_id, title, content, url, content_type, metadata, content_hash,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT (url) DO UPDATE SET
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        content_type = EXCLUDED.content_type,
        metadata = EXCLUDED.metadata,
        content_hash = EXCLUDED.content_hash,
        updated_at = NOW()
      RETURNING id
    `;

    const values = [
      document.sourceId,
      document.title,
      document.content,
      document.url,
      document.contentType,
      JSON.stringify(document.metadata),
      document.contentHash
    ];

    const result = await pool.query(query, values);
    return result.rows[0].id;
  }

  async createCrawlJob(jobId) {
    const query = `
      INSERT INTO crawl_jobs (id, source_id, status, started_at)
      VALUES ($1, $2, 'running', NOW())
    `;
    await pool.query(query, [jobId, this.source.id]);
  }

  async updateProgress(jobId, processed, total) {
    const query = `
      UPDATE crawl_jobs 
      SET documents_processed = $2, 
          progress = $3
      WHERE id = $1
    `;
    const progress = Math.round((processed / total) * 100);
    await pool.query(query, [jobId, processed, progress]);
  }

  async completeCrawlJob(jobId, results) {
    const query = `
      UPDATE crawl_jobs 
      SET status = 'completed',
          completed_at = NOW(),
          documents_processed = $2,
          documents_updated = $3
      WHERE id = $1
    `;
    await pool.query(query, [jobId, results.length, results.filter(r => r).length]);
  }

  async failCrawlJob(jobId, error) {
    const query = `
      UPDATE crawl_jobs 
      SET status = 'failed',
          completed_at = NOW(),
          error_log = $2
      WHERE id = $1
    `;
    await pool.query(query, [jobId, JSON.stringify({ error })]);
  }

  async logError(jobId, url, error) {
    const query = `
      UPDATE crawl_jobs 
      SET errors_count = errors_count + 1,
          error_log = COALESCE(error_log, '[]'::jsonb) || $2::jsonb
      WHERE id = $1
    `;
    const errorEntry = JSON.stringify([{ url, error, timestamp: new Date().toISOString() }]);
    await pool.query(query, [jobId, errorEntry]);
  }
}

// Queue processor
crawlQueue.process('crawl-source', async (job) => {
  const { sourceId } = job.data;
  
  // Get source configuration
  const sourceQuery = 'SELECT * FROM sources WHERE id = $1 AND is_active = true';
  const sourceResult = await pool.query(sourceQuery, [sourceId]);
  
  if (sourceResult.rows.length === 0) {
    throw new Error(`Source ${sourceId} not found or inactive`);
  }

  const source = sourceResult.rows[0];
  const crawler = new SmartCrawler(source);
  
  return await crawler.crawl();
});

// API Routes

// Trigger crawl job
app.post('/crawl/trigger', async (req, res) => {
  try {
    const { sourceId, options = {} } = req.body;

    if (!sourceId) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'sourceId is required'
      });
    }

    // Add job to queue
    const job = await crawlQueue.add('crawl-source', {
      sourceId,
      options
    }, {
      priority: options.priority === 'high' ? 10 : 
               options.priority === 'low' ? 1 : 5,
      attempts: 3,
      backoff: 'exponential'
    });

    res.status(202).json({
      jobId: job.id,
      status: 'accepted',
      message: 'Crawl job queued successfully'
    });

  } catch (error) {
    logger.error('Error triggering crawl:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to trigger crawl job'
    });
  }
});

// Get crawl job status
app.get('/crawl/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const query = 'SELECT * FROM crawl_jobs WHERE id = $1';
    const result = await pool.query(query, [jobId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Crawl job not found'
      });
    }

    res.json(result.rows[0]);

  } catch (error) {
    logger.error('Error getting job status:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to get job status'
    });
  }
});

// List active crawl jobs
app.get('/crawl/jobs', async (req, res) => {
  try {
    const { status, limit = 20, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM crawl_jobs';
    const params = [];
    
    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }
    
    query += ` ORDER BY started_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    res.json({
      jobs: result.rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: result.rowCount
      }
    });

  } catch (error) {
    logger.error('Error listing jobs:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to list jobs'
    });
  }
});

// Health check
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await pool.query('SELECT 1');
    
    // Check Redis connection
    await redis.ping();
    
    // Check queue health
    const waiting = await crawlQueue.waiting();
    const active = await crawlQueue.active();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        redis: 'connected',
        queue: {
          waiting: waiting.length,
          active: active.length
        }
      }
    });

  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred'
  });
});

// Start server
app.listen(port, () => {
  logger.info(`Crawler service listening on port ${port}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  
  await crawlQueue.close();
  await redis.quit();
  await pool.end();
  
  process.exit(0);
});

module.exports = app;