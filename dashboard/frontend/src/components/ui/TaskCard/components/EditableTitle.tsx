import React, { useState, useEffect, useRef } from 'react';

interface EditableTitleProps {
  value: string;
  onChange: (value: string) => void;
  onSave: (value: string) => void;
  onCancel: () => void;
}

export const EditableTitle: React.FC<EditableTitleProps> = ({
  value,
  onChange,
  onSave,
  onCancel
}) => {
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSave(editValue);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const handleBlur = () => {
    onSave(editValue);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={editValue}
      onChange={(e) => {
        setEditValue(e.target.value);
        onChange(e.target.value);
      }}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      className="w-full text-lg font-semibold bg-transparent border-b border-gray-300 focus:border-blue-500 focus:outline-none"
      aria-label="Edit task title"
    />
  );
};

EditableTitle.displayName = 'EditableTitle';