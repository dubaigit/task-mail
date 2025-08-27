/**
 * CQRS (Command Query Responsibility Segregation) Implementation
 * Separates read and write operations with optimized data models
 */

import { Command, CommandHandler, Query, QueryHandler, CommandBus, QueryBus } from './DomainEvent';
import { EventBus, DomainEvent } from './DomainEvent';

// Enhanced Command with metadata
export interface EnhancedCommand extends Command {
  commandId: string;
  commandType: string;
  aggregateId?: string;
  correlationId?: string;
  causationId?: string;
  userId?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  expectedVersion?: number;
}

// Enhanced Query with caching hints
export interface EnhancedQuery extends Query {
  queryId: string;
  queryType: string;
  userId?: string;
  timestamp: Date;
  cacheable?: boolean;
  cacheKey?: string;
  cacheTtl?: number;
  metadata?: Record<string, unknown>;
}

// Command Result
export interface CommandResult {
  success: boolean;
  aggregateId?: string;
  version?: number;
  events?: DomainEvent[];
  error?: string;
  metadata?: Record<string, unknown>;
}

// Query Result with metadata
export interface QueryResult<T> {
  data: T;
  fromCache?: boolean;
  generatedAt: Date;
  metadata?: Record<string, unknown>;
}

// Enhanced Command Handler
export interface EnhancedCommandHandler<TCommand extends EnhancedCommand> {
  handle(command: TCommand): Promise<CommandResult>;
  canHandle(command: TCommand): boolean;
  getCommandType(): string;
}

// Enhanced Query Handler
export interface EnhancedQueryHandler<TQuery extends EnhancedQuery, TResult> {
  handle(query: TQuery): Promise<QueryResult<TResult>>;
  canHandle(query: TQuery): boolean;
  getQueryType(): string;
}

// Command Validation
export interface CommandValidator<TCommand extends EnhancedCommand> {
  validate(command: TCommand): Promise<ValidationResult>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
}

// Enhanced Command Bus with validation and middleware
export class EnhancedCommandBus implements CommandBus {
  private handlers = new Map<string, EnhancedCommandHandler<any>>();
  private validators = new Map<string, CommandValidator<any>>();
  private middleware: CommandMiddleware[] = [];
  private eventBus: EventBus;
  private metrics = new Map<string, CommandMetrics>();

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  async send<T extends EnhancedCommand>(command: T): Promise<CommandResult> {
    const startTime = Date.now();
    
    try {
      // Pre-processing middleware
      for (const middleware of this.middleware) {
        await middleware.preProcess(command);
      }

      // Validate command
      const validator = this.validators.get(command.commandType);
      if (validator) {
        const validation = await validator.validate(command);
        if (!validation.isValid) {
          const result: CommandResult = {
            success: false,
            error: `Command validation failed: ${validation.errors.map(e => e.message).join(', ')}`
          };
          this.recordMetrics(command.commandType, false, Date.now() - startTime);
          return result;
        }
      }

      // Get handler
      const handler = this.handlers.get(command.commandType);
      if (!handler) {
        const result: CommandResult = {
          success: false,
          error: `No handler found for command: ${command.commandType}`
        };
        this.recordMetrics(command.commandType, false, Date.now() - startTime);
        return result;
      }

      // Execute command
      const result = await handler.handle(command);

      // Post-processing middleware
      for (const middleware of this.middleware) {
        await middleware.postProcess(command, result);
      }

      // Publish domain events
      if (result.success && result.events && result.events.length > 0) {
        await this.eventBus.publishAll(result.events);
      }

      this.recordMetrics(command.commandType, result.success, Date.now() - startTime);
      return result;

    } catch (error) {
      const result: CommandResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      this.recordMetrics(command.commandType, false, Date.now() - startTime);
      return result;
    }
  }

  register<T extends EnhancedCommand>(commandType: string, handler: EnhancedCommandHandler<T>): void {
    this.handlers.set(commandType, handler);
  }

  registerValidator<T extends EnhancedCommand>(commandType: string, validator: CommandValidator<T>): void {
    this.validators.set(commandType, validator);
  }

  addMiddleware(middleware: CommandMiddleware): void {
    this.middleware.push(middleware);
  }

