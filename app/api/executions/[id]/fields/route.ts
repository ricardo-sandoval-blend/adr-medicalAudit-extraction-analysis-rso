import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/postgres';
import { Execution, ExecutionFieldsResponse } from '@/lib/types';
import { readExecutionDocument } from '@/lib/extraction';
import { isValidDocumentType } from '@/lib/config';

// GET /api/executions/[id]/fields?radicado=&type=
// The flattened extracted fields of one document of one radicado, as
// produced by this execution. Reads the on-disk extraction output (see
// lib/extraction.ts); `found: false` when no matching file exists.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const radicado = searchParams.get('radicado');
    const type = searchParams.get('type');

    if (!radicado || !type) {
      return NextResponse.json(
        { error: 'Missing required query params: radicado, type' },
        { status: 400 }
      );
    }
    if (!isValidDocumentType(type)) {
      return NextResponse.json({ error: `Invalid type: ${type}` }, { status: 400 });
    }

    const result = await query<Execution>('SELECT * FROM executions WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
    }
    const execution = result.rows[0];

    const lookup = await readExecutionDocument(new Date(execution.created_at), radicado, type);

    const response: ExecutionFieldsResponse = {
      execution_id: id,
      radicado,
      document_type: type,
      found: lookup.found,
      fields: lookup.fields,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching execution fields:', error);
    return NextResponse.json(
      { error: 'Failed to fetch execution fields' },
      { status: 500 }
    );
  }
}
