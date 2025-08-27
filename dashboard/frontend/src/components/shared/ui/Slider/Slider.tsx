import React, { forwardRef, useState, useRef, useEffect, useCallback } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

const sliderVariants = cva(
  'relative flex items-center select-none touch-none w-full',
  {
    variants: {
      size: {
        sm: 'h-4',
        md: 'h-5',
        lg: 'h-6',
      },
      orientation: {
        horizontal: 'w-full',
        vertical: 'h-full w-5 flex-col',
      },
    },
    defaultVariants: {
      size: 'md',
      orientation: 'horizontal',
    },
  }
);

const trackVariants = cva(
  'relative bg-gray-200 dark:bg-gray-700 rounded-full',
  {
    variants: {
      size: {
        sm: 'h-1',
        md: 'h-2',
        lg: 'h-3',
      },
      orientation: {
        horizontal: 'w-full',
        vertical: 'h-full w-2',
      },
    },
    defaultVariants: {
      size: 'md',
      orientation: 'horizontal',
    },
  }
);

const rangeVariants = cva(
  'absolute bg-blue-600 dark:bg-blue-500 rounded-full',
  {
    variants: {
      size: {
        sm: 'h-1',
        md: 'h-2',
        lg: 'h-3',
      },
      orientation: {
        horizontal: 'h-full',
        vertical: 'w-full',
      },
    },
    defaultVariants: {
      size: 'md',
      orientation: 'horizontal',
    },
  }
);

const thumbVariants = cva(
  'block bg-white border-2 border-blue-600 dark:border-blue-500 rounded-full shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      size: {
        sm: 'h-3 w-3',
        md: 'h-4 w-4',
        lg: 'h-5 w-5',
      },
      state: {
        default: 'hover:scale-110',
        dragging: 'scale-110',
        disabled: 'opacity-50 cursor-not-allowed',
      },
    },
    defaultVariants: {
      size: 'md',
      state: 'default',
    },
  }
);

export interface SliderProps extends 
  Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'>,
  VariantProps<typeof sliderVariants> {
  value?: number[];
  defaultValue?: number[];
  onValueChange?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  name?: string;
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  inverted?: boolean;
  showTooltip?: boolean;
  formatTooltip?: (value: number) => string;
}

