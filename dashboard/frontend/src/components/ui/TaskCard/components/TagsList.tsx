import React from 'react';
import { Icons } from '../../icons';

interface TagsListProps {
  tags: string[];
  maxShown: number;
}

export const TagsList: React.FC<TagsListProps> = ({ tags, maxShown }) => {
  const visibleTags = tags.slice(0, maxShown);
  const remainingCount = Math.max(0, tags.length - maxShown);

  return (
    <div className="task-tags">
      {visibleTags.map((tag, index) => (
        <span key={index} className="task-tag">
          <Icons.tag className="w-3 h-3" />
          {tag}
        </span>
      ))}
      {remainingCount > 0 && (
        <span className="task-tag-more">+{remainingCount}</span>
      )}
    </div>
  );
};

TagsList.displayName = 'TagsList';