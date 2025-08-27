const EnhancedAppleMailSync = require('../../../src/services/EnhancedAppleMailSync');

// Mock dependencies
jest.mock('better-sqlite3');
jest.mock('../../../src/database/OptimizedDatabaseAgent');

describe('EnhancedAppleMailSync', () => {
  let mockSqliteDb;
  let mockSupabaseClient;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock SQLite database
    const Database = require('better-sqlite3');
    mockSqliteDb = {
      prepare: jest.fn(),
      close: jest.fn()
    };
    Database.mockReturnValue(mockSqliteDb);

    // Mock Supabase client
    const OptimizedDatabaseAgent = require('../../../src/database/OptimizedDatabaseAgent');
    mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn()
    };
    OptimizedDatabaseAgent.getSupabaseClient = jest.fn().mockReturnValue(mockSupabaseClient);
  });

  describe('syncEmails', () => {
    it('should sync new emails from Apple Mail to Supabase', async () => {
      // Mock Apple Mail SQLite query results
      const mockAppleMailEmails = [
        {
          ROWID: 1,
          subject: 'Test Email 1',
          sender: 'sender1@example.com',
          date_received: 1705123200, // Unix timestamp
          message_id: 'msg-1@example.com',
          snippet: 'This is a test email...'
        },
        {
          ROWID: 2,
          subject: 'Test Email 2',
          sender: 'sender2@example.com',
          date_received: 1705209600,
          message_id: 'msg-2@example.com',
          snippet: 'Another test email...'
        }
      ];

      const mockStmt = {
        all: jest.fn().mockReturnValue(mockAppleMailEmails)
      };
      mockSqliteDb.prepare.mockReturnValue(mockStmt);

      // Mock Supabase responses
      mockSupabaseClient.single.mockResolvedValueOnce({ data: null, error: null }); // No existing emails
      mockSupabaseClient.insert.mockResolvedValue({ data: mockAppleMailEmails, error: null });

      const syncService = new EnhancedAppleMailSync();
      const result = await syncService.syncEmails();

      expect(result.success).toBe(true);
      expect(result.emailsProcessed).toBe(2);
      expect(result.newEmails).toBe(2);
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            apple_mail_id: 1,
            subject: 'Test Email 1',
            sender: 'sender1@example.com'
          })
        ])
      );
    });

    it('should skip existing emails during sync', async () => {
      const mockAppleMailEmails = [
        {
          ROWID: 1,
          subject: 'Existing Email',
          sender: 'sender@example.com',
          date_received: 1705123200,
          message_id: 'existing@example.com',
          snippet: 'This email already exists...'
        }
      ];

      const mockStmt = {
        all: jest.fn().mockReturnValue(mockAppleMailEmails)
      };
      mockSqliteDb.prepare.mockReturnValue(mockStmt);

      // Mock existing email in Supabase
      mockSupabaseClient.single.mockResolvedValue({ 
        data: { id: 'existing-uuid', apple_mail_id: 1 }, 
        error: null 
      });

      const syncService = new EnhancedAppleMailSync();
      const result = await syncService.syncEmails();

      expect(result.success).toBe(true);
      expect(result.emailsProcessed).toBe(1);
      expect(result.newEmails).toBe(0);
      expect(result.skippedEmails).toBe(1);
      expect(mockSupabaseClient.insert).not.toHaveBeenCalled();
    });

    it('should handle SQLite database connection errors', async () => {
      const Database = require('better-sqlite3');
      Database.mockImplementation(() => {
        throw new Error('Database file not found');
      });

      const syncService = new EnhancedAppleMailSync();
      const result = await syncService.syncEmails();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database file not found');
    });

    it('should handle Supabase insertion errors', async () => {
      const mockAppleMailEmails = [
        {
          ROWID: 1,
          subject: 'Test Email',
          sender: 'sender@example.com',
          date_received: 1705123200,
          message_id: 'msg@example.com',
          snippet: 'Test content...'
        }
      ];

      const mockStmt = {
        all: jest.fn().mockReturnValue(mockAppleMailEmails)
      };
      mockSqliteDb.prepare.mockReturnValue(mockStmt);

      mockSupabaseClient.single.mockResolvedValue({ data: null, error: null });
      mockSupabaseClient.insert.mockResolvedValue({ 
        data: null, 
        error: { message: 'Database connection failed' } 
      });

      const syncService = new EnhancedAppleMailSync();
      const result = await syncService.syncEmails();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection failed');
    });
  });

  describe('getSyncStatus', () => {
    it('should return accurate sync status', async () => {
      // Mock Apple Mail count
      const mockCountStmt = {
        get: jest.fn().mockReturnValue({ count: 1000 })
      };
      mockSqliteDb.prepare.mockReturnValue(mockCountStmt);

      // Mock Supabase count
      mockSupabaseClient.single.mockResolvedValue({ 
        data: { count: 850 }, 
        error: null 
      });

      const syncService = new EnhancedAppleMailSync();
      const status = await syncService.getSyncStatus();

      expect(status.emailsInAppleMail).toBe(1000);
      expect(status.emailsInPostgres).toBe(850);
      expect(status.percentComplete).toBe(85);
      expect(status.isSynced).toBe(false);
    });

    it('should indicate complete sync when counts match', async () => {
      const mockCountStmt = {
        get: jest.fn().mockReturnValue({ count: 1000 })
      };
      mockSqliteDb.prepare.mockReturnValue(mockCountStmt);

      mockSupabaseClient.single.mockResolvedValue({ 
        data: { count: 1000 }, 
        error: null 
      });

      const syncService = new EnhancedAppleMailSync();
      const status = await syncService.getSyncStatus();

      expect(status.emailsInAppleMail).toBe(1000);
      expect(status.emailsInPostgres).toBe(1000);
      expect(status.percentComplete).toBe(100);
      expect(status.isSynced).toBe(true);
    });
  });

  describe('getEmailBreakdown', () => {
    it('should categorize emails correctly', async () => {
      // Mock categorized email counts
      mockSupabaseClient.single
        .mockResolvedValueOnce({ data: { count: 1000 }, error: null }) // Total
        .mockResolvedValueOnce({ data: { count: 300 }, error: null })  // Tasks
        .mockResolvedValueOnce({ data: { count: 700 }, error: null })  // FYI
        .mockResolvedValueOnce({ data: { count: 50 }, error: null })   // Today
        .mockResolvedValueOnce({ data: { count: 200 }, error: null })  // Week
        .mockResolvedValueOnce({ data: { count: 500 }, error: null }); // Month

      const syncService = new EnhancedAppleMailSync();
      const breakdown = await syncService.getEmailBreakdown();

      expect(breakdown.total).toBe(1000);
      expect(breakdown.tasks.count).toBe(300);
      expect(breakdown.tasks.percentage).toBe(30);
      expect(breakdown.fyi.count).toBe(700);
      expect(breakdown.fyi.percentage).toBe(70);
      expect(breakdown.today).toBe(50);
      expect(breakdown.week).toBe(200);
      expect(breakdown.month).toBe(500);
    });
  });

  describe('validateEmailData', () => {
    it('should validate complete email data', () => {
      const validEmail = {
        ROWID: 1,
        subject: 'Valid Email',
        sender: 'sender@example.com',
        date_received: 1705123200,
        message_id: 'valid@example.com'
      };

      const syncService = new EnhancedAppleMailSync();
      const isValid = syncService.validateEmailData(validEmail);

      expect(isValid).toBe(true);
    });

    it('should reject incomplete email data', () => {
      const invalidEmails = [
        { ROWID: 1 }, // Missing required fields
        { subject: 'No ID' }, // Missing ROWID
        { ROWID: 1, subject: '', sender: 'test@example.com' }, // Empty subject
        { ROWID: 1, subject: 'Test', sender: 'invalid-email' } // Invalid email format
      ];

      const syncService = new EnhancedAppleMailSync();

      invalidEmails.forEach(email => {
        expect(syncService.validateEmailData(email)).toBe(false);
      });
    });
  });

  describe('transformEmailData', () => {
    it('should transform Apple Mail data to Supabase format', () => {
      const appleMailEmail = {
        ROWID: 123,
        subject: 'Test Subject',
        sender: 'John Doe <john@example.com>',
        date_received: 1705123200,
        message_id: 'msg123@example.com',
        snippet: 'This is a test email snippet...',
        to_recipients: 'user@company.com',
        cc_recipients: 'cc@company.com',
        bcc_recipients: null,
        reply_to: 'noreply@example.com',
        has_attachments: 1,
        attachment_count: 2,
        is_read: 0,
        is_flagged: 1,
        flag_color: 'red',
        priority: 3,
        labels: 'work,important',
        folder_path: 'INBOX'
      };

      const syncService = new EnhancedAppleMailSync();
      const transformed = syncService.transformEmailData(appleMailEmail);

      expect(transformed.apple_mail_id).toBe(123);
      expect(transformed.subject).toBe('Test Subject');
      expect(transformed.sender).toBe('John Doe <john@example.com>');
      expect(transformed.date_received).toBeInstanceOf(Date);
      expect(transformed.message_id).toBe('msg123@example.com');
      expect(transformed.has_attachments).toBe(true);
      expect(transformed.attachment_count).toBe(2);
      expect(transformed.is_read).toBe(false);
      expect(transformed.is_flagged).toBe(true);
      expect(transformed.labels).toEqual(['work', 'important']);
    });

    it('should handle null and undefined values gracefully', () => {
      const minimalEmail = {
        ROWID: 456,
        subject: 'Minimal Email',
        sender: 'minimal@example.com',
        date_received: 1705123200,
        message_id: 'minimal@example.com'
      };

      const syncService = new EnhancedAppleMailSync();
      const transformed = syncService.transformEmailData(minimalEmail);

      expect(transformed.apple_mail_id).toBe(456);
      expect(transformed.to_recipients).toBeNull();
      expect(transformed.cc_recipients).toBeNull();
      expect(transformed.has_attachments).toBe(false);
      expect(transformed.attachment_count).toBe(0);
      expect(transformed.labels).toEqual([]);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle empty Apple Mail database', async () => {
      const mockStmt = {
        all: jest.fn().mockReturnValue([])
      };
      mockSqliteDb.prepare.mockReturnValue(mockStmt);

      const syncService = new EnhancedAppleMailSync();
      const result = await syncService.syncEmails();

      expect(result.success).toBe(true);
      expect(result.emailsProcessed).toBe(0);
      expect(result.newEmails).toBe(0);
    });

    it('should handle malformed email data', async () => {
      const mockMalformedEmails = [
        { ROWID: 'invalid' }, // Invalid ID type
        { ROWID: 1, subject: null }, // Null subject
        { ROWID: 2, date_received: 'invalid-date' } // Invalid date
      ];

      const mockStmt = {
        all: jest.fn().mockReturnValue(mockMalformedEmails)
      };
      mockSqliteDb.prepare.mockReturnValue(mockStmt);

      const syncService = new EnhancedAppleMailSync();
      const result = await syncService.syncEmails();

      expect(result.success).toBe(true);
      expect(result.emailsProcessed).toBe(3);
      expect(result.newEmails).toBe(0);
      expect(result.errors).toHaveLength(3);
    });

    it('should handle partial sync failures gracefully', async () => {
      const mockEmails = [
        {
          ROWID: 1,
          subject: 'Valid Email',
          sender: 'valid@example.com',
          date_received: 1705123200,
          message_id: 'valid@example.com'
        },
        {
          ROWID: 2,
          subject: 'Another Valid Email',
          sender: 'valid2@example.com',
          date_received: 1705123300,
          message_id: 'valid2@example.com'
        }
      ];

      const mockStmt = {
        all: jest.fn().mockReturnValue(mockEmails)
      };
      mockSqliteDb.prepare.mockReturnValue(mockStmt);

      mockSupabaseClient.single.mockResolvedValue({ data: null, error: null });
      mockSupabaseClient.insert
        .mockResolvedValueOnce({ data: [mockEmails[0]], error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'Constraint violation' } });

      const syncService = new EnhancedAppleMailSync();
      const result = await syncService.syncEmails();

      expect(result.success).toBe(true); // Partial success
      expect(result.newEmails).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });
});