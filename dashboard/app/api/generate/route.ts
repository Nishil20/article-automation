import { NextRequest, NextResponse } from 'next/server';
import { getStatus, runPipeline, resetPipeline, cancelPipeline } from '@/lib/pipeline';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topic, voiceTone, action } = body;

    // Handle cancel action
    if (action === 'cancel') {
      cancelPipeline();
      return NextResponse.json({
        success: true,
        message: 'Pipeline cancelled',
      });
    }

    // Start the pipeline
    runPipeline({ topic, voiceTone }).catch(console.error);

    return NextResponse.json({
      success: true,
      message: 'Pipeline started',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to start pipeline' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(getStatus());
}

export async function DELETE() {
  resetPipeline();
  return NextResponse.json({ success: true, message: 'Pipeline reset' });
}
