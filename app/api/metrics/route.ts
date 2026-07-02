import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/postgres';
import { ExecutionMetric, MetricsResponse } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const executionId = searchParams.get('executionId');
    const datasetId = searchParams.get('datasetId');

    if (!executionId && !datasetId) {
      return NextResponse.json(
        { error: 'Must provide executionId or datasetId' },
        { status: 400 }
      );
    }

    let sql = `
      SELECT em.* FROM execution_metrics em
      JOIN executions e ON em.execution_id = e.id
    `;
    const values: any[] = [];

    if (executionId) {
      sql += ' WHERE em.execution_id = $1';
      values.push(executionId);
    } else if (datasetId) {
      sql += ' WHERE e.dataset_id = $1';
      values.push(datasetId);
      sql += ' ORDER BY em.created_at DESC LIMIT 10';
    }

    const result = await query<ExecutionMetric>(sql, values);
    const metrics = result.rows;

    // Calculate summary
    let improved_count = 0;
    let degraded_count = 0;
    let total_delta = 0;

    for (const metric of metrics) {
      if (metric.delta > 0) {
        improved_count++;
      } else if (metric.delta < 0) {
        degraded_count++;
      }
      total_delta += metric.delta || 0;
    }

    const response: MetricsResponse = {
      execution_id: executionId || 'dataset_' + datasetId,
      metrics,
      summary: {
        total_delta,
        improved_count,
        degraded_count,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}
