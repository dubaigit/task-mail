# DateRangePicker Component

A professional, feature-rich date range picker component with calendar view, presets, and navigation arrows for React applications.

## Features

- 📅 **Calendar View**: Interactive calendar with month navigation
- 🎯 **Date Range Selection**: Select start and end dates with visual feedback
- ⚡ **Quick Presets**: Common date ranges (Today, Yesterday, Last 7 days, etc.)
- 🎨 **Professional Design**: Clean, modern UI with smooth animations
- 📱 **Responsive**: Works on desktop and mobile devices
- ♿ **Accessible**: Keyboard navigation and screen reader support
- 🎛️ **Customizable**: Configurable min/max dates and placeholder text

## Installation

```bash
# Copy the component files to your project
cp -r DateRangePicker/ /path/to/your/components/
```

## Usage

### Basic Usage

```tsx
import React, { useState } from 'react';
import DateRangePicker from './DateRangePicker';

interface DateRange {
  start: Date | null;
  end: Date | null;
}

function MyComponent() {
  const [dateRange, setDateRange] = useState<DateRange>({
    start: null,
    end: null,
  });

  return (
    <DateRangePicker
      value={dateRange}
      onChange={setDateRange}
      placeholder="Select date range"
    />
  );
}
```

### Advanced Usage

```tsx
<DateRangePicker
  value={dateRange}
  onChange={setDateRange}
  placeholder="Select your date range"
  disabled={false}
  minDate={new Date('2024-01-01')}
  maxDate={new Date('2024-12-31')}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `DateRange` | Required | Current date range value |
| `onChange` | `(range: DateRange) => void` | Required | Callback fired when date range changes |
| `placeholder` | `string` | `"Select date range"` | Placeholder text for the input |
| `disabled` | `boolean` | `false` | Whether the picker is disabled |
| `minDate` | `Date` | `undefined` | Minimum selectable date |
| `maxDate` | `Date` | `undefined` | Maximum selectable date |

## Types

```tsx
interface DateRange {
  start: Date | null;
  end: Date | null;
}

interface Preset {
  label: string;
  getValue: () => DateRange;
}
```

## Presets

The component includes the following quick select presets:

- **Today**: Current date
- **Yesterday**: Previous day
- **Last 7 days**: Last 7 days including today
- **Last 30 days**: Last 30 days including today
- **This month**: From the 1st of current month to today
- **Last month**: Full previous month

## Styling

The component uses CSS-in-JS for styling. You can customize the appearance by:

1. **CSS Variables**: Override CSS custom properties
2. **Class Names**: Target specific class names for customization
3. **CSS Modules**: Replace the styling section with your own CSS

### CSS Custom Properties

```css
:root {
  --date-range-primary: #3b82f6;
  --date-range-hover: #f3f4f6;
  --date-range-border: #d1d5db;
  --date-range-text: #374151;
}
```

## Examples

### With Min/Max Dates

```tsx
<DateRangePicker
  value={dateRange}
  onChange={setDateRange}
  minDate={new Date('2024-01-01')}
  maxDate={new Date('2024-12-31')}
/>
```

### Disabled State

```tsx
<DateRangePicker
  value={dateRange}
  onChange={setDateRange}
  disabled={true}
/>
```

### Custom Placeholder

```tsx
<DateRangePicker
  value={dateRange}
  onChange={setDateRange}
  placeholder="Choose your travel dates"
/>
```

## File Structure

```
DateRangePicker/
├── DateRangePicker.tsx          # Main component
├── DateRangePicker.module.css   # CSS styles
├── index.ts                   # Export file
├── DateRangePickerExample.tsx # Usage examples
└── README.md                  # This file
```

## Development

### Running Examples

```bash
# Start the development server
npm run dev

# View examples at
# http://localhost:3000/date-range-picker-examples
```

### Testing

```bash
# Run tests
npm test DateRangePicker

# Run tests in watch mode
npm run test:watch DateRangePicker
```

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Dependencies

- React 16.8+ (hooks support)
- Lucide React (icons)

## License

MIT License - feel free to use in your projects.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Changelog

### v1.0.0
- Initial release
- Calendar view with month navigation
- Date range selection
- Quick presets
- Professional styling
- Responsive design