/**
 * User & Auth Bounded Context - Aggregate Root: User
 * Domain-driven design implementation for user management and authentication
 */

import { AggregateRoot, Entity, ValueObject, DomainEvent } from '../../shared/DomainEvent';
import * as crypto from 'crypto';

// Enums
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  LOCKED = 'LOCKED'
}

export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
  GUEST = 'GUEST'
}

export enum PermissionAction {
  READ = 'READ',
  write = 'write',
  delete = 'delete',
  admin = 'admin'
}

export enum AuthenticationMethod {
  PASSWORD = 'PASSWORD',
  OAUTH_GOOGLE = 'OAUTH_GOOGLE',
  OAUTH_MICROSOFT = 'OAUTH_MICROSOFT',
  OAUTH_APPLE = 'OAUTH_APPLE',
  TWO_FACTOR = 'TWO_FACTOR'
}

export enum SessionStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
  LOGGED_OUT = 'LOGGED_OUT'
}

// Value Objects
export class Email extends ValueObject {
  constructor(
    public readonly value: string,
    public readonly isVerified: boolean = false
  ) {
    super();
    this.validate();
  }

  private validate(): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.value)) {
      throw new Error(`Invalid email address: ${this.value}`);
    }
  }

  protected getEqualityComponents(): unknown[] {
    return [this.value.toLowerCase()];
  }

  getDomain(): string {
    return this.value.split('@')[1];
  }

  getLocalPart(): string {
    return this.value.split('@')[0];
  }

  verify(): Email {
    return new Email(this.value, true);
  }
}

export class Password extends ValueObject {
  constructor(
    private readonly hashedValue: string,
    private readonly salt: string,
    private readonly algorithm: string = 'pbkdf2'
  ) {
    super();
    this.validate();
  }

  private validate(): void {
    if (!this.hashedValue || this.hashedValue.length === 0) {
      throw new Error('Hashed password cannot be empty');
    }
    if (!this.salt || this.salt.length === 0) {
      throw new Error('Salt cannot be empty');
    }
  }

  protected getEqualityComponents(): unknown[] {
    return [this.hashedValue, this.salt, this.algorithm];
  }

  static createFromPlaintext(plaintext: string): Password {
    if (!plaintext || plaintext.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    
    // Check password complexity
    const hasUppercase = /[A-Z]/.test(plaintext);
    const hasLowercase = /[a-z]/.test(plaintext);
    const hasNumbers = /\d/.test(plaintext);
    const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(plaintext);
    
    if (!(hasUppercase && hasLowercase && hasNumbers && hasSpecialChars)) {
      throw new Error('Password must contain uppercase, lowercase, number, and special character');
    }

    const salt = crypto.randomBytes(32).toString('hex');
    const hashedValue = crypto.pbkdf2Sync(plaintext, salt, 10000, 64, 'sha512').toString('hex');
    
    return new Password(hashedValue, salt);
  }

  verify(plaintext: string): boolean {
    const hashedInput = crypto.pbkdf2Sync(plaintext, this.salt, 10000, 64, 'sha512').toString('hex');
    return this.hashedValue === hashedInput;
  }

  getHash(): string {
    return this.hashedValue;
  }

  getSalt(): string {
    return this.salt;
  }
}

export class UserProfile extends ValueObject {
  constructor(
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly displayName?: string,
    public readonly avatarUrl?: string,
    public readonly timezone?: string,
    public readonly language?: string
  ) {
    super();
    this.validate();
  }

  private validate(): void {
    if (!this.firstName || this.firstName.trim().length === 0) {
      throw new Error('First name is required');
    }
    if (!this.lastName || this.lastName.trim().length === 0) {
      throw new Error('Last name is required');
    }
    if (this.firstName.length > 50) {
      throw new Error('First name cannot exceed 50 characters');
    }
    if (this.lastName.length > 50) {
      throw new Error('Last name cannot exceed 50 characters');
    }
  }

  protected getEqualityComponents(): unknown[] {
    return [
      this.firstName,
      this.lastName,
      this.displayName,
      this.avatarUrl,
      this.timezone,
      this.language
    ];
  }

  getFullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  getInitials(): string {
    return `${this.firstName.charAt(0)}${this.lastName.charAt(0)}`.toUpperCase();
  }

