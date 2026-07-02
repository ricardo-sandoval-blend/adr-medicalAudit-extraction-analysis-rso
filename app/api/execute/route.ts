import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/db/postgres';
import {
  ExecuteRequest,
  ExecuteResponse,
  Execution,
  ExecutionMetric,
  Version,
} from '@/lib/types';

async function getPreviousExecution(
  datasetId: string
): Promise<Execution | null> {
  try {
    const result = await query<Execution>(
      `SELECT * FROM executions WHERE dataset_id = $1 AND status IN ('success', 'failed')
       ORDER BY created_at DESC LIMIT 1`,
      [datasetId]
    );
    return result.rows[0] || null;
  } catch {
    return null;
  }
}

// Computes mock metrics and finalizes the execution (running -> success).
// There is no real extraction service wired up yet (see TODO below), so
// without this the row would stay 'running' forever and could never be
// reviewed/closed from the Changelog. This only completes the existing mock
// simulation instantly; it does not implement real extraction.
async function finalizeMockExecution(
  executionId: string,
  previousExecution: Execution | null,
  sampleSize: number
) {
  return transaction(async (client) => {
    const mockMetrics = {
      documents_processed: sampleSize,
      success_rate: 95.5,
      new_fields: Math.floor(Math.random() * 5),
      errors: Math.floor(sampleSize * 0.045),
    };

    if (previousExecution) {
      for (const [key, currentValue] of Object.entries(mockMetrics)) {
        const previousValue = previousExecution.metrics[key] || 0;
        const delta = (currentValue as number) - previousValue;

        await client.query<ExecutionMetric>(
          `INSERT INTO execution_metrics (
            execution_id, metric_key, current_value, previous_value, delta
          ) VALUES ($1, $2, $3, $4, $5)`,
          [executionId, key, currentValue, previousValue, delta]
        );
      }
    }

    const successfulCount = Math.round(sampleSize - mockMetrics.errors);
    await client.query(
      `UPDATE executions SET
        status = 'success', completed_at = CURRENT_TIMESTAMP,
        successful_count = $1, error_count = $2, metrics = $3
      WHERE id = $4`,
      [
        successfulCount,
        mockMetrics.errors,
        JSON.stringify(mockMetrics),
        executionId,
      ]
    );
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ExecuteRequest;
    const {
      execution_id,
      dataset_id,
      pdf_paths,
      sample_size,
      version_id,
      criteria,
    } = body;

    if (!dataset_id || !pdf_paths || !sample_size || !version_id) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: dataset_id, pdf_paths, sample_size, version_id',
        },
        { status: 400 }
      );
    }

    const versionResult = await query<Version>(
      'SELECT * FROM versions WHERE id = $1',
      [version_id]
    );
    if (versionResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      );
    }
    const version = versionResult.rows[0];
    const pdfCount = pdf_paths.length || sample_size;

    const previousExecution = await getPreviousExecution(dataset_id);

    let execution: Execution;

    if (execution_id) {
      // Promote the draft execution accumulated during the day to 'running'.
      const existingResult = await query<Execution>(
        'SELECT * FROM executions WHERE id = $1',
        [execution_id]
      );
      if (existingResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Execution not found' },
          { status: 404 }
        );
      }
      if (existingResult.rows[0].status !== 'draft') {
        return NextResponse.json(
          { error: 'Execution has already been started' },
          { status: 409 }
        );
      }

      const updateResult = await query<Execution>(
        `UPDATE executions SET
          dataset_id = $1, status = 'running', total_documents = $2,
          pdf_count = $3, criteria = $4, changelog_version = $5,
          version_id = $6, previous_execution_id = $7
        WHERE id = $8 AND status = 'draft'
        RETURNING *`,
        [
          dataset_id,
          sample_size,
          pdfCount,
          JSON.stringify(criteria || {}),
          version.version,
          version_id,
          previousExecution?.id || null,
          execution_id,
        ]
      );
      execution = updateResult.rows[0];
    } else {
      const insertResult = await query<Execution>(
        `INSERT INTO executions (
          dataset_id, status, total_documents, successful_count,
          error_count, pdf_count, metrics, criteria, changelog_version,
          version_id, previous_execution_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          dataset_id,
          'running',
          sample_size,
          0,
          0,
          pdfCount,
          JSON.stringify({}),
          JSON.stringify(criteria || {}),
          version.version,
          version_id,
          previousExecution?.id || null,
        ]
      );
      execution = insertResult.rows[0];
    }

    // TODO: Trigger actual extraction service instead of the mock finalize
    // below. This could be:
    // - API call to external service
    // - Queue message (Bull, RabbitMQ)
    // - Background job
    await finalizeMockExecution(execution.id, previousExecution, sample_size);

    const response: ExecuteResponse = {
      execution_id: execution.id,
      status: 'running',
      message: `Started processing ${pdf_paths.length} PDFs from dataset ${dataset_id}`,
    };

    return NextResponse.json(response, { status: 202 });
  } catch (error) {
    console.error('Error executing extraction:', error);
    return NextResponse.json(
      { error: 'Failed to execute extraction' },
      { status: 500 }
    );
  }
}

// GET endpoint to check execution status
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const executionId = searchParams.get('id');

    if (!executionId) {
      return NextResponse.json(
        { error: 'Missing execution id' },
        { status: 400 }
      );
    }

    const result = await query<Execution>(
      'SELECT * FROM executions WHERE id = $1',
      [executionId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Execution not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching execution status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch execution status' },
      { status: 500 }
    );
  }
}
