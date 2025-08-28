import React, { useState, useRef, useEffect } from 'react';
import type { DropdownMenuProps } from '../types';

const alignStyles = {
  start: 'left-0',
  center: 'left-1/2 -translate-x-1/2',
  end: 'right-0',
};

const sideStyles = {
  top: 'bottom-full mb-2',
  bottom: 'top-full mt-2',
  left: 'right-full mr-2',
  right: 'left-full ml-2',
};

export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  trigger,
  children,
  align = 'start',
  side = 'bottom',
  sideOffset = 4,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleDropdown = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <div onClick={toggleDropdown} className={disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}>
        {trigger}
      </div>
      {isOpen && (
        <div
          className={`
            absolute z-50 min-w-[8rem] overflow-hidden
            rounded-md border bg-white p-1 shadow-lg
            ${sideStyles[side]}
            ${alignStyles[align]}
          `}
          style={{ marginTop: sideOffset }}
        >
          {children}
        </div>
      )}
    </div>
  );
};