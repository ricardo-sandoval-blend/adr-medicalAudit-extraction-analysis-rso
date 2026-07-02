import { NextRequest, NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const EXECUTIONS_PATH = process.env.EXECUTIONS_PATH ||
  join(process.cwd(), 'executions');

interface ExecutionMetadata {
  date: string; // YYYYMMDD
  radicado: string;
  nit: string;
  type: 'total' | 'sample'; // total or sample
  timestamp?: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') as 'total' | 'sample' | null;
    const limit = parseInt(searchParams.get('limit') || '50');

    const executions: ExecutionMetadata[] = [];

    // List date directories
    const dateDirs = await readdir(EXECUTIONS_PATH);

    for (const dateDir of dateDirs.sort().reverse()) {
      const datePath = join(EXECUTIONS_PATH, dateDir);

      try {
        const radicadoDirs = await readdir(datePath);

        for (const radicadoDir of radicadoDirs) {
          // Parse radicado_nit format
          const match = radicadoDir.match(/^(\d+)_(\d+)$/);
          if (!match) continue;

          const [, radicado, nit] = match;

          // Check if metadata.json exists to determine type
          const metadataPath = join(datePath, radicadoDir, 'metadata.json');
          let execType: 'total' | 'sample' = 'total'; // Default to total

          try {
            const metadataContent = await readFile(metadataPath, 'utf-8');
            const metadata = JSON.parse(metadataContent);
            execType = metadata.type || 'total';
          } catch {
            // If no metadata, default to total
          }

          // Filter by type if requested
          if (type && execType !== type) continue;

          executions.push({
            date: dateDir,
            radicado,
            nit,
            type: execType,
          });

          if (executions.length >= limit) break;
        }

        if (executions.length >= limit) break;
      } catch {
        // Skip if can't read date directory
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
