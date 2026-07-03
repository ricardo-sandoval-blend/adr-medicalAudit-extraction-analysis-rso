import { NextRequest, NextResponse } from 'next/server';
import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';

const EXECUTIONS_PATH =
  process.env.EXECUTIONS_PATH || join(process.cwd(), 'executions');

interface ExecutionRunMetadata {
  execution_name: string;
  radicados: RadicadoEntry[];
  total_radicados: number;
  type: 'total' | 'sample';
}

interface RadicadoEntry {
  folder: string;
  seq: string;
  nit: string;
  suffix: string;
  documents: string[];
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') as 'total' | 'sample' | null;
    const executionName = searchParams.get('execution');
    const limit = parseInt(searchParams.get('limit') || '50');

    // List execution-name directories (e.g. alpha0079-opus-236)
    const execDirs = await readdir(EXECUTIONS_PATH);
    const executions: ExecutionRunMetadata[] = [];

    for (const execDir of execDirs.sort().reverse()) {
      const execPath = join(EXECUTIONS_PATH, execDir);

      // Skip non-directories
      try {
        const s = await stat(execPath);
        if (!s.isDirectory()) continue;
      } catch {
        continue;
      }

      // If a specific execution was requested, skip others
      if (executionName && execDir !== executionName) continue;

      try {
        const radicadoDirs = await readdir(execPath);

        // Determine execution type from metadata.json at execution level
        let execType: 'total' | 'sample' = 'total';
        try {
          const metadataContent = await readFile(
            join(execPath, 'metadata.json'),
            'utf-8'
          );
          const metadata = JSON.parse(metadataContent);
          execType = metadata.type || 'total';
        } catch {
          // Default to total
        }

        if (type && execType !== type) continue;

        const radicados: RadicadoEntry[] = [];

        for (const radicadoDir of radicadoDirs.sort()) {
          // Parse 3-segment format: seq_nit_suffix (e.g. 000930_800149384_70563119)
          const match = radicadoDir.match(/^(\d+)_(\d+)_(.+)$/);
          if (!match) continue;

          const [, seq, nit, suffix] = match;

          // List JSON documents inside this radicado folder
          let documents: string[] = [];
          try {
            const files = await readdir(join(execPath, radicadoDir));
            documents = files.filter((f) => f.endsWith('.json'));
          } catch {
            // Skip unreadable folders
          }

          radicados.push({
            folder: radicadoDir,
            seq,
            nit,
            suffix,
            documents,
          });
        }

        executions.push({
          execution_name: execDir,
          radicados: radicados.slice(0, limit),
          total_radicados: radicados.length,
          type: execType,
        });

        if (executions.length >= limit) break;
      } catch {
        // Skip if can't read execution directory
      }
    }

    return NextResponse.json({
      total: executions.length,
      executions: executions.slice(0, limit),
    });
  } catch (error) {
    console.error('Error fetching execution history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch execution history' },
      { status: 500 }
    );
  }
}
