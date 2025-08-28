/**
 * Enterprise Email Management - Advanced ML-based Email Classification
 * Intelligent email filtering and sorting with machine learning capabilities
 * 
 * Features:
 * - Spam detection and content filtering
 * - Importance scoring and priority classification
 * - Sentiment analysis and tone detection
 * - Category classification (work, personal, shopping, etc.)
 * - Smart sender reputation scoring
 * - Content-based filtering with NLP
 * - Real-time classification with caching
 */

import { EmailMessage, EmailClassification, FilterCriteria, SortCriteria } from '../types/index';

export interface MLClassificationResult {
  spamScore: number;
  importanceScore: number;
  sentimentScore: number;
  category: EmailCategory;
  urgencyLevel: UrgencyLevel;
  senderReputation: number;
  topics: string[];
  confidence: number;
  processingTime: number;
}

export type EmailCategory = 
  | 'work' | 'personal' | 'shopping' | 'travel' | 'finance' 
  | 'social' | 'newsletters' | 'promotions' | 'notifications' 
  | 'spam' | 'support' | 'legal' | 'education' | 'other';

export type UrgencyLevel = 'critical' | 'high' | 'medium' | 'low';

export type SentimentType = 'positive' | 'negative' | 'neutral';

export interface ClassificationFeatures {
  // Content features
  wordCount: number;
  characterCount: number;
  capitalLetterRatio: number;
  exclamationCount: number;
  questionCount: number;
  urlCount: number;
  emailAddressCount: number;
  phoneNumberCount: number;
  
  // Structure features
  hasAttachments: boolean;
  attachmentCount: number;
  attachmentTypes: string[];
  
  // Sender features
  senderDomain: string;
  senderFrequency: number;
  senderPreviousInteractions: number;
  isFromKnownContact: boolean;
  
  // Temporal features
  hourOfDay: number;
  dayOfWeek: number;
  timeSinceLastEmail: number;
  
  // Subject features
  subjectLength: number;
  subjectCapitalRatio: number;
  hasReplyPrefix: boolean;
  hasForwardPrefix: boolean;
  
  // Content analysis
  languageDetected: string;
  readabilityScore: number;
  formalityScore: number;
  
  // Behavioral features
  recipientCount: number;
  ccCount: number;
  bccCount: number;
}

/**
 * Feature Extraction Engine
 */
class FeatureExtractor {
  private stopWords: Set<string>;
  private spamKeywords: Set<string>;
  private urgentKeywords: Set<string>;
  private domainReputations: Map<string, number>;

