import { NextResponse } from 'next/server';
import { query } from '@/db/postgres';

// GET: operational overview for the dashboard — issues filed/resolved
// (incident_links, across all versions) and executions actually run
// (excludes 'draft', which hasn't been triggered yet).
export async function GET() {
  try {
    const [issuesResult, executionsResult] = await Promise.all([
      query<{ total: string; resolved: string }>(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'closed') AS resolved
         FROM incident_links`
      ),
      query<{ total: string }>(
        `SELECT COUNT(*) AS total FROM executions WHERE status != 'draft'`
      ),
    ]);

    const total = parseInt(issuesResult.rows[0].total, 10);
    const resolved = parseInt(issuesResult.rows[0].resolved, 10);

    return NextResponse.json({
      issues: {
        total,
        resolved,
        open: total - resolved,
      },
      executions: {
        total: parseInt(executionsResult.rows[0].total, 10),
      },
    });
  } catch (error) {
    console.error('Error fetching operational stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch operational stats' },
      { status: 500 }
    );
  }
}
