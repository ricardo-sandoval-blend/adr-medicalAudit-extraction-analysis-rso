import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/postgres';
import { Execution, GroundTruthScoreField, GroundTruthScoreResponse } from '@/lib/types';
import { readGroundTruth } from '@/lib/ground-truth';
import { ExecutionDocumentLookup, readExecutionDocument } from '@/lib/extraction';

function normalize(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
}

// GET /api/ground-truth/score?dataset_id=&radicado=&execution_id=
// Measures one execution's extracted values against the ground truth fixed
// for a radicado, field by field — the "desempate" that lets future
// executions be measured against a past review decision.
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const datasetId = searchParams.get('dataset_id');
    const radicado = searchParams.get('radicado');
    const executionId = searchParams.get('execution_id');

    if (!datasetId || !radicado || !executionId) {
      return NextResponse.json(
        { error: 'Missing required query params: dataset_id, radicado, execution_id' },
        { status: 400 }
      );
    }

    const executionResult = await query<Execution>(
      'SELECT * FROM executions WHERE id = $1',
      [executionId]
    );
    if (executionResult.rows.length === 0) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
    }
    const execution = executionResult.rows[0];

    const groundTruth = await readGroundTruth(datasetId, radicado);
    const fields: GroundTruthScoreField[] = [];

    // One extraction lookup per document type — a radicado's ground truth
    // usually spans only a handful of document types.
    const extractionByType = new Map<string, ExecutionDocumentLookup>();

    for (const [documentType, doc] of Object.entries(groundTruth.documents)) {
      if (!extractionByType.has(documentType)) {
        extractionByType.set(
          documentType,
          await readExecutionDocument(new Date(execution.created_at), radicado, documentType)
        );
      }
      const extraction = extractionByType.get(documentType)!;

      for (const [fieldPath, expected] of Object.entries(doc)) {
        const actualLeaf = extraction.fields[fieldPath] ?? null;
        const match =
          normalize(expected.valor) === normalize(actualLeaf?.valor) &&
          normalize(expected.estado) === normalize(actualLeaf?.estado);

        fields.push({
          document_type: documentType,
          field_path: fieldPath,
          expected: { valor: expected.valor, estado: expected.estado ?? null },
          actual: actualLeaf
            ? { valor: actualLeaf.valor, estado: actualLeaf.estado ?? null }
            : null,
          match,
        });
      }
    }

    const total = fields.length;
    const matched = fields.filter((f) => f.match).length;

    const response: GroundTruthScoreResponse = {
      execution_id: executionId,
      dataset_id: datasetId,
      radicado_full_id: radicado,
      fields,
      summary: {
        total,
        matched,
        accuracy: total > 0 ? Math.round((matched / total) * 1000) / 10 : 0,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error scoring execution against ground truth:', error);
    return NextResponse.json(
      { error: 'Failed to score execution against ground truth' },
      { status: 500 }
    );
  }
}
