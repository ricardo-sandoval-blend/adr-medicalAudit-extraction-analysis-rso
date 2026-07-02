import { NextRequest, NextResponse } from 'next/server';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { query } from '@/db/postgres';
import { Dataset, Execution } from '@/lib/types';

const DATASETS_PATH = process.env.DATASETS_PATH || join(process.cwd(), 'datasets');

async function calculateDirSize(dirPath: string): Promise<number> {
  let size = 0;
  try {
    const files = await readdir(dirPath);
    for (const file of files) {
      const filePath = join(dirPath, file);
      const fileStats = await stat(filePath);
      if (fileStats.isFile()) {
        size += fileStats.size;
      }
    }
  } catch {
    // Ignore errors
  }
  return size;
}

async function countPDFs(dirPath: string): Promise<number> {
  let count = 0;
  try {
    const files = await readdir(dirPath);
    count = files.filter((f) => f.endsWith('.pdf')).length;
  } catch {
    // Ignore errors
  }
  return count;
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
        const pdfCount = await countPDFs(dirPath);
        const sizeMb =
          (await calculateDirSize(dirPath)) / (1024 * 1024);
        const lastExecution = await getLastExecution(dirName);

        datasets.push({
          id: dirName,
          name: dirName,
          path: dirPath,
          pdf_count: pdfCount,
          total_size_mb: Math.round(sizeMb * 100) / 100,
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
