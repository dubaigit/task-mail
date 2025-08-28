/**
 * AI Services Bounded Context - Aggregate Root: AISession
 * Domain-driven design implementation for AI processing and draft generation
 */

import { AggregateRoot, Entity, ValueObject, DomainEvent } from '../../shared/DomainEvent';

// Enums
export enum AIModelType {
  GPT_4 = 'GPT_4',
  GPT_4_TURBO = 'GPT_4_TURBO',
  GPT_5 = 'GPT_5',
  CLAUDE_3 = 'CLAUDE_3',
  CLAUDE_4 = 'CLAUDE_4'
}

export enum AITaskType {
  EMAIL_CLASSIFICATION = 'EMAIL_CLASSIFICATION',
  DRAFT_GENERATION = 'DRAFT_GENERATION',
  CONTENT_SUMMARIZATION = 'CONTENT_SUMMARIZATION',
  TASK_EXTRACTION = 'TASK_EXTRACTION',
  SENTIMENT_ANALYSIS = 'SENTIMENT_ANALYSIS'
}

export enum AISessionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export enum DraftTone {
  PROFESSIONAL = 'PROFESSIONAL',
  FRIENDLY = 'FRIENDLY',
  FORMAL = 'FORMAL',
  CASUAL = 'CASUAL',
  URGENT = 'URGENT',
  APOLOGETIC = 'APOLOGETIC'
}

// Value Objects
export class AIPrompt extends ValueObject {
  constructor(
    public readonly content: string,
    public readonly systemInstructions?: string,
    public readonly temperature: number = 0.7,
    public readonly maxTokens?: number
  ) {
    super();
    this.validate();
  }

  private validate(): void {
    if (!this.content || this.content.trim().length === 0) {
      throw new Error('AI prompt content cannot be empty');
    }
    if (this.temperature < 0 || this.temperature > 1) {
      throw new Error('Temperature must be between 0 and 1');
    }
    if (this.maxTokens && this.maxTokens <= 0) {
      throw new Error('Max tokens must be positive');
    }
  }

  protected getEqualityComponents(): unknown[] {
    return [this.content, this.systemInstructions, this.temperature, this.maxTokens];
  }

  getTokenEstimate(): number {
    // Rough estimate: 1 token ≈ 4 characters for English text
    return Math.ceil(this.content.length / 4);
  }
}

export class AIResponse extends ValueObject {
  constructor(
    public readonly content: string,
    public readonly confidence: number,
    public readonly tokensUsed: TokenUsage,
    public readonly finishReason: string = 'stop',
    public readonly metadata?: Record<string, unknown>
  ) {
    super();
    this.validate();
  }

  private validate(): void {
    if (!this.content || this.content.trim().length === 0) {
      throw new Error('AI response content cannot be empty');
    }
    if (this.confidence < 0 || this.confidence > 1) {
      throw new Error('Confidence must be between 0 and 1');
    }
  }

  protected getEqualityComponents(): unknown[] {
    return [this.content, this.confidence, this.tokensUsed, this.finishReason];
  }

  isHighConfidence(threshold: number = 0.8): boolean {
    return this.confidence >= threshold;
  }
}

export class TokenUsage extends ValueObject {
  constructor(
    public readonly inputTokens: number,
    public readonly outputTokens: number,
    public readonly totalTokens: number,
    public readonly cost?: number
  ) {
    super();
    this.validate();
  }

  private validate(): void {
    if (this.inputTokens < 0 || this.outputTokens < 0 || this.totalTokens < 0) {
      throw new Error('Token counts cannot be negative');
    }
    if (this.totalTokens !== this.inputTokens + this.outputTokens) {
      throw new Error('Total tokens must equal input tokens plus output tokens');
    }
    if (this.cost && this.cost < 0) {
      throw new Error('Cost cannot be negative');
    }
  }

  protected getEqualityComponents(): unknown[] {
    return [this.inputTokens, this.outputTokens, this.totalTokens, this.cost];
  }
}

export class AIConfiguration extends ValueObject {
  constructor(
    public readonly modelType: AIModelType,
    public readonly temperature: number = 0.7,
    public readonly maxTokens?: number,
    public readonly topP?: number,
    public readonly frequencyPenalty?: number,
    public readonly presencePenalty?: number
  ) {
    super();
    this.validate();
  }

