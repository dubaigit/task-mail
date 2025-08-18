import React, { useState, useRef, useEffect } from 'react';
import styles from './DateRangePicker.module.css';

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

interface DateRangePickerProps {
  onDateRangeChange?: (range: DateRange) => void;
  onChange?: (range: DateRange) => void;
  initialRange?: DateRange;
  value?: DateRange;
  minDate?: Date;
  maxDate?: Date;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  onDateRangeChange,
  onChange,
  initialRange,
  value,
  minDate,
  maxDate,
  placeholder = "Select date range",
  disabled = false,
  className,
}) => {
  // Support both prop names for backward compatibility
  const handleDateRangeChange = onDateRangeChange || onChange || (() => {});
  const initialDateRange = value || initialRange || { start: null, end: null };
  const [isOpen, setIsOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>(initialDateRange);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const formatDate = (date: Date | null): string => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDisplayText = (): string => {
    if (!dateRange.start && !dateRange.end) return placeholder;
    if (dateRange.start && !dateRange.end) return `${formatDate(dateRange.start)} - End`;
    if (!dateRange.start && dateRange.end) return `Start - ${formatDate(dateRange.end)}`;
    return `${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`;
  };

  const isDateInRange = (date: Date): boolean => {
    if (!dateRange.start || !dateRange.end) return false;
    return date >= dateRange.start && date <= dateRange.end;
  };

  const isDateDisabled = (date: Date): boolean => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  const handleDateClick = (date: Date) => {
    if (isDateDisabled(date)) return;

    if (!dateRange.start || (dateRange.start && dateRange.end)) {
      setDateRange({ start: date, end: null });
    } else {
      if (date < dateRange.start) {
        setDateRange({ start: date, end: dateRange.start });
      } else {
        setDateRange({ start: dateRange.start, end: date });
      }
    }
  };

  const handleApply = () => {
    handleDateRangeChange(dateRange);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setDateRange(initialDateRange);
    setIsOpen(false);
  };

  const handleClear = () => {
    const emptyRange: DateRange = { start: null, end: null };
    setDateRange(emptyRange);
    handleDateRangeChange(emptyRange);
    setIsOpen(false);
  };

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    const day = new Date(startDate);

    for (let i = 0; i < 42; i++) {
      const isCurrentMonth = day.getMonth() === month;
      const isSelected = dateRange.start && day.getTime() === dateRange.start.getTime();
      const isEndSelected = dateRange.end && day.getTime() === dateRange.end.getTime();
      const isInRange = isDateInRange(day);
      const isDisabled = isDateDisabled(day);
      const isHovered = hoveredDate && day.getTime() === hoveredDate.getTime();

      days.push(
        <button
          key={day.getTime()}
          className={`${styles.calendarCell || 'calendar-day'} ${
            !isCurrentMonth ? (styles.otherMonth || 'other-month') : ''
          } ${isSelected ? (styles.selectedStart || 'selected-start') : ''} ${
            isEndSelected ? (styles.selectedEnd || 'selected-end') : ''
          } ${isInRange ? (styles.inRange || 'in-range') : ''} ${
            isDisabled ? (styles.disabled || 'disabled') : ''
          } ${isHovered ? (styles.hovered || 'hovered') : ''}`}
          onClick={() => handleDateClick(new Date(day))}
          onMouseEnter={() => setHoveredDate(new Date(day))}
          onMouseLeave={() => setHoveredDate(null)}
          disabled={isDisabled}
        >
          {day.getDate()}
        </button>
      );

      day.setDate(day.getDate() + 1);
    }

    return days;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + (direction === 'prev' ? -1 : 1));
    setCurrentMonth(newMonth);
  };

  return (
    <div className={`${styles.dateRangePicker || 'date-range-picker'} ${className || ''}`} ref={pickerRef}>
      <button
        className={`${styles.dateRangeInput || 'date-range-input'} ${isOpen ? 'open' : ''} ${disabled ? (styles.disabled || 'disabled') : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <span className={styles.dateRangeText || 'date-range-text'}>{getDisplayText()}</span>
        <span className="date-range-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className={styles.dateRangeDropdown || 'date-range-dropdown'}>
          <div className="calendar-container">
            <div className={styles.calendarHeader || 'calendar-header'}>
              <button
                className={styles.navButton || 'nav-button'}
                onClick={() => navigateMonth('prev')}
                disabled={minDate && currentMonth <= minDate}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <h3 className={styles.monthYear || 'month-year'}>
                {currentMonth.toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              </h3>
              <button
                className={styles.navButton || 'nav-button'}
                onClick={() => navigateMonth('next')}
                disabled={maxDate && currentMonth >= maxDate}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>

            <div className={styles.weekdayHeaders || 'weekday-headers'}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                <div key={day} className={styles.weekdayHeader || 'weekday-header'}>
                  {day}
                </div>
              ))}
            </div>

            <div className={styles.calendarGrid || 'calendar-grid'}>{renderCalendar()}</div>
          </div>

          <div className="date-range-actions">
            <button className="action-button secondary" onClick={handleClear}>
              Clear
            </button>
            <button className="action-button secondary" onClick={handleCancel}>
              Cancel
            </button>
            <button className="action-button primary" onClick={handleApply}>
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;