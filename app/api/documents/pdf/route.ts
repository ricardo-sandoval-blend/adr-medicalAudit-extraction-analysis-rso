import { NextRequest, NextResponse } from 'next/server';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';

const DATASETS_PATH =
  process.env.DATASETS_PATH || join(process.cwd(), 'datasets');

// GET /api/documents/pdf?radicado=000930_800149384_70563119&type=ADM&dataset=<optional>
// Serves the PDF file for a given radicado and document type.
// Searches across all datasets if dataset is not specified.
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const radicado = searchParams.get('radicado');
    const type = searchParams.get('type');
    const dataset = searchParams.get('dataset');

    if (!radicado || !type) {
      return NextResponse.json(
        { error: 'Missing required params: radicado, type' },
        { status: 400 }
      );
    }

    // Search for the PDF in datasets
    const searchDirs = dataset
      ? [join(DATASETS_PATH, dataset)]
      : await getDatasetDirs();

    for (const datasetDir of searchDirs) {
      const radicadoPath = join(datasetDir, radicado);
      let files: string[];
      try {
        files = await readdir(radicadoPath);
      } catch {
        continue;
      }

      // Find PDF matching the type (e.g. ADM_800149384_70563119.pdf)
      const pdfFile = files.find((f) => {
        if (!f.toLowerCase().endsWith('.pdf')) return false;
        const prefix = f.split('_')[0];
        return prefix === type;
      });

      if (pdfFile) {
        try {
          const pdfBuffer = await readFile(join(radicadoPath, pdfFile));
          return new NextResponse(pdfBuffer, {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `inline; filename="${pdfFile}"`,
            },
          });
        } catch {
          continue;
        }
      }
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

async function getDatasetDirs(): Promise<string[]> {
  try {
    const entries = await readdir(DATASETS_PATH, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => join(DATASETS_PATH, e.name));
  } catch {
    return [];
  }
}