  private validate(): void {
    if (this.temperature < 0 || this.temperature > 2) {
      throw new Error('Temperature must be between 0 and 2');
    }
    if (this.topP && (this.topP < 0 || this.topP > 1)) {
      throw new Error('Top P must be between 0 and 1');
    }
    if (this.frequencyPenalty && (this.frequencyPenalty < -2 || this.frequencyPenalty > 2)) {
      throw new Error('Frequency penalty must be between -2 and 2');
    }
    if (this.presencePenalty && (this.presencePenalty < -2 || this.presencePenalty > 2)) {
      throw new Error('Presence penalty must be between -2 and 2');
    }
  }

  protected getEqualityComponents(): unknown[] {
    return [
      this.modelType,
      this.temperature,
      this.maxTokens,
      this.topP,
      this.frequencyPenalty,
      this.presencePenalty
    ];
  }

  isOptimizedForQuality(): boolean {
    return this.temperature <= 0.3;
  }

  isOptimizedForCreativity(): boolean {
    return this.temperature >= 0.8;
  }
}

// Entities
export class AITask extends Entity {
  private _status: AISessionStatus = AISessionStatus.PENDING;
  private _startedAt?: Date;
  private _completedAt?: Date;
  private _error?: string;
  private _retryCount: number = 0;

  constructor(
    id: string,
    public readonly taskType: AITaskType,
    public readonly prompt: AIPrompt,
    public readonly configuration: AIConfiguration,
    public readonly priority: number = 5,
    public readonly timeoutMs?: number
  ) {
    super(id);
    this.validate();
  }

  private validate(): void {
    if (this.priority < 1 || this.priority > 10) {
      throw new Error('Priority must be between 1 and 10');
    }
    if (this.timeoutMs && this.timeoutMs <= 0) {
      throw new Error('Timeout must be positive');
    }
  }

  get status(): AISessionStatus { return this._status; }
  get startedAt(): Date | undefined { return this._startedAt; }
  get completedAt(): Date | undefined { return this._completedAt; }
  get error(): string | undefined { return this._error; }
  get retryCount(): number { return this._retryCount; }

  start(): void {
    if (this._status !== AISessionStatus.PENDING) {
      throw new Error(`Cannot start task in ${this._status} status`);
    }

    this._status = AISessionStatus.PROCESSING;
    this._startedAt = new Date();
  }

  complete(): void {
    if (this._status !== AISessionStatus.PROCESSING) {
      throw new Error(`Cannot complete task in ${this._status} status`);
    }

    this._status = AISessionStatus.COMPLETED;
    this._completedAt = new Date();
  }

  fail(error: string): void {
    if (this._status === AISessionStatus.COMPLETED) {
      throw new Error('Cannot fail a completed task');
    }

    this._status = AISessionStatus.FAILED;
    this._error = error;
    this._completedAt = new Date();
  }

  cancel(): void {
    if ([AISessionStatus.COMPLETED, AISessionStatus.FAILED].includes(this._status)) {
      throw new Error(`Cannot cancel task in ${this._status} status`);
    }

    this._status = AISessionStatus.CANCELLED;
    this._completedAt = new Date();
  }

  retry(): void {
    if (this._status !== AISessionStatus.FAILED) {
      throw new Error('Can only retry failed tasks');
    }

    this._status = AISessionStatus.PENDING;
    this._startedAt = undefined;
    this._completedAt = undefined;
    this._error = undefined;
    this._retryCount++;
  }

  getDurationMs(): number | undefined {
    if (!this._startedAt) {
      return undefined;
    }

    const endTime = this._completedAt || new Date();
    return endTime.getTime() - this._startedAt.getTime();
  }

  isTimeout(): boolean {
    if (!this.timeoutMs || !this._startedAt) {
      return false;
    }

    const duration = this.getDurationMs();
    return duration !== undefined && duration > this.timeoutMs;
  }
}

export class EmailClassification extends Entity {
  constructor(
    id: string,
    public readonly classification: string,
    public readonly urgency: string,
    public readonly sentiment: string,
    public readonly confidence: number,
    public readonly extractedTasks: string[],
    public readonly suggestedActions: string[],
    public readonly keywords: string[],
    public readonly summary?: string
  ) {
    super(id);
    this.validate();
  }

  private validate(): void {
    if (!this.classification) {
      throw new Error('Classification is required');
    }
    if (this.confidence < 0 || this.confidence > 1) {
      throw new Error('Confidence must be between 0 and 1');
    }
  }

  isHighConfidence(threshold: number = 0.8): boolean {
    return this.confidence >= threshold;
  }

  hasActionableItems(): boolean {
    return this.extractedTasks.length > 0 || this.suggestedActions.length > 0;
  }
}

export class DraftContent extends Entity {
  private _isApproved: boolean = false;
  private _approvedBy?: string;
  private _approvedAt?: Date;
  private _modifications: DraftModification[] = [];

