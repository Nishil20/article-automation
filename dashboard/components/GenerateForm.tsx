'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Play, RotateCcw, Loader2, StopCircle, Sparkles } from 'lucide-react';

interface GenerateFormProps {
  isRunning: boolean;
  onGenerate: (options: { topic?: string; voiceTone?: string }) => void;
  onReset: () => void;
  onCancel: () => void;
}

const TONE_OPTIONS = [
  { value: 'conversational', label: 'Conversational', emoji: '💬' },
  { value: 'professional', label: 'Professional', emoji: '👔' },
  { value: 'casual', label: 'Casual', emoji: '😊' },
  { value: 'authoritative', label: 'Authoritative', emoji: '📚' },
];

export function GenerateForm({ isRunning, onGenerate, onReset, onCancel }: GenerateFormProps) {
  const [topic, setTopic] = useState('');
  const [voiceTone, setVoiceTone] = useState('conversational');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate({ topic: topic || undefined, voiceTone });
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Generate Article</h2>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Create SEO-optimized content automatically
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {/* Topic input */}
        <div>
          <label htmlFor="topic" className="block text-sm font-medium mb-2">
            Topic
            <span className="text-muted-foreground font-normal ml-1">(optional)</span>
          </label>
          <input
            type="text"
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Leave empty for trending topic"
            disabled={isRunning}
            className={cn(
              'w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg',
              'text-foreground placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-all duration-200'
            )}
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            💡 Tip: Let us find trending topics for better SEO
          </p>
        </div>

        {/* Voice tone */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Writing Tone
          </label>
          <div className="grid grid-cols-2 gap-2">
            {TONE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setVoiceTone(option.value)}
                disabled={isRunning}
                className={cn(
                  'px-3 py-2.5 rounded-lg border text-sm font-medium',
                  'transition-all duration-200',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  voiceTone === option.value
                    ? 'bg-primary/20 border-primary text-primary'
                    : 'bg-secondary/50 border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                )}
              >
                <span className="mr-1.5">{option.emoji}</span>
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          {isRunning ? (
            <button
              type="button"
              onClick={onCancel}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-6 py-3',
                'bg-destructive/20 text-destructive font-medium rounded-lg border border-destructive/30',
                'hover:bg-destructive/30 focus:outline-none focus:ring-2 focus:ring-destructive/50',
                'transition-all duration-200'
              )}
            >
              <StopCircle className="w-4 h-4" />
              Cancel
            </button>
          ) : (
            <button
              type="submit"
              disabled={isRunning}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-6 py-3',
                'bg-primary text-primary-foreground font-medium rounded-lg',
                'hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-all duration-200 hover:shadow-lg hover:shadow-primary/25'
              )}
            >
              <Play className="w-4 h-4" />
              Generate Article
            </button>
          )}
          
          <button
            type="button"
            onClick={onReset}
            disabled={isRunning}
            title="Reset"
            className={cn(
              'px-4 py-3 bg-secondary/50 text-muted-foreground font-medium rounded-lg border border-border',
              'hover:bg-secondary hover:text-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-all duration-200'
            )}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Running indicator */}
        {isRunning && (
          <div className="flex items-center justify-center gap-2 py-2 px-4 bg-primary/10 rounded-lg border border-primary/20">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm text-primary font-medium">Pipeline is running...</span>
          </div>
        )}
      </form>
    </div>
  );
}
