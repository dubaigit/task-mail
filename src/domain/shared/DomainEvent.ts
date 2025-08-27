/**
 * Domain Event System for DDD Architecture
 * Provides event sourcing and inter-context communication
 */

export abstract class DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventVersion: number;
  public readonly aggregateId: string;
  public readonly aggregateVersion: number;
  public readonly causationId?: string;
  public readonly correlationId?: string;
  public readonly userId?: string;
  
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    eventVersion: number = 1,
    causationId?: string,
    correlationId?: string,
    userId?: string
  ) {
    this.eventId = crypto.randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = aggregateId;
    this.aggregateVersion = aggregateVersion;
    this.eventVersion = eventVersion;
    this.causationId = causationId;
    this.correlationId = correlationId;
    this.userId = userId;
  }

  abstract getEventName(): string;
  abstract getEventData(): Record<string, unknown>;
}

export interface DomainEventHandler<T extends DomainEvent> {
  handle(event: T): Promise<void>;
}

export interface EventStore {
  saveEvents(aggregateId: string, events: DomainEvent[], expectedVersion?: number): Promise<void>;
  getEvents(aggregateId: string, fromVersion?: number): Promise<DomainEvent[]>;
  getAllEvents(fromTimestamp?: Date): Promise<DomainEvent[]>;
}

export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  publishAll(events: DomainEvent[]): Promise<void>;
  subscribe<T extends DomainEvent>(eventType: string, handler: DomainEventHandler<T>): void;
  unsubscribe(eventType: string, handler: DomainEventHandler<any>): void;
}

export class InMemoryEventBus implements EventBus {
  private handlers = new Map<string, DomainEventHandler<any>[]>();
  
  async publish(event: DomainEvent): Promise<void> {
    const eventType = event.getEventName();
    const handlers = this.handlers.get(eventType) || [];
    
    await Promise.all(
      handlers.map(handler => handler.handle(event))
    );
  }
  
  async publishAll(events: DomainEvent[]): Promise<void> {
    await Promise.all(events.map(event => this.publish(event)));
  }
  
  subscribe<T extends DomainEvent>(eventType: string, handler: DomainEventHandler<T>): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }
  
  unsubscribe(eventType: string, handler: DomainEventHandler<any>): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }
}

export class InMemoryEventStore implements EventStore {
  private events = new Map<string, DomainEvent[]>();
  
  async saveEvents(aggregateId: string, events: DomainEvent[], expectedVersion?: number): Promise<void> {
    if (!this.events.has(aggregateId)) {
      this.events.set(aggregateId, []);
    }
    
    const existingEvents = this.events.get(aggregateId)!;
    
    if (expectedVersion !== undefined && existingEvents.length !== expectedVersion) {
      throw new Error(`Concurrency conflict: expected version ${expectedVersion}, but got ${existingEvents.length}`);
    }
    
    existingEvents.push(...events);
  }
  
  async getEvents(aggregateId: string, fromVersion?: number): Promise<DomainEvent[]> {
    const events = this.events.get(aggregateId) || [];
    
    if (fromVersion !== undefined) {
      return events.slice(fromVersion);
    }
    
    return events;
  }
  
  async getAllEvents(fromTimestamp?: Date): Promise<DomainEvent[]> {
    const allEvents: DomainEvent[] = [];
    
    for (const events of this.events.values()) {
      allEvents.push(...events);
    }
    
    if (fromTimestamp) {
      return allEvents.filter(event => event.occurredOn >= fromTimestamp);
    }
    
    return allEvents.sort((a, b) => a.occurredOn.getTime() - b.occurredOn.getTime());
  }
}

// Aggregate Root Base Class
export abstract class AggregateRoot {
  protected uncommittedEvents: DomainEvent[] = [];
  public version: number = 0;
  
  protected addDomainEvent(event: DomainEvent): void {
    this.uncommittedEvents.push(event);
    this.version++;
  }
  
  public getUncommittedEvents(): DomainEvent[] {
    return [...this.uncommittedEvents];
  }
  
  public clearUncommittedEvents(): void {
    this.uncommittedEvents = [];
  }
  
  public abstract getId(): string;
}

// Value Object Base Class
export abstract class ValueObject {
  protected abstract getEqualityComponents(): unknown[];
  
  public equals(other: ValueObject): boolean {
    if (!other || other.constructor !== this.constructor) {
      return false;
    }
    
    const thisComponents = this.getEqualityComponents();
    const otherComponents = other.getEqualityComponents();
    
    if (thisComponents.length !== otherComponents.length) {
      return false;
    }
    
    return thisComponents.every((component, index) => 
      component === otherComponents[index]
    );
  }
}

// Entity Base Class
export abstract class Entity {
  protected _id: string;
  
  constructor(id: string) {
    this._id = id;
  }
  
  public getId(): string {
    return this._id;
  }
  
  public equals(other: Entity): boolean {
    return other instanceof this.constructor && other._id === this._id;
  }
}

