import { NextRequest, NextResponse } from 'next/server';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { query } from '@/db/postgres';
import { Dataset, Execution } from '@/lib/types';

const DATASETS_PATH = process.env.DATASETS_PATH || join(process.cwd(), 'datasets');

// A dataset directory holds one subfolder per radicado (e.g.
// 'datasets/prod-234/000930_800149384_70563119/'), each containing that
// radicado's PDF documents. Some datasets may still use a flat layout with
// PDFs directly at the root, so both are counted here.
async function scanDataset(
  dirPath: string
): Promise<{ pdfCount: number; sizeBytes: number; radicadoCount: number }> {
  let pdfCount = 0;
  let sizeBytes = 0;
  let radicadoCount = 0;

  try {
    const entries = await readdir(dirPath);
    for (const entry of entries) {
      const entryPath = join(dirPath, entry);
      const entryStats = await stat(entryPath);

      if (entryStats.isDirectory()) {
        radicadoCount++;
        const files = await readdir(entryPath);
        for (const file of files) {
          if (!file.toLowerCase().endsWith('.pdf')) continue;
          const fileStats = await stat(join(entryPath, file));
          if (fileStats.isFile()) {
            pdfCount++;
            sizeBytes += fileStats.size;
          }
        }
      } else if (entryStats.isFile() && entry.toLowerCase().endsWith('.pdf')) {
        // Flat layout fallback: PDFs directly under the dataset root.
        pdfCount++;
        sizeBytes += entryStats.size;
      }
    }
  } catch {
    // Ignore errors
  }

  return { pdfCount, sizeBytes, radicadoCount };
}

async function getLastExecution(
  datasetId: string
): Promise<Execution | null> {
  try {
    const result = await query<Execution>(
      `SELECT * FROM executions WHERE dataset_id = $1 AND status = 'success'
       ORDER BY created_at DESC LIMIT 1`,
      [datasetId]
    );
    return result.rows[0] || null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const datasets: Dataset[] = [];

    // List datasets from filesystem
    const datasetDirs = await readdir(DATASETS_PATH);

    for (const dirName of datasetDirs) {
      const dirPath = join(DATASETS_PATH, dirName);
      const dirStats = await stat(dirPath);

      if (dirStats.isDirectory()) {
        const { pdfCount, sizeBytes, radicadoCount } = await scanDataset(dirPath);
        const lastExecution = await getLastExecution(dirName);

        datasets.push({
          id: dirName,
          name: dirName,
          path: dirPath,
          pdf_count: pdfCount,
          total_size_mb: Math.round((sizeBytes / (1024 * 1024)) * 100) / 100,
          radicado_count: radicadoCount,
          last_execution: lastExecution || undefined,
        });
      }
    }

    return NextResponse.json(datasets);
  } catch (error) {
    console.error('Error fetching datasets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch datasets' },
      { status: 500 }
    );
  }
}
