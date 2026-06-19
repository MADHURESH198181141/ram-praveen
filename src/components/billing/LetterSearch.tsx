import React from 'react';
import { cn } from '@/lib/utils';

interface LetterSearchProps {
  selectedLetter: string | null;
  onLetterSelect: (letter: string | null) => void;
  availableLetters: string[];
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export function LetterSearch({ selectedLetter, onLetterSelect, availableLetters }: LetterSearchProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Quick Search by Letter</span>
        {selectedLetter && (
          <button
            onClick={() => onLetterSelect(null)}
            className="text-xs text-primary hover:underline"
          >
            Clear filter
          </button>
        )}
      </div>
      <div className="letter-grid">
        {ALPHABET.map((letter) => {
          const hasProducts = availableLetters.includes(letter);
          return (
            <button
              key={letter}
              onClick={() => hasProducts && onLetterSelect(letter === selectedLetter ? null : letter)}
              disabled={!hasProducts}
              className={cn(
                'letter-btn',
                selectedLetter === letter && 'active',
                !hasProducts && 'opacity-30 cursor-not-allowed'
              )}
            >
              {letter}
            </button>
          );
        })}
      </div>
    </div>
  );
}
