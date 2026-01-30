import { addToHistory, updateHistoryRecord, generateId, type ArticleRecord } from './store';

export type PipelineStep =
  | 'idle'
  | 'connecting'
  | 'trends'
  | 'cluster'
  | 'keyword_research'
  | 'cannibalization'
  | 'intent'
  | 'keyword_scoring'
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

export interface PipelineStatus {
  step: PipelineStep;
  progress: number;
  message: string;
  topic?: string;
  articleId?: string;
  error?: string;
  logs: string[];
}

// Use global to share state across Next.js module instances in dev mode
// This prevents the module isolation issue where SSE and API routes have separate state
interface GlobalPipelineState {
  currentStatus: PipelineStatus;
  pipelineStartTime: number | null;
  subscribers: Set<(status: PipelineStatus) => void>;
  abortController: AbortController | null;
}

const globalForPipeline = globalThis as unknown as { __pipelineState?: GlobalPipelineState };

// Initialize global state if not exists
if (!globalForPipeline.__pipelineState) {
  globalForPipeline.__pipelineState = {
    currentStatus: {
      step: 'idle',
      progress: 0,
      message: 'Ready to generate',
      logs: [],
    },
    pipelineStartTime: null,
    subscribers: new Set(),
    abortController: null,
  };
}

// Reference the global state
const state = globalForPipeline.__pipelineState;

const STALE_TIMEOUT_MS = 12 * 60 * 1000; // 12 minutes - consider stale if running longer than max timeout

const STEP_PROGRESS: Record<PipelineStep, number> = {
  idle: 0,
  connecting: 3,
  trends: 6,
  cluster: 9,
  keyword_research: 13,
  cannibalization: 17,
  intent: 20,
  keyword_scoring: 24,
  competitors: 28,
  keywords: 32,
  outline: 36,
  content: 42,
  originality: 48,
  humanize: 54,
  readability: 60,
  faq: 65,
  toc: 69,
  image: 73,
  internal_links: 78,
  schema: 84,
  publish: 92,
  complete: 100,
  failed: 0,
};

export function getStatus(): PipelineStatus {
  return { ...state.currentStatus };
}

export function subscribe(callback: (status: PipelineStatus) => void): () => void {
  state.subscribers.add(callback);
  callback(state.currentStatus);
  return () => state.subscribers.delete(callback);
}

function broadcast(): void {
  Array.from(state.subscribers).forEach((sub) => {
    sub({ ...state.currentStatus });
  });
}

function updateStatus(updates: Partial<PipelineStatus>): void {
  state.currentStatus = { ...state.currentStatus, ...updates };
  broadcast();
}

function log(message: string): void {
  const timestamp = new Date().toLocaleTimeString();
  state.currentStatus.logs = [...state.currentStatus.logs.slice(-49), `[${timestamp}] ${message}`];
  broadcast();
}

export async function runPipeline(options: {
  topic?: string;
  voiceTone?: string;
}): Promise<void> {
  // Check if pipeline is running but stale (stuck state from HMR or crash)
  const isRunning = state.currentStatus.step !== 'idle' && state.currentStatus.step !== 'complete' && state.currentStatus.step !== 'failed';
  const isStale = state.pipelineStartTime && (Date.now() - state.pipelineStartTime > STALE_TIMEOUT_MS);
  
  if (isRunning && !isStale) {
    throw new Error('Pipeline is already running');
  }
  
  // If stale, reset the state first
  if (isStale) {
    resetPipeline();
  }

  const articleId = generateId();
  state.abortController = new AbortController();
  state.pipelineStartTime = Date.now(); // Track start time
  
  // Reset status
  state.currentStatus = {
    step: 'connecting',
    progress: STEP_PROGRESS.connecting,
    message: 'Connecting to WordPress...',
    topic: options.topic,
    articleId,
    logs: [],
  };
  broadcast();
  log('Starting pipeline...');

  // Create initial history record
  const record: ArticleRecord = {
    id: articleId,
    topic: options.topic || 'Discovering...',
    title: '',
    slug: '',
    wordCount: 0,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  await addToHistory(record);

  try {
    // Run the actual pipeline by calling the backend
    // Use absolute URL since this runs server-side
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    
    // Add timeout of 10 minutes
    const timeoutId = setTimeout(() => {
      if (state.abortController) state.abortController.abort();
    }, 10 * 60 * 1000);

    log('Calling pipeline API...');
    
    const response = await fetch(`${baseUrl}/api/generate/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        articleId,
        topic: options.topic,
        voiceTone: options.voiceTone,
      }),
      signal: state.abortController.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Pipeline failed');
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'Pipeline returned failure');
    }
    
    log(`SUCCESS: Article published!`);
    
    // Update history with success
    await updateHistoryRecord(articleId, {
      title: result.title,
      slug: result.slug,
      wordCount: result.wordCount,
      status: 'published',
      postUrl: result.postUrl,
      postId: result.postId,
      completedAt: new Date().toISOString(),
    });

    updateStatus({
      step: 'complete',
      progress: 100,
      message: `Published: ${result.postUrl}`,
    });

  } catch (error) {
    const errorMessage = error instanceof Error 
      ? (error.name === 'AbortError' ? 'Pipeline cancelled or timed out' : error.message)
      : 'Unknown error';
    
    log(`ERROR: ${errorMessage}`);
    
    try {
      await updateHistoryRecord(articleId, {
        status: 'failed',
        error: errorMessage,
        completedAt: new Date().toISOString(),
      });
    } catch (e) {
      // Ignore history update errors
    }

    updateStatus({
      step: 'failed',
      progress: 0,
      message: 'Pipeline failed',
      error: errorMessage,
    });
  } finally {
    state.abortController = null;
    state.pipelineStartTime = null; // Clear start time
  }
}

export function cancelPipeline(): void {
  if (state.abortController) {
    state.abortController.abort();
    log('Pipeline cancelled by user');
  }
  resetPipeline();
}

export function resetPipeline(): void {
  state.currentStatus = {
    step: 'idle',
    progress: 0,
    message: 'Ready to generate',
    logs: [],
  };
  state.pipelineStartTime = null; // Clear start time
  broadcast();
}

// Export for API to update status
export function setStep(step: PipelineStep, message: string): void {
  log(message);
  updateStatus({
    step,
    progress: STEP_PROGRESS[step],
    message,
  });
}

export function setTopic(topic: string): void {
  updateStatus({ topic });
}
