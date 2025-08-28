/**
 * Email Management Bounded Context - Aggregate Root: EmailThread
 * Domain-driven design implementation for email threading and management
 */

import { AggregateRoot, Entity, ValueObject, DomainEvent } from '../../shared/DomainEvent';

// Value Objects
export class EmailAddress extends ValueObject {
  constructor(
    public readonly email: string,
    public readonly displayName?: string
  ) {
    super();
    this.validateEmail(email);
  }

  private validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error(`Invalid email address: ${email}`);
    }
  }

  protected getEqualityComponents(): unknown[] {
    return [this.email.toLowerCase()];
  }

  toString(): string {
    return this.displayName ? `${this.displayName} <${this.email}>` : this.email;
  }
}

export class EmailSubject extends ValueObject {
  constructor(public readonly value: string) {
    super();
    if (!value || value.trim().length === 0) {
      throw new Error('Email subject cannot be empty');
    }
  }

  protected getEqualityComponents(): unknown[] {
    return [this.value.trim()];
  }

  isReply(): boolean {
    return this.value.toLowerCase().startsWith('re:');
  }

  isForward(): boolean {
    return this.value.toLowerCase().startsWith('fwd:') || 
           this.value.toLowerCase().startsWith('fw:');
  }

  getCleanSubject(): string {
    return this.value
      .replace(/^(re|fwd|fw):\s*/gi, '')
      .trim();
  }
}

export class EmailContent extends ValueObject {
  constructor(
    public readonly plainText: string,
    public readonly html?: string,
    public readonly wordCount?: number
  ) {
    super();
    if (!plainText || plainText.trim().length === 0) {
      throw new Error('Email content cannot be empty');
    }
  }

  protected getEqualityComponents(): unknown[] {
    return [this.plainText, this.html];
  }

  getPreview(maxLength: number = 150): string {
    const text = this.plainText.replace(/\s+/g, ' ').trim();
    return text.length <= maxLength ? text : text.substring(0, maxLength) + '...';
  }

  getWordCount(): number {
    return this.wordCount || this.plainText.split(/\s+/).filter(word => word.length > 0).length;
  }
}

// Entities
export class EmailAttachment extends Entity {
  constructor(
    id: string,
    public readonly filename: string,
    public readonly mimeType: string,
    public readonly size: number,
    public readonly contentId?: string,
    public readonly isInline: boolean = false
  ) {
    super(id);
    this.validateAttachment();
  }

  private validateAttachment(): void {
    if (!this.filename || this.filename.trim().length === 0) {
      throw new Error('Attachment filename cannot be empty');
    }
    if (this.size < 0) {
      throw new Error('Attachment size cannot be negative');
    }
  }

  isImage(): boolean {
    return this.mimeType.startsWith('image/');
  }

  isDocument(): boolean {
    return ['application/pdf', 'application/msword', 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      .includes(this.mimeType);
  }

  getSizeInMB(): number {
    return Math.round((this.size / (1024 * 1024)) * 100) / 100;
  }
}

export class Email extends Entity {
  private _isRead: boolean = false;
  private _isFlagged: boolean = false;
  private _labels: Set<string> = new Set();

  constructor(
    id: string,
    public readonly messageId: string,
    public readonly subject: EmailSubject,
    public readonly from: EmailAddress,
    public readonly to: EmailAddress[],
    public readonly content: EmailContent,
    public readonly sentAt: Date,
    public readonly cc: EmailAddress[] = [],
    public readonly bcc: EmailAddress[] = [],
    public readonly attachments: EmailAttachment[] = [],
    public readonly inReplyTo?: string,
    public readonly references?: string[]
  ) {
    super(id);
    this.validateEmail();
  }

  private validateEmail(): void {
    if (!this.messageId || this.messageId.trim().length === 0) {
      throw new Error('Email messageId is required');
    }
    if (this.to.length === 0) {
      throw new Error('Email must have at least one recipient');
    }
  }

