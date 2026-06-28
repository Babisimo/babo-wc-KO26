import { NextResponse } from 'next/server';
import { getNextGames } from '@/app/actions/next-games';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getNextGames());
}