export const Slider = forwardRef<HTMLDivElement, SliderProps>(
  ({
    className,
    size,
    orientation = 'horizontal',
    value,
    defaultValue = [0],
    onValueChange,
    min = 0,
    max = 100,
    step = 1,
    disabled = false,
    name,
    id,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    inverted = false,
    showTooltip = false,
    formatTooltip = (value) => value.toString(),
    ...props
  }, ref) => {
    const [internalValue, setInternalValue] = useState<number[]>(
      value || defaultValue
    );
    const [isDragging, setIsDragging] = useState<number>(-1);
    const [showTooltips, setShowTooltips] = useState<boolean[]>([]);
    const sliderRef = useRef<HTMLDivElement>(null);
    
    const currentValue = value || internalValue;
    const isVertical = orientation === 'vertical';

    // Update internal value when value prop changes
    useEffect(() => {
      if (value) {
        setInternalValue(value);
      }
    }, [value]);

    const getValueFromPointer = useCallback((event: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
      if (!sliderRef.current) return min;

      const rect = sliderRef.current.getBoundingClientRect();
      const clientX = 'clientX' in event ? event.clientX : event.touches[0].clientX;
      const clientY = 'clientY' in event ? event.clientY : event.touches[0].clientY;
      
      let percentage: number;
      
      if (isVertical) {
        const offsetY = clientY - rect.top;
        percentage = 1 - (offsetY / rect.height);
      } else {
        const offsetX = clientX - rect.left;
        percentage = offsetX / rect.width;
      }

      if (inverted) {
        percentage = 1 - percentage;
      }

      percentage = Math.max(0, Math.min(1, percentage));
      
      const range = max - min;
      const value = min + percentage * range;
      const steppedValue = Math.round(value / step) * step;
      
      return Math.max(min, Math.min(max, steppedValue));
    }, [min, max, step, isVertical, inverted]);

    const updateValue = useCallback((index: number, newValue: number) => {
      const newValues = [...currentValue];
      newValues[index] = newValue;
      
      // Ensure values are in order for range sliders
      if (newValues.length > 1) {
        newValues.sort((a, b) => a - b);
      }
      
      setInternalValue(newValues);
      onValueChange?.(newValues);
    }, [currentValue, onValueChange]);

    const handlePointerDown = useCallback((event: React.MouseEvent | React.TouchEvent, index: number) => {
      if (disabled) return;
      
      event.preventDefault();
      setIsDragging(index);
      
      const newShowTooltips = [...showTooltips];
      newShowTooltips[index] = true;
      setShowTooltips(newShowTooltips);

      const handlePointerMove = (moveEvent: MouseEvent | TouchEvent) => {
        const newValue = getValueFromPointer(moveEvent);
        updateValue(index, newValue);
      };

      const handlePointerUp = () => {
        setIsDragging(-1);
        const newShowTooltips = [...showTooltips];
        newShowTooltips[index] = false;
        setShowTooltips(newShowTooltips);
        
        document.removeEventListener('mousemove', handlePointerMove);
        document.removeEventListener('mouseup', handlePointerUp);
        document.removeEventListener('touchmove', handlePointerMove);
        document.removeEventListener('touchend', handlePointerUp);
      };

      document.addEventListener('mousemove', handlePointerMove);
      document.addEventListener('mouseup', handlePointerUp);
      document.addEventListener('touchmove', handlePointerMove);
      document.addEventListener('touchend', handlePointerUp);
    }, [disabled, getValueFromPointer, updateValue, showTooltips]);

    const handleKeyDown = useCallback((event: React.KeyboardEvent, index: number) => {
      if (disabled) return;

      let newValue = currentValue[index];
      const largeStep = step * 10;

      switch (event.key) {
        case 'ArrowUp':
        case 'ArrowRight':
          newValue = Math.min(max, newValue + step);
          break;
        case 'ArrowDown':
        case 'ArrowLeft':
          newValue = Math.max(min, newValue - step);
          break;
        case 'PageUp':
          newValue = Math.min(max, newValue + largeStep);
          break;
        case 'PageDown':
          newValue = Math.max(min, newValue - largeStep);
          break;
        case 'Home':
          newValue = min;
          break;
        case 'End':
          newValue = max;
          break;
        default:
          return;
      }

      event.preventDefault();
      updateValue(index, newValue);
    }, [disabled, currentValue, step, min, max, updateValue]);

    const getThumbPosition = (value: number) => {
      const percentage = (value - min) / (max - min);
      return inverted ? (1 - percentage) * 100 : percentage * 100;
    };

    const getRangePosition = () => {
      if (currentValue.length === 1) {
        const percentage = inverted ? 
          (1 - (currentValue[0] - min) / (max - min)) * 100 :
          (currentValue[0] - min) / (max - min) * 100;
        return {
          [isVertical ? 'bottom' : 'left']: inverted ? '0%' : '0%',
          [isVertical ? 'height' : 'width']: `${Math.abs(percentage)}%`,
        };
      } else {
        const startValue = Math.min(...currentValue);
        const endValue = Math.max(...currentValue);
        const startPercentage = (startValue - min) / (max - min) * 100;
        const endPercentage = (endValue - min) / (max - min) * 100;
        
        return {
          [isVertical ? 'bottom' : 'left']: `${startPercentage}%`,
          [isVertical ? 'height' : 'width']: `${endPercentage - startPercentage}%`,
        };
      }
    };

    return (
      <div
        ref={ref}
        className={cn(sliderVariants({ size, orientation }), className)}
        {...props}
      >
        <div
          ref={sliderRef}
          className={cn(trackVariants({ size, orientation }))}
          onClick={(event) => {
            if (disabled) return;
            const newValue = getValueFromPointer(event);
            // For single thumb, always update index 0
            // For multi-thumb, find closest thumb
            let closestIndex = 0;
            if (currentValue.length > 1) {
              let minDistance = Math.abs(currentValue[0] - newValue);
              currentValue.forEach((val, index) => {
                const distance = Math.abs(val - newValue);
                if (distance < minDistance) {
                  minDistance = distance;
                  closestIndex = index;
                }
              });
            }
            updateValue(closestIndex, newValue);
          }}
        >
          {/* Range indicator */}
          <div
            className={cn(rangeVariants({ size, orientation }))}
            style={getRangePosition()}
          />
          
          {/* Thumbs */}
          {currentValue.map((val, index) => (
            <div
              key={index}
              className="absolute"
              style={{
                [isVertical ? 'bottom' : 'left']: `${getThumbPosition(val)}%`,
                [isVertical ? 'left' : 'top']: '50%',
                transform: isVertical 
                  ? 'translate(-50%, 50%)'
                  : 'translate(-50%, -50%)',
              }}
            >
              {/* Tooltip */}
              {showTooltip && (showTooltips[index] || isDragging === index) && (
                <div
                  className={cn(
                    'absolute px-2 py-1 text-xs text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded pointer-events-none whitespace-nowrap',
                    isVertical 
                      ? '-left-8 top-1/2 -translate-y-1/2' 
                      : '-top-8 left-1/2 -translate-x-1/2'
                  )}
                >
                  {formatTooltip(val)}
                  {/* Arrow */}
                  <div
                    className={cn(
                      'absolute w-1 h-1 bg-gray-900 dark:bg-gray-100 rotate-45',
                      isVertical
                        ? 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2'
                        : 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2'
                    )}
                  />
                </div>
              )}
              
              {/* Thumb */}
              <div
                className={cn(
                  thumbVariants({ 
                    size, 
                    state: disabled ? 'disabled' : isDragging === index ? 'dragging' : 'default'
                  })
                )}
                tabIndex={disabled ? -1 : 0}
                role="slider"
                aria-valuemin={min}
                aria-valuemax={max}
                aria-valuenow={val}
                aria-valuetext={formatTooltip(val)}
                aria-label={ariaLabel || `Slider thumb ${index + 1}`}
                aria-labelledby={ariaLabelledBy}
                aria-orientation={orientation || undefined}
                aria-disabled={disabled}
                onMouseDown={(event) => handlePointerDown(event, index)}
                onTouchStart={(event) => handlePointerDown(event, index)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                onFocus={() => {
                  if (showTooltip) {
                    const newShowTooltips = [...showTooltips];
                    newShowTooltips[index] = true;
                    setShowTooltips(newShowTooltips);
                  }
                }}
                onBlur={() => {
                  const newShowTooltips = [...showTooltips];
                  newShowTooltips[index] = false;
                  setShowTooltips(newShowTooltips);
                }}
              />
              
              {/* Hidden input for form submission */}
              {name && (
                <input
                  type="hidden"
                  name={currentValue.length === 1 ? name : `${name}[${index}]`}
                  value={val}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }
);

Slider.displayName = 'Slider';

// Range Slider Component
export interface RangeSliderProps extends Omit<SliderProps, 'defaultValue' | 'value'> {
  defaultValue?: [number, number];
  value?: [number, number];
}

export const RangeSlider = forwardRef<HTMLDivElement, RangeSliderProps>(
  ({ defaultValue = [0, 100], value, ...props }, ref) => {
    return (
      <Slider
        ref={ref}
        defaultValue={defaultValue}
        value={value}
        {...props}
      />
    );
  }
);

RangeSlider.displayName = 'RangeSlider';

// Vertical Slider Component
export interface VerticalSliderProps extends Omit<SliderProps, 'orientation'> {}

export const VerticalSlider = forwardRef<HTMLDivElement, VerticalSliderProps>(
  (props, ref) => {
    return (
      <Slider
        ref={ref}
        orientation="vertical"
        {...props}
      />
    );
  }
);

VerticalSlider.displayName = 'VerticalSlider';

export default Slider;