  constructor(
    id: string,
    public readonly subject: string,
    public readonly body: string,
    public readonly tone: DraftTone,
    public readonly confidence: number,
    public readonly templateUsed?: string,
    public readonly recipientContext?: string
  ) {
    super(id);
    this.validate();
  }

  private validate(): void {
    if (!this.subject || this.subject.trim().length === 0) {
      throw new Error('Draft subject cannot be empty');
    }
    if (!this.body || this.body.trim().length === 0) {
      throw new Error('Draft body cannot be empty');
    }
    if (this.confidence < 0 || this.confidence > 1) {
      throw new Error('Confidence must be between 0 and 1');
    }
  }

  get isApproved(): boolean { return this._isApproved; }
  get approvedBy(): string | undefined { return this._approvedBy; }
  get approvedAt(): Date | undefined { return this._approvedAt; }
  get modifications(): DraftModification[] { return [...this._modifications]; }

  approve(approvedBy: string): void {
    if (this._isApproved) {
      throw new Error('Draft is already approved');
    }

    this._isApproved = true;
    this._approvedBy = approvedBy;
    this._approvedAt = new Date();
  }

  addModification(modification: DraftModification): void {
    this._modifications.push(modification);
  }

  getWordCount(): number {
    return this.body.split(/\s+/).filter(word => word.length > 0).length;
  }

  getCharacterCount(): number {
    return this.body.length;
  }

  isLongForm(): boolean {
    return this.getWordCount() > 100;
  }
}

export class DraftModification {
  constructor(
    public readonly originalText: string,
    public readonly modifiedText: string,
    public readonly reason: string,
    public readonly modifiedBy: string,
    public readonly modifiedAt: Date = new Date()
  ) {}

  getChangeType(): 'addition' | 'deletion' | 'modification' {
    if (this.originalText === '') return 'addition';
    if (this.modifiedText === '') return 'deletion';
    return 'modification';
  }
}

// Aggregate Root
export class AISession extends AggregateRoot {
  private _status: AISessionStatus = AISessionStatus.PENDING;
  private _startedAt?: Date;
  private _completedAt?: Date;
  private _tasks: Map<string, AITask> = new Map();
  private _results: Map<string, any> = new Map();
  private _totalTokensUsed: number = 0;
  private _totalCost: number = 0;
  private _error?: string;

  constructor(
    private readonly _id: string,
    public readonly userId: string,
    public readonly sessionType: AITaskType,
    public readonly sourceEntityId: string, // Email ID, Task ID, etc.
    public readonly sourceEntityType: string,
    public readonly configuration: AIConfiguration
  ) {
    super();
    this.validate();

    this.addDomainEvent(new AISessionCreated(
      this._id,
      this.version,
      userId,
      sessionType,
      sourceEntityId,
      sourceEntityType
    ));
  }

  private validate(): void {
    if (!this.userId || this.userId.trim().length === 0) {
      throw new Error('User ID is required');
    }
    if (!this.sourceEntityId || this.sourceEntityId.trim().length === 0) {
      throw new Error('Source entity ID is required');
    }
  }

  public getId(): string {
    return this._id;
  }

  // Getters
  get status(): AISessionStatus { return this._status; }
  get startedAt(): Date | undefined { return this._startedAt; }
  get completedAt(): Date | undefined { return this._completedAt; }
  get tasks(): AITask[] { return Array.from(this._tasks.values()); }
  get totalTokensUsed(): number { return this._totalTokensUsed; }
  get totalCost(): number { return this._totalCost; }
  get error(): string | undefined { return this._error; }

  // Business Logic
  addTask(task: AITask): void {
    if (this._status !== AISessionStatus.PENDING) {
      throw new Error(`Cannot add tasks to session in ${this._status} status`);
    }

    if (this._tasks.has(task.getId())) {
      throw new Error(`Task with ID ${task.getId()} already exists`);
    }

    this._tasks.set(task.getId(), task);

    this.addDomainEvent(new AITaskAdded(
      this._id,
      this.version,
      task.getId(),
      task.taskType
    ));
  }

  startSession(): void {
    if (this._status !== AISessionStatus.PENDING) {
      throw new Error(`Cannot start session in ${this._status} status`);
    }

    if (this._tasks.size === 0) {
      throw new Error('Cannot start session without tasks');
    }

    this._status = AISessionStatus.PROCESSING;
    this._startedAt = new Date();

    this.addDomainEvent(new AISessionStarted(
      this._id,
      this.version,
      Array.from(this._tasks.keys())
    ));
  }

