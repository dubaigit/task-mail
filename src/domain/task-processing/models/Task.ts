/**
 * Task Processing Bounded Context - Aggregate Root: Task
 * Domain-driven design implementation for task management and scheduling
 */

import { AggregateRoot, Entity, ValueObject, DomainEvent } from '../../shared/DomainEvent';

// Enums
export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  BLOCKED = 'BLOCKED',
  IN_REVIEW = 'IN_REVIEW',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum TaskPriority {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

export enum TaskCategory {
  EMAIL_RESPONSE = 'EMAIL_RESPONSE',
  MEETING = 'MEETING',
  RESEARCH = 'RESEARCH',
  DEVELOPMENT = 'DEVELOPMENT',
  ADMIN = 'ADMIN',
  PERSONAL = 'PERSONAL',
  OTHER = 'OTHER'
}

// Value Objects
export class TaskTitle extends ValueObject {
  constructor(public readonly value: string) {
    super();
    this.validate();
  }

  private validate(): void {
    if (!this.value || this.value.trim().length === 0) {
      throw new Error('Task title cannot be empty');
    }
    if (this.value.length > 200) {
      throw new Error('Task title cannot exceed 200 characters');
    }
  }

  protected getEqualityComponents(): unknown[] {
    return [this.value.trim()];
  }
}

export class TaskDescription extends ValueObject {
  constructor(public readonly value?: string) {
    super();
    this.validate();
  }

  private validate(): void {
    if (this.value && this.value.length > 2000) {
      throw new Error('Task description cannot exceed 2000 characters');
    }
  }

  protected getEqualityComponents(): unknown[] {
    return [this.value || ''];
  }

  isEmpty(): boolean {
    return !this.value || this.value.trim().length === 0;
  }

  getWordCount(): number {
    if (!this.value) return 0;
    return this.value.split(/\s+/).filter(word => word.length > 0).length;
  }
}

export class TaskDeadline extends ValueObject {
  constructor(
    public readonly dueDate: Date,
    public readonly isHardDeadline: boolean = true
  ) {
    super();
    this.validate();
  }

  private validate(): void {
    const now = new Date();
    if (this.dueDate < now) {
      // Allow past dates for tracking purposes, but could warn
      console.warn('Task deadline is in the past');
    }
  }

  protected getEqualityComponents(): unknown[] {
    return [this.dueDate.getTime(), this.isHardDeadline];
  }

  isOverdue(): boolean {
    return new Date() > this.dueDate;
  }

  getDaysRemaining(): number {
    const now = new Date();
    const diffTime = this.dueDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  isApproaching(daysThreshold: number = 3): boolean {
    const daysRemaining = this.getDaysRemaining();
    return daysRemaining <= daysThreshold && daysRemaining > 0;
  }
}

export class TaskEstimation extends ValueObject {
  constructor(
    public readonly estimatedMinutes: number,
    public readonly confidence: number = 0.5 // 0-1 scale
  ) {
    super();
    this.validate();
  }

  private validate(): void {
    if (this.estimatedMinutes < 0) {
      throw new Error('Estimated minutes cannot be negative');
    }
    if (this.confidence < 0 || this.confidence > 1) {
      throw new Error('Confidence must be between 0 and 1');
    }
  }

  protected getEqualityComponents(): unknown[] {
    return [this.estimatedMinutes, this.confidence];
  }

  getEstimatedHours(): number {
    return Math.round((this.estimatedMinutes / 60) * 100) / 100;
  }

  getRange(): { min: number; max: number } {
    const variance = this.estimatedMinutes * (1 - this.confidence) * 0.5;
    return {
      min: Math.max(0, this.estimatedMinutes - variance),
      max: this.estimatedMinutes + variance
    };
  }
}

// Entities
export class TaskComment extends Entity {
  constructor(
    id: string,
    public readonly content: string,
    public readonly authorId: string,
    public readonly createdAt: Date = new Date(),
    public readonly isSystemGenerated: boolean = false
  ) {
    super(id);
    this.validate();
  }

  private validate(): void {
    if (!this.content || this.content.trim().length === 0) {
      throw new Error('Task comment content cannot be empty');
    }
    if (!this.authorId || this.authorId.trim().length === 0) {
      throw new Error('Task comment must have an author');
    }
  }

  getContentPreview(maxLength: number = 100): string {
    return this.content.length <= maxLength 
      ? this.content 
      : this.content.substring(0, maxLength) + '...';
  }
}

export class SubTask extends Entity {
  private _isCompleted: boolean = false;
  private _completedAt?: Date;
  private _completedBy?: string;

  constructor(
    id: string,
    public readonly title: string,
    public readonly description?: string,
    public readonly assignedTo?: string,
    public readonly estimatedMinutes?: number
  ) {
    super(id);
    this.validate();
  }

  private validate(): void {
    if (!this.title || this.title.trim().length === 0) {
      throw new Error('SubTask title cannot be empty');
    }
  }

  get isCompleted(): boolean {
    return this._isCompleted;
  }

  get completedAt(): Date | undefined {
    return this._completedAt;
  }

  get completedBy(): string | undefined {
    return this._completedBy;
  }

  complete(completedBy?: string): void {
    if (this._isCompleted) {
      throw new Error('SubTask is already completed');
    }
    
    this._isCompleted = true;
    this._completedAt = new Date();
    this._completedBy = completedBy;
  }

  reopen(): void {
    if (!this._isCompleted) {
      throw new Error('SubTask is not completed');
    }
    
    this._isCompleted = false;
    this._completedAt = undefined;
    this._completedBy = undefined;
  }
}

export class TaskDependency extends Entity {
  constructor(
    id: string,
    public readonly dependsOnTaskId: string,
    public readonly dependencyType: DependencyType = DependencyType.FINISH_TO_START,
    public readonly description?: string
  ) {
    super(id);
  }

  canProceed(dependentTaskStatus: TaskStatus): boolean {
    switch (this.dependencyType) {
      case DependencyType.FINISH_TO_START:
        return dependentTaskStatus === TaskStatus.COMPLETED;
      case DependencyType.START_TO_START:
        return [TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED].includes(dependentTaskStatus);
      case DependencyType.FINISH_TO_FINISH:
        return dependentTaskStatus === TaskStatus.COMPLETED;
      case DependencyType.START_TO_FINISH:
        return [TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED].includes(dependentTaskStatus);
      default:
        return true;
    }
  }
}

export enum DependencyType {
  FINISH_TO_START = 'FINISH_TO_START',
  START_TO_START = 'START_TO_START',
  FINISH_TO_FINISH = 'FINISH_TO_FINISH',
  START_TO_FINISH = 'START_TO_FINISH'
}

// Aggregate Root
export class Task extends AggregateRoot {
  private _status: TaskStatus = TaskStatus.TODO;
  private _priority: TaskPriority = TaskPriority.MEDIUM;
  private _assignedTo?: string;
  private _createdBy: string;
  private _createdAt: Date;
  private _updatedAt: Date;
  private _startedAt?: Date;
  private _completedAt?: Date;
  private _tags: Set<string> = new Set();
  private _subTasks: Map<string, SubTask> = new Map();
  private _comments: Map<string, TaskComment> = new Map();
  private _dependencies: Map<string, TaskDependency> = new Map();
  private _actualTimeSpent?: number; // in minutes
  private _sourceEmailId?: string;

  constructor(
    private readonly _id: string,
    private readonly _title: TaskTitle,
    private readonly _description: TaskDescription,
    private readonly _category: TaskCategory,
    createdBy: string,
    private _deadline?: TaskDeadline,
    private _estimation?: TaskEstimation
  ) {
    super();
    this._createdBy = createdBy;
    this._createdAt = new Date();
    this._updatedAt = new Date();

    this.addDomainEvent(new TaskCreated(
      this._id,
      this.version,
      this._title.value,
      this._category,
      createdBy
    ));
  }

  public getId(): string {
    return this._id;
  }

  // Getters
  get title(): TaskTitle { return this._title; }
  get description(): TaskDescription { return this._description; }
  get category(): TaskCategory { return this._category; }
  get status(): TaskStatus { return this._status; }
  get priority(): TaskPriority { return this._priority; }
  get assignedTo(): string | undefined { return this._assignedTo; }
  get createdBy(): string { return this._createdBy; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get startedAt(): Date | undefined { return this._startedAt; }
  get completedAt(): Date | undefined { return this._completedAt; }
  get deadline(): TaskDeadline | undefined { return this._deadline; }
  get estimation(): TaskEstimation | undefined { return this._estimation; }
  get tags(): string[] { return Array.from(this._tags); }
  get subTasks(): SubTask[] { return Array.from(this._subTasks.values()); }
  get comments(): TaskComment[] { 
    return Array.from(this._comments.values()).sort((a, b) => 
      a.createdAt.getTime() - b.createdAt.getTime()
    );
  }
  get dependencies(): TaskDependency[] { return Array.from(this._dependencies.values()); }
  get actualTimeSpent(): number | undefined { return this._actualTimeSpent; }
  get sourceEmailId(): string | undefined { return this._sourceEmailId; }

  // Business Logic
  updateStatus(newStatus: TaskStatus, updatedBy?: string): void {
    if (this._status === newStatus) {
      return;
    }

    const oldStatus = this._status;
    this._status = newStatus;
    this._updatedAt = new Date();

    // Handle status-specific logic
    switch (newStatus) {
      case TaskStatus.IN_PROGRESS:
        if (!this._startedAt) {
          this._startedAt = new Date();
        }
        break;
      case TaskStatus.COMPLETED:
        this._completedAt = new Date();
        break;
      case TaskStatus.TODO:
        // Reset timestamps when moving back to TODO
        this._startedAt = undefined;
        this._completedAt = undefined;
        break;
    }

    this.addDomainEvent(new TaskStatusChanged(
      this._id,
      this.version,
      oldStatus,
      newStatus,
      updatedBy
    ));
  }

  updatePriority(newPriority: TaskPriority, updatedBy?: string): void {
    if (this._priority === newPriority) {
      return;
    }

    const oldPriority = this._priority;
    this._priority = newPriority;
    this._updatedAt = new Date();

    this.addDomainEvent(new TaskPriorityChanged(
      this._id,
      this.version,
      oldPriority,
      newPriority,
      updatedBy
    ));
  }

  assignTo(userId: string, assignedBy?: string): void {
    const oldAssignee = this._assignedTo;
    this._assignedTo = userId;
    this._updatedAt = new Date();

    this.addDomainEvent(new TaskAssigned(
      this._id,
      this.version,
      userId,
      assignedBy,
      oldAssignee
    ));
  }

  unassign(unassignedBy?: string): void {
    if (!this._assignedTo) {
      throw new Error('Task is not assigned to anyone');
    }

    const oldAssignee = this._assignedTo;
    this._assignedTo = undefined;
    this._updatedAt = new Date();

    this.addDomainEvent(new TaskUnassigned(
      this._id,
      this.version,
      oldAssignee,
      unassignedBy
    ));
  }

  addTag(tag: string): void {
    const normalizedTag = tag.toLowerCase().trim();
    if (!normalizedTag) {
      throw new Error('Tag cannot be empty');
    }

    if (this._tags.has(normalizedTag)) {
      return;
    }

    this._tags.add(normalizedTag);
    this._updatedAt = new Date();

    this.addDomainEvent(new TaskTagAdded(
      this._id,
      this.version,
      normalizedTag
    ));
  }

  removeTag(tag: string): void {
    const normalizedTag = tag.toLowerCase().trim();
    if (!this._tags.has(normalizedTag)) {
      return;
    }

    this._tags.delete(normalizedTag);
    this._updatedAt = new Date();

    this.addDomainEvent(new TaskTagRemoved(
      this._id,
      this.version,
      normalizedTag
    ));
  }

  addSubTask(subTask: SubTask, addedBy?: string): void {
    if (this._subTasks.has(subTask.getId())) {
      throw new Error(`SubTask with ID ${subTask.getId()} already exists`);
    }

    this._subTasks.set(subTask.getId(), subTask);
    this._updatedAt = new Date();

    this.addDomainEvent(new SubTaskAdded(
      this._id,
      this.version,
      subTask.getId(),
      subTask.title,
      addedBy
    ));
  }

  removeSubTask(subTaskId: string, removedBy?: string): void {
    const subTask = this._subTasks.get(subTaskId);
    if (!subTask) {
      throw new Error(`SubTask with ID ${subTaskId} not found`);
    }

    this._subTasks.delete(subTaskId);
    this._updatedAt = new Date();

    this.addDomainEvent(new SubTaskRemoved(
      this._id,
      this.version,
      subTaskId,
      subTask.title,
      removedBy
    ));
  }

  completeSubTask(subTaskId: string, completedBy?: string): void {
    const subTask = this._subTasks.get(subTaskId);
    if (!subTask) {
      throw new Error(`SubTask with ID ${subTaskId} not found`);
    }

    subTask.complete(completedBy);
    this._updatedAt = new Date();

    this.addDomainEvent(new SubTaskCompleted(
      this._id,
      this.version,
      subTaskId,
      completedBy
    ));

    // Auto-complete task if all subtasks are done
    if (this.areAllSubTasksCompleted() && this._status !== TaskStatus.COMPLETED) {
      this.updateStatus(TaskStatus.COMPLETED, completedBy);
    }
  }

  addComment(comment: TaskComment, addedBy?: string): void {
    if (this._comments.has(comment.getId())) {
      throw new Error(`Comment with ID ${comment.getId()} already exists`);
    }

    this._comments.set(comment.getId(), comment);
    this._updatedAt = new Date();

    this.addDomainEvent(new TaskCommentAdded(
      this._id,
      this.version,
      comment.getId(),
      comment.authorId,
      comment.content.substring(0, 100)
    ));
  }

  addDependency(dependency: TaskDependency): void {
    if (dependency.dependsOnTaskId === this._id) {
      throw new Error('Task cannot depend on itself');
    }

    if (this._dependencies.has(dependency.getId())) {
      throw new Error(`Dependency with ID ${dependency.getId()} already exists`);
    }

    this._dependencies.set(dependency.getId(), dependency);
    this._updatedAt = new Date();

    this.addDomainEvent(new TaskDependencyAdded(
      this._id,
      this.version,
      dependency.getId(),
      dependency.dependsOnTaskId,
      dependency.dependencyType
    ));
  }

  removeDependency(dependencyId: string): void {
    const dependency = this._dependencies.get(dependencyId);
    if (!dependency) {
      throw new Error(`Dependency with ID ${dependencyId} not found`);
    }

    this._dependencies.delete(dependencyId);
    this._updatedAt = new Date();

    this.addDomainEvent(new TaskDependencyRemoved(
      this._id,
      this.version,
      dependencyId,
      dependency.dependsOnTaskId
    ));
  }

  linkToEmail(emailId: string): void {
    this._sourceEmailId = emailId;
    this._updatedAt = new Date();

    this.addDomainEvent(new TaskLinkedToEmail(
      this._id,
      this.version,
      emailId
    ));
  }

  logTimeSpent(minutes: number): void {
    if (minutes < 0) {
      throw new Error('Time spent cannot be negative');
    }

    this._actualTimeSpent = (this._actualTimeSpent || 0) + minutes;
    this._updatedAt = new Date();

    this.addDomainEvent(new TaskTimeLogged(
      this._id,
      this.version,
      minutes,
      this._actualTimeSpent
    ));
  }

  // Query methods
  isOverdue(): boolean {
    return this._deadline?.isOverdue() || false;
  }

  isDeadlineApproaching(daysThreshold: number = 3): boolean {
    return this._deadline?.isApproaching(daysThreshold) || false;
  }

  getCompletionPercentage(): number {
    if (this._status === TaskStatus.COMPLETED) {
      return 100;
    }

    if (this._subTasks.size === 0) {
      return this._status === TaskStatus.IN_PROGRESS ? 50 : 0;
    }

    const completedSubTasks = Array.from(this._subTasks.values())
      .filter(st => st.isCompleted).length;
    
    return Math.round((completedSubTasks / this._subTasks.size) * 100);
  }

  areAllSubTasksCompleted(): boolean {
    if (this._subTasks.size === 0) {
      return false;
    }

    return Array.from(this._subTasks.values()).every(st => st.isCompleted);
  }

  getEstimatedVsActualTime(): { estimated?: number; actual?: number; variance?: number } {
    const estimated = this._estimation?.estimatedMinutes;
    const actual = this._actualTimeSpent;

    if (!estimated || !actual) {
      return { estimated, actual };
    }

    const variance = ((actual - estimated) / estimated) * 100;
    return { estimated, actual, variance: Math.round(variance * 100) / 100 };
  }

  canStart(dependentTaskStatuses: Map<string, TaskStatus>): boolean {
    return this._dependencies.size === 0 || 
           Array.from(this._dependencies.values()).every(dep => {
             const dependentStatus = dependentTaskStatuses.get(dep.dependsOnTaskId);
             return dependentStatus && dep.canProceed(dependentStatus);
           });
  }

  getDaysToDeadline(): number | undefined {
    return this._deadline?.getDaysRemaining();
  }

  getBlockingDependencies(dependentTaskStatuses: Map<string, TaskStatus>): TaskDependency[] {
    return Array.from(this._dependencies.values()).filter(dep => {
      const dependentStatus = dependentTaskStatuses.get(dep.dependsOnTaskId);
      return !dependentStatus || !dep.canProceed(dependentStatus);
    });
  }
}

// Domain Events
export class TaskCreated extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly title: string,
    public readonly category: TaskCategory,
    public readonly createdBy: string
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'TaskCreated';
  }

  getEventData(): Record<string, unknown> {
    return {
      title: this.title,
      category: this.category,
      createdBy: this.createdBy
    };
  }
}

export class TaskStatusChanged extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly oldStatus: TaskStatus,
    public readonly newStatus: TaskStatus,
    public readonly changedBy?: string
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'TaskStatusChanged';
  }

  getEventData(): Record<string, unknown> {
    return {
      oldStatus: this.oldStatus,
      newStatus: this.newStatus,
      changedBy: this.changedBy
    };
  }
}

