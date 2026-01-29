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
  Fingerprint,
  BookOpen,
  Link2,
  Code2,
  Network,
  HelpCircle,
  List,
} from 'lucide-react';

type PipelineStep =
  | 'idle'
  | 'connecting'
  | 'trends'
  | 'cluster'
  | 'competitors'
  | 'keywords'
  | 'outline'
  | 'content'
  | 'originality'
  | 'humanize'
  | 'readability'
  | 'faq'
  | 'toc'
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

// Group steps into logical phases for cleaner display
const PHASES = [
  {
    id: 'setup',
    label: 'Setup',
    icon: Zap,
    steps: ['connecting'],
  },
  {
    id: 'research',
    label: 'Research',
    icon: Search,
    steps: ['trends', 'cluster', 'competitors', 'keywords'],
  },
  {
    id: 'writing',
    label: 'Writing',
    icon: Sparkles,
    steps: ['outline', 'content', 'originality', 'humanize', 'readability', 'faq', 'toc'],
  },
  {
    id: 'optimize',
    label: 'Optimize',
    icon: Image,
    steps: ['image', 'internal_links', 'schema'],
  },
  {
    id: 'publish',
    label: 'Publish',
    icon: Send,
    steps: ['publish'],
  },
] as const;

// Detailed steps for the current phase display
const STEP_DETAILS: Record<string, { label: string; description: string; icon: typeof Zap }> = {
  connecting: { label: 'Connecting', description: 'WordPress connection', icon: Zap },
  trends: { label: 'Finding Topics', description: 'Analyzing trends', icon: Search },
  cluster: { label: 'Clustering', description: 'Topic classification', icon: Network },
  competitors: { label: 'Analyzing', description: 'Competitor research', icon: Users },
  keywords: { label: 'Keywords', description: 'SEO optimization', icon: Key },
  outline: { label: 'Outlining', description: 'Article structure', icon: FileText },
  content: { label: 'Writing', description: 'Generating content', icon: Sparkles },
  originality: { label: 'Checking', description: 'Originality scan', icon: Fingerprint },
  humanize: { label: 'Humanizing', description: 'Natural language', icon: Wand2 },
  readability: { label: 'Optimizing', description: 'Readability check', icon: BookOpen },
  faq: { label: 'FAQ', description: 'Generating FAQ', icon: HelpCircle },
  toc: { label: 'TOC', description: 'Table of contents', icon: List },
  image: { label: 'Image', description: 'Featured image', icon: Image },
  internal_links: { label: 'Linking', description: 'Internal links', icon: Link2 },
  schema: { label: 'Schema', description: 'SEO markup', icon: Code2 },
  publish: { label: 'Publishing', description: 'WordPress upload', icon: Send },
};

function getPhaseStatus(phase: typeof PHASES[number], currentStep: PipelineStep): 'pending' | 'active' | 'complete' | 'failed' {
  if (currentStep === 'failed') return 'failed';
  if (currentStep === 'complete') return 'complete';
  if (currentStep === 'idle') return 'pending';
  
  const allSteps = PHASES.flatMap(p => p.steps);
  const currentIndex = allSteps.indexOf(currentStep);
  const phaseStartIndex = allSteps.indexOf(phase.steps[0]);
  const phaseEndIndex = allSteps.indexOf(phase.steps[phase.steps.length - 1]);
  
  if (currentIndex > phaseEndIndex) return 'complete';
  if (currentIndex >= phaseStartIndex && currentIndex <= phaseEndIndex) return 'active';
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

  // Get current step details
  const currentStepDetails = step !== 'idle' && step !== 'complete' && step !== 'failed' 
    ? STEP_DETAILS[step] 
    : null;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Pipeline</h2>
          <div className="flex items-center gap-2">
            {isRunning && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                <span className="text-xs text-primary font-medium">Running</span>
              </div>
            )}
            {isComplete && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 rounded-full">
                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                <span className="text-xs text-green-500 font-medium">Complete</span>
              </div>
            )}
            {isFailed && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-destructive/10 rounded-full">
                <XCircle className="w-3.5 h-3.5 text-destructive" />
                <span className="text-xs text-destructive font-medium">Failed</span>
              </div>
            )}
            {isIdle && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-full">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Ready</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Phase indicators - clean horizontal layout */}
        <div className="flex items-center justify-between mb-6">
          {PHASES.map((phase, index) => {
            const status = getPhaseStatus(phase, step);
            const Icon = phase.icon;
            
            return (
              <div key={phase.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300',
                      status === 'pending' && 'bg-secondary text-muted-foreground',
                      status === 'active' && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
                      status === 'complete' && 'bg-primary/20 text-primary',
                      status === 'failed' && 'bg-destructive/20 text-destructive'
                    )}
                  >
                    {status === 'active' ? (
                      <Loader2 className="w-[18px] h-[18px] animate-spin" />
                    ) : status === 'complete' ? (
                      <CheckCircle className="w-[18px] h-[18px]" />
                    ) : status === 'failed' ? (
                      <XCircle className="w-[18px] h-[18px]" />
                    ) : (
                      <Icon className="w-[18px] h-[18px]" />
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-[11px] mt-2 font-medium',
                      status === 'pending' && 'text-muted-foreground',
                      status === 'active' && 'text-primary',
                      status === 'complete' && 'text-primary/80',
                      status === 'failed' && 'text-destructive'
                    )}
                  >
                    {phase.label}
                  </span>
                </div>
                {index < PHASES.length - 1 && (
                  <div className="flex-1 mx-3 mt-[-18px]">
                    <div
                      className={cn(
                        'h-0.5 rounded-full transition-all duration-500',
                        status === 'complete' ? 'bg-primary/40' : 'bg-secondary'
                      )}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Current step details - only show when running */}
        {currentStepDetails && (
          <div className="mb-6 p-4 bg-primary/5 border border-primary/10 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <currentStepDetails.icon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{currentStepDetails.label}</p>
                <p className="text-xs text-muted-foreground">{currentStepDetails.description}</p>
              </div>
              <div className="text-right">
                <span className="text-lg font-semibold text-primary">{Math.round(progress)}%</span>
              </div>
            </div>
            <div className="mt-3 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Idle state - show progress bar */}
        {isIdle && (
          <div className="mb-6 p-4 bg-secondary/30 border border-border rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                <Clock className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Ready to generate</p>
                <p className="text-xs text-muted-foreground/70">Configure settings and start the pipeline</p>
              </div>
            </div>
          </div>
        )}

        {/* Complete state */}
        {isComplete && (
          <div className="mb-6 p-4 bg-green-500/5 border border-green-500/10 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-green-500">Pipeline Complete</p>
                <p className="text-xs text-muted-foreground">
                  {publishedUrl ? (
                    <a 
                      href={publishedUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      View published article
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    message
                  )}
                </p>
              </div>
              <span className="text-lg font-semibold text-green-500">100%</span>
            </div>
          </div>
        )}

        {/* Topic display */}
        {topic && (
          <div className="p-4 bg-secondary/30 rounded-xl border border-border">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Topic</span>
            <p className="text-sm font-medium mt-1">{topic}</p>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="mt-4 p-4 bg-destructive/5 border border-destructive/10 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <XCircle className="w-4 h-4 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-destructive">Pipeline Failed</p>
                <p className="text-xs text-destructive/80 mt-0.5 break-words">{error}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