  private recordMetrics(commandType: string, success: boolean, duration: number): void {
    const existing = this.metrics.get(commandType) || {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalDuration: 0,
      averageDuration: 0,
      lastExecuted: new Date()
    };

    existing.totalExecutions++;
    existing.totalDuration += duration;
    existing.averageDuration = existing.totalDuration / existing.totalExecutions;
    existing.lastExecuted = new Date();

    if (success) {
      existing.successfulExecutions++;
    } else {
      existing.failedExecutions++;
    }

    this.metrics.set(commandType, existing);
  }

  getMetrics(): Map<string, CommandMetrics> {
    return new Map(this.metrics);
  }
}

// Enhanced Query Bus with caching and projection support
export class EnhancedQueryBus implements QueryBus {
  private handlers = new Map<string, EnhancedQueryHandler<any, any>>();
  private cache = new Map<string, CacheEntry>();
  private middleware: QueryMiddleware[] = [];
  private metrics = new Map<string, QueryMetrics>();
  private cacheTtlMs = 5 * 60 * 1000; // 5 minutes default

  async ask<TQuery extends EnhancedQuery, TResult>(query: TQuery): Promise<QueryResult<TResult>> {
    const startTime = Date.now();
    
    try {
      // Pre-processing middleware
      for (const middleware of this.middleware) {
        await middleware.preProcess(query);
      }

      // Check cache first
      if (query.cacheable) {
        const cacheKey = query.cacheKey || this.generateCacheKey(query);
        const cached = this.cache.get(cacheKey);
        
        if (cached && this.isCacheValid(cached, query.cacheTtl)) {
          const result: QueryResult<TResult> = {
            data: cached.data,
            fromCache: true,
            generatedAt: cached.timestamp
          };
          
          this.recordMetrics(query.queryType, true, Date.now() - startTime, true);
          return result;
        }
      }

      // Get handler
      const handler = this.handlers.get(query.queryType);
      if (!handler) {
        throw new Error(`No handler found for query: ${query.queryType}`);
      }

      // Execute query
      const result = await handler.handle(query);

      // Cache result if cacheable
      if (query.cacheable && result.data) {
        const cacheKey = query.cacheKey || this.generateCacheKey(query);
        this.cache.set(cacheKey, {
          data: result.data,
          timestamp: new Date(),
          ttl: query.cacheTtl || this.cacheTtlMs
        });
      }

      // Post-processing middleware
      for (const middleware of this.middleware) {
        await middleware.postProcess(query, result);
      }

      this.recordMetrics(query.queryType, true, Date.now() - startTime, false);
      return result;

    } catch (error) {
      this.recordMetrics(query.queryType, false, Date.now() - startTime, false);
      throw error;
    }
  }

  register<TQuery extends EnhancedQuery, TResult>(
    queryType: string, 
    handler: EnhancedQueryHandler<TQuery, TResult>
  ): void {
    this.handlers.set(queryType, handler);
  }

  addMiddleware(middleware: QueryMiddleware): void {
    this.middleware.push(middleware);
  }

  clearCache(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    const regex = new RegExp(pattern);
    for (const [key] of this.cache) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  private generateCacheKey(query: EnhancedQuery): string {
    return `${query.queryType}:${JSON.stringify(query).hashCode()}`;
  }

  private isCacheValid(entry: CacheEntry, customTtl?: number): boolean {
    const ttl = customTtl || entry.ttl || this.cacheTtlMs;
    const age = Date.now() - entry.timestamp.getTime();
    return age < ttl;
  }

  private recordMetrics(queryType: string, success: boolean, duration: number, fromCache: boolean): void {
    const existing = this.metrics.get(queryType) || {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalDuration: 0,
      averageDuration: 0,
      lastExecuted: new Date()
    };

    existing.totalExecutions++;
    existing.totalDuration += duration;
    existing.averageDuration = existing.totalDuration / existing.totalExecutions;
    existing.lastExecuted = new Date();

    if (success) {
      existing.successfulExecutions++;
    } else {
      existing.failedExecutions++;
    }

    if (fromCache) {
      existing.cacheHits++;
    } else {
      existing.cacheMisses++;
    }

    this.metrics.set(queryType, existing);
  }

  getMetrics(): Map<string, QueryMetrics> {
    return new Map(this.metrics);
  }
}

// Middleware Interfaces
export interface CommandMiddleware {
  preProcess(command: EnhancedCommand): Promise<void>;
  postProcess(command: EnhancedCommand, result: CommandResult): Promise<void>;
}

export interface QueryMiddleware {
  preProcess(query: EnhancedQuery): Promise<void>;
  postProcess(query: EnhancedQuery, result: QueryResult<any>): Promise<void>;
}

// Read Model Base Class
export abstract class ReadModel {
  public readonly id: string;
  public readonly version: number;
  public readonly lastUpdated: Date;