  // Getters
  get isRead(): boolean { return this._isRead; }
  get isFlagged(): boolean { return this._isFlagged; }
  get labels(): string[] { return Array.from(this._labels); }

  // Business Logic
  markAsRead(): void {
    this._isRead = true;
  }

  markAsUnread(): void {
    this._isRead = false;
  }

  toggleFlag(): void {
    this._isFlagged = !this._isFlagged;
  }

  addLabel(label: string): void {
    this._labels.add(label.toLowerCase().trim());
  }

  removeLabel(label: string): void {
    this._labels.delete(label.toLowerCase().trim());
  }

  hasAttachments(): boolean {
    return this.attachments.length > 0;
  }

  isReply(): boolean {
    return !!this.inReplyTo;
  }

  getAllRecipients(): EmailAddress[] {
    return [...this.to, ...this.cc, ...this.bcc];
  }

  getTotalAttachmentSize(): number {
    return this.attachments.reduce((total, attachment) => total + attachment.size, 0);
  }
}

// Aggregate Root
export class EmailThread extends AggregateRoot {
  private _emails: Map<string, Email> = new Map();
  private _participants: Set<string> = new Set();
  private _isArchived: boolean = false;
  private _isMuted: boolean = false;
  private _lastActivity: Date;

  constructor(
    private readonly _id: string,
    public readonly subject: EmailSubject,
    initialEmail: Email
  ) {
    super();
    this.addEmailInternal(initialEmail);
    this._lastActivity = initialEmail.sentAt;
    
    this.addDomainEvent(new EmailThreadCreated(
      this._id,
      this.version,
      subject.value,
      initialEmail.getId(),
      initialEmail.from.email
    ));
  }

  public getId(): string {
    return this._id;
  }

  // Getters
  get emails(): Email[] {
    return Array.from(this._emails.values())
      .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
  }

  get participants(): string[] {
    return Array.from(this._participants);
  }

  get emailCount(): number {
    return this._emails.size;
  }

  get lastActivity(): Date {
    return this._lastActivity;
  }

  get isArchived(): boolean {
    return this._isArchived;
  }

  get isMuted(): boolean {
    return this._isMuted;
  }

  // Business Logic
  addEmail(email: Email): void {
    if (this._emails.has(email.getId())) {
      throw new Error(`Email with ID ${email.getId()} already exists in thread`);
    }

    if (!this.isEmailPartOfThread(email)) {
      throw new Error('Email does not belong to this thread');
    }

    this.addEmailInternal(email);
    this._lastActivity = new Date();

    this.addDomainEvent(new EmailAddedToThread(
      this._id,
      this.version,
      email.getId(),
      email.from.email,
      email.sentAt
    ));
  }

  private addEmailInternal(email: Email): void {
    this._emails.set(email.getId(), email);
    
    // Add participants
    this._participants.add(email.from.email);
    email.getAllRecipients().forEach(recipient => 
      this._participants.add(recipient.email)
    );
  }

  private isEmailPartOfThread(email: Email): boolean {
    // Check if subject matches (cleaned)
    const cleanThreadSubject = this.subject.getCleanSubject();
    const cleanEmailSubject = email.subject.getCleanSubject();
    
    if (cleanThreadSubject.toLowerCase() === cleanEmailSubject.toLowerCase()) {
      return true;
    }

    // Check if email references any email in this thread
    if (email.references) {
      const threadMessageIds = Array.from(this._emails.values()).map(e => e.messageId);
      return email.references.some(ref => threadMessageIds.includes(ref));
    }

    // Check if email is a reply to any email in this thread
    if (email.inReplyTo) {
      const threadMessageIds = Array.from(this._emails.values()).map(e => e.messageId);
      return threadMessageIds.includes(email.inReplyTo);
    }

    return false;
  }

