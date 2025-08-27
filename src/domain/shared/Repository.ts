/**
 * Repository Pattern Implementation for Domain-Driven Design
 * Provides abstraction over persistence layer with Supabase integration
 */

import { AggregateRoot } from './DomainEvent';

// Base Repository Interface
export interface Repository<T extends AggregateRoot> {
  findById(id: string): Promise<T | null>;
  findByIds(ids: string[]): Promise<T[]>;
  save(aggregate: T): Promise<void>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}

// Extended Repository Interface with Query Capabilities
export interface QueryRepository<T extends AggregateRoot> extends Repository<T> {
  findBy(criteria: QueryCriteria): Promise<T[]>;
  findOne(criteria: QueryCriteria): Promise<T | null>;
  count(criteria?: QueryCriteria): Promise<number>;
  findPaged(criteria: QueryCriteria, pageOptions: PageOptions): Promise<PagedResult<T>>;
}

// Query Building Types
export interface QueryCriteria {
  filters?: Filter[];
  sorts?: Sort[];
  includes?: string[];
}

export interface Filter {
  field: string;
  operator: FilterOperator;
  value: any;
  values?: any[]; // For IN, BETWEEN operators
}

export enum FilterOperator {
  EQUALS = 'eq',
  NOT_EQUALS = 'neq',
  GREATER_THAN = 'gt',
  GREATER_THAN_OR_EQUAL = 'gte',
  LESS_THAN = 'lt',
  LESS_THAN_OR_EQUAL = 'lte',
  IN = 'in',
  NOT_IN = 'not_in',
  LIKE = 'like',
  ILIKE = 'ilike',
  IS_NULL = 'is_null',
  IS_NOT_NULL = 'is_not_null',
  BETWEEN = 'between',
  CONTAINS = 'contains'
}

export interface Sort {
  field: string;
  direction: 'asc' | 'desc';
}

export interface PageOptions {
  page: number;
  size: number;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// Base Supabase Repository Implementation
export abstract class SupabaseRepository<T extends AggregateRoot> implements QueryRepository<T> {
  protected supabaseClient: any;
  protected tableName: string;
  
  constructor(supabaseClient: any, tableName: string) {
    this.supabaseClient = supabaseClient;
    this.tableName = tableName;
  }
  
  async findById(id: string): Promise<T | null> {
    try {
      const { data, error } = await this.supabaseClient
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        throw new Error(`Failed to find ${this.tableName} by ID: ${error.message}`);
      }
      
      return data ? await this.mapFromDatabase(data) : null;
    } catch (error) {
      console.error(`Error finding ${this.tableName} by ID ${id}:`, error);
      throw error;
    }
  }
  
  async findByIds(ids: string[]): Promise<T[]> {
    if (ids.length === 0) return [];
    
    try {
      const { data, error } = await this.supabaseClient
        .from(this.tableName)
        .select('*')
        .in('id', ids);
      
      if (error) {
        throw new Error(`Failed to find ${this.tableName} by IDs: ${error.message}`);
      }
      
      const aggregates = await Promise.all(
        data.map(record => this.mapFromDatabase(record))
      );
      
      return aggregates;
    } catch (error) {
      console.error(`Error finding ${this.tableName} by IDs:`, error);
      throw error;
    }
  }
  
  async save(aggregate: T): Promise<void> {
    try {
      const existingRecord = await this.findById(aggregate.getId());
      const databaseRecord = await this.mapToDatabase(aggregate);
      
      if (existingRecord) {
        // Update existing record
        const { error } = await this.supabaseClient
          .from(this.tableName)
          .update(databaseRecord)
          .eq('id', aggregate.getId());
        
        if (error) {
          throw new Error(`Failed to update ${this.tableName}: ${error.message}`);
        }
      } else {
        // Insert new record
        const { error } = await this.supabaseClient
          .from(this.tableName)
          .insert([databaseRecord]);
        
        if (error) {
          throw new Error(`Failed to insert ${this.tableName}: ${error.message}`);
        }
      }
      
      // Save related entities if any
      await this.saveRelatedEntities(aggregate);
      
    } catch (error) {
      console.error(`Error saving ${this.tableName}:`, error);
      throw error;
    }
  }
  