export class TaskPriorityChanged extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly oldPriority: TaskPriority,
    public readonly newPriority: TaskPriority,
    public readonly changedBy?: string
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'TaskPriorityChanged';
  }

  getEventData(): Record<string, unknown> {
    return {
      oldPriority: this.oldPriority,
      newPriority: this.newPriority,
      changedBy: this.changedBy
    };
  }
}

export class TaskAssigned extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly assignedTo: string,
    public readonly assignedBy?: string,
    public readonly previousAssignee?: string
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'TaskAssigned';
  }

  getEventData(): Record<string, unknown> {
    return {
      assignedTo: this.assignedTo,
      assignedBy: this.assignedBy,
      previousAssignee: this.previousAssignee
    };
  }
}

export class TaskUnassigned extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly previousAssignee: string,
    public readonly unassignedBy?: string
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'TaskUnassigned';
  }

  getEventData(): Record<string, unknown> {
    return {
      previousAssignee: this.previousAssignee,
      unassignedBy: this.unassignedBy
    };
  }
}

export class TaskTagAdded extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly tag: string
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'TaskTagAdded';
  }

  getEventData(): Record<string, unknown> {
    return {
      tag: this.tag
    };
  }
}

export class TaskTagRemoved extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly tag: string
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'TaskTagRemoved';
  }

  getEventData(): Record<string, unknown> {
    return {
      tag: this.tag
    };
  }
}

