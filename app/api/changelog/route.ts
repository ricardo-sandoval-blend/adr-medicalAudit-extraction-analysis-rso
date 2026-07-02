import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/postgres';
import {
  StructureVersion,
  IncidentLink,
  ChangelogEntry,
  Execution,
} from '@/lib/types';

// GET changelog entries
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const datasetId = searchParams.get('datasetId');

    if (!datasetId) {
      return NextResponse.json(
        { error: 'datasetId is required' },
        { status: 400 }
      );
    }

    // Get structure versions for this dataset
    const versionsResult = await query<StructureVersion>(
      `SELECT sv.* FROM structure_versions sv
       JOIN executions e ON sv.execution_id = e.id
       WHERE e.dataset_id = $1
       ORDER BY sv.created_at DESC`,
      [datasetId]
    );

    const entries: ChangelogEntry[] = [];

    for (const version of versionsResult.rows) {
      // Get incidents for this version
      const incidentsResult = await query<IncidentLink>(
        `SELECT * FROM incident_links WHERE version_id = $1
         ORDER BY created_at DESC`,
        [version.id]
      );

      // Get execution metrics for snapshot
      const execResult = await query<Execution>(
        `SELECT * FROM executions WHERE id = $1`,
        [version.execution_id]
      );

      const execution = execResult.rows[0];

      entries.push({
        version,
        field_changes: [], // TODO: Calculate field changes from previous version
        metrics_snapshot: {
          total_documents: execution?.total_documents || 0,
          success_rate: execution
            ? (execution.successful_count /
                execution.total_documents) *
              100
            : 0,
          error_count: execution?.error_count || 0,
        },
        incidents: incidentsResult.rows,
      });
    }

    return NextResponse.json(entries);
  } catch (error) {
    console.error('Error fetching changelog:', error);
    return NextResponse.json(
      { error: 'Failed to fetch changelog' },
      { status: 500 }
    );
  }
}

// POST: register a "bullet" against a version — a ClickUp issue together
// with the change it made (document type + description), stamped with the
// person who registered it. Bullets are grouped by document_type when
// displayed on the Changelog page.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      version_id,
      clickup_url,
      title,
      document_type,
      description,
      created_by,
    } = body;

    if (!version_id || !clickup_url) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Extract Clickup ID from URL
    const urlMatch = clickup_url.match(/clickup\.com\/t\/([a-z0-9]+)/i);
    const clickupId = urlMatch ? urlMatch[1] : clickup_url;

    const result = await query<IncidentLink>(
      `INSERT INTO incident_links (
        version_id, clickup_id, clickup_url, title, document_type,
        description, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        version_id,
        clickupId,
        clickup_url,
        title,
        document_type || null,
        description || null,
        created_by || null,
      ]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error adding incident:', error);
    return NextResponse.json(
      { error: 'Failed to add incident' },
      { status: 500 }
    );
  }
}