  async delete(id: string): Promise<void> {
    try {
      const { error } = await this.supabaseClient
        .from(this.tableName)
        .delete()
        .eq('id', id);
      
      if (error) {
        throw new Error(`Failed to delete ${this.tableName}: ${error.message}`);
      }
    } catch (error) {
      console.error(`Error deleting ${this.tableName} ${id}:`, error);
      throw error;
    }
  }
  
  async exists(id: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabaseClient
        .from(this.tableName)
        .select('id')
        .eq('id', id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        throw new Error(`Failed to check existence of ${this.tableName}: ${error.message}`);
      }
      
      return !!data;
    } catch (error) {
      console.error(`Error checking existence of ${this.tableName} ${id}:`, error);
      throw error;
    }
  }
  
  async findBy(criteria: QueryCriteria): Promise<T[]> {
    try {
      let query = this.supabaseClient.from(this.tableName).select('*');
      
      // Apply filters
      if (criteria.filters) {
        query = this.applyFilters(query, criteria.filters);
      }
      
      // Apply sorting
      if (criteria.sorts) {
        criteria.sorts.forEach(sort => {
          query = query.order(sort.field, { ascending: sort.direction === 'asc' });
        });
      }
      
      const { data, error } = await query;
      
      if (error) {
        throw new Error(`Failed to query ${this.tableName}: ${error.message}`);
      }
      
      const aggregates = await Promise.all(
        data.map(record => this.mapFromDatabase(record))
      );
      
      return aggregates;
    } catch (error) {
      console.error(`Error querying ${this.tableName}:`, error);
      throw error;
    }
  }
  
  async findOne(criteria: QueryCriteria): Promise<T | null> {
    const results = await this.findBy(criteria);
    return results.length > 0 ? results[0] : null;
  }
  
  async count(criteria?: QueryCriteria): Promise<number> {
    try {
      let query = this.supabaseClient
        .from(this.tableName)
        .select('id', { count: 'exact', head: true });
      
      if (criteria?.filters) {
        query = this.applyFilters(query, criteria.filters);
      }
      
      const { count, error } = await query;
      
      if (error) {
        throw new Error(`Failed to count ${this.tableName}: ${error.message}`);
      }
      
      return count || 0;
    } catch (error) {
      console.error(`Error counting ${this.tableName}:`, error);
      throw error;
    }
  }
  
  async findPaged(criteria: QueryCriteria, pageOptions: PageOptions): Promise<PagedResult<T>> {
    try {
      const offset = (pageOptions.page - 1) * pageOptions.size;
      
      let query = this.supabaseClient
        .from(this.tableName)
        .select('*', { count: 'exact' })
        .range(offset, offset + pageOptions.size - 1);
      
      // Apply filters
      if (criteria.filters) {
        query = this.applyFilters(query, criteria.filters);
      }
      
      // Apply sorting
      if (criteria.sorts) {
        criteria.sorts.forEach(sort => {
          query = query.order(sort.field, { ascending: sort.direction === 'asc' });
        });
      }
      
      const { data, count, error } = await query;
      
      if (error) {
        throw new Error(`Failed to query paged ${this.tableName}: ${error.message}`);
      }
      
      const items = await Promise.all(
        (data || []).map(record => this.mapFromDatabase(record))
      );
      
      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / pageOptions.size);
      
      return {
        items,
        totalCount,
        totalPages,
        currentPage: pageOptions.page,
        pageSize: pageOptions.size,
        hasNext: pageOptions.page < totalPages,
        hasPrevious: pageOptions.page > 1
      };
    } catch (error) {
      console.error(`Error querying paged ${this.tableName}:`, error);
      throw error;
    }
  }
  
  private applyFilters(query: any, filters: Filter[]): any {
    let filteredQuery = query;
    
    filters.forEach(filter => {
      switch (filter.operator) {
        case FilterOperator.EQUALS:
          filteredQuery = filteredQuery.eq(filter.field, filter.value);
          break;
        case FilterOperator.NOT_EQUALS:
          filteredQuery = filteredQuery.neq(filter.field, filter.value);
          break;
        case FilterOperator.GREATER_THAN:
          filteredQuery = filteredQuery.gt(filter.field, filter.value);
          break;
        case FilterOperator.GREATER_THAN_OR_EQUAL:
          filteredQuery = filteredQuery.gte(filter.field, filter.value);
          break;
        case FilterOperator.LESS_THAN:
          filteredQuery = filteredQuery.lt(filter.field, filter.value);
          break;
        case FilterOperator.LESS_THAN_OR_EQUAL:
          filteredQuery = filteredQuery.lte(filter.field, filter.value);
          break;
        case FilterOperator.IN:
          filteredQuery = filteredQuery.in(filter.field, filter.values || [filter.value]);
          break;
        case FilterOperator.NOT_IN:
          // Supabase doesn't have direct not.in, so we use a different approach
          filteredQuery = filteredQuery.not(filter.field, 'in', filter.values || [filter.value]);
          break;
        case FilterOperator.LIKE:
          filteredQuery = filteredQuery.like(filter.field, filter.value);
          break;
        case FilterOperator.ILIKE:
          filteredQuery = filteredQuery.ilike(filter.field, filter.value);
          break;
        case FilterOperator.IS_NULL:
          filteredQuery = filteredQuery.is(filter.field, null);
          break;
        case FilterOperator.IS_NOT_NULL:
          filteredQuery = filteredQuery.not(filter.field, 'is', null);
          break;
        case FilterOperator.CONTAINS:
          filteredQuery = filteredQuery.contains(filter.field, filter.value);
          break;
        default:
          console.warn(`Unsupported filter operator: ${filter.operator}`);
      }
    });
    
    return filteredQuery;
  }
  
  // Abstract methods to be implemented by concrete repositories
  protected abstract mapFromDatabase(record: any): Promise<T>;
  protected abstract mapToDatabase(aggregate: T): Promise<any>;
  protected abstract saveRelatedEntities(aggregate: T): Promise<void>;
}

