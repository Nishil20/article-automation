'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PipelineStatus } from '@/components/PipelineStatus';
import { GenerateForm } from '@/components/GenerateForm';
import { ArticleHistory } from '@/components/ArticleHistory';
import { LogViewer } from '@/components/LogViewer';
import { Settings, History, Wifi, WifiOff, Loader2, Zap } from 'lucide-react';

interface Status {
  step: string;
  progress: number;
  message: string;
  topic?: string;
  error?: string;
  logs: string[];
}

interface ArticleRecord {
  id: string;
  topic: string;
  title: string;
  slug: string;
  wordCount: number;
  status: 'published' | 'failed' | 'pending';
  postUrl?: string;
  error?: string;
  createdAt: string;
}

export default function Dashboard() {
  const [status, setStatus] = useState<Status>({
    step: 'idle',
    progress: 0,
    message: 'Ready to generate',
    logs: [],
  });
  const [articles, setArticles] = useState<ArticleRecord[]>([]);
  const [wpConnection, setWpConnection] = useState<'unknown' | 'testing' | 'connected' | 'failed'>('unknown');

  // Fetch initial history
  useEffect(() => {
    fetch('/api/history')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setArticles(data);
        }
      })
      .catch(console.error);
  }, []);

  // Subscribe to status updates via SSE
  useEffect(() => {
    const eventSource = new EventSource('/api/status');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setStatus(data);

        // Refresh history when complete or failed
        if (data.step === 'complete' || data.step === 'failed') {
          fetch('/api/history')
            .then((res) => res.json())
            .then((historyData) => {
              if (Array.isArray(historyData)) {
                setArticles(historyData);
              }
            })
            .catch(console.error);
        }
      } catch (e) {
        console.error('Failed to parse status:', e);
      }
    };

    eventSource.onerror = () => {
      console.error('SSE connection error');
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const handleGenerate = useCallback(async (options: { topic?: string; voiceTone?: string }) => {
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to start pipeline:', error);
      }
    } catch (error) {
      console.error('Failed to start pipeline:', error);
    }
  }, [status.step]);

  const handleReset = useCallback(async () => {
    try {
      await fetch('/api/generate', { method: 'DELETE' });
    } catch (error) {
      console.error('Failed to reset pipeline:', error);
    }
  }, []);

  const handleCancel = useCallback(async () => {
    try {
      await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
    } catch (error) {
      console.error('Failed to cancel pipeline:', error);
    }
  }, []);

  const testConnection = useCallback(async () => {
    setWpConnection('testing');
    try {
      const response = await fetch('/api/settings/test', { method: 'POST' });
      const data = await response.json();
      setWpConnection(data.success ? 'connected' : 'failed');
      // Reset after 5 seconds
      setTimeout(() => setWpConnection('unknown'), 5000);
    } catch {
      setWpConnection('failed');
      setTimeout(() => setWpConnection('unknown'), 5000);
    }
  }, []);

  const isRunning = !['idle', 'complete', 'failed'].includes(status.step);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Article Automation</h1>
              <p className="text-sm text-muted-foreground">
                SEO content generation dashboard
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Connection test button */}
            <button
              onClick={testConnection}
              disabled={wpConnection === 'testing'}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                wpConnection === 'connected'
                  ? 'bg-green-500/20 text-green-500'
                  : wpConnection === 'failed'
                  ? 'bg-destructive/20 text-destructive'
                  : wpConnection === 'testing'
                  ? 'bg-primary/20 text-primary'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {wpConnection === 'testing' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : wpConnection === 'connected' ? (
                <Wifi className="w-4 h-4" />
              ) : wpConnection === 'failed' ? (
                <WifiOff className="w-4 h-4" />
              ) : (
                <Wifi className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">
                {wpConnection === 'testing'
                  ? 'Testing...'
                  : wpConnection === 'connected'
                  ? 'Connected'
                  : wpConnection === 'failed'
                  ? 'Failed'
                  : 'Test WP'}
              </span>
            </button>
            <Link
              href="/history"
              className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
              title="History"
            >
              <History className="w-5 h-5" />
            </Link>
            <Link
              href="/settings"
              className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Pipeline status */}
          <div className="lg:col-span-2 space-y-6">
            <PipelineStatus
              step={status.step as any}
              progress={status.progress}
              message={status.message}
              topic={status.topic}
              error={status.error}
            />
            <LogViewer logs={status.logs} />
          </div>

          {/* Right column - Generate form */}
          <div className="space-y-6">
            <GenerateForm
              isRunning={isRunning}
              onGenerate={handleGenerate}
              onReset={handleReset}
              onCancel={handleCancel}
            />
          </div>
        </div>

        {/* Article history */}
        <div className="mt-8">
          <ArticleHistory articles={articles} />
        </div>
      </main>
    </div>
  );
}
