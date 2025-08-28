import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'success' | 'warning' | 'error';
  duration?: number;
  action?: React.ReactNode;
}

interface ToastState {
  toasts: Toast[];
}

type ToastAction = 
  | { type: 'ADD_TOAST'; toast: Toast }
  | { type: 'REMOVE_TOAST'; id: string }
  | { type: 'CLEAR_TOASTS' };

const toastReducer = (state: ToastState, action: ToastAction): ToastState => {
  switch (action.type) {
    case 'ADD_TOAST':
      return { toasts: [...state.toasts, action.toast] };
    case 'REMOVE_TOAST':
      return { toasts: state.toasts.filter(t => t.id !== action.id) };
    case 'CLEAR_TOASTS':
      return { toasts: [] };
    default:
      return state;
  }
};

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(toastReducer, { toasts: [] });

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { ...toast, id };
    dispatch({ type: 'ADD_TOAST', toast: newToast });

    if (toast.duration !== 0) {
      setTimeout(() => {
        dispatch({ type: 'REMOVE_TOAST', id });
      }, toast.duration || 5000);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_TOAST', id });
  }, []);

  const clearToasts = useCallback(() => {
    dispatch({ type: 'CLEAR_TOASTS' });
  }, []);

  return (
    <ToastContext.Provider value={{ toasts: state.toasts, addToast, removeToast, clearToasts }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
};

const ToastContainer: React.FC = () => {
  const { toasts } = useToast();
  const [container, setContainer] = React.useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const div = document.createElement('div');
    div.id = 'toast-container';
    div.style.cssText = `
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 9999;
      pointer-events: none;
    `;
    document.body.appendChild(div);
    setContainer(div);

    return () => {
      document.body.removeChild(div);
    };
  }, []);

  if (!container) return null;

  return createPortal(
    <div className="space-y-2">
      {toasts.map(toast => (
        <ToastComponent key={toast.id} toast={toast} />
      ))}
    </div>,
    container
  );
};

interface ToastComponentProps {
  toast: Toast;
}

const ToastComponent: React.FC<ToastComponentProps> = ({ toast }) => {
  const { removeToast } = useToast();

  const variantStyles = {
    default: 'bg-white border-gray-200 text-gray-900',
    success: 'bg-green-50 border-green-200 text-green-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    error: 'bg-red-50 border-red-200 text-red-800',
  };

  const iconStyles = {
    default: '🔔',
    success: '✅',
    warning: '⚠️',
    error: '❌',
  };

  return (
    <div
      className={`
        pointer-events-auto
        flex w-96 rounded-lg border p-4 shadow-lg
        animate-in slide-in-from-right duration-300
        ${variantStyles[toast.variant || 'default']}
      `}
      role="alert"
    >
      <div className="flex-shrink-0">
        <span className="text-lg">{iconStyles[toast.variant || 'default']}</span>
      </div>
      <div className="ml-3 flex-1">
        {toast.title && (
          <h4 className="text-sm font-medium">{toast.title}</h4>
        )}
        {toast.description && (
          <p className={`text-sm ${toast.title ? 'mt-1' : ''}`}>
            {toast.description}
          </p>
        )}
        {toast.action && (
          <div className="mt-2">
            {toast.action}
          </div>
        )}
      </div>
      <button
        onClick={() => removeToast(toast.id)}
        className="ml-4 inline-flex flex-shrink-0 rounded-md p-1.5 hover:bg-black hover:bg-opacity-10 focus:outline-none focus:ring-2 focus:ring-offset-2"
        aria-label="Close notification"
      >
        <span className="sr-only">Close</span>
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
};

export { ToastComponent };