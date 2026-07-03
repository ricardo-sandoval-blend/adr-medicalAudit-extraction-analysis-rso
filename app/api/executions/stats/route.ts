import { NextRequest, NextResponse } from 'next/server';
import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';

const EXECUTIONS_PATH =
  process.env.EXECUTIONS_PATH || join(process.cwd(), 'executions');

// Document type labels for display
const DOC_TYPE_LABELS: Record<string, string> = {
  ADM: 'Documentos Administrativos',
  PDX: 'Prescripción Diagnóstica',
  HAU: 'Historia de Atención de Urgencias',
  HAM: 'Historia de Atención Médica',
  HEV: 'Hoja de Evolución',
  EPI: 'Epicrisis',
  FAC: 'Factura',
  ORD: 'Orden Médica',
  AUT: 'Autorización',
  PAR: 'Paraclínicos',
  FOR: 'Formulación',
};

interface FieldStats {
  total: number;
  encontrado: number;
  no_encontrado: number;
  con_valor: number;
  sin_valor: number;
}

interface DocumentTypeStats {
  type: string;
  label: string;
  count: number;
  fields: FieldStats;
}

interface ExecutionStats {
  execution_name: string;
  total_radicados: number;
  total_documents: number;
  document_types: DocumentTypeStats[];
  field_extraction_rate: number; // percentage of fields with valor != null
  nits: { nit: string; count: number }[];
}

// Recursively count extraction leaves in a JSON object
function countFields(
  obj: unknown,
  stats: FieldStats
): void {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return;

  const record = obj as Record<string, unknown>;

  // If this is a leaf node (has 'estado' or 'valor')
  if ('estado' in record || 'valor' in record) {
    stats.total++;
    const estado = record.estado as string | undefined;
    if (estado === 'NO_ENCONTRADO') {
      stats.no_encontrado++;
    } else {
      stats.encontrado++;
    }
    if (record.valor !== null && record.valor !== undefined) {
      stats.con_valor++;
    } else {
      stats.sin_valor++;
    }
    return;
  }

  // Recurse into children
  for (const value of Object.values(record)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      countFields(value, stats);
    }
  }
}

async function computeExecutionStats(
  executionName: string
): Promise<ExecutionStats> {
  const execPath = join(EXECUTIONS_PATH, executionName);
  const radicadoDirs = await readdir(execPath);

  let totalDocuments = 0;
  const docTypeMap = new Map<string, { count: number; fields: FieldStats }>();
  const nitMap = new Map<string, number>();

  for (const radicadoDir of radicadoDirs) {
    const match = radicadoDir.match(/^(\d+)_(\d+)_(.+)$/);
    if (!match) continue;

    const [, , nit] = match;
    nitMap.set(nit, (nitMap.get(nit) || 0) + 1);

    const radicadoPath = join(execPath, radicadoDir);
    let files: string[];
    try {
      files = await readdir(radicadoPath);
    } catch {
      continue;
    }

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      // Parse document type from filename: 000_ADM_800149384_70563119.json
      const parts = file.replace(/\.json$/i, '').split('_');
      const docType = parts[1] || 'UNKNOWN';

      totalDocuments++;

      if (!docTypeMap.has(docType)) {
        docTypeMap.set(docType, {
          count: 0,
          fields: { total: 0, encontrado: 0, no_encontrado: 0, con_valor: 0, sin_valor: 0 },
        });
      }
      const entry = docTypeMap.get(docType)!;
      entry.count++;

      // Read and analyze the JSON content
      try {
        const content = await readFile(join(radicadoPath, file), 'utf-8');
        const data = JSON.parse(content);
        countFields(data, entry.fields);
      } catch {
        // Skip unreadable files
      }
    }
  }

  // Compute overall extraction rate
  let totalFields = 0;
  let totalConValor = 0;
  const documentTypes: DocumentTypeStats[] = [];

  for (const [type, data] of docTypeMap.entries()) {
    totalFields += data.fields.total;
    totalConValor += data.fields.con_valor;
    documentTypes.push({
      type,
      label: DOC_TYPE_LABELS[type] || type,
      count: data.count,
      fields: data.fields,
    });
  }

  // Sort document types by count descending
  documentTypes.sort((a, b) => b.count - a.count);

  // Top NITs
  const nits = Array.from(nitMap.entries())
    .map(([nit, count]) => ({ nit, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const validRadicados = radicadoDirs.filter((d) => d.match(/^\d+_\d+_.+$/));

  return {
    execution_name: executionName,
    total_radicados: validRadicados.length,
    total_documents: totalDocuments,
    document_types: documentTypes,
    field_extraction_rate: totalFields > 0
      ? Math.round((totalConValor / totalFields) * 1000) / 10
      : 0,
    nits,
  };
}

// GET /api/executions/stats?execution=<name>
// Returns extraction statistics computed from the JSON files on disk.
// If no execution param is provided, returns stats for all executions.
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const executionName = searchParams.get('execution');

    if (executionName) {
      const stats = await computeExecutionStats(executionName);
      return NextResponse.json(stats);
    }

    // Return summary for all executions
    const entries = await readdir(EXECUTIONS_PATH, { withFileTypes: true });
    const execDirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();

    const allStats: ExecutionStats[] = [];
    for (const dir of execDirs) {
      try {
        const stats = await computeExecutionStats(dir);
        allStats.push(stats);
      } catch {
        // Skip unreadable
      }
    }

    const totalRadicados = allStats.reduce((s, e) => s + e.total_radicados, 0);
    const totalDocuments = allStats.reduce((s, e) => s + e.total_documents, 0);

    // Aggregate document type stats across all executions
    const aggregatedTypes = new Map<string, DocumentTypeStats>();
    for (const exec of allStats) {
      for (const dt of exec.document_types) {
        if (!aggregatedTypes.has(dt.type)) {
          aggregatedTypes.set(dt.type, { ...dt, fields: { ...dt.fields } });
        } else {
          const existing = aggregatedTypes.get(dt.type)!;
          existing.count += dt.count;
          existing.fields.total += dt.fields.total;
          existing.fields.encontrado += dt.fields.encontrado;
          existing.fields.no_encontrado += dt.fields.no_encontrado;
          existing.fields.con_valor += dt.fields.con_valor;
          existing.fields.sin_valor += dt.fields.sin_valor;
        }
      }
    }

    let globalTotalFields = 0;
    let globalConValor = 0;
    for (const dt of aggregatedTypes.values()) {
      globalTotalFields += dt.fields.total;
      globalConValor += dt.fields.con_valor;
    }

    return NextResponse.json({
      total_executions: allStats.length,
      total_radicados: totalRadicados,
      total_documents: totalDocuments,
      field_extraction_rate: globalTotalFields > 0
        ? Math.round((globalConValor / globalTotalFields) * 1000) / 10
        : 0,
      document_types: Array.from(aggregatedTypes.values()).sort(
        (a, b) => b.count - a.count
      ),
      executions: allStats,
    });
  } catch (error) {
    console.error('Error computing execution stats:', error);
    return NextResponse.json(
      { error: 'Failed to compute execution stats' },
      { status: 500 }
    );
  }
}
