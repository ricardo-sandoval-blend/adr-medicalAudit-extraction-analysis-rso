import { NextRequest, NextResponse } from 'next/server';
import { mkdir } from 'fs/promises';
import { join } from 'path';

const EXECUTIONS_PATH =
  process.env.EXECUTIONS_PATH || join(process.cwd(), 'executions');

// POST /api/executions/create-folder
// Creates the execution folder structure on disk so it appears as a card
// in the Executor view. Body: { name: string, radicados?: string[] }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, radicados } = body as {
      name: string;
      radicados?: string[];
    };

    if (!name) {
      return NextResponse.json(
        { error: 'Missing required field: name' },
        { status: 400 }
      );
    }

    // Create the execution directory
    const execPath = join(EXECUTIONS_PATH, name);
    await mkdir(execPath, { recursive: true });

    // Create radicado subdirectories if provided
    if (radicados && radicados.length > 0) {
      for (const radicado of radicados) {
        await mkdir(join(execPath, radicado), { recursive: true });
      }
    }

    return NextResponse.json(
      { success: true, path: execPath, name },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating execution folder:', error);
    return NextResponse.json(
      { error: 'Failed to create execution folder' },
      { status: 500 }
    );
  }
}