  constructor() {
    this.stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
      'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'can', 'shall', 'must', 'this', 'that',
      'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
    ]);

    this.spamKeywords = new Set([
      'free', 'winner', 'congratulations', 'urgent', 'limited time', 'act now',
      'no cost', 'risk free', 'guarantee', 'money back', 'click here',
      'unsubscribe', 'offer expires', 'dear friend', 'selected', 'exclusive'
    ]);

    this.urgentKeywords = new Set([
      'urgent', 'asap', 'immediately', 'deadline', 'emergency', 'critical',
      'important', 'priority', 'rush', 'time sensitive', 'expires today',
      'final notice', 'action required', 'respond now', 'overdue'
    ]);

    this.domainReputations = new Map([
      ['gmail.com', 0.9], ['outlook.com', 0.9], ['yahoo.com', 0.8],
      ['apple.com', 0.95], ['microsoft.com', 0.95], ['google.com', 0.95],
      ['amazon.com', 0.9], ['facebook.com', 0.85], ['twitter.com', 0.85]
    ]);
  }

  extractFeatures(email: EmailMessage): ClassificationFeatures {
    const content = email.content || '';
    const subject = email.subject || '';
    const senderDomain = email.senderEmail.split('@')[1]?.toLowerCase() || '';

    return {
      // Content features
      wordCount: this.countWords(content),
      characterCount: content.length,
      capitalLetterRatio: this.calculateCapitalRatio(content),
      exclamationCount: (content.match(/!/g) || []).length,
      questionCount: (content.match(/\?/g) || []).length,
      urlCount: this.extractUrls(content).length,
      emailAddressCount: this.extractEmails(content).length,
      phoneNumberCount: this.extractPhoneNumbers(content).length,

      // Structure features
      hasAttachments: email.hasAttachments,
      attachmentCount: email.attachmentCount || 0,
      attachmentTypes: [],

      // Sender features
      senderDomain,
      senderFrequency: 0, // Would be calculated from historical data
      senderPreviousInteractions: 0, // Would be calculated from historical data
      isFromKnownContact: this.isKnownContact(email.senderEmail),

      // Temporal features
      hourOfDay: new Date(email.date).getHours(),
      dayOfWeek: new Date(email.date).getDay(),
      timeSinceLastEmail: 0, // Would be calculated from historical data

      // Subject features
      subjectLength: subject.length,
      subjectCapitalRatio: this.calculateCapitalRatio(subject),
      hasReplyPrefix: /^re:/i.test(subject),
      hasForwardPrefix: /^fwd?:/i.test(subject),

      // Content analysis
      languageDetected: this.detectLanguage(content),
      readabilityScore: this.calculateReadabilityScore(content),
      formalityScore: this.calculateFormalityScore(content),

      // Behavioral features
      recipientCount: email.recipients?.length || 0,
      ccCount: email.ccRecipients?.length || 0,
      bccCount: email.bccRecipients?.length || 0
    };
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  private calculateCapitalRatio(text: string): number {
    const letters = text.replace(/[^a-zA-Z]/g, '');
    if (letters.length === 0) return 0;
    const capitals = text.replace(/[^A-Z]/g, '');
    return capitals.length / letters.length;
  }

  private extractUrls(text: string): string[] {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  }

  private extractEmails(text: string): string[] {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    return text.match(emailRegex) || [];
  }

  private extractPhoneNumbers(text: string): string[] {
    const phoneRegex = /(\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4})/g;
    return text.match(phoneRegex) || [];
  }

  private getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
  }

  private isKnownContact(email: string): boolean {
    // This would integrate with the contact database
    // For now, return a simple heuristic
    return false;
  }

  private detectLanguage(text: string): string {
    // Simple heuristic - in production, use a proper language detection library
    const englishWords = ['the', 'and', 'or', 'to', 'for', 'of', 'with', 'by'];
    const wordCount = englishWords.reduce((count, word) => 
      count + (text.toLowerCase().match(new RegExp(`\\b${word}\\b`, 'g')) || []).length, 0
    );
    return wordCount > 3 ? 'en' : 'unknown';
  }

  private calculateReadabilityScore(text: string): number {
    // Simplified Flesch Reading Ease calculation
    const words = this.countWords(text);
    const sentences = (text.match(/[.!?]+/g) || []).length || 1;
    const syllables = this.countSyllables(text);
    
    const avgWordsPerSentence = words / sentences;
    const avgSyllablesPerWord = syllables / words;
    
    return Math.max(0, Math.min(100, 
      206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord)
    ));
  }

  private calculateFormalityScore(text: string): number {
    const formalWords = ['therefore', 'consequently', 'furthermore', 'however', 'nevertheless'];
    const informalWords = ['gonna', 'wanna', 'yeah', 'ok', 'awesome', 'cool'];
    
    const formalCount = formalWords.reduce((count, word) =>
      count + (text.toLowerCase().match(new RegExp(`\\b${word}\\b`, 'g')) || []).length, 0
    );
    
    const informalCount = informalWords.reduce((count, word) =>
      count + (text.toLowerCase().match(new RegExp(`\\b${word}\\b`, 'g')) || []).length, 0
    );
    
    const totalWords = this.countWords(text);
    return totalWords > 0 ? (formalCount - informalCount) / totalWords : 0;
  }

  private countSyllables(text: string): number {
    return text.toLowerCase().replace(/[^a-z]/g, '').replace(/[aeiou]{2,}/g, 'a')
      .replace(/[aeiou]/g, 'a').replace(/[^a]/g, '').length;
  }
}

/**
 * Machine Learning Classification Engine
 */
class MLClassifier {
  private featureExtractor: FeatureExtractor;
  private models: Map<string, any>; // In production, these would be actual ML models