  completeTask(taskId: string, response: AIResponse, result?: any): void {
    const task = this._tasks.get(taskId);
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }

    if (this._status !== AISessionStatus.PROCESSING) {
      throw new Error(`Cannot complete task in session status ${this._status}`);
    }

    task.complete();
    this._results.set(taskId, result);
    this._totalTokensUsed += response.tokensUsed.totalTokens;
    if (response.tokensUsed.cost) {
      this._totalCost += response.tokensUsed.cost;
    }

    this.addDomainEvent(new AITaskCompleted(
      this._id,
      this.version,
      taskId,
      response.tokensUsed.totalTokens,
      response.confidence
    ));

    // Check if all tasks are complete
    if (this.areAllTasksCompleted()) {
      this.completeSession();
    }
  }

  failTask(taskId: string, error: string): void {
    const task = this._tasks.get(taskId);
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }

    task.fail(error);

    this.addDomainEvent(new AITaskFailed(
      this._id,
      this.version,
      taskId,
      error
    ));

    // Check if we should fail the entire session
    const criticalTasks = Array.from(this._tasks.values()).filter(t => t.priority >= 8);
    const failedCriticalTasks = criticalTasks.filter(t => t.status === AISessionStatus.FAILED);
    
    if (failedCriticalTasks.length > 0) {
      this.failSession(`Critical task failed: ${error}`);
    } else if (this.areAllTasksFinished()) {
      this.completeSession();
    }
  }

  private completeSession(): void {
    this._status = AISessionStatus.COMPLETED;
    this._completedAt = new Date();

    const successfulTasks = Array.from(this._tasks.values())
      .filter(t => t.status === AISessionStatus.COMPLETED).length;
    const totalTasks = this._tasks.size;

    this.addDomainEvent(new AISessionCompleted(
      this._id,
      this.version,
      successfulTasks,
      totalTasks,
      this._totalTokensUsed,
      this._totalCost
    ));
  }

  private failSession(error: string): void {
    this._status = AISessionStatus.FAILED;
    this._error = error;
    this._completedAt = new Date();

    this.addDomainEvent(new AISessionFailed(
      this._id,
      this.version,
      error,
      this._totalTokensUsed,
      this._totalCost
    ));
  }

  cancelSession(reason?: string): void {
    if ([AISessionStatus.COMPLETED, AISessionStatus.FAILED].includes(this._status)) {
      throw new Error(`Cannot cancel session in ${this._status} status`);
    }

    this._status = AISessionStatus.CANCELLED;
    this._completedAt = new Date();
    this._error = reason;

    // Cancel all pending/processing tasks
    Array.from(this._tasks.values())
      .filter(t => [AISessionStatus.PENDING, AISessionStatus.PROCESSING].includes(t.status))
      .forEach(t => t.cancel());

    this.addDomainEvent(new AISessionCancelled(
      this._id,
      this.version,
      reason
    ));
  }

  retryFailedTasks(): void {
    const failedTasks = Array.from(this._tasks.values())
      .filter(t => t.status === AISessionStatus.FAILED);

    if (failedTasks.length === 0) {
      throw new Error('No failed tasks to retry');
    }

    failedTasks.forEach(task => task.retry());

    // Reset session status if it was failed
    if (this._status === AISessionStatus.FAILED) {
      this._status = AISessionStatus.PROCESSING;
      this._error = undefined;
    }

    this.addDomainEvent(new AITasksRetried(
      this._id,
      this.version,
      failedTasks.map(t => t.getId())
    ));
  }

  getResult<T>(taskId: string): T | undefined {
    return this._results.get(taskId);
  }

  getResults(): Map<string, any> {
    return new Map(this._results);
  }

  getDurationMs(): number | undefined {
    if (!this._startedAt) {
      return undefined;
    }

    const endTime = this._completedAt || new Date();
    return endTime.getTime() - this._startedAt.getTime();
  }

  getSuccessRate(): number {
    if (this._tasks.size === 0) {
      return 0;
    }

    const successfulTasks = Array.from(this._tasks.values())
      .filter(t => t.status === AISessionStatus.COMPLETED).length;
    
    return successfulTasks / this._tasks.size;
  }

  getAverageConfidence(): number | undefined {
    const results = Array.from(this._results.values())
      .filter(result => result && typeof result.confidence === 'number');
    
    if (results.length === 0) {
      return undefined;
    }

    const totalConfidence = results.reduce((sum, result) => sum + result.confidence, 0);
    return totalConfidence / results.length;
  }

  private areAllTasksCompleted(): boolean {
    return Array.from(this._tasks.values())
      .every(t => t.status === AISessionStatus.COMPLETED);
  }

  private areAllTasksFinished(): boolean {
    return Array.from(this._tasks.values())
      .every(t => [AISessionStatus.COMPLETED, AISessionStatus.FAILED, AISessionStatus.CANCELLED].includes(t.status));
  }

  // Specific domain methods for different AI task types
  addEmailClassificationTask(emailId: string, emailContent: string, priority: number = 5): string {
    const taskId = crypto.randomUUID();
    const prompt = new AIPrompt(
      `Classify the following email and extract key information:\n\n${emailContent}`,
      'You are an expert email classifier. Analyze emails and provide structured classification results.',
      0.3 // Lower temperature for consistent classification
    );

    const task = new AITask(taskId, AITaskType.EMAIL_CLASSIFICATION, prompt, this.configuration, priority);
    this.addTask(task);
    
    return taskId;
  }

  addDraftGenerationTask(
    originalEmailId: string, 
    originalContent: string, 
    tone: DraftTone, 
    instructions?: string,
    priority: number = 5
  ): string {
    const taskId = crypto.randomUUID();
    const systemInstructions = `You are a professional email draft generator. Create appropriate email responses with the specified tone: ${tone}.`;
    const promptContent = `Generate a ${tone.toLowerCase()} email response to the following:\n\n${originalContent}${instructions ? `\n\nAdditional instructions: ${instructions}` : ''}`;
    
    const prompt = new AIPrompt(
      promptContent,
      systemInstructions,
      0.7, // Balanced temperature for natural but consistent drafts
      1000 // Reasonable max tokens for email drafts
    );

    const task = new AITask(taskId, AITaskType.DRAFT_GENERATION, prompt, this.configuration, priority);
    this.addTask(task);
    
    return taskId;
  }
}

