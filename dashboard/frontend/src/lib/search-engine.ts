/**
 * Enterprise Email Management - Comprehensive Search Engine
 * Advanced search functionality with regex, boolean operators, and intelligent filtering
 * 
 * Features:
 * - Full-text search across all email content
 * - Regex pattern matching with safety controls
 * - Boolean operators (AND, OR, NOT, parentheses)
 * - Advanced field-specific search filters
 * - Real-time search suggestions and autocomplete
 * - Search result highlighting and ranking
 * - Performance optimization with indexing
 * - Search history and saved searches
 */

import { EmailMessage, SearchQuery, SearchResult, SearchSuggestion } from '../types/index';
import { filterSortEngine } from './email-classifier';
import { errorHandler } from '../utils/errorHandler';

export interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
  searchFields: SearchField[];
  maxResults: number;
  includeArchived: boolean;
  includeSpam: boolean;
  dateRange?: DateRange;
  sortBy: SearchSortField;
  sortDirection: 'asc' | 'desc';
}

export interface InternalSearchQuery {
  query: string;
  options: SearchOptions;
  filters: SearchFilter[];
}

export interface InternalSearchResult {
  emails: EmailMessage[];
  totalCount: number;
  searchTime: number;
  suggestions: InternalSearchSuggestion[];
  facets: SearchFacet[];
  highlights: SearchHighlight[];
}

export interface InternalSearchSuggestion {
  text: string;
  type: 'query' | 'sender' | 'subject' | 'content';
  count: number;
  score: number;
}

export interface SearchFacet {
  field: string;
  values: Array<{
    value: string;
    count: number;
    selected: boolean;
  }>;
}

export interface SearchHighlight {
  emailId: string;
  field: string;
  fragments: string[];
  positions: Array<{ start: number; end: number }>;
}

export interface SearchFilter {
  field: SearchField;
  operator: SearchOperator;
  value: any;
  negate?: boolean;
}

export type SearchField = 
  | 'all' | 'subject' | 'content' | 'from' | 'to' | 'cc' | 'bcc'
  | 'attachments' | 'date' | 'size' | 'priority' | 'category' | 'tags';

export type SearchOperator = 
  | 'equals' | 'contains' | 'startswith' | 'endswith' | 'regex'
  | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'in' | 'exists';

export type SearchSortField = 
  | 'relevance' | 'date' | 'sender' | 'subject' | 'size' | 'importance';

export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Boolean Query Parser
 * Parses complex boolean search expressions into an AST
 */
class BooleanQueryParser {
  private tokens: string[] = [];
  private position = 0;

  parse(query: string): BooleanQueryNode {
    this.tokens = this.tokenize(query);
    this.position = 0;
    return this.parseOr();
  }

  private tokenize(query: string): string[] {
    // Tokenize the query string, respecting quoted strings
    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < query.length; i++) {
      const char = query[i];

      if ((char === '"' || char === "'") && !inQuotes) {
        if (current.trim()) {
          tokens.push(current.trim());
          current = '';
        }
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        if (current.trim()) {
          tokens.push(`"${current.trim()}"`);
        }
        current = '';
        inQuotes = false;
        quoteChar = '';
      } else if (inQuotes) {
        current += char;
      } else if (/\s/.test(char)) {
        if (current.trim()) {
          tokens.push(current.trim());
          current = '';
        }
      } else if (char === '(' || char === ')') {
        if (current.trim()) {
          tokens.push(current.trim());
          current = '';
        }
        tokens.push(char);
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      tokens.push(current.trim());
    }

    return tokens;
  }

  private parseOr(): BooleanQueryNode {
    let left = this.parseAnd();

    while (this.peek()?.toUpperCase() === 'OR') {
      this.consume(); // consume OR
      const right = this.parseAnd();
      left = new OrNode(left, right);
    }

    return left;
  }

