/**
 * Enhanced Event Bus Implementation for Domain-Driven Design
 * Supports event persistence, replay, and inter-context communication
 */

import { DomainEvent, EventBus, EventStore, DomainEventHandler } from './DomainEvent';

// Enhanced Event Bus with persistence and reliability features
export class PersistentEventBus implements EventBus {
  private handlers = new Map<string, DomainEventHandler<any>[]>();
  private eventStore: EventStore;
  private isProcessing = false;
  private eventQueue: DomainEvent[] = [];
  private retryAttempts = new Map<string, number>();
  private maxRetries = 3;
  private retryDelayMs = 1000;
  
  constructor(eventStore: EventStore) {
    this.eventStore = eventStore;
  }
  
  async publish(event: DomainEvent): Promise<void> {
    try {
      // Store event first for durability
      await this.eventStore.saveEvents(event.aggregateId, [event], event.aggregateVersion - 1);
      
      // Add to processing queue
      this.eventQueue.push(event);
      
      // Process queue if not already processing
      if (!this.isProcessing) {
        await this.processEventQueue();
      }
    } catch (error) {
      console.error(`Failed to publish event ${event.getEventName()}:`, error);
      throw error;
    }
  }
  
  async publishAll(events: DomainEvent[]): Promise<void> {
    if (events.length === 0) return;
    
    try {
      // Group events by aggregate for atomic storage
      const eventsByAggregate = new Map<string, DomainEvent[]>();
      
      events.forEach(event => {
        if (!eventsByAggregate.has(event.aggregateId)) {
          eventsByAggregate.set(event.aggregateId, []);
        }
        eventsByAggregate.get(event.aggregateId)!.push(event);
      });
      
      // Store all events atomically by aggregate
      for (const [aggregateId, aggregateEvents] of eventsByAggregate) {
        const expectedVersion = Math.min(...aggregateEvents.map(e => e.aggregateVersion)) - 1;
        await this.eventStore.saveEvents(aggregateId, aggregateEvents, expectedVersion);
      }
      
      // Add all to processing queue
      this.eventQueue.push(...events);
      
      // Process queue
      if (!this.isProcessing) {
        await this.processEventQueue();
      }
    } catch (error) {
      console.error('Failed to publish batch of events:', error);
      throw error;
    }
  }
  
  private async processEventQueue(): Promise<void> {
    this.isProcessing = true;
    
    try {
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift()!;
        await this.processEvent(event);
      }
    } finally {
      this.isProcessing = false;
    }
  }
  
  private async processEvent(event: DomainEvent): Promise<void> {
    const eventType = event.getEventName();
    const handlers = this.handlers.get(eventType) || [];
    
    if (handlers.length === 0) {
      return; // No handlers for this event type
    }
    
    const eventKey = `${event.eventId}-${eventType}`;
    const retryCount = this.retryAttempts.get(eventKey) || 0;
    
    try {
      // Process handlers concurrently but with error isolation
      const handlerPromises = handlers.map(async (handler) => {
        try {
          await handler.handle(event);
        } catch (error) {
          console.error(`Handler failed for event ${eventType}:`, error);
          throw error; // Re-throw to trigger retry logic
        }
      });
      
      await Promise.all(handlerPromises);
      
      // Clear retry count on success
      this.retryAttempts.delete(eventKey);
      
    } catch (error) {
      if (retryCount < this.maxRetries) {
        // Schedule retry
        this.retryAttempts.set(eventKey, retryCount + 1);
        
        setTimeout(() => {
          this.eventQueue.push(event); // Re-queue for retry
          if (!this.isProcessing) {
            this.processEventQueue();
          }
        }, this.retryDelayMs * Math.pow(2, retryCount)); // Exponential backoff
        
        console.warn(`Event ${eventType} failed, scheduling retry ${retryCount + 1}/${this.maxRetries}`);
      } else {
        // Max retries reached, log and move to dead letter queue
        console.error(`Event ${eventType} failed after ${this.maxRetries} retries, moving to dead letter queue`);
        await this.moveToDeadLetterQueue(event, error as Error);
        this.retryAttempts.delete(eventKey);
      }
    }
  }
  
  private async moveToDeadLetterQueue(event: DomainEvent, error: Error): Promise<void> {
    // In a real implementation, this would store failed events for later analysis
    console.error('Dead letter queue event:', {
      eventId: event.eventId,
      eventType: event.getEventName(),
      aggregateId: event.aggregateId,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
  
  subscribe<T extends DomainEvent>(eventType: string, handler: DomainEventHandler<T>): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
    
    console.log(`Subscribed handler to event type: ${eventType}`);
  }
  
  unsubscribe(eventType: string, handler: DomainEventHandler<any>): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
        console.log(`Unsubscribed handler from event type: ${eventType}`);
      }
    }
  }
  
  // Event replay functionality
  async replayEvents(fromTimestamp?: Date, toAggregateId?: string): Promise<void> {
    console.log('Starting event replay...');
    
    try {
      const events = await this.eventStore.getAllEvents(fromTimestamp);
      
      const filteredEvents = toAggregateId 
        ? events.filter(e => e.aggregateId === toAggregateId)
        : events;
      
      console.log(`Replaying ${filteredEvents.length} events`);
      
      for (const event of filteredEvents) {
        await this.processEvent(event);
      }
      
      console.log('Event replay completed');
    } catch (error) {
      console.error('Event replay failed:', error);
      throw error;
    }
  }
  
  // Get statistics about the event bus
  getStatistics(): EventBusStatistics {
    const handlerCounts = new Map<string, number>();
    
    for (const [eventType, handlers] of this.handlers) {
      handlerCounts.set(eventType, handlers.length);
    }
    
    return {
      eventTypesCount: this.handlers.size,
      totalHandlers: Array.from(this.handlers.values()).reduce((sum, handlers) => sum + handlers.length, 0),
      handlersByEventType: Object.fromEntries(handlerCounts),
      queuedEventsCount: this.eventQueue.length,
      isProcessing: this.isProcessing,
      activeRetries: this.retryAttempts.size
    };
  }
  
  // Graceful shutdown
  async shutdown(): Promise<void> {
    console.log('Shutting down event bus...');
    
    // Wait for current processing to complete
    while (this.isProcessing && this.eventQueue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('Event bus shutdown complete');
  }
}

