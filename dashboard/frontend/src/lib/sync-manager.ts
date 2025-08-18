/**
 * Enterprise Email Management - Real-time Bidirectional Sync Manager
 * Integration with applecli.py for Apple Mail synchronization
 * 
 * Features:
 * - Real-time bidirectional synchronization
 * - WebSocket connection management
 * - Conflict resolution and merge strategies
 * - Offline queue with persistence
 * - Status tracking and retry logic
 * - Performance monitoring and metrics
 */

import { EmailMessage, ConflictResolutionStrategy } from '../types/index';
import { cacheManager } from './cache-manager';

export interface SyncEvent {
  type: string;
  data?: any;
  timestamp: Date;
}

export interface SyncManagerConfig {
  wsUrl: string;
  applecliEndpoint: string;
  syncInterval: number;
  maxRetries: number;
  batchSize: number;
  conflictStrategy: ConflictResolutionStrategy;
  enableOfflineMode: boolean;
  enableRealTime: boolean;
}

export interface SyncStatus {
  isConnected: boolean;
  lastSyncTime: Date | null;
  pendingOperations: number;
  syncProgress: number;
  errors: SyncError[];
  metrics: SyncMetrics;
}

export interface SyncError {
  id: string;
  operation: string;
  message: string;
  timestamp: Date;
  retryCount: number;
  context?: any;
}

export interface SyncMetrics {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  averageSyncTime: number;
  dataTransferred: number;
  conflictsResolved: number;
  lastUpdateTime: Date;
}

export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete' | 'read';
  entityType: 'email' | 'folder' | 'attachment';
  entityId: string;
  data?: any;
  timestamp: Date;
  priority: 'low' | 'normal' | 'high' | 'critical';
  retryCount: number;
  maxRetries: number;
}

export interface AppleMailSyncData {
  emails: EmailMessage[];
  folders: any[];
  deletedItems: string[];
  lastModified: Date;
  syncToken: string;
}

/**
 * WebSocket Manager for real-time communication
 */
