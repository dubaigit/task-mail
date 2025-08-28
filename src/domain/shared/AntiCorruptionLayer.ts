/**
 * Anti-Corruption Layer Implementation
 * Protects domain integrity by translating between external services and domain models
 */

// Base Anti-Corruption Layer Interface
export interface AntiCorruptionLayer<TExternal, TDomain> {
  toDomain(external: TExternal): Promise<TDomain>;
  toExternal(domain: TDomain): Promise<TExternal>;
  isCompatible(external: TExternal): boolean;
  validate(external: TExternal): ValidationResult;
}

// Validation Result
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

// Apple Mail Database Anti-Corruption Layer
export class AppleMailAntiCorruptionLayer {
  // Convert Apple Mail database record to domain Email
  async appleMailMessageToDomainEmail(appleMailMessage: any): Promise<{
    email: any;
    thread: any;
  }> {
    try {
      // Validate Apple Mail message structure
      const validation = this.validateAppleMailMessage(appleMailMessage);
      if (!validation.isValid) {
        throw new Error(`Invalid Apple Mail message: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      // Extract and clean data
      const messageId = this.extractMessageId(appleMailMessage);
      const subject = this.cleanSubject(appleMailMessage.subject || '(No Subject)');
      const fromAddress = this.parseEmailAddress(appleMailMessage.sender || '');
      const toAddresses = this.parseEmailAddressList(appleMailMessage.to || '');
      const ccAddresses = this.parseEmailAddressList(appleMailMessage.cc || '');
      const bccAddresses = this.parseEmailAddressList(appleMailMessage.bcc || '');
      
      // Extract content with fallbacks
      const content = this.extractEmailContent(
        appleMailMessage.body || '',
        appleMailMessage.html_body
      );

      // Handle dates with timezone conversion
      const sentAt = this.parseAppleMailDate(appleMailMessage.date_sent);
      
      // Extract thread information
      const threadId = this.extractThreadId(appleMailMessage);
      const inReplyTo = appleMailMessage.in_reply_to;
      const references = this.parseReferences(appleMailMessage.references);
      
      // Handle attachments
      const attachments = await this.extractAttachments(appleMailMessage);
      
      // Create domain objects using factories
      const email = {
        id: crypto.randomUUID(),
        messageId,
        subject,
        from: fromAddress,
        to: toAddresses,
        cc: ccAddresses,
        bcc: bccAddresses,
        content,
        sentAt,
        attachments,
        inReplyTo,
        references,
        isRead: Boolean(appleMailMessage.read),
        isFlagged: Boolean(appleMailMessage.flagged),
        labels: this.extractLabels(appleMailMessage)
      };

      const thread = {
        id: threadId,
        subject: this.getThreadSubject(subject),
        initialEmailId: email.id
      };

      return { email, thread };
      
    } catch (error) {
      console.error('Error converting Apple Mail message:', error);
      throw new Error(`Failed to convert Apple Mail message: ${error.message}`);
    }
  }

  private validateAppleMailMessage(message: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Required fields validation
    if (!message.ROWID) {
      errors.push({
        field: 'ROWID',
        message: 'Apple Mail ROWID is required',
        code: 'MISSING_ROWID'
      });
    }

    if (!message.sender && !message.from) {
      errors.push({
        field: 'sender',
        message: 'Email sender is required',
        code: 'MISSING_SENDER'
      });
    }

    if (!message.to && !message.recipients) {
      warnings.push({
        field: 'recipients',
        message: 'Email has no recipients',
        code: 'NO_RECIPIENTS'
      });
    }

    // Date validation
    if (message.date_sent && !this.isValidDate(message.date_sent)) {
      warnings.push({
        field: 'date_sent',
        message: 'Invalid date format, using current date',
        code: 'INVALID_DATE'
      });
    }

    // Content validation
    if (!message.body && !message.html_body) {
      warnings.push({
        field: 'body',
        message: 'Email has no content',
        code: 'NO_CONTENT'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private extractMessageId(message: any): string {
    // Try various Apple Mail message ID fields
    return message.message_id || 
           message.Message_ID || 
           message.GUID ||
           `apple-mail-${message.ROWID}-${Date.now()}`;
  }

  private cleanSubject(subject: string): string {
    // Remove Apple Mail specific prefixes and clean up
    return subject
      .trim()
      .replace(/^(Re:|Fwd:|Fw:)\s*/gi, '')
      .replace(/\s+/g, ' ')
      .substring(0, 998); // Ensure it fits in database
  }

  private parseEmailAddress(addressString: string): { email: string; displayName?: string } {
    if (!addressString || typeof addressString !== 'string') {
      return { email: 'unknown@unknown.com', displayName: 'Unknown' };
    }

    // Handle various email formats
    const emailRegex = /<([^>]+)>/;
    const match = addressString.match(emailRegex);
    
    if (match) {
      // Format: "Display Name <email@domain.com>"
      const email = match[1];
      const displayName = addressString.replace(emailRegex, '').trim().replace(/^["']|["']$/g, '');
      return { email, displayName: displayName || undefined };
    }
    
    // Simple email format
    const simpleEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (simpleEmailRegex.test(addressString.trim())) {
      return { email: addressString.trim() };
    }
    
    // Fallback for malformed addresses
    return { email: 'malformed@unknown.com', displayName: addressString };
  }

  private parseEmailAddressList(addressList: string): Array<{ email: string; displayName?: string }> {
    if (!addressList || typeof addressList !== 'string') {
      return [];
    }

    // Split by comma and semicolon
    const addresses = addressList.split(/[,;]/);
    
    return addresses
      .map(addr => addr.trim())
      .filter(addr => addr.length > 0)
      .map(addr => this.parseEmailAddress(addr));
  }

  private extractEmailContent(plainText: string, htmlBody?: string): {
    plainText: string;
    html?: string;
    wordCount?: number;
  } {
    const cleanPlainText = this.sanitizePlainText(plainText || '');
    const cleanHtml = htmlBody ? this.sanitizeHtml(htmlBody) : undefined;
    
    const wordCount = cleanPlainText.split(/\s+/).filter(word => word.length > 0).length;
    
    return {
      plainText: cleanPlainText,
      html: cleanHtml,
      wordCount
    };
  }

  private sanitizePlainText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private sanitizeHtml(html: string): string {
    // Basic HTML sanitization (in production, use a proper HTML sanitizer like DOMPurify)
    return html
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }

  private parseAppleMailDate(dateValue: any): Date {
    if (!dateValue) {
      return new Date();
    }

    // Handle various Apple Mail date formats
    if (dateValue instanceof Date) {
      return dateValue;
    }
    
    if (typeof dateValue === 'number') {
      // Unix timestamp or Apple's timestamp format
      const timestamp = dateValue > 1e10 ? dateValue : dateValue * 1000;
      return new Date(timestamp);
    }
    
    if (typeof dateValue === 'string') {
      const parsed = Date.parse(dateValue);
      if (!isNaN(parsed)) {
        return new Date(parsed);
      }
    }
    
    // Fallback to current date
    console.warn(`Could not parse date: ${dateValue}`);
    return new Date();
  }

  private extractThreadId(message: any): string {
    // Apple Mail threading logic
    const subject = this.cleanSubject(message.subject || '');
    const messageId = message.message_id || message.Message_ID;
    
    // Use conversation ID if available
    if (message.conversation_id) {
      return `thread-${message.conversation_id}`;
    }
    
    // Generate thread ID from subject and participants
    const participants = [
      message.sender,
      message.to,
      message.cc
    ].filter(Boolean).join(',').toLowerCase();
    
    const threadSeed = `${subject.toLowerCase()}-${participants}`;
    return `thread-${this.generateHashId(threadSeed)}`;
  }

  private getThreadSubject(emailSubject: string): string {
    // Remove reply/forward prefixes for thread subject
    return emailSubject.replace(/^(Re:|Fwd:|Fw:)\s*/gi, '').trim();
  }

  private parseReferences(references: string): string[] {
    if (!references || typeof references !== 'string') {
      return [];
    }
    
    return references
      .split(/\s+/)
      .map(ref => ref.trim())
      .filter(ref => ref.length > 0 && ref.includes('@'));
  }

  private async extractAttachments(message: any): Promise<any[]> {
    const attachments = [];
    
    // Handle Apple Mail attachment data structure
    if (message.attachments && Array.isArray(message.attachments)) {
      for (const attachment of message.attachments) {
        try {
          attachments.push({
            id: crypto.randomUUID(),
            filename: attachment.name || attachment.filename || 'unnamed_attachment',
            mimeType: attachment.mime_type || attachment.content_type || 'application/octet-stream',
            size: parseInt(attachment.size || '0'),
            contentId: attachment.content_id,
            isInline: Boolean(attachment.is_inline || attachment.inline)
          });
        } catch (error) {
          console.warn('Error processing attachment:', error);
        }
      }
    }
    
    return attachments;
  }

  private extractLabels(message: any): string[] {
    const labels = [];
    
    // Handle Apple Mail labels/flags
    if (message.labels && Array.isArray(message.labels)) {
      labels.push(...message.labels);
    }
    
    if (message.mailbox) {
      labels.push(message.mailbox);
    }
    
    if (message.flagged) {
      labels.push('flagged');
    }
    
    if (message.read === false) {
      labels.push('unread');
    }
    
    return labels.filter(label => label && typeof label === 'string');
  }

  private isValidDate(date: any): boolean {
    if (date instanceof Date) {
      return !isNaN(date.getTime());
    }
    
    if (typeof date === 'string' || typeof date === 'number') {
      const parsed = new Date(date);
      return !isNaN(parsed.getTime());
    }
    
    return false;
  }

  private generateHashId(input: string): string {
    // Simple hash function for generating consistent IDs
    let hash = 0;
    if (input.length === 0) return hash.toString();
    
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }
}

// OpenAI API Anti-Corruption Layer
export class OpenAIAntiCorruptionLayer implements AntiCorruptionLayer<any, any> {
  private readonly maxTokens = 4000;
  private readonly temperatureRange = { min: 0, max: 2 };

  async toDomain(external: any): Promise<any> {
    try {
      // Validate OpenAI response structure
      const validation = this.validate(external);
      if (!validation.isValid) {
        throw new Error(`Invalid OpenAI response: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      // Extract choice data
      const choice = external.choices?.[0];
      if (!choice) {
        throw new Error('No choices in OpenAI response');
      }

      // Map to domain response
      return {
        content: choice.message?.content || choice.text || '',
        confidence: this.calculateConfidence(choice),
        tokensUsed: {
          inputTokens: external.usage?.prompt_tokens || 0,
          outputTokens: external.usage?.completion_tokens || 0,
          totalTokens: external.usage?.total_tokens || 0,
          cost: this.calculateCost(external.usage, external.model)
        },
        finishReason: choice.finish_reason || 'stop',
        metadata: {
          model: external.model,
          requestId: external.id,
          created: external.created
        }
      };
    } catch (error) {
      console.error('Error converting OpenAI response to domain:', error);
      throw error;
    }
  }

  async toExternal(domain: any): Promise<any> {
    try {
      // Convert domain prompt to OpenAI API format
      return {
        model: domain.configuration?.modelType?.toLowerCase().replace('_', '-') || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: domain.prompt.systemInstructions || 'You are a helpful assistant.'
          },
          {
            role: 'user',
            content: domain.prompt.content
          }
        ],
        temperature: Math.min(Math.max(domain.prompt.temperature || 0.7, this.temperatureRange.min), this.temperatureRange.max),
        max_tokens: Math.min(domain.prompt.maxTokens || 1000, this.maxTokens),
        top_p: domain.configuration?.topP || 1.0,
        frequency_penalty: domain.configuration?.frequencyPenalty || 0,
        presence_penalty: domain.configuration?.presencePenalty || 0,
        user: domain.userId || 'anonymous'
      };
    } catch (error) {
      console.error('Error converting domain prompt to OpenAI format:', error);
      throw error;
    }
  }