// Enhanced Event Store with Supabase integration
export class SupabaseEventStore implements EventStore {
  constructor(private supabaseClient: any) {}
  
  async saveEvents(aggregateId: string, events: DomainEvent[], expectedVersion?: number): Promise<void> {
    try {
      // Start transaction
      const { data: existingEvents, error: countError } = await this.supabaseClient
        .from('domain_events')
        .select('version')
        .eq('aggregate_id', aggregateId)
        .order('version', { ascending: false })
        .limit(1);
      
      if (countError) {
        throw new Error(`Failed to check existing events: ${countError.message}`);
      }
      
      const currentVersion = existingEvents.length > 0 ? existingEvents[0].version : 0;
      
      if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
        throw new Error(`Concurrency conflict: expected version ${expectedVersion}, but current version is ${currentVersion}`);
      }
      
      // Prepare events for insertion
      const eventRecords = events.map((event, index) => ({
        event_id: event.eventId,
        aggregate_id: event.aggregateId,
        aggregate_type: this.getAggregateType(event.aggregateId),
        event_type: event.getEventName(),
        event_data: JSON.stringify(event.getEventData()),
        event_metadata: JSON.stringify({
          causationId: event.causationId,
          correlationId: event.correlationId,
          userId: event.userId
        }),
        version: currentVersion + index + 1,
        occurred_on: event.occurredOn.toISOString(),
        created_at: new Date().toISOString()
      }));
      
      // Insert events
      const { error: insertError } = await this.supabaseClient
        .from('domain_events')
        .insert(eventRecords);
      
      if (insertError) {
        throw new Error(`Failed to save events: ${insertError.message}`);
      }
      
    } catch (error) {
      console.error('Error saving events to Supabase:', error);
      throw error;
    }
  }
  
  async getEvents(aggregateId: string, fromVersion?: number): Promise<DomainEvent[]> {
    try {
      let query = this.supabaseClient
        .from('domain_events')
        .select('*')
        .eq('aggregate_id', aggregateId)
        .order('version', { ascending: true });
      
      if (fromVersion !== undefined) {
        query = query.gte('version', fromVersion);
      }
      
      const { data, error } = await query;
      
      if (error) {
        throw new Error(`Failed to retrieve events: ${error.message}`);
      }
      
      return data.map(record => this.deserializeEvent(record));
      
    } catch (error) {
      console.error('Error getting events from Supabase:', error);
      throw error;
    }
  }
  
  async getAllEvents(fromTimestamp?: Date): Promise<DomainEvent[]> {
    try {
      let query = this.supabaseClient
        .from('domain_events')
        .select('*')
        .order('occurred_on', { ascending: true });
      
      if (fromTimestamp) {
        query = query.gte('occurred_on', fromTimestamp.toISOString());
      }
      
      const { data, error } = await query;
      
      if (error) {
        throw new Error(`Failed to retrieve all events: ${error.message}`);
      }
      
      return data.map(record => this.deserializeEvent(record));
      
    } catch (error) {
      console.error('Error getting all events from Supabase:', error);
      throw error;
    }
  }
  
  private getAggregateType(aggregateId: string): string {
    // In a real implementation, you might maintain a mapping
    // or encode the type in the aggregate ID
    if (aggregateId.startsWith('email-thread-')) return 'EmailThread';
    if (aggregateId.startsWith('task-')) return 'Task';
    if (aggregateId.startsWith('ai-session-')) return 'AISession';
    if (aggregateId.startsWith('user-')) return 'User';
    return 'Unknown';
  }
  
  private deserializeEvent(record: any): DomainEvent {
    // This is a simplified deserialization
    // In a real implementation, you'd need proper event factories
    return {
      eventId: record.event_id,
      aggregateId: record.aggregate_id,
      aggregateVersion: record.version,
      eventVersion: 1,
      occurredOn: new Date(record.occurred_on),
      causationId: JSON.parse(record.event_metadata || '{}').causationId,
      correlationId: JSON.parse(record.event_metadata || '{}').correlationId,
      userId: JSON.parse(record.event_metadata || '{}').userId,
      getEventName: () => record.event_type,
      getEventData: () => JSON.parse(record.event_data || '{}')
    } as DomainEvent;
  }
}

