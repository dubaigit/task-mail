import React from 'react';
import { SuggestionsPanelProps } from '../types';

export const SuggestionsPanel: React.FC<SuggestionsPanelProps> = ({
  suggestions,
  onSuggestionClick,
  isProcessing = false,
  className = ''
}) => {
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'tone': return 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100';
      case 'length': return 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100';
      case 'content': return 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100';
      case 'style': return 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100';
      default: return 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100';
    }
  };

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className={`border-b border-border p-4 ${className}`}>
      <h4 className="text-sm font-medium text-muted-foreground mb-3">Try these suggestions:</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {suggestions.slice(0, 4).map((suggestion) => (
          <button
            key={suggestion.id}
            onClick={() => onSuggestionClick(suggestion)}
            disabled={isProcessing}
            className={`flex items-start space-x-2 p-3 text-left text-sm border rounded-lg transition-colors disabled:opacity-50 ${getCategoryColor(suggestion.category)}`}
          >
            {suggestion.icon}
            <div>
              <div className="font-medium">{suggestion.text}</div>
              <div className="text-xs opacity-75">{suggestion.description}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Additional suggestions for inline display */}
      {suggestions.length > 4 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {suggestions.slice(4).map((suggestion) => (
            <button
              key={suggestion.id}
              onClick={() => onSuggestionClick(suggestion)}
              disabled={isProcessing}
              className="inline-flex items-center space-x-1 px-2 py-1 text-xs bg-muted border border-border rounded-md hover:bg-muted/80 disabled:opacity-50 transition-colors"
            >
              {suggestion.icon}
              <span>{suggestion.text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};