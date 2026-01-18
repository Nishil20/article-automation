'use client';

import { cn, formatDate, formatNumber } from '@/lib/utils';
import { ExternalLink, CheckCircle, XCircle, Clock } from 'lucide-react';

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

interface ArticleHistoryProps {
  articles: ArticleRecord[];
}

export function ArticleHistory({ articles }: ArticleHistoryProps) {
  if (articles.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Articles</h2>
        <div className="text-center py-8">
          <p className="text-muted-foreground">No articles generated yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Click &quot;Generate Article&quot; to create your first article
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="text-lg font-semibold mb-4">Recent Articles</h2>
      
      <div className="space-y-3">
        {articles.slice(0, 10).map((article) => (
          <div
            key={article.id}
            className={cn(
              'flex items-center gap-4 p-4 rounded-lg',
              'bg-secondary/50 hover:bg-secondary/70 transition-colors'
            )}
          >
            {/* Status icon */}
            <div className="flex-shrink-0">
              {article.status === 'published' && (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
              {article.status === 'failed' && (
                <XCircle className="w-5 h-5 text-destructive" />
              )}
              {article.status === 'pending' && (
                <Clock className="w-5 h-5 text-yellow-500 animate-pulse" />
              )}
            </div>

            {/* Article info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate">
                {article.title || article.topic}
              </h3>
              <p className="text-sm text-muted-foreground">
                {formatDate(article.createdAt)}
                {article.wordCount > 0 && (
                  <span className="ml-2">• {formatNumber(article.wordCount)} words</span>
                )}
              </p>
              {article.error && (
                <p className="text-xs text-destructive mt-1 truncate">
                  {article.error}
                </p>
              )}
            </div>

            {/* View link */}
            {article.postUrl && (
              <a
                href={article.postUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'flex-shrink-0 p-2 rounded-lg',
                  'hover:bg-secondary transition-colors',
                  'text-muted-foreground hover:text-foreground'
                )}
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        ))}
      </div>

      {articles.length > 10 && (
        <p className="text-sm text-muted-foreground text-center mt-4">
          Showing 10 of {articles.length} articles
        </p>
      )}
    </div>
  );
}
