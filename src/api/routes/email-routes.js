const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../../middleware/auth');
const EmailSyncService = require('../../services/EmailSyncService');
const DraftSyncService = require('../../services/DraftSyncService');
const AIChatBotService = require('../../services/AIChatBotService');
const logger = require('../../utils/logger');

// Initialize services - Temporarily disabled for testing
// const emailSyncService = new EmailSyncService();
// const draftSyncService = new DraftSyncService();
const aiChatBotService = new AIChatBotService();

// Initialize services on startup - COMMENTED OUT TO PREVENT BLOCKING
// (async () => {
//   try {
//     await emailSyncService.initialize();
//     await draftSyncService.initialize();
//     await aiChatBotService.initialize();
//     logger.info('Email API services initialized successfully');
//   } catch (error) {
//     logger.error('Failed to initialize email API services:', error);
//   }
// })();

// ============================================================================
// EMAIL ROUTES
// ============================================================================

/**
 * GET /api/emails
 * Get all emails with pagination and filtering
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, status, priority, sender, subject, dateFrom, dateTo } = req.query;
    const offset = (page - 1) * limit;

    // Build query
    let query = req.supabase
      .from('emails')
      .select(`
        *,
        email_analysis (
          classification,
          priority,
          sentiment,
          action_required
        )
      `)
      .order('date_received', { ascending: false });

    // Apply filters
    if (status) query = query.eq('read_status', status === 'read');
    if (priority) query = query.eq('email_analysis.priority', priority);
    if (sender) query = query.ilike('sender', `%${sender}%`);
    if (subject) query = query.ilike('subject', `%${subject}%`);
    if (dateFrom) query = query.gte('date_received', dateFrom);
    if (dateTo) query = query.lte('date_received', dateTo);

    // Get total count
    const { count } = await req.supabase
      .from('emails')
      .select('*', { count: 'exact', head: true });

    // Get paginated results
    const { data: emails, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      logger.error('Failed to fetch emails:', error);
      return res.status(500).json({ error: 'Failed to fetch emails' });
    }

    res.json({
      emails: emails || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    logger.error('Email fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/emails/:id
 * Get email by ID with analysis
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: email, error } = await req.supabase
      .from('emails')
      .select(`
        *,
        email_analysis (
          classification,
          priority,
          sentiment,
          action_required,
          analysis_data
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Email not found' });
      }
      logger.error('Failed to fetch email:', error);
      return res.status(500).json({ error: 'Failed to fetch email' });
    }

    res.json({ email });

  } catch (error) {
    logger.error('Email fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/emails/:id/read
 * Mark email as read/unread
 */
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { read } = req.body;

    if (typeof read !== 'boolean') {
      return res.status(400).json({ error: 'Read status must be boolean' });
    }

    const { data: email, error } = await req.supabase
      .from('emails')
      .update({ read_status: read })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update email read status:', error);
      return res.status(500).json({ error: 'Failed to update email' });
    }

    res.json({ email });

  } catch (error) {
    logger.error('Email update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/emails/:id/flag
 * Flag/unflag email
 */
router.put('/:id/flag', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { flag } = req.body;

    if (typeof flag !== 'boolean') {
      return res.status(400).json({ error: 'Flag status must be boolean' });
    }

    const { data: email, error } = await req.supabase
      .from('emails')
      .update({ flag_status: flag })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update email flag status:', error);
      return res.status(500).json({ error: 'Failed to update email' });
    }

    res.json({ email });

  } catch (error) {
    logger.error('Email update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/emails/search
 * Search emails with natural language
 */
router.post('/search', authenticateToken, async (req, res) => {
  try {
    const { query, filters = {} } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Use AI chat bot service for intelligent search
    const searchResult = await aiChatBotService.processQuery(query, { type: 'email_search', filters });

    res.json(searchResult);

  } catch (error) {
    logger.error('Email search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/emails/stats/overview
 * Get email statistics overview
 */
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    const stats = await emailSyncService.appleMailService.getEmailStats();

    res.json({ stats });

  } catch (error) {
    logger.error('Email stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// DRAFT ROUTES
// ============================================================================

/**
 * GET /api/drafts
 * Get all drafts with filtering
 */
router.get('/drafts', authenticateToken, async (req, res) => {
  try {
    const { status, priority, synced } = req.query;

    const drafts = await draftSyncService.getDrafts({
      status,
      priority,
      synced: synced === 'true'
    });

    res.json({ drafts });

  } catch (error) {
    logger.error('Draft fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/drafts
 * Create new draft
 */
router.post('/drafts', authenticateToken, async (req, res) => {
  try {
    const { subject, content, recipients, cc, bcc, priority, tags } = req.body;

    if (!subject) {
      return res.status(400).json({ error: 'Subject is required' });
    }

    const draft = await draftSyncService.createDraft({
      subject,
      content,
      recipients,
      cc,
      bcc,
      priority,
      tags
    });

    res.status(201).json({ draft });

  } catch (error) {
    logger.error('Draft creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/drafts/:id
 * Update draft
 */
router.put('/drafts/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const draft = await draftSyncService.updateDraft(id, updates);

    res.json({ draft });

  } catch (error) {
    logger.error('Draft update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/drafts/:id
 * Delete draft
 */
router.delete('/drafts/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    await draftSyncService.deleteDraft(id);

    res.json({ message: 'Draft deleted successfully' });

  } catch (error) {
    logger.error('Draft deletion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// AI CHAT BOT ROUTES
// ============================================================================

/**
 * POST /api/ai/chat
 * Process AI chat query
 */
router.post('/ai/chat', authenticateToken, async (req, res) => {
  try {
    const { query, context = {} } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const result = await aiChatBotService.processQuery(query, context);

    res.json(result);

  } catch (error) {
    logger.error('AI chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/ai/draft
 * Generate email draft using AI
 */
router.post('/ai/draft', authenticateToken, async (req, res) => {
  try {
    const { subject, recipients, tone, context } = req.body;

    if (!subject) {
      return res.status(400).json({ error: 'Subject is required' });
    }

    const result = await aiChatBotService.processQuery(
      `Write a ${tone || 'professional'} email draft about ${subject} to ${recipients?.join(', ') || 'recipient'}`,
      { type: 'draft_generation', context }
    );

    res.json(result);

  } catch (error) {
    logger.error('AI draft generation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// SYNC ROUTES
// ============================================================================

/**
 * POST /api/sync/emails
 * Trigger manual email sync
 */
router.post('/sync/emails', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    // Trigger manual sync
    await emailSyncService.performFullSync();

    res.json({ message: 'Email sync started successfully' });

  } catch (error) {
    logger.error('Manual email sync error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/sync/drafts
 * Trigger manual draft sync
 */
router.post('/sync/drafts', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    // Trigger manual draft sync
    await draftSyncService.syncDraftsToAppleMail();

    res.json({ message: 'Draft sync started successfully' });

  } catch (error) {
    logger.error('Manual draft sync error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/sync/status
 * Get sync service status
 */
router.get('/sync/status', authenticateToken, async (req, res) => {
  try {
    const emailSyncStatus = emailSyncService.getStatus();
    const draftSyncStatus = draftSyncService.getStatus();

    res.json({
      emailSync: emailSyncStatus,
      draftSync: draftSyncStatus
    });

  } catch (error) {
    logger.error('Sync status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * GET /api/emails/health
 * Health check for email services
 */
router.get('/health', authenticateToken, async (req, res) => {
  try {
    const health = {
      timestamp: new Date().toISOString(),
      services: {
        emailSync: emailSyncService.getStatus(),
        draftSync: draftSyncService.getStatus(),
        aiChatBot: aiChatBotService.getStatus()
      },
      database: 'connected',
      status: 'healthy'
    };

    res.json(health);

  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({ 
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
