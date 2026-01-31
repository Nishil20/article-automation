'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { cn, formatDate, formatDuration, formatNumber } from '@/lib/utils';
import { ArrowLeft, ExternalLink, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';

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
  completedAt?: string;
}

export default function HistoryPage() {
  const [articles, setArticles] = useState<ArticleRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/history');
      const data = await response.json();
      if (Array.isArray(data)) {
        setArticles(data);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold">Article History</h1>
              <p className="text-sm text-muted-foreground">
                {articles.length} articles generated
              </p>
            </div>
          </div>
          <button
            onClick={fetchHistory}
            disabled={loading}
            className={cn(
              'p-2 rounded-lg hover:bg-secondary transition-colors',
              'text-muted-foreground hover:text-foreground',
              'disabled:opacity-50'
            )}
          >
            <RefreshCw className={cn('w-5 h-5', loading && 'animate-spin')} />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {loading && articles.length === 0 ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
            <p className="text-muted-foreground mt-4">Loading history...</p>
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No articles generated yet</p>
            <Link
              href="/"
              className="text-primary hover:underline text-sm mt-2 inline-block"
            >
              Generate your first article
            </Link>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                    Title
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                    Words
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                    Created
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                    Duration
                  </th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {articles.map((article) => (
                  <tr
                    key={article.id}
                    className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      {article.status === 'published' && (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-sm text-green-500">Published</span>
                        </div>
                      )}
                      {article.status === 'failed' && (
                        <div className="flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-destructive" />
                          <span className="text-sm text-destructive">Failed</span>
                        </div>
                      )}
                      {article.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-yellow-500" />
                          <span className="text-sm text-yellow-500">Pending</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-md">
                        <p className="font-medium truncate">
                          {article.title || article.topic}
                        </p>
                        {article.error && (
                          <p className="text-xs text-destructive mt-1 truncate">
                            {article.error}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-muted-foreground">
                        {article.wordCount > 0 ? formatNumber(article.wordCount) : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-muted-foreground">
                        {formatDate(article.createdAt)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-muted-foreground">
                        {article.completedAt
                          ? formatDuration(article.createdAt, article.completedAt)
                          : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {article.postUrl && (
                        <a
                          href={article.postUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            'inline-flex items-center gap-1 px-3 py-1.5',
                            'text-sm text-primary hover:underline'
                          )}
                        >
                          View <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
