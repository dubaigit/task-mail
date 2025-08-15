import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react';

interface DateRange {
  start: Date | null;
  end: Date | null;
}

interface Preset {
  label: string;
  getValue: () => DateRange;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  placeholder?: string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  placeholder = "Select date range",
  disabled = false,
  minDate,
  maxDate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const presets: Preset[] = [
    {
      label: "Today",
      getValue: () => ({
        start: new Date(),
        end: new Date(),
      }),
    },
    {
      label: "Yesterday",
      getValue: () => {
        const date = new Date();
        date.setDate(date.getDate() - 1);
        return { start: date, end: date };
      },
    },
    {
      label: "Last 7 days",
      getValue: () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 6);
        return { start, end };
      },
    },
    {
      label: "Last 30 days",
      getValue: () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 29);
        return { start, end };
      },
    },
    {
      label: "This month",
      getValue: () => {
        const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const end = new Date();
        return { start, end };
      },
    },
    {
      label: "Last month",
      getValue: () => {
        const start = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
        const end = new Date(new Date().getFullYear(), new Date().getMonth(), 0);
        return { start, end };
      },
    },
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDate = (date: Date | null): string => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDisplayValue = (): string => {
    if (!value.start && !value.end) return placeholder;
    if (value.start && !value.end) return `${formatDate(value.start)} - ...`;
    if (!value.start && value.end) return `... - ${formatDate(value.end)}`;
    return `${formatDate(value.start)} - ${formatDate(value.end)}`;
  };

  const isDateInRange = (date: Date): boolean => {
    if (!value.start || !value.end) return false;
    return date >= value.start && date <= value.end;
  };

  const isDateDisabled = (date: Date): boolean => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  const handleDateClick = (date: Date) => {
    if (isDateDisabled(date)) return;

    if (!value.start || (value.start && value.end)) {
      onChange({ start: date, end: null });
    } else {
      if (date < value.start) {
        onChange({ start: date, end: value.start });
      } else {
        onChange({ start: value.start, end: date });
      }
    }
  };

  const handlePresetClick = (preset: Preset) => {
    const range = preset.getValue();
    onChange(range);
    setIsOpen(false);
  };

  const clearRange = () => {
    onChange({ start: null, end: null });
    setIsOpen(false);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    const currentDate = new Date(startDate);

    while (currentDate <= lastDay || currentDate.getDay() !== 0) {
      const date = new Date(currentDate);
      const isCurrentMonth = date.getMonth() === month;
      const isSelected = value.start && date.toDateString() === value.start.toDateString();
      const isEndSelected = value.end && date.toDateString() === value.end.toDateString();
      const isInRange = isDateInRange(date) && isCurrentMonth;
      const isDisabled = isDateDisabled(date);
      const isHovered = hoveredDate && date.toDateString() === hoveredDate.toDateString();

      let cellClassName = 'calendar-cell';
      if (!isCurrentMonth) cellClassName += ' other-month';
      if (isSelected) cellClassName += ' selected-start';
      if (isEndSelected) cellClassName += ' selected-end';
      if (isInRange) cellClassName += ' in-range';
      if (isDisabled) cellClassName += ' disabled';
      if (isHovered && !isSelected && !isEndSelected && value.start && !value.end) {
        cellClassName += ' hovered';
      }

      days.push(
        <div
          key={date.toISOString()}
          className={cellClassName}
          onClick={() => handleDateClick(date)}
          onMouseEnter={() => setHoveredDate(date)}
          onMouseLeave={() => setHoveredDate(null)}
        >
          {date.getDate()}
        </div>
      );

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return days;
  };

  return (
    <div className="date-range-picker" ref={containerRef}>
      <button
        type="button"
        className={`date-range-input ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <Calendar className="calendar-icon" size={16} />
        <span className="date-range-text">{formatDisplayValue()}</span>
        {value.start && value.end && (
          <button
            type="button"
            className="clear-button"
            onClick={(e) => {
              e.stopPropagation();
              clearRange();
            }}
          >
            <X size={14} />
          </button>
        )}
      </button>

      {isOpen && (
        <div className="date-range-dropdown">
          <div className="date-range-content">
            <div className="calendar-section">
              <div className="calendar-header">
                <button
                  type="button"
                  className="nav-button"
                  onClick={() => navigateMonth('prev')}
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="month-year">
                  {currentMonth.toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </div>
                <button
                  type="button"
                  className="nav-button"
                  onClick={() => navigateMonth('next')}
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="weekday-headers">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="weekday-header">
                    {day}
                  </div>
                ))}
              </div>

              <div className="calendar-grid">
                {renderCalendar()}
              </div>
            </div>

            <div className="presets-section">
              <div className="presets-header">Quick Select</div>
              <div className="presets-list">
                {presets.map(preset => (
                  <button
                    key={preset.label}
                    type="button"
                    className="preset-button"
                    onClick={() => handlePresetClick(preset)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .date-range-picker {
          position: relative;
          display: inline-block;
          width: 100%;
          max-width: 300px;
        }

        .date-range-input {
          display: flex;
          align-items: center;
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          background: white;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
        }

        .date-range-input:hover:not(.disabled) {
          border-color: #3b82f6;
        }

        .date-range-input.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .calendar-icon {
          margin-right: 8px;
          color: #6b7280;
        }

        .date-range-text {
          flex: 1;
          text-align: left;
          color: #374151;
        }

        .clear-button {
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px;
          color: #6b7280;
          transition: color 0.2s;
        }

        .clear-button:hover {
          color: #ef4444;
        }

        .date-range-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          margin-top: 4px;
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
          z-index: 50;
          max-width: 600px;
        }

        .date-range-content {
          display: flex;
          min-width: 600px;
        }

        .calendar-section {
          flex: 1;
          padding: 16px;
          border-right: 1px solid #e5e7eb;
        }

        .calendar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .nav-button {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          color: #6b7280;
          transition: color 0.2s;
        }

        .nav-button:hover {
          color: #374151;
        }

        .month-year {
          font-weight: 600;
          color: #374151;
          font-size: 14px;
        }

        .weekday-headers {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 2px;
          margin-bottom: 8px;
        }

        .weekday-header {
          text-align: center;
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          padding: 4px;
        }

        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 2px;
        }

        .calendar-cell {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
          position: relative;
        }

        .calendar-cell:not(.other-month):not(.disabled):hover {
          background: #f3f4f6;
        }

        .calendar-cell.other-month {
          color: #d1d5db;
          cursor: default;
        }

        .calendar-cell.disabled {
          color: #d1d5db;
          cursor: not-allowed;
          opacity: 0.5;
        }

        .calendar-cell.selected-start {
          background: #3b82f6;
          color: white;
        }

        .calendar-cell.selected-end {
          background: #3b82f6;
          color: white;
        }

        .calendar-cell.in-range {
          background: #dbeafe;
          color: #1e40af;
        }

        .calendar-cell.hovered {
          background: #bfdbfe;
        }

        .presets-section {
          width: 160px;
          padding: 16px;
          background: #f9fafb;
        }

        .presets-header {
          font-size: 14px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 12px;
        }

        .presets-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .preset-button {
          width: 100%;
          padding: 6px 12px;
          text-align: left;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 13px;
          color: #374151;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .preset-button:hover {
          background: #e5e7eb;
        }
      `}</style>
    </div>
  );
};

export default DateRangePicker;