import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/postgres';
import { IncidentLink } from '@/lib/types';

// PATCH: either closes a bullet with its resolution — "qué implementaron
// para solucionar" the ClickUp issue — or, if the body carries
// status: 'reverted', rolls back a previously closed bullet, recording who
// reverted it and why. Bullets open with just a plan/description; closing is
// how the team records what was actually done, later the same day; a
// rollback records that the implemented change had to be undone.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (status === 'reverted') {
      const { revert_reason, reverted_by } = body;

      if (!revert_reason) {
        return NextResponse.json(
          { error: 'Missing revert_reason' },
          { status: 400 }
        );
      }

      const result = await query<IncidentLink>(
        `UPDATE incident_links SET
          status = 'reverted', revert_reason = $1, reverted_by = $2,
          reverted_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND status = 'closed'
        RETURNING *`,
        [revert_reason, reverted_by || null, id]
      );

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Bullet not found or not resolved yet' },
          { status: 404 }
        );
      }

      return NextResponse.json(result.rows[0]);
    }

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
    console.error('Error updating incident:', error);
    return NextResponse.json(
      { error: 'Failed to update incident' },
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
