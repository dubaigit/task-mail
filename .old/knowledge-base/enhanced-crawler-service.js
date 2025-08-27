#!/usr/bin/env node

/**
 * Apple MCP Enhanced Crawler Service
 * 
 * Intelligent multi-source documentation crawler with:
 * - Content quality scoring
 * - Semantic analysis and indexing
 * - Rate limiting and respectful crawling
 * - Change detection and delta updates
 * - Integration with Apple MCP knowledge base
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
const { OpenAI } = require('openai');
const { z } = require('zod');

// Initialize services
const app = express();
const port = process.env.CRAWLER_PORT || 8082;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// Redis connection for caching and queues
const redis = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// OpenAI for semantic analysis
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Queue for crawl jobs
const crawlQueue = new Bull('enhanced-crawl-queue', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  },
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 20,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
});

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
    })
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'logs/enhanced-crawler-error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/enhanced-crawler.log' 
    }),
    new winston.transports.Console()
  ]
});

// Documentation site configurations
const SITE_CONFIGS = {
  'react.dev': {
    priority: 'critical',
    updateFrequency: 'weekly',
    rateLimits: { requests: 10, per: 'minute' },
    patterns: [
      '/learn/**',
      '/reference/react/**',
      '/reference/react-dom/**'
    ],
    excludePatterns: [
      '/blog/**',
      '/community/**',
      '/versions/**'
    ],
    contentSelectors: {
      title: 'h1, h2[data-docs-heading]',
      content: '[data-docs-content], main article',
      codeBlocks: 'pre code, [data-code-block]',
      examples: '[data-sandpack], .code-example'
    },
    qualityWeights: {
      codeExample: 3.0,
      officialContent: 2.5,
      recentUpdate: 2.0,
      apiReference: 2.5
    }
  },
  'typescriptlang.org': {
    priority: 'critical',
    updateFrequency: 'bi-weekly',
    rateLimits: { requests: 15, per: 'minute' },
    patterns: [
      '/docs/handbook/**',
      '/docs/handbook/2/**'
    ],
    excludePatterns: [
      '/play/**',
      '/community/**'
    ],
    contentSelectors: {
      title: 'h1, h2, h3',
      content: '.markdown, .content, main',
      codeBlocks: 'pre code, .code-block',
      examples: '.example, .sample-code'
    },
    qualityWeights: {
      codeExample: 3.0,
      officialContent: 2.5,
      typeDefinition: 3.0,
      recentUpdate: 1.5
    }
  },
  'nodejs.org': {
    priority: 'high',
    updateFrequency: 'bi-weekly',
    rateLimits: { requests: 20, per: 'minute' },
    patterns: [
      '/api/**',
      '/docs/latest-v*/api/**'
    ],
    excludePatterns: [
      '/blog/**',
      '/about/**'
    ],
    contentSelectors: {
      title: 'h1, h2, h3',
      content: '#apicontent, .api-doc-content',
      codeBlocks: 'pre code',
      examples: '.example, pre'
    }
  },
  'expressjs.com': {
    priority: 'high',
    updateFrequency: 'bi-weekly',
    rateLimits: { requests: 15, per: 'minute' },
    patterns: [
      '/en/4x/api.html',
      '/en/guide/**',
      '/en/advanced/**'
    ],
    contentSelectors: {
      title: 'h1, h2, h3',
      content: '#page-doc, .page-content',
      codeBlocks: 'pre code',
      examples: '.code-sample, pre'
    }
  },
  'postgresql.org': {
    priority: 'high',
    updateFrequency: 'monthly',
    rateLimits: { requests: 5, per: 'minute' }, // Respectful crawling
    patterns: [
      '/docs/current/sql-**',
      '/docs/current/indexes.html',
      '/docs/current/performance-tips.html',
      '/docs/current/tutorial-**'
    ],
    contentSelectors: {
      title: 'h1, h2, h3',
      content: '.sect1, .chapter, .article',
      codeBlocks: 'pre, .programlisting',
      examples: '.example'
    }
  },
  'redis.io': {
    priority: 'medium',
    updateFrequency: 'monthly',
    rateLimits: { requests: 10, per: 'minute' },
    patterns: [
      '/commands/**',
      '/topics/**'
    ],
    contentSelectors: {
      title: 'h1, h2, h3',
      content: '.content, main',
      codeBlocks: 'pre code',
      examples: '.example, .code-sample'
    }
  },
  'platform.openai.com': {
    priority: 'critical',
    updateFrequency: 'weekly',
    rateLimits: { requests: 8, per: 'minute' },
    patterns: [
      '/docs/api-reference/**',
      '/docs/guides/**',
      '/docs/models/**'
    ],
    contentSelectors: {
      title: 'h1, h2, h3',
      content: '.content, main article',
      codeBlocks: 'pre code',
      examples: '.code-sample, .example'
    }
  },
  'tailwindcss.com': {
    priority: 'high',
    updateFrequency: 'bi-weekly',
    rateLimits: { requests: 12, per: 'minute' },
    patterns: [
      '/docs/**'
    ],
    excludePatterns: [
      '/blog/**',
      '/showcase/**'
    ],
    contentSelectors: {
      title: 'h1, h2, h3',
      content: '.prose, .documentation',
      codeBlocks: 'pre code',
      examples: '.example, .demo'
    }
  }
};

// Content quality scoring system
class ContentQualityAnalyzer {
  constructor() {
    this.contentFilters = {
      highValue: [
        /best\s+practices?/i,
        /performance\s+optimization/i,
        /production\s+ready/i,
        /security\s+considerations/i,
        /advanced\s+patterns/i,
        /typescript\s+integration/i,
        /api\s+reference/i
      ],
      mediumValue: [
        /getting\s+started/i,
        /quick\s+start/i,
        /examples?/i,
        /tutorial/i,
        /guide/i,
        /how\s+to/i
      ],
      lowValue: [
        /changelog/i,
        /migration\s+guide/i,
        /deprecated/i,
        /legacy/i,
        /blog\s+post/i,
        /news/i
      ]
    };
  }

  calculateQualityScore(content, siteConfig) {
    let score = 0;
    const weights = siteConfig.qualityWeights || {};

    // Code example presence (high value)
    if (content.codeBlocks && content.codeBlocks.length > 0) {
      score += (weights.codeExample || 2.5) * Math.min(content.codeBlocks.length, 5);
    }

    // Official source weight
    if (content.isOfficialDocs) {
      score += weights.officialContent || 20;
    }

    // Recency factor
    const daysSinceUpdate = content.lastModified ? 
      (Date.now() - new Date(content.lastModified).getTime()) / (1000 * 60 * 60 * 24) : 365;
    
    if (daysSinceUpdate < 30) score += (weights.recentUpdate || 1.5) * 10;
    else if (daysSinceUpdate < 90) score += (weights.recentUpdate || 1.5) * 7;
    else if (daysSinceUpdate < 365) score += (weights.recentUpdate || 1.5) * 3;

    // Content depth and structure
    if (content.wordCount > 500) score += 8;
    if (content.wordCount > 1500) score += 5;
    if (content.wordCount > 3000) score += 3;

    // Content type scoring
    this.contentFilters.highValue.forEach(pattern => {
      if (pattern.test(content.text)) score += 15;
    });
    
    this.contentFilters.mediumValue.forEach(pattern => {
      if (pattern.test(content.text)) score += 8;
    });
    
    this.contentFilters.lowValue.forEach(pattern => {
      if (pattern.test(content.text)) score -= 10;
    });

    // Technical accuracy indicators
    if (content.hasApiReference) score += weights.apiReference || 15;
    if (content.hasBestPractices) score += 12;
    if (content.hasPerformanceTips) score += 10;
    if (content.hasTypeDefinitions) score += weights.typeDefinition || 10;

    return Math.max(0, Math.min(score, 100)); // Ensure 0-100 range
  }

  extractTags(content, domain) {
    const tags = new Set();
    
    // Technology-specific tags based on domain
    const domainTags = {
      'react.dev': ['react', 'jsx', 'hooks', 'components'],
      'typescriptlang.org': ['typescript', 'types', 'interfaces'],
      'nodejs.org': ['nodejs', 'javascript', 'backend'],
      'expressjs.com': ['express', 'middleware', 'routing'],
      'postgresql.org': ['postgresql', 'sql', 'database'],
      'redis.io': ['redis', 'cache', 'nosql'],
      'platform.openai.com': ['openai', 'ai', 'api'],
      'tailwindcss.com': ['tailwind', 'css', 'styling']
    };

    if (domainTags[domain]) {
      domainTags[domain].forEach(tag => tags.add(tag));
    }

    // Pattern-based tags
    if (content.text.match(/hook|useState|useEffect|useCallback|useMemo/i)) tags.add('hooks');
    if (content.text.match(/performance|optimization|speed|bundle/i)) tags.add('performance');
    if (content.text.match(/security|auth|jwt|oauth/i)) tags.add('security');
    if (content.text.match(/test|jest|playwright|testing/i)) tags.add('testing');
    if (content.text.match(/async|await|promise|asynchronous/i)) tags.add('async');
    if (content.text.match(/responsive|mobile|breakpoint/i)) tags.add('responsive');
    if (content.text.match(/state|store|reducer|context/i)) tags.add('state-management');

    return Array.from(tags);
  }
}

// Semantic processing for embeddings
class SemanticProcessor {
  constructor() {
    this.embeddingCache = new Map();
  }

  async generateEmbeddings(content) {
    const contentHash = crypto.createHash('sha256')
      .update(content.text)
      .digest('hex');

    // Check cache first
    if (this.embeddingCache.has(contentHash)) {
      return this.embeddingCache.get(contentHash);
    }

    try {
      // Prepare text for embedding (limit to 8000 characters)
      const textForEmbedding = content.text.substring(0, 8000);
      
      const response = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: textForEmbedding
      });

      const result = {
        embedding: response.data[0].embedding,
        contentHash,
        metadata: {
          source: content.source,
          domain: content.domain,
          title: content.title,
          url: content.url,
          lastModified: content.lastModified,
          qualityScore: content.qualityScore,
          tags: content.tags,
          wordCount: content.wordCount,
          hasCodeExamples: content.codeBlocks && content.codeBlocks.length > 0
        }
      };

      // Cache the result
      this.embeddingCache.set(contentHash, result);
      
      return result;
    } catch (error) {
      logger.error('Failed to generate embeddings:', error);
      return null;
    }
  }

  async batchGenerateEmbeddings(contents) {
    const results = [];
    
    // Process in batches to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < contents.length; i += batchSize) {
      const batch = contents.slice(i, i + batchSize);
      const batchPromises = batch.map(content => this.generateEmbeddings(content));
      
      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults.filter(result => result !== null));
        
        // Small delay between batches
        if (i + batchSize < contents.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        logger.error(`Batch embedding generation failed for batch ${i}:`, error);
      }
    }
    
    return results;
  }
}

// Enhanced content extractor
class ContentExtractor {
  constructor() {
    this.qualityAnalyzer = new ContentQualityAnalyzer();
    this.semanticProcessor = new SemanticProcessor();
  }

  async extractContent(url, html, siteConfig) {
    const $ = cheerio.load(html);
    const domain = new URL(url).hostname;
    
    // Extract basic content
    const title = this.extractTitle($, siteConfig);
    const mainContent = this.extractMainContent($, siteConfig);
    const codeBlocks = this.extractCodeBlocks($, siteConfig);
    const examples = this.extractExamples($, siteConfig);
    
    // Calculate word count and other metrics
    const wordCount = mainContent.split(/\s+/).length;
    const lastModified = this.extractLastModified($, html);
    
    // Build content object
    const content = {
      url,
      domain,
      title,
      text: mainContent,
      codeBlocks,
      examples,
      wordCount,
      lastModified,
      isOfficialDocs: true, // Assuming all configured sites are official
      hasApiReference: this.hasApiReference(mainContent),
      hasBestPractices: this.hasBestPractices(mainContent),
      hasPerformanceTips: this.hasPerformanceTips(mainContent),
      hasTypeDefinitions: this.hasTypeDefinitions(mainContent)
    };

    // Calculate quality score
    content.qualityScore = this.qualityAnalyzer.calculateQualityScore(content, siteConfig);
    
    // Extract tags
    content.tags = this.qualityAnalyzer.extractTags(content, domain);
    
    // Generate embeddings
    const embeddingData = await this.semanticProcessor.generateEmbeddings(content);
    
    return {
      ...content,
      embedding: embeddingData?.embedding,
      contentHash: embeddingData?.contentHash
    };
  }

  extractTitle($, siteConfig) {
    const selectors = siteConfig.contentSelectors?.title || 'h1, h2';
    return $(selectors).first().text().trim() || 'Untitled';
  }

  extractMainContent($, siteConfig) {
    const selectors = siteConfig.contentSelectors?.content || 'main, .content, article';
    
    // Remove unwanted elements
    $('script, style, nav, header, footer, .navigation, .sidebar').remove();
    
    let content = '';
    $(selectors).each((i, element) => {
      content += $(element).text() + '\n';
    });
    
    // Clean up whitespace
    return content.replace(/\s+/g, ' ').trim();
  }

  extractCodeBlocks($, siteConfig) {
    const selectors = siteConfig.contentSelectors?.codeBlocks || 'pre code, .code-block';
    const codeBlocks = [];
    
    $(selectors).each((i, element) => {
      const code = $(element).text().trim();
      if (code.length > 10) { // Filter out very short code snippets
        codeBlocks.push({
          code,
          language: this.detectLanguage(code, $(element))
        });
      }
    });
    
    return codeBlocks;
  }

  extractExamples($, siteConfig) {
    const selectors = siteConfig.contentSelectors?.examples || '.example, .demo';
    const examples = [];
    
    $(selectors).each((i, element) => {
      const example = $(element).text().trim();
      if (example.length > 20) {
        examples.push(example);
      }
    });
    
    return examples;
  }

  extractLastModified($, html) {
    // Try multiple strategies to find last modified date
    const metaLastModified = $('meta[property="article:modified_time"]').attr('content');
    if (metaLastModified) return metaLastModified;
    
    const metaPublished = $('meta[property="article:published_time"]').attr('content');
    if (metaPublished) return metaPublished;
    
    // Look for date patterns in the HTML
    const datePattern = /(\d{4})-(\d{2})-(\d{2})/;
    const match = html.match(datePattern);
    if (match) return match[0];
    
    return null;
  }

  detectLanguage(code, element) {
    // Try to detect language from class names
    const className = element.attr('class') || '';
    const langMatch = className.match(/language-(\w+)|lang-(\w+)/);
    if (langMatch) return langMatch[1] || langMatch[2];
    
    // Simple heuristics
    if (code.includes('function') && code.includes('{')) return 'javascript';
    if (code.includes('def ') || code.includes('import ')) return 'python';
    if (code.includes('SELECT') || code.includes('CREATE TABLE')) return 'sql';
    if (code.includes('interface ') || code.includes('type ')) return 'typescript';
    if (code.includes('<div') || code.includes('className')) return 'jsx';
    
    return 'text';
  }

  hasApiReference(text) {
    return /api\s+reference|method|parameter|return|argument/i.test(text);
  }

  hasBestPractices(text) {
    return /best\s+practice|recommended|should|avoid|tip|guideline/i.test(text);
  }

  hasPerformanceTips(text) {
    return /performance|optimization|speed|efficient|fast|memory|cpu/i.test(text);
  }

  hasTypeDefinitions(text) {
    return /interface|type\s+\w+|generic|constraint|extends/i.test(text);
  }
}

// Rate limiter implementation
class RateLimiter {
  constructor() {
    this.limits = new Map();
  }

  async checkLimit(domain, config) {
    const key = domain;
    const limit = config.rateLimits;
    const now = Date.now();
    
    if (!this.limits.has(key)) {
      this.limits.set(key, { count: 0, resetTime: now + this.getIntervalMs(limit.per) });
    }
    
    const limitData = this.limits.get(key);
    
    // Reset if interval has passed
    if (now >= limitData.resetTime) {
      limitData.count = 0;
      limitData.resetTime = now + this.getIntervalMs(limit.per);
    }
    
    // Check if we're under the limit
    if (limitData.count >= limit.requests) {
      const waitTime = limitData.resetTime - now;
      logger.warn(`Rate limit reached for ${domain}. Waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.checkLimit(domain, config); // Recursive check after wait
    }
    
    limitData.count++;
    return true;
  }

  getIntervalMs(period) {
    switch (period) {
      case 'second': return 1000;
      case 'minute': return 60 * 1000;
      case 'hour': return 60 * 60 * 1000;
      default: return 60 * 1000; // Default to minute
    }
  }
}

// Main crawler implementation
class EnhancedDocumentationCrawler {
  constructor() {
    this.contentExtractor = new ContentExtractor();
    this.rateLimiter = new RateLimiter();
    this.crawlStats = {
      totalPages: 0,
      successfulPages: 0,
      failedPages: 0,
      totalContent: 0,
      averageQualityScore: 0
    };
  }

  async crawlSite(domain, config) {
    logger.info(`Starting crawl for ${domain}`, { priority: config.priority });
    
    try {
      const urls = await this.generateUrlList(domain, config);
      logger.info(`Generated ${urls.length} URLs for ${domain}`);
      
      const results = [];
      
      for (const url of urls) {
        try {
          await this.rateLimiter.checkLimit(domain, config);
          
          const content = await this.crawlPage(url, config);
          if (content && content.qualityScore > 30) { // Only store high-quality content
            await this.storeContent(content);
            results.push(content);
            this.crawlStats.successfulPages++;
            this.crawlStats.totalContent += content.wordCount;
          } else {
            logger.debug(`Low quality content skipped: ${url}`);
          }
          
          this.crawlStats.totalPages++;
          
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          logger.error(`Failed to crawl ${url}:`, error);
          this.crawlStats.failedPages++;
        }
      }
      
      // Calculate average quality score
      if (results.length > 0) {
        this.crawlStats.averageQualityScore = 
          results.reduce((sum, content) => sum + content.qualityScore, 0) / results.length;
      }
      
      logger.info(`Completed crawl for ${domain}`, {
        totalPages: results.length,
        averageQuality: this.crawlStats.averageQualityScore.toFixed(2)
      });
      
      return results;
      
    } catch (error) {
      logger.error(`Site crawl failed for ${domain}:`, error);
      throw error;
    }
  }

  async generateUrlList(domain, config) {
    // This is a simplified URL generation
    // In production, you'd implement proper sitemap parsing and pattern matching
    const baseUrls = [
      `https://${domain}`,
      `https://${domain}/docs`,
      `https://${domain}/guide`,
      `https://${domain}/api`,
      `https://${domain}/reference`
    ];
    
    return baseUrls.filter(url => 
      config.patterns.some(pattern => 
        this.matchesPattern(url, pattern)
      ) && 
      !config.excludePatterns?.some(pattern => 
        this.matchesPattern(url, pattern)
      )
    );
  }

  matchesPattern(url, pattern) {
    // Simple pattern matching - in production use more sophisticated matching
    const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
    return regex.test(url);
  }

  async crawlPage(url, config) {
    try {
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Apple-MCP-Documentation-Crawler/1.0'
        }
      });
      
      if (response.status === 200) {
        return await this.contentExtractor.extractContent(url, response.data, config);
      }
      
    } catch (error) {
      logger.error(`Failed to fetch ${url}:`, error.message);
      return null;
    }
  }

  async storeContent(content) {
    try {
      const query = `
        INSERT INTO knowledge_base_content 
        (url, domain, title, content_text, content_hash, quality_score, 
         tags, code_blocks, examples, word_count, last_modified, embedding, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (content_hash) 
        DO UPDATE SET 
          quality_score = EXCLUDED.quality_score,
          tags = EXCLUDED.tags,
          last_modified = EXCLUDED.last_modified,
          updated_at = CURRENT_TIMESTAMP
      `;
      
      const values = [
        content.url,
        content.domain,
        content.title,
        content.text,
        content.contentHash,
        content.qualityScore,
        JSON.stringify(content.tags),
        JSON.stringify(content.codeBlocks),
        JSON.stringify(content.examples),
        content.wordCount,
        content.lastModified,
        content.embedding ? JSON.stringify(content.embedding) : null,
        JSON.stringify({
          hasApiReference: content.hasApiReference,
          hasBestPractices: content.hasBestPractices,
          hasPerformanceTips: content.hasPerformanceTips,
          hasTypeDefinitions: content.hasTypeDefinitions
        })
      ];
      
      await pool.query(query, values);
      logger.debug(`Stored content: ${content.title}`);
      
    } catch (error) {
      logger.error('Failed to store content:', error);
    }
  }
}

// Job processing
const crawler = new EnhancedDocumentationCrawler();

crawlQueue.process('crawl-site', async (job) => {
  const { domain, config } = job.data;
  
  logger.info(`Processing crawl job for ${domain}`);
  
  try {
    job.progress(0);
    
    const results = await crawler.crawlSite(domain, config);
    
    job.progress(100);
    
    return {
      domain,
      pagesProcessed: results.length,
      averageQuality: results.length > 0 ? 
        results.reduce((sum, content) => sum + content.qualityScore, 0) / results.length : 0,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    logger.error(`Crawl job failed for ${domain}:`, error);
    throw error;
  }
});

// API endpoints
app.use(express.json());

// Start crawl for specific site
app.post('/api/crawl/start/:domain', async (req, res) => {
  try {
    const { domain } = req.params;
    const config = SITE_CONFIGS[domain];
    
    if (!config) {
      return res.status(400).json({ 
        error: `Unknown domain: ${domain}. Supported domains: ${Object.keys(SITE_CONFIGS).join(', ')}` 
      });
    }
    
    const job = await crawlQueue.add('crawl-site', { domain, config }, {
      priority: config.priority === 'critical' ? 1 : config.priority === 'high' ? 2 : 3
    });
    
    res.json({ 
      message: `Crawl started for ${domain}`, 
      jobId: job.id,
      priority: config.priority 
    });
    
  } catch (error) {
    logger.error('Failed to start crawl:', error);
    res.status(500).json({ error: 'Failed to start crawl' });
  }
});

// Start crawl for all sites
app.post('/api/crawl/start-all', async (req, res) => {
  try {
    const jobs = [];
    
    for (const [domain, config] of Object.entries(SITE_CONFIGS)) {
      const job = await crawlQueue.add('crawl-site', { domain, config }, {
        priority: config.priority === 'critical' ? 1 : config.priority === 'high' ? 2 : 3,
        delay: jobs.length * 5000 // Stagger job starts
      });
      
      jobs.push({ domain, jobId: job.id, priority: config.priority });
    }
    
    res.json({ 
      message: `Started crawl jobs for ${jobs.length} sites`, 
      jobs 
    });
    
  } catch (error) {
    logger.error('Failed to start all crawls:', error);
    res.status(500).json({ error: 'Failed to start crawl jobs' });
  }
});

// Get crawl status
app.get('/api/crawl/status', async (req, res) => {
  try {
    const waiting = await crawlQueue.getWaiting();
    const active = await crawlQueue.getActive();
    const completed = await crawlQueue.getCompleted();
    const failed = await crawlQueue.getFailed();
    
    res.json({
      queue: {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length
      },
      stats: crawler.crawlStats
    });
    
  } catch (error) {
    logger.error('Failed to get crawl status:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// Get content statistics
app.get('/api/content/stats', async (req, res) => {
  try {
    const query = `
      SELECT 
        domain,
        COUNT(*) as total_pages,
        AVG(quality_score) as avg_quality,
        SUM(word_count) as total_words,
        MAX(updated_at) as last_updated
      FROM knowledge_base_content 
      GROUP BY domain
      ORDER BY avg_quality DESC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      by_domain: result.rows,
      total_pages: result.rows.reduce((sum, row) => sum + parseInt(row.total_pages), 0),
      overall_avg_quality: result.rows.length > 0 ? 
        result.rows.reduce((sum, row) => sum + parseFloat(row.avg_quality), 0) / result.rows.length : 0
    });
    
  } catch (error) {
    logger.error('Failed to get content stats:', error);
    res.status(500).json({ error: 'Failed to get content statistics' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Error handling
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize connections and start server
async function startServer() {
  try {
    await redis.connect();
    logger.info('Connected to Redis');
    
    await pool.query('SELECT 1'); // Test database connection
    logger.info('Connected to PostgreSQL');
    
    app.listen(port, () => {
      logger.info(`Enhanced Crawler Service running on port ${port}`);
      logger.info(`Supported domains: ${Object.keys(SITE_CONFIGS).join(', ')}`);
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  
  await crawlQueue.close();
  await redis.quit();
  await pool.end();
  
  process.exit(0);
});

if (require.main === module) {
  startServer();
}

module.exports = { EnhancedDocumentationCrawler, ContentExtractor, ContentQualityAnalyzer };