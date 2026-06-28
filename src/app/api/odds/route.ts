import { NextResponse } from 'next/server';
import { getOdds } from '@/app/actions/odds';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // the Monte Carlo can take a couple seconds

export async function GET() {
  try {
    return NextResponse.json(await getOdds());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to compute odds' },
      { status: 502 },
    );
  }
}
