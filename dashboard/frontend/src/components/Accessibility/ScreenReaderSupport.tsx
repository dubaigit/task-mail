import React, { useEffect, useRef, ReactNode, useState } from 'react';
import { useAccessibility } from './AccessibilityProvider';

export interface ScreenReaderRegionProps {
  children: ReactNode;
  priority?: 'polite' | 'assertive';
  atomic?: boolean;
  relevant?: 'text' | 'all' | 'additions' | 'additions removals' | 'additions text' | 'removals' | 'removals additions' | 'removals text' | 'text additions' | 'text removals';
  busy?: boolean;
}

/**
 * Live region for dynamic content announcements
 */
export function ScreenReaderRegion({ 
  children, 
  priority = 'polite', 
  atomic = true,
  relevant = 'all',
  busy = false 
}: ScreenReaderRegionProps) {
  return (
    <div
      aria-live={priority}
      aria-atomic={atomic}
      aria-relevant={relevant}
      aria-busy={busy}
      className="screen-reader-region"
    >
      {children}
    </div>
  );
}

/**
 * Visually hidden content that's still accessible to screen readers
 */
export interface VisuallyHiddenProps {
  children: ReactNode;
  className?: string;
}

export function VisuallyHidden({ children, className = '' }: VisuallyHiddenProps) {
  return (
    <span className={`sr-only ${className}`}>
      {children}
    </span>
  );
}

/**
 * Loading announcement with progress indication
 */
export interface LoadingAnnouncementProps {
  isLoading: boolean;
  loadingText?: string;
  completedText?: string;
  progress?: number;
  children?: ReactNode;
}

export function LoadingAnnouncement({
  isLoading,
  loadingText = 'Loading...',
  completedText = 'Loading complete',
  progress,
  children
}: LoadingAnnouncementProps) {
  const [announced, setAnnounced] = useState(false);
  const { announce } = useAccessibility();

  useEffect(() => {
    if (isLoading && !announced) {
      announce({
        message: progress !== undefined ? `${loadingText} ${Math.round(progress)}% complete` : loadingText,
        priority: 'polite'
      });
      setAnnounced(true);
    } else if (!isLoading && announced) {
      announce({
        message: completedText,
        priority: 'polite'
      });
      setAnnounced(false);
    }
  }, [isLoading, loadingText, completedText, progress, announced, announce]);

  if (!isLoading && !children) return null;

  return (
    <ScreenReaderRegion priority="polite">
      {isLoading ? (
        <div>
          {loadingText}
          {progress !== undefined && (
            <VisuallyHidden> {Math.round(progress)}% complete</VisuallyHidden>
          )}
        </div>
      ) : (
        children
      )}
    </ScreenReaderRegion>
  );
}

/**
 * Error announcements with appropriate urgency
 */
export interface ErrorAnnouncementProps {
  error: string | null;
  level?: 'info' | 'warning' | 'error';
  onDismiss?: () => void;
  autoHide?: boolean;
  duration?: number;
}

