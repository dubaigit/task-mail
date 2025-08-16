/**
 * WebSocket Client for Real-time Email Updates
 * Handles connection management, message queuing, and automatic reconnection
 */

class WebSocketClient {
  constructor(url, options = {}) {
    this.url = url;
    this.options = {
      reconnectInterval: 3000, // Initial reconnect delay
      maxReconnectInterval: 30000, // Maximum reconnect delay
      reconnectDecay: 1.5, // Exponential backoff multiplier
      maxReconnectAttempts: 10, // Maximum reconnection attempts
      timeoutInterval: 5000, // Connection timeout
      heartbeatInterval: 30000, // Ping interval
      enableLogging: true,
      ...options
    };

    this.state = {
      connection: null,
      isConnected: false,
      isConnecting: false,
      reconnectAttempts: 0,
      lastHeartbeat: null,
      connectionId: null,
      userId: null
    };

    this.messageQueue = [];
    this.subscriptions = new Map();
    this.listeners = new Map();
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    this.connectionTimeout = null;

    this.init();
  }

  init() {
    this.connect();
  }

  connect() {
    if (this.state.isConnected || this.state.isConnecting) {
      this.log('Already connected or connecting');
      return;
    }

    this.log('Attempting to connect to WebSocket server...');
    this.state.isConnecting = true;
    this.emit('connecting');

    try {
      this.state.connection = new WebSocket(this.url);
      this.setupEventHandlers();
      this.setupConnectionTimeout();
    } catch (error) {
      this.log('Failed to create WebSocket connection:', error);
      this.handleConnectionError(error);
    }
  }

  setupEventHandlers() {
    const ws = this.state.connection;

    ws.onopen = (event) => {
      this.log('WebSocket connected successfully');
      this.handleConnectionOpen(event);
    };

    ws.onmessage = (event) => {
      this.handleMessage(event);
    };

    ws.onclose = (event) => {
      this.log('WebSocket connection closed:', event.code, event.reason);
      this.handleConnectionClose(event);
    };

    ws.onerror = (error) => {
      this.log('WebSocket error:', error);
      this.handleConnectionError(error);
    };
  }

  setupConnectionTimeout() {
    this.connectionTimeout = setTimeout(() => {
      if (!this.state.isConnected) {
        this.log('Connection timeout - closing connection');
        this.state.connection.close();
        this.handleConnectionError(new Error('Connection timeout'));
      }
    }, this.options.timeoutInterval);
  }

  handleConnectionOpen(event) {
    this.clearTimers();
    
    this.state.isConnected = true;
    this.state.isConnecting = false;
    this.state.reconnectAttempts = 0;
    this.state.lastHeartbeat = Date.now();

    // Send authentication if user ID is available
    if (this.state.userId) {
      this.authenticate(this.state.userId);
    }

    // Process queued messages
    this.processMessageQueue();

    // Start heartbeat
    this.startHeartbeat();

    // Restore subscriptions
    this.restoreSubscriptions();

    this.emit('connected', event);
    this.log('WebSocket connection established');
  }

  handleMessage(event) {
    try {
      const message = JSON.parse(event.data);
      this.log('Received message:', message.type);

      // Update last heartbeat time
      this.state.lastHeartbeat = Date.now();

      // Handle different message types
      switch (message.type) {
        case 'welcome':
          this.handleWelcomeMessage(message);
          break;
        case 'pong':
          this.handlePongMessage(message);
          break;
        case 'email_new':
          this.handleNewEmail(message);
          break;
        case 'email_updated':
          this.handleEmailUpdate(message);
          break;
        case 'email_deleted':
          this.handleEmailDeleted(message);
          break;
        case 'task_new':
          this.handleNewTask(message);
          break;
        case 'task_updated':
          this.handleTaskUpdate(message);
          break;
        case 'batch_progress':
          this.handleBatchProgress(message);
          break;
        case 'system_notification':
          this.handleSystemNotification(message);
          break;
        case 'error':
          this.handleServerError(message);
          break;
        default:
          this.log('Unknown message type:', message.type);
          this.emit('message', message);
      }
    } catch (error) {
      this.log('Failed to parse message:', error, event.data);
      this.emit('error', { type: 'parse_error', error, data: event.data });
    }
  }

