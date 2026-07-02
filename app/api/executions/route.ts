import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/postgres';
import { Execution } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const datasetId = searchParams.get('datasetId');
    const versionId = searchParams.get('versionId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');

    const conditions: string[] = [];
    const values: any[] = [];

    if (datasetId) {
      values.push(datasetId);
      conditions.push(`dataset_id = $${values.length}`);
    }
    if (versionId) {
      values.push(versionId);
      conditions.push(`version_id = $${values.length}`);
    }
    if (status) {
      values.push(status);
      conditions.push(`status = $${values.length}`);
    }

    let sql = 'SELECT * FROM executions';
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    values.push(limit);
    sql += ` ORDER BY created_at DESC LIMIT $${values.length}`;

    const result = await query<Execution>(sql, values);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching executions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch executions' },
      { status: 500 }
    );
  }
}

// Creates an execution record. Used directly by the Executor to open a
// 'draft' execution (version_id + dataset_id) that mandatory radicados get
// accumulated into during the day, before "Iniciar" promotes it to 'running'
// via POST /api/execute.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      dataset_id,
      version_id,
      status,
      total_documents,
      successful_count,
      error_count,
      pdf_count,
      metrics,
      criteria,
      errors,
      previous_execution_id,
      created_by,
    } = body;

    if (!dataset_id) {
      return NextResponse.json(
        { error: 'Missing dataset_id' },
        { status: 400 }
      );
    }

    const result = await query<Execution>(
      `INSERT INTO executions (
        dataset_id, version_id, status, total_documents, successful_count,
        error_count, pdf_count, metrics, criteria, errors,
        previous_execution_id, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        dataset_id,
        version_id || null,
        status || 'pending',
        total_documents || 0,
        successful_count || 0,
        error_count || 0,
        pdf_count || 0,
        JSON.stringify(metrics || {}),
        JSON.stringify(criteria || {}),
        errors || [],
        previous_execution_id,
        created_by,
      ]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating execution:', error);
    return NextResponse.json(
      { error: 'Failed to create execution' },
      { status: 500 }
    );
  }
}
