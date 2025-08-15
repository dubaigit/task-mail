import React, { useState } from 'react';
import DateRangePicker from './DateRangePicker';

interface DateRange {
  start: Date | null;
  end: Date | null;
}

const DateRangePickerExample: React.FC = () => {
  const [dateRange, setDateRange] = useState<DateRange>({
    start: null,
    end: null,
  });

  const [dateRange2, setDateRange2] = useState<DateRange>({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    end: new Date(),
  });

  const [dateRange3, setDateRange3] = useState<DateRange>({
    start: new Date(2024, 0, 1),
    end: new Date(2024, 11, 31),
  });

  return (
    <div style={{ padding: '40px', fontFamily: 'Arial, sans-serif' }}>
      <h1>DateRangePicker Component Examples</h1>
      
      <div style={{ marginBottom: '40px' }}>
        <h3>Basic Usage</h3>
        <p>Empty state with placeholder text:</p>
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
          placeholder="Select your date range"
        />
        <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
          Selected: {dateRange.start ? dateRange.start.toLocaleDateString() : 'None'} - {dateRange.end ? dateRange.end.toLocaleDateString() : 'None'}
        </div>
      </div>

      <div style={{ marginBottom: '40px' }}>
        <h3>Pre-filled Range</h3>
        <p>Last 7 days pre-selected:</p>
        <DateRangePicker
          value={dateRange2}
          onChange={setDateRange2}
          placeholder="Select date range"
        />
        <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
          Selected: {dateRange2.start.toLocaleDateString()} - {dateRange2.end.toLocaleDateString()}
        </div>
      </div>

      <div style={{ marginBottom: '40px' }}>
        <h3>With Min/Max Date Constraints</h3>
        <p>Limited to 2024 only:</p>
        <DateRangePicker
          value={dateRange3}
          onChange={setDateRange3}
          minDate={new Date(2024, 0, 1)}
          maxDate={new Date(2024, 11, 31)}
          placeholder="Select within 2024"
        />
        <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
          Selected: {dateRange3.start.toLocaleDateString()} - {dateRange3.end.toLocaleDateString()}
        </div>
      </div>

      <div style={{ marginBottom: '40px' }}>
        <h3>Disabled State</h3>
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
          disabled={true}
          placeholder="Disabled date picker"
        />
      </div>

      <div style={{ marginTop: '40px', padding: '20px', background: '#f5f5f5', borderRadius: '8px' }}>
        <h4>Usage Instructions:</h4>
        <ul>
          <li>Click the input field to open the calendar dropdown</li>
          <li>Select a start date, then select an end date to create a range</li>
          <li>Use the arrow buttons to navigate between months</li>
          <li>Click on preset options for quick date range selection</li>
          <li>Click the X button to clear the selected range</li>
          <li>Click outside the dropdown to close it</li>
        </ul>
      </div>
    </div>
  );
};

export default DateRangePickerExample;