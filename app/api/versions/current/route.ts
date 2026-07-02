import { NextResponse } from 'next/server';
import { query } from '@/db/postgres';
import { Version } from '@/lib/types';

// GET: the single open version draft, or null if none. Both Executor and
// Changelog use this to know which version is active.
export async function GET() {
  try {
    const result = await query<Version>(
      `SELECT * FROM versions WHERE status = 'open' ORDER BY created_at DESC LIMIT 1`
    );

    return NextResponse.json({ version: result.rows[0] || null });
  } catch (error) {
    console.error('Error fetching current version:', error);
    return NextResponse.json(
      { error: 'Failed to fetch current version' },
      { status: 500 }
    );
  }
}
