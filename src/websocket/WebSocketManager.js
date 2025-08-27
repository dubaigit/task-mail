/**
 * WebSocket Manager - Real-time communication hub for Apple Mail Task Manager
 * Replaces polling mechanisms with efficient WebSocket/SSE integration
 */

const WebSocket = require('ws');
const EventEmitter = require('events');
const winston = require('winston');
const crypto = require('crypto');

// Enhanced logger for WebSocket operations
const logger = winston.createLogger({
  level: process.env.WS_LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'websocket-manager' },
  transports: [
    new winston.transports.File({ filename: 'logs/websocket-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/websocket-combined.log' }),
    ...(process.env.NODE_ENV !== 'production' ? [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    ] : [])
  ],
});

/**
 * Connection Manager - Handles WebSocket connections and room management
 */
class ConnectionManager extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map();
    this.rooms = new Map();
    this.heartbeatInterval = 30000; // 30 seconds
    this.connectionTimeout = 60000; // 60 seconds
    this.maxConnectionsPerIP = 10;
    this.connectionsByIP = new Map();
    this.setupHeartbeat();
  }

  addConnection(ws, connectionInfo) {
    const connectionId = crypto.randomUUID();
    const clientIP = connectionInfo.ip;

    // Rate limiting by IP
    const ipConnections = this.connectionsByIP.get(clientIP) || 0;
    if (ipConnections >= this.maxConnectionsPerIP) {
      logger.warn('Connection limit exceeded for IP', { clientIP, limit: this.maxConnectionsPerIP });
      ws.close(1008, 'Connection limit exceeded');
      return null;
    }

    const connection = {
      id: connectionId,
      ws,
      ip: clientIP,
      userAgent: connectionInfo.userAgent,
      rooms: new Set(),
      lastHeartbeat: Date.now(),
      isAlive: true,
      metadata: connectionInfo.metadata || {}
    };

    this.connections.set(connectionId, connection);
    this.connectionsByIP.set(clientIP, ipConnections + 1);

    // Setup WebSocket event handlers
    this.setupConnectionHandlers(connection);

    logger.info('WebSocket connection established', {
      connectionId,
      clientIP,
      totalConnections: this.connections.size
    });

    this.emit('connection:new', connection);
    return connectionId;
  }

  removeConnection(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Remove from all rooms
    connection.rooms.forEach(roomId => {
      this.leaveRoom(connectionId, roomId);
    });

    // Update IP connection count
    const ipConnections = this.connectionsByIP.get(connection.ip) || 1;
    if (ipConnections <= 1) {
      this.connectionsByIP.delete(connection.ip);
    } else {
      this.connectionsByIP.set(connection.ip, ipConnections - 1);
    }

    this.connections.delete(connectionId);

    logger.info('WebSocket connection removed', {
      connectionId,
      clientIP: connection.ip,
      totalConnections: this.connections.size
    });

    this.emit('connection:removed', connection);
  }

  setupConnectionHandlers(connection) {
    const { ws, id } = connection;

    ws.on('pong', () => {
      connection.lastHeartbeat = Date.now();
      connection.isAlive = true;
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(connection, message);
      } catch (error) {
        logger.error('Invalid message format', { connectionId: id, error: error.message });
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', (code, reason) => {
      logger.info('WebSocket connection closed', {
        connectionId: id,
        code,
        reason: reason.toString()
      });
      this.removeConnection(id);
    });

    ws.on('error', (error) => {
      logger.error('WebSocket connection error', {
        connectionId: id,
        error: error.message
      });
      this.removeConnection(id);
    });
  }

  handleMessage(connection, message) {
    const { type, payload } = message;

    switch (type) {
      case 'join_room':
        this.joinRoom(connection.id, payload.roomId);
        break;
      case 'leave_room':
        this.leaveRoom(connection.id, payload.roomId);
        break;
      case 'subscribe':
        this.handleSubscription(connection, payload);
        break;
      case 'heartbeat':
        connection.lastHeartbeat = Date.now();
        connection.ws.send(JSON.stringify({ type: 'heartbeat_ack' }));
        break;
      default:
        logger.warn('Unknown message type', { connectionId: connection.id, type });
    }

    this.emit('message', { connection, message });
  }

  handleSubscription(connection, payload) {
    const { events } = payload;
    if (!Array.isArray(events)) return;

    connection.subscriptions = new Set([...(connection.subscriptions || []), ...events]);
    
    connection.ws.send(JSON.stringify({
      type: 'subscription_ack',
      events: Array.from(connection.subscriptions)
    }));

    logger.info('Client subscribed to events', {
      connectionId: connection.id,
      events,
      totalSubscriptions: connection.subscriptions.size
    });
  }

  joinRoom(connectionId, roomId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }

    this.rooms.get(roomId).add(connectionId);
    connection.rooms.add(roomId);

    connection.ws.send(JSON.stringify({
      type: 'room_joined',
      roomId
    }));

    logger.debug('Connection joined room', { connectionId, roomId });
  }

  leaveRoom(connectionId, roomId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const room = this.rooms.get(roomId);
    if (room) {
      room.delete(connectionId);
      if (room.size === 0) {
        this.rooms.delete(roomId);
      }
    }

    connection.rooms.delete(roomId);

    connection.ws.send(JSON.stringify({
      type: 'room_left',
      roomId
    }));

    logger.debug('Connection left room', { connectionId, roomId });
  }

  broadcastToRoom(roomId, message) {
    const room = this.rooms.get(roomId);
    if (!room) return 0;

    let sentCount = 0;
    room.forEach(connectionId => {
      const connection = this.connections.get(connectionId);
      if (connection && connection.ws.readyState === WebSocket.OPEN) {
        try {
          connection.ws.send(JSON.stringify(message));
          sentCount++;
        } catch (error) {
          logger.error('Failed to send message to connection', {
            connectionId,
            error: error.message
          });
        }
      }
    });

    logger.debug('Broadcast to room', { roomId, sentCount, roomSize: room.size });
    return sentCount;
  }

  broadcastToSubscribers(eventType, data) {
    let sentCount = 0;
    
    this.connections.forEach(connection => {
      if (connection.subscriptions?.has(eventType) && 
          connection.ws.readyState === WebSocket.OPEN) {
        try {
          connection.ws.send(JSON.stringify({
            type: 'event',
            eventType,
            data,
            timestamp: new Date().toISOString()
          }));
          sentCount++;
        } catch (error) {
          logger.error('Failed to send event to subscriber', {
            connectionId: connection.id,
            eventType,
            error: error.message
          });
        }
      }
    });

    logger.debug('Broadcast to subscribers', { eventType, sentCount });
    return sentCount;
  }

  setupHeartbeat() {
    setInterval(() => {
      const now = Date.now();
      const deadConnections = [];

      this.connections.forEach((connection, connectionId) => {
        if (connection.ws.readyState === WebSocket.OPEN) {
          if (now - connection.lastHeartbeat > this.connectionTimeout) {
            deadConnections.push(connectionId);
          } else {
            connection.isAlive = false;
            connection.ws.ping();
          }
        } else {
          deadConnections.push(connectionId);
        }
      });

      // Clean up dead connections
      deadConnections.forEach(connectionId => {
        logger.info('Removing dead connection', { connectionId });
        this.removeConnection(connectionId);
      });

      if (deadConnections.length > 0) {
        logger.info('Heartbeat cleanup completed', { removed: deadConnections.length });
      }
    }, this.heartbeatInterval);
  }

  getStats() {
    const roomStats = Array.from(this.rooms.entries()).map(([roomId, connections]) => ({
      roomId,
      connectionCount: connections.size
    }));

    return {
      totalConnections: this.connections.size,
      totalRooms: this.rooms.size,
      connectionsByIP: Object.fromEntries(this.connectionsByIP),
      roomStats,
      uptime: process.uptime()
    };
  }
}