  removeEmail(emailId: string): void {
    const email = this._emails.get(emailId);
    if (!email) {
      throw new Error(`Email with ID ${emailId} not found in thread`);
    }

    if (this._emails.size === 1) {
      throw new Error('Cannot remove the last email from a thread');
    }

    this._emails.delete(emailId);
    this._lastActivity = new Date();

    this.addDomainEvent(new EmailRemovedFromThread(
      this._id,
      this.version,
      emailId
    ));
  }

  markAllAsRead(): void {
    this._emails.forEach(email => email.markAsRead());
    
    this.addDomainEvent(new EmailThreadMarkedAsRead(
      this._id,
      this.version,
      Array.from(this._emails.keys())
    ));
  }

  archive(): void {
    if (this._isArchived) {
      throw new Error('Thread is already archived');
    }

    this._isArchived = true;
    this._lastActivity = new Date();

    this.addDomainEvent(new EmailThreadArchived(
      this._id,
      this.version
    ));
  }

  unarchive(): void {
    if (!this._isArchived) {
      throw new Error('Thread is not archived');
    }

    this._isArchived = false;
    this._lastActivity = new Date();

    this.addDomainEvent(new EmailThreadUnarchived(
      this._id,
      this.version
    ));
  }

  mute(): void {
    if (this._isMuted) {
      throw new Error('Thread is already muted');
    }

    this._isMuted = true;

    this.addDomainEvent(new EmailThreadMuted(
      this._id,
      this.version
    ));
  }

  unmute(): void {
    if (!this._isMuted) {
      throw new Error('Thread is not muted');
    }

    this._isMuted = false;

    this.addDomainEvent(new EmailThreadUnmuted(
      this._id,
      this.version
    ));
  }

  getEmail(emailId: string): Email | null {
    return this._emails.get(emailId) || null;
  }

  hasUnreadEmails(): boolean {
    return Array.from(this._emails.values()).some(email => !email.isRead);
  }

  getUnreadCount(): number {
    return Array.from(this._emails.values()).filter(email => !email.isRead).length;
  }

  getLatestEmail(): Email {
    const emails = this.emails;
    return emails[emails.length - 1];
  }

  getTotalAttachmentSize(): number {
    return Array.from(this._emails.values())
      .reduce((total, email) => total + email.getTotalAttachmentSize(), 0);
  }
}

// Domain Events
export class EmailThreadCreated extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly subject: string,
    public readonly initialEmailId: string,
    public readonly createdBy: string
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'EmailThreadCreated';
  }

  getEventData(): Record<string, unknown> {
    return {
      subject: this.subject,
      initialEmailId: this.initialEmailId,
      createdBy: this.createdBy
    };
  }
}

export class EmailAddedToThread extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly emailId: string,
    public readonly from: string,
    public readonly sentAt: Date
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'EmailAddedToThread';
  }

  getEventData(): Record<string, unknown> {
    return {
      emailId: this.emailId,
      from: this.from,
      sentAt: this.sentAt.toISOString()
    };
  }
}

export class EmailRemovedFromThread extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly emailId: string
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'EmailRemovedFromThread';
  }

  getEventData(): Record<string, unknown> {
    return {
      emailId: this.emailId
    };
  }
}

export class EmailThreadMarkedAsRead extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly emailIds: string[]
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'EmailThreadMarkedAsRead';
  }

  getEventData(): Record<string, unknown> {
    return {
      emailIds: this.emailIds
    };
  }
}

export class EmailThreadArchived extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'EmailThreadArchived';
  }

  getEventData(): Record<string, unknown> {
    return {};
  }
}

export class EmailThreadUnarchived extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'EmailThreadUnarchived';
  }

  getEventData(): Record<string, unknown> {
    return {};
  }
}

export class EmailThreadMuted extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'EmailThreadMuted';
  }

  getEventData(): Record<string, unknown> {
    return {};
  }
}

export class EmailThreadUnmuted extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'EmailThreadUnmuted';
  }

  getEventData(): Record<string, unknown> {
    return {};
  }
}