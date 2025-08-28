import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { DialogProps } from '../types';

const sizeClasses = {
  xs: 'max-w-xs',
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEsc = true,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEsc) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, closeOnEsc]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby={title ? 'dialog-title' : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div className="flex min-h-screen items-center justify-center p-4 text-center">
        <div
          className="fixed inset-0 bg-black bg-opacity-25 transition-opacity"
          aria-hidden="true"
          onClick={closeOnOverlayClick ? onClose : undefined}
        />
        <div
          ref={dialogRef}
          className={`
            relative inline-block align-bottom bg-white rounded-lg
            text-left overflow-hidden shadow-xl transform transition-all
            sm:my-8 sm:align-middle w-full
            ${sizeClasses[size]}
          `}
        >
          {title && (
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="flex items-center justify-between">
                <h3
                  id="dialog-title"
                  className="text-lg leading-6 font-medium text-gray-900"
                >
                  {title}
                </h3>
                <button
                  onClick={onClose}
                  className="rounded-md p-1 hover:bg-gray-100 transition-colors"
                  aria-label="Close dialog"
                >
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </div>
            </div>
          )}
          <div className="bg-white px-4 pb-4 sm:p-6 sm:pb-4">{children}</div>
        </div>
      </div>
    </div>
  );
};