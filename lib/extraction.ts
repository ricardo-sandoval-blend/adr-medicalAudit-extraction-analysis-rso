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

// A radicado folder is named '{seq}_{nit}_{suffix}' (3 segments).
// Returns the full folder name as-is since it's used directly as the path.
export function radicadoNumeroNit(radicadoFullId: string): string | null {
  const parts = radicadoFullId.split('_');
  if (parts.length < 2) return null;
  // Return the full id — folder names in disk use 3 segments (seq_nit_suffix)
  return radicadoFullId;
}

export interface ExecutionDocumentLookup {
  found: boolean;
  executionFolder: string;
  filename?: string;
  fields: ExtractionFieldMap;
}

// Locates and reads the extraction output for one document of one radicado.
// The on-disk layout is:
//   executions/<execution-name>/<seq>_<nit>_<suffix>/<docseq>_<TYPE>_<nit>_<suffix>.json
//
// `executionName` identifies the execution folder (e.g. "alpha0079-opus-236").
// `radicadoFullId` is the full 3-segment folder name (e.g. "000930_800149384_70563119").
// `documentType` is the type code (e.g. "ADM", "PDX", "HAU").
//
// When nothing is found, `found` is false rather than throwing.
export async function readExecutionDocument(
  executionName: string,
  radicadoFullId: string,
  documentType: string
): Promise<ExecutionDocumentLookup> {
  const radicadoPath = join(EXECUTIONS_PATH, executionName, radicadoFullId);

  let filenames: string[];
  try {
    filenames = await readdir(radicadoPath);
  } catch {
    return { found: false, executionFolder: executionName, fields: {} };
  }

  // Filenames look like '000_ADM_800149384_70563119.json' — the document
  // type is always the second underscore-separated segment.
  const filename = filenames.find((name) => {
    const parts = name.replace(/\.json$/i, '').split('_');
    return parts[1] === documentType;
  });
  if (!filename) return { found: false, executionFolder: executionName, fields: {} };

  try {
    const raw = await readFile(join(radicadoPath, filename), 'utf-8');
    return {
      found: true,
      executionFolder: executionName,
      filename,
      fields: flattenExtraction(JSON.parse(raw)),
    };
  } catch {
    return { found: false, executionFolder: executionName, filename, fields: {} };
  }
}

// Lists all available execution names from disk (the top-level directories
// inside the EXECUTIONS_PATH).
export async function listExecutionNames(): Promise<string[]> {
  try {
    const entries = await readdir(EXECUTIONS_PATH, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}
