import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/postgres';
import { Version, Execution, IncidentLink } from '@/lib/types';

// GET: version detail, including the executions run against it and its
// linked ClickUp incidents ("ver ejecuciones dentro de cada versión").
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const versionResult = await query<Version>(
      'SELECT * FROM versions WHERE id = $1',
      [id]
    );

    if (versionResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      );
    }

    const [executionsResult, incidentsResult] = await Promise.all([
      query<Execution>(
        'SELECT * FROM executions WHERE version_id = $1 ORDER BY created_at DESC',
        [id]
      ),
      query<IncidentLink>(
        'SELECT * FROM incident_links WHERE version_id = $1 ORDER BY created_at DESC',
        [id]
      ),
    ]);

    return NextResponse.json({
      ...versionResult.rows[0],
      executions: executionsResult.rows,
      incidents: incidentsResult.rows,
    });
  } catch (error) {
    console.error('Error reading version:', error);
    return NextResponse.json(
      { error: 'Failed to read version' },
      { status: 500 }
    );
  }
}

// PATCH: close the version (status='closed') once the day's measurement
// looks good. Reopening is not supported here to keep the "one open version
// at a time" guarantee.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (status !== 'closed') {
      return NextResponse.json(
        { error: "Only status: 'closed' is supported" },
        { status: 400 }
      );
    }

    const result = await query<Version>(
      `UPDATE versions SET status = 'closed', closed_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating version:', error);
    return NextResponse.json(
      { error: 'Failed to update version' },
      { status: 500 }
    );
  }
}
