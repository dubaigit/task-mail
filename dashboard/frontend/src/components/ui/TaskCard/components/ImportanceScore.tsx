import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '../utils/styling';

interface ImportanceScoreProps {
  score: number;
}

export const ImportanceScore: React.FC<ImportanceScoreProps> = ({ score }) => {
  const getScoreColor = (score: number) => {
    if (score > 70) return 'text-amber-400 fill-amber-400/30';
    if (score > 40) return 'text-slate-400 fill-slate-400/30';
    return 'text-slate-500';
  };

  return (
    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
      <Star className={cn('w-3.5 h-3.5', getScoreColor(score))} />
      <span className="text-xs font-semibold text-slate-300">{score}</span>
    </div>
  );
};

ImportanceScore.displayName = 'ImportanceScore';