// Domain Events
export class AISessionCreated extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly userId: string,
    public readonly sessionType: AITaskType,
    public readonly sourceEntityId: string,
    public readonly sourceEntityType: string
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'AISessionCreated';
  }

  getEventData(): Record<string, unknown> {
    return {
      userId: this.userId,
      sessionType: this.sessionType,
      sourceEntityId: this.sourceEntityId,
      sourceEntityType: this.sourceEntityType
    };
  }
}

export class AITaskAdded extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly taskId: string,
    public readonly taskType: AITaskType
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'AITaskAdded';
  }

  getEventData(): Record<string, unknown> {
    return {
      taskId: this.taskId,
      taskType: this.taskType
    };
  }
}

export class AISessionStarted extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly taskIds: string[]
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'AISessionStarted';
  }

  getEventData(): Record<string, unknown> {
    return {
      taskIds: this.taskIds
    };
  }
}

export class AITaskCompleted extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly taskId: string,
    public readonly tokensUsed: number,
    public readonly confidence: number
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'AITaskCompleted';
  }

  getEventData(): Record<string, unknown> {
    return {
      taskId: this.taskId,
      tokensUsed: this.tokensUsed,
      confidence: this.confidence
    };
  }
}

export class AITaskFailed extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly taskId: string,
    public readonly error: string
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'AITaskFailed';
  }

  getEventData(): Record<string, unknown> {
    return {
      taskId: this.taskId,
      error: this.error
    };
  }
}

export class AISessionCompleted extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly successfulTasks: number,
    public readonly totalTasks: number,
    public readonly totalTokensUsed: number,
    public readonly totalCost: number
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'AISessionCompleted';
  }

  getEventData(): Record<string, unknown> {
    return {
      successfulTasks: this.successfulTasks,
      totalTasks: this.totalTasks,
      totalTokensUsed: this.totalTokensUsed,
      totalCost: this.totalCost
    };
  }
}

export class AISessionFailed extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly error: string,
    public readonly totalTokensUsed: number,
    public readonly totalCost: number
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'AISessionFailed';
  }

  getEventData(): Record<string, unknown> {
    return {
      error: this.error,
      totalTokensUsed: this.totalTokensUsed,
      totalCost: this.totalCost
    };
  }
}

export class AISessionCancelled extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly reason?: string
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'AISessionCancelled';
  }

  getEventData(): Record<string, unknown> {
    return {
      reason: this.reason
    };
  }
}

export class AITasksRetried extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly taskIds: string[]
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'AITasksRetried';
  }

  getEventData(): Record<string, unknown> {
    return {
      taskIds: this.taskIds
    };
  }
}