// Inter-Context Event Handlers
export class InterContextEventHandler {
  private eventBus: EventBus;
  private contextMappings: Map<string, string[]> = new Map();
  
  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.setupDefaultMappings();
  }
  
  private setupDefaultMappings(): void {
    // Email Management -> Task Processing
    this.contextMappings.set('EmailThreadCreated', ['task-processing']);
    this.contextMappings.set('EmailAddedToThread', ['task-processing', 'ai-services']);
    
    // Task Processing -> AI Services
    this.contextMappings.set('TaskCreated', ['ai-services']);
    this.contextMappings.set('TaskStatusChanged', ['email-management']);
    
    // AI Services -> Email Management
    this.contextMappings.set('AISessionCompleted', ['email-management', 'task-processing']);
    
    // User & Auth -> All Contexts
    this.contextMappings.set('UserLoggedIn', ['email-management', 'task-processing', 'ai-services']);
    this.contextMappings.set('UserLoggedOut', ['email-management', 'task-processing', 'ai-services']);
  }
  
  async handleInterContextEvent(event: DomainEvent): Promise<void> {
    const eventType = event.getEventName();
    const targetContexts = this.contextMappings.get(eventType) || [];
    
    if (targetContexts.length === 0) {
      return; // No inter-context routing needed
    }
    
    console.log(`Routing event ${eventType} to contexts: ${targetContexts.join(', ')}`);
    
    // Create integration events for each target context
    const integrationEvents = targetContexts.map(context => 
      new InterContextIntegrationEvent(
        event,
        context,
        event.correlationId || crypto.randomUUID()
      )
    );
    
    // Publish integration events
    await this.eventBus.publishAll(integrationEvents);
  }
}

// Integration event for cross-context communication
export class InterContextIntegrationEvent extends DomainEvent {
  constructor(
    private originalEvent: DomainEvent,
    private targetContext: string,
    correlationId: string
  ) {
    super(
      originalEvent.aggregateId,
      originalEvent.aggregateVersion,
      1,
      originalEvent.eventId,
      correlationId,
      originalEvent.userId
    );
  }
  
  getEventName(): string {
    return `InterContext_${this.originalEvent.getEventName()}`;
  }
  
  getEventData(): Record<string, unknown> {
    return {
      originalEventType: this.originalEvent.getEventName(),
      originalEventData: this.originalEvent.getEventData(),
      targetContext: this.targetContext,
      sourceAggregateId: this.originalEvent.aggregateId
    };
  }
}

// Event Bus Configuration
export interface EventBusConfig {
  maxRetries?: number;
  retryDelayMs?: number;
  enableDeadLetterQueue?: boolean;
  enableEventReplay?: boolean;
  batchSize?: number;
}

// Event Bus Statistics
export interface EventBusStatistics {
  eventTypesCount: number;
  totalHandlers: number;
  handlersByEventType: Record<string, number>;
  queuedEventsCount: number;
  isProcessing: boolean;
  activeRetries: number;
}

// Event Bus Factory
export class EventBusFactory {
  static create(eventStore: EventStore, config?: EventBusConfig): EventBus {
    const eventBus = new PersistentEventBus(eventStore);
    
    if (config) {
      // Apply configuration
      (eventBus as any).maxRetries = config.maxRetries || 3;
      (eventBus as any).retryDelayMs = config.retryDelayMs || 1000;
    }
    
    return eventBus;
  }
  
  static createWithSupabase(supabaseClient: any, config?: EventBusConfig): EventBus {
    const eventStore = new SupabaseEventStore(supabaseClient);
    return this.create(eventStore, config);
  }
}

// Domain Event Projections for Read Models
export interface EventProjection<T> {
  eventType: string;
  project(event: DomainEvent, currentModel?: T): Promise<T>;
}

export class EventProjectionEngine {
  private projections: Map<string, EventProjection<any>[]> = new Map();
  private eventBus: EventBus;
  
  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }
  
  registerProjection<T>(projection: EventProjection<T>): void {
    if (!this.projections.has(projection.eventType)) {
      this.projections.set(projection.eventType, []);
    }
    
    this.projections.get(projection.eventType)!.push(projection);
    
    // Subscribe to the event type
    this.eventBus.subscribe(projection.eventType, {
      handle: async (event: DomainEvent) => {
        await projection.project(event);
      }
    });
  }
  
  async rebuildProjection<T>(projectionType: string, fromTimestamp?: Date): Promise<void> {
    const projections = this.projections.get(projectionType);
    if (!projections || projections.length === 0) {
      throw new Error(`No projections found for type: ${projectionType}`);
    }
    
    // This would need access to event store to replay events
    console.log(`Rebuilding projections for ${projectionType} from ${fromTimestamp}`);
  }
}

export { DomainEvent, DomainEventHandler, EventBus, EventStore } from './DomainEvent';