import React from 'react';
import { Icons } from '../../icons';
import { TaskCentricEmail } from '../types';

interface EmailLinkProps {
  email: TaskCentricEmail;
  onClick?: () => void;
}

export const EmailLink: React.FC<EmailLinkProps> = ({ email, onClick }) => {
  return (
    <button
      className="email-link"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      title={`View related email: ${email.subject}`}
      aria-label={`View email from ${email.sender}`}
    >
      <Icons.external className="w-4 h-4" />
    </button>
  );
};

EmailLink.displayName = 'EmailLink';