class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private onMessage: ((data: any) => void) | null = null;
  private onConnect: (() => void) | null = null;
  private onDisconnect: (() => void) | null = null;

  constructor(private url: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.onConnect?.();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type !== 'heartbeat') {
              this.onMessage?.(data);
            }
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = () => {
          this.stopHeartbeat();
          this.onDisconnect?.();
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.stopHeartbeat();
  }

  send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  setMessageHandler(handler: (data: any) => void): void {
    this.onMessage = handler;
  }

  setConnectHandler(handler: () => void): void {
    this.onConnect = handler;
  }

  setDisconnectHandler(handler: () => void): void {
    this.onDisconnect = handler;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      setTimeout(() => {
        console.log(`Attempting WebSocket reconnection (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect().catch(console.error);
      }, delay);
    }
  }
}

/**
 * Offline Queue Manager for storing operations when disconnected
 */
class OfflineQueueManager {
  private queue: SyncOperation[] = [];
  private storageKey = 'email-sync-queue';

  constructor() {
    this.loadFromStorage();
  }

  add(operation: SyncOperation): void {
    this.queue.push(operation);
    this.saveToStorage();
  }

  getNext(): SyncOperation | null {
    return this.queue.length > 0 ? this.queue[0] : null;
  }

  remove(operationId: string): void {
    this.queue = this.queue.filter(op => op.id !== operationId);
    this.saveToStorage();
  }

  getPending(): SyncOperation[] {
    return [...this.queue];
  }

  clear(): void {
    this.queue = [];
    this.saveToStorage();
  }

  get size(): number {
    return this.queue.length;
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.queue = data.map((op: any) => ({
          ...op,
          timestamp: new Date(op.timestamp)
        }));
      }
    } catch (error) {
      console.warn('Failed to load offline queue:', error);
      this.queue = [];
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
    } catch (error) {
      console.warn('Failed to save offline queue:', error);
    }
  }
}

/**
 * Apple Mail CLI Integration Manager
 */
class AppleMailCliManager {
  constructor(private endpoint: string) {}

  async getEmails(folderId?: string, limit: number = 100): Promise<EmailMessage[]> {
    const params = new URLSearchParams();
    if (folderId) params.set('folder_id', folderId);
    params.set('limit', limit.toString());

    const response = await fetch(`${this.endpoint}/emails?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Apple Mail CLI error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.emails || [];
  }

  async sendEmail(email: Partial<EmailMessage>): Promise<string> {
    const response = await fetch(`${this.endpoint}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(email)
    });

    if (!response.ok) {
      throw new Error(`Failed to send email: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.messageId;
  }

  async updateEmail(emailId: string, updates: Partial<EmailMessage>): Promise<void> {
    const response = await fetch(`${this.endpoint}/emails/${emailId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      throw new Error(`Failed to update email: ${response.status} ${response.statusText}`);
    }
  }

  async deleteEmail(emailId: string): Promise<void> {
    const response = await fetch(`${this.endpoint}/emails/${emailId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`Failed to delete email: ${response.status} ${response.statusText}`);
    }
  }

  async getSyncState(): Promise<AppleMailSyncData> {
    const response = await fetch(`${this.endpoint}/sync-state`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get sync state: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      ...data,
      lastModified: new Date(data.lastModified)
    };
  }

  async performFullSync(syncToken?: string): Promise<AppleMailSyncData> {
    const body: any = {};
    if (syncToken) {
      body.syncToken = syncToken;
    }

    const response = await fetch(`${this.endpoint}/full-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Full sync failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      ...data,
      lastModified: new Date(data.lastModified)
    };
  }
}

/**
 * Main Synchronization Manager
 */
export class SyncManager {
  private wsManager: WebSocketManager;
  private offlineQueue: OfflineQueueManager;
  private appleCli: AppleMailCliManager;
  private syncInterval: NodeJS.Timeout | null = null;
  private status: SyncStatus;
  private config: SyncManagerConfig;
  private eventListeners: Map<string, ((event: SyncEvent) => void)[]> = new Map();

  constructor(config: SyncManagerConfig) {
    this.config = config;
    this.wsManager = new WebSocketManager(config.wsUrl);
    this.offlineQueue = new OfflineQueueManager();
    this.appleCli = new AppleMailCliManager(config.applecliEndpoint);

    this.status = {
      isConnected: false,
      lastSyncTime: null,
      pendingOperations: 0,
      syncProgress: 0,
      errors: [],
      metrics: {
        totalSyncs: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        averageSyncTime: 0,
        dataTransferred: 0,
        conflictsResolved: 0,
        lastUpdateTime: new Date()
      }
    };

    this.setupWebSocketHandlers();
  }

  /**
   * Initialize the sync manager
   */
  async initialize(): Promise<void> {
    try {
      if (this.config.enableRealTime) {
        await this.wsManager.connect();
      }

      // Process any pending offline operations
      await this.processOfflineQueue();

      // Start periodic sync if configured
      if (this.config.syncInterval > 0) {
        this.startPeriodicSync();
      }

      // Perform initial sync
      await this.performFullSync();

      this.emit('initialized', { timestamp: new Date() });
    } catch (error) {
      console.error('Failed to initialize sync manager:', error);
      throw error;
    }
  }

  /**
   * Shutdown the sync manager
   */
  async shutdown(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.wsManager.disconnect();
    this.emit('shutdown', { timestamp: new Date() });
  }

  /**
   * Perform a full synchronization with Apple Mail
   */
  async performFullSync(forceSync: boolean = false): Promise<void> {
    const startTime = Date.now();
    this.status.syncProgress = 0;

    try {
      this.emit('syncStarted', { timestamp: new Date(), type: 'full' });

      // Get current sync state from Apple Mail
      const appleMailData = await this.appleCli.performFullSync();
      this.status.syncProgress = 25;

      // Process emails
      await this.processEmailsFromAppleMail(appleMailData.emails);
      this.status.syncProgress = 75;

      // Process deletions
      await this.processDeletions(appleMailData.deletedItems);
      this.status.syncProgress = 90;

      // Update cache
      await this.updateCache(appleMailData);
      this.status.syncProgress = 100;

      // Update metrics
      const syncTime = Date.now() - startTime;
      this.updateSyncMetrics(true, syncTime, appleMailData.emails.length);

      this.status.lastSyncTime = new Date();
      this.emit('syncCompleted', { 
        timestamp: new Date(), 
        type: 'full',
        duration: syncTime,
        itemsProcessed: appleMailData.emails.length
      });

    } catch (error) {
      this.updateSyncMetrics(false, Date.now() - startTime, 0);
      this.addError('full_sync', error as Error);
      this.emit('syncError', { timestamp: new Date(), error });
      throw error;
    } finally {
      this.status.syncProgress = 0;
    }
  }

  /**
   * Sync a specific email
   */
  async syncEmail(emailId: string): Promise<EmailMessage | null> {
    try {
      // Check cache first
      const cached = await cacheManager.getEmail(emailId);
      if (cached) {
        return cached;
      }

      // Fetch from Apple Mail
      const emails = await this.appleCli.getEmails();
      const email = emails.find(e => e.id === emailId);

      if (email) {
        await cacheManager.setEmail(email);
        this.emit('emailSynced', { email, timestamp: new Date() });
      }

      return email || null;
    } catch (error) {
      this.addError('sync_email', error as Error, { emailId });
      throw error;
    }
  }

  /**
   * Queue an operation for synchronization
   */
  async queueOperation(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<string> {
    const fullOperation: SyncOperation = {
      ...operation,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      retryCount: 0
    };

    if (this.wsManager.isConnected && this.config.enableRealTime) {
      // Send immediately if connected
      try {
        await this.executeOperation(fullOperation);
        this.emit('operationCompleted', { operation: fullOperation, timestamp: new Date() });
      } catch (error) {
        // Queue for retry if immediate execution fails
        this.offlineQueue.add(fullOperation);
        this.addError('execute_operation', error as Error, { operation: fullOperation });
      }
    } else {
      // Queue for later if offline
      this.offlineQueue.add(fullOperation);
    }

    this.status.pendingOperations = this.offlineQueue.size;
    return fullOperation.id;
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return { ...this.status };
  }

  /**
   * Add event listener
   */
  addEventListener(event: string, listener: (event: SyncEvent) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(event: string, listener: (event: SyncEvent) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // Private methods

  private setupWebSocketHandlers(): void {
    this.wsManager.setConnectHandler(() => {
      this.status.isConnected = true;
      this.emit('connected', { timestamp: new Date() });
      this.processOfflineQueue();
    });

    this.wsManager.setDisconnectHandler(() => {
      this.status.isConnected = false;
      this.emit('disconnected', { timestamp: new Date() });
    });

    this.wsManager.setMessageHandler((data) => {
      this.handleWebSocketMessage(data);
    });
  }

  private handleWebSocketMessage(data: any): void {
    switch (data.type) {
      case 'email_update':
        this.handleEmailUpdate(data.email);
        break;
      case 'email_delete':
        this.handleEmailDelete(data.emailId);
        break;
      case 'sync_request':
        this.performFullSync().catch(console.error);
        break;
      default:
        console.log('Unknown WebSocket message type:', data.type);
    }
  }

  private async handleEmailUpdate(email: EmailMessage): Promise<void> {
    try {
      // Check for conflicts
      const cached = await cacheManager.getEmail(email.id);
      if (cached) {
        const resolved = cacheManager.resolveEmailConflict(cached, email, this.config.conflictStrategy);
        await cacheManager.setEmail(resolved);
        
        if (resolved.id !== cached.id) {
          this.status.metrics.conflictsResolved++;
        }
      } else {
        await cacheManager.setEmail(email);
      }

      this.emit('emailUpdated', { email, timestamp: new Date() });
    } catch (error) {
      this.addError('handle_email_update', error as Error, { emailId: email.id });
    }
  }

  private async handleEmailDelete(emailId: string): Promise<void> {
    try {
      await cacheManager.invalidateEmailCache(emailId);
      this.emit('emailDeleted', { emailId, timestamp: new Date() });
    } catch (error) {
      this.addError('handle_email_delete', error as Error, { emailId });
    }
  }

  private async processOfflineQueue(): Promise<void> {
    const operations = this.offlineQueue.getPending();
    
    for (const operation of operations) {
      try {
        await this.executeOperation(operation);
        this.offlineQueue.remove(operation.id);
        this.emit('operationCompleted', { operation, timestamp: new Date() });
      } catch (error) {
        if (operation.retryCount >= operation.maxRetries) {
          this.offlineQueue.remove(operation.id);
          this.addError('execute_operation_failed', error as Error, { operation });
        } else {
          operation.retryCount++;
          this.addError('execute_operation_retry', error as Error, { operation });
        }
      }
    }

    this.status.pendingOperations = this.offlineQueue.size;
  }

  private async executeOperation(operation: SyncOperation): Promise<void> {
    switch (operation.type) {
      case 'create':
        if (operation.entityType === 'email') {
          await this.appleCli.sendEmail(operation.data);
        }
        break;
      
      case 'update':
        if (operation.entityType === 'email') {
          await this.appleCli.updateEmail(operation.entityId, operation.data);
        }
        break;
      
      case 'delete':
        if (operation.entityType === 'email') {
          await this.appleCli.deleteEmail(operation.entityId);
        }
        break;
      
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  private async processEmailsFromAppleMail(emails: EmailMessage[]): Promise<void> {
    const batchSize = this.config.batchSize;
    
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (email) => {
        try {
          await cacheManager.setEmail(email);
        } catch (error) {
          console.warn(`Failed to cache email ${email.id}:`, error);
        }
      }));

      // Update progress
      this.status.syncProgress = Math.min(75, (i / emails.length) * 50 + 25);
    }
  }

  private async processDeletions(deletedIds: string[]): Promise<void> {
    await Promise.all(deletedIds.map(async (emailId) => {
      try {
        await cacheManager.invalidateEmailCache(emailId);
      } catch (error) {
        console.warn(`Failed to delete cached email ${emailId}:`, error);
      }
    }));
  }

  private async updateCache(appleMailData: AppleMailSyncData): Promise<void> {
    // Store sync metadata
    const syncMetadata = {
      lastSync: appleMailData.lastModified,
      syncToken: appleMailData.syncToken,
      emailCount: appleMailData.emails.length
    };

    localStorage.setItem('apple-mail-sync-metadata', JSON.stringify(syncMetadata));
  }

  private updateSyncMetrics(success: boolean, duration: number, itemCount: number): void {
    this.status.metrics.totalSyncs++;
    
    if (success) {
      this.status.metrics.successfulSyncs++;
      this.status.metrics.averageSyncTime = 
        (this.status.metrics.averageSyncTime + duration) / 2;
      this.status.metrics.dataTransferred += itemCount;
    } else {
      this.status.metrics.failedSyncs++;
    }

    this.status.metrics.lastUpdateTime = new Date();
  }

  private addError(operation: string, error: Error, context?: any): void {
    const syncError: SyncError = {
      id: crypto.randomUUID(),
      operation,
      message: error.message,
      timestamp: new Date(),
      retryCount: 0,
      context
    };

    this.status.errors.push(syncError);
    
    // Keep only last 100 errors
    if (this.status.errors.length > 100) {
      this.status.errors = this.status.errors.slice(-100);
    }
  }

  private startPeriodicSync(): void {
    this.syncInterval = setInterval(() => {
      this.performFullSync().catch(error => {
        console.error('Periodic sync failed:', error);
      });
    }, this.config.syncInterval);
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener({ type: event, ...data });
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }
}

// Export singleton instance with default configuration
export const syncManager = new SyncManager({
  wsUrl: process.env.REACT_APP_WS_URL || 'ws://localhost:8080/ws',
  applecliEndpoint: process.env.REACT_APP_APPLECLI_URL || 'http://localhost:8081/api',
  syncInterval: 300000, // 5 minutes
  maxRetries: 3,
  batchSize: 50,
  conflictStrategy: 'remote',
  enableOfflineMode: true,
  enableRealTime: true
});

export default SyncManager;