// Repository Query Builder
export class RepositoryQueryBuilder {
  private criteria: QueryCriteria = {
    filters: [],
    sorts: [],
    includes: []
  };
  
  where(field: string, operator: FilterOperator, value: any): this {
    this.criteria.filters = this.criteria.filters || [];
    this.criteria.filters.push({ field, operator, value });
    return this;
  }
  
  whereIn(field: string, values: any[]): this {
    this.criteria.filters = this.criteria.filters || [];
    this.criteria.filters.push({ field, operator: FilterOperator.IN, value: undefined, values });
    return this;
  }
  
  whereNull(field: string): this {
    this.criteria.filters = this.criteria.filters || [];
    this.criteria.filters.push({ field, operator: FilterOperator.IS_NULL, value: null });
    return this;
  }
  
  whereNotNull(field: string): this {
    this.criteria.filters = this.criteria.filters || [];
    this.criteria.filters.push({ field, operator: FilterOperator.IS_NOT_NULL, value: null });
    return this;
  }
  
  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): this {
    this.criteria.sorts = this.criteria.sorts || [];
    this.criteria.sorts.push({ field, direction });
    return this;
  }
  
  include(relation: string): this {
    this.criteria.includes = this.criteria.includes || [];
    this.criteria.includes.push(relation);
    return this;
  }
  
  build(): QueryCriteria {
    return { ...this.criteria };
  }
  
  static create(): RepositoryQueryBuilder {
    return new RepositoryQueryBuilder();
  }
}

// Repository Cache Decorator
export class CachedRepository<T extends AggregateRoot> implements QueryRepository<T> {
  private cache = new Map<string, { data: T; timestamp: number }>();
  private ttlMs: number;
  
  constructor(
    private inner: QueryRepository<T>,
    ttlMs: number = 5 * 60 * 1000 // 5 minutes default
  ) {
    this.ttlMs = ttlMs;
  }
  
  async findById(id: string): Promise<T | null> {
    const cached = this.cache.get(id);
    
    if (cached && Date.now() - cached.timestamp < this.ttlMs) {
      return cached.data;
    }
    
    const result = await this.inner.findById(id);
    
    if (result) {
      this.cache.set(id, { data: result, timestamp: Date.now() });
    }
    
    return result;
  }
  
  async findByIds(ids: string[]): Promise<T[]> {
    const uncachedIds: string[] = [];
    const results: T[] = [];
    
    // Check cache first
    for (const id of ids) {
      const cached = this.cache.get(id);
      if (cached && Date.now() - cached.timestamp < this.ttlMs) {
        results.push(cached.data);
      } else {
        uncachedIds.push(id);
      }
    }
    
    // Fetch uncached items
    if (uncachedIds.length > 0) {
      const freshResults = await this.inner.findByIds(uncachedIds);
      
      // Cache fresh results
      freshResults.forEach(item => {
        this.cache.set(item.getId(), { data: item, timestamp: Date.now() });
        results.push(item);
      });
    }
    
    return results;
  }
  