  isCompatible(external: any): boolean {
    return external && 
           typeof external === 'object' &&
           (external.choices || external.error) &&
           external.object === 'chat.completion';
  }

  validate(external: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!external) {
      errors.push({
        field: 'response',
        message: 'OpenAI response is null or undefined',
        code: 'NULL_RESPONSE'
      });
      return { isValid: false, errors, warnings };
    }

    if (external.error) {
      errors.push({
        field: 'error',
        message: external.error.message || 'OpenAI API error',
        code: external.error.code || 'UNKNOWN_ERROR'
      });
    }

    if (!external.choices || !Array.isArray(external.choices) || external.choices.length === 0) {
      errors.push({
        field: 'choices',
        message: 'No choices in OpenAI response',
        code: 'NO_CHOICES'
      });
    }

    const choice = external.choices?.[0];
    if (choice && !choice.message?.content && !choice.text) {
      warnings.push({
        field: 'content',
        message: 'Empty content in OpenAI response',
        code: 'EMPTY_CONTENT'
      });
    }

    if (!external.usage) {
      warnings.push({
        field: 'usage',
        message: 'No usage information in response',
        code: 'NO_USAGE_INFO'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private calculateConfidence(choice: any): number {
    // Calculate confidence based on various factors
    let confidence = 0.8; // Base confidence

    // Adjust based on finish reason
    if (choice.finish_reason === 'stop') {
      confidence += 0.1;
    } else if (choice.finish_reason === 'length') {
      confidence -= 0.2;
    } else if (choice.finish_reason === 'content_filter') {
      confidence -= 0.4;
    }

    // Adjust based on content length (very short responses might be incomplete)
    const contentLength = choice.message?.content?.length || choice.text?.length || 0;
    if (contentLength < 10) {
      confidence -= 0.3;
    } else if (contentLength > 100) {
      confidence += 0.1;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  private calculateCost(usage: any, model: string): number {
    if (!usage) return 0;

    // Simplified cost calculation (should be updated with current pricing)
    const rates = {
      'gpt-4': { input: 0.03, output: 0.06 }, // per 1K tokens
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 }
    };

    const rate = rates[model as keyof typeof rates] || rates['gpt-4'];
    const inputCost = (usage.prompt_tokens || 0) / 1000 * rate.input;
    const outputCost = (usage.completion_tokens || 0) / 1000 * rate.output;

    return inputCost + outputCost;
  }
}

// Supabase API Anti-Corruption Layer
export class SupabaseAntiCorruptionLayer {
  async handleSupabaseError(error: any): Promise<never> {
    // Translate Supabase errors to domain errors
    const errorCode = error.code || 'UNKNOWN';
    const errorMessage = error.message || 'Unknown database error';

    switch (errorCode) {
      case '23505': // Unique violation
        throw new Error(`Duplicate record: ${errorMessage}`);
      case '23503': // Foreign key violation
        throw new Error(`Referenced record not found: ${errorMessage}`);
      case '23502': // Not null violation
        throw new Error(`Required field missing: ${errorMessage}`);
      case '42703': // Undefined column
        throw new Error(`Invalid field reference: ${errorMessage}`);
      case 'PGRST116': // No rows found
        throw new Error('Record not found');
      default:
        throw new Error(`Database error (${errorCode}): ${errorMessage}`);
    }
  }

  async sanitizeQueryInput(input: any): Promise<any> {
    if (typeof input !== 'object' || input === null) {
      return input;
    }

    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(input)) {
      // Remove potentially dangerous SQL keywords
      const cleanKey = key.replace(/[^a-zA-Z0-9_]/g, '');
      
      if (typeof value === 'string') {
        // Basic SQL injection prevention
        sanitized[cleanKey] = value
          .replace(/[\x00-\x1f\x7f]/g, '') // Remove control characters
          .replace(/'/g, "''") // Escape single quotes
          .trim();
      } else {
        sanitized[cleanKey] = value;
      }
    }

    return sanitized;
  }
}

// Anti-Corruption Layer Factory
export class AntiCorruptionLayerFactory {
  static createAppleMailLayer(): AppleMailAntiCorruptionLayer {
    return new AppleMailAntiCorruptionLayer();
  }

  static createOpenAILayer(): OpenAIAntiCorruptionLayer {
    return new OpenAIAntiCorruptionLayer();
  }

  static createSupabaseLayer(): SupabaseAntiCorruptionLayer {
    return new SupabaseAntiCorruptionLayer();
  }
}

// External Service Health Monitor
export class ExternalServiceHealthMonitor {
  private healthChecks = new Map<string, boolean>();
  private lastCheckTimes = new Map<string, Date>();
  private checkIntervalMs = 5 * 60 * 1000; // 5 minutes

  async checkOpenAIHealth(): Promise<boolean> {
    try {
      // Simple health check - attempt a minimal API call
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      const isHealthy = response.status === 200;
      this.healthChecks.set('openai', isHealthy);
      this.lastCheckTimes.set('openai', new Date());
      
      return isHealthy;
    } catch (error) {
      console.error('OpenAI health check failed:', error);
      this.healthChecks.set('openai', false);
      this.lastCheckTimes.set('openai', new Date());
      return false;
    }
  }

  async checkSupabaseHealth(supabaseClient: any): Promise<boolean> {
    try {
      // Simple health check - attempt to query a system table
      const { data, error } = await supabaseClient
        .from('information_schema.tables')
        .select('table_name')
        .limit(1);

      const isHealthy = !error;
      this.healthChecks.set('supabase', isHealthy);
      this.lastCheckTimes.set('supabase', new Date());
      
      return isHealthy;
    } catch (error) {
      console.error('Supabase health check failed:', error);
      this.healthChecks.set('supabase', false);
      this.lastCheckTimes.set('supabase', new Date());
      return false;
    }
  }

  isServiceHealthy(serviceName: string): boolean {
    const health = this.healthChecks.get(serviceName);
    const lastCheck = this.lastCheckTimes.get(serviceName);
    
    if (!lastCheck) {
      return false; // Never checked
    }
    
    const timeSinceCheck = Date.now() - lastCheck.getTime();
    if (timeSinceCheck > this.checkIntervalMs) {
      return false; // Check is stale
    }
    
    return health === true;
  }

  getHealthStatus(): Record<string, { healthy: boolean; lastCheck?: Date }> {
    const status: Record<string, { healthy: boolean; lastCheck?: Date }> = {};
    
    for (const [service, healthy] of this.healthChecks) {
      status[service] = {
        healthy,
        lastCheck: this.lastCheckTimes.get(service)
      };
    }
    
    return status;
  }
}