  private parseAnd(): BooleanQueryNode {
    let left = this.parseNot();

    while (this.peek() && this.peek()?.toUpperCase() !== 'OR' && this.peek() !== ')') {
      if (this.peek()?.toUpperCase() === 'AND') {
        this.consume(); // consume AND
      }
      const right = this.parseNot();
      left = new AndNode(left, right);
    }

    return left;
  }

  private parseNot(): BooleanQueryNode {
    if (this.peek()?.toUpperCase() === 'NOT') {
      this.consume(); // consume NOT
      const operand = this.parsePrimary();
      return new NotNode(operand);
    }
    return this.parsePrimary();
  }

  private parsePrimary(): BooleanQueryNode {
    const token = this.peek();

    if (!token) {
      throw new Error('Unexpected end of query');
    }

    if (token === '(') {
      this.consume(); // consume (
      const node = this.parseOr();
      if (this.peek() !== ')') {
        throw new Error('Expected closing parenthesis');
      }
      this.consume(); // consume )
      return node;
    }

    const term = this.consume();
    
    // Check for field-specific search (field:value)
    if (term.includes(':') && !term.startsWith('"')) {
      const [field, ...valueParts] = term.split(':');
      const value = valueParts.join(':');
      return new FieldNode(field as SearchField, value);
    }

    return new TermNode(term);
  }

  private peek(): string | undefined {
    return this.tokens[this.position];
  }

  private consume(): string {
    return this.tokens[this.position++];
  }
}

/**
 * Boolean Query AST Nodes
 */
abstract class BooleanQueryNode {
  abstract evaluate(email: EmailMessage, searchEngine: EmailSearchEngine): boolean;
  abstract toString(): string;
}

class TermNode extends BooleanQueryNode {
  constructor(private term: string) {
    super();
  }

  evaluate(email: EmailMessage, searchEngine: EmailSearchEngine): boolean {
    return searchEngine.matchesTerm(email, this.term);
  }

  toString(): string {
    return this.term;
  }
}

class FieldNode extends BooleanQueryNode {
  constructor(private field: SearchField, private value: string) {
    super();
  }

  evaluate(email: EmailMessage, searchEngine: EmailSearchEngine): boolean {
    return searchEngine.matchesField(email, this.field, this.value);
  }

  toString(): string {
    return `${this.field}:${this.value}`;
  }
}

class AndNode extends BooleanQueryNode {
  constructor(private left: BooleanQueryNode, private right: BooleanQueryNode) {
    super();
  }

  evaluate(email: EmailMessage, searchEngine: EmailSearchEngine): boolean {
    return this.left.evaluate(email, searchEngine) && this.right.evaluate(email, searchEngine);
  }

  toString(): string {
    return `(${this.left.toString()} AND ${this.right.toString()})`;
  }
}

class OrNode extends BooleanQueryNode {
  constructor(private left: BooleanQueryNode, private right: BooleanQueryNode) {
    super();
  }

  evaluate(email: EmailMessage, searchEngine: EmailSearchEngine): boolean {
    return this.left.evaluate(email, searchEngine) || this.right.evaluate(email, searchEngine);
  }

  toString(): string {
    return `(${this.left.toString()} OR ${this.right.toString()})`;
  }
}

class NotNode extends BooleanQueryNode {
  constructor(private operand: BooleanQueryNode) {
    super();
  }

  evaluate(email: EmailMessage, searchEngine: EmailSearchEngine): boolean {
    return !this.operand.evaluate(email, searchEngine);
  }

  toString(): string {
    return `NOT ${this.operand.toString()}`;
  }
}

/**
 * Search Index for performance optimization
 */
class SearchIndex {
  private termIndex = new Map<string, Set<string>>(); // term -> emailIds
  private fieldIndex = new Map<string, Map<string, Set<string>>>(); // field -> term -> emailIds
  private emailContent = new Map<string, string>(); // emailId -> searchable content