  constructor() {
    this.featureExtractor = new FeatureExtractor();
    this.models = new Map();
    this.loadModels();
  }

  async classify(email: EmailMessage): Promise<MLClassificationResult> {
    const startTime = performance.now();
    const features = this.featureExtractor.extractFeatures(email);

    const [
      spamScore,
      importanceScore,
      sentimentScore,
      category,
      urgencyLevel,
      senderReputation
    ] = await Promise.all([
      this.classifySpam(features, email),
      this.classifyImportance(features, email),
      this.analyzeSentiment(features, email),
      this.classifyCategory(features, email),
      this.classifyUrgency(features, email),
      this.calculateSenderReputation(features, email)
    ]);

    const topics = await this.extractTopics(email);
    const processingTime = performance.now() - startTime;

    return {
      spamScore,
      importanceScore,
      sentimentScore,
      category,
      urgencyLevel,
      senderReputation,
      topics,
      confidence: this.calculateConfidence([spamScore, importanceScore, sentimentScore]),
      processingTime
    };
  }

  private async classifySpam(features: ClassificationFeatures, email: EmailMessage): Promise<number> {
    let score = 0;
    const content = (email.content || '').toLowerCase();
    const subject = (email.subject || '').toLowerCase();

    // Keyword-based scoring
    const spamKeywords = Array.from(this.featureExtractor['spamKeywords']);
    const keywordMatches = spamKeywords.reduce((count, keyword) => 
      count + (content.includes(keyword) ? 1 : 0) + (subject.includes(keyword) ? 2 : 0), 0
    );
    score += Math.min(0.4, keywordMatches * 0.05);

    // Structure-based scoring
    if (features.capitalLetterRatio > 0.3) score += 0.2;
    if (features.exclamationCount > 3) score += 0.15;
    if (features.urlCount > 5) score += 0.2;
    if (!features.isFromKnownContact) score += 0.1;

    // Domain reputation
    const domain = features.senderDomain;
    const domainRep = this.featureExtractor['domainReputations'].get(domain) || 0.5;
    score += (1 - domainRep) * 0.3;

    return Math.min(1, Math.max(0, score));
  }

  private async classifyImportance(features: ClassificationFeatures, email: EmailMessage): Promise<number> {
    let score = 0.5; // Base importance

    // Sender-based importance
    if (features.isFromKnownContact) score += 0.2;
    if (features.senderPreviousInteractions > 10) score += 0.1;

    // Content-based importance
    const content = (email.content || '').toLowerCase();
    const urgentKeywords = Array.from(this.featureExtractor['urgentKeywords']);
    const urgencyMatches = urgentKeywords.reduce((count, keyword) => 
      count + (content.includes(keyword) ? 1 : 0), 0
    );
    score += Math.min(0.3, urgencyMatches * 0.1);

    // Structure-based importance
    if (features.hasAttachments) score += 0.1;
    if (features.recipientCount === 1) score += 0.1; // Personal emails often more important

    // Time-based importance
    if (features.hourOfDay >= 9 && features.hourOfDay <= 17) score += 0.05; // Business hours

    return Math.min(1, Math.max(0, score));
  }

  private async analyzeSentiment(features: ClassificationFeatures, email: EmailMessage): Promise<number> {
    const content = (email.content || '').toLowerCase();
    
    // Simple lexicon-based sentiment analysis
    const positiveWords = ['great', 'excellent', 'good', 'happy', 'pleased', 'wonderful', 'amazing', 'fantastic'];
    const negativeWords = ['bad', 'terrible', 'awful', 'disappointed', 'frustrated', 'angry', 'upset', 'horrible'];
    
    const positiveCount = positiveWords.reduce((count, word) =>
      count + (content.match(new RegExp(`\\b${word}\\b`, 'g')) || []).length, 0
    );
    
    const negativeCount = negativeWords.reduce((count, word) =>
      count + (content.match(new RegExp(`\\b${word}\\b`, 'g')) || []).length, 0
    );

    const totalWords = features.wordCount;
    if (totalWords === 0) return 0.5; // Neutral

    const sentimentScore = (positiveCount - negativeCount) / totalWords;
    return Math.max(-1, Math.min(1, sentimentScore * 10)); // Scale to -1 to 1
  }

