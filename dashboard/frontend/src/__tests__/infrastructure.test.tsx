/**
 * Infrastructure validation tests
 * Simple tests to verify testing setup is working correctly
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { mockEmail, mockTask } from './test-fixtures';

// Simple component to test the infrastructure
const TestComponent: React.FC<{ title: string }> = ({ title }) => (
  <div data-testid="test-component">
    <h1>{title}</h1>
    <p>Testing infrastructure is working!</p>
  </div>
);

describe('Testing Infrastructure Validation', () => {
  test('should render test component correctly', () => {
    render(<TestComponent title="Test Title" />);
    
    expect(screen.getByTestId('test-component')).toBeInTheDocument();
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Testing infrastructure is working!')).toBeInTheDocument();
  });

  test('should have working test fixtures', () => {
    expect(mockEmail).toBeDefined();
    expect(mockEmail.id).toBe('test-email-001');
    expect(mockEmail.subject).toBe('Test Email Subject');
    
    expect(mockTask).toBeDefined();
    expect(mockTask.id).toBe('task-001');
    expect(mockTask.title).toBe('Review quarterly report');
  });

  test('should have Jest matchers working', () => {
    const testArray = [1, 2, 3, 4, 5];
    const testObject = { name: 'test', value: 42 };
    
    expect(testArray).toHaveLength(5);
    expect(testArray).toContain(3);
    expect(testObject).toHaveProperty('name', 'test');
    expect(testObject).toMatchObject({ name: 'test' });
  });

  test('should handle async operations', async () => {
    const asyncOperation = () => 
      new Promise(resolve => setTimeout(() => resolve('completed'), 100));
    
    const result = await asyncOperation();
    expect(result).toBe('completed');
  });

  test('should support mocking', () => {
    const mockFunction = jest.fn();
    mockFunction('test-arg');
    
    expect(mockFunction).toHaveBeenCalledWith('test-arg');
    expect(mockFunction).toHaveBeenCalledTimes(1);
  });
});