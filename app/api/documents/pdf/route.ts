import { NextRequest, NextResponse } from 'next/server';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';

const DATASETS_PATH =
  process.env.DATASETS_PATH || join(process.cwd(), 'datasets');

// GET /api/documents/pdf?radicado=000930_800149384_70563119&type=ADM
// Serves the PDF file for a given radicado and document type.
// Searches directly in DATASETS_PATH/<radicado>/TYPE_nit_suffix.pdf
// Also searches inside dataset subdirectories if the radicado is not at root.
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const radicado = searchParams.get('radicado');
    const type = searchParams.get('type');

    if (!radicado || !type) {
      return NextResponse.json(
        { error: 'Missing required params: radicado, type' },
        { status: 400 }
      );
    }

    // Strategy 1: radicado folder directly under DATASETS_PATH
    const directPath = join(DATASETS_PATH, radicado);
    const found = await findPdfInDir(directPath, type);
    if (found) return found;

    // Strategy 2: radicado folder inside a dataset subdirectory
    // (datasets/<dataset-id>/<radicado>/)
    try {
      const datasetDirs = await readdir(DATASETS_PATH, { withFileTypes: true });
      for (const entry of datasetDirs) {
        if (!entry.isDirectory()) continue;
        const nestedPath = join(DATASETS_PATH, entry.name, radicado);
        const nestedFound = await findPdfInDir(nestedPath, type);
        if (nestedFound) return nestedFound;
      }
    } catch {
      // Ignore errors reading directories
    }

    return NextResponse.json(
      { error: 'PDF not found', radicado, type },
      { status: 404 }
    );
  } catch (error) {
    console.error('Error serving PDF:', error);
    return NextResponse.json(
      { error: 'Failed to serve PDF' },
      { status: 500 }
    );
  }
}

async function findPdfInDir(
  dirPath: string,
  type: string
): Promise<NextResponse | null> {
  let files: string[];
  try {
    files = await readdir(dirPath);
  } catch {
    return null;
  }

  // PDF naming: TYPE_nit_suffix.pdf — type is the first segment
  const pdfFile = files.find((f) => {
    if (!f.toLowerCase().endsWith('.pdf')) return false;
    const prefix = f.split('_')[0];
    return prefix === type;
  });

  if (!pdfFile) return null;

  try {
    const pdfBuffer = await readFile(join(dirPath, pdfFile));
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${pdfFile}"`,
      },
    });
  } catch {
    return null;
  }
}