  async save(aggregate: T): Promise<void> {
    await this.inner.save(aggregate);
    
    // Update cache
    this.cache.set(aggregate.getId(), { data: aggregate, timestamp: Date.now() });
  }
  
  async delete(id: string): Promise<void> {
    await this.inner.delete(id);
    
    // Remove from cache
    this.cache.delete(id);
  }
  
  async exists(id: string): Promise<boolean> {
    // Check cache first
    const cached = this.cache.get(id);
    if (cached && Date.now() - cached.timestamp < this.ttlMs) {
      return true;
    }
    
    return await this.inner.exists(id);
  }
  
  async findBy(criteria: QueryCriteria): Promise<T[]> {
    // For complex queries, skip cache and go directly to repository
    return await this.inner.findBy(criteria);
  }
  
  async findOne(criteria: QueryCriteria): Promise<T | null> {
    return await this.inner.findOne(criteria);
  }
  
  async count(criteria?: QueryCriteria): Promise<number> {
    return await this.inner.count(criteria);
  }
  
  async findPaged(criteria: QueryCriteria, pageOptions: PageOptions): Promise<PagedResult<T>> {
    return await this.inner.findPaged(criteria, pageOptions);
  }
  
  clearCache(): void {
    this.cache.clear();
  }
  
  getCacheSize(): number {
    return this.cache.size;
  }
  
  // Clean expired entries
  cleanExpired(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp >= this.ttlMs) {
        this.cache.delete(key);
      }
    }
  }
}

// Repository Transaction Support
export interface Transaction {
  commit(): Promise<void>;
  rollback(): Promise<void>;
  isActive(): boolean;
}

export interface TransactionalRepository<T extends AggregateRoot> extends Repository<T> {
  withinTransaction(transaction: Transaction): Repository<T>;
}

// Specification Pattern for Complex Queries
export interface Specification<T> {
  isSatisfiedBy(item: T): boolean;
  and(other: Specification<T>): Specification<T>;
  or(other: Specification<T>): Specification<T>;
  not(): Specification<T>;
  toCriteria(): QueryCriteria;
}

export abstract class BaseSpecification<T> implements Specification<T> {
  abstract isSatisfiedBy(item: T): boolean;
  abstract toCriteria(): QueryCriteria;
  
  and(other: Specification<T>): Specification<T> {
    return new AndSpecification(this, other);
  }
  
  or(other: Specification<T>): Specification<T> {
    return new OrSpecification(this, other);
  }
  
  not(): Specification<T> {
    return new NotSpecification(this);
  }
}

class AndSpecification<T> extends BaseSpecification<T> {
  constructor(private left: Specification<T>, private right: Specification<T>) {
    super();
  }
  
  isSatisfiedBy(item: T): boolean {
    return this.left.isSatisfiedBy(item) && this.right.isSatisfiedBy(item);
  }
  
  toCriteria(): QueryCriteria {
    const leftCriteria = this.left.toCriteria();
    const rightCriteria = this.right.toCriteria();
    
    return {
      filters: [...(leftCriteria.filters || []), ...(rightCriteria.filters || [])],
      sorts: rightCriteria.sorts || leftCriteria.sorts,
      includes: [...(leftCriteria.includes || []), ...(rightCriteria.includes || [])]
    };
  }
}

class OrSpecification<T> extends BaseSpecification<T> {
  constructor(private left: Specification<T>, private right: Specification<T>) {
    super();
  }
  
  isSatisfiedBy(item: T): boolean {
    return this.left.isSatisfiedBy(item) || this.right.isSatisfiedBy(item);
  }
  
  toCriteria(): QueryCriteria {
    // OR specifications are more complex to convert to query criteria
    // This is a simplified implementation
    throw new Error('OR specifications require custom implementation for database queries');
  }
}

class NotSpecification<T> extends BaseSpecification<T> {
  constructor(private spec: Specification<T>) {
    super();
  }
  
  isSatisfiedBy(item: T): boolean {
    return !this.spec.isSatisfiedBy(item);
  }
  
  toCriteria(): QueryCriteria {
    // NOT specifications require custom implementation
    throw new Error('NOT specifications require custom implementation for database queries');
  }
}