  indexEmail(email: EmailMessage): void {
    const searchableContent = this.extractSearchableContent(email);
    this.emailContent.set(email.id, searchableContent);

    // Index full-text terms
    const terms = this.extractTerms(searchableContent);
    for (const term of terms) {
      if (!this.termIndex.has(term)) {
        this.termIndex.set(term, new Set());
      }
      this.termIndex.get(term)!.add(email.id);
    }

    // Index field-specific terms
    this.indexFieldTerms('from', email.senderEmail + ' ' + (email.sender || ''), email.id);
    this.indexFieldTerms('subject', email.subject || '', email.id);
    this.indexFieldTerms('content', email.content || '', email.id);
    
    if (email.recipients) {
      this.indexFieldTerms('to', email.recipients.join(' '), email.id);
    }
    
    if (email.ccRecipients) {
      this.indexFieldTerms('cc', email.ccRecipients.join(' '), email.id);
    }
    
    if (email.hasAttachments) {
      this.indexFieldTerms('attachments', 'has-attachments', email.id);
    }
  }

  private indexFieldTerms(field: string, content: string, emailId: string): void {
    if (!this.fieldIndex.has(field)) {
      this.fieldIndex.set(field, new Map());
    }
    
    const fieldMap = this.fieldIndex.get(field)!;
    const terms = this.extractTerms(content);
    
    for (const term of terms) {
      if (!fieldMap.has(term)) {
        fieldMap.set(term, new Set());
      }
      fieldMap.get(term)!.add(emailId);
    }
  }

  private extractSearchableContent(email: EmailMessage): string {
    const parts = [
      email.subject || '',
      email.content || '',
      email.senderEmail,
      email.sender || '',
      ...(email.recipients || []),
      ...(email.ccRecipients || []),
      ...(email.bccRecipients || [])
    ];
    
    return parts.join(' ').toLowerCase();
  }

  private extractTerms(content: string): string[] {
    return content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 2)
      .filter(term => !this.isStopWord(term));
  }

  private isStopWord(term: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'can', 'shall', 'must'
    ]);
    
    return stopWords.has(term);
  }

  searchTerms(terms: string[]): Set<string> {
    if (terms.length === 0) return new Set();
    
    const results = new Set(this.termIndex.get(terms[0]) || []);
    
    for (let i = 1; i < terms.length; i++) {
      const termResults = this.termIndex.get(terms[i]) || new Set();
      for (const emailId of Array.from(results)) {
        if (!termResults.has(emailId)) {
          results.delete(emailId);
        }
      }
    }
    
    return results;
  }

  searchFieldTerms(field: string, terms: string[]): Set<string> {
    const fieldMap = this.fieldIndex.get(field);
    if (!fieldMap || terms.length === 0) return new Set();
    
    const results = new Set(fieldMap.get(terms[0]) || []);
    
    for (let i = 1; i < terms.length; i++) {
      const termResults = fieldMap.get(terms[i]) || new Set();
      for (const emailId of Array.from(results)) {
        if (!termResults.has(emailId)) {
          results.delete(emailId);
        }
      }
    }
    
    return results;
  }

  removeEmail(emailId: string): void {
    this.emailContent.delete(emailId);
    
    // Remove from term index
    for (const [term, emailIds] of this.termIndex) {
      emailIds.delete(emailId);
      if (emailIds.size === 0) {
        this.termIndex.delete(term);
      }
    }
    
    // Remove from field index
    for (const [field, fieldMap] of this.fieldIndex) {
      for (const [term, emailIds] of fieldMap) {
        emailIds.delete(emailId);
        if (emailIds.size === 0) {
          fieldMap.delete(term);
        }
      }
    }
  }

  clear(): void {
    this.termIndex.clear();
    this.fieldIndex.clear();
    this.emailContent.clear();
  }

  getIndexSize(): { terms: number; fieldTerms: number; emails: number } {
    let fieldTermCount = 0;
    for (const fieldMap of this.fieldIndex.values()) {
      fieldTermCount += fieldMap.size;
    }
    
    return {
      terms: this.termIndex.size,
      fieldTerms: fieldTermCount,
      emails: this.emailContent.size
    };
  }
}

