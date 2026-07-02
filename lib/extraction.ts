import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { ExtractionFieldMap } from './types';

const EXECUTIONS_PATH = process.env.EXECUTIONS_PATH || join(process.cwd(), 'executions');

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// A leaf in the extraction JSON is an object carrying at least one of
// `valor`/`estado`; every other object is an intermediate node to recurse
// into (e.g. `entidad_prestadora`).
function isExtractionLeaf(value: Record<string, unknown>): boolean {
  return 'valor' in value || 'estado' in value;
}

// Recursively walks an extraction JSON object, collecting every leaf node
// keyed by its dot-separated path, e.g.
// 'paz_y_salvo_transporte.entidad_prestadora.nit'. Ground-truth field files
// (lib/ground-truth.ts) use the same path space so a flattened extraction and
// a ground-truth document can be compared key by key.
export function flattenExtraction(node: unknown, prefix = ''): ExtractionFieldMap {
  const result: ExtractionFieldMap = {};
  if (!isPlainObject(node)) return result;

  if (isExtractionLeaf(node)) {
    if (!prefix) return result; // a bare leaf at the document root — nothing to key it by
    result[prefix] = {
      valor: node.valor ?? null,
      estado: typeof node.estado === 'string' ? node.estado : null,
      observacion: typeof node.observacion === 'string' ? node.observacion : null,
    };
    return result;
  }

  for (const [key, value] of Object.entries(node)) {
    if (!isPlainObject(value)) continue; // skip scalar fields, e.g. 'tipo_soporte'
    const path = prefix ? `${prefix}.${key}` : key;
    Object.assign(result, flattenExtraction(value, path));
  }
  return result;
}

// A dataset radicado folder is named '{numero}_{nit}_{suffix}', but an
// execution's on-disk radicado folder drops the suffix ('{numero}_{nit}').
// Extracts the shared prefix so a dataset radicado's full_id can be matched
// against an execution's output folder.
export function radicadoNumeroNit(radicadoFullId: string): string | null {
  const parts = radicadoFullId.split('_');
  if (parts.length < 2) return null;
  return `${parts[0]}_${parts[1]}`;
}

function formatDateFolder(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export interface ExecutionDocumentLookup {
  found: boolean;
  dateFolder: string;
  filename?: string;
  fields: ExtractionFieldMap;
}

// Locates and reads the extraction output for one document of one radicado,
// for the execution that ran on `executionDate` (an execution's created_at).
// Execution outputs are written to
// executions/<YYYYMMDD>/<numero>_<nit>/<seq>_<TYPE>_<nit>_<suffix>.json —
// keyed by calendar date rather than execution id, so two executions started
// the same day for the same radicado are not distinguishable on disk. When
// nothing is found (including because real extraction output doesn't exist
// yet for mocked executions), `found` is false rather than throwing.
export async function readExecutionDocument(
  executionDate: Date,
  radicadoFullId: string,
  documentType: string
): Promise<ExecutionDocumentLookup> {
  const dateFolder = formatDateFolder(executionDate);
  const numeroNit = radicadoNumeroNit(radicadoFullId);
  if (!numeroNit) return { found: false, dateFolder, fields: {} };

  const radicadoPath = join(EXECUTIONS_PATH, dateFolder, numeroNit);

  let filenames: string[];
  try {
    filenames = await readdir(radicadoPath);
  } catch {
    return { found: false, dateFolder, fields: {} };
  }

  // Filenames look like '000_ADM_807000041_CO04953628.json' — the document
  // type is always the second underscore-separated segment.
  const filename = filenames.find((name) => {
    const parts = name.replace(/\.json$/i, '').split('_');
    return parts[1] === documentType;
  });
  if (!filename) return { found: false, dateFolder, fields: {} };

  try {
    const raw = await readFile(join(radicadoPath, filename), 'utf-8');
    return { found: true, dateFolder, filename, fields: flattenExtraction(JSON.parse(raw)) };
  } catch {
    return { found: false, dateFolder, filename, fields: {} };
  }
}
