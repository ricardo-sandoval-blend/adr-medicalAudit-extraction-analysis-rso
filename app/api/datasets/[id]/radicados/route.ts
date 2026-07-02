import { NextRequest, NextResponse } from 'next/server';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { DatasetRadicado, RadicadoDocument } from '@/lib/types';
import { isValidDocumentType } from '@/lib/config';

const DATASETS_PATH = process.env.DATASETS_PATH || join(process.cwd(), 'datasets');

// A radicado folder is named '{numero}_{nit}_{suffix}', e.g.
// '000930_800149384_70563119'. The suffix itself may contain underscores
// (e.g. claim references like 'FEHM864146'), so only the first two segments
// are fixed.
function parseRadicadoDir(
  dirName: string
): { numero: string; nit: string; suffix: string } | null {
  const parts = dirName.split('_');
  if (parts.length < 3) return null;
  const [numero, nit, ...rest] = parts;
  if (!numero || !nit) return null;
  return { numero, nit, suffix: rest.join('_') };
}

// Documents inside a radicado folder are named '{TYPE}_{nit}_{suffix}.pdf',
// e.g. 'ADM_800149384_700678828.pdf' -> type 'ADM'. Only PDFs whose prefix
// matches a known document type (the same catalog used by the changelog's
// document type list) are returned.
async function getRadicadoDocuments(dirPath: string): Promise<RadicadoDocument[]> {
  const docs: RadicadoDocument[] = [];
  try {
    const files = await readdir(dirPath);
    for (const file of files) {
      if (!file.toLowerCase().endsWith('.pdf')) continue;
      const type = file.split('_')[0];
      if (!isValidDocumentType(type)) continue;
      docs.push({ type, filename: file, path: join(dirPath, file) });
    }
  } catch {
    // Ignore errors reading an individual radicado folder.
  }
  return docs;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const search = (searchParams.get('search') || '').trim().toLowerCase();
    const limit = parseInt(searchParams.get('limit') || '100');

    const datasetPath = join(DATASETS_PATH, id);
    const dirEntries = (await readdir(datasetPath)).sort();

    const radicados: DatasetRadicado[] = [];
    for (const dirName of dirEntries) {
      const parsed = parseRadicadoDir(dirName);
      if (!parsed) continue;

      if (search) {
        const haystack = `${dirName} ${parsed.numero} ${parsed.nit}`.toLowerCase();
        if (!haystack.includes(search)) continue;
      }

      const dirPath = join(datasetPath, dirName);
      const dirStats = await stat(dirPath);
      if (!dirStats.isDirectory()) continue;

      const documents = await getRadicadoDocuments(dirPath);
      radicados.push({
        full_id: dirName,
        numero: parsed.numero,
        nit: parsed.nit,
        suffix: parsed.suffix,
        documents,
      });

      if (radicados.length >= limit) break;
    }

    return NextResponse.json(radicados);
  } catch (error) {
    console.error('Error fetching dataset radicados:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dataset radicados' },
      { status: 500 }
    );
  }
}