/**
 * WebSocket Manager - Main class for WebSocket integration
 */
class WebSocketManager extends EventEmitter {
  constructor() {
    super();
    this.wss = null;
    this.connectionManager = new ConnectionManager();
    this.isRunning = false;
    this.setupEventHandlers();
  }

  initialize(server, options = {}) {
    const wsOptions = {
      server,
      path: options.path || '/ws',
      verifyClient: this.verifyClient.bind(this),
      ...options
    };

    this.wss = new WebSocket.Server(wsOptions);
    this.setupServerHandlers();
    this.isRunning = true;

    logger.info('WebSocket server initialized', {
      path: wsOptions.path,
      options: Object.keys(wsOptions)
    });

    return this;
  }

  verifyClient({ req, origin }) {
    // Basic security checks
    const allowedOrigins = process.env.WS_ALLOWED_ORIGINS?.split(',') || ['localhost'];
    
    if (process.env.NODE_ENV === 'production' && origin) {
      const originUrl = new URL(origin);
      if (!allowedOrigins.includes(originUrl.hostname)) {
        logger.warn('WebSocket connection rejected - invalid origin', { origin });
        return false;
      }
    }

    return true;
  }

  setupServerHandlers() {
    this.wss.on('connection', (ws, req) => {
      const connectionInfo = {
        ip: req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        origin: req.headers.origin
      };

      const connectionId = this.connectionManager.addConnection(ws, connectionInfo);
      
      if (connectionId) {
        // Send initial connection info
        ws.send(JSON.stringify({
          type: 'connection_established',
          connectionId,
          serverTime: new Date().toISOString()
        }));
      }
    });

    this.wss.on('error', (error) => {
      logger.error('WebSocket server error', { error: error.message });
    });

    this.wss.on('listening', () => {
      logger.info('WebSocket server is listening');
    });
  }