// Domain Service Interface
export interface DomainService {
  // Domain services should be stateless and contain domain logic
  // that doesn't belong to any particular entity or value object
}

// Repository Interface
export interface Repository<T extends AggregateRoot> {
  findById(id: string): Promise<T | null>;
  save(aggregate: T): Promise<void>;
  delete(id: string): Promise<void>;
}

// Unit of Work Pattern
export interface UnitOfWork {
  registerNew<T extends AggregateRoot>(aggregate: T, repository: Repository<T>): void;
  registerDirty<T extends AggregateRoot>(aggregate: T, repository: Repository<T>): void;
  registerDeleted<T extends AggregateRoot>(aggregate: T, repository: Repository<T>): void;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export class SimpleUnitOfWork implements UnitOfWork {
  private newObjects = new Map<Repository<any>, AggregateRoot[]>();
  private dirtyObjects = new Map<Repository<any>, AggregateRoot[]>();
  private deletedObjects = new Map<Repository<any>, AggregateRoot[]>();
  private eventBus: EventBus;
  
  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }
  
  registerNew<T extends AggregateRoot>(aggregate: T, repository: Repository<T>): void {
    if (!this.newObjects.has(repository)) {
      this.newObjects.set(repository, []);
    }
    this.newObjects.get(repository)!.push(aggregate);
  }
  
  registerDirty<T extends AggregateRoot>(aggregate: T, repository: Repository<T>): void {
    if (!this.dirtyObjects.has(repository)) {
      this.dirtyObjects.set(repository, []);
    }
    this.dirtyObjects.get(repository)!.push(aggregate);
  }
  
  registerDeleted<T extends AggregateRoot>(aggregate: T, repository: Repository<T>): void {
    if (!this.deletedObjects.has(repository)) {
      this.deletedObjects.set(repository, []);
    }
    this.deletedObjects.get(repository)!.push(aggregate);
  }
  
  async commit(): Promise<void> {
    const allEvents: DomainEvent[] = [];
    
    try {
      // Save new objects
      for (const [repository, objects] of this.newObjects) {
        for (const obj of objects) {
          await repository.save(obj);
          allEvents.push(...obj.getUncommittedEvents());
          obj.clearUncommittedEvents();
        }
      }
      
      // Save dirty objects
      for (const [repository, objects] of this.dirtyObjects) {
        for (const obj of objects) {
          await repository.save(obj);
          allEvents.push(...obj.getUncommittedEvents());
          obj.clearUncommittedEvents();
        }
      }
      
      // Delete objects
      for (const [repository, objects] of this.deletedObjects) {
        for (const obj of objects) {
          await repository.delete(obj.getId());
          allEvents.push(...obj.getUncommittedEvents());
          obj.clearUncommittedEvents();
        }
      }
      
      // Publish all events
      await this.eventBus.publishAll(allEvents);
      
      this.clear();
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }
  
  async rollback(): Promise<void> {
    this.clear();
  }
  
  private clear(): void {
    this.newObjects.clear();
    this.dirtyObjects.clear();
    this.deletedObjects.clear();
  }
}

// CQRS Interfaces
export interface Command {
  commandId: string;
  correlationId?: string;
  causationId?: string;
  userId?: string;
  timestamp: Date;
}

export interface CommandHandler<T extends Command> {
  handle(command: T): Promise<void>;
}

export interface Query {
  queryId: string;
  userId?: string;
  timestamp: Date;
}

export interface QueryHandler<TQuery extends Query, TResult> {
  handle(query: TQuery): Promise<TResult>;
}

export interface CommandBus {
  send<T extends Command>(command: T): Promise<void>;
  register<T extends Command>(commandType: string, handler: CommandHandler<T>): void;
}

export interface QueryBus {
  ask<TQuery extends Query, TResult>(query: TQuery): Promise<TResult>;
  register<TQuery extends Query, TResult>(queryType: string, handler: QueryHandler<TQuery, TResult>): void;
}

export class InMemoryCommandBus implements CommandBus {
  private handlers = new Map<string, CommandHandler<any>>();
  
  async send<T extends Command>(command: T): Promise<void> {
    const handler = this.handlers.get(command.constructor.name);
    if (!handler) {
      throw new Error(`No handler found for command: ${command.constructor.name}`);
    }
    
    await handler.handle(command);
  }
  
  register<T extends Command>(commandType: string, handler: CommandHandler<T>): void {
    this.handlers.set(commandType, handler);
  }
}

export class InMemoryQueryBus implements QueryBus {
  private handlers = new Map<string, QueryHandler<any, any>>();
  
  async ask<TQuery extends Query, TResult>(query: TQuery): Promise<TResult> {
    const handler = this.handlers.get(query.constructor.name);
    if (!handler) {
      throw new Error(`No handler found for query: ${query.constructor.name}`);
    }
    
    return await handler.handle(query);
  }
  
  register<TQuery extends Query, TResult>(queryType: string, handler: QueryHandler<TQuery, TResult>): void {
    this.handlers.set(queryType, handler);
  }
}