  getDisplayNameOrFullName(): string {
    return this.displayName || this.getFullName();
  }
}

export class Permission extends ValueObject {
  constructor(
    public readonly resource: string,
    public readonly action: PermissionAction,
    public readonly conditions?: Record<string, unknown>
  ) {
    super();
    this.validate();
  }

  private validate(): void {
    if (!this.resource || this.resource.trim().length === 0) {
      throw new Error('Permission resource cannot be empty');
    }
  }

  protected getEqualityComponents(): unknown[] {
    return [this.resource, this.action, this.conditions];
  }

  matches(resource: string, action: PermissionAction): boolean {
    return this.resource === resource && this.action === action;
  }

  matchesWildcard(resource: string, action: PermissionAction): boolean {
    if (this.resource === '*') {
      return true;
    }
    
    const resourceParts = resource.split('.');
    const permissionParts = this.resource.split('.');
    
    if (permissionParts.length > resourceParts.length) {
      return false;
    }
    
    for (let i = 0; i < permissionParts.length; i++) {
      if (permissionParts[i] !== '*' && permissionParts[i] !== resourceParts[i]) {
        return false;
      }
    }
    
    return this.action === action;
  }

  toString(): string {
    return `${this.resource}:${this.action}`;
  }
}

// Entities
export class Role extends Entity {
  private _permissions: Set<Permission> = new Set();
  private _isActive: boolean = true;

  constructor(
    id: string,
    public readonly name: string,
    public readonly description?: string,
    public readonly isSystemRole: boolean = false
  ) {
    super(id);
    this.validate();
  }

  private validate(): void {
    if (!this.name || this.name.trim().length === 0) {
      throw new Error('Role name is required');
    }
  }

  get permissions(): Permission[] {
    return Array.from(this._permissions);
  }

  get isActive(): boolean {
    return this._isActive;
  }

  addPermission(permission: Permission): void {
    this._permissions.add(permission);
  }

  removePermission(permission: Permission): void {
    this._permissions.delete(permission);
  }

  hasPermission(resource: string, action: PermissionAction): boolean {
    return Array.from(this._permissions).some(p => 
      p.matches(resource, action) || p.matchesWildcard(resource, action)
    );
  }

  activate(): void {
    this._isActive = true;
  }

  deactivate(): void {
    if (this.isSystemRole) {
      throw new Error('Cannot deactivate system role');
    }
    this._isActive = false;
  }
}

export class UserSession extends Entity {
  private _status: SessionStatus = SessionStatus.ACTIVE;
  private _lastAccessedAt: Date;
  private _revokedAt?: Date;
  private _revokedReason?: string;

  constructor(
    id: string,
    public readonly userId: string,
    public readonly deviceInfo: string,
    public readonly ipAddress: string,
    public readonly userAgent: string,
    public readonly expiresAt: Date,
    public readonly refreshToken?: string
  ) {
    super(id);
    this._lastAccessedAt = new Date();
    this.validate();
  }

  private validate(): void {
    if (!this.userId || this.userId.trim().length === 0) {
      throw new Error('Session must have a user ID');
    }
    if (this.expiresAt <= new Date()) {
      throw new Error('Session expiration must be in the future');
    }
  }

  get status(): SessionStatus { return this._status; }
  get lastAccessedAt(): Date { return this._lastAccessedAt; }
  get revokedAt(): Date | undefined { return this._revokedAt; }
  get revokedReason(): string | undefined { return this._revokedReason; }

  updateLastAccessed(): void {
    if (this._status !== SessionStatus.ACTIVE) {
      throw new Error('Cannot update inactive session');
    }
    
    this._lastAccessedAt = new Date();
  }

  revoke(reason?: string): void {
    if (this._status === SessionStatus.REVOKED) {
      throw new Error('Session is already revoked');
    }
    
    this._status = SessionStatus.REVOKED;
    this._revokedAt = new Date();
    this._revokedReason = reason;
  }

  logout(): void {
    if (this._status !== SessionStatus.ACTIVE) {
      throw new Error('Cannot logout inactive session');
    }
    
    this._status = SessionStatus.LOGGED_OUT;
  }

  checkExpiration(): void {
    if (this._status === SessionStatus.ACTIVE && new Date() > this.expiresAt) {
      this._status = SessionStatus.EXPIRED;
    }
  }

  isExpired(): boolean {
    return this._status === SessionStatus.EXPIRED || new Date() > this.expiresAt;
  }

  isActive(): boolean {
    this.checkExpiration();
    return this._status === SessionStatus.ACTIVE;
  }

