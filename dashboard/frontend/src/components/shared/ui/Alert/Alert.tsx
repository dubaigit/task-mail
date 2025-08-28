import React from 'react';
import { AlertTriangle, CheckCircle, Info, X, XCircle } from 'lucide-react';

interface AlertProps {
  title?: string;
  description?: string;
  status?: 'success' | 'error' | 'warning' | 'info';
  isClosable?: boolean;
  onClose?: () => void;
  className?: string;
  children?: React.ReactNode;
}

const statusConfig = {
  success: {
    icon: CheckCircle,
    className: 'bg-green-50 text-green-800 border-green-200',
    iconClass: 'text-green-500',
  },
  error: {
    icon: XCircle,
    className: 'bg-red-50 text-red-800 border-red-200',
    iconClass: 'text-red-500',
  },
  warning: {
    icon: AlertTriangle,
    className: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    iconClass: 'text-yellow-500',
  },
  info: {
    icon: Info,
    className: 'bg-blue-50 text-blue-800 border-blue-200',
    iconClass: 'text-blue-500',
  },
};

export const Alert: React.FC<AlertProps> = ({
  title,
  description,
  status = 'info',
  isClosable = false,
  onClose,
  className = '',
  children,
}) => {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={`rounded-lg border p-4 flex gap-3 ${config.className} ${className}`}
      role="alert"
    >
      <Icon className={`h-5 w-5 flex-shrink-0 ${config.iconClass}`} />
      <div className="flex-1">
        {title && <h4 className="font-semibold mb-1">{title}</h4>}
        {description && <p className="text-sm">{description}</p>}
        {children}
      </div>
      {isClosable && onClose && (
        <button
          onClick={onClose}
          className="ml-auto -m-1.5 p-1.5 hover:bg-black/5 rounded transition-colors"
          aria-label="Close alert"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};