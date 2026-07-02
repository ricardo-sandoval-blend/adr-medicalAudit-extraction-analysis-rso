import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/postgres';
import { Execution } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await query<Execution>(
      'SELECT * FROM executions WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Execution not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching execution:', error);
    return NextResponse.json(
      { error: 'Failed to fetch execution' },
      { status: 500 }
    );
  }
}

// PATCH: update a 'draft' execution while radicados are being accumulated
// during the day. Only allowed while the execution is still a draft — once
// it starts running (POST /api/execute) it is no longer editable here.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { dataset_id, version_id, criteria, total_documents, pdf_count } = body;

    const sets: string[] = [];
    const values: unknown[] = [];

    if (dataset_id !== undefined) {
      values.push(dataset_id);
      sets.push(`dataset_id = $${values.length}`);
    }
    if (version_id !== undefined) {
      values.push(version_id);
      sets.push(`version_id = $${values.length}`);
    }
    if (criteria !== undefined) {
      values.push(JSON.stringify(criteria));
      sets.push(`criteria = $${values.length}`);
    }
    if (total_documents !== undefined) {
      values.push(total_documents);
      sets.push(`total_documents = $${values.length}`);
    }
    if (pdf_count !== undefined) {
      values.push(pdf_count);
      sets.push(`pdf_count = $${values.length}`);
    }

    if (sets.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    values.push(id);
    const result = await query<Execution>(
      `UPDATE executions SET ${sets.join(', ')}
       WHERE id = $${values.length} AND status = 'draft'
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Draft execution not found (it may have already started)' },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating execution:', error);
    return NextResponse.json(
      { error: 'Failed to update execution' },
      { status: 500 }
    );
  }
}

// DELETE: remove a planned execution from the planning table. Only allowed
// while it's still a 'draft' — once it starts running it's part of the
// execution history and shouldn't be deleted from here.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await query(
      `DELETE FROM executions WHERE id = $1 AND status = 'draft' RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Draft execution not found (it may have already started)' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting execution:', error);
    return NextResponse.json(
      { error: 'Failed to delete execution' },
      { status: 500 }
    );
  }
}