  getDurationMinutes(): number {
    const start = this.lastAccessedAt;
    const end = this._revokedAt || new Date();
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
  }
}

export class AuthenticationAttempt extends Entity {
  constructor(
    id: string,
    public readonly userId: string,
    public readonly method: AuthenticationMethod,
    public readonly ipAddress: string,
    public readonly userAgent: string,
    public readonly isSuccessful: boolean,
    public readonly failureReason?: string,
    public readonly attemptedAt: Date = new Date()
  ) {
    super(id);
  }

  isFailure(): boolean {
    return !this.isSuccessful;
  }

  isRecentAttempt(minutesThreshold: number = 5): boolean {
    const now = new Date();
    const diffMinutes = (now.getTime() - this.attemptedAt.getTime()) / (1000 * 60);
    return diffMinutes <= minutesThreshold;
  }
}

// Aggregate Root
export class User extends AggregateRoot {
  private _status: UserStatus = UserStatus.PENDING_VERIFICATION;
  private _roles: Set<string> = new Set(); // Role IDs
  private _sessions: Map<string, UserSession> = new Map();
  private _authAttempts: AuthenticationAttempt[] = [];
  private _lastLoginAt?: Date;
  private _failedLoginCount: number = 0;
  private _lockedUntil?: Date;
  private _emailVerificationToken?: string;
  private _passwordResetToken?: string;
  private _passwordResetExpiresAt?: Date;
  private _preferences: Record<string, unknown> = {};
  private _createdAt: Date;
  private _updatedAt: Date;

  constructor(
    private readonly _id: string,
    private _email: Email,
    private _profile: UserProfile,
    private _password?: Password
  ) {
    super();
    this._createdAt = new Date();
    this._updatedAt = new Date();
    
    if (!_email.isVerified) {
      this._emailVerificationToken = this.generateToken();
    }

    this.addDomainEvent(new UserCreated(
      this._id,
      this.version,
      _email.value,
      _profile.getFullName()
    ));
  }

  public getId(): string {
    return this._id;
  }