  private async classifyCategory(features: ClassificationFeatures, email: EmailMessage): Promise<EmailCategory> {
    const content = (email.content || '').toLowerCase();
    const subject = (email.subject || '').toLowerCase();
    const senderDomain = features.senderDomain;

    // Domain-based classification
    if (senderDomain.includes('noreply') || senderDomain.includes('no-reply')) {
      return 'notifications';
    }

    // Shopping indicators
    if (content.includes('order') || content.includes('purchase') || 
        content.includes('shipping') || content.includes('delivery')) {
      return 'shopping';
    }

    // Financial indicators
    if (content.includes('payment') || content.includes('invoice') || 
        content.includes('bank') || content.includes('account')) {
      return 'finance';
    }

    // Travel indicators
    if (content.includes('flight') || content.includes('hotel') || 
        content.includes('reservation') || content.includes('booking')) {
      return 'travel';
    }

    // Work indicators
    if (content.includes('meeting') || content.includes('project') || 
        content.includes('deadline') || features.formalityScore > 0.1) {
      return 'work';
    }

    // Social indicators
    if (senderDomain.includes('facebook') || senderDomain.includes('twitter') ||
        senderDomain.includes('linkedin') || senderDomain.includes('instagram')) {
      return 'social';
    }

    // Newsletter indicators
    if (subject.includes('newsletter') || content.includes('unsubscribe') ||
        content.includes('mailing list')) {
      return 'newsletters';
    }

    // Support indicators
    if (content.includes('support') || content.includes('help') ||
        content.includes('ticket') || content.includes('case')) {
      return 'support';
    }

    return 'personal'; // Default fallback
  }

  private async classifyUrgency(features: ClassificationFeatures, email: EmailMessage): Promise<UrgencyLevel> {
    let urgencyScore = 0;

    // Keyword-based urgency
    const content = (email.content || '').toLowerCase();
    const subject = (email.subject || '').toLowerCase();
    const urgentKeywords = Array.from(this.featureExtractor['urgentKeywords']);
    
    const keywordMatches = urgentKeywords.reduce((count, keyword) => 
      count + (content.includes(keyword) ? 1 : 0) + (subject.includes(keyword) ? 2 : 0), 0
    );
    urgencyScore += keywordMatches * 0.2;

    // Time-based urgency
    const now = new Date();
    const emailDate = new Date(email.date);
    const hoursDiff = (now.getTime() - emailDate.getTime()) / (1000 * 60 * 60);
    
    if (hoursDiff < 1) urgencyScore += 0.3;
    else if (hoursDiff < 4) urgencyScore += 0.2;
    else if (hoursDiff < 24) urgencyScore += 0.1;

    // Structure-based urgency
    if (features.exclamationCount > 2) urgencyScore += 0.2;
    if (features.capitalLetterRatio > 0.2) urgencyScore += 0.1;

    if (urgencyScore > 0.8) return 'critical';
    if (urgencyScore > 0.5) return 'high';
    if (urgencyScore > 0.2) return 'medium';
    return 'low';
  }

  private async calculateSenderReputation(features: ClassificationFeatures, email: EmailMessage): Promise<number> {
    let reputation = 0.5; // Base reputation

    // Domain reputation
    const domainRep = this.featureExtractor['domainReputations'].get(features.senderDomain) || 0.5;
    reputation += (domainRep - 0.5) * 0.4;

    // Historical interactions
    if (features.isFromKnownContact) reputation += 0.2;
    if (features.senderPreviousInteractions > 0) {
      reputation += Math.min(0.3, features.senderPreviousInteractions * 0.01);
    }

    // Email structure quality
    if (features.formalityScore > 0) reputation += 0.1;
    if (features.readabilityScore > 60) reputation += 0.1;

    return Math.min(1, Math.max(0, reputation));
  }

