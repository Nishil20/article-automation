import { NextRequest } from 'next/server';
import { subscribe, getStatus } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      // Send initial status
      const status = getStatus();
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify(status)}\n\n`)
      );

      // Subscribe to updates
      const unsubscribe = subscribe((newStatus) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(newStatus)}\n\n`)
          );
        } catch {
          // Stream closed
          unsubscribe();
        }
      });

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