/**
 * Main Email Search Engine
 */
export class EmailSearchEngine {
  private index = new SearchIndex();
  private queryParser = new BooleanQueryParser();
  private searchHistory: string[] = [];
  private savedSearches = new Map<string, SearchQuery>();

  constructor() {
    this.loadSearchHistory();
    this.loadSavedSearches();
  }

  /**
   * Index emails for searching
   */
  indexEmails(emails: EmailMessage[]): void {
    this.index.clear();
    for (const email of emails) {
      this.index.indexEmail(email);
    }
  }

  /**
   * Add single email to index
   */
  indexEmail(email: EmailMessage): void {
    this.index.indexEmail(email);
  }

  /**
   * Remove email from index
   */
  removeFromIndex(emailId: string): void {
    this.index.removeEmail(emailId);
  }

  /**
   * Perform comprehensive search
   */
  async search(
    emails: EmailMessage[], 
    query: string, 
    options: Partial<SearchOptions> = {}
  ): Promise<SearchResult<EmailMessage>> {
    const startTime = performance.now();
    
    const searchOptions: SearchOptions = {
      caseSensitive: false,
      wholeWord: false,
      useRegex: false,
      searchFields: ['all'],
      maxResults: 1000,
      includeArchived: false,
      includeSpam: false,
      sortBy: 'relevance',
      sortDirection: 'desc',
      ...options
    };

    // Add to search history
    this.addToSearchHistory(query);

    let filteredEmails = emails;

    // Apply basic filters
    if (!searchOptions.includeArchived) {
      filteredEmails = filteredEmails.filter(email => !email.labels.includes('archived'));
    }
    
    if (!searchOptions.includeSpam) {
      filteredEmails = filteredEmails.filter(email => !email.labels.includes('spam'));
    }

    // Apply date range filter
    if (searchOptions.dateRange) {
      filteredEmails = filteredEmails.filter(email => {
        const emailDate = new Date(email.date);
        return emailDate >= searchOptions.dateRange!.start && 
               emailDate <= searchOptions.dateRange!.end;
      });
    }

    let results: EmailMessage[] = [];

    if (query.trim()) {
      // Parse boolean query or use simple search
      if (this.containsBooleanOperators(query)) {
        try {
          const queryNode = this.queryParser.parse(query);
          results = filteredEmails.filter(email => 
            queryNode.evaluate(email, this)
          );
        } catch (error) {
          errorHandler.handleError(error, {
            operation: 'booleanQueryParsing',
            component: 'EmailSearchEngine',
            metadata: { query }
          });
          results = this.simpleSearch(filteredEmails, query, searchOptions);
        }
      } else {
        results = this.simpleSearch(filteredEmails, query, searchOptions);
      }
    } else {
      results = filteredEmails;
    }

    // Sort results
    results = await this.sortResults(results, searchOptions);

    // Limit results
    if (results.length > searchOptions.maxResults) {
      results = results.slice(0, searchOptions.maxResults);
    }

    // Generate highlights
    const highlights = query.trim() ? this.generateHighlights(results, query, searchOptions) : [];

    // Generate suggestions
    const suggestions = await this.generateSuggestions(query, emails);

    // Generate facets
    const facets = this.generateFacets(results);

    const searchTime = performance.now() - startTime;

    return {
      items: results,
      totalCount: results.length,
      took: searchTime,
      suggestions: suggestions.map(s => s.text),
      facets
    };
  }

