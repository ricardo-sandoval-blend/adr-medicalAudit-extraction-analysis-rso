import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/postgres';
import { IncidentLink } from '@/lib/types';

// PATCH: close a bullet with its resolution — "qué implementaron para
// solucionar" the ClickUp issue. Bullets open with just a plan/description;
// this is how the team records what was actually done, later the same day.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { resolution, closed_by } = body;

    if (!resolution) {
      return NextResponse.json(
        { error: 'Missing resolution' },
        { status: 400 }
      );
    }

    const result = await query<IncidentLink>(
      `UPDATE incident_links SET
        status = 'closed', resolution = $1, closed_by = $2,
        closed_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND status = 'open'
      RETURNING *`,
      [resolution, closed_by || null, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Bullet not found or already closed' },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error closing incident:', error);
    return NextResponse.json(
      { error: 'Failed to close incident' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await query(
      'DELETE FROM incident_links WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Incident not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting incident:', error);
    return NextResponse.json(
      { error: 'Failed to delete incident' },
      { status: 500 }
    );
  }
}