export class SubTaskAdded extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly subTaskId: string,
    public readonly subTaskTitle: string,
    public readonly addedBy?: string
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'SubTaskAdded';
  }

  getEventData(): Record<string, unknown> {
    return {
      subTaskId: this.subTaskId,
      subTaskTitle: this.subTaskTitle,
      addedBy: this.addedBy
    };
  }
}

export class SubTaskRemoved extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly subTaskId: string,
    public readonly subTaskTitle: string,
    public readonly removedBy?: string
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'SubTaskRemoved';
  }

  getEventData(): Record<string, unknown> {
    return {
      subTaskId: this.subTaskId,
      subTaskTitle: this.subTaskTitle,
      removedBy: this.removedBy
    };
  }
}

export class SubTaskCompleted extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly subTaskId: string,
    public readonly completedBy?: string
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'SubTaskCompleted';
  }

  getEventData(): Record<string, unknown> {
    return {
      subTaskId: this.subTaskId,
      completedBy: this.completedBy
    };
  }
}

export class TaskCommentAdded extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly commentId: string,
    public readonly authorId: string,
    public readonly contentPreview: string
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'TaskCommentAdded';
  }

  getEventData(): Record<string, unknown> {
    return {
      commentId: this.commentId,
      authorId: this.authorId,
      contentPreview: this.contentPreview
    };
  }
}

export class TaskDependencyAdded extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly dependencyId: string,
    public readonly dependsOnTaskId: string,
    public readonly dependencyType: DependencyType
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'TaskDependencyAdded';
  }

  getEventData(): Record<string, unknown> {
    return {
      dependencyId: this.dependencyId,
      dependsOnTaskId: this.dependsOnTaskId,
      dependencyType: this.dependencyType
    };
  }
}

export class TaskDependencyRemoved extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly dependencyId: string,
    public readonly dependsOnTaskId: string
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'TaskDependencyRemoved';
  }

  getEventData(): Record<string, unknown> {
    return {
      dependencyId: this.dependencyId,
      dependsOnTaskId: this.dependsOnTaskId
    };
  }
}

export class TaskLinkedToEmail extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly emailId: string
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'TaskLinkedToEmail';
  }

  getEventData(): Record<string, unknown> {
    return {
      emailId: this.emailId
    };
  }
}

export class TaskTimeLogged extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly timeSpent: number,
    public readonly totalTimeSpent: number
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventName(): string {
    return 'TaskTimeLogged';
  }

  getEventData(): Record<string, unknown> {
    return {
      timeSpent: this.timeSpent,
      totalTimeSpent: this.totalTimeSpent
    };
  }
}