  private async extractTopics(email: EmailMessage): Promise<string[]> {
    const content = (email.content || '').toLowerCase();
    const subject = (email.subject || '').toLowerCase();
    const text = `${subject} ${content}`;

    // Simple keyword extraction - in production, use proper NLP
    const topicKeywords = {
      'meeting': ['meeting', 'call', 'conference', 'zoom', 'teams'],
      'deadline': ['deadline', 'due', 'urgent', 'asap', 'expires'],
      'project': ['project', 'task', 'deliverable', 'milestone'],
      'finance': ['payment', 'invoice', 'money', 'cost', 'budget'],
      'travel': ['flight', 'hotel', 'trip', 'vacation', 'travel'],
      'shopping': ['order', 'purchase', 'buy', 'sale', 'discount']
    };

    const detectedTopics: string[] = [];
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        detectedTopics.push(topic);
      }
    }

    return detectedTopics;
  }

  private calculateConfidence(scores: number[]): number {
    // Calculate confidence based on score consistency and feature strength
    const variance = this.calculateVariance(scores);
    return Math.max(0.1, Math.min(1, 1 - variance));
  }

  private calculateVariance(numbers: number[]): number {
    const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length;
  }

  private loadModels(): void {
    // In production, load actual ML models here
    // For now, we use rule-based classification
  }
}

/**
 * Advanced Email Filter and Sort Engine
 */
export class EmailFilterSortEngine {
  private mlClassifier: MLClassifier;
  private classificationCache: Map<string, MLClassificationResult>;

  constructor() {
    this.mlClassifier = new MLClassifier();
    this.classificationCache = new Map();
  }

  async classifyEmail(email: EmailMessage): Promise<MLClassificationResult> {
    // Check cache first
    const cacheKey = `${email.id}-${email.date}`;
    if (this.classificationCache.has(cacheKey)) {
      return this.classificationCache.get(cacheKey)!;
    }

    const result = await this.mlClassifier.classify(email);
    this.classificationCache.set(cacheKey, result);
    
    // Limit cache size
    if (this.classificationCache.size > 1000) {
      const firstKey = this.classificationCache.keys().next().value;
      if (firstKey) {
        this.classificationCache.delete(firstKey);
      }
    }

    return result;
  }

  async filterEmails(emails: EmailMessage[], criteria: FilterCriteria[]): Promise<EmailMessage[]> {
    const filteredEmails = [];

    for (const email of emails) {
      let matches = true;

      for (const criterion of criteria) {
        const emailMatches = await this.evaluateFilterCriterion(email, criterion);
        // Default to AND logic - all criteria must match
        matches = matches && emailMatches;

        if (!matches) {
          break; // Early termination if any criterion doesn't match
        }
      }

      if (matches) {
        filteredEmails.push(email);
      }
    }

    return filteredEmails;
  }

  async sortEmails(emails: EmailMessage[], criteria: SortCriteria[]): Promise<EmailMessage[]> {
    // Classify all emails for sorting
    const emailsWithClassification = await Promise.all(
      emails.map(async (email) => ({
        email,
        classification: await this.classifyEmail(email)
      }))
    );

    return emailsWithClassification.sort((a, b) => {
      for (const criterion of criteria) {
        const comparison = this.compareEmails(a, b, criterion);
        if (comparison !== 0) {
          return criterion.direction === 'desc' ? -comparison : comparison;
        }
      }
      return 0;
    }).map(item => item.email);
  }

  private async evaluateFilterCriterion(email: EmailMessage, criterion: FilterCriteria): Promise<boolean> {
    // Check sender
    if (criterion.sender) {
      if (!email.senderEmail.toLowerCase().includes(criterion.sender.toLowerCase())) {
        return false;
      }
    }

    // Check subject
    if (criterion.subject) {
      if (!email.subject.toLowerCase().includes(criterion.subject.toLowerCase())) {
        return false;
      }
    }

    // Check keywords in content
    if (criterion.keywords && criterion.keywords.length > 0) {
      const content = email.content.toLowerCase();
      const hasKeyword = criterion.keywords.some(keyword => 
        content.includes(keyword.toLowerCase())
      );
      if (!hasKeyword) {
        return false;
      }
    }

    // Check attachments
    if (criterion.hasAttachments !== undefined) {
      if (email.hasAttachments !== criterion.hasAttachments) {
        return false;
      }
    }

    // Check date range
    if (criterion.dateRange) {
      const emailDate = new Date(email.date);
      const startDate = new Date(criterion.dateRange.start);
      const endDate = new Date(criterion.dateRange.end);
      
      if (emailDate < startDate || emailDate > endDate) {
        return false;
      }
    }

    return true;
  }

