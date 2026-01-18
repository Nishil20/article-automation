'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Terminal, ChevronDown } from 'lucide-react';

interface LogViewerProps {
  logs: string[];
}

export function LogViewer({ logs }: LogViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Activity Log</h2>
        </div>
        {logs.length > 0 && (
          <span className="text-xs text-muted-foreground px-2 py-0.5 bg-secondary rounded-full">
            {logs.length} entries
          </span>
        )}
      </div>
      
      <div
        ref={containerRef}
        className={cn(
          'h-52 overflow-y-auto font-mono text-xs',
          'bg-[#0d1117] p-4'
        )}
      >
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <Terminal className="w-8 h-8 mb-2 opacity-30" />
            <p>Waiting for activity...</p>
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log, index) => {
              const isError = log.includes('ERROR');
              const isSuccess = log.includes('SUCCESS');
              const isInfo = log.includes('INFO') || log.includes('Starting') || log.includes('Calling');
              
              return (
                <div
                  key={index}
                  className={cn(
                    'py-1 px-2 rounded animate-fade-in',
                    isError && 'text-red-400 bg-red-500/10',
                    isSuccess && 'text-green-400 bg-green-500/10',
                    isInfo && 'text-blue-400',
                    !isError && !isSuccess && !isInfo && 'text-slate-400'
                  )}
                >
                  <span className="text-slate-600 select-none">{String(index + 1).padStart(2, '0')} </span>
                  {log}
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Scroll indicator */}
      {logs.length > 10 && (
        <div className="flex items-center justify-center py-1.5 bg-secondary/30 border-t border-border">
          <ChevronDown className="w-3 h-3 text-muted-foreground animate-bounce" />
        </div>
      )}
    </div>
  );
}