  // Getters
  get email(): Email { return this._email; }
  get profile(): UserProfile { return this._profile; }
  get status(): UserStatus { return this._status; }
  get roles(): string[] { return Array.from(this._roles); }
  get sessions(): UserSession[] { return Array.from(this._sessions.values()); }
  get lastLoginAt(): Date | undefined { return this._lastLoginAt; }
  get failedLoginCount(): number { return this._failedLoginCount; }
  get lockedUntil(): Date | undefined { return this._lockedUntil; }
  get preferences(): Record<string, unknown> { return { ...this._preferences }; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  // Authentication methods
  authenticate(password: string, ipAddress: string, userAgent: string): UserSession {
    this.checkAccountLock();
    
    if (!this._password) {
      throw new Error('User does not have password authentication enabled');
    }
    
    const attemptId = crypto.randomUUID();
    
    if (!this._password.verify(password)) {
      this.recordFailedLogin(attemptId, ipAddress, userAgent);
      throw new Error('Invalid credentials');
    }
    
    if (this._status !== UserStatus.ACTIVE) {
      throw new Error(`User account is ${this._status.toLowerCase()}`);
    }
    
    return this.createSession(attemptId, ipAddress, userAgent);
  }

  private checkAccountLock(): void {
    if (this._lockedUntil && new Date() < this._lockedUntil) {
      const remainingMinutes = Math.ceil((this._lockedUntil.getTime() - new Date().getTime()) / (1000 * 60));
      throw new Error(`Account is locked for ${remainingMinutes} more minutes`);
    }
    
    if (this._lockedUntil && new Date() >= this._lockedUntil) {
      this.unlockAccount();
    }
  }

  private recordFailedLogin(attemptId: string, ipAddress: string, userAgent: string): void {
    const attempt = new AuthenticationAttempt(
      attemptId,
      this._id,
      AuthenticationMethod.PASSWORD,
      ipAddress,
      userAgent,
      false,
      'Invalid credentials'
    );
    
    this._authAttempts.push(attempt);
    this._failedLoginCount++;
    
    // Lock account after 5 failed attempts
    if (this._failedLoginCount >= 5) {
      this._status = UserStatus.LOCKED;
      this._lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      
      this.addDomainEvent(new UserAccountLocked(
        this._id,
        this.version,
        this._failedLoginCount,
        this._lockedUntil
      ));
    }
    
    this.addDomainEvent(new UserAuthenticationFailed(
      this._id,
      this.version,
      ipAddress,
      'Invalid credentials',
      this._failedLoginCount
    ));
  }

  private createSession(attemptId: string, ipAddress: string, userAgent: string): UserSession {
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const refreshToken = this.generateToken();
    
    const session = new UserSession(
      sessionId,
      this._id,
      this.extractDeviceInfo(userAgent),
      ipAddress,
      userAgent,
      expiresAt,
      refreshToken
    );
    
    this._sessions.set(sessionId, session);
    this._lastLoginAt = new Date();
    this._failedLoginCount = 0; // Reset failed login count on successful login
    this._updatedAt = new Date();
    
    // Record successful authentication
    const attempt = new AuthenticationAttempt(
      attemptId,
      this._id,
      AuthenticationMethod.PASSWORD,
      ipAddress,
      userAgent,
      true
    );
    
    this._authAttempts.push(attempt);
    
    this.addDomainEvent(new UserLoggedIn(
      this._id,
      this.version,
      sessionId,
      ipAddress,
      this.extractDeviceInfo(userAgent)
    ));
    
    return session;
  }

  logout(sessionId: string): void {
    const session = this._sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    session.logout();
    
    this.addDomainEvent(new UserLoggedOut(
      this._id,
      this.version,
      sessionId
    ));
  }

  revokeSession(sessionId: string, reason?: string): void {
    const session = this._sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    session.revoke(reason);
    
    this.addDomainEvent(new UserSessionRevoked(
      this._id,
      this.version,
      sessionId,
      reason
    ));
  }

  revokeAllSessions(reason?: string): void {
    const activeSessions = Array.from(this._sessions.values())
      .filter(s => s.isActive());
    
    activeSessions.forEach(session => {
      session.revoke(reason);
    });
    
    this.addDomainEvent(new UserAllSessionsRevoked(
      this._id,
      this.version,
      activeSessions.map(s => s.getId()),
      reason
    ));
  }

  // User management methods
  verifyEmail(token: string): void {
    if (this._email.isVerified) {
      throw new Error('Email is already verified');
    }
    
    if (!this._emailVerificationToken || this._emailVerificationToken !== token) {
      throw new Error('Invalid verification token');
    }
    
    this._email = this._email.verify();
    this._status = UserStatus.ACTIVE;
    this._emailVerificationToken = undefined;
    this._updatedAt = new Date();
    
    this.addDomainEvent(new UserEmailVerified(
      this._id,
      this.version,
      this._email.value
    ));
  }

  updateProfile(newProfile: UserProfile): void {
    this._profile = newProfile;
    this._updatedAt = new Date();
    
    this.addDomainEvent(new UserProfileUpdated(
      this._id,
      this.version,
      newProfile.getFullName()
    ));
  }

  updateEmail(newEmail: Email): void {
    const oldEmail = this._email.value;
    this._email = newEmail;
    this._updatedAt = new Date();
    
    if (!newEmail.isVerified) {
      this._emailVerificationToken = this.generateToken();
      this._status = UserStatus.PENDING_VERIFICATION;
    }
    
    this.addDomainEvent(new UserEmailUpdated(
      this._id,
      this.version,
      oldEmail,
      newEmail.value
    ));
  }

  changePassword(currentPassword: string, newPassword: string): void {
    if (!this._password) {
      throw new Error('User does not have password authentication');
    }
    
    if (!this._password.verify(currentPassword)) {
      throw new Error('Current password is incorrect');
    }
    
    this._password = Password.createFromPlaintext(newPassword);
    this._updatedAt = new Date();
    
    // Revoke all sessions to force re-authentication
    this.revokeAllSessions('Password changed');
    
    this.addDomainEvent(new UserPasswordChanged(
      this._id,
      this.version
    ));
  }

  resetPassword(token: string, newPassword: string): void {
    if (!this._passwordResetToken || this._passwordResetToken !== token) {
      throw new Error('Invalid password reset token');
    }
    
    if (!this._passwordResetExpiresAt || new Date() > this._passwordResetExpiresAt) {
      throw new Error('Password reset token has expired');
    }
    
    this._password = Password.createFromPlaintext(newPassword);
    this._passwordResetToken = undefined;
    this._passwordResetExpiresAt = undefined;
    this._failedLoginCount = 0;
    this._updatedAt = new Date();
    
    // Unlock account if it was locked
    if (this._status === UserStatus.LOCKED) {
      this.unlockAccount();
    }
    
    // Revoke all sessions
    this.revokeAllSessions('Password reset');
    
    this.addDomainEvent(new UserPasswordReset(
      this._id,
      this.version
    ));
  }

  initiatePasswordReset(): string {
    const token = this.generateToken();
    this._passwordResetToken = token;
    this._passwordResetExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
    this._updatedAt = new Date();
    
    this.addDomainEvent(new UserPasswordResetRequested(
      this._id,
      this.version,
      this._email.value
    ));
    
    return token;
  }

  // Role management
  assignRole(roleId: string): void {
    if (this._roles.has(roleId)) {
      return; // Already has role
    }
    
    this._roles.add(roleId);
    this._updatedAt = new Date();
    
    this.addDomainEvent(new UserRoleAssigned(
      this._id,
      this.version,
      roleId
    ));
  }

  revokeRole(roleId: string): void {
    if (!this._roles.has(roleId)) {
      return; // Doesn't have role
    }
    
    this._roles.delete(roleId);
    this._updatedAt = new Date();
    
    this.addDomainEvent(new UserRoleRevoked(
      this._id,
      this.version,
      roleId
    ));
  }

  hasRole(roleId: string): boolean {
    return this._roles.has(roleId);
  }

  // Account management
  activate(): void {
    if (this._status === UserStatus.ACTIVE) {
      return;
    }
    
    if (!this._email.isVerified) {
      throw new Error('Cannot activate user with unverified email');
    }
    
    this._status = UserStatus.ACTIVE;
    this._updatedAt = new Date();
    
    this.addDomainEvent(new UserActivated(
      this._id,
      this.version
    ));
  }

  deactivate(): void {
    if (this._status === UserStatus.INACTIVE) {
      return;
    }
    
    this._status = UserStatus.INACTIVE;
    this._updatedAt = new Date();
    
    // Revoke all active sessions
    this.revokeAllSessions('Account deactivated');
    
    this.addDomainEvent(new UserDeactivated(
      this._id,
      this.version
    ));
  }

  suspend(reason?: string): void {
    this._status = UserStatus.SUSPENDED;
    this._updatedAt = new Date();
    
    // Revoke all active sessions
    this.revokeAllSessions(`Account suspended: ${reason}`);
    
    this.addDomainEvent(new UserSuspended(
      this._id,
      this.version,
      reason
    ));
  }

  private unlockAccount(): void {
    this._status = UserStatus.ACTIVE;
    this._lockedUntil = undefined;
    this._failedLoginCount = 0;
    this._updatedAt = new Date();
    
    this.addDomainEvent(new UserAccountUnlocked(
      this._id,
      this.version
    ));
  }

  // Preferences management
  updatePreferences(preferences: Record<string, unknown>): void {
    this._preferences = { ...this._preferences, ...preferences };
    this._updatedAt = new Date();
    
    this.addDomainEvent(new UserPreferencesUpdated(
      this._id,
      this.version,
      Object.keys(preferences)
    ));
  }

  setPreference(key: string, value: unknown): void {
    this._preferences[key] = value;
    this._updatedAt = new Date();
  }

  getPreference<T>(key: string, defaultValue?: T): T | undefined {
    const value = this._preferences[key];
    return value !== undefined ? value as T : defaultValue;
  }

  // Utility methods
  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private extractDeviceInfo(userAgent: string): string {
    // Simple device detection - in real implementation, use a proper library
    if (userAgent.includes('Mobile')) return 'Mobile';
    if (userAgent.includes('Tablet')) return 'Tablet';
    return 'Desktop';
  }

  getActiveSessions(): UserSession[] {
    return Array.from(this._sessions.values()).filter(s => s.isActive());
  }

  getRecentAuthAttempts(minutesThreshold: number = 60): AuthenticationAttempt[] {
    return this._authAttempts.filter(a => a.isRecentAttempt(minutesThreshold));
  }

  isAccountLocked(): boolean {
    return this._status === UserStatus.LOCKED && 
           this._lockedUntil && 
           new Date() < this._lockedUntil;
  }

  canAuthenticate(): boolean {
    return this._status === UserStatus.ACTIVE && !this.isAccountLocked();
  }

  getAccountAge(): number {
    const now = new Date();
    return Math.floor((now.getTime() - this._createdAt.getTime()) / (1000 * 60 * 60 * 24));
  }
}

// Domain Events
export class UserCreated extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly email: string,
    public readonly fullName: string
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'UserCreated';
  }