export function ErrorAnnouncement({
  error,
  level = 'error',
  onDismiss,
  autoHide = false,
  duration = 5000
}: ErrorAnnouncementProps) {
  const { announce } = useAccessibility();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (error) {
      setIsVisible(true);
      const priority = level === 'error' ? 'assertive' : 'polite';
      const prefix = level === 'error' ? 'Error: ' : level === 'warning' ? 'Warning: ' : 'Info: ';
      
      announce({
        message: `${prefix}${error}`,
        priority
      });

      if (autoHide) {
        const timer = setTimeout(() => {
          setIsVisible(false);
          onDismiss?.();
        }, duration);

        return () => clearTimeout(timer);
      }
    } else {
      setIsVisible(false);
    }
  }, [error, level, autoHide, duration, onDismiss, announce]);

  if (!error || !isVisible) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`error-announcement error-announcement--${level}`}
      style={{
        padding: '12px',
        marginBottom: '16px',
        border: '1px solid',
        borderRadius: '4px',
        backgroundColor: level === 'error' ? '#fef2f2' : level === 'warning' ? '#fffbeb' : '#f0f9ff',
        borderColor: level === 'error' ? '#fecaca' : level === 'warning' ? '#fed7aa' : '#bae6fd',
        color: level === 'error' ? '#991b1b' : level === 'warning' ? '#92400e' : '#1e40af'
      }}
    >
      <VisuallyHidden>
        {level === 'error' ? 'Error: ' : level === 'warning' ? 'Warning: ' : 'Information: '}
      </VisuallyHidden>
      {error}
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss message"
          style={{
            marginLeft: '12px',
            background: 'none',
            border: 'none',
            fontSize: '18px',
            cursor: 'pointer',
            color: 'inherit'
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

/**
 * Progress bar with screen reader support
 */
export interface AccessibleProgressProps {
  value: number;
  max?: number;
  label?: string;
  description?: string;
  showPercentage?: boolean;
  format?: (value: number, max: number) => string;
}

export function AccessibleProgress({
  value,
  max = 100,
  label,
  description,
  showPercentage = true,
  format
}: AccessibleProgressProps) {
  const percentage = Math.round((value / max) * 100);
  const formattedValue = format ? format(value, max) : showPercentage ? `${percentage}%` : `${value} of ${max}`;

  return (
    <div className="accessible-progress">
      {label && (
        <label className="progress-label" style={{ display: 'block', marginBottom: '4px' }}>
          {label}
        </label>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuetext={formattedValue}
        aria-label={label}
        aria-describedby={description ? 'progress-description' : undefined}
        style={{
          width: '100%',
          height: '20px',
          backgroundColor: '#e5e7eb',
          borderRadius: '10px',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            backgroundColor: '#3b82f6',
            transition: 'width 0.3s ease'
          }}
        />
        <VisuallyHidden>
          Progress: {formattedValue}
        </VisuallyHidden>
      </div>
      {description && (
        <p id="progress-description" className="progress-description" style={{ 
          fontSize: '14px', 
          marginTop: '4px',
          color: '#6b7280'
        }}>
          {description}
        </p>
      )}
    </div>
  );
}

/**
 * Accessible form field with proper labeling
 */
export interface AccessibleFieldProps {
  id: string;
  label: string;
  children: ReactNode;
  error?: string;
  description?: string;
  required?: boolean;
  className?: string;
}

export function AccessibleField({
  id,
  label,
  children,
  error,
  description,
  required = false,
  className = ''
}: AccessibleFieldProps) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const ariaDescribedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`accessible-field ${className}`} style={{ marginBottom: '16px' }}>
      <label
        htmlFor={id}
        className="field-label"
        style={{
          display: 'block',
          marginBottom: '4px',
          fontWeight: '500'
        }}
      >
        {label}
        {required && (
          <>
            <span aria-hidden="true" style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>
            <VisuallyHidden> (required)</VisuallyHidden>
          </>
        )}
      </label>
      
      {description && (
        <p
          id={descriptionId}
          className="field-description"
          style={{
            fontSize: '14px',
            marginBottom: '4px',
            color: '#6b7280'
          }}
        >
          {description}
        </p>
      )}
      
      <div aria-describedby={ariaDescribedBy}>
        {children}
      </div>
      
      {error && (
        <p
          id={errorId}
          role="alert"
          className="field-error"
          style={{
            fontSize: '14px',
            marginTop: '4px',
            color: '#ef4444'
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Accessible table with proper headers and navigation
 */
export interface AccessibleTableProps {
  caption?: string;
  headers: Array<{ key: string; label: string; description?: string }>;
  data: Array<Record<string, any>>;
  className?: string;
  sortable?: boolean;
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
}

export function AccessibleTable({
  caption,
  headers,
  data,
  className = '',
  sortable = false,
  onSort,
  sortKey,
  sortDirection
}: AccessibleTableProps) {
  const { announce } = useAccessibility();

  const handleSort = (key: string) => {
    if (!sortable || !onSort) return;
    
    const newDirection = sortKey === key && sortDirection === 'asc' ? 'desc' : 'asc';
    onSort(key, newDirection);
    
    announce({
      message: `Table sorted by ${headers.find(h => h.key === key)?.label} ${newDirection}ending`,
      priority: 'polite'
    });
  };

  return (
    <div className={`accessible-table-container ${className}`} style={{ overflowX: 'auto' }}>
      <table
        role="table"
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          border: '1px solid #d1d5db'
        }}
      >
        {caption && (
          <caption style={{ 
            padding: '12px',
            textAlign: 'left',
            fontWeight: '600',
            backgroundColor: '#f9fafb'
          }}>
            {caption}
          </caption>
        )}
        
        <thead>
          <tr role="row">
            {headers.map(header => (
              <th
                key={header.key}
                role="columnheader"
                scope="col"
                aria-sort={
                  sortKey === header.key 
                    ? sortDirection === 'asc' ? 'ascending' : 'descending'
                    : sortable ? 'none' : undefined
                }
                style={{
                  padding: '12px',
                  textAlign: 'left',
                  backgroundColor: '#f3f4f6',
                  borderBottom: '2px solid #d1d5db',
                  fontWeight: '600',
                  cursor: sortable ? 'pointer' : 'default'
                }}
                onClick={sortable ? () => handleSort(header.key) : undefined}
                onKeyDown={sortable ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSort(header.key);
                  }
                } : undefined}
                tabIndex={sortable ? 0 : undefined}
              >
                {header.label}
                {sortable && (
                  <VisuallyHidden>
                    {sortKey === header.key
                      ? `, sorted ${sortDirection}ending`
                      : ', not sorted, click to sort'
                    }
                  </VisuallyHidden>
                )}
                {header.description && (
                  <VisuallyHidden> - {header.description}</VisuallyHidden>
                )}
              </th>
            ))}
          </tr>
        </thead>
        
        <tbody>
          {data.map((row, index) => (
            <tr
              key={index}
              role="row"
              style={{
                borderBottom: '1px solid #e5e7eb'
              }}
            >
              {headers.map(header => (
                <td
                  key={header.key}
                  role="cell"
                  style={{
                    padding: '12px',
                    borderBottom: '1px solid #e5e7eb'
                  }}
                >
                  {row[header.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      
      <VisuallyHidden>
        Table with {headers.length} columns and {data.length} rows
        {sortable && ', sortable by column headers'}
      </VisuallyHidden>
    </div>
  );
}

/**
 * Breadcrumb navigation with screen reader support
 */
export interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

export interface AccessibleBreadcrumbsProps {
  items: BreadcrumbItem[];
  separator?: string;
  className?: string;
}

export function AccessibleBreadcrumbs({
  items,
  separator = '/',
  className = ''
}: AccessibleBreadcrumbsProps) {
  return (
    <nav
      aria-label="Breadcrumb navigation"
      className={`accessible-breadcrumbs ${className}`}
    >
      <ol
        role="list"
        style={{
          display: 'flex',
          alignItems: 'center',
          margin: 0,
          padding: 0,
          listStyle: 'none'
        }}
      >
        {items.map((item, index) => (
          <li key={index} role="listitem" style={{ display: 'flex', alignItems: 'center' }}>
            {index > 0 && (
              <span
                aria-hidden="true"
                style={{ margin: '0 8px', color: '#6b7280' }}
              >
                {separator}
              </span>
            )}
            {item.current ? (
              <span
                aria-current="page"
                style={{ fontWeight: '600', color: '#374151' }}
              >
                {item.label}
              </span>
            ) : item.href ? (
              <a
                href={item.href}
                style={{
                  color: '#3b82f6',
                  textDecoration: 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                {item.label}
              </a>
            ) : (
              <span style={{ color: '#6b7280' }}>{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}