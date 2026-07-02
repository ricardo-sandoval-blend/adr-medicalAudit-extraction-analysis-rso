import { NextRequest, NextResponse } from 'next/server';
import { listGroundTruthSets, readGroundTruth } from '@/lib/ground-truth';

// GET /api/ground-truth
//   - ?dataset_id=&radicado=  -> the ground truth documents defined so far
//     for that radicado (GroundTruthRadicado)
//   - no filters              -> every radicado with at least one
//     ground-truth field defined (GroundTruthSet[]), for the management view
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const datasetId = searchParams.get('dataset_id');
    const radicado = searchParams.get('radicado');

    if (datasetId && radicado) {
      const result = await readGroundTruth(datasetId, radicado);
      return NextResponse.json(result);
    }

    const sets = await listGroundTruthSets();
    return NextResponse.json(sets);
  } catch (error) {
    console.error('Error fetching ground truth:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ground truth' },
      { status: 500 }
    );
  }
}
