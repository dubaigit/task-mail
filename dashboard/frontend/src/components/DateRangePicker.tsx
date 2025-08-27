import React, { useState, useRef, useEffect } from 'react';
import { Icons } from './ui/icons';

export interface DateRange {
  start: Date;
  end: Date;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  presets?: Array<{
    label: string;
    value: string;
    getDates: () => DateRange;
  }>;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  maxDate?: Date;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  presets = defaultPresets,
  className = '',
  disabled = false,
  placeholder: _placeholder = 'Select date range',
  maxDate: _maxDate
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempRange, setTempRange] = useState<DateRange>(value);
  const [activeView, setActiveView] = useState<'presets' | 'custom'>('presets');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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

  useEffect(() => {
    setTempRange(value);
  }, [value]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handlePresetSelect = (preset: typeof presets[0]) => {
    const newRange = preset.getDates();
    onChange(newRange);
    setIsOpen(false);
  };

  const handleCustomDateChange = (type: 'start' | 'end', dateStr: string) => {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const newRange = { ...tempRange };
      newRange[type] = date;
      
      // Ensure start is before end
      if (type === 'start' && date > tempRange.end) {
        newRange.end = date;
      } else if (type === 'end' && date < tempRange.start) {
        newRange.start = date;
      }
      
      setTempRange(newRange);
    }
  };

  const applyCustomRange = () => {
    onChange(tempRange);
    setIsOpen(false);
  };

  const getDisplayText = () => {
    // Check if current range matches any preset
    for (const preset of presets) {
      const presetRange = preset.getDates();
      if (
        Math.abs(presetRange.start.getTime() - value.start.getTime()) < 86400000 && // Within 1 day
        Math.abs(presetRange.end.getTime() - value.end.getTime()) < 86400000
      ) {
        return preset.label;
      }
    }
    
    // Return custom range format
    return `${formatDate(value.start)} - ${formatDate(value.end)}`;
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Icons.calendarDays className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium">{getDisplayText()}</span>
        <Icons.chevronLeft className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-90' : '-rotate-90'}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Tab Header */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveView('presets')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                activeView === 'presets'
                  ? 'bg-primary/10 text-primary border-b-2 border-primary'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              Quick Ranges
            </button>
            <button
              onClick={() => setActiveView('custom')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                activeView === 'custom'
                  ? 'bg-primary/10 text-primary border-b-2 border-primary'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              Custom Range
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            {activeView === 'presets' ? (
              <div className="space-y-1">
                {presets.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => handlePresetSelect(preset)}
                    className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={tempRange.start.toISOString().split('T')[0]}
                    onChange={(e) => handleCustomDateChange('start', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={tempRange.end.toISOString().split('T')[0]}
                    onChange={(e) => handleCustomDateChange('end', e.target.value)}
                    min={tempRange.start.toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={applyCustomRange}
                    className="flex-1 px-3 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Default preset ranges
const defaultPresets = [
  {
    label: 'Today',
    value: 'today',
    getDates: () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      return { start: today, end };
    }
  },
  {
    label: 'Yesterday',
    value: 'yesterday',
    getDates: () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const end = new Date(yesterday);
      end.setHours(23, 59, 59, 999);
      return { start: yesterday, end };
    }
  },
  {
    label: 'Last 7 Days',
    value: '7d',
    getDates: () => {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
  },
  {
    label: 'Last 30 Days',
    value: '30d',
    getDates: () => {
      const start = new Date();
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
  },
  {
    label: 'Last 90 Days',
    value: '90d',
    getDates: () => {
      const start = new Date();
      start.setDate(start.getDate() - 90);
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
  },
  {
    label: 'This Month',
    value: 'this_month',
    getDates: () => {
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
  },
  {
    label: 'Last Month',
    value: 'last_month',
    getDates: () => {
      const start = new Date();
      start.setMonth(start.getMonth() - 1);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setDate(0); // Last day of previous month
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
  },
  {
    label: 'This Year',
    value: 'this_year',
    getDates: () => {
      const start = new Date();
      start.setMonth(0);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
  }
];