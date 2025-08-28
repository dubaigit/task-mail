import React, { useState, useEffect, useRef } from 'react';

interface EditableDescriptionProps {
  value: string;
  onChange: (value: string) => void;
  onSave: (value: string) => void;
  onCancel: () => void;
  maxLength?: number;
}

export const EditableDescription: React.FC<EditableDescriptionProps> = ({
  value,
  onChange,
  onSave,
  onCancel,
  maxLength = 500
}) => {
  const [editValue, setEditValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
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
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={editValue}
        onChange={(e) => {
          if (e.target.value.length <= maxLength) {
            setEditValue(e.target.value);
            onChange(e.target.value);
          }
        }}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="w-full text-sm bg-transparent border border-gray-300 rounded p-2 focus:border-blue-500 focus:outline-none resize-none"
        rows={3}
        aria-label="Edit task description"
        placeholder="Enter task description..."
      />
      <div className="absolute bottom-1 right-1 text-xs text-gray-400">
        {editValue.length}/{maxLength}
      </div>
    </div>
  );
};

EditableDescription.displayName = 'EditableDescription';