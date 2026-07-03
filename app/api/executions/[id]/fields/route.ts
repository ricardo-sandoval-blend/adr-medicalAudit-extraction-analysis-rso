import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/postgres';
import { Execution, ExecutionFieldsResponse } from '@/lib/types';
import { readExecutionDocument, listExecutionNames } from '@/lib/extraction';
import { isValidDocumentType } from '@/lib/config';

// GET /api/executions/[id]/fields?radicado=&type=&execution=
// The flattened extracted fields of one document of one radicado, as
// produced by this execution. Reads the on-disk extraction output (see
// lib/extraction.ts); `found: false` when no matching file exists.
//
// The `execution` query param specifies the on-disk execution folder name
// (e.g. "alpha0079-opus-236"). If omitted, all execution folders are
// searched and the first match is returned.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const radicado = searchParams.get('radicado');
    const type = searchParams.get('type');
    const executionName = searchParams.get('execution');

    if (!radicado || !type) {
      return NextResponse.json(
        { error: 'Missing required query params: radicado, type' },
        { status: 400 }
      );
    }
    if (!isValidDocumentType(type)) {
      return NextResponse.json({ error: `Invalid type: ${type}` }, { status: 400 });
    }

    // Validate the DB execution exists
    const result = await query<Execution>('SELECT * FROM executions WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
    }

    // If a specific execution folder was provided, look only there.
    // Otherwise, search all execution folders for this radicado + type.
    if (executionName) {
      const lookup = await readExecutionDocument(executionName, radicado, type);
      const response: ExecutionFieldsResponse = {
        execution_id: id,
        radicado,
        document_type: type,
        found: lookup.found,
        fields: lookup.fields,
      };
      return NextResponse.json(response);
    }

    // Fallback: search across all execution folders
    const execNames = await listExecutionNames();
    for (const name of execNames) {
      const lookup = await readExecutionDocument(name, radicado, type);
      if (lookup.found) {
        const response: ExecutionFieldsResponse = {
          execution_id: id,
          radicado,
          document_type: type,
          found: true,
          fields: lookup.fields,
        };
        return NextResponse.json(response);
      }
    }

    // Nothing found in any execution folder
    const response: ExecutionFieldsResponse = {
      execution_id: id,
      radicado,
      document_type: type,
      found: false,
      fields: {},
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