  setupEventHandlers() {
    this.connectionManager.on('connection:new', (connection) => {
      this.emit('connection', connection);
    });

    this.connectionManager.on('connection:removed', (connection) => {
      this.emit('disconnection', connection);
    });
  }

  // High-level broadcasting methods
  broadcastTaskUpdate(taskData) {
    const message = {
      type: 'task_updated',
      data: taskData,
      timestamp: new Date().toISOString()
    };

    const sentCount = this.broadcastToSubscribers('task_updates', taskData);
    logger.info('Task update broadcast', { taskId: taskData.id, sentCount });
    
    return sentCount;
  }

  broadcastDashboardUpdate(dashboardData) {
    const message = {
      type: 'dashboard_updated',
      data: dashboardData,
      timestamp: new Date().toISOString()
    };

    const sentCount = this.connectionManager.broadcastToRoom('dashboard', message);
    logger.info('Dashboard update broadcast', { sentCount });
    
    return sentCount;
  }

  broadcastAIProcessingUpdate(processingData) {
    const message = {
      type: 'ai_processing_update',
      data: processingData,
      timestamp: new Date().toISOString()
    };

    const sentCount = this.broadcastToSubscribers('ai_updates', processingData);
    logger.info('AI processing update broadcast', { sentCount });
    
    return sentCount;
  }

  broadcastEmailSync(syncData) {
    const message = {
      type: 'email_sync_update',
      data: syncData,
      timestamp: new Date().toISOString()
    };

    const sentCount = this.broadcastToSubscribers('sync_updates', syncData);
    logger.info('Email sync update broadcast', { sentCount });
    
    return sentCount;
  }

  // Statistics and monitoring
  getStats() {
    return {
      ...this.connectionManager.getStats(),
      isRunning: this.isRunning,
      wssClients: this.wss?.clients.size || 0
    };
  }

  // Graceful shutdown
  async shutdown() {
    logger.info('Shutting down WebSocket server...');
    this.isRunning = false;

    if (this.wss) {
      // Close all connections gracefully
      this.wss.clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1001, 'Server shutting down');
        }
      });

      // Close the server
      await new Promise((resolve) => {
        this.wss.close(resolve);
      });

      logger.info('WebSocket server shutdown complete');
    }
  }
}

module.exports = { WebSocketManager, ConnectionManager };