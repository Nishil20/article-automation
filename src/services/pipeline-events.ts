import { EventEmitter } from 'events';

export type PipelineStep = 
  | 'idle'
  | 'connecting'
  | 'trends'
  | 'keywords'
  | 'outline'
  | 'content'
  | 'humanize'
  | 'publish'
  | 'complete'
  | 'failed';

export interface PipelineStatus {
  step: PipelineStep;
  progress: number; // 0-100
  message: string;
  topic?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface PipelineEvent {
  type: 'status' | 'log' | 'complete' | 'error';
  timestamp: string;
  data: PipelineStatus | string;
}

class PipelineEventEmitter extends EventEmitter {
  private currentStatus: PipelineStatus = {
    step: 'idle',
    progress: 0,
    message: 'Ready to generate',
  };

  private eventListeners: Set<(event: PipelineEvent) => void> = new Set();

  getStatus(): PipelineStatus {
    return { ...this.currentStatus };
  }

  updateStatus(status: Partial<PipelineStatus>): void {
    this.currentStatus = { ...this.currentStatus, ...status };
    this.broadcast({
      type: 'status',
      timestamp: new Date().toISOString(),
      data: this.currentStatus,
    });
  }

  log(message: string): void {
    this.broadcast({
      type: 'log',
      timestamp: new Date().toISOString(),
      data: message,
    });
  }

  complete(postUrl?: string): void {
    this.currentStatus = {
      step: 'complete',
      progress: 100,
      message: postUrl ? `Published: ${postUrl}` : 'Completed successfully',
      completedAt: new Date().toISOString(),
    };
    this.broadcast({
      type: 'complete',
      timestamp: new Date().toISOString(),
      data: this.currentStatus,
    });
  }

  fail(error: string): void {
    this.currentStatus = {
      ...this.currentStatus,
      step: 'failed',
      message: 'Pipeline failed',
      error,
      completedAt: new Date().toISOString(),
    };
    this.broadcast({
      type: 'error',
      timestamp: new Date().toISOString(),
      data: this.currentStatus,
    });
  }

  reset(): void {
    this.currentStatus = {
      step: 'idle',
      progress: 0,
      message: 'Ready to generate',
    };
  }

  subscribe(callback: (event: PipelineEvent) => void): () => void {
    this.eventListeners.add(callback);
    // Send current status immediately
    callback({
      type: 'status',
      timestamp: new Date().toISOString(),
      data: this.currentStatus,
    });
    return () => {
      this.eventListeners.delete(callback);
    };
  }

  private broadcast(event: PipelineEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('Error in pipeline event listener:', e);
      }
    }
    this.emit('event', event);
  }
}

// Singleton instance
export const pipelineEvents = new PipelineEventEmitter();

// Step progress mapping
export const STEP_PROGRESS: Record<PipelineStep, number> = {
  idle: 0,
  connecting: 5,
  trends: 15,
  keywords: 30,
  outline: 45,
  content: 60,
  humanize: 80,
  publish: 95,
  complete: 100,
  failed: 0,
};
