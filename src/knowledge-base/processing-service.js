#!/usr/bin/env node

/**
 * Apple MCP Knowledge Base - Document Processing Service
 * 
 * Advanced content processing pipeline with PDF extraction,
 * markdown parsing, semantic analysis, and vector embedding generation.
 */

const express = require('express');
const Bull = require('bull');
const { Pool } = require('pg');
const Redis = require('redis');
const OpenAI = require('openai');
const winston = require('winston');
const pdf = require('pdf-parse');
const marked = require('marked');
const cheerio = require('cheerio');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

// Initialize services
const app = express();
const port = process.env.PROCESSING_PORT || 8083;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 15,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

// Redis connection
const redis = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// OpenAI for embeddings and analysis
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Processing queue
const processingQueue = new Bull('document processing', {
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
  defaultMeta: { service: 'processing-service' },
  transports: [
    new winston.transports.File({ filename: 'logs/processing-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/processing-combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Document Processing Pipeline
class DocumentProcessor {
  constructor() {
    this.pipeline = [
      this.extractContent.bind(this),
      this.enrichMetadata.bind(this),
      this.analyzeSemantics.bind(this),
      this.generateEmbeddings.bind(this),
      this.validateQuality.bind(this)
    ];
  }

  async process(document) {
    let processedDoc = { ...document };
    
    logger.info(`Starting processing for document: ${document.id || document.url}`);

    for (const [index, processor] of this.pipeline.entries()) {
      try {
        const stageName = processor.name || `stage-${index}`;
        logger.debug(`Processing stage: ${stageName}`);
        
        processedDoc = await processor(processedDoc);
        
        if (!processedDoc) {
          throw new Error(`Stage ${stageName} returned null/undefined`);
        }

      } catch (error) {
        logger.error(`Processing failed at stage ${index}:`, error);
        throw new Error(`Document processing failed at stage ${index}: ${error.message}`);
      }
    }

    logger.info(`Completed processing for document: ${document.id || document.url}`);
    return processedDoc;
  }

  async extractContent(document) {
    const { contentType, content, url } = document;
    
    let extractedContent = content;
    let metadata = document.metadata || {};

    switch (contentType) {
      case 'application/pdf':
        const pdfResult = await this.extractPDF(content);
        extractedContent = pdfResult.text;
        metadata = { ...metadata, ...pdfResult.metadata };
        break;
        
      case 'text/markdown':
        const mdResult = await this.extractMarkdown(content);
        extractedContent = mdResult.text;
        metadata = { ...metadata, ...mdResult.metadata };
        break;
        
      case 'text/html':
        const htmlResult = await this.extractHTML(content);
        extractedContent = htmlResult.text;
        metadata = { ...metadata, ...htmlResult.metadata };
        break;
        
      default:
        // Plain text or unknown format
        extractedContent = typeof content === 'string' ? content : String(content);
    }

    return {
      ...document,
      extractedContent,
      metadata: {
        ...metadata,
        wordCount: this.countWords(extractedContent),
        characterCount: extractedContent.length,
        extractedAt: new Date().toISOString()
      }
    };
  }

  async extractPDF(pdfBuffer) {
    try {
      const buffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
      const pdfData = await pdf(buffer);
      
      return {
        text: pdfData.text,
        metadata: {
          pages: pdfData.numpages,
          info: pdfData.info || {},
          pdfMetadata: pdfData.metadata || {},
          extractionMethod: 'pdf-parse'
        }
      };
    } catch (error) {
      logger.error('PDF extraction failed:', error);
      throw new Error(`PDF extraction failed: ${error.message}`);
    }
  }

  async extractMarkdown(markdownText) {
    try {
      const tokens = marked.lexer(markdownText);
      const sections = [];
      const codeBlocks = [];
      
      let currentSection = null;
      
      for (const token of tokens) {
        switch (token.type) {
          case 'heading':
            if (currentSection) sections.push(currentSection);
            currentSection = {
              level: token.depth,
              title: token.text,
              content: []
            };
            break;
            
          case 'code':
            const codeBlock = {
              language: token.lang || 'text',
              code: token.text,
              metadata: await this.analyzeCode(token.text, token.lang)
            };
            codeBlocks.push(codeBlock);
            if (currentSection) currentSection.content.push(codeBlock);
            break;
            
          default:
            if (currentSection) {
              currentSection.content.push(token);
            }
        }
      }
      
      if (currentSection) sections.push(currentSection);
      
      // Convert back to plain text for main content
      const plainText = marked.parser(tokens, { renderer: new marked.Renderer() });
      const textContent = cheerio.load(plainText).text();
      
      return {
        text: textContent,
        metadata: {
          sections,
          codeBlocks,
          headingStructure: this.buildHeadingTree(sections),
          codeLanguages: [...new Set(codeBlocks.map(cb => cb.language))],
          estimatedReadingTime: this.calculateReadingTime(textContent),
          extractionMethod: 'marked'
        }
      };
    } catch (error) {
      logger.error('Markdown extraction failed:', error);
      throw new Error(`Markdown extraction failed: ${error.message}`);
    }
  }

  async extractHTML(htmlContent) {
    try {
      const $ = cheerio.load(htmlContent);
      
      // Remove unwanted elements
      $('script, style, nav, footer, .advertisement, .ads, .sidebar').remove();
      
      // Extract main content
      const mainContent = this.extractMainContent($);
      
      // Extract metadata
      const metadata = this.extractHTMLMetadata($);
      
      // Extract code blocks
      const codeBlocks = [];
      $('pre code, .highlight code, .code-block').each((_, element) => {
        const code = $(element).text().trim();
        const language = this.detectCodeLanguage($(element));
        if (code) {
          codeBlocks.push({ code, language });
        }
      });
      
      return {
        text: mainContent,
        metadata: {
          ...metadata,
          codeBlocks,
          extractionMethod: 'cheerio'
        }
      };
    } catch (error) {
      logger.error('HTML extraction failed:', error);
      throw new Error(`HTML extraction failed: ${error.message}`);
    }
  }

  extractMainContent($) {
    const contentSelectors = [
      'main',
      'article',
      '[role="main"]',
      '.content',
      '.main-content',
      '#content',
      '#main',
      '.post-content',
      '.article-content'
    ];

    for (const selector of contentSelectors) {
      const content = $(selector);
      if (content.length > 0 && content.text().trim().length > 100) {
        return content.text().trim();
      }
    }

    // Fallback to body content
    return $('body').text().trim();
  }

  extractHTMLMetadata($) {
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

    return metadata;
  }

  async analyzeCode(code, language) {
    try {
      const analysis = {
        lineCount: code.split('\n').length,
        language: language || 'text',
        complexity: this.estimateCodeComplexity(code),
        features: this.detectCodeFeatures(code, language)
      };

      return analysis;
    } catch (error) {
      logger.warn('Code analysis failed:', error);
      return { language: language || 'text' };
    }
  }

  estimateCodeComplexity(code) {
    // Simple complexity estimation based on common patterns
    const patterns = {
      functions: /function\s+\w+|const\s+\w+\s*=\s*\(|def\s+\w+/g,
      conditionals: /if\s*\(|switch\s*\(|case\s+/g,
      loops: /for\s*\(|while\s*\(|forEach|map\s*\(/g,
      classes: /class\s+\w+|interface\s+\w+/g
    };

    let complexity = 1; // Base complexity
    
    Object.values(patterns).forEach(pattern => {
      const matches = (code.match(pattern) || []).length;
      complexity += matches;
    });

    if (complexity < 5) return 'simple';
    if (complexity < 15) return 'moderate';
    if (complexity < 30) return 'complex';
    return 'very_complex';
  }

  detectCodeFeatures(code, language) {
    const features = [];
    
    // Language-specific feature detection
    switch (language) {
      case 'javascript':
      case 'typescript':
        if (code.includes('async') || code.includes('await')) features.push('async-programming');
        if (code.includes('React') || code.includes('jsx')) features.push('react');
        if (code.includes('import') || code.includes('require')) features.push('modules');
        break;
        
      case 'python':
        if (code.includes('class ')) features.push('object-oriented');
        if (code.includes('def ')) features.push('functions');
        if (code.includes('import ')) features.push('modules');
        break;
        
      case 'sql':
        if (code.includes('SELECT')) features.push('queries');
        if (code.includes('JOIN')) features.push('joins');
        if (code.includes('CREATE')) features.push('ddl');
        break;
    }

    return features;
  }

  buildHeadingTree(sections) {
    const tree = [];
    const stack = [];

    sections.forEach(section => {
      const node = {
        level: section.level,
        title: section.title,
        children: []
      };

      // Find the correct parent level
      while (stack.length > 0 && stack[stack.length - 1].level >= section.level) {
        stack.pop();
      }

      if (stack.length === 0) {
        tree.push(node);
      } else {
        stack[stack.length - 1].children.push(node);
      }

      stack.push(node);
    });

    return tree;
  }

  detectCodeLanguage($element) {
    const classNames = $element.attr('class') || '';
    
    // Check for explicit language class
    const languageMatch = classNames.match(/(?:language-|lang-)(\w+)/);
    if (languageMatch) {
      return languageMatch[1];
    }

    // Check parent element
    const parentClass = $element.parent().attr('class') || '';
    const parentMatch = parentClass.match(/(?:language-|lang-)(\w+)/);
    if (parentMatch) {
      return parentMatch[1];
    }

    return 'text';
  }

  async enrichMetadata(document) {
    const { extractedContent, metadata, url } = document;
    
    // Technology detection
    const technologies = await this.detectTechnologies(extractedContent);
    
    // Difficulty assessment
    const difficulty = await this.assessDifficulty(extractedContent, metadata);
    
    // Content classification
    const classification = await this.classifyContent(extractedContent, url);
    
    // Extract key concepts
    const concepts = await this.extractConcepts(extractedContent);

    return {
      ...document,
      metadata: {
        ...metadata,
        technologies,
        difficulty,
        classification,
        concepts,
        enrichedAt: new Date().toISOString()
      }
    };
  }

  async detectTechnologies(content) {
    const techPatterns = {
      javascript: /javascript|js|node\.?js|npm|yarn/gi,
      typescript: /typescript|ts|tsc/gi,
      react: /react|jsx|tsx|react\.js/gi,
      vue: /vue|vue\.js|vuex|nuxt/gi,
      angular: /angular|ng-|@angular/gi,
      python: /python|py|pip|django|flask|fastapi/gi,
      java: /java|spring|maven|gradle/gi,
      csharp: /c#|\.net|dotnet|nuget/gi,
      go: /golang|go mod|go get/gi,
      rust: /rust|cargo|rustc/gi,
      php: /php|composer|laravel|symfony/gi,
      ruby: /ruby|rails|gem|bundler/gi,
      sql: /sql|mysql|postgresql|sqlite|mongodb/gi,
      docker: /docker|dockerfile|container/gi,
      kubernetes: /kubernetes|k8s|kubectl|helm/gi,
      aws: /aws|amazon web services|ec2|s3|lambda/gi,
      git: /git|github|gitlab|bitbucket/gi
    };

    const detected = [];
    
    Object.entries(techPatterns).forEach(([tech, pattern]) => {
      if (pattern.test(content)) {
        detected.push(tech);
      }
    });

    return detected;
  }

  async assessDifficulty(content, metadata) {
    // Simple heuristic-based difficulty assessment
    let score = 1; // Base difficulty (beginner)
    
    // Code complexity
    if (metadata.codeBlocks?.length > 0) {
      const complexityScores = metadata.codeBlocks.map(cb => {
        switch (cb.metadata?.complexity) {
          case 'very_complex': return 4;
          case 'complex': return 3;
          case 'moderate': return 2;
          default: return 1;
        }
      });
      score += Math.max(...complexityScores) - 1;
    }

    // Technical vocabulary density
    const technicalTerms = content.match(/\b(?:API|SDK|framework|architecture|algorithm|implementation|configuration|optimization|deployment)\b/gi) || [];
    const density = technicalTerms.length / this.countWords(content);
    if (density > 0.05) score += 1;
    if (density > 0.1) score += 1;

    // Advanced concepts
    const advancedPatterns = [
      /design patterns?/gi,
      /microservices?/gi,
      /distributed systems?/gi,
      /machine learning/gi,
      /artificial intelligence/gi,
      /blockchain/gi,
      /cryptography/gi
    ];

    advancedPatterns.forEach(pattern => {
      if (pattern.test(content)) score += 1;
    });

    // Clamp score between 1 and 5
    return Math.min(Math.max(score, 1), 5);
  }

  async classifyContent(content, url) {
    const classifications = [];

    // URL-based classification
    if (url) {
      if (url.includes('/api/') || url.includes('/reference/')) {
        classifications.push('reference');
      }
      if (url.includes('/tutorial/') || url.includes('/guide/')) {
        classifications.push('tutorial');
      }
      if (url.includes('/blog/') || url.includes('/article/')) {
        classifications.push('article');
      }
    }

    // Content-based classification
    const contentLower = content.toLowerCase();
    
    if (contentLower.includes('step by step') || contentLower.includes('tutorial')) {
      classifications.push('tutorial');
    }
    if (contentLower.includes('best practice') || contentLower.includes('recommendation')) {
      classifications.push('best-practices');
    }
    if (contentLower.includes('troubleshoot') || contentLower.includes('error') || contentLower.includes('fix')) {
      classifications.push('troubleshooting');
    }
    if (content.match(/function\s+\w+|class\s+\w+|interface\s+\w+/g)) {
      classifications.push('code-reference');
    }

    return classifications.length > 0 ? classifications : ['general'];
  }

  async extractConcepts(content) {
    // Simple concept extraction using OpenAI
    try {
      const prompt = `
Extract the main technical concepts from this content. Return only the key concepts as a comma-separated list.

Content: ${content.substring(0, 2000)}...

Key concepts:`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.1
      });

      const concepts = response.choices[0].message.content
        .split(',')
        .map(concept => concept.trim())
        .filter(concept => concept.length > 0);

      return concepts;
    } catch (error) {
      logger.warn('Concept extraction failed:', error);
      return [];
    }
  }

  async analyzeSemantics(document) {
    const { extractedContent } = document;
    
    try {
      // Generate semantic summary
      const summary = await this.generateSummary(extractedContent);
      
      // Extract semantic tags
      const semanticTags = await this.generateSemanticTags(extractedContent);
      
      return {
        ...document,
        semanticAnalysis: {
          summary,
          semanticTags,
          analyzedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.warn('Semantic analysis failed:', error);
      return document;
    }
  }

  async generateSummary(content) {
    const prompt = `
Summarize this technical content in 2-3 sentences. Focus on what the content teaches or explains:

${content.substring(0, 3000)}...

Summary:`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      temperature: 0.2
    });

    return response.choices[0].message.content.trim();
  }

  async generateSemanticTags(content) {
    const prompt = `
Generate relevant tags for this technical content. Return 5-10 tags that describe the main topics, technologies, and concepts:

${content.substring(0, 2000)}...

Tags (comma-separated):`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 80,
      temperature: 0.1
    });

    return response.choices[0].message.content
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0);
  }

  async generateEmbeddings(document) {
    const { extractedContent, title = '' } = document;
    
    try {
      // Chunk content for embedding
      const chunks = this.chunkContent(extractedContent);
      const embeddings = [];

      for (const [index, chunk] of chunks.entries()) {
        const combinedText = title ? `${title}\n\n${chunk}` : chunk;
        
        const response = await openai.embeddings.create({
          model: 'text-embedding-3-large',
          input: combinedText.substring(0, 8000), // OpenAI limit
          dimensions: 1536
        });

        embeddings.push({
          chunkIndex: index,
          content: chunk,
          embedding: response.data[0].embedding,
          metadata: {
            chunkSize: chunk.length,
            hasTitle: !!title
          }
        });
      }

      return {
        ...document,
        embeddings,
        embeddingMetadata: {
          totalChunks: chunks.length,
          model: 'text-embedding-3-large',
          dimensions: 1536,
          generatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('Embedding generation failed:', error);
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
  }

  chunkContent(content, maxChunkSize = 1000, overlap = 200) {
    const words = content.split(/\s+/);
    const chunks = [];
    
    for (let i = 0; i < words.length; i += maxChunkSize - overlap) {
      const chunk = words.slice(i, i + maxChunkSize).join(' ');
      if (chunk.trim().length > 0) {
        chunks.push(chunk);
      }
    }

    return chunks.length > 0 ? chunks : [content];
  }

  async validateQuality(document) {
    const { extractedContent, metadata } = document;
    
    const qualityScore = this.calculateQualityScore(extractedContent, metadata);
    const issues = this.identifyQualityIssues(extractedContent, metadata);

    return {
      ...document,
      qualityAssessment: {
        score: qualityScore,
        issues,
        validatedAt: new Date().toISOString()
      }
    };
  }

  calculateQualityScore(content, metadata) {
    let score = 0;
    
    // Content length (optimal range: 500-5000 words)
    const wordCount = this.countWords(content);
    if (wordCount >= 500 && wordCount <= 5000) score += 25;
    else if (wordCount >= 200) score += 15;
    else score += 5;

    // Structure (headings, paragraphs)
    if (metadata.headings?.length > 0) score += 20;
    if (metadata.sections?.length > 1) score += 15;

    // Code examples
    if (metadata.codeBlocks?.length > 0) score += 20;

    // Metadata completeness
    if (metadata.technologies?.length > 0) score += 10;
    if (metadata.concepts?.length > 0) score += 10;

    return Math.min(score, 100);
  }

  identifyQualityIssues(content, metadata) {
    const issues = [];
    
    const wordCount = this.countWords(content);
    if (wordCount < 100) {
      issues.push({ type: 'content_length', severity: 'high', message: 'Content too short' });
    }
    
    if (!metadata.headings || metadata.headings.length === 0) {
      issues.push({ type: 'structure', severity: 'medium', message: 'No headings found' });
    }
    
    if (content.includes('Lorem ipsum')) {
      issues.push({ type: 'placeholder', severity: 'high', message: 'Contains placeholder text' });
    }

    return issues;
  }

  countWords(text) {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  calculateReadingTime(text) {
    const wordsPerMinute = 200;
    const wordCount = this.countWords(text);
    return Math.ceil(wordCount / wordsPerMinute);
  }
}

// Initialize processor
const processor = new DocumentProcessor();

// Queue processor
processingQueue.process('process-document', async (job) => {
  const { documentId, document } = job.data;
  
  try {
    // Process document
    const processedDoc = await processor.process(document);
    
    // Store processed document and embeddings
    await storeProcessedDocument(processedDoc);
    
    return {
      documentId,
      status: 'completed',
      chunks: processedDoc.embeddings?.length || 0,
      qualityScore: processedDoc.qualityAssessment?.score || 0
    };
  } catch (error) {
    logger.error(`Processing failed for document ${documentId}:`, error);
    throw error;
  }
});

// Store processed document in database
async function storeProcessedDocument(processedDoc) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Update document with processed content and metadata
    const updateDocQuery = `
      UPDATE documents 
      SET 
        content = $1,
        metadata = $2,
        difficulty_level = $3,
        authority_score = $4,
        updated_at = NOW()
      WHERE id = $5
    `;
    
    await client.query(updateDocQuery, [
      processedDoc.extractedContent,
      JSON.stringify(processedDoc.metadata),
      processedDoc.metadata.difficulty || 2,
      processedDoc.qualityAssessment?.score || 50,
      processedDoc.id
    ]);

    // Store embeddings
    if (processedDoc.embeddings) {
      // Delete existing embeddings
      await client.query('DELETE FROM document_embeddings WHERE document_id = $1', [processedDoc.id]);
      
      // Insert new embeddings
      for (const embedding of processedDoc.embeddings) {
        const embeddingQuery = `
          INSERT INTO document_embeddings (
            document_id, chunk_index, content_text, embedding, chunk_metadata
          ) VALUES ($1, $2, $3, $4, $5)
        `;
        
        await client.query(embeddingQuery, [
          processedDoc.id,
          embedding.chunkIndex,
          embedding.content,
          `[${embedding.embedding.join(',')}]`,
          JSON.stringify(embedding.metadata)
        ]);
      }
    }

    await client.query('COMMIT');
    logger.info(`Stored processed document ${processedDoc.id} with ${processedDoc.embeddings?.length || 0} embeddings`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// API Routes

// Process document
app.post('/process', async (req, res) => {
  try {
    const { document, options = {} } = req.body;

    if (!document) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'Document is required'
      });
    }

    // Add to processing queue
    const job = await processingQueue.add('process-document', {
      documentId: document.id,
      document,
      options
    }, {
      priority: options.priority === 'high' ? 10 : 5,
      attempts: 3,
      backoff: 'exponential'
    });

    res.status(202).json({
      jobId: job.id,
      status: 'accepted',
      message: 'Document processing queued'
    });

  } catch (error) {
    logger.error('Processing request error:', error);
    res.status(500).json({
      error: 'PROCESSING_ERROR',
      message: 'Failed to queue document for processing'
    });
  }
});

// Get processing job status
app.get('/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await processingQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Job not found'
      });
    }

    const progress = await job.progress();
    
    res.json({
      id: job.id,
      status: await job.getState(),
      progress,
      data: job.data,
      result: job.returnvalue,
      error: job.failedReason,
      createdAt: new Date(job.timestamp).toISOString(),
      processedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
      finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null
    });

  } catch (error) {
    logger.error('Job status error:', error);
    res.status(500).json({
      error: 'JOB_ERROR',
      message: 'Failed to get job status'
    });
  }
});

// List processing jobs
app.get('/jobs', async (req, res) => {
  try {
    const { status, limit = 20 } = req.query;
    
    const jobs = await processingQueue.getJobs([status || 'waiting', 'active', 'completed', 'failed'], 0, limit - 1);
    
    const jobData = await Promise.all(jobs.map(async (job) => ({
      id: job.id,
      status: await job.getState(),
      data: job.data,
      createdAt: new Date(job.timestamp).toISOString()
    })));

    res.json({
      jobs: jobData,
      total: jobData.length
    });

  } catch (error) {
    logger.error('Jobs list error:', error);
    res.status(500).json({
      error: 'JOBS_ERROR',
      message: 'Failed to list jobs'
    });
  }
});

// Queue statistics
app.get('/stats', async (req, res) => {
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      processingQueue.getWaiting(),
      processingQueue.getActive(),
      processingQueue.getCompleted(),
      processingQueue.getFailed()
    ]);

    res.json({
      queue: {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length
      },
      workers: processingQueue.workers.length
    });

  } catch (error) {
    logger.error('Stats error:', error);
    res.status(500).json({
      error: 'STATS_ERROR',
      message: 'Failed to get queue statistics'
    });
  }
});

// Health check
app.get('/health', async (req, res) => {
  try {
    // Check database
    await pool.query('SELECT 1');
    
    // Check Redis
    await redis.ping();
    
    // Check queue
    const queueHealth = await processingQueue.isReady();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        redis: 'connected',
        queue: queueHealth ? 'ready' : 'not_ready',
        workers: processingQueue.workers.length
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
  logger.info(`Processing service listening on port ${port}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  
  await processingQueue.close();
  await redis.quit();
  await pool.end();
  
  process.exit(0);
});

module.exports = app;