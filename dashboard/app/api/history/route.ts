import { NextResponse } from 'next/server';
import { getHistory } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const history = await getHistory();
    return NextResponse.json(history);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch history' },
      { status: 500 }
    );
  }
}
