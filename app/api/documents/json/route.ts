import { NextRequest, NextResponse } from 'next/server';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';

const EXECUTIONS_PATH =
  process.env.EXECUTIONS_PATH || join(process.cwd(), 'executions');

// GET /api/documents/json?execution=alpha0079-opus-236&radicado=000930_800149384_70563119&type=ADM
// Returns the raw JSON extraction content for a specific document.
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const execution = searchParams.get('execution');
    const radicado = searchParams.get('radicado');
    const type = searchParams.get('type');

    if (!radicado || !type) {
      return NextResponse.json(
        { error: 'Missing required params: radicado, type' },
        { status: 400 }
      );
    }

    // If execution is specified, look only there; otherwise search all
    const execDirs = execution
      ? [execution]
      : await getExecutionNames();

    for (const execName of execDirs) {
      const radicadoPath = join(EXECUTIONS_PATH, execName, radicado);
      let files: string[];
      try {
        files = await readdir(radicadoPath);
      } catch {
        continue;
      }

      // Find JSON matching the document type
      // Filenames: 000_ADM_800149384_70563119.json — type is the 2nd segment
      const jsonFile = files.find((f) => {
        if (!f.endsWith('.json')) return false;
        const parts = f.replace(/\.json$/i, '').split('_');
        return parts[1] === type;
      });

      if (jsonFile) {
        try {
          const content = await readFile(join(radicadoPath, jsonFile), 'utf-8');
          const parsed = JSON.parse(content);
          return NextResponse.json({
            execution: execName,
            radicado,
            type,
            filename: jsonFile,
            data: parsed,
          });
        } catch {
          continue;
        }
      }
    }

    return NextResponse.json(
      { error: 'JSON document not found', radicado, type },
      { status: 404 }
    );
  } catch (error) {
    console.error('Error serving JSON document:', error);
    return NextResponse.json(
      { error: 'Failed to serve JSON document' },
      { status: 500 }
    );
  }
}

async function getExecutionNames(): Promise<string[]> {
  try {
    const entries = await readdir(EXECUTIONS_PATH, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }
}