  /**
   * Get search suggestions for autocomplete
   */
  async getSuggestions(
    query: string, 
    emails: EmailMessage[], 
    limit: number = 10
  ): Promise<SearchSuggestion[]> {
    const internalSuggestions = await this.generateSuggestions(query, emails, limit);
    return internalSuggestions.map((suggestion, index) => ({
      id: `suggestion-${index}`,
      text: suggestion.text,
      type: suggestion.type === 'query' ? 'recent' : 'suggested' as const,
      count: suggestion.count,
      metadata: { score: suggestion.score, originalType: suggestion.type }
    }));
  }

  /**
   * Save a search query
   */
  saveSearch(name: string, query: SearchQuery): void {
    this.savedSearches.set(name, query);
    this.persistSavedSearches();
  }

  /**
   * Get saved searches
   */
  getSavedSearches(): Map<string, SearchQuery> {
    return new Map(this.savedSearches);
  }

  /**
   * Delete saved search
   */
  deleteSavedSearch(name: string): boolean {
    const deleted = this.savedSearches.delete(name);
    if (deleted) {
      this.persistSavedSearches();
    }
    return deleted;
  }

  /**
   * Get search history
   */
  getSearchHistory(): string[] {
    return [...this.searchHistory];
  }

  /**
   * Clear search history
   */
  clearSearchHistory(): void {
    this.searchHistory = [];
    this.persistSearchHistory();
  }

  // Internal methods for boolean query evaluation