  handleConnectionClose(event) {
    this.clearTimers();
    
    this.state.isConnected = false;
    this.state.isConnecting = false;
    this.state.connection = null;

    this.emit('disconnected', event);

    // Attempt reconnection unless explicitly closed
    if (event.code !== 1000 && event.code !== 1001) {
      this.scheduleReconnect();
    }
  }

  handleConnectionError(error) {
    this.clearTimers();
    
    this.state.isConnecting = false;
    
    if (this.state.isConnected) {
      this.state.isConnected = false;
      this.emit('disconnected', { error });
    }

    this.emit('error', error);
    this.scheduleReconnect();
  }

  scheduleReconnect() {
    if (this.state.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this.log('Maximum reconnection attempts reached');
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    const delay = Math.min(
      this.options.reconnectInterval * Math.pow(this.options.reconnectDecay, this.state.reconnectAttempts),
      this.options.maxReconnectInterval
    );

    this.log(`Scheduling reconnection in ${delay}ms (attempt ${this.state.reconnectAttempts + 1})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.state.reconnectAttempts++;
      this.emit('reconnecting', { 
        attempt: this.state.reconnectAttempts, 
        maxAttempts: this.options.maxReconnectAttempts 
      });
      this.connect();
    }, delay);
  }

  // Message Handlers

  handleWelcomeMessage(message) {
    this.state.connectionId = message.connectionId;
    this.log('Received welcome message, connection ID:', this.state.connectionId);
    this.emit('welcome', message);
  }

  handlePongMessage(message) {
    // Heartbeat response received
    this.log('Received pong');
  }

  handleNewEmail(message) {
    this.log('New email received:', message.email?.id);
    this.emit('emailNew', message.email);
  }

  handleEmailUpdate(message) {
    this.log('Email updated:', message.email?.id);
    this.emit('emailUpdated', message.email);
  }

  handleEmailDeleted(message) {
    this.log('Email deleted:', message.emailId);
    this.emit('emailDeleted', message.emailId);
  }

  handleNewTask(message) {
    this.log('New task received:', message.task?.id);
    this.emit('taskNew', message.task);
  }

  handleTaskUpdate(message) {
    this.log('Task updated:', message.task?.id);
    this.emit('taskUpdated', message.task);
  }

  handleBatchProgress(message) {
    this.log('Batch operation progress:', message.progress);
    this.emit('batchProgress', message);
  }

  handleSystemNotification(message) {
    this.log('System notification:', message.notification);
    this.emit('systemNotification', message.notification);
  }

  handleServerError(message) {
    this.log('Server error:', message.error);
    this.emit('serverError', message.error);
  }

  // Heartbeat Management

  startHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      if (this.state.isConnected) {
        this.sendPing();
        
        // Check if we've missed heartbeats
        const timeSinceLastHeartbeat = Date.now() - this.state.lastHeartbeat;
        if (timeSinceLastHeartbeat > this.options.heartbeatInterval * 2) {
          this.log('Heartbeat timeout - connection may be dead');
          this.state.connection.close();
        }
      }
    }, this.options.heartbeatInterval);
  }

  sendPing() {
    this.sendMessage({
      type: 'ping',
      timestamp: Date.now()
    });
  }

  // Public API Methods

  authenticate(userId, token = null) {
    this.state.userId = userId;
    
    const authMessage = {
      type: 'authenticate',
      userId: userId,
      timestamp: Date.now()
    };

    if (token) {
      authMessage.token = token;
    }

    this.sendMessage(authMessage);
  }

  subscribe(eventType, filters = {}) {
    const subscription = {
      type: 'subscribe',
      eventType: eventType,
      filters: filters,
      timestamp: Date.now()
    };

    this.subscriptions.set(eventType, subscription);
    this.sendMessage(subscription);
  }

  unsubscribe(eventType) {
    const unsubscription = {
      type: 'unsubscribe',
      eventType: eventType,
      timestamp: Date.now()
    };

    this.subscriptions.delete(eventType);
    this.sendMessage(unsubscription);
  }

  sendMessage(message) {
    if (!message.type) {
      throw new Error('Message must have a type');
    }

    if (this.state.isConnected && this.state.connection.readyState === WebSocket.OPEN) {
      try {
        const messageString = JSON.stringify(message);
        this.state.connection.send(messageString);
        this.log('Sent message:', message.type);
      } catch (error) {
        this.log('Failed to send message:', error);
        this.queueMessage(message);
      }
    } else {
      this.log('Connection not ready, queuing message:', message.type);
      this.queueMessage(message);
    }
  }

  queueMessage(message) {
    // Add timestamp and ensure queue doesn't grow too large
    message.queuedAt = Date.now();
    this.messageQueue.push(message);
    
    if (this.messageQueue.length > 100) {
      this.messageQueue.shift(); // Remove oldest message
      this.log('Message queue full, removing oldest message');
    }
  }

  processMessageQueue() {
    if (this.messageQueue.length === 0) return;

    this.log(`Processing ${this.messageQueue.length} queued messages`);
    
    const messages = [...this.messageQueue];
    this.messageQueue = [];

    messages.forEach(message => {
      // Check if message is still valid (not too old)
      const messageAge = Date.now() - message.queuedAt;
      if (messageAge < 60000) { // 1 minute
        delete message.queuedAt;
        this.sendMessage(message);
      }
    });
  }

  restoreSubscriptions() {
    for (const [eventType, subscription] of this.subscriptions) {
      this.sendMessage(subscription);
    }
  }

  // Event System

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    
    this.listeners.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        this.log('Event callback error:', error);
      }
    });
  }

  // Utility Methods

  clearTimers() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }

  log(...args) {
    if (this.options.enableLogging) {
      console.log('[WebSocketClient]', ...args);
    }
  }

  // Status Methods

  isConnected() {
    return this.state.isConnected;
  }

  isConnecting() {
    return this.state.isConnecting;
  }

  getConnectionState() {
    return {
      isConnected: this.state.isConnected,
      isConnecting: this.state.isConnecting,
      reconnectAttempts: this.state.reconnectAttempts,
      connectionId: this.state.connectionId,
      lastHeartbeat: this.state.lastHeartbeat,
      queuedMessages: this.messageQueue.length
    };
  }

  // Cleanup

  disconnect() {
    this.log('Manually disconnecting WebSocket');
    this.clearTimers();
    
    if (this.state.connection && this.state.connection.readyState === WebSocket.OPEN) {
      this.state.connection.close(1000, 'Manual disconnect');
    }
    
    this.state.isConnected = false;
    this.state.isConnecting = false;
    this.state.connection = null;
  }

  destroy() {
    this.log('Destroying WebSocket client');
    this.disconnect();
    this.listeners.clear();
    this.subscriptions.clear();
    this.messageQueue = [];
  }
}

// Real-time Email Manager
class RealTimeEmailManager {
  constructor(virtualizer, wsClient) {
    this.virtualizer = virtualizer;
    this.wsClient = wsClient;
    this.pendingUpdates = new Map();
    this.batchUpdateTimer = null;
    
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Handle WebSocket events
    this.wsClient.on('emailNew', (email) => this.handleNewEmail(email));
    this.wsClient.on('emailUpdated', (email) => this.handleEmailUpdate(email));
    this.wsClient.on('emailDeleted', (emailId) => this.handleEmailDeleted(emailId));
    this.wsClient.on('taskNew', (task) => this.handleNewTask(task));
    this.wsClient.on('taskUpdated', (task) => this.handleTaskUpdate(task));
    
    // Handle connection state changes
    this.wsClient.on('connected', () => this.handleConnectionStateChange('connected'));
    this.wsClient.on('disconnected', () => this.handleConnectionStateChange('disconnected'));
    this.wsClient.on('reconnecting', (data) => this.handleConnectionStateChange('reconnecting', data));
  }

  handleNewEmail(email) {
    if (!email || !email.id) return;
    
    // Add to virtualizer data
    this.virtualizer.insertItem(0, email);
    
    // Show notification
    this.showNotification('New email received', 'info');
    
    // Update UI counters
    this.updateCounters();
  }

  handleEmailUpdate(email) {
    if (!email || !email.id) return;
    
    // Find email in current data
    const data = this.virtualizer.data;
    const index = data.findIndex(item => item.id === email.id);
    
    if (index !== -1) {
      this.virtualizer.updateItem(index, email);
    } else {
      // Email not in current view, might need to refresh
      this.queueDataRefresh();
    }
  }

  handleEmailDeleted(emailId) {
    if (!emailId) return;
    
    // Find and remove email
    const data = this.virtualizer.data;
    const index = data.findIndex(item => item.id === emailId);
    
    if (index !== -1) {
      this.virtualizer.removeItem(index);
      this.updateCounters();
    }
  }

  handleNewTask(task) {
    if (!task || !task.id) return;
    
    // Show notification
    this.showNotification('New task created', 'success');
    
    // Update task counters
    this.updateTaskCounters();
  }

  handleTaskUpdate(task) {
    if (!task || !task.id) return;
    
    // Emit task update event for task list to handle
    this.emit('taskUpdated', task);
  }

  handleConnectionStateChange(state, data = {}) {
    this.updateConnectionIndicator(state, data);
    
    switch (state) {
      case 'connected':
        this.showNotification('Connected to real-time updates', 'success');
        this.subscribeTo Events();
        break;
      case 'disconnected':
        this.showNotification('Disconnected from real-time updates', 'warning');
        break;
      case 'reconnecting':
        this.showNotification(`Reconnecting... (${data.attempt}/${data.maxAttempts})`, 'info');
        break;
    }
  }

  subscribeToEvents() {
    // Subscribe to email events
    this.wsClient.subscribe('email_events', {
      user_id: this.getCurrentUserId(),
      include_drafts: true
    });
    
    // Subscribe to task events
    this.wsClient.subscribe('task_events', {
      user_id: this.getCurrentUserId()
    });
    
    // Subscribe to system notifications
    this.wsClient.subscribe('system_notifications', {
      user_id: this.getCurrentUserId()
    });
  }

  queueDataRefresh() {
    // Debounce data refresh to avoid too many requests
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    
    this.refreshTimer = setTimeout(() => {
      this.emit('dataRefreshNeeded');
    }, 2000);
  }

  updateCounters() {
    // Update email counters in UI
    this.emit('countersUpdate', {
      type: 'emails',
      data: this.virtualizer.data
    });
  }

  updateTaskCounters() {
    // Update task counters in UI
    this.emit('taskCountersUpdate');
  }

  updateConnectionIndicator(state, data = {}) {
    this.emit('connectionStateChanged', { state, data });
  }

  showNotification(message, type = 'info') {
    this.emit('notification', { message, type });
  }

  getCurrentUserId() {
    // This would typically come from app state or authentication
    return localStorage.getItem('userId') || 'default_user';
  }

  // Event system
  on(event, callback) {
    if (!this.listeners) this.listeners = new Map();
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, data) {
    if (!this.listeners || !this.listeners.has(event)) return;
    
    this.listeners.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('RealTimeEmailManager event callback error:', error);
      }
    });
  }

  destroy() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    if (this.batchUpdateTimer) {
      clearTimeout(this.batchUpdateTimer);
    }
    
    this.listeners?.clear();
    this.pendingUpdates.clear();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WebSocketClient, RealTimeEmailManager };
} else if (typeof window !== 'undefined') {
  window.WebSocketClient = WebSocketClient;
  window.RealTimeEmailManager = RealTimeEmailManager;
}