/**
 * Email Management Repository Implementation
 * Concrete repository for EmailThread aggregate with Supabase integration
 */

import { SupabaseRepository, QueryCriteria, BaseSpecification } from '../../shared/Repository';
import { EmailThread, EmailSubject, EmailAddress, EmailContent, Email, EmailAttachment } from '../models/EmailThread';

// EmailThread Repository Implementation
export class EmailThreadRepository extends SupabaseRepository<EmailThread> {
  constructor(supabaseClient: any) {
    super(supabaseClient, 'email_threads');
  }
  
  protected async mapFromDatabase(record: any): Promise<EmailThread> {
    // Create subject
    const subject = new EmailSubject(record.subject);
    
    // Get initial email data
    const { data: emailsData, error: emailsError } = await this.supabaseClient
      .from('emails')
      .select(`
        *,
        attachments:email_attachments(*)
      `)
      .eq('thread_id', record.id)
      .order('sent_at', { ascending: true });
    
    if (emailsError) {
      throw new Error(`Failed to load emails for thread: ${emailsError.message}`);
    }
    
    const emails = await Promise.all(
      emailsData.map(async (emailData: any) => this.mapEmailFromDatabase(emailData))
    );
    
    if (emails.length === 0) {
      throw new Error(`Thread ${record.id} has no emails`);
    }
    
    // Create thread with initial email
    const thread = new EmailThread(
      record.id,
      subject,
      emails[0]
    );
    
    // Add remaining emails
    for (let i = 1; i < emails.length; i++) {
      thread.addEmail(emails[i]);
    }
    
    // Restore thread state
    if (record.is_archived) {
      (thread as any)._isArchived = true;
    }
    
    if (record.is_muted) {
      (thread as any)._isMuted = true;
    }
    
    // Set version for optimistic locking
    thread.version = record.version || 0;
    
    return thread;
  }
  
  protected async mapToDatabase(aggregate: EmailThread): Promise<any> {
    return {
      id: aggregate.getId(),
      subject: aggregate.subject.value,
      is_archived: aggregate.isArchived,
      is_muted: aggregate.isMuted,
      email_count: aggregate.emailCount,
      participant_count: aggregate.participants.length,
      last_activity: aggregate.lastActivity,
      created_at: new Date(), // This should come from the aggregate if tracked
      updated_at: new Date(),
      version: aggregate.version + 1
    };
  }
  
  protected async saveRelatedEntities(aggregate: EmailThread): Promise<void> {
    // Save all emails in the thread
    const emails = aggregate.emails;
    
    for (const email of emails) {
      await this.saveEmail(email, aggregate.getId());
    }
  }
  
  private async saveEmail(email: Email, threadId: string): Promise<void> {
    // Check if email already exists
    const { data: existingEmail } = await this.supabaseClient
      .from('emails')
      .select('id')
      .eq('id', email.getId())
      .single();
    
    const emailRecord = {
      id: email.getId(),
      thread_id: threadId,
      message_id: email.messageId,
      subject: email.subject.value,
      from_email: email.from.email,
      from_name: email.from.displayName,
      to_emails: email.to.map(addr => addr.email),
      to_names: email.to.map(addr => addr.displayName),
      cc_emails: email.cc.map(addr => addr.email),
      bcc_emails: email.bcc.map(addr => addr.email),
      content_plain: email.content.plainText,
      content_html: email.content.html,
      sent_at: email.sentAt,
      is_read: email.isRead,
      is_flagged: email.isFlagged,
      labels: email.labels,
      in_reply_to: email.inReplyTo,
      references: email.references,
      has_attachments: email.hasAttachments(),
      attachment_count: email.attachments.length,
      created_at: existingEmail ? undefined : new Date(),
      updated_at: new Date()
    };
    
    if (existingEmail) {
      // Update existing email
      const { error } = await this.supabaseClient
        .from('emails')
        .update(emailRecord)
        .eq('id', email.getId());
      
      if (error) {
        throw new Error(`Failed to update email: ${error.message}`);
      }
    } else {
      // Insert new email
      const { error } = await this.supabaseClient
        .from('emails')
        .insert([emailRecord]);
      
      if (error) {
        throw new Error(`Failed to insert email: ${error.message}`);
      }
    }
    
    // Save attachments
    if (email.attachments.length > 0) {
      await this.saveEmailAttachments(email.getId(), email.attachments);
    }
  }
  
  private async saveEmailAttachments(emailId: string, attachments: EmailAttachment[]): Promise<void> {
    // Delete existing attachments first
    await this.supabaseClient
      .from('email_attachments')
      .delete()
      .eq('email_id', emailId);
    
    // Insert new attachments
    const attachmentRecords = attachments.map(attachment => ({
      id: attachment.getId(),
      email_id: emailId,
      filename: attachment.filename,
      mime_type: attachment.mimeType,
      size: attachment.size,
      content_id: attachment.contentId,
      is_inline: attachment.isInline,
      created_at: new Date()
    }));
    
    if (attachmentRecords.length > 0) {
      const { error } = await this.supabaseClient
        .from('email_attachments')
        .insert(attachmentRecords);
      
      if (error) {
        throw new Error(`Failed to save email attachments: ${error.message}`);
      }
    }
  }
  
