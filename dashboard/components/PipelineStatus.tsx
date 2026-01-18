'use client';

import { cn } from '@/lib/utils';
import { 
  Zap, 
  Search, 
  Key, 
  FileText, 
  Sparkles, 
  Wand2, 
  Send, 
  Image,
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  ExternalLink,
  Users,
  Target,
  Fingerprint,
  BookOpen,
  Link2,
  Code2
} from 'lucide-react';

type PipelineStep =
  | 'idle'
  | 'connecting'
  | 'trends'
  | 'competitors'
  | 'keywords'
  | 'outline'
  | 'content'
  | 'originality'
  | 'humanize'
  | 'readability'
  | 'image'
  | 'internal_links'
  | 'schema'
  | 'publish'
  | 'complete'
  | 'failed';

interface PipelineStatusProps {
  step: PipelineStep;
  progress: number;
  message: string;
  topic?: string;
  error?: string;
}

const STEPS = [
  { id: 'connecting', label: 'Connect', icon: Zap, description: 'WordPress connection' },
  { id: 'trends', label: 'Topic', icon: Search, description: 'Finding trends' },
  { id: 'competitors', label: 'Analyze', icon: Users, description: 'Competitor analysis' },
  { id: 'keywords', label: 'Keywords', icon: Key, description: 'SEO keywords' },
  { id: 'outline', label: 'Outline', icon: FileText, description: 'Article structure' },
  { id: 'content', label: 'Content', icon: Sparkles, description: 'Writing article' },
  { id: 'originality', label: 'Original', icon: Fingerprint, description: 'Originality check' },
  { id: 'humanize', label: 'Humanize', icon: Wand2, description: 'Natural language' },
  { id: 'readability', label: 'Readable', icon: BookOpen, description: 'Readability optimization' },
  { id: 'image', label: 'Image', icon: Image, description: 'Featured image' },
  { id: 'internal_links', label: 'Links', icon: Link2, description: 'Internal linking' },
  { id: 'schema', label: 'Schema', icon: Code2, description: 'SEO markup' },
  { id: 'publish', label: 'Publish', icon: Send, description: 'WordPress upload' },
] as const;

function getStepStatus(stepId: string, currentStep: PipelineStep): 'pending' | 'active' | 'complete' | 'failed' {
  // Handle special states that aren't in the STEPS array
  if (currentStep === 'failed') {
    // Mark all steps as failed when pipeline fails
    return 'failed';
  }
  
  if (currentStep === 'complete') return 'complete';
  if (currentStep === 'idle') return 'pending';
  
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);
  const stepIndex = STEPS.findIndex((s) => s.id === stepId);
  
  if (stepIndex < currentIndex) return 'complete';
  if (stepIndex === currentIndex) return 'active';
  return 'pending';
}

export function PipelineStatus({ step, progress, message, topic, error }: PipelineStatusProps) {
  const isRunning = !['idle', 'complete', 'failed'].includes(step);
  const isComplete = step === 'complete';
  const isFailed = step === 'failed';
  const isIdle = step === 'idle';

  // Extract URL from message if present
  const urlMatch = message.match(/(https?:\/\/[^\s]+)/);
  const publishedUrl = urlMatch ? urlMatch[1] : null;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header with status indicator */}
      <div className={cn(
        'px-6 py-4 border-b border-border',
        isRunning && 'bg-gradient-to-r from-primary/10 via-primary/5 to-transparent',
        isComplete && 'bg-gradient-to-r from-green-500/10 via-green-500/5 to-transparent',
        isFailed && 'bg-gradient-to-r from-destructive/10 via-destructive/5 to-transparent'
      )}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Pipeline Status</h2>
          <div className="flex items-center gap-2">
            {isRunning && (
              <div className="flex items-center gap-2 px-3 py-1 bg-primary/20 rounded-full">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                <span className="text-xs text-primary font-medium">Running</span>
              </div>
            )}
            {isComplete && (
              <div className="flex items-center gap-2 px-3 py-1 bg-green-500/20 rounded-full">
                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                <span className="text-xs text-green-500 font-medium">Complete</span>
              </div>
            )}
            {isFailed && (
              <div className="flex items-center gap-2 px-3 py-1 bg-destructive/20 rounded-full">
                <XCircle className="w-3.5 h-3.5 text-destructive" />
                <span className="text-xs text-destructive font-medium">Failed</span>
              </div>
            )}
            {isIdle && (
              <div className="flex items-center gap-2 px-3 py-1 bg-secondary rounded-full">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Ready</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Progress</span>
            <span className="text-sm font-medium">{Math.round(progress)}%</span>
          </div>
          <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-700 ease-out rounded-full',
                isFailed ? 'bg-destructive' : 'bg-gradient-to-r from-primary to-primary/70'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2 min-h-[20px]">
            {publishedUrl ? (
              <a 
                href={publishedUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                {message.replace(publishedUrl, '')}
                <span className="text-primary">{publishedUrl}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              message
            )}
          </p>
        </div>

        {/* Steps visualization - scrollable on smaller screens */}
        <div className="overflow-x-auto pb-2 -mx-2 px-2">
          <div className="flex gap-2 min-w-max">
            {STEPS.map((s) => {
              const status = getStepStatus(s.id, step);
              const Icon = s.icon;
              
              return (
                <div key={s.id} className="flex flex-col items-center min-w-[52px]">
                  <div
                    className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300',
                      status === 'pending' && 'bg-secondary text-muted-foreground',
                      status === 'active' && 'bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-110',
                      status === 'complete' && 'bg-primary/20 text-primary',
                      status === 'failed' && 'bg-destructive/20 text-destructive'
                    )}
                    title={s.description}
                  >
                    {status === 'active' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : status === 'complete' ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : status === 'failed' ? (
                      <XCircle className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-[9px] mt-1 font-medium text-center leading-tight whitespace-nowrap',
                      status === 'pending' && 'text-muted-foreground',
                      status === 'active' && 'text-primary',
                      status === 'complete' && 'text-primary/80',
                      status === 'failed' && 'text-destructive'
                    )}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Topic display */}
        {topic && (
          <div className="mt-6 p-4 bg-secondary/30 rounded-xl border border-border">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Topic</span>
            <p className="text-sm font-medium mt-1">{topic}</p>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
            <div className="flex items-start gap-2">
              <XCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-xs text-destructive font-medium uppercase tracking-wider">Error</span>
                <p className="text-sm text-destructive/90 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