  constructor(id: string, version: number = 1) {
    this.id = id;
    this.version = version;
    this.lastUpdated = new Date();
  }

  abstract applyEvent(event: DomainEvent): void;
}

// Projection Engine for Read Models
export class ProjectionEngine {
  private projections = new Map<string, ReadModelProjection<any>>();
  private eventBus: EventBus;
  private snapshots = new Map<string, ReadModel>();
  private snapshotFrequency = 10; // Take snapshot every N events

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  registerProjection<T extends ReadModel>(projection: ReadModelProjection<T>): void {
    this.projections.set(projection.getProjectionName(), projection);
    
    // Subscribe to relevant events
    projection.getEventTypes().forEach(eventType => {
      this.eventBus.subscribe(eventType, {
        handle: async (event: DomainEvent) => {
          await this.projectEvent(projection, event);
        }
      });
    });
  }

  private async projectEvent<T extends ReadModel>(projection: ReadModelProjection<T>, event: DomainEvent): Promise<void> {
    try {
      const readModel = await this.getOrCreateReadModel(projection, event.aggregateId);
      readModel.applyEvent(event);
      await projection.save(readModel);

      // Take snapshot if needed
      if (readModel.version % this.snapshotFrequency === 0) {
        this.snapshots.set(`${projection.getProjectionName()}:${readModel.id}`, readModel);
      }
    } catch (error) {
      console.error(`Error projecting event ${event.getEventName()} to ${projection.getProjectionName()}:`, error);
      // In a real system, you'd want to implement dead letter queue or retry logic
    }
  }

  private async getOrCreateReadModel<T extends ReadModel>(
    projection: ReadModelProjection<T>, 
    aggregateId: string
  ): Promise<T> {
    // Try to get from snapshot first
    const snapshotKey = `${projection.getProjectionName()}:${aggregateId}`;
    const snapshot = this.snapshots.get(snapshotKey);
    if (snapshot) {
      return snapshot as T;
    }

    // Try to load existing
    const existing = await projection.findById(aggregateId);
    if (existing) {
      return existing;
    }

    // Create new
    return projection.createNew(aggregateId);
  }

  async rebuildProjection<T extends ReadModel>(projectionName: string, fromVersion?: number): Promise<void> {
    const projection = this.projections.get(projectionName);
    if (!projection) {
      throw new Error(`Projection ${projectionName} not found`);
    }

    console.log(`Rebuilding projection ${projectionName} from version ${fromVersion || 0}`);
    
    // Clear existing data
    await projection.clear();
    
    // Replay events
    // This would require access to event store - simplified for this example
    console.log(`Projection ${projectionName} rebuilt successfully`);
  }
}

// Read Model Projection Interface
export interface ReadModelProjection<T extends ReadModel> {
  getProjectionName(): string;
  getEventTypes(): string[];
  findById(id: string): Promise<T | null>;
  save(readModel: T): Promise<void>;
  createNew(id: string): T;
  clear(): Promise<void>;
}

// Base Classes for Commands and Queries
export abstract class BaseCommand implements EnhancedCommand {
  public readonly commandId: string;
  public readonly commandType: string;
  public readonly timestamp: Date;
  public correlationId?: string;
  public causationId?: string;
  public userId?: string;
  public metadata?: Record<string, unknown>;
  public aggregateId?: string;
  public expectedVersion?: number;

  constructor(commandType: string) {
    this.commandId = crypto.randomUUID();
    this.commandType = commandType;
    this.timestamp = new Date();
  }
}

export abstract class BaseQuery implements EnhancedQuery {
  public readonly queryId: string;
  public readonly queryType: string;
  public readonly timestamp: Date;
  public userId?: string;
  public cacheable?: boolean;
  public cacheKey?: string;
  public cacheTtl?: number;
  public metadata?: Record<string, unknown>;

