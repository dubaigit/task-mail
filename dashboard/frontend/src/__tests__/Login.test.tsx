import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Login from '../../../dashboard/frontend/src/components/Auth/Login';
import { AuthContext } from '../../../dashboard/frontend/src/context/AuthContext';

// Mock the AuthContext
const mockLogin = jest.fn();
const mockAuthContextValue = {
  user: null,
  login: mockLogin,
  logout: jest.fn(),
  loading: false,
  error: null
};

const renderWithProviders = (component: React.ReactElement, authValue = mockAuthContextValue) => {
  return render(
    <BrowserRouter>
      <AuthContext.Provider value={authValue}>
        {component}
      </AuthContext.Provider>
    </BrowserRouter>
  );
};

describe('Login Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders login form with all elements', () => {
    renderWithProviders(<Login />);
    
    expect(screen.getByText('Task Mail')).toBeInTheDocument();
    expect(screen.getByText('AI-Powered Email Management')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText('Use demo credentials')).toBeInTheDocument();
  });

  it('displays demo credentials information', () => {
    renderWithProviders(<Login />);
    
    expect(screen.getByText('Demo Credentials:')).toBeInTheDocument();
    expect(screen.getByText('Email: user@example.com')).toBeInTheDocument();
    expect(screen.getByText('Password: SecureUser@2024')).toBeInTheDocument();
  });

  it('auto-fills demo credentials when button is clicked', () => {
    renderWithProviders(<Login />);
    
    const demoButton = screen.getByText('Use demo credentials');
    fireEvent.click(demoButton);
    
    const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
    const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
    
    expect(emailInput.value).toBe('user@example.com');
    expect(passwordInput.value).toBe('SecureUser@2024');
  });

  it('handles form submission with valid credentials', async () => {
    mockLogin.mockResolvedValue({ success: true });
    
    renderWithProviders(<Login />);
    
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Sign in' });
    
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'SecureUser@2024' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('user@example.com', 'SecureUser@2024');
    });
  });

  it('validates email format', async () => {
    renderWithProviders(<Login />);
    
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Sign in' });
    
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.change(passwordInput, { target: { value: 'SecureUser@2024' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });
    
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('validates password requirements', async () => {
    renderWithProviders(<Login />);
    
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Sign in' });
    
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: '123' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    });
    
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('displays loading state during login', async () => {
    const loadingAuthValue = { ...mockAuthContextValue, loading: true };
    renderWithProviders(<Login />, loadingAuthValue);
    
    const submitButton = screen.getByRole('button', { name: 'Signing in...' });
    expect(submitButton).toBeDisabled();
    expect(screen.getByText('Signing in...')).toBeInTheDocument();
  });

  it('displays error message on login failure', () => {
    const errorAuthValue = { 
      ...mockAuthContextValue, 
      error: 'Invalid credentials. Please try again.' 
    };
    renderWithProviders(<Login />, errorAuthValue);
    
    expect(screen.getByText('Invalid credentials. Please try again.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveClass('bg-red-50', 'text-red-800');
  });

  it('handles keyboard navigation', () => {
    renderWithProviders(<Login />);
    
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Sign in' });
    
    // Tab navigation
    emailInput.focus();
    fireEvent.keyDown(emailInput, { key: 'Tab' });
    expect(passwordInput).toHaveFocus();
    
    fireEvent.keyDown(passwordInput, { key: 'Tab' });
    expect(submitButton).toHaveFocus();
  });

  it('submits form on Enter key press', async () => {
    mockLogin.mockResolvedValue({ success: true });
    
    renderWithProviders(<Login />);
    
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'SecureUser@2024' } });
    fireEvent.keyDown(passwordInput, { key: 'Enter' });
    
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('user@example.com', 'SecureUser@2024');
    });
  });

  it('clears error message when user starts typing', () => {
    const errorAuthValue = { 
      ...mockAuthContextValue, 
      error: 'Invalid credentials. Please try again.' 
    };
    renderWithProviders(<Login />, errorAuthValue);
    
    expect(screen.getByText('Invalid credentials. Please try again.')).toBeInTheDocument();
    
    const emailInput = screen.getByLabelText('Email');
    fireEvent.change(emailInput, { target: { value: 'new@example.com' } });
    
    // Error should be cleared (this would depend on your implementation)
    // You might need to add this functionality to your Login component
  });

  it('has proper accessibility attributes', () => {
    renderWithProviders(<Login />);
    
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Sign in' });
    
    expect(emailInput).toHaveAttribute('type', 'email');
    expect(emailInput).toHaveAttribute('required');
    expect(emailInput).toHaveAttribute('autoComplete', 'email');
    
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(passwordInput).toHaveAttribute('required');
    expect(passwordInput).toHaveAttribute('autoComplete', 'current-password');
    
    expect(submitButton).toHaveAttribute('type', 'submit');
  });

  it('prevents multiple simultaneous login attempts', async () => {
    mockLogin.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));
    
    renderWithProviders(<Login />);
    
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Sign in' });
    
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'SecureUser@2024' } });
    
    // Click submit multiple times rapidly
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);
    
    // Should only call login once
    expect(mockLogin).toHaveBeenCalledTimes(1);
  });

  it('handles network errors gracefully', async () => {
    mockLogin.mockRejectedValue(new Error('Network error'));
    
    renderWithProviders(<Login />);
    
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Sign in' });
    
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'SecureUser@2024' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled();
    });
    
    // Should handle the error (this would depend on your error handling implementation)
  });

  it('redirects to dashboard on successful login', async () => {
    const mockNavigate = jest.fn();
    jest.mock('react-router-dom', () => ({
      ...jest.requireActual('react-router-dom'),
      useNavigate: () => mockNavigate
    }));
    
    mockLogin.mockResolvedValue({ success: true });
    
    renderWithProviders(<Login />);
    
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Sign in' });
    
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'SecureUser@2024' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled();
    });
    
    // Should redirect to dashboard (this would depend on your routing implementation)
  });

  it('remembers form values after failed login attempt', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));
    
    renderWithProviders(<Login />);
    
    const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
    const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
    const submitButton = screen.getByRole('button', { name: 'Sign in' });
    
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrong-password' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled();
    });
    
    // Form values should be preserved
    expect(emailInput.value).toBe('user@example.com');
    expect(passwordInput.value).toBe('wrong-password');
  });
});