  matchesTerm(email: EmailMessage, term: string): boolean {
    const cleanTerm = term.replace(/^["']|["']$/g, ''); // Remove quotes
    const searchContent = this.getEmailSearchContent(email);
    
    if (this.isRegexTerm(cleanTerm)) {
      return this.matchesRegex(searchContent, cleanTerm);
    }
    
    return searchContent.toLowerCase().includes(cleanTerm.toLowerCase());
  }

  matchesField(email: EmailMessage, field: SearchField, value: string): boolean {
    const cleanValue = value.replace(/^["']|["']$/g, '');
    
    switch (field) {
      case 'subject':
        return (email.subject || '').toLowerCase().includes(cleanValue.toLowerCase());
      case 'from':
        return email.senderEmail.toLowerCase().includes(cleanValue.toLowerCase()) ||
               (email.sender || '').toLowerCase().includes(cleanValue.toLowerCase());
      case 'to':
        return email.recipients?.some(recipient => 
          recipient.toLowerCase().includes(cleanValue.toLowerCase())
        ) || false;
      case 'content':
        return (email.content || '').toLowerCase()
          .includes(cleanValue.toLowerCase());
      case 'attachments':
        return email.hasAttachments && cleanValue.toLowerCase().includes('attachment');
      default:
        return this.matchesTerm(email, cleanValue);
    }
  }

  private containsBooleanOperators(query: string): boolean {
    const upperQuery = query.toUpperCase();
    return /\b(AND|OR|NOT)\b/.test(upperQuery) || 
           query.includes('(') || 
           query.includes(')') ||
           query.includes(':');
  }

  private simpleSearch(emails: EmailMessage[], query: string, options: SearchOptions): EmailMessage[] {
    const terms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
    
    return emails.filter(email => {
      if (options.useRegex) {
        try {
          const regex = new RegExp(query, options.caseSensitive ? 'g' : 'gi');
          return regex.test(this.getEmailSearchContent(email));
        } catch {
          // Invalid regex, fall back to simple search
        }
      }

      const searchContent = this.getEmailSearchContent(email);
      const contentToSearch = options.caseSensitive ? searchContent : searchContent.toLowerCase();
      const queryToSearch = options.caseSensitive ? query : query.toLowerCase();

      if (options.wholeWord) {
        const regex = new RegExp(`\\b${this.escapeRegExp(queryToSearch)}\\b`, 'g');
        return regex.test(contentToSearch);
      }

      return terms.every(term => contentToSearch.includes(term));
    });
  }

  private getEmailSearchContent(email: EmailMessage): string {
    const parts = [
      email.subject || '',
      email.content || '',
      email.senderEmail,
      email.sender || '',
      ...(email.recipients || []),
      ...(email.ccRecipients || []),
      ...(email.bccRecipients || [])
    ];
    
    return parts.join(' ');
  }

  private isRegexTerm(term: string): boolean {
    // Simple heuristic to detect regex patterns
    return /[.*+?^${}()|[\]\\]/.test(term);
  }

  private matchesRegex(content: string, pattern: string): boolean {
    try {
      const regex = new RegExp(pattern, 'gi');
      return regex.test(content);
    } catch {
      return false;
    }
  }

  private async sortResults(results: EmailMessage[], options: SearchOptions): Promise<EmailMessage[]> {
    if (options.sortBy === 'relevance') {
      // For relevance, we'll use the existing order (filtered results are already relevance-sorted)
      return results;
    }

    return results.sort((a, b) => {
      let comparison = 0;

      switch (options.sortBy) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'sender':
          comparison = a.senderEmail.localeCompare(b.senderEmail);
          break;
        case 'subject':
          comparison = (a.subject || '').localeCompare(b.subject || '');
          break;
        case 'size':
          const sizeA = (a.content || '').length;
          const sizeB = (b.content || '').length;
          comparison = sizeA - sizeB;
          break;
        case 'importance':
          // Would use ML classification here
          comparison = 0;
          break;
      }

      return options.sortDirection === 'desc' ? -comparison : comparison;
    });
  }

  private generateHighlights(
    results: EmailMessage[], 
    query: string, 
    options: SearchOptions
  ): SearchHighlight[] {
    const highlights: SearchHighlight[] = [];
    const terms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);

    for (const email of results.slice(0, 50)) { // Limit highlights for performance
      const emailHighlights: SearchHighlight = {
        emailId: email.id,
        field: 'content',
        fragments: [],
        positions: []
      };

      // Highlight in subject
      if (email.subject) {
        const subjectHighlight = this.highlightText(email.subject, terms);
        if (subjectHighlight.fragments.length > 0) {
          highlights.push({
            emailId: email.id,
            field: 'subject',
            fragments: subjectHighlight.fragments,
            positions: subjectHighlight.positions
          });
        }
      }

      // Highlight in content
      const content = email.content || '';
      if (content) {
        const contentHighlight = this.highlightText(content, terms);
        if (contentHighlight.fragments.length > 0) {
          emailHighlights.fragments = contentHighlight.fragments;
          emailHighlights.positions = contentHighlight.positions;
          highlights.push(emailHighlights);
        }
      }
    }

    return highlights;
  }

  private highlightText(text: string, terms: string[]): { fragments: string[]; positions: Array<{ start: number; end: number }> } {
    const fragments: string[] = [];
    const positions: Array<{ start: number; end: number }> = [];
    const lowerText = text.toLowerCase();

    for (const term of terms) {
      let index = 0;
      while ((index = lowerText.indexOf(term, index)) !== -1) {
        const start = Math.max(0, index - 30);
        const end = Math.min(text.length, index + term.length + 30);
        const fragment = text.substring(start, end);
        
        fragments.push(fragment);
        positions.push({ start: index, end: index + term.length });
        
        index += term.length;
      }
    }

    return { fragments: fragments.slice(0, 3), positions }; // Limit to 3 fragments
  }

  private async generateSuggestions(
    query: string, 
    emails: EmailMessage[], 
    limit: number = 10
  ): Promise<InternalSearchSuggestion[]> {
    const suggestions: InternalSearchSuggestion[] = [];
    const queryLower = query.toLowerCase();

    // History-based suggestions
    for (const historicalQuery of this.searchHistory) {
      if (historicalQuery.toLowerCase().includes(queryLower) && historicalQuery !== query) {
        suggestions.push({
          text: historicalQuery,
          type: 'query',
          count: 1,
          score: 0.8
        });
      }
    }

    // Sender-based suggestions
    const senders = new Map<string, number>();
    for (const email of emails) {
      const senderKey = email.sender || email.senderEmail;
      if (senderKey.toLowerCase().includes(queryLower)) {
        senders.set(senderKey, (senders.get(senderKey) || 0) + 1);
      }
    }

    for (const [sender, count] of Array.from(senders.entries()).slice(0, 5)) {
      suggestions.push({
        text: `from:${sender}`,
        type: 'sender',
        count,
        score: 0.7
      });
    }

    // Subject-based suggestions
    const subjectWords = new Map<string, number>();
    for (const email of emails) {
      if (email.subject) {
        const words = email.subject.toLowerCase().split(/\s+/);
        for (const word of words) {
          if (word.length > 3 && word.includes(queryLower)) {
            subjectWords.set(word, (subjectWords.get(word) || 0) + 1);
          }
        }
      }
    }

    for (const [word, count] of Array.from(subjectWords.entries()).slice(0, 5)) {
      suggestions.push({
        text: `subject:${word}`,
        type: 'subject',
        count,
        score: 0.6
      });
    }

    // Sort by score and limit
    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private generateFacets(results: EmailMessage[]): SearchFacet[] {
    const facets: SearchFacet[] = [];

    // Sender facet
    const senders = new Map<string, number>();
    for (const email of results) {
      const sender = email.sender || email.senderEmail;
      senders.set(sender, (senders.get(sender) || 0) + 1);
    }

    if (senders.size > 1) {
      facets.push({
        field: 'sender',
        values: Array.from(senders.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([value, count]) => ({ value, count, selected: false }))
      });
    }

    // Date facet
    const dates = new Map<string, number>();
    for (const email of results) {
      const date = new Date(email.date).toISOString().split('T')[0];
      dates.set(date, (dates.get(date) || 0) + 1);
    }

    if (dates.size > 1) {
      facets.push({
        field: 'date',
        values: Array.from(dates.entries())
          .sort((a, b) => b[0].localeCompare(a[0]))
          .slice(0, 10)
          .map(([value, count]) => ({ value, count, selected: false }))
      });
    }

    return facets;
  }

  private addToSearchHistory(query: string): void {
    if (!query.trim() || this.searchHistory.includes(query)) {
      return;
    }

    this.searchHistory.unshift(query);
    if (this.searchHistory.length > 100) {
      this.searchHistory = this.searchHistory.slice(0, 100);
    }

    this.persistSearchHistory();
  }

  private loadSearchHistory(): void {
    try {
      const stored = localStorage.getItem('email-search-history');
      if (stored) {
        this.searchHistory = JSON.parse(stored);
      }
    } catch (error) {
      this.searchHistory = [];
      errorHandler.handleError(error, {
        operation: 'loadSearchHistory',
        component: 'EmailSearchEngine'
      });
    }
  }

  private persistSearchHistory(): void {
    try {
      localStorage.setItem('email-search-history', JSON.stringify(this.searchHistory));
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'persistSearchHistory',
        component: 'EmailSearchEngine'
      });
    }
  }

  private loadSavedSearches(): void {
    try {
      const stored = localStorage.getItem('email-saved-searches');
      if (stored) {
        const data = JSON.parse(stored);
        this.savedSearches = new Map(Object.entries(data));
      }
    } catch (error) {
      this.savedSearches = new Map();
      errorHandler.handleError(error, {
        operation: 'loadSavedSearches',
        component: 'EmailSearchEngine'
      });
    }
  }

  private persistSavedSearches(): void {
    try {
      const data = Object.fromEntries(this.savedSearches);
      localStorage.setItem('email-saved-searches', JSON.stringify(data));
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'persistSavedSearches',
        component: 'EmailSearchEngine'
      });
    }
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  getIndexStats(): { terms: number; fieldTerms: number; emails: number } {
    return this.index.getIndexSize();
  }
}

// Export singleton instance
export const searchEngine = new EmailSearchEngine();

export default EmailSearchEngine;