  private async mapEmailFromDatabase(emailData: any): Promise<Email> {
    // Create email addresses
    const from = new EmailAddress(emailData.from_email, emailData.from_name);
    
    const to = (emailData.to_emails || []).map((email: string, index: number) => 
      new EmailAddress(email, emailData.to_names?.[index])
    );
    
    const cc = (emailData.cc_emails || []).map((email: string) => 
      new EmailAddress(email)
    );
    
    const bcc = (emailData.bcc_emails || []).map((email: string) => 
      new EmailAddress(email)
    );
    
    // Create content
    const content = new EmailContent(
      emailData.content_plain,
      emailData.content_html
    );
    
    // Create subject
    const subject = new EmailSubject(emailData.subject);
    
    // Create attachments
    const attachments = (emailData.attachments || []).map((attachmentData: any) => 
      new EmailAttachment(
        attachmentData.id,
        attachmentData.filename,
        attachmentData.mime_type,
        attachmentData.size,
        attachmentData.content_id,
        attachmentData.is_inline
      )
    );
    
    // Create email
    const email = new Email(
      emailData.id,
      emailData.message_id,
      subject,
      from,
      to,
      content,
      new Date(emailData.sent_at),
      cc,
      bcc,
      attachments,
      emailData.in_reply_to,
      emailData.references
    );
    
    // Restore email state
    if (emailData.is_read) {
      email.markAsRead();
    }
    
    if (emailData.is_flagged) {
      email.toggleFlag();
    }
    
    (emailData.labels || []).forEach((label: string) => {
      email.addLabel(label);
    });
    
    return email;
  }
  
  // Domain-specific query methods
  async findBySubject(subject: string): Promise<EmailThread[]> {
    const criteria: QueryCriteria = {
      filters: [
        {
          field: 'subject',
          operator: 'ilike' as any,
          value: `%${subject}%`
        }
      ]
    };
    
    return this.findBy(criteria);
  }
  
  async findByParticipant(email: string): Promise<EmailThread[]> {
    // This requires a custom query since participants are derived from emails
    const { data, error } = await this.supabaseClient
      .from('email_threads')
      .select(`
        *,
        emails!inner(
          from_email,
          to_emails,
          cc_emails,
          bcc_emails
        )
      `)
      .or(`emails.from_email.eq.${email},emails.to_emails.cs.{${email}},emails.cc_emails.cs.{${email}},emails.bcc_emails.cs.{${email}}`);
    
    if (error) {
      throw new Error(`Failed to find threads by participant: ${error.message}`);
    }
    
    return Promise.all(
      data.map((record: any) => this.mapFromDatabase(record))
    );
  }
  
  async findArchivedThreads(): Promise<EmailThread[]> {
    const criteria: QueryCriteria = {
      filters: [
        {
          field: 'is_archived',
          operator: 'eq' as any,
          value: true
        }
      ],
      sorts: [
        {
          field: 'last_activity',
          direction: 'desc'
        }
      ]
    };
    
    return this.findBy(criteria);
  }
  
  async findUnreadThreads(): Promise<EmailThread[]> {
    // This requires joining with emails table
    const { data, error } = await this.supabaseClient
      .from('email_threads')
      .select(`
        *,
        emails!inner(*)
      `)
      .eq('emails.is_read', false);
    
    if (error) {
      throw new Error(`Failed to find unread threads: ${error.message}`);
    }
    
    // Remove duplicates and map to domain objects
    const uniqueThreads = new Map<string, any>();
    data.forEach((record: any) => {
      if (!uniqueThreads.has(record.id)) {
        uniqueThreads.set(record.id, record);
      }
    });
    
    return Promise.all(
      Array.from(uniqueThreads.values()).map(record => this.mapFromDatabase(record))
    );
  }
  
  async findRecentThreads(days: number = 7): Promise<EmailThread[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    
    const criteria: QueryCriteria = {
      filters: [
        {
          field: 'last_activity',
          operator: 'gte' as any,
          value: since.toISOString()
        }
      ],
      sorts: [
        {
          field: 'last_activity',
          direction: 'desc'
        }
      ]
    };
    
    return this.findBy(criteria);
  }
}

// Email Thread Specifications for complex queries
export class UnreadEmailThreadSpecification extends BaseSpecification<EmailThread> {
  isSatisfiedBy(thread: EmailThread): boolean {
    return thread.hasUnreadEmails();
  }
  
  toCriteria(): QueryCriteria {
    // This would require a complex join query in the actual implementation
    return {
      filters: []
    };
  }
}

export class ArchivedEmailThreadSpecification extends BaseSpecification<EmailThread> {
  isSatisfiedBy(thread: EmailThread): boolean {
    return thread.isArchived;
  }
  
  toCriteria(): QueryCriteria {
    return {
      filters: [
        {
          field: 'is_archived',
          operator: 'eq' as any,
          value: true
        }
      ]
    };
  }
}

export class EmailThreadByParticipantSpecification extends BaseSpecification<EmailThread> {
  constructor(private participantEmail: string) {
    super();
  }
  
  isSatisfiedBy(thread: EmailThread): boolean {
    return thread.participants.includes(this.participantEmail);
  }
  
  toCriteria(): QueryCriteria {
    // This requires a custom query implementation
    return {
      filters: []
    };
  }
}