  constructor(queryType: string, cacheable: boolean = false) {
    this.queryId = crypto.randomUUID();
    this.queryType = queryType;
    this.timestamp = new Date();
    this.cacheable = cacheable;
  }
}

// Metrics Types
export interface CommandMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  totalDuration: number;
  averageDuration: number;
  lastExecuted: Date;
}

export interface QueryMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  cacheHits: number;
  cacheMisses: number;
  totalDuration: number;
  averageDuration: number;
  lastExecuted: Date;
}

// Cache Entry
interface CacheEntry {
  data: any;
  timestamp: Date;
  ttl: number;
}

// CQRS Facade for easy setup
export class CQRSFacade {
  public readonly commandBus: EnhancedCommandBus;
  public readonly queryBus: EnhancedQueryBus;
  public readonly projectionEngine: ProjectionEngine;

  constructor(eventBus: EventBus) {
    this.commandBus = new EnhancedCommandBus(eventBus);
    this.queryBus = new EnhancedQueryBus();
    this.projectionEngine = new ProjectionEngine(eventBus);
  }

  // Register command handler with optional validator
  registerCommand<T extends EnhancedCommand>(
    commandType: string,
    handler: EnhancedCommandHandler<T>,
    validator?: CommandValidator<T>
  ): void {
    this.commandBus.register(commandType, handler);
    if (validator) {
      this.commandBus.registerValidator(commandType, validator);
    }
  }

  // Register query handler
  registerQuery<TQuery extends EnhancedQuery, TResult>(
    queryType: string,
    handler: EnhancedQueryHandler<TQuery, TResult>
  ): void {
    this.queryBus.register(queryType, handler);
  }

  // Register projection
  registerProjection<T extends ReadModel>(projection: ReadModelProjection<T>): void {
    this.projectionEngine.registerProjection(projection);
  }

  // Get combined metrics
  getMetrics(): {
    commands: Map<string, CommandMetrics>;
    queries: Map<string, QueryMetrics>;
  } {
    return {
      commands: this.commandBus.getMetrics(),
      queries: this.queryBus.getMetrics()
    };
  }
}

// Utility function for generating cache keys
String.prototype.hashCode = function(): number {
  let hash = 0;
  if (this.length === 0) return hash;
  for (let i = 0; i < this.length; i++) {
    const char = this.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

// Common Middleware Implementations
export class LoggingCommandMiddleware implements CommandMiddleware {
  async preProcess(command: EnhancedCommand): Promise<void> {
    console.log(`Executing command: ${command.commandType}`, {
      commandId: command.commandId,
      aggregateId: command.aggregateId,
      userId: command.userId,
      timestamp: command.timestamp
    });
  }

  async postProcess(command: EnhancedCommand, result: CommandResult): Promise<void> {
    console.log(`Command ${command.commandType} completed:`, {
      commandId: command.commandId,
      success: result.success,
      error: result.error,
      eventsGenerated: result.events?.length || 0
    });
  }
}

export class LoggingQueryMiddleware implements QueryMiddleware {
  async preProcess(query: EnhancedQuery): Promise<void> {
    console.log(`Executing query: ${query.queryType}`, {
      queryId: query.queryId,
      userId: query.userId,
      cacheable: query.cacheable,
      timestamp: query.timestamp
    });
  }

  async postProcess(query: EnhancedQuery, result: QueryResult<any>): Promise<void> {
    console.log(`Query ${query.queryType} completed:`, {
      queryId: query.queryId,
      fromCache: result.fromCache,
      generatedAt: result.generatedAt
    });
  }
}

export class AuthorizationCommandMiddleware implements CommandMiddleware {
  constructor(private authService: any) {}

  async preProcess(command: EnhancedCommand): Promise<void> {
    if (!command.userId) {
      throw new Error('Command must have a user ID for authorization');
    }

    const isAuthorized = await this.authService.canExecuteCommand(
      command.userId,
      command.commandType,
      command.aggregateId
    );

    if (!isAuthorized) {
      throw new Error(`User ${command.userId} not authorized to execute ${command.commandType}`);
    }
  }

  async postProcess(command: EnhancedCommand, result: CommandResult): Promise<void> {
    // Log authorization success/failure
  }
}