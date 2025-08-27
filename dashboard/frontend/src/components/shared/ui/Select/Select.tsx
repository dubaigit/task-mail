import React, { useState, useRef, useEffect } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

const selectTriggerVariants = cva(
  'flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-gray-200 focus:ring-blue-500',
        error: 'border-red-500 focus:ring-red-500',
        success: 'border-green-500 focus:ring-green-500',
      },
      size: {
        sm: 'h-8 px-2 text-xs',
        default: 'h-9 px-3',
        lg: 'h-11 px-4 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  description?: string;
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'>,
    VariantProps<typeof selectTriggerVariants> {
  options: SelectOption[];
  placeholder?: string;
  onValueChange?: (value: string) => void;
  searchable?: boolean;
  clearable?: boolean;
  loading?: boolean;
  error?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ 
    className, 
    variant, 
    size, 
    options, 
    placeholder = 'Select an option...',
    onValueChange,
    searchable = false,
    clearable = false,
    loading = false,
    error = false,
    value,
    onChange,
    disabled,
    ...props 
  }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedValue, setSelectedValue] = useState(value || '');
    const triggerRef = useRef<HTMLButtonElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    const filteredOptions = searchable
      ? options.filter(option => 
          option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
          option.value.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : options;

    const selectedOption = options.find(option => option.value === selectedValue);

    const handleSelect = (optionValue: string) => {
      setSelectedValue(optionValue);
      onValueChange?.(optionValue);
      onChange?.({ target: { value: optionValue } } as any);
      setIsOpen(false);
      setSearchTerm('');
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedValue('');
      onValueChange?.('');
      onChange?.({ target: { value: '' } } as any);
      setSearchTerm('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          setIsOpen(!isOpen);
          break;
        case 'Escape':
          setIsOpen(false);
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (!isOpen) setIsOpen(true);
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (!isOpen) setIsOpen(true);
          break;
      }
    };

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
      <div className="relative w-full">
        {/* Hidden select for form submission */}
        <select
          ref={ref}
          value={selectedValue}
          onChange={onChange}
          className="sr-only"
          tabIndex={-1}
          {...props}
        >
          <option value="">{placeholder}</option>
          {options.map(option => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>

        {/* Custom trigger */}
        <button
          ref={triggerRef}
          type="button"
          className={cn(
            selectTriggerVariants({ variant: error ? 'error' : variant, size }),
            className
          )}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          disabled={disabled || loading}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className={cn('block truncate', !selectedOption && 'text-gray-500')}>
            {selectedOption?.label || placeholder}
          </span>
          
          <div className="flex items-center space-x-1">
            {clearable && selectedValue && (
              <button
                type="button"
                onClick={handleClear}
                className="p-0.5 hover:bg-gray-100 rounded"
                tabIndex={-1}
              >
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
            
            {loading ? (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </div>
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
            {searchable && (
              <div className="p-2 border-b border-gray-100">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}
            
            <ul
              ref={listRef}
              className="max-h-60 overflow-auto py-1"
              role="listbox"
            >
              {filteredOptions.length === 0 ? (
                <li className="px-3 py-2 text-sm text-gray-500">
                  No options found
                </li>
              ) : (
                filteredOptions.map((option) => (
                  <li key={option.value}>
                    <button
                      type="button"
                      className={cn(
                        'w-full text-left px-3 py-2 text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none',
                        selectedValue === option.value && 'bg-blue-50 text-blue-700',
                        option.disabled && 'opacity-50 cursor-not-allowed'
                      )}
                      onClick={() => !option.disabled && handleSelect(option.value)}
                      disabled={option.disabled}
                      role="option"
                      aria-selected={selectedValue === option.value}
                    >
                      <div>
                        <div className="font-medium">{option.label}</div>
                        {option.description && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {option.description}
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

// Simple native select component
export interface NativeSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'>,
    VariantProps<typeof selectTriggerVariants> {
  options: SelectOption[];
  placeholder?: string;
  error?: boolean;
}

export const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, variant, size, options, placeholder, error, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          selectTriggerVariants({ variant: error ? 'error' : variant, size }),
          'appearance-none bg-[url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")] bg-[length:1.5em_1.5em] bg-[right_0.5rem_center] bg-no-repeat pr-8',
          className
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map(option => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
);

NativeSelect.displayName = 'NativeSelect';

export default Select;