  getEventData(): Record<string, unknown> {
    return {
      email: this.email,
      fullName: this.fullName
    };
  }
}

export class UserLoggedIn extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly sessionId: string,
    public readonly ipAddress: string,
    public readonly deviceInfo: string
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'UserLoggedIn';
  }

  getEventData(): Record<string, unknown> {
    return {
      sessionId: this.sessionId,
      ipAddress: this.ipAddress,
      deviceInfo: this.deviceInfo
    };
  }
}

export class UserLoggedOut extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly sessionId: string
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'UserLoggedOut';
  }

  getEventData(): Record<string, unknown> {
    return {
      sessionId: this.sessionId
    };
  }
}

export class UserAuthenticationFailed extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly ipAddress: string,
    public readonly reason: string,
    public readonly failedAttemptCount: number
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'UserAuthenticationFailed';
  }

  getEventData(): Record<string, unknown> {
    return {
      ipAddress: this.ipAddress,
      reason: this.reason,
      failedAttemptCount: this.failedAttemptCount
    };
  }
}

export class UserAccountLocked extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly failedAttemptCount: number,
    public readonly lockedUntil: Date
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'UserAccountLocked';
  }

  getEventData(): Record<string, unknown> {
    return {
      failedAttemptCount: this.failedAttemptCount,
      lockedUntil: this.lockedUntil.toISOString()
    };
  }
}

