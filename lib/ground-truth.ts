import { mkdir, readdir, readFile, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { GroundTruthDocument, GroundTruthEntry, GroundTruthRadicado, GroundTruthSet } from './types';

// Ground truth is stored as JSON files on disk (not in the DB), mirroring
// how `executions/` stores real extraction output:
//   ground-truth/<dataset_id>/<radicado_full_id>/<document_type>.json
// Each file is a flat map of `field_path -> GroundTruthEntry`, built up
// incrementally one field at a time as a reviewer fixes values while
// comparing two executions.
const GROUND_TRUTH_PATH = process.env.GROUND_TRUTH_PATH || join(process.cwd(), 'ground-truth');

// dataset_id/radicado_full_id come straight from request params and are used
// as path segments; reject anything that could escape GROUND_TRUTH_PATH.
function assertSafeSegment(segment: string, label: string): void {
  if (!segment || segment.includes('..') || segment.includes('/') || segment.includes('\\')) {
    throw new Error(`Invalid ${label}: ${segment}`);
  }
}

function radicadoDir(datasetId: string, radicadoFullId: string): string {
  assertSafeSegment(datasetId, 'dataset_id');
  assertSafeSegment(radicadoFullId, 'radicado');
  return join(GROUND_TRUTH_PATH, datasetId, radicadoFullId);
}

function documentPath(datasetId: string, radicadoFullId: string, documentType: string): string {
  return join(radicadoDir(datasetId, radicadoFullId), `${documentType}.json`);
}

async function readDocument(
  datasetId: string,
  radicadoFullId: string,
  documentType: string
): Promise<GroundTruthDocument> {
  try {
    const raw = await readFile(documentPath(datasetId, radicadoFullId, documentType), 'utf-8');
    return JSON.parse(raw) as GroundTruthDocument;
  } catch {
    return {};
  }
}

// Reads the ground truth defined for a radicado. Pass `documentType` to read
// a single document's fields; omit it to read every document type that has
// a ground-truth file for this radicado.
export async function readGroundTruth(
  datasetId: string,
  radicadoFullId: string,
  documentType?: string
): Promise<GroundTruthRadicado> {
  const documents: Record<string, GroundTruthDocument> = {};

  if (documentType) {
    const doc = await readDocument(datasetId, radicadoFullId, documentType);
    if (Object.keys(doc).length > 0) documents[documentType] = doc;
    return { dataset_id: datasetId, radicado_full_id: radicadoFullId, documents };
  }

  let filenames: string[];
  try {
    filenames = await readdir(radicadoDir(datasetId, radicadoFullId));
  } catch {
    return { dataset_id: datasetId, radicado_full_id: radicadoFullId, documents };
  }

  for (const filename of filenames) {
    if (!filename.endsWith('.json')) continue;
    const type = filename.replace(/\.json$/, '');
    const doc = await readDocument(datasetId, radicadoFullId, type);
    if (Object.keys(doc).length > 0) documents[type] = doc;
  }

  return { dataset_id: datasetId, radicado_full_id: radicadoFullId, documents };
}

// Sets (creates or overwrites) the ground truth for a single field. Creates
// the dataset/radicado folders on first write.
export async function upsertGroundTruthField(
  datasetId: string,
  radicadoFullId: string,
  documentType: string,
  fieldPath: string,
  entry: GroundTruthEntry
): Promise<void> {
  await mkdir(radicadoDir(datasetId, radicadoFullId), { recursive: true });
  const doc = await readDocument(datasetId, radicadoFullId, documentType);
  doc[fieldPath] = entry;
  await writeFile(documentPath(datasetId, radicadoFullId, documentType), JSON.stringify(doc, null, 2));
}

// Removes a single field's ground truth. Deletes the document file entirely
// once its last field is removed. Returns false if the field wasn't set.
export async function deleteGroundTruthField(
  datasetId: string,
  radicadoFullId: string,
  documentType: string,
  fieldPath: string
): Promise<boolean> {
  const doc = await readDocument(datasetId, radicadoFullId, documentType);
  if (!(fieldPath in doc)) return false;

  delete doc[fieldPath];
  const path = documentPath(datasetId, radicadoFullId, documentType);
  if (Object.keys(doc).length === 0) {
    await unlink(path).catch(() => {});
  } else {
    await writeFile(path, JSON.stringify(doc, null, 2));
  }
  return true;
}

// Lists every radicado that has at least one ground-truth field defined,
// across all datasets. Used by the ground-truth management view.
export async function listGroundTruthSets(): Promise<GroundTruthSet[]> {
  const sets: GroundTruthSet[] = [];

  let datasetDirs: string[];
  try {
    datasetDirs = await readdir(GROUND_TRUTH_PATH);
  } catch {
    return sets;
  }

  for (const datasetId of datasetDirs) {
    let radicadoDirs: string[];
    try {
      radicadoDirs = await readdir(join(GROUND_TRUTH_PATH, datasetId));
    } catch {
      continue;
    }

    for (const radicadoFullId of radicadoDirs) {
      let filenames: string[];
      try {
        filenames = await readdir(join(GROUND_TRUTH_PATH, datasetId, radicadoFullId));
      } catch {
        continue;
      }

      const documentTypes: string[] = [];
      let fieldCount = 0;
      for (const filename of filenames) {
        if (!filename.endsWith('.json')) continue;
        const type = filename.replace(/\.json$/, '');
        const doc = await readDocument(datasetId, radicadoFullId, type);
        const count = Object.keys(doc).length;
        if (count === 0) continue;
        documentTypes.push(type);
        fieldCount += count;
      }

      if (fieldCount > 0) {
        sets.push({
          dataset_id: datasetId,
          radicado_full_id: radicadoFullId,
          document_types: documentTypes,
          field_count: fieldCount,
        });
      }
    }
  }

  return sets;
}
