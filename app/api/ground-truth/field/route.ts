import { NextRequest, NextResponse } from 'next/server';
import { deleteGroundTruthField, upsertGroundTruthField } from '@/lib/ground-truth';
import { isValidDocumentType } from '@/lib/config';
import { GroundTruthEntry } from '@/lib/types';

// POST: fixes (creates or overwrites) the correct value for a single field —
// the "desempate" a reviewer records while comparing two executions.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      dataset_id,
      radicado,
      document_type,
      field_path,
      valor,
      estado,
      observacion,
      updated_by,
    } = body;

    if (!dataset_id || !radicado || !document_type || !field_path) {
      return NextResponse.json(
        { error: 'Missing required fields: dataset_id, radicado, document_type, field_path' },
        { status: 400 }
      );
    }
    if (!isValidDocumentType(document_type)) {
      return NextResponse.json(
        { error: `Invalid document_type: ${document_type}` },
        { status: 400 }
      );
    }

    const entry: GroundTruthEntry = {
      valor: valor ?? null,
      estado: estado ?? null,
      observacion: observacion ?? null,
      updated_by: updated_by || undefined,
      updated_at: new Date().toISOString(),
    };

    await upsertGroundTruthField(dataset_id, radicado, document_type, field_path, entry);
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error('Error saving ground truth field:', error);
    return NextResponse.json(
      { error: 'Failed to save ground truth field' },
      { status: 500 }
    );
  }
}

// DELETE: removes a previously fixed field.
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const datasetId = searchParams.get('dataset_id');
    const radicado = searchParams.get('radicado');
    const documentType = searchParams.get('document_type');
    const fieldPath = searchParams.get('field_path');

    if (!datasetId || !radicado || !documentType || !fieldPath) {
      return NextResponse.json(
        { error: 'Missing required query params: dataset_id, radicado, document_type, field_path' },
        { status: 400 }
      );
    }

    const deleted = await deleteGroundTruthField(datasetId, radicado, documentType, fieldPath);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Ground truth field not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting ground truth field:', error);
    return NextResponse.json(
      { error: 'Failed to delete ground truth field' },
      { status: 500 }
    );
  }
}
