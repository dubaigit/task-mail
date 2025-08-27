import React from 'react';

interface LoadingOverlayProps {
  message?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  message = 'Updating...'
}) => {
  return (
    <div className="loading-overlay">
      <div className="loading-spinner" />
      <span className="loading-message">{message}</span>
    </div>
  );
};

LoadingOverlay.displayName = 'LoadingOverlay';