  private compareEmails(
    a: { email: EmailMessage; classification: MLClassificationResult },
    b: { email: EmailMessage; classification: MLClassificationResult },
    criterion: SortCriteria
  ): number {
    switch (criterion.field) {
      case 'date':
        return new Date(a.email.date).getTime() - new Date(b.email.date).getTime();
      
      case 'sender':
        return a.email.senderEmail.localeCompare(b.email.senderEmail);
      
      case 'subject':
        return (a.email.subject || '').localeCompare(b.email.subject || '');
      
      case 'importance':
        return a.classification.importanceScore - b.classification.importanceScore;
      
      case 'spamScore':
        return a.classification.spamScore - b.classification.spamScore;
      
      case 'sentiment':
        return a.classification.sentimentScore - b.classification.sentimentScore;
      
      case 'senderReputation':
        return a.classification.senderReputation - b.classification.senderReputation;
      
      case 'size':
        const sizeA = (a.email.content || '').length;
        const sizeB = (b.email.content || '').length;
        return sizeA - sizeB;
      
      case 'attachmentCount':
        return (a.email.attachmentCount || 0) - (b.email.attachmentCount || 0);
      
      default:
        return 0;
    }
  }

  private matchesText(text: string, pattern: string, matchType: string = 'contains'): boolean {
    const lowerText = text.toLowerCase();
    const lowerPattern = pattern.toLowerCase();

    switch (matchType) {
      case 'equals':
        return lowerText === lowerPattern;
      case 'startsWith':
        return lowerText.startsWith(lowerPattern);
      case 'endsWith':
        return lowerText.endsWith(lowerPattern);
      case 'contains':
        return lowerText.includes(lowerPattern);
      case 'regex':
        try {
          return new RegExp(pattern, 'i').test(text);
        } catch {
          return false;
        }
      default:
        return lowerText.includes(lowerPattern);
    }
  }

  private matchesDateRange(date: string, range: { start: string; end: string }): boolean {
    const emailDate = new Date(date);
    const startDate = new Date(range.start);
    const endDate = new Date(range.end);
    return emailDate >= startDate && emailDate <= endDate;
  }

  private matchesNumericRange(value: number, range: { min: number; max: number }): boolean {
    return value >= range.min && value <= range.max;
  }

  private categorizeSentiment(score: number): SentimentType {
    if (score > 0.1) return 'positive';
    if (score < -0.1) return 'negative';
    return 'neutral';
  }

  // Utility methods for quick filters
  async getSpamEmails(emails: EmailMessage[], threshold: number = 0.7): Promise<EmailMessage[]> {
    const results: EmailMessage[] = [];
    for (const email of emails) {
      const classification = await this.classifyEmail(email);
      if (classification.spamScore >= threshold) {
        results.push(email);
      }
    }
    return results;
  }

  async getImportantEmails(emails: EmailMessage[], threshold: number = 0.7): Promise<EmailMessage[]> {
    const results: EmailMessage[] = [];
    for (const email of emails) {
      const classification = await this.classifyEmail(email);
      if (classification.importanceScore >= threshold) {
        results.push(email);
      }
    }
    return results;
  }

  async getUnreadEmails(emails: EmailMessage[]): Promise<EmailMessage[]> {
    return emails.filter(email => !email.isRead);
  }

  async getEmailsByCategory(emails: EmailMessage[], category: EmailCategory): Promise<EmailMessage[]> {
    const results: EmailMessage[] = [];
    for (const email of emails) {
      const classification = await this.classifyEmail(email);
      if (classification.category === category) {
        results.push(email);
      }
    }
    return results;
  }

  clearCache(): void {
    this.classificationCache.clear();
  }
}

// Export singleton instance
export const filterSortEngine = new EmailFilterSortEngine();

export default EmailFilterSortEngine;