export class UserAccountUnlocked extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'UserAccountUnlocked';
  }

  getEventData(): Record<string, unknown> {
    return {};
  }
}

export class UserEmailVerified extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly email: string
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'UserEmailVerified';
  }

  getEventData(): Record<string, unknown> {
    return {
      email: this.email
    };
  }
}

export class UserProfileUpdated extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly fullName: string
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'UserProfileUpdated';
  }

  getEventData(): Record<string, unknown> {
    return {
      fullName: this.fullName
    };
  }
}

export class UserEmailUpdated extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly oldEmail: string,
    public readonly newEmail: string
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'UserEmailUpdated';
  }

  getEventData(): Record<string, unknown> {
    return {
      oldEmail: this.oldEmail,
      newEmail: this.newEmail
    };
  }
}

export class UserPasswordChanged extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'UserPasswordChanged';
  }

  getEventData(): Record<string, unknown> {
    return {};
  }
}

export class UserPasswordReset extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'UserPasswordReset';
  }

  getEventData(): Record<string, unknown> {
    return {};
  }
}

export class UserPasswordResetRequested extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly email: string
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'UserPasswordResetRequested';
  }

  getEventData(): Record<string, unknown> {
    return {
      email: this.email
    };
  }
}

export class UserRoleAssigned extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly roleId: string
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'UserRoleAssigned';
  }

  getEventData(): Record<string, unknown> {
    return {
      roleId: this.roleId
    };
  }
}

export class UserRoleRevoked extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly roleId: string
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'UserRoleRevoked';
  }

  getEventData(): Record<string, unknown> {
    return {
      roleId: this.roleId
    };
  }
}

export class UserActivated extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'UserActivated';
  }

  getEventData(): Record<string, unknown> {
    return {};
  }
}

export class UserDeactivated extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'UserDeactivated';
  }

  getEventData(): Record<string, unknown> {
    return {};
  }
}

export class UserSuspended extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly reason?: string
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'UserSuspended';
  }

  getEventData(): Record<string, unknown> {
    return {
      reason: this.reason
    };
  }
}

export class UserSessionRevoked extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly sessionId: string,
    public readonly reason?: string
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'UserSessionRevoked';
  }

  getEventData(): Record<string, unknown> {
    return {
      sessionId: this.sessionId,
      reason: this.reason
    };
  }
}

export class UserAllSessionsRevoked extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly sessionIds: string[],
    public readonly reason?: string
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'UserAllSessionsRevoked';
  }

  getEventData(): Record<string, unknown> {
    return {
      sessionIds: this.sessionIds,
      reason: this.reason
    };
  }
}

export class UserPreferencesUpdated extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly updatedKeys: string[]
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'UserPreferencesUpdated';
  }

  getEventData(): Record<string, unknown> {
    return {
      updatedKeys: this